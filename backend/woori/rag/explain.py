"""문서 사진 해설. 이미지는 요청 처리 중 메모리에만 있고 저장, 로그에 남지 않는다."""

import io
import logging
import re
import time
import uuid

from PIL import Image, ImageOps

from woori.content.loader import get_content
from woori.llm.base import ImageInput, JsonRequest, LlmError
from woori.llm.router import vision_router
from woori.rag import prompts
from woori.rag.pipeline import InputError, _glossary_hits, _record, refusal_payload
from woori.rag.retriever import get_retriever

log = logging.getLogger(__name__)

MAX_BYTES = 10 * 1024 * 1024
MAX_SIDE = 2000
ALLOWED = {"JPEG", "PNG", "WEBP", "HEIF", "MPO"}

# 모델이 규칙을 어겨도 개인정보가 화면에 나가지 않도록 한 번 더 지운다.
_PII = [
    (re.compile(r"\d{6}\s*-\s*[1-8]\d{6}"), "(주민등록번호 가림)"),
    # 휴대전화만 가린다. 조합 사무실, 시청 같은 기관 대표번호는 주민에게 필요한 정보라 남긴다.
    (re.compile(r"(?<!\d)01[016789]\s*-?\s*\d{3,4}\s*-?\s*\d{4}(?!\d)"), "(휴대전화 가림)"),
]

DOC_TYPE_LABEL = {
    "levy_notice": "분담금 안내문",
    "sale_notice": "분양신청 안내문",
    "compensation_notice": "보상 안내문",
    "public_notice": "고시, 공고문",
    "consent_form": "동의서",
    "meeting_notice": "총회, 설명회 안내문",
    "other_redevelopment": "정비사업 관련 문서",
    "not_redevelopment": "정비사업과 관련 없는 문서",
}


def _scrub(value):
    if isinstance(value, str):
        for pattern, repl in _PII:
            value = pattern.sub(repl, value)
        return value
    if isinstance(value, list):
        return [_scrub(v) for v in value]
    if isinstance(value, dict):
        return {k: _scrub(v) for k, v in value.items()}
    return value


def prepare_image(data: bytes) -> ImageInput:
    """형식 검사, 방향 보정, 긴 변 2000px 축소, EXIF 제거(재인코딩)."""
    if len(data) > MAX_BYTES:
        raise InputError("IMAGE_TOO_LARGE")
    try:
        img = Image.open(io.BytesIO(data))
        fmt = img.format
        img.load()
    except Exception as e:
        raise InputError("UNSUPPORTED_IMAGE") from e
    if fmt not in ALLOWED:
        raise InputError("UNSUPPORTED_IMAGE")
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88)
    return ImageInput(buf.getvalue(), "image/jpeg")


def explain(zone_id: str, resident_type: str, image_bytes: bytes) -> dict:
    started = time.monotonic()
    c = get_content()
    if zone_id not in c.zones:
        raise InputError("ZONE_NOT_FOUND")
    if resident_type not in prompts.RESIDENT_LABEL:
        raise InputError("INVALID_RESIDENT_TYPE")
    image = prepare_image(image_bytes)
    zone = c.zones[zone_id]
    trace = {
        "trace_id": str(uuid.uuid4()),
        "endpoint": "explain",
        "zone_id": zone_id,
        "resident_type": resident_type,
        "topic": None,
        "gate_scores": {},
        "chunk_ids": [],
        "model": None,
        "prompt_version": prompts.EXPLAIN_VERSION,
    }

    def finish(outcome: str, **payload) -> dict:
        trace["outcome"] = outcome
        trace["latency_ms"] = int((time.monotonic() - started) * 1000)
        _record(trace)
        return {"trace_id": trace["trace_id"], "outcome": outcome, "data_as_of": zone.as_of.isoformat(), **payload}

    req = JsonRequest(
        task="explain",
        system=prompts.EXPLAIN_SYSTEM,
        user=(
            f"<zone>{zone.name}</zone>\n<resident_type>{prompts.RESIDENT_LABEL[resident_type]}</resident_type>\n"
            "첨부한 사진 속 문서를 규칙에 따라 해설해 주세요."
        ),
        schema=prompts.EXPLAIN_SCHEMA,
        images=(image,),
        effort="medium",
        max_tokens=4096,
    )
    try:
        res = vision_router().generate_json(req)
    except LlmError as e:
        log.error("explain failed: %s", e)
        return finish("error")
    trace["model"] = f"{res.provider}:{res.model}"
    d = _scrub(res.data)
    trace["topic"] = d["doc_type"]
    if d["doc_type"] == "not_redevelopment":
        return finish("refused_policy", refusal=refusal_payload(
            c, "off_topic", resident_type, "정비사업과 관련된 문서가 아니에요. 통지서나 안내문 사진을 올려 주세요."))

    # 관련 조문은 모델이 아니라 검색으로 붙인다(법령 이름을 지어내지 않도록).
    related = []
    terms_text = " ".join(d["terms"] + [d.get("title_in_doc") or ""])
    if terms_text.strip():
        hits = get_retriever().search(terms_text, zone_id).hits
        seen = set()
        for h in hits:
            if h.chunk.source_type == "law" and h.chunk.source_label not in seen:
                seen.add(h.chunk.source_label)
                related.append({"source_label": h.chunk.source_label, "url": h.chunk.source_url})
            if len(related) >= 3:
                break

    cautions = []
    if d["doc_type"] == "levy_notice" or d.get("is_estimate"):
        item = next((i for i in c.checklists["owner"] if i.id == "owner.levy_estimate_not_final"), None)
        if item:
            cautions.append({"title": item.title, "body": " ".join(item.plain_body.split()), "legal_basis": item.legal_basis})

    glossary_text = " ".join(d["terms"]) + " " + " ".join(d["summary_lines"])
    return finish(
        "explained",
        doc_type=d["doc_type"],
        doc_type_label=DOC_TYPE_LABEL[d["doc_type"]],
        title_in_doc=d.get("title_in_doc"),
        issuer=d.get("issuer"),
        summary_lines=d["summary_lines"][:3],
        actions=d["actions"],
        amounts_in_doc=d["amounts_in_doc"],
        is_estimate=d.get("is_estimate"),
        unreadable=d.get("unreadable"),
        terms=_glossary_hits(c, glossary_text) or [{"term": t, "plain": None, "legal_ref": None} for t in d["terms"][:5]],
        cautions=cautions,
        related_citations=related,
    )
