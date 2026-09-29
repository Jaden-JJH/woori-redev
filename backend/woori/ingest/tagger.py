"""고시에 구역과 단계를 붙인다. 규칙이 우선이고, 규칙으로 판정이 안 되면 None 을 돌려 검수 대상으로 남긴다."""

import re

from woori.content.models import Zone
from woori.text import normalize

# (패턴, 단계). 위에서부터 먼저 맞는 것을 쓴다. 변경 고시도 같은 단계로 본다.
STAGE_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"이전\s*고시"), "TRANSFER"),
    (re.compile(r"청산|해산"), "SETTLEMENT"),
    (re.compile(r"공사\s*완료|준공"), "COMPLETION"),
    (re.compile(r"관리처분"), "MGMT_DISPOSAL"),
    (re.compile(r"사업시행\s*계획.*인가|사업시행\s*인가"), "PROJECT_APPROVAL"),
    (re.compile(r"사업시행자.*지정"), "DEVELOPER_DESIGNATION"),
    (re.compile(r"조합\s*설립\s*인가"), "UNION_APPROVAL"),
    (re.compile(r"추진\s*위원회.*승인"), "CPC_APPROVAL"),
    (re.compile(r"정비\s*구역.*지정|정비\s*계획.*(결정|수립)"), "ZONE_DESIGNATION"),
    (re.compile(r"기본\s*계획"), "BASIC_PLAN"),
]


def tag_stage(title: str) -> str | None:
    t = normalize(title)
    for pattern, stage in STAGE_RULES:
        if pattern.search(t):
            return stage
    return None


class ZoneTagger:
    def __init__(self, zones: list[Zone]):
        pairs: list[tuple[str, str]] = []
        for z in zones:
            for alias in {z.name, *z.aliases}:
                pairs.append((normalize(alias), z.id))
        # 긴 별칭부터 맞춰야 '은행1-금광2' 가 '은행1' 보다 먼저 잡힌다.
        pairs.sort(key=lambda p: len(p[0]), reverse=True)
        self._patterns = [
            # 앞뒤에 숫자가 붙거나 행정동('태평1동')인 경우는 다른 곳이다.
            (re.compile(rf"(?<![0-9]){re.escape(alias)}(?![0-9]|동)"), zid)
            for alias, zid in pairs
        ]

    def tag(self, text: str) -> list[str]:
        t = normalize(text)
        found: list[str] = []
        for pattern, zid in self._patterns:
            if zid not in found and pattern.search(t):
                found.append(zid)
        return found
