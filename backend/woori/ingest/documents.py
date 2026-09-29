"""첨부 문서(HWPX, HWP 5.x, PDF)에서 본문 텍스트를 추출한다.

HWP 5.x 는 OLE 복합 문서다. BodyText/SectionN 스트림은 raw deflate 로 압축된 레코드 열이고,
HWPTAG_PARA_TEXT(태그 67) 레코드에 UTF-16LE 문단 텍스트가 들어 있다.
참고: 한글과컴퓨터 'HWP 5.0 문서 파일 구조' 공개 문서.
"""

import io
import re
import struct
import zipfile
import zlib

import olefile
import pdfplumber

HWPTAG_PARA_TEXT = 67

# HWP 문단 텍스트 안의 제어 문자. 확장 컨트롤은 뒤에 14바이트(7 wchar)가 더 붙는다.
_EXTENDED_CTRL = {1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23}
_INLINE_CTRL = {4, 5, 6, 7, 8, 9, 19, 20}


def extract_hwpx(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        sections = sorted(
            (n for n in z.namelist() if re.match(r"Contents/section\d+\.xml$", n)),
            key=lambda n: int(re.search(r"(\d+)", n.rsplit("/", 1)[-1]).group(1)),
        )
        lines: list[str] = []
        for name in sections:
            xml = z.read(name).decode("utf-8")
            for para in re.findall(r"<hp:p\b.*?</hp:p>", xml, re.S):
                text = "".join(re.findall(r"<hp:t>([^<]*)</hp:t>", para))
                if text.strip():
                    lines.append(_unescape_xml(text))
        return "\n".join(lines)


def _unescape_xml(s: str) -> str:
    return s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'").replace(
        "&amp;", "&"
    )


def _decode_para_text(payload: bytes) -> str:
    # 제어 문자를 걸러 낸 UTF-16 코드 단위를 모은 뒤 한 번에 디코딩한다(서로게이트 쌍 보존).
    units: list[int] = []
    i = 0
    n = len(payload) // 2
    while i < n:
        code = struct.unpack_from("<H", payload, i * 2)[0]
        if code < 32:
            if code in _EXTENDED_CTRL or code in _INLINE_CTRL:
                i += 8
                continue
            if code in (10, 13):
                units.append(0x0A)
            elif code in (24, 30, 31):
                units.append(0x20)
            i += 1
            continue
        units.append(code)
        i += 1
    return struct.pack(f"<{len(units)}H", *units).decode("utf-16-le", errors="replace")


def _iter_records(stream: bytes):
    pos = 0
    while pos + 4 <= len(stream):
        header = struct.unpack_from("<I", stream, pos)[0]
        tag = header & 0x3FF
        size = (header >> 20) & 0xFFF
        pos += 4
        if size == 0xFFF:
            size = struct.unpack_from("<I", stream, pos)[0]
            pos += 4
        yield tag, stream[pos : pos + size]
        pos += size


def extract_hwp5(data: bytes) -> str:
    ole = olefile.OleFileIO(io.BytesIO(data))
    try:
        header = ole.openstream("FileHeader").read()
        flags = struct.unpack_from("<I", header, 36)[0]
        compressed = bool(flags & 0x01)
        if flags & 0x02:
            raise ValueError("암호가 걸린 HWP 문서는 읽을 수 없습니다")
        sections = sorted(
            (e for e in ole.listdir() if len(e) == 2 and e[0] == "BodyText" and e[1].startswith("Section")),
            key=lambda e: int(e[1][len("Section") :]),
        )
        paras: list[str] = []
        for entry in sections:
            raw = ole.openstream(entry).read()
            stream = zlib.decompress(raw, -15) if compressed else raw
            for tag, payload in _iter_records(stream):
                if tag == HWPTAG_PARA_TEXT:
                    text = _decode_para_text(payload).strip()
                    if text:
                        paras.append(text)
        return "\n".join(paras)
    finally:
        ole.close()


def extract_pdf(data: bytes) -> str:
    pages: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                pages.append(text)
    return "\n".join(pages)


def extract_text(data: bytes, ext: str) -> str:
    ext = ext.lower().lstrip(".")
    if ext == "hwpx" or data[:2] == b"PK":
        return extract_hwpx(data)
    if ext == "hwp" or data[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
        return extract_hwp5(data)
    if ext == "pdf" or data[:4] == b"%PDF":
        return extract_pdf(data)
    raise ValueError(f"지원하지 않는 첨부 형식: {ext}")
