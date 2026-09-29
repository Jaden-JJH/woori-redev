"""BM25 용 한국어 토크나이저 (kiwipiepy 형태소 분석).

색인어: 체언, 용언 어간, 외국어/숫자, 조문 번호(72조, 54조), 인접 체언 복합어(분양신청, 현금청산).
"""

from functools import lru_cache
from itertools import pairwise

from kiwipiepy import Kiwi

from woori.text import normalize

_NOUN = {"NNG", "NNP", "XR", "SL", "SH"}
_VERB = {"VV", "VA", "VV-R", "VA-R", "VV-I", "VA-I"}
_STOP_VERB = {"하", "되", "있", "없", "이", "같", "그렇", "어떻", "알", "보", "주", "나오", "싶"}
_STOP_NOUN = {"것", "수", "때", "등", "경우", "해당", "관련", "대하", "위하"}


# 정비사업 용어. 형태소 분석기가 쪼개지 않도록 사용자 사전에 넣는다.
DOMAIN_WORDS = [
    "재개발", "재건축", "정비사업", "정비구역", "정비계획", "추진위", "추진위원회", "조합원", "토지등소유자",
    "분담금", "추정분담금", "권리가액", "비례율", "종전자산", "감정평가", "분양신청", "분양공고", "현금청산",
    "관리처분", "관리처분계획", "사업시행", "사업시행자", "사업시행계획", "이전고시", "청산금", "주거이전비",
    "이사비", "이주비", "영업손실", "영업보상", "휴업보상", "세입자", "상가세입자", "임대주택", "주민대표회의",
    "공람공고", "보증금", "가게", "집주인", "집값", "시공자", "매도청구", "수용재결",
]


@lru_cache
def _kiwi() -> Kiwi:
    k = Kiwi()
    for w in DOMAIN_WORDS:
        k.add_user_word(w, "NNP", 5.0)
    return k


def tokenize(text: str) -> list[str]:
    tokens = _kiwi().tokenize(normalize(text))
    out: list[str] = []
    run: list[str] = []

    def flush() -> None:
        # 인접한 두 체언만 붙인다(분양+신청 -> 분양신청). 긴 연쇄 전체를 붙이면 질의와 문서의 복합어가 어긋난다.
        for a, b in pairwise(run):
            out.append(a + b)
        run.clear()

    prev = None
    for t in tokens:
        tag = t.tag
        if tag in _NOUN and t.form not in _STOP_NOUN:
            out.append(t.form)
            run.append(t.form)
        elif tag == "SN":
            flush()
            out.append(t.form)
        elif tag == "NNB" and prev is not None and prev.tag == "SN" and t.form in ("조", "항", "호", "개월", "월", "일"):
            out.append(f"{prev.form}{t.form}")
        elif tag in _VERB and t.form not in _STOP_VERB:
            flush()
            out.append(t.form)
        else:
            flush()
        prev = t
    flush()
    return out
