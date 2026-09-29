"""수집, 추출, 태깅. 픽스처는 2026-09-29 성남시 고시공고 게시판에서 받은 실제 페이지다."""

import datetime as dt
from pathlib import Path

import pytest

from woori.content.loader import load_content
from woori.ingest.chunker import chunk_law_article, join_table_cells
from woori.ingest.documents import extract_text
from woori.ingest.seongnam import parse_detail, parse_list
from woori.ingest.tagger import ZoneTagger, tag_stage
from woori.text import law_refs, normalize_notice_no, referenced_notices

FIX = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def content():
    return load_content()


@pytest.fixture(scope="module")
def tagger(content):
    return ZoneTagger(list(content.zones.values()))


def test_parse_list():
    rows = parse_list((FIX / "seongnam_list_redev.html").read_text(encoding="utf-8"))
    assert len(rows) == 52
    top = rows[0]
    assert top.notice_no == "성남시 고시 제2026-224호"
    assert top.board_id == "153145" and top.dept == "재개발과" and top.posted_at == dt.date(2026, 9, 14)


def test_parse_detail_and_reference():
    d = parse_detail("152933", (FIX / "seongnam_detail_152933.html").read_text(encoding="utf-8"))
    assert d.notice_no == "성남시 고시 제2026-216호"
    assert d.title.startswith("수진1 재개발 정비사업 관리처분계획")
    assert d.attachments and d.attachments[0].ext == "hwpx"
    assert referenced_notices(d.body) == [
        {"notice_no": "성남시 고시 제2026-130호", "date": "2026-06-15", "what": "관리처분계획인가"}
    ]
    assert "도시정비법 제78조" in law_refs(d.body)


def test_hwpx_extract():
    text = extract_text((FIX / "notice_2026-216.hwpx").read_bytes(), "hwpx")
    assert "한국토지주택공사" in text
    assert "관리처분계획인가일(최초): 2026. 6. 15." in text


def test_notice_no_normalization():
    assert normalize_notice_no("성남시 고시 제2026 - 216호") == "성남시 고시 제2026-216호"
    assert normalize_notice_no("성남시 공고 제2025-7호") == "성남시 공고 제2025-7호"


@pytest.mark.parametrize(
    "title,stage",
    [
        ("태평1구역 생활권 재개발사업 조합설립추진위원회 구성 승인 고시", "CPC_APPROVAL"),
        ("수진1 재개발 정비사업 관리처분계획(경미한 변경)인가 고시", "MGMT_DISPOSAL"),
        ("신흥1구역 재개발 정비사업 사업시행계획인가 고시", "PROJECT_APPROVAL"),
        ("2030-2단계 상대원3 재개발 정비구역 사업시행자 지정 고시", "DEVELOPER_DESIGNATION"),
        ("수진1 재개발 정비계획 수립 및 정비구역 지정(경미한 변경) 및 지형도면 고시", "ZONE_DESIGNATION"),
        ("성남 신흥2 주택재개발 정비사업 공사완료 고시", "COMPLETION"),
        ("생활권 재개발사업 후보지 행위제한 고시", None),
    ],
)
def test_stage_rules(title, stage):
    assert tag_stage(title) == stage


def test_zone_tagging(tagger):
    joined = "은행1" + chr(0x00B7) + "금광2구역 생활권 재개발사업 조합설립추진위원회 구성 승인 고시"
    assert tagger.tag(joined) == ["eunhaeng1-geumgwang2"]
    assert tagger.tag("태평1구역 생활권 재개발사업") == ["taepyeong1"]
    assert tagger.tag("수진1 재개발 정비사업") == ["sujin1"]
    # 행정동, 다른 번호 구역은 잡지 않는다
    assert tagger.tag("태평1동 행정복지센터") == []
    assert tagger.tag("수진2구역 생활권 재개발사업") == []
    assert tagger.tag("태평2" + chr(0x00B7) + "4구역") == []


def test_table_cells_joined():
    text = "구분\n대지면적\n건폐율\n용적률\n공동주택1은 아파트 및 부대시설과 근린생활시설로 구성된다"
    assert join_table_cells(text).splitlines()[0] == "구분 | 대지면적 | 건폐율 | 용적률"


def test_law_chunk_header_and_resident_types():
    chunks = chunk_law_article(
        "공익사업을 위한 토지 등의 취득 및 보상에 관한 법률 시행규칙", "토지보상법 시행규칙", "제54조", "주거이전비의 보상",
        "제54조(주거이전비의 보상)\n①...", "https://www.law.go.kr",
    )
    assert chunks[0].source_label == "토지보상법 시행규칙 제54조"
    assert chunks[0].header.endswith("제54조(주거이전비의 보상)]")
    assert set(chunks[0].resident_types) == {"owner", "tenant"}
