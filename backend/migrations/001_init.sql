-- 우리동네 재개발 비서 스키마 v1
CREATE EXTENSION IF NOT EXISTS vector;

-- 법정 절차 단계 마스터 (content/stages.yaml 에서 적재)
CREATE TABLE stage (
  code        text PRIMARY KEY,
  name        text NOT NULL,
  plain_desc  text NOT NULL,
  legal_ref   text NOT NULL
);

-- 정비구역 (content/zones/*.yaml 에서 적재)
CREATE TABLE zone (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  district      text NOT NULL,
  location      text NOT NULL,
  aliases       text[] NOT NULL,
  impl_type     text NOT NULL,
  developer     text,
  track         text NOT NULL,
  current_stage text NOT NULL REFERENCES stage(code),
  summary       text NOT NULL,
  as_of         date NOT NULL,
  reviewed_by   text
);

-- 고시공고 원천
CREATE TABLE notice (
  id           bigserial PRIMARY KEY,
  notice_no    text UNIQUE NOT NULL,
  board_id     text,
  title        text NOT NULL,
  dept         text,
  posted_at    date NOT NULL,
  url          text,
  body         text NOT NULL,
  raw_sha256   text,
  zone_ids     text[] NOT NULL DEFAULT '{}',
  stage_code   text REFERENCES stage(code),
  tag_source   text NOT NULL,
  derived_from text,
  fetched_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notice_zone_idx ON notice USING gin (zone_ids);

-- 구역별 단계 이벤트
CREATE TABLE zone_event (
  id          bigserial PRIMARY KEY,
  zone_id     text NOT NULL REFERENCES zone(id) ON DELETE CASCADE,
  stage_code  text NOT NULL REFERENCES stage(code),
  seq         int NOT NULL,
  status      text NOT NULL CHECK (status IN ('done', 'current', 'planned')),
  event_date  date,
  title       text NOT NULL,
  plain_desc  text,
  notice_no   text,
  source_note text,
  CHECK (notice_no IS NOT NULL OR source_note IS NOT NULL OR status = 'planned')
);
CREATE INDEX zone_event_zone_idx ON zone_event (zone_id, seq);

-- 법령 조문
CREATE TABLE law_article (
  id             bigserial PRIMARY KEY,
  law_name       text NOT NULL,
  law_short      text NOT NULL,
  article_no     text NOT NULL,
  article_title  text,
  body           text NOT NULL,
  effective_from date,
  source_url     text NOT NULL,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (law_name, article_no)
);

-- 검색 단위
CREATE TABLE chunk (
  id             bigserial PRIMARY KEY,
  source_type    text NOT NULL CHECK (source_type IN ('notice', 'law', 'zone_doc')),
  source_key     text NOT NULL,
  chunk_no       int NOT NULL,
  header         text NOT NULL,
  body           text NOT NULL,
  zone_ids       text[],
  stage_codes    text[],
  resident_types text[],
  legal_refs     text[],
  source_label   text NOT NULL,
  source_url     text,
  is_current     boolean NOT NULL DEFAULT true,
  content_hash   text NOT NULL,
  embedding      vector(768),
  embed_model    text,
  UNIQUE (source_type, source_key, chunk_no)
);
CREATE INDEX chunk_embedding_idx ON chunk USING hnsw (embedding vector_cosine_ops);
CREATE INDEX chunk_zone_idx ON chunk USING gin (zone_ids);

-- 체크리스트, 돈 캘린더 항목 (content/checklists/*.yaml)
CREATE TABLE checklist_item (
  id             text PRIMARY KEY,
  impl_types     text[] NOT NULL,
  stages         text[] NOT NULL,
  resident_type  text NOT NULL,
  kind           text NOT NULL CHECK (kind IN ('todo', 'benefit', 'deadline', 'caution')),
  is_money       boolean NOT NULL,
  title          text NOT NULL,
  plain_body     text NOT NULL,
  conditions     text,
  legal_basis    text NOT NULL,
  law_ref        text,
  sort_order     int NOT NULL,
  reviewed_by    text,
  reviewed_at    date
);

CREATE TABLE glossary_term (
  term      text PRIMARY KEY,
  aliases   text[] NOT NULL DEFAULT '{}',
  plain     text NOT NULL,
  example   text,
  legal_ref text
);

-- 답변 추적: 질문 원문, IP, 이미지는 저장하지 않는다
CREATE TABLE answer_trace (
  trace_id       uuid PRIMARY KEY,
  created_at     timestamptz NOT NULL DEFAULT now(),
  endpoint       text NOT NULL,
  zone_id        text,
  resident_type  text,
  topic          text,
  outcome        text NOT NULL,
  gate_scores    jsonb,
  chunk_ids      bigint[],
  model          text,
  prompt_version text,
  latency_ms     int
);
CREATE INDEX answer_trace_created_idx ON answer_trace (created_at);

CREATE TABLE ingest_run (
  id             bigserial PRIMARY KEY,
  source         text NOT NULL,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  fetched        int NOT NULL DEFAULT 0,
  new_items      int NOT NULL DEFAULT 0,
  failed         int NOT NULL DEFAULT 0,
  last_notice_no text,
  log            jsonb NOT NULL DEFAULT '[]'
);
