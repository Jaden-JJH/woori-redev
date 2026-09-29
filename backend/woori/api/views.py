"""결정적 레이어: 구역, 타임라인, 체크리스트, 돈 캘린더. LLM 을 쓰지 않는다."""

from woori.content.loader import Content
from woori.content.models import ChecklistItem, Zone
from woori.db import connection
from woori.rag.zone_context import IMPL_LABEL


def _notice_urls(numbers: list[str]) -> dict[str, dict]:
    if not numbers:
        return {}
    with connection() as conn:
        rows = conn.execute(
            "SELECT notice_no, url, title, posted_at, tag_source FROM notice WHERE notice_no = ANY(%s)", (numbers,)
        ).fetchall()
    return {r["notice_no"]: r for r in rows}


def zone_summary(c: Content, z: Zone) -> dict:
    track = c.catalog.tracks[z.track]
    idx = track.index(z.current_stage)
    return {
        "id": z.id,
        "name": z.name,
        "district": z.district,
        "location": z.location,
        "impl_type": z.impl_type,
        "impl_label": IMPL_LABEL[z.impl_type],
        "developer": z.developer,
        "current_stage": {"code": z.current_stage, "name": c.catalog.stages[z.current_stage].name},
        "step": idx + 1,
        "total_steps": len(track),
        "summary": " ".join(z.summary.split()),
        "as_of": z.as_of.isoformat(),
    }


def timeline(c: Content, z: Zone) -> dict:
    track = c.catalog.tracks[z.track]
    cur = track.index(z.current_stage)
    notices = _notice_urls([e.notice_no for e in z.events if e.notice_no])
    stages = []
    for i, code in enumerate(track):
        st = c.catalog.stages[code]
        events = []
        for e in sorted((e for e in z.events if e.stage == code), key=lambda e: e.date or z.as_of):
            n = notices.get(e.notice_no) if e.notice_no else None
            events.append(
                {
                    "title": e.title,
                    "date": e.date.isoformat() if e.date else None,
                    "plain_desc": e.plain_desc,
                    "notice_no": e.notice_no,
                    "notice_url": n["url"] if n else None,
                    "source_note": e.source_note,
                }
            )
        stages.append(
            {
                "code": code,
                "seq": i + 1,
                "name": st.name,
                "plain_desc": st.plain_desc,
                "legal_ref": st.legal_ref,
                "status": "done" if i < cur else ("current" if i == cur else "planned"),
                "events": events,
            }
        )
    dated = [e for e in z.events if e.date]
    latest = max(dated, key=lambda e: e.date) if dated else None
    return {
        "zone": zone_summary(c, z),
        "stages": stages,
        "latest": {
            "title": latest.title,
            "date": latest.date.isoformat(),
            "notice_no": latest.notice_no,
            "plain_desc": latest.plain_desc,
        }
        if latest
        else None,
    }


def _item(i: ChecklistItem, c: Content, track: list[str]) -> dict:
    first = min((track.index(s) for s in i.stages if s in track), default=None)
    return {
        "id": i.id,
        "kind": i.kind,
        "is_money": i.is_money,
        "title": i.title,
        "body": " ".join(i.plain_body.split()),
        "conditions": " ".join(i.conditions.split()) if i.conditions else None,
        "legal_basis": i.legal_basis,
        "law_ref": i.law_ref,
        "stage": {"code": track[first], "name": c.catalog.stages[track[first]].name} if first is not None else None,
    }


def checklist(c: Content, z: Zone, resident_type: str) -> dict:
    track = c.catalog.tracks[z.track]
    cur = track.index(z.current_stage)
    now, upcoming = [], []
    for i in c.checklists[resident_type]:
        if z.impl_type not in i.impl_types:
            continue
        idxs = [track.index(s) for s in i.stages if s in track]
        if not idxs:
            continue
        if cur in idxs:
            now.append(_item(i, c, track))
        elif min(idxs) > cur:
            upcoming.append((min(idxs), _item(i, c, track)))
    upcoming.sort(key=lambda t: t[0])
    return {
        "zone": zone_summary(c, z),
        "resident_type": resident_type,
        "now": {
            "todo": [i for i in now if i["kind"] in ("todo", "deadline")],
            "benefit": [i for i in now if i["kind"] == "benefit"],
            "caution": [i for i in now if i["kind"] == "caution"],
        },
        "upcoming": [i for _, i in upcoming],
    }


def money(c: Content, z: Zone, resident_type: str) -> dict:
    cl = checklist(c, z, resident_type)
    now_items = cl["now"]["todo"] + cl["now"]["benefit"] + cl["now"]["caution"]
    items = [{**i, "timing": "now"} for i in now_items if i["is_money"]] + [
        {**i, "timing": "upcoming"} for i in cl["upcoming"] if i["is_money"]
    ]
    track = c.catalog.tracks[z.track]
    groups: dict[str, dict] = {}
    for i in items:
        code = i["stage"]["code"] if i["timing"] == "upcoming" else z.current_stage
        g = groups.setdefault(
            code,
            {"stage": {"code": code, "name": c.catalog.stages[code].name}, "timing": i["timing"], "items": []},
        )
        g["items"].append(i)
    ordered = sorted(groups.values(), key=lambda g: track.index(g["stage"]["code"]))
    return {"zone": cl["zone"], "resident_type": resident_type, "groups": ordered}
