"""구역 진행 현황 문서. 검수된 구역 콘텐츠를 생성 모델이 인용할 수 있는 문서 한 편으로 만든다."""

from woori.content.loader import Content
from woori.content.models import Zone

IMPL_LABEL = {"union": "조합 시행(생활권 재개발)", "public": "공공 시행"}


def zone_document(c: Content, zone: Zone) -> str:
    track = c.catalog.tracks[zone.track]
    stages = c.catalog.stages
    cur = track.index(zone.current_stage)
    lines = [
        f"구역: {zone.name} ({zone.location})",
        f"사업 방식: {IMPL_LABEL[zone.impl_type]}" + (f", 사업시행자 {zone.developer}" if zone.developer else ""),
        f"현재 단계: {stages[zone.current_stage].name} (전체 {len(track)}단계 중 {cur + 1}단계)",
        f"요약: {' '.join(zone.summary.split())}",
        "진행 기록:",
    ]
    for e in sorted(zone.events, key=lambda e: (track.index(e.stage), e.date or zone.as_of)):
        when = e.date.isoformat() if e.date else "날짜 미기재"
        basis = e.notice_no or e.source_note or ""
        lines.append(f"- {stages[e.stage].name}: {e.title} ({when}, 근거: {basis})")
    nxt = track[cur + 1] if cur + 1 < len(track) else None
    if nxt:
        lines.append(f"다음 단계: {stages[nxt].name} - {stages[nxt].plain_desc}")
    lines.append(f"기준일: {zone.as_of.isoformat()}")
    return "\n".join(lines)
