"""content/ 디렉터리를 읽어 교차 검증한 뒤 메모리 객체로 돌려준다."""

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import yaml

from woori.config import get_settings
from woori.content.models import (
    FORBIDDEN_PHRASES,
    ChecklistFile,
    ChecklistItem,
    Glossary,
    Refusals,
    StageCatalog,
    Zone,
)


class ContentError(ValueError):
    pass


@dataclass(frozen=True)
class Content:
    catalog: StageCatalog
    zones: dict[str, Zone]
    checklists: dict[str, list[ChecklistItem]]
    glossary: Glossary
    refusals: Refusals

    def track_of(self, zone: Zone) -> list[str]:
        return self.catalog.tracks[zone.track]


def _read(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_content(content_dir: Path | None = None) -> Content:
    root = content_dir or get_settings().content_dir
    catalog = StageCatalog.model_validate(_read(root / "stages.yaml"))
    zones = {z.id: z for z in (Zone.model_validate(_read(p)) for p in sorted((root / "zones").glob("*.yaml")))}
    checklists: dict[str, list[ChecklistItem]] = {}
    for p in sorted((root / "checklists").glob("*.yaml")):
        f = ChecklistFile.model_validate(_read(p))
        checklists[f.resident_type] = sorted(f.items, key=lambda i: i.sort_order)
    glossary = Glossary.model_validate(_read(root / "glossary.yaml"))
    refusals = Refusals.model_validate(_read(root / "refusals.yaml"))
    content = Content(catalog, zones, checklists, glossary, refusals)
    errors = validate(content)
    if errors:
        raise ContentError("콘텐츠 검증 실패:\n" + "\n".join(f"- {e}" for e in errors))
    return content


def validate(c: Content) -> list[str]:
    errors: list[str] = []
    stage_codes = set(c.catalog.stages)

    for name, codes in c.catalog.tracks.items():
        for code in codes:
            if code not in stage_codes:
                errors.append(f"track {name}: 없는 단계 {code}")

    for z in c.zones.values():
        if z.track not in c.catalog.tracks:
            errors.append(f"zone {z.id}: 없는 track {z.track}")
            continue
        track = c.catalog.tracks[z.track]
        if z.current_stage not in track:
            errors.append(f"zone {z.id}: current_stage {z.current_stage} 가 track 에 없음")
        current_idx = track.index(z.current_stage) if z.current_stage in track else -1
        has_current = False
        for e in z.events:
            if e.stage not in track:
                errors.append(f"zone {z.id}: 이벤트 단계 {e.stage} 가 track 에 없음")
                continue
            idx = track.index(e.stage)
            if e.status == "done" and idx > current_idx:
                errors.append(f"zone {z.id}: 현재 단계 이후 단계({e.stage})가 done")
            if e.status == "current":
                has_current = True
                if e.stage != z.current_stage:
                    errors.append(f"zone {z.id}: current 이벤트 단계({e.stage})와 current_stage 불일치")
            if e.status != "planned" and not (e.notice_no or e.source_note):
                errors.append(f"zone {z.id}: '{e.title}' 에 근거(notice_no 또는 source_note)가 없음")
        if not has_current:
            errors.append(f"zone {z.id}: current 이벤트가 없음")

    for rtype in ("owner", "tenant", "shop_tenant"):
        if rtype not in c.checklists:
            errors.append(f"체크리스트 없음: {rtype}")
    seen: set[str] = set()
    for rtype, items in c.checklists.items():
        for i in items:
            if i.id in seen:
                errors.append(f"체크리스트 id 중복: {i.id}")
            seen.add(i.id)
            for s in i.stages:
                if s not in stage_codes:
                    errors.append(f"{i.id}: 없는 단계 {s}")
            for phrase in FORBIDDEN_PHRASES:
                if phrase in i.title or phrase in i.plain_body:
                    errors.append(f"{i.id}: 금지 표현 '{phrase}'")

    for key, cat in c.refusals.categories.items():
        for ref in cat.contacts:
            if ref not in c.refusals.contacts:
                errors.append(f"refusal {key}: 없는 연락처 {ref}")
    return errors


@lru_cache
def get_content() -> Content:
    return load_content()
