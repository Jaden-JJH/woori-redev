"""성남시 고시공고 게시판(https://www.seongnam.go.kr/pm010301) 수집기.

robots.txt 는 /pm010301 경로를 허용한다. 요청 사이에 간격을 두고, 서비스명과 연락처를 User-Agent 에 밝힌다.
"""

import datetime as dt
import html
import re
import ssl
import time
import urllib.parse
from dataclasses import dataclass, field

import httpx

from woori.text import clean, normalize_notice_no

BASE = "https://www.seongnam.go.kr"
LIST_URL = f"{BASE}/pm010301"
FILE_URL = "https://eminwon.seongnam.go.kr/emwp/jsp/ofr/FileDown.jsp"
USER_AGENT = "WooriRedevBot/1.0 (+https://github.com/Jaden-JJH/woori-redev; public notice indexing for residents)"
REQUEST_INTERVAL_SEC = 1.0


@dataclass
class ListRow:
    board_id: str
    notice_no: str
    title: str
    dept: str
    posted_at: dt.date


@dataclass
class Attachment:
    user_name: str
    sys_name: str
    path: str

    @property
    def ext(self) -> str:
        return self.user_name.rsplit(".", 1)[-1].lower() if "." in self.user_name else ""

    @property
    def url(self) -> str:
        q = urllib.parse.urlencode(
            {"user_file_nm": self.user_name, "sys_file_nm": self.sys_name, "file_path": self.path},
            quote_via=urllib.parse.quote,
        )
        return f"{FILE_URL}?{q}"


@dataclass
class Detail:
    board_id: str
    notice_no: str
    title: str
    dept: str
    posted_at: dt.date
    body: str
    attachments: list[Attachment] = field(default_factory=list)

    @property
    def url(self) -> str:
        return f"{LIST_URL}/{self.board_id}"


def _strip_tags(fragment: str) -> str:
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    return html.unescape(re.sub(r"<[^>]+>", " ", fragment))


def _cell(row_html: str, label: str) -> str:
    m = re.search(rf'<strong class="mobile-tit">{label}</strong>(.*?)</td>', row_html, re.S)
    return clean(_strip_tags(m.group(1))) if m else ""


def parse_list(page_html: str) -> list[ListRow]:
    start = page_html.find('class="board-table"')
    if start < 0:
        return []
    table = page_html[start : page_html.find("</table>", start)]
    rows: list[ListRow] = []
    for tr in re.findall(r"<tr>.*?</tr>", table, re.S):
        vid = re.search(r"f_view\('(\d+)'\)", tr)
        if not vid:
            continue
        notice_no = normalize_notice_no(_cell(tr, "고시공고번호"))
        date_txt = _cell(tr, "등록일")
        if not notice_no or not re.match(r"\d{4}\.\d{2}\.\d{2}", date_txt):
            continue
        rows.append(
            ListRow(
                board_id=vid.group(1),
                notice_no=notice_no,
                title=_cell(tr, "제목"),
                dept=_cell(tr, "담당부서"),
                posted_at=dt.datetime.strptime(date_txt[:10], "%Y.%m.%d").date(),
            )
        )
    return rows


def _dd(page_html: str, label: str) -> str:
    m = re.search(rf"<dt>\s*{label}\s*</dt>\s*<dd[^>]*>(.*?)</dd>", page_html, re.S)
    return clean(_strip_tags(m.group(1))) if m else ""


_ATTACH_RE = re.compile(r"goDownLoad\(event,\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\)")


def parse_detail(board_id: str, page_html: str) -> Detail:
    body_m = re.search(r'<div class="board-view-content">\s*<div[^>]*>(.*?)</div>', page_html, re.S)
    body = clean(_strip_tags(body_m.group(1))) if body_m else ""
    attachments = [Attachment(*m) for m in _ATTACH_RE.findall(page_html)]
    notice_no = normalize_notice_no(_dd(page_html, "고시공고번호")) or ""
    date_txt = _dd(page_html, "등록일")
    return Detail(
        board_id=board_id,
        notice_no=notice_no,
        title=_dd(page_html, "제목"),
        dept=_dd(page_html, "담당부서"),
        posted_at=dt.date.fromisoformat(date_txt[:10]),
        body=body,
        attachments=attachments,
    )


def _tls_context() -> ssl.SSLContext:
    # 성남시 서버는 OpenSSL 3 기본 보안 수준(SECLEVEL=2)에서 핸드셰이크가 실패한다.
    # 인증서 검증은 그대로 두고 암호 스위트 보안 수준만 1로 낮춘다.
    ctx = ssl.create_default_context()
    ctx.set_ciphers("DEFAULT:@SECLEVEL=1")
    return ctx


class SeongnamClient:
    def __init__(self, client: httpx.Client | None = None):
        self._client = client or httpx.Client(
            headers={"User-Agent": USER_AGENT}, timeout=60.0, follow_redirects=True, verify=_tls_context()
        )
        self._last = 0.0

    def _get(self, url: str, **params) -> httpx.Response:
        wait = REQUEST_INTERVAL_SEC - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        resp = self._client.get(url, params=params or None)
        self._last = time.monotonic()
        resp.raise_for_status()
        return resp

    def search(self, *, key: str, text: str, per_page: int = 100, max_pages: int = 5) -> list[ListRow]:
        """key: 'sj'(제목) | 'cn'(내용) | 'depNm'(담당부서)"""
        rows: list[ListRow] = []
        for page in range(1, max_pages + 1):
            resp = self._get(LIST_URL, srchKey=key, srchText=text, cntPerPage=per_page, curPage=page)
            batch = parse_list(resp.text)
            rows.extend(batch)
            if len(batch) < per_page:
                break
        return rows

    def detail(self, board_id: str) -> Detail:
        return parse_detail(board_id, self._get(f"{LIST_URL}/{board_id}").text)

    def download(self, att: Attachment) -> bytes:
        return self._get(att.url).content
