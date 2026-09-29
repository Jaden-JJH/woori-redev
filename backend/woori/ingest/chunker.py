"""검색 단위(청크) 만들기.

- 법령: 조 단위. 길면 항(①②...) 경계로 나눈다. 모든 청크 앞에 '법령명 제N조(제목)' 머리말을 붙인다.
- 고시: 고시 요지(첫 문단) 1청크 + 본문을 항목 경계로 나눈다. 표 셀처럼 짧은 줄은 한 줄로 이어 붙인다.
"""

import hashlib
import re
from dataclasses import dataclass, field

MAX_CHARS = 900
_PARA_MARK = re.compile(r"(?=[①-⑳])")  # ①~⑳
_SECTION_MARK = re.compile(r"(?m)^(?=\s*(?:[0-9]{1,2}\.\s|[가-하]\.\s|[IVXⅠ-Ⅿ]+\.\s))")


@dataclass
class ChunkDraft:
    source_type: str
    source_key: str
    chunk_no: int
    header: str
    body: str
    source_label: str
    source_url: str | None
    zone_ids: list[str] | None = None
    stage_codes: list[str] | None = None
    resident_types: list[str] | None = None
    legal_refs: list[str] = field(default_factory=list)

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(f"{self.header}\n{self.body}".encode()).hexdigest()

    @property
    def text_for_index(self) -> str:
        return f"{self.header}\n{self.body}"


def _pack(pieces: list[str], limit: int = MAX_CHARS) -> list[str]:
    out: list[str] = []
    buf = ""
    for p in pieces:
        p = p.strip()
        if not p:
            continue
        if len(p) > limit:
            if buf:
                out.append(buf)
                buf = ""
            for i in range(0, len(p), limit):
                out.append(p[i : i + limit])
            continue
        if len(buf) + len(p) + 1 > limit and buf:
            out.append(buf)
            buf = p
        else:
            buf = f"{buf}\n{p}" if buf else p
    if buf:
        out.append(buf)
    return out


def join_table_cells(text: str, short: int = 16) -> str:
    """HWP 표는 셀마다 한 줄로 풀린다. 짧은 줄이 이어지면 ' | ' 로 한 줄에 모은다."""
    lines = text.split("\n")
    out: list[str] = []
    run: list[str] = []
    for line in lines:
        s = line.strip()
        if s and len(s) <= short:
            run.append(s)
            continue
        if run:
            out.append(" | ".join(run) if len(run) > 2 else "\n".join(run))
            run = []
        out.append(line)
    if run:
        out.append(" | ".join(run) if len(run) > 2 else "\n".join(run))
    return "\n".join(out)


# 토지보상법 시행규칙 조항별 해당 주민 유형
RESIDENT_TYPE_BY_ARTICLE: dict[tuple[str, str], list[str]] = {
    ("토지보상법 시행규칙", "제45조"): ["shop_tenant"],
    ("토지보상법 시행규칙", "제46조"): ["shop_tenant"],
    ("토지보상법 시행규칙", "제47조"): ["shop_tenant"],
    ("토지보상법 시행규칙", "제54조"): ["owner", "tenant"],
    ("토지보상법 시행규칙", "제55조"): ["owner", "tenant", "shop_tenant"],
    ("도시정비법", "제70조"): ["tenant", "shop_tenant"],
}


def chunk_law_article(
    law_name: str, law_short: str, article_no: str, title: str | None, body: str, url: str
) -> list[ChunkDraft]:
    label = f"{law_short} {article_no}"
    header = f"[{law_name} {article_no}{f'({title})' if title else ''}]"
    pieces = _PARA_MARK.split(body) if len(body) > MAX_CHARS else [body]
    rtypes = RESIDENT_TYPE_BY_ARTICLE.get((law_short, article_no))
    return [
        ChunkDraft(
            source_type="law",
            source_key=label,
            chunk_no=i,
            header=header,
            body=text,
            source_label=label,
            source_url=url,
            resident_types=rtypes,
            legal_refs=[label],
        )
        for i, text in enumerate(_pack(pieces))
    ]


def chunk_notice(
    notice_no: str,
    title: str,
    posted_at: str,
    zone_names: list[str],
    stage_name: str | None,
    body: str,
    url: str | None,
    zone_ids: list[str],
    stage_code: str | None,
    legal_refs: list[str],
) -> list[ChunkDraft]:
    meta = " | ".join(x for x in [notice_no, ", ".join(zone_names), stage_name, posted_at] if x)
    header = f"[{meta}] {title}"
    text = join_table_cells(body)
    pieces = _SECTION_MARK.split(text)
    return [
        ChunkDraft(
            source_type="notice",
            source_key=notice_no,
            chunk_no=i,
            header=header,
            body=piece,
            source_label=notice_no,
            source_url=url,
            zone_ids=zone_ids,
            stage_codes=[stage_code] if stage_code else None,
            legal_refs=legal_refs,
        )
        for i, piece in enumerate(_pack(pieces))
    ]
