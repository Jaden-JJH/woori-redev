"""골든셋 평가 하네스.

실행 (backend 가상환경):
  cd backend && uv run python ../eval/run_eval.py --split dev --tag baseline
  cd backend && uv run python ../eval/run_eval.py --split all --judge --tag sonnet5

서비스와 같은 코드 경로(woori.rag.pipeline.ask)를 호출한다. 결과는 eval/reports/{날짜}_{tag}.json, .md 로 남는다.

지표 (계획서 10 참조)
- 범위 밖 거부율: E 문항 중 거부된 비율 (목표 100%)
- 과잉 거부율: A~D 문항 중 답하지 않은 비율 (목표 10% 이하)
- 정답 출처 적중률: 답변된 A~D 문항 중 gold_sources 가 인용에 포함된 비율 (목표 85% 이상)
- 필수 내용 포함률: must_include 를 모두 충족한 비율 (목표 90% 이상)
- 금지 표현 위반: must_not_include 등장 건수 (목표 0)
- 검색 적중률(Recall@k): gold_sources 청크가 검색 문맥에 들어간 비율 (목표 90% 이상)
- 출처 일치율(--judge): 답변 요점 중 인용 구절이 그 요점을 실제로 뒷받침한다고 판정된 비율 (목표 95% 이상)
- 지연 p50, p95
"""

import argparse
import datetime as dt
import json
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "backend"))

from woori.config import get_settings
from woori.content.loader import get_content
from woori.db import connection
from woori.llm.base import JsonRequest, LlmError
from woori.rag import prompts
from woori.rag.pipeline import ask
from woori.rag.retriever import get_retriever
from woori.rag.zone_context import zone_document
from woori.text import compact

JUDGE_SYSTEM = """\
너는 법률 안내 문장의 근거 일치 여부를 판정하는 심사자다.
각 요점(claim)과, 그 요점이 인용한 문서의 전문(sources)을 보고, 인용한 문서가 요점의 내용을 실제로 담고 있는지 판정한다.
쉬운 말로 풀어 쓴 것은 괜찮다. 뜻이 같은지를 본다.
- supported: 인용한 문서가 요점의 모든 사실(숫자, 기간, 조건, 주체)을 담고 있다.
- partial: 대체로 맞지만 인용 문서에 없는 사실이 더해졌거나 뜻이 좁혀지거나 넓혀졌다. 예: 원문 "사업시행자에게 행사할 수 있다"를 "집주인이 아니라 사업시행자에게"로 쓴 경우.
- unsupported: 인용 문서에 그 내용이 없거나 반대다.
판정 이유는 한 문장으로 쓴다.
"""

JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "verdicts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "index": {"type": "integer"},
                    "label": {"type": "string", "enum": ["supported", "partial", "unsupported"]},
                    "reason": {"type": "string"},
                },
                "required": ["index", "label", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["verdicts"],
    "additionalProperties": False,
}


def load_items(split: str, only: list[str] | None) -> list[dict]:
    data = yaml.safe_load((ROOT / "golden_set.yaml").read_text(encoding="utf-8"))
    items = data["items"]
    if split != "all":
        items = [i for i in items if i["split"] == split]
    if only:
        items = [i for i in items if any(i["id"].startswith(o) for o in only)]
    return items


def answer_text(r: dict) -> str:
    return " ".join([r.get("summary_plain") or "", *[p["text"] for p in r.get("points", [])]])


def includes(text: str, rules: list[str]) -> tuple[bool, list[str]]:
    t = compact(text)
    missing = [rule for rule in rules if not any(compact(alt) in t for alt in rule.split("|"))]
    return not missing, missing


def cited_labels(r: dict) -> set[str]:
    return {c["source_label"] for p in r.get("points", []) for c in p["citations"]}


def retrieved_labels(trace_id: str) -> set[str]:
    with connection() as conn:
        row = conn.execute("SELECT chunk_ids FROM answer_trace WHERE trace_id=%s", (trace_id,)).fetchone()
        if not row or not row["chunk_ids"]:
            return set()
        rows = conn.execute("SELECT source_label FROM chunk WHERE id = ANY(%s)", (row["chunk_ids"],)).fetchall()
    return {r["source_label"] for r in rows} | {"우리 구역 진행 현황"}


def _source_texts(r: dict, zone_id: str) -> dict:
    ids = sorted({c["chunk_id"] for p in r["points"] for c in p["citations"] if c["chunk_id"]})
    texts = {}
    if ids:
        with connection() as conn:
            for row in conn.execute("SELECT id, header, body FROM chunk WHERE id = ANY(%s)", (ids,)):
                texts[row["id"]] = f"{row['header']}\n{row['body']}"
    c = get_content()
    texts[None] = zone_document(c, c.zones[zone_id])
    return texts


def judge(r: dict, router, zone_id: str) -> list[dict]:
    texts = _source_texts(r, zone_id)
    claims = [
        {
            "index": i,
            "claim": p["text"],
            "sources": [{"label": c["source_label"], "text": texts.get(c["chunk_id"], "")} for c in p["citations"]],
        }
        for i, p in enumerate(r["points"])
    ]
    req = JsonRequest(
        task="judge",
        system=JUDGE_SYSTEM,
        user=json.dumps(claims, ensure_ascii=False),
        schema=JUDGE_SCHEMA,
        effort="low",
        max_tokens=3000,
    )
    return router.generate_json(req).data["verdicts"]


def run_one(item: dict, judge_router) -> dict:
    t0 = time.monotonic()
    try:
        r = ask(item["zone"], item["resident_type"], item["question"])
    except Exception as e:  # 한 문항 실패가 전체 평가를 멈추지 않게 한다
        return {"id": item["id"], "error": str(e)}
    latency = time.monotonic() - t0
    exp = item["expected"]
    answered = r["outcome"] == "answered"
    text = answer_text(r)
    ok_inc, missing = includes(text, exp["must_include"]) if answered else (False, exp["must_include"])
    violations = [w for w in exp["must_not_include"] if compact(w) in compact(text)]
    gold = set(exp["gold_sources"])
    cited = cited_labels(r)
    retrieved = retrieved_labels(r["trace_id"]) if exp["answerable"] else set()
    res = {
        "id": item["id"],
        "category": item["category"],
        "split": item["split"],
        "question": item["question"],
        "outcome": r["outcome"],
        "refusal_category": (r.get("refusal") or {}).get("category"),
        "latency_s": round(latency, 2),
        "answered": answered,
        "gold_hit": bool(gold & cited) if answered else None,
        "retrieval_hit": bool(gold & retrieved) if exp["answerable"] else None,
        "include_ok": ok_inc if exp["answerable"] else None,
        "missing": missing if exp["answerable"] else [],
        "violations": violations,
        "cited": sorted(cited),
        "summary": r.get("summary_plain"),
        "points": [p["text"] for p in r.get("points", [])],
    }
    if judge_router is not None and answered and r["points"]:
        try:
            res["judge"] = judge(r, judge_router, item["zone"])
        except LlmError as e:
            res["judge_error"] = str(e)[:200]
    return res


def pct(num: int, den: int) -> float | None:
    return round(100 * num / den, 1) if den else None


def summarize(results: list[dict]) -> dict:
    ok = [r for r in results if "error" not in r]
    inscope = [r for r in ok if r["category"] != "E"]
    oos = [r for r in ok if r["category"] == "E"]
    answered = [r for r in inscope if r["answered"]]
    lat = sorted(r["latency_s"] for r in ok if r["outcome"] == "answered")
    verdicts = [v for r in ok for v in r.get("judge", [])]
    by_cat = {}
    for cat in "ABCD":
        rs = [r for r in inscope if r["category"] == cat]
        by_cat[cat] = {"n": len(rs), "answered": sum(r["answered"] for r in rs),
                       "gold_hit": sum(bool(r["gold_hit"]) for r in rs)}
    return {
        "n": len(results),
        "errors": len(results) - len(ok),
        "out_of_scope_refusal_rate": pct(sum(not r["answered"] for r in oos), len(oos)),
        "over_refusal_rate": pct(sum(not r["answered"] for r in inscope), len(inscope)),
        "gold_source_hit_rate": pct(sum(bool(r["gold_hit"]) for r in answered), len(answered)),
        "must_include_rate": pct(sum(bool(r["include_ok"]) for r in inscope), len(inscope)),
        "forbidden_violations": sum(len(r["violations"]) for r in ok),
        "retrieval_recall": pct(sum(bool(r["retrieval_hit"]) for r in inscope), len(inscope)),
        "citation_support_rate": pct(sum(v["label"] == "supported" for v in verdicts), len(verdicts)),
        "citation_partial_rate": pct(sum(v["label"] == "partial" for v in verdicts), len(verdicts)),
        "citation_unsupported_rate": pct(sum(v["label"] == "unsupported" for v in verdicts), len(verdicts)),
        "judged_points": len(verdicts),
        "latency_p50_s": round(statistics.median(lat), 1) if lat else None,
        "latency_p95_s": round(lat[min(len(lat) - 1, int(len(lat) * 0.95))], 1) if lat else None,
        "by_category": by_cat,
    }


TARGETS = {
    "out_of_scope_refusal_rate": (">=", 100),
    "over_refusal_rate": ("<=", 10),
    "gold_source_hit_rate": (">=", 85),
    "must_include_rate": (">=", 90),
    "forbidden_violations": ("<=", 0),
    "retrieval_recall": (">=", 90),
    "citation_support_rate": (">=", 95),
    "latency_p95_s": ("<=", 8),
}

LABELS = {
    "out_of_scope_refusal_rate": "범위 밖 거부율(%)",
    "over_refusal_rate": "과잉 거부율(%)",
    "gold_source_hit_rate": "정답 출처 적중률(%)",
    "must_include_rate": "필수 내용 포함률(%)",
    "forbidden_violations": "금지 표현 위반(건)",
    "retrieval_recall": "검색 적중률(%)",
    "citation_support_rate": "출처 일치율(%)",
    "latency_p95_s": "응답 지연 p95(초)",
}


def markdown(meta: dict, s: dict, results: list[dict]) -> str:
    lines = [
        f"# 평가 리포트 {meta['tag']}",
        "",
        f"- 실행: {meta['started']} / 문항: {s['n']}개 (split={meta['split']}) / 모델: {meta['model']} / 프롬프트: {meta['prompt_version']} / 심사: {meta['judge']}",
        f"- 오류: {s['errors']}건 / 판정한 요점: {s['judged_points']}개",
        "",
        "| 지표 | 결과 | 목표 | 통과 |",
        "|---|---|---|---|",
    ]
    for key, (op, target) in TARGETS.items():
        v = s.get(key)
        passed = "-" if v is None else ("O" if (v >= target if op == ">=" else v <= target) else "X")
        lines.append(f"| {LABELS[key]} | {'-' if v is None else v} | {op} {target} | {passed} |")
    lines += ["", f"- 인용 판정 partial {s['citation_partial_rate']}%, unsupported {s['citation_unsupported_rate']}%",
              f"- 지연 p50 {s['latency_p50_s']}초", "", "## 유형별", "", "| 유형 | 문항 | 답변 | 출처 적중 |", "|---|---|---|---|"]
    for cat, d in s["by_category"].items():
        lines.append(f"| {cat} | {d['n']} | {d['answered']} | {d['gold_hit']} |")
    fails = [r for r in results if "error" in r or (
        (r["category"] == "E" and r["answered"])
        or (r["category"] != "E" and (not r["answered"] or not r["gold_hit"] or not r["include_ok"]))
        or r["violations"] or any(v["label"] != "supported" for v in r.get("judge", [])))]
    lines += ["", f"## 확인할 문항 ({len(fails)}개)", ""]
    for r in fails:
        if "error" in r:
            lines.append(f"- **{r['id']}** 오류: {r['error']}")
            continue
        why = []
        if r["category"] == "E" and r["answered"]:
            why.append("거부해야 했는데 답함")
        if r["category"] != "E" and not r["answered"]:
            why.append(f"답하지 않음({r['outcome']}, {r['refusal_category']})")
        if r["answered"] and r["category"] != "E" and not r["gold_hit"]:
            why.append(f"정답 출처 미인용(인용: {', '.join(r['cited'])})")
        if r["answered"] and r["missing"]:
            why.append(f"필수 내용 누락: {', '.join(r['missing'])}")
        if r["violations"]:
            why.append(f"금지 표현: {', '.join(r['violations'])}")
        for v in r.get("judge", []):
            if v["label"] != "supported":
                why.append(f"요점{v['index'] + 1} {v['label']}: {v['reason']}")
        lines.append(f"- **{r['id']}** [{r['category']}] {r['question']} / {'; '.join(why)}")
    return "\n".join(lines) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="dev", choices=["dev", "test", "all"])
    ap.add_argument("--only", nargs="*", help="문항 id 접두어로 거르기 (예: SJ1 TP1-O)")
    ap.add_argument("--judge", action="store_true", help="인용 일치 LLM 판정")
    ap.add_argument("--judge-model", default="claude-opus-5")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--tag", default="run")
    args = ap.parse_args()

    s = get_settings()
    items = load_items(args.split, args.only)
    get_retriever().ensure_loaded()
    # 심사는 오프라인 작업이라 속도보다 판정 품질을 우선해 Opus 5 를 쓴다(서비스 모델과 분리).
    judge_router = None
    if args.judge:
        from woori.llm.claude import ClaudeProvider
        from woori.llm.router import LlmRouter, ReplayStore

        judge_router = LlmRouter([ClaudeProvider(s.anthropic_api_key, args.judge_model, timeout=120)],
                                 ReplayStore(s.replay_dir))
    started = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    print(f"{len(items)}문항 평가 시작 (model={s.claude_model}, judge={args.judge})", flush=True)
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        results = list(ex.map(lambda i: run_one(i, judge_router), items))
    results.sort(key=lambda r: r["id"])
    summary = summarize(results)
    meta = {"tag": args.tag, "split": args.split, "started": started, "model": f"{s.answer_provider}:{s.claude_model}",
            "prompt_version": prompts.ANSWER_VERSION, "judge": args.judge_model if args.judge else None}
    out = ROOT / "reports"
    out.mkdir(exist_ok=True)
    stem = f"{dt.date.today().isoformat()}_{args.tag}"
    (out / f"{stem}.json").write_text(json.dumps({"meta": meta, "summary": summary, "results": results},
                                                 ensure_ascii=False, indent=1), encoding="utf-8")
    report = markdown(meta, summary, results)
    (out / f"{stem}.md").write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
