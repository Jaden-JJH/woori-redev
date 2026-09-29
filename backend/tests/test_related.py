"""답변에 붙는 검수된 체크리스트 카드."""

from woori.content.loader import load_content
from woori.rag.pipeline import related_items


def test_related_items_match_cited_article():
    c = load_content()
    ids = [i["id"] for i in related_items(c, c.zones["sujin1"], "tenant", ["도시정비법 제70조"])]
    assert "tenant.deposit_claim" in ids


def test_related_items_prefer_current_stage_and_respect_impl_type():
    c = load_content()
    ids = [i["id"] for i in related_items(c, c.zones["sujin1"], "shop_tenant", ["토지보상법 시행규칙 제47조"])]
    assert ids[0] == "shop.business_loss"
    # 조합 시행 구역에는 공공 시행 전용 항목이 붙지 않는다
    ids = [i["id"] for i in related_items(c, c.zones["taepyeong1"], "tenant", ["도시정비법 제47조"])]
    assert "tenant.public_opinion" not in ids


def test_no_match_returns_empty():
    c = load_content()
    assert related_items(c, c.zones["taepyeong1"], "owner", ["토지보상법 제1조"]) == []
