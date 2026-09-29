-- 청크 토큰 미리 계산: 서버가 새로 켜질 때 형태소 분석(약 7초)을 건너뛰고 BM25 색인을 바로 만든다.
ALTER TABLE chunk ADD COLUMN IF NOT EXISTS tokens text[];
