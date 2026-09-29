"""큐레이션 콘텐츠 규칙과 결정적 화면 계산."""

from woori.content.loader import load_content, validate
from woori.content.models import FORBIDDEN_PHRASES
from woori.rag.bm25 import BM25Index
from woori.rag.tokenizer import tokenize


def test_content_valid():
    c = load_content()
    assert validate(c) == []
    assert set(c.zones) == {"taepyeong1", "eunhaeng1-geumgwang2", "sujin1"}


def test_every_checklist_item_has_legal_basis_and_no_forbidden_phrase():
    c = load_content()
    for items in c.checklists.values():
        for i in items:
            assert i.legal_basis
            assert not any(p in i.plain_body for p in FORBIDDEN_PHRASES)


def test_public_track_has_no_union_stage():
    c = load_content()
    track = c.catalog.tracks[c.zones["sujin1"].track]
    assert "UNION_APPROVAL" not in track and "RESIDENT_COUNCIL" in track


def test_tokenizer_domain_words():
    assert "재개발" in tokenize("재개발되면 집값 오를까요")
    assert "분양신청" in tokenize("분양신청 안 하면 어떻게 되나요")
    assert "72조" in tokenize("도시정비법 제72조")
    assert "가게" in tokenize("가게 하는데 영업보상 받나요")


def test_coverage_penalizes_unknown_terms():
    idx = BM25Index({1: tokenize("세입자 주거이전비 보상"), 2: tokenize("분양신청 기간 통지")})
    on_topic = idx.coverage(tokenize("세입자 주거이전비"), 1)
    off_topic = idx.coverage(tokenize("오늘 저녁 메뉴 세입자"), 1)
    assert on_topic == 1.0 and off_topic < 0.5
