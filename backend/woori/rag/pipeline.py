"""질문 하나를 처리하는 전체 경로.

게이트1(정책) → 질의 분석 → 하이브리드 검색 → 게이트2(근거) → 생성 → 게이트3(인용 검증) → 결과
검증을 통과하지 못한 모델 출력은 이 모듈 밖으로 나가지 않는다.
"""

import logging
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass

from psycopg.types.json import Jsonb

from woori.config import get_settings
from woori.content.loader import Content, get_content
from woori.db import connection
from woori.gate.policy import check_rules
from woori.ingest.tagger import ZoneTagger
from woori.llm.base import JsonRequest, LlmError
from woori.llm.router import analyzer_router, answer_router
from woori.rag import prompts
from woori.rag.retriever import RetrievalResult, get_retriever
from woori.rag.verifier import verify
from woori.rag.zone_context import zone_document
from woori.text import normalize

log = logging.getLogger(__name__)

MIN_COVERAGE = 0.2
ZONE_DOC_ID = "Z"
ZONE_DOC_LABEL = "우리 구역 진행 현황"

Emit = Callable[[str], None]


class InputError(ValueError):
    pass


@dataclass
class Analysis:
    intent: str
    negative_category: str | None
    topic: str
    search_query: str
    legal_terms: list[str]
    mentioned_zones: list[str]
    source: str  # 'llm' | 'rules'


def _analyze(question: str) -> Analysis:
    router = analyzer_router()
    fallback = Analysis("in_scope", None, "other", question, [], [], "rules")
    if not router.available and not get_settings().replay_dir.exists():
        return fallback
    req = JsonRequest(
        task="analyze",
        system=prompts.ANALYZER_SYSTEM,
        user=f"<question>{question}</question>",
        schema=prompts.ANALYZER_SCHEMA,
        effort="low",
        max_tokens=1024,
    )
    try:
        d = router.generate_json(req).data
    except LlmError as e:
        log.warning("analyzer unavailable, rule fallback: %s", e)
        return fallback
    return Analysis(
        intent=d["intent"],
        negative_category=d.get("negative_category"),
        topic=d.get("topic", "other"),
        search_query=d.get("search_query") or question,
        legal_terms=d.get("legal_terms") or [],
        mentioned_zones=d.get("mentioned_zones") or [],
        source="llm",
    )


def refusal_payload(c: Content, category: str, resident_type: str, extra_message: str | None = None) -> dict:
    cat = c.refusals.categories[category]
    contacts = [c.refusals.contacts[k].model_dump() for k in cat.contacts]
    return {
        "category": category,
        "message": extra_message or cat.message,
        "reason": cat.reason,
        "contacts": contacts,
        "suggestions": c.refusals.suggestions[resident_type],
    }


def _glossary_hits(c: Content, text: str) -> list[dict]:
    t = normalize(text)
    out = []
    for term in c.glossary.terms:
        if any(normalize(w) in t for w in [term.term, *term.aliases]):
            out.append({"term": term.term, "plain": term.plain, "legal_ref": term.legal_ref})
    return out[:6]


def _format_documents(zone_doc: str, retrieval: RetrievalResult) -> tuple[str, dict[str, str], dict[str, dict]]:
    texts: dict[str, str] = {ZONE_DOC_ID: zone_doc}
    meta: dict[str, dict] = {
        ZONE_DOC_ID: {"source_label": ZONE_DOC_LABEL, "source_type": "zone", "url": None, "chunk_id": None}
    }
    parts = [f'<document id="{ZONE_DOC_ID}" source="{ZONE_DOC_LABEL}">\n{zone_doc}\n</document>']
    for i, h in enumerate(retrieval.hits, start=1):
        doc_id = f"D{i}"
        body = f"{h.chunk.header}\n{h.chunk.body}"
        texts[doc_id] = body
        meta[doc_id] = {
            "source_label": h.chunk.source_label,
            "source_type": h.chunk.source_type,
            "url": h.chunk.source_url,
            "chunk_id": h.chunk.id,
        }
        parts.append(f'<document id="{doc_id}" source="{h.chunk.source_label}">\n{body}\n</document>')
    return "\n".join(parts), texts, meta


def _record(trace: dict) -> None:
    try:
        with connection() as conn:
            conn.execute(
                """INSERT INTO answer_trace (trace_id, endpoint, zone_id, resident_type, topic, outcome, gate_scores,
                                             chunk_ids, model, prompt_version, latency_ms)
                   VALUES (%(trace_id)s, %(endpoint)s, %(zone_id)s, %(resident_type)s, %(topic)s, %(outcome)s,
                           %(gate_scores)s, %(chunk_ids)s, %(model)s, %(prompt_version)s, %(latency_ms)s)""",
                {**trace, "gate_scores": Jsonb(trace.get("gate_scores") or {})},
            )
    except Exception:  # 추적 기록 실패가 답변을 막지 않는다
        log.exception("trace insert failed")


def ask(zone_id: str, resident_type: str, question: str, emit: Emit | None = None) -> dict:
    emit = emit or (lambda step: None)
    started = time.monotonic()
    c = get_content()
    question = " ".join(question.split())
    if zone_id not in c.zones:
        raise InputError("ZONE_NOT_FOUND")
    if resident_type not in prompts.RESIDENT_LABEL:
        raise InputError("INVALID_RESIDENT_TYPE")
    if not 2 <= len(question) <= 300:
        raise InputError("INVALID_QUESTION_LENGTH")
    zone = c.zones[zone_id]
    trace = {
        "trace_id": str(uuid.uuid4()),
        "endpoint": "ask",
        "zone_id": zone_id,
        "resident_type": resident_type,
        "topic": None,
        "gate_scores": {},
        "chunk_ids": [],
        "model": None,
        "prompt_version": prompts.ANSWER_VERSION,
    }

    def finish(outcome: str, **payload) -> dict:
        trace["outcome"] = outcome
        trace["latency_ms"] = int((time.monotonic() - started) * 1000)
        _record(trace)
        base = {
            "trace_id": trace["trace_id"],
            "outcome": outcome,
            "summary_plain": None,
            "points": [],
            "next_step": None,
            "terms": [],
            "refusal": None,
            "data_as_of": zone.as_of.isoformat(),
        }
        base.update(payload)
        return base

    # 게이트1: 규칙 사전
    emit("analyze")
    rule_hit = check_rules(question)
    analysis = _analyze(question)
    trace["topic"] = analysis.topic
    trace["gate_scores"]["policy"] = {
        "rule": rule_hit.category if rule_hit else None,
        "model": analysis.negative_category if analysis.intent == "negative" else None,
        "analyzer": analysis.source,
    }
    category = rule_hit.category if rule_hit else (analysis.negative_category if analysis.intent == "negative" else None)
    if category is None and analysis.intent == "negative":
        category = "off_topic"
    if category:
        return finish("refused_policy", refusal=refusal_payload(c, category, resident_type))
    if analysis.intent == "chitchat":
        return finish("refused_policy", refusal=refusal_payload(c, "off_topic", resident_type,
                      "안녕하세요. 정비사업 절차나 권리에 대해 궁금한 점을 물어봐 주세요."))

    # 다른 구역을 물으면 필터를 몰래 바꾸지 않고 구역을 바꾸도록 안내한다.
    tagger = ZoneTagger(list(c.zones.values()))
    mentioned = set(tagger.tag(question + " " + " ".join(analysis.mentioned_zones)))
    if mentioned and zone_id not in mentioned:
        other = c.zones[sorted(mentioned)[0]]
        msg = f"지금 선택한 구역은 {zone.name}이에요. {other.name} 이야기는 구역을 {other.name}으로 바꾼 뒤 물어봐 주세요."
        return finish("refused_other_zone", refusal={**refusal_payload(c, "no_evidence", resident_type, msg),
                                                     "category": "other_zone", "switch_zone_id": other.id})

    # 검색
    emit("retrieve")
    query = f"{question} {analysis.search_query}".strip()
    retrieval = get_retriever().search(query, zone_id, extra_terms=analysis.legal_terms)
    trace["gate_scores"]["retrieval"] = retrieval.signals
    trace["chunk_ids"] = [h.chunk.id for h in retrieval.hits]

    # 게이트2: 근거 게이트. 구역 진행 질문은 구역 현황 문서가 근거가 되므로 통과시킨다.
    if analysis.topic != "stage_status" and retrieval.top_coverage < MIN_COVERAGE:
        return finish("refused_no_evidence", refusal=refusal_payload(c, "no_evidence", resident_type))

    # 생성
    emit("generate")
    docs_xml, doc_texts, doc_meta = _format_documents(zone_document(c, zone), retrieval)
    user = (
        f"<zone>{zone.name}, 사업 방식: {'공공 시행, 사업시행자 ' + zone.developer if zone.developer else '조합 시행'}</zone>\n"
        f"<resident_type>{prompts.RESIDENT_LABEL[resident_type]}</resident_type>\n"
        f"<documents>\n{docs_xml}\n</documents>\n"
        f"<question>{question}</question>"
    )
    req = JsonRequest(task="answer", system=prompts.ANSWER_SYSTEM, user=user, schema=prompts.ANSWER_SCHEMA,
                      effort="medium", max_tokens=4096)
    router = answer_router()
    emit("verify")
    for attempt in range(2):
        try:
            res = router.generate_json(req)
        except LlmError as e:
            log.error("answer generation failed: %s", e)
            trace["gate_scores"]["llm_error"] = str(e)[:200]
            return finish("error")
        trace["model"] = f"{res.provider}:{res.model}"
        out = res.data
        if not out.get("answerable") or not out.get("points"):
            trace["gate_scores"]["answerable"] = False
            return finish("refused_no_evidence", refusal=refusal_payload(c, "no_evidence", resident_type))
        report = verify(out["points"], doc_texts)
        trace["gate_scores"]["verify"] = {
            "attempt": attempt + 1,
            "total": report.total_citations,
            "valid": report.valid_citations,
            "dropped_points": report.dropped_points,
        }
        if report.ok:
            break
        req = JsonRequest(
            task="answer",
            system=prompts.ANSWER_SYSTEM,
            user=user + "\n<note>이전 답변의 인용 구절이 문서 원문과 일치하지 않았다. quote 는 문서에서 글자 그대로 복사한다.</note>",
            schema=prompts.ANSWER_SCHEMA,
            effort="medium",
            max_tokens=4096,
        )
    else:
        return finish("refused_verification", refusal=refusal_payload(c, "no_evidence", resident_type))

    points = [
        {
            "text": p.text,
            "citations": [
                {**doc_meta[cit.doc_id], "quote": cit.quote, "exact": cit.exact} for cit in p.citations
            ],
        }
        for p in report.points
    ]
    text_all = out.get("summary_plain", "") + " " + " ".join(p.text for p in report.points)
    return finish(
        "answered",
        summary_plain=out.get("summary_plain"),
        points=points,
        next_step=out.get("next_step"),
        terms=_glossary_hits(c, text_all),
    )
