# 제3자 구성요소 고지

이 저장소의 코드는 MIT 라이선스입니다. 아래 구성요소는 각자의 라이선스를 따릅니다. 수정 없이 의존성으로만 사용합니다.

## 백엔드 (Python)

| 구성요소 | 라이선스 | 용도 |
|---|---|---|
| FastAPI, Starlette | MIT, BSD-3-Clause | API 서버 |
| Uvicorn | BSD-3-Clause | ASGI 서버 |
| Pydantic, pydantic-settings | MIT | 스키마, 설정 |
| psycopg, psycopg-pool | LGPL-3.0 | Postgres 드라이버 (동적 링크, 수정 없음) |
| pgvector-python | MIT | 벡터 타입 |
| httpx | BSD-3-Clause | HTTP 클라이언트 |
| kiwipiepy | LGPL-3.0 | 한국어 형태소 분석 (수정 없음) |
| PyYAML | MIT | 콘텐츠 로딩 |
| anthropic | MIT | Claude API SDK |
| google-genai | Apache-2.0 | Gemini API SDK |
| pdfplumber, pdfminer.six | MIT | PDF 텍스트 추출 |
| olefile | BSD-2-Clause | HWP 5.x(OLE) 읽기 |
| Pillow | MIT-CMU (HPND) | 이미지 재인코딩, EXIF 제거 |
| python-multipart | Apache-2.0 | 파일 업로드 |

HWP 5.x 파서는 한글과컴퓨터가 공개한 'HWP 5.0 문서 파일 구조' 문서를 바탕으로 직접 구현했습니다(AGPL 라이선스인 pyhwp 는 쓰지 않음).

## 프론트엔드

| 구성요소 | 라이선스 |
|---|---|
| Next.js, React | MIT |
| Tailwind CSS | MIT |
| Pretendard (jsDelivr CDN) | SIL Open Font License 1.1 |

## 데이터

| 데이터 | 출처 | 비고 |
|---|---|---|
| 법령 조문 | 국가법령정보센터 공동활용 API | 법령은 저작권법 제7조에 따라 보호 대상이 아님. 출처 표기 |
| 성남시 고시공고 | 성남시 누리집 고시공고 게시판 | 원문 링크와 고시번호 표기 |
| 테스트 픽스처 (`backend/tests/fixtures`) | 위 게시판에서 2026-09-29 받은 공개 페이지와 첨부 | 파서 회귀 테스트용 |

## AI 모델

- Anthropic Claude (답변 생성, 질의 분석), Google Gemini (문서 사진 해설, 임베딩). 각 공급사 이용약관을 따릅니다.
