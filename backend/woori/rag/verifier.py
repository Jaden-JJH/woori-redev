"""게이트3: 인용 검증기. 모델이 붙인 인용이 실제 문서에 있는지 결정적 코드로 확인한다.

1. doc_id 가 이번 검색 결과에 있는가 (없는 문서를 지어내지 않았는가)
2. quote 가 그 문서 원문에 실제로 있는가 (공백, 문장부호, 가운뎃점류를 무시하고 비교)
3. 인용이 하나도 살아남지 못한 point 는 버린다
"""

from dataclasses import dataclass, field
from difflib import SequenceMatcher

from woori.text import compact

MIN_QUOTE_CHARS = 6
FUZZY_MIN = 0.9


@dataclass
class VerifiedCitation:
    doc_id: str
    quote: str
    exact: bool


@dataclass
class VerifiedPoint:
    text: str
    citations: list[VerifiedCitation]


@dataclass
class VerifyReport:
    points: list[VerifiedPoint]
    total_citations: int = 0
    valid_citations: int = 0
    dropped_points: int = 0
    failures: list[dict] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return bool(self.points)


def quote_in(quote: str, source: str) -> tuple[bool, bool]:
    """(통과 여부, 정확 일치 여부)"""
    q, s = compact(quote), compact(source)
    if len(q) < MIN_QUOTE_CHARS:
        return False, False
    if q in s:
        return True, True
    m = SequenceMatcher(None, q, s, autojunk=False).find_longest_match(0, len(q), 0, len(s))
    return (m.size / len(q)) >= FUZZY_MIN, False


def verify(points: list[dict], docs: dict[str, str]) -> VerifyReport:
    """docs: doc_id -> 원문 텍스트 (머리말 + 본문)"""
    report = VerifyReport(points=[])
    for p in points:
        kept: list[VerifiedCitation] = []
        for c in p.get("citations", []):
            report.total_citations += 1
            doc_id, quote = str(c.get("doc_id", "")), str(c.get("quote", ""))
            source = docs.get(doc_id)
            if source is None:
                report.failures.append({"reason": "unknown_doc", "doc_id": doc_id})
                continue
            ok, exact = quote_in(quote, source)
            if not ok:
                report.failures.append({"reason": "quote_not_found", "doc_id": doc_id, "quote": quote[:80]})
                continue
            report.valid_citations += 1
            kept.append(VerifiedCitation(doc_id, quote, exact))
        if kept and p.get("text", "").strip():
            report.points.append(VerifiedPoint(p["text"].strip(), kept))
        else:
            report.dropped_points += 1
    return report
