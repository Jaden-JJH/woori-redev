"""큐레이션 콘텐츠(content/*.yaml)의 스키마. 로딩 시점에 모든 규칙을 검증한다."""

import datetime as dt
import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

ResidentType = Literal["owner", "tenant", "shop_tenant"]
ImplType = Literal["union", "public"]

NOTICE_NO_PATTERN = re.compile(r"^성남시 (고시|공고) 제\d{4}-\d+호$")
LEGAL_BASIS_PATTERN = re.compile(r"(도시정비법|토지보상법|성남시)[^,]*(제\d+조|별표)")

# 안내 문구에 쓰면 안 되는 단정, 권유 표현
FORBIDDEN_PHRASES = ("확실히", "무조건", "반드시 받", "보장합니다", "투자하세요", "추천드려요", "이득이에요")


class Stage(BaseModel):
    name: str
    plain_desc: str
    legal_ref: str


class StageCatalog(BaseModel):
    stages: dict[str, Stage]
    tracks: dict[str, list[str]]


class ZoneEvent(BaseModel):
    stage: str
    status: Literal["done", "current", "planned"]
    date: dt.date | None = None
    title: str
    plain_desc: str | None = None
    notice_no: str | None = None
    source_note: str | None = None

    @field_validator("notice_no")
    @classmethod
    def _notice_no(cls, v: str | None) -> str | None:
        if v is not None and not NOTICE_NO_PATTERN.match(v):
            raise ValueError(f"고시번호 형식 오류: {v}")
        return v


class Zone(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    name: str
    district: str
    location: str
    aliases: list[str]
    impl_type: ImplType
    developer: str | None = None
    track: str
    current_stage: str
    summary: str
    as_of: dt.date
    reviewed_by: str | None = None
    events: list[ZoneEvent]


class ChecklistItem(BaseModel):
    id: str
    impl_types: list[ImplType]
    stages: list[str]
    kind: Literal["todo", "benefit", "deadline", "caution"]
    is_money: bool
    title: str
    plain_body: str
    conditions: str | None = None
    legal_basis: str
    law_ref: str | None = None
    sort_order: int

    @field_validator("legal_basis")
    @classmethod
    def _legal_basis(cls, v: str) -> str:
        if not LEGAL_BASIS_PATTERN.search(v):
            raise ValueError(f"법령 근거 형식 오류: {v}")
        return v


class ChecklistFile(BaseModel):
    resident_type: ResidentType
    reviewed_by: str | None = None
    reviewed_at: dt.date | None = None
    items: list[ChecklistItem]


class GlossaryTerm(BaseModel):
    term: str
    aliases: list[str] = []
    plain: str
    example: str | None = None
    legal_ref: str | None = None


class Glossary(BaseModel):
    terms: list[GlossaryTerm]


class Contact(BaseModel):
    name: str
    tel: str | None = None
    note: str | None = None
    url: str | None = None


class RefusalCategory(BaseModel):
    message: str
    reason: str
    contacts: list[str]
    patterns: list[str]

    @field_validator("patterns")
    @classmethod
    def _compile(cls, v: list[str]) -> list[str]:
        for p in v:
            re.compile(p)
        return v


class Refusals(BaseModel):
    contacts: dict[str, Contact]
    categories: dict[str, RefusalCategory]
    suggestions: dict[ResidentType, list[str]]
