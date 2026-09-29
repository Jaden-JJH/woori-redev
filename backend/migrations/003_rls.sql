-- Supabase 는 public 스키마 표를 웹 API(PostgREST)로 노출한다. 정책 없이 RLS 만 켜서 웹 API 접근을 막는다.
-- 백엔드는 postgres 역할로 직접 접속하므로 RLS 의 영향을 받지 않는다.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
