"""한국어 공문서 텍스트 정규화와 법령 인용 추출."""

import re
import unicodedata

# 공문서에서 구역명을 잇는 가운뎃점류 문자. 모두 '-'로 정규화한다.
_JOINERS = "".join(chr(c) for c in (0x00B7, 0x318D, 0x30FB, 0x2027, 0x2219, 0x2022, 0xFF65))
_JOINER_RE = re.compile(f"[{re.escape(_JOINERS)}]")
# 법령명을 감싸는 낫표류: 「」, 반각 ｢｣
_LAW_OPEN = chr(0x300C) + chr(0xFF62)
_LAW_CLOSE = chr(0x300D) + chr(0xFF63)

RESIDENT_TYPES = ("owner", "tenant", "shop_tenant")

LAW_SHORT_NAMES = {
    "도시 및 주거환경정비법": "도시정비법",
    "도시 및 주거환경정비법 시행령": "도시정비법 시행령",
    "도시 및 주거환경정비법 시행규칙": "도시정비법 시행규칙",
    "공익사업을 위한 토지 등의 취득 및 보상에 관한 법률": "토지보상법",
    "공익사업을 위한 토지 등의 취득 및 보상에 관한 법률 시행령": "토지보상법 시행령",
    "공익사업을 위한 토지 등의 취득 및 보상에 관한 법률 시행규칙": "토지보상법 시행규칙",
    "성남시 도시 및 주거환경정비에 관한 조례": "성남시 도시정비 조례",
}


def clean(text: str) -> str:
    """저장용: NFC 정규화와 공백 정리만 한다. 원문 문자(가운뎃점 등)는 보존한다."""
    text = unicodedata.normalize("NFC", text)
    text = text.replace(chr(0x00A0), " ").replace(chr(0x3000), " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n\s*\n+", "\n", text)
    return text.strip()


def normalize(text: str) -> str:
    """비교, 태깅용: clean + 가운뎃점류를 '-'로 통일."""
    return _JOINER_RE.sub("-", clean(text))


def compact(text: str) -> str:
    """비교용: 공백과 문장부호를 모두 제거한다."""
    return re.sub(r"[\s\W_]+", "", normalize(text))


_NOTICE_NO_RE = re.compile(r"성남시\s*(고시|공고)\s*제?\s*(\d{4})\s*-\s*(\d+)\s*호")


def normalize_notice_no(raw: str) -> str | None:
    m = _NOTICE_NO_RE.search(raw)
    if not m:
        return None
    return f"성남시 {m.group(1)} 제{m.group(2)}-{int(m.group(3))}호"


_REF_NOTICE_RE = re.compile(
    r"성남시\s*고시\s*제\s*(\d{4})\s*-\s*(\d+)\s*호\s*\(\s*(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*\)"
    r"\s*(?:로|으로)\s*([^,\n]{2,60}?)\s*(?:고시된|고시 된)"
)


def referenced_notices(body: str) -> list[dict]:
    """본문에서 '성남시 고시 제YYYY-N호(YYYY. M. D.)로 OOO 고시된' 형태의 선행 고시 참조를 뽑는다."""
    out = []
    for m in _REF_NOTICE_RE.finditer(normalize(body)):
        y, n, yy, mm, dd, what = m.groups()
        out.append(
            {
                "notice_no": f"성남시 고시 제{y}-{int(n)}호",
                "date": f"{yy}-{int(mm):02d}-{int(dd):02d}",
                "what": what.strip(),
            }
        )
    return out


_LAW_REF_RE = re.compile(
    rf"[{_LAW_OPEN}]\s*([^{_LAW_CLOSE}]+?)\s*[{_LAW_CLOSE}]\s*"
    r"((?:제\s*\d+\s*조(?:의\s*\d+)?(?:\s*제\s*\d+\s*항)?(?:\s*제\s*\d+\s*호)?(?:\s*[,및]\s*)?)+)"
)
_ARTICLE_RE = re.compile(r"제\s*\d+\s*조(?:의\s*\d+)?(?:\s*제\s*\d+\s*항)?(?:\s*제\s*\d+\s*호)?")


def law_refs(text: str) -> list[str]:
    """「도시 및 주거환경정비법」 제50조제9항 같은 인용을 '도시정비법 제50조제9항' 형태로 정규화해 뽑는다."""
    refs: list[str] = []
    for m in _LAW_REF_RE.finditer(normalize(text)):
        law = LAW_SHORT_NAMES.get(re.sub(r"\s+", " ", m.group(1)).strip(), m.group(1).strip())
        for art in _ARTICLE_RE.findall(m.group(2)):
            ref = f"{law} {re.sub(r'\s+', '', art)}"
            if ref not in refs:
                refs.append(ref)
    return refs
