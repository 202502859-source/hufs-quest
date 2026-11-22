-- 초안: 설계 문서(docs/ANSWER_CACHE.md) 합의 후 Supabase SQL Editor에서 실행할 예정입니다. (아직 실행하지 않음)
-- HUFS Quest: 검색창(api/ask.js) 답변 캐시 테이블 및 데이터 버전 관리
CREATE TABLE IF NOT EXISTS public.answer_cache_meta (
  id integer PRIMARY KEY CHECK (id = 1),
  data_version text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.answer_cache_meta (id, data_version) VALUES (1, 'v1-initial') ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.answer_cache (
  cache_key text PRIMARY KEY CHECK (cache_key ~ '^[0-9a-f]{64}$'),
  lang text NOT NULL CHECK (lang IN ('ko', 'en')),
  answer text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_answer_cache_expires_at ON public.answer_cache (expires_at);
ALTER TABLE public.answer_cache_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.answer_cache_meta FROM anon, authenticated;
REVOKE ALL ON TABLE public.answer_cache FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.get_answer_cache(p_cache_key text, p_data_version text)
RETURNS TABLE (answer text, sources jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.answer, c.sources FROM public.answer_cache c JOIN public.answer_cache_meta m ON m.id = 1
  WHERE c.cache_key = p_cache_key AND c.data_version = p_data_version AND m.data_version = p_data_version AND c.expires_at > now() LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.set_answer_cache(p_cache_key text, p_lang text, p_answer text, p_sources jsonb, p_data_version text, p_ttl_seconds integer DEFAULT 86400)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_cache_key IS NULL OR p_cache_key !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'set_answer_cache: invalid cache_key' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.answer_cache WHERE expires_at <= now();
  INSERT INTO public.answer_cache (cache_key, lang, answer, sources, data_version, created_at, expires_at)
  VALUES (p_cache_key, p_lang, p_answer, COALESCE(p_sources, '[]'::jsonb), p_data_version, now(), now() + make_interval(secs => GREATEST(60, p_ttl_seconds)))
  ON CONFLICT (cache_key) DO UPDATE SET lang = EXCLUDED.lang, answer = EXCLUDED.answer, sources = EXCLUDED.sources, data_version = EXCLUDED.data_version, created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at;
END; $$;
CREATE OR REPLACE FUNCTION public.bump_answer_cache_version(p_new_version text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.answer_cache_meta (id, data_version, updated_at) VALUES (1, p_new_version, now())
  ON CONFLICT (id) DO UPDATE SET data_version = EXCLUDED.data_version, updated_at = EXCLUDED.updated_at;
  DELETE FROM public.answer_cache WHERE data_version <> p_new_version;
END; $$;
REVOKE ALL ON FUNCTION public.get_answer_cache(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_answer_cache(text, text, text, jsonb, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_answer_cache_version(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_answer_cache(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_answer_cache(text, text, text, jsonb, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_answer_cache_version(text) TO service_role;
