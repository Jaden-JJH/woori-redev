"""우리동네 재개발 비서 API."""

import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from typing import Literal

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from woori.api import views
from woori.config import get_settings
from woori.content.loader import get_content
from woori.db import connection
from woori.llm.router import answer_router, embedder, vision_router
from woori.rag import pipeline
from woori.rag.explain import explain as explain_image
from woori.rag.pipeline import InputError
from woori.rag.retriever import get_retriever

log = logging.getLogger("woori.api")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

ResidentType = Literal["owner", "tenant", "shop_tenant"]

ERROR_MESSAGES = {
    "ZONE_NOT_FOUND": (404, "선택한 구역을 찾을 수 없어요."),
    "INVALID_RESIDENT_TYPE": (400, "주민 유형을 다시 선택해 주세요."),
    "INVALID_QUESTION_LENGTH": (400, "질문은 2자 이상 300자 이하로 적어 주세요."),
    "IMAGE_TOO_LARGE": (413, "사진이 너무 커요. 10MB 이하로 올려 주세요."),
    "UNSUPPORTED_IMAGE": (415, "사진 파일(jpg, png)만 올릴 수 있어요."),
    "RATE_LIMITED": (429, "잠시 뒤에 다시 물어봐 주세요."),
    "LLM_UNAVAILABLE": (503, "잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요."),
}

app = FastAPI(title="우리동네 재개발 비서 API", version="1.0.0")
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def error(code: str) -> JSONResponse:
    status, message = ERROR_MESSAGES[code]
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


@app.exception_handler(InputError)
async def _input_error(_: Request, exc: InputError):
    return error(str(exc))


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Referrer-Policy"] = "no-referrer"
    resp.headers["Cache-Control"] = resp.headers.get("Cache-Control", "no-store")
    return resp


# ---------------------------------------------------------------- 요청 제한
# IP 는 메모리 카운터 키로만 쓰고 저장하거나 로그로 남기지 않는다.
_hits: dict[str, deque] = defaultdict(deque)


def rate_limit(request: Request) -> None:
    key = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0]
    now = time.monotonic()
    q = _hits[key]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= settings.rate_limit_per_min:
        raise HTTPException(status_code=429, detail="RATE_LIMITED")
    q.append(now)
    if len(_hits) > 10000:
        _hits.clear()


@app.exception_handler(HTTPException)
async def _http_error(_: Request, exc: HTTPException):
    if exc.detail in ERROR_MESSAGES:
        return error(exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"error": {"code": "HTTP_ERROR", "message": str(exc.detail)}})


def _zone(zone_id: str):
    c = get_content()
    if zone_id not in c.zones:
        raise InputError("ZONE_NOT_FOUND")
    return c, c.zones[zone_id]


# ---------------------------------------------------------------- 결정적 레이어
@app.get("/v1/zones")
def list_zones():
    c = get_content()
    return {"zones": [views.zone_summary(c, z) for z in sorted(c.zones.values(), key=lambda z: z.name)]}


@app.get("/v1/zones/{zone_id}/timeline")
def zone_timeline(zone_id: str):
    c, z = _zone(zone_id)
    return views.timeline(c, z)


@app.get("/v1/zones/{zone_id}/checklist")
def zone_checklist(zone_id: str, type: ResidentType):
    c, z = _zone(zone_id)
    return views.checklist(c, z, type)


@app.get("/v1/zones/{zone_id}/money")
def zone_money(zone_id: str, type: ResidentType):
    c, z = _zone(zone_id)
    return views.money(c, z, type)


@app.get("/v1/glossary")
def glossary():
    return {"terms": [t.model_dump() for t in get_content().glossary.terms]}


@app.get("/v1/suggestions")
def suggestions(type: ResidentType):
    return {"suggestions": get_content().refusals.suggestions[type]}


# ---------------------------------------------------------------- 생성 레이어
class AskBody(BaseModel):
    zone_id: str
    resident_type: ResidentType
    question: str = Field(min_length=2, max_length=300)


STEP_LABEL = {
    "analyze": "질문을 이해하고 있어요",
    "retrieve": "우리 구역 공식 문서를 찾고 있어요",
    "generate": "쉬운 말로 정리하고 있어요",
    "verify": "근거를 확인하고 있어요",
}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.post("/v1/ask", dependencies=[Depends(rate_limit)])
async def ask(body: AskBody, accept: str | None = Header(default=None)):
    if accept and "text/event-stream" in accept:
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def emit(step: str) -> None:
            loop.call_soon_threadsafe(queue.put_nowait, ("progress", {"step": step, "label": STEP_LABEL[step]}))

        async def run():
            try:
                res = await asyncio.to_thread(pipeline.ask, body.zone_id, body.resident_type, body.question, emit)
                await queue.put(("result", res))
            except InputError as e:
                status, message = ERROR_MESSAGES[str(e)]
                await queue.put(("error", {"code": str(e), "message": message}))
            except Exception:
                log.exception("ask failed")
                await queue.put(("error", {"code": "LLM_UNAVAILABLE", "message": ERROR_MESSAGES["LLM_UNAVAILABLE"][1]}))
            await queue.put(None)

        async def stream():
            task = asyncio.create_task(run())
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield _sse(*item)
            await task

        return StreamingResponse(stream(), media_type="text/event-stream", headers={"X-Accel-Buffering": "no"})

    res = await asyncio.to_thread(pipeline.ask, body.zone_id, body.resident_type, body.question)
    return res


@app.post("/v1/explain", dependencies=[Depends(rate_limit)])
async def explain(
    image: UploadFile = File(...),
    zone_id: str = Form(...),
    resident_type: ResidentType = Form(...),
):
    data = await image.read(10 * 1024 * 1024 + 1)
    return await asyncio.to_thread(explain_image, zone_id, resident_type, data)


# ---------------------------------------------------------------- 메타
@app.get("/v1/meta/freshness")
def freshness():
    c = get_content()
    with connection() as conn:
        latest = conn.execute(
            "SELECT notice_no, posted_at FROM notice WHERE tag_source <> 'derived' ORDER BY posted_at DESC, id DESC LIMIT 1"
        ).fetchone()
        runs = conn.execute(
            """SELECT DISTINCT ON (source) source, finished_at, fetched, failed FROM ingest_run
               WHERE finished_at IS NOT NULL ORDER BY source, finished_at DESC"""
        ).fetchall()
        counts = conn.execute(
            "SELECT count(*) FILTER (WHERE source_type='law') AS law, count(*) FILTER (WHERE source_type='notice') AS notice, "
            "count(*) FILTER (WHERE embedding IS NOT NULL) AS embedded FROM chunk"
        ).fetchone()
    return {
        "content_as_of": max(z.as_of for z in c.zones.values()).isoformat(),
        "latest_notice": {"notice_no": latest["notice_no"], "posted_at": latest["posted_at"].isoformat()} if latest else None,
        "runs": [{"source": r["source"], "finished_at": r["finished_at"].isoformat(), "fetched": r["fetched"],
                  "failed": r["failed"]} for r in runs],
        "index": counts,
    }


@app.get("/v1/meta/health")
def health():
    ok_db = True
    try:
        with connection() as conn:
            conn.execute("SELECT 1")
    except Exception:
        ok_db = False
    return {
        "db": ok_db,
        "answer_providers": [p.name for p in answer_router().providers],
        "vision_providers": [p.name for p in vision_router().providers],
        "embedder": embedder() is not None,
        "demo_mode": settings.demo_mode,
    }


@app.get("/v1/admin/stats")
def stats(x_admin_token: str | None = Header(default=None)):
    if not settings.admin_token or x_admin_token != settings.admin_token:
        raise HTTPException(status_code=403, detail="forbidden")
    with connection() as conn:
        by_outcome = conn.execute(
            "SELECT outcome, count(*) AS n FROM answer_trace GROUP BY 1 ORDER BY 2 DESC").fetchall()
        by_topic = conn.execute(
            "SELECT zone_id, topic, count(*) AS n FROM answer_trace WHERE endpoint='ask' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20"
        ).fetchall()
        latency = conn.execute(
            "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50, "
            "percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95 FROM answer_trace WHERE endpoint='ask'"
        ).fetchone()
    return {"by_outcome": by_outcome, "top_topics": by_topic, "latency_ms": latency}


@app.on_event("startup")
def _warm():
    get_content()
    try:
        get_retriever().ensure_loaded()
    except Exception:
        log.exception("retriever warmup failed")
