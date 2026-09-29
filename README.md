# 우리동네 재개발 비서

성남 원도심 정비구역 주민(집주인, 세입자, 가게 세입자)이 **우리 구역의 현재 단계, 지금 할 일, 받을 수 있는 지원**을
**공식 문서 근거와 함께 쉬운 말로** 확인하는 모바일 웹앱입니다. 제2회 성남 x KAIST AI경진대회 출품작(팀 Trust).

- 근거가 없으면 답하지 않습니다. 모든 답변에는 성남시 고시 또는 현행 법령 조문과 원문 구절이 붙습니다.
- 집값 전망, 개별 분담금 계산, 금융상품 추천, 법적 판단은 하지 않습니다.
- 주소, 이름, 질문 원문, 사진을 저장하지 않습니다.

## 구조

```
apps/web      Next.js 16 (App Router) 모바일 웹. 결정적 화면은 서버 렌더링, 물어보기와 문서 해설은 클라이언트
backend/      Python 3.13 패키지 woori
  woori/ingest   성남시 고시공고 수집(HWPX, HWP 5.x, PDF 추출), 국가법령정보 API 수집, 태깅, 청킹
  woori/rag      하이브리드 검색(kiwi 형태소 BM25 + pgvector, RRF), 생성, 인용 검증, 문서 사진 해설
  woori/gate     정책 게이트(답하지 않을 질문)
  woori/llm      Claude, Gemini 어댑터, 장애 폴백, 녹화 응답
  woori/api      FastAPI
content/      사람이 검수하는 구역 타임라인, 유형별 체크리스트, 용어 사전, 거부 규칙 (YAML)
eval/         평가 문항과 리포트
infra/        docker-compose (Postgres 16 + pgvector)
legacy/poc    예선 PoC
```

### 두 개의 레이어

| 레이어 | 기능 | LLM |
|---|---|---|
| 결정적 레이어 | 구역 타임라인, 체크리스트, 돈 캘린더, 용어 | 쓰지 않음. `content/*.yaml` 을 그대로 보여주고 모든 문장에 근거 조항을 붙임 |
| 생성 레이어 | 물어보기, 문서 사진 해설 | 씀. 3단 게이트를 통과한 답만 보여줌 |

### 3단 신뢰 게이트

1. **정책 게이트**: 규칙 사전 + 질의 분석 모델. 시세 전망, 분담금 계산, 금융상품, 법적 판단, 프롬프트 주입을 거부
2. **근거 게이트**: 검색 결과가 질문 어휘를 얼마나 덮는지(idf 가중 coverage)로 근거 유무를 판단
3. **검증 게이트**: 모델이 붙인 인용 구절이 실제 문서 원문에 있는지 코드로 대조. 통과하지 못한 문장은 버림

## 로컬 실행

필요: Docker, [uv](https://docs.astral.sh/uv/), Node 20+, pnpm

```bash
cp .env.example .env          # 키가 없어도 결정적 화면과 정책 게이트는 동작합니다
make up                       # Postgres + pgvector
make seed laws notices index  # 콘텐츠 반영, 법령 수집, 성남시 고시 수집, 색인
make api                      # http://localhost:8000
make web                      # http://localhost:3000
make test
```

환경변수는 셸에 이미 있는 공용 `ANTHROPIC_API_KEY` 와 섞이지 않도록 앱 전용 이름(`WOORI_ANTHROPIC_API_KEY`, `WOORI_GEMINI_API_KEY`)을 씁니다.

## 데이터 출처

- 성남시 고시공고 게시판 `https://www.seongnam.go.kr/pm010301` (robots.txt 허용 경로, 요청 간격 1초)
- 국가법령정보 공동활용 API `https://open.law.go.kr` (도시정비법과 시행령, 시행규칙, 토지보상법과 시행령, 시행규칙, 성남시 도시 및 주거환경정비에 관한 조례)

이 서비스는 성남시 공개 자료를 활용한 민간 제안 서비스이며 성남시의 공식 서비스가 아닙니다.

## 라이선스

MIT. 사용한 오픈소스와 폰트는 [NOTICE.md](NOTICE.md) 에 적었습니다.
