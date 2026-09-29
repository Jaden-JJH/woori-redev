"""수집 → 추출 → 태깅 → 저장 → 청킹 → 색인."""

import datetime as dt
import hashlib
import json
import logging

from psycopg import Connection
from psycopg.types.json import Jsonb

from woori.config import get_settings
from woori.content.loader import Content
from woori.ingest.chunker import ChunkDraft, chunk_law_article, chunk_notice
from woori.ingest.documents import extract_text
from woori.ingest.law import TARGET_LAWS, LawClient
from woori.ingest.seongnam import Detail, SeongnamClient
from woori.ingest.tagger import ZoneTagger, tag_stage
from woori.text import law_refs, referenced_notices

log = logging.getLogger(__name__)

REDEV_DEPTS = ("재개발과",)


# ---------------------------------------------------------------- 콘텐츠
def seed_content(conn: Connection, c: Content) -> dict:
    with conn.transaction():
        conn.execute("DELETE FROM zone_event")
        conn.execute("DELETE FROM checklist_item")
        conn.execute("DELETE FROM glossary_term")
        for code, st in c.catalog.stages.items():
            conn.execute(
                """INSERT INTO stage (code, name, plain_desc, legal_ref) VALUES (%s,%s,%s,%s)
                   ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, plain_desc=EXCLUDED.plain_desc,
                   legal_ref=EXCLUDED.legal_ref""",
                (code, st.name, st.plain_desc, st.legal_ref),
            )
        for z in c.zones.values():
            conn.execute(
                """INSERT INTO zone (id, name, district, location, aliases, impl_type, developer, track,
                                     current_stage, summary, as_of, reviewed_by)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, district=EXCLUDED.district,
                     location=EXCLUDED.location, aliases=EXCLUDED.aliases, impl_type=EXCLUDED.impl_type,
                     developer=EXCLUDED.developer, track=EXCLUDED.track, current_stage=EXCLUDED.current_stage,
                     summary=EXCLUDED.summary, as_of=EXCLUDED.as_of, reviewed_by=EXCLUDED.reviewed_by""",
                (z.id, z.name, z.district, z.location, z.aliases, z.impl_type, z.developer, z.track,
                 z.current_stage, z.summary.strip(), z.as_of, z.reviewed_by),
            )
            track = c.catalog.tracks[z.track]
            for e in z.events:
                conn.execute(
                    """INSERT INTO zone_event (zone_id, stage_code, seq, status, event_date, title, plain_desc,
                                               notice_no, source_note) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (z.id, e.stage, track.index(e.stage), e.status, e.date, e.title, e.plain_desc,
                     e.notice_no, e.source_note),
                )
        for rtype, items in c.checklists.items():
            for i in items:
                conn.execute(
                    """INSERT INTO checklist_item (id, impl_types, stages, resident_type, kind, is_money, title,
                         plain_body, conditions, legal_basis, law_ref, sort_order)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (i.id, i.impl_types, i.stages, rtype, i.kind, i.is_money, i.title, i.plain_body.strip(),
                     i.conditions.strip() if i.conditions else None, i.legal_basis, i.law_ref, i.sort_order),
                )
        for t in c.glossary.terms:
            conn.execute(
                "INSERT INTO glossary_term (term, aliases, plain, example, legal_ref) VALUES (%s,%s,%s,%s,%s)",
                (t.term, t.aliases, t.plain, t.example, t.legal_ref),
            )
    return {
        "zones": len(c.zones),
        "checklist_items": sum(len(v) for v in c.checklists.values()),
        "glossary": len(c.glossary.terms),
    }


# ---------------------------------------------------------------- 고시
def _run_start(conn: Connection, source: str) -> int:
    return conn.execute("INSERT INTO ingest_run (source) VALUES (%s) RETURNING id", (source,)).fetchone()["id"]


def _run_finish(conn: Connection, run_id: int, **kw) -> None:
    conn.execute(
        """UPDATE ingest_run SET finished_at=now(), fetched=%s, new_items=%s, failed=%s, last_notice_no=%s, log=%s
           WHERE id=%s""",
        (kw.get("fetched", 0), kw.get("new_items", 0), kw.get("failed", 0), kw.get("last_notice_no"),
         Jsonb(kw.get("log", [])), run_id),
    )


def _notice_text(client: SeongnamClient, d: Detail) -> tuple[str, str | None]:
    """첨부가 있으면 첨부 본문(PDF 우선, 없으면 HWPX/HWP), 없으면 게시판 본문."""
    raw_dir = get_settings().raw_dir
    order = {"pdf": 0, "hwpx": 1, "hwp": 2}
    for att in sorted((a for a in d.attachments if a.ext in order), key=lambda a: order[a.ext]):
        try:
            data = client.download(att)
            sha = hashlib.sha256(data).hexdigest()
            raw_dir.mkdir(parents=True, exist_ok=True)
            (raw_dir / f"{sha}.{att.ext}").write_bytes(data)
            text = extract_text(data, att.ext)
            if len(text) >= len(d.body):
                return text, sha
        except Exception as e:  # 첨부 하나가 깨져도 게시판 본문으로 계속 진행
            log.warning("attachment failed %s %s: %s", d.notice_no, att.user_name, e)
    return d.body, None


def ingest_notices(conn: Connection, c: Content, client: SeongnamClient | None = None, full: bool = False) -> dict:
    client = client or SeongnamClient()
    tagger = ZoneTagger(list(c.zones.values()))
    run_id = _run_start(conn, "seongnam")
    known = {r["board_id"] for r in conn.execute("SELECT board_id FROM notice WHERE board_id IS NOT NULL")}

    rows = {}
    for dept in REDEV_DEPTS:
        for r in client.search(key="depNm", text=dept):
            rows[r.board_id] = r
    for z in c.zones.values():
        for keyword in {a for a in z.aliases if len(a) >= 3 and not a.endswith("구역")}:
            for r in client.search(key="sj", text=keyword):
                if tagger.tag(r.title):
                    rows[r.board_id] = r

    fetched = new = failed = 0
    logs: list[dict] = []
    last = None
    for r in sorted(rows.values(), key=lambda r: r.posted_at):
        fetched += 1
        if r.board_id in known and not full:
            continue
        try:
            d = client.detail(r.board_id)
            body, sha = _notice_text(client, d)
            zone_ids = tagger.tag(f"{d.title}\n{body[:1500]}")
            stage = tag_stage(d.title)
            _upsert_notice(conn, d, body, sha, zone_ids, stage, tag_source="rule" if stage else "unknown")
            for ref in referenced_notices(body):
                _upsert_derived(conn, ref, d, zone_ids)
            new += 1
            last = d.notice_no
            logs.append({"notice_no": d.notice_no, "zones": zone_ids, "stage": stage})
        except Exception as e:
            failed += 1
            logs.append({"board_id": r.board_id, "error": str(e)[:300]})
            log.exception("notice failed %s", r.board_id)
    _run_finish(conn, run_id, fetched=fetched, new_items=new, failed=failed, last_notice_no=last, log=logs)
    return {"fetched": fetched, "new": new, "failed": failed}


def _upsert_notice(conn, d: Detail, body: str, sha, zone_ids, stage, tag_source: str) -> None:
    conn.execute(
        """INSERT INTO notice (notice_no, board_id, title, dept, posted_at, url, body, raw_sha256, zone_ids,
                               stage_code, tag_source)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
           ON CONFLICT (notice_no) DO UPDATE SET board_id=EXCLUDED.board_id, title=EXCLUDED.title,
             dept=EXCLUDED.dept, posted_at=EXCLUDED.posted_at, url=EXCLUDED.url, body=EXCLUDED.body,
             raw_sha256=EXCLUDED.raw_sha256, zone_ids=EXCLUDED.zone_ids, stage_code=EXCLUDED.stage_code,
             tag_source=EXCLUDED.tag_source, derived_from=NULL, fetched_at=now()""",
        (d.notice_no, d.board_id, d.title, d.dept, d.posted_at, d.url, body, sha, zone_ids, stage, tag_source),
    )


def _upsert_derived(conn, ref: dict, src: Detail, zone_ids: list[str]) -> None:
    """게시판에서 내려간 선행 고시를, 이를 인용한 고시에서 복원한다. 본문 원문이 없으므로 색인하지 않는다."""
    stage = tag_stage(ref["what"])
    conn.execute(
        """INSERT INTO notice (notice_no, title, posted_at, body, zone_ids, stage_code, tag_source, derived_from, url)
           VALUES (%s,%s,%s,%s,%s,%s,'derived',%s,%s)
           ON CONFLICT (notice_no) DO NOTHING""",
        (ref["notice_no"], f"{ref['what']} 고시", dt.date.fromisoformat(ref["date"]),
         f"{src.notice_no}에서 인용: {ref['notice_no']}({ref['date']})로 {ref['what']} 고시",
         zone_ids, stage, src.notice_no, src.url),
    )


# ---------------------------------------------------------------- 법령
def ingest_laws(conn: Connection, oc: str) -> dict:
    client = LawClient(oc)
    run_id = _run_start(conn, "law")
    total = 0
    logs = []
    for target, name in TARGET_LAWS:
        arts = client.fetch(target, name)
        with conn.transaction():
            for a in arts:
                conn.execute(
                    """INSERT INTO law_article (law_name, law_short, article_no, article_title, body,
                                                effective_from, source_url)
                       VALUES (%s,%s,%s,%s,%s,%s,%s)
                       ON CONFLICT (law_name, article_no) DO UPDATE SET article_title=EXCLUDED.article_title,
                         body=EXCLUDED.body, effective_from=EXCLUDED.effective_from, source_url=EXCLUDED.source_url,
                         fetched_at=now()""",
                    (a.law_name, a.law_short, a.article_no, a.title, a.body, a.effective_from, a.source_url),
                )
        total += len(arts)
        logs.append({"law": name, "articles": len(arts)})
    _run_finish(conn, run_id, fetched=total, new_items=total, log=logs)
    return {"articles": total}


# ---------------------------------------------------------------- 청킹, 색인
def build_chunks(conn: Connection, c: Content) -> list[ChunkDraft]:
    drafts: list[ChunkDraft] = []
    for a in conn.execute("SELECT * FROM law_article ORDER BY law_name, id"):
        drafts.extend(
            chunk_law_article(a["law_name"], a["law_short"], a["article_no"], a["article_title"], a["body"],
                              a["source_url"])
        )
    stages = c.catalog.stages
    for n in conn.execute(
        "SELECT * FROM notice WHERE tag_source <> 'derived' AND cardinality(zone_ids) > 0 ORDER BY posted_at"
    ):
        zone_ids = [z for z in n["zone_ids"] if z in c.zones]
        if not zone_ids:
            continue
        drafts.extend(
            chunk_notice(
                notice_no=n["notice_no"],
                title=n["title"],
                posted_at=n["posted_at"].isoformat(),
                zone_names=[c.zones[z].name for z in zone_ids],
                stage_name=stages[n["stage_code"]].name if n["stage_code"] else None,
                body=n["body"],
                url=n["url"],
                zone_ids=zone_ids,
                stage_code=n["stage_code"],
                legal_refs=law_refs(n["body"]),
            )
        )
    return drafts


def store_chunks(conn: Connection, drafts: list[ChunkDraft]) -> dict:
    keep = {(d.source_type, d.source_key, d.chunk_no) for d in drafts}
    existing = {
        (r["source_type"], r["source_key"], r["chunk_no"]): r["content_hash"]
        for r in conn.execute("SELECT source_type, source_key, chunk_no, content_hash FROM chunk")
    }
    changed = 0
    with conn.transaction():
        for d in drafts:
            key = (d.source_type, d.source_key, d.chunk_no)
            if existing.get(key) == d.content_hash:
                continue
            changed += 1
            conn.execute(
                """INSERT INTO chunk (source_type, source_key, chunk_no, header, body, zone_ids, stage_codes,
                                      resident_types, legal_refs, source_label, source_url, content_hash,
                                      embedding, embed_model)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NULL,NULL)
                   ON CONFLICT (source_type, source_key, chunk_no) DO UPDATE SET header=EXCLUDED.header,
                     body=EXCLUDED.body, zone_ids=EXCLUDED.zone_ids, stage_codes=EXCLUDED.stage_codes,
                     resident_types=EXCLUDED.resident_types, legal_refs=EXCLUDED.legal_refs,
                     source_label=EXCLUDED.source_label, source_url=EXCLUDED.source_url,
                     content_hash=EXCLUDED.content_hash, embedding=NULL, embed_model=NULL""",
                (d.source_type, d.source_key, d.chunk_no, d.header, d.body, d.zone_ids, d.stage_codes,
                 d.resident_types, d.legal_refs, d.source_label, d.source_url, d.content_hash),
            )
        stale = [k for k in existing if k not in keep]
        for st, sk, no in stale:
            conn.execute("DELETE FROM chunk WHERE source_type=%s AND source_key=%s AND chunk_no=%s", (st, sk, no))
    return {"chunks": len(drafts), "changed": changed, "removed": len(stale)}


def embed_missing(conn: Connection, embedder, batch: int = 100) -> dict:
    if embedder is None:
        return {"embedded": 0, "skipped": "no embedder configured"}
    done = 0
    while True:
        rows = conn.execute(
            "SELECT id, header, body FROM chunk WHERE embedding IS NULL ORDER BY id LIMIT %s", (batch,)
        ).fetchall()
        if not rows:
            break
        vecs = embedder.embed([f"{r['header']}\n{r['body']}" for r in rows], task="document")
        with conn.transaction():
            for r, v in zip(rows, vecs, strict=True):
                conn.execute(
                    "UPDATE chunk SET embedding=%s::vector, embed_model=%s WHERE id=%s",
                    (json.dumps(v), embedder.model, r["id"]),
                )
        done += len(rows)
    return {"embedded": done}
