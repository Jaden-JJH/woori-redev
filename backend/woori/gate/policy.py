"""게이트1: 정책 게이트. content/refusals.yaml 의 규칙 사전으로 답하지 않을 질문을 먼저 거른다.

규칙 판정과 질의 분석 모델 판정은 OR 로 합친다(재현율 우선). 규칙은 모델 호출 전에 돌아서 비용이 없다.
"""

import re
from dataclasses import dataclass
from functools import lru_cache

from woori.content.loader import get_content
from woori.text import normalize

# 규칙 사전이 먼저 막아야 하는 순서. 주입 시도는 다른 카테고리보다 우선한다.
PRIORITY = ["prompt_injection", "price_forecast", "financial_product", "personal_levy_calc", "legal_judgment", "evaluation"]


@dataclass(frozen=True)
class PolicyHit:
    category: str
    pattern: str


@lru_cache
def _compiled() -> list[tuple[str, re.Pattern]]:
    cats = get_content().refusals.categories
    out: list[tuple[str, re.Pattern]] = []
    for key in PRIORITY + [k for k in cats if k not in PRIORITY]:
        cat = cats.get(key)
        if cat is None:
            continue
        out.extend((key, re.compile(p, re.IGNORECASE)) for p in cat.patterns)
    return out


def check_rules(question: str) -> PolicyHit | None:
    q = normalize(question)
    for key, pattern in _compiled():
        if pattern.search(q):
            return PolicyHit(key, pattern.pattern)
    return None
