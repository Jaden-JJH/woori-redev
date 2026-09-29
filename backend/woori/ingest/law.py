"""국가법령정보 공동활용 API(https://open.law.go.kr) 수집기.

법령(target=law)과 자치법규(target=ordin)의 현행 본문을 XML 로 받아 조문 단위로 나눈다.
OC 는 open.law.go.kr 에 등록한 이용자 식별값이다.
"""

import datetime as dt
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass

import httpx

from woori.text import LAW_SHORT_NAMES, clean

SEARCH_URL = "https://www.law.go.kr/DRF/lawSearch.do"
SERVICE_URL = "https://www.law.go.kr/DRF/lawService.do"

# 수집 대상: (target, 정식 명칭)
TARGET_LAWS: list[tuple[str, str]] = [
    ("law", "도시 및 주거환경정비법"),
    ("law", "도시 및 주거환경정비법 시행령"),
    ("law", "도시 및 주거환경정비법 시행규칙"),
    ("law", "공익사업을 위한 토지 등의 취득 및 보상에 관한 법률"),
    ("law", "공익사업을 위한 토지 등의 취득 및 보상에 관한 법률 시행령"),
    ("law", "공익사업을 위한 토지 등의 취득 및 보상에 관한 법률 시행규칙"),
    ("ordin", "성남시 도시 및 주거환경정비에 관한 조례"),
]


@dataclass
class Article:
    law_name: str
    law_short: str
    article_no: str  # '제72조', '제86조의2', '별표 3'
    title: str | None
    body: str
    effective_from: dt.date | None
    source_url: str


def _text(el: ET.Element | None) -> str:
    return (el.text or "").strip() if el is not None else ""


def _date(raw: str) -> dt.date | None:
    raw = re.sub(r"\D", "", raw or "")
    return dt.datetime.strptime(raw, "%Y%m%d").date() if len(raw) == 8 else None


def _article_label(el: ET.Element) -> str:
    no = _text(el.find("조문번호")).lstrip("0") or _text(el.find("조문번호"))
    branch = _text(el.find("조문가지번호")).lstrip("0")
    return f"제{no}조의{branch}" if branch else f"제{no}조"


def parse_law_xml(xml: str, source_url: str) -> list[Article]:
    root = ET.fromstring(xml)
    info = root.find("기본정보")
    name = _text(info.find("법령명_한글")) if info is not None else ""
    effective = _date(_text(info.find("시행일자"))) if info is not None else None
    short = LAW_SHORT_NAMES.get(name, name)
    articles: list[Article] = []
    for unit in root.iter("조문단위"):
        if _text(unit.find("조문여부")) != "조문":
            continue
        parts = [_text(unit.find("조문내용"))]
        for para in unit.findall("항"):
            parts.append(_text(para.find("항내용")))
            for item in para.findall("호"):
                parts.append(_text(item.find("호내용")))
                for sub in item.findall("목"):
                    parts.append(_text(sub.find("목내용")))
        for item in unit.findall("호"):  # 항 없이 호가 바로 오는 조문
            parts.append(_text(item.find("호내용")))
        body = clean("\n".join(p for p in parts if p))
        if "삭제" in body[:40] and len(body) < 40:
            continue
        articles.append(
            Article(
                law_name=name,
                law_short=short,
                article_no=_article_label(unit),
                title=_text(unit.find("조문제목")) or None,
                body=body,
                effective_from=_date(_text(unit.find("조문시행일자"))) or effective,
                source_url=source_url,
            )
        )
    for annex in root.iter("별표단위"):
        no = _text(annex.find("별표번호")).lstrip("0")
        branch = _text(annex.find("별표가지번호")).lstrip("0")
        label = f"별표 {no}" + (f"의{branch}" if branch else "")
        body = clean(_text(annex.find("별표내용")))
        if body:
            articles.append(
                Article(name, short, label, _text(annex.find("별표제목")) or None, body, effective, source_url)
            )
    return articles


def parse_ordin_xml(xml: str, source_url: str) -> list[Article]:
    root = ET.fromstring(xml)
    info = root.find("자치법규기본정보")
    name = _text(info.find("자치법규명")) if info is not None else ""
    effective = _date(_text(info.find("시행일자"))) if info is not None else None
    short = LAW_SHORT_NAMES.get(name, name)
    articles: list[Article] = []
    for unit in root.iter("조"):
        if _text(unit.find("조문여부")) not in ("", "Y", "조문"):
            continue
        content = clean("".join(unit.find("조내용").itertext())) if unit.find("조내용") is not None else ""
        if not content or (content.startswith("삭제") and len(content) < 40):
            continue
        m = re.match(r"(제\s*\d+\s*조(?:의\s*\d+)?)", content)
        label = re.sub(r"\s+", "", m.group(1)) if m else _text(unit.find("조문번호"))
        articles.append(Article(name, short, label, _text(unit.find("조제목")) or None, content, effective, source_url))
    return articles


class LawClient:
    def __init__(self, oc: str, client: httpx.Client | None = None):
        self.oc = oc
        self._client = client or httpx.Client(timeout=60.0, follow_redirects=True)

    def _get(self, url: str, **params) -> str:
        resp = self._client.get(url, params={"OC": self.oc, "type": "XML", **params})
        resp.raise_for_status()
        time.sleep(0.5)
        return resp.text

    def find_mst(self, target: str, name: str) -> str:
        xml = self._get(SEARCH_URL, target=target, query=name)
        root = ET.fromstring(xml)
        tag, name_tag, id_tag = (
            ("law", "법령명한글", "법령일련번호") if target == "law" else ("law", "자치법규명", "자치법규일련번호")
        )
        for node in root.iter(tag):
            if _text(node.find(name_tag)) == name and _text(node.find("현행연혁코드")) in ("", "현행"):
                return _text(node.find(id_tag))
        raise LookupError(f"법령을 찾지 못했습니다: {name}")

    def fetch(self, target: str, name: str) -> list[Article]:
        mst = self.find_mst(target, name)
        xml = self._get(SERVICE_URL, target=target, MST=mst)
        url = f"https://www.law.go.kr/DRF/lawService.do?target={target}&MST={mst}&type=HTML"
        return parse_law_xml(xml, url) if target == "law" else parse_ordin_xml(xml, url)
