-- 작성: 행사 제보 1단계(feat/event-crowd-report). 실행·확인: 이종헌 (Supabase SQL Editor, 11/26 밤). 확인 쿼리 ①②③ 정상
-- HUFS Quest: 앱 안 행사 제보(학생 제보 묶음) 테이블 · 함수
-- Supabase Dashboard > SQL Editor 에 전체 내용을 붙여넣고 Run 하세요. 기존 테이블 · 함수는 건드리지 않습니다.
--
-- 되돌리기 (이 파일이 만든 것만 지움):
--   drop function if exists public.submit_event_report(uuid, text, bigint, text, text, text, timestamptz, timestamptz, text, text, text, text, integer);
--   drop function if exists public.event_report_hit(uuid, text, integer, integer);
--   drop table if exists public.event_reports;
--   drop table if exists public.event_clusters;
--   drop table if exists public.event_report_usage;
--
-- 흐름 (api/event-report.js)
--   1. 서버가 입력을 검사(shared/eventReport.js)한 뒤 event_report_hit로 하루 횟수를 셉니다(AI를 부르기 전).
--   2. 같은 env · 시작일 ±1일(한국 시간) 묶음 최대 10개(hidden 아닌 묶음 먼저, 남는 자리에 hidden)를 후보로 읽고,
--      후보가 있으면 HCX-007이 같은 행사인지 고릅니다. hidden 묶음과 같은 행사면 서버가 아래 submit_event_report를 부르지 않습니다(저장 안 함, 재게시 방지).
--   3. submit_event_report가 제보 저장 + 서로 다른 user_id 수 다시 세기 + 기준 이상이면 collecting → published 를 한 번에 처리합니다.
--   4. api/events.js가 같은 env의 published · confirmed 묶음만 행사 창에 "학생 제보 N명" 으로 보여 줍니다.
--
-- 규칙
--   · RLS를 켜고 정책은 만들지 않습니다. 브라우저(anon · authenticated)는 테이블 · 함수 모두 쓸 수 없고, 서버(service_role)만 씁니다.
--   · 이메일은 저장하지 않습니다. 제보자는 user_id(auth.users 참조)로만 남고, 계정을 지우면 그 사람의 제보도 함께 지워집니다.
--     (지워진 뒤 묶음의 reporter_count는 그 묶음에 다음 제보가 들어올 때 다시 셉니다.)
--   · 대표 내용(event_clusters의 title 등)은 그 묶음 첫 제보의 원문 그대로입니다. 번역 · 요약하지 않습니다.
--   · env는 'preview' · 'production'으로 나눠, Preview에서 시험한 제보가 실서비스 행사 창에 섞이지 않게 합니다.
--   · 날짜는 한국 시간(Asia/Seoul) 자정 기준입니다(shared/progressRules.js kstToday와 같은 기준).
--
-- 팀이 하는 일 (Table Editor에서 event_clusters.status 를 바꿈)
--   · 'confirmed' : 팀이 원문을 확인함 → 행사 창 배지가 "팀 확인"으로 바뀜
--   · 'hidden'    : 숨김 → 행사 창에서 빠지고, 같은 행사 제보는 저장하지 않음(새 묶음으로 다시 공개되지 않게)

-- 묶음: 같은 행사로 판단된 제보 모음
CREATE TABLE IF NOT EXISTS public.event_clusters (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  env text NOT NULL CHECK (env IN ('preview', 'production')),
  status text NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting', 'published', 'confirmed', 'hidden')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 40),
  host text CHECK (host IS NULL OR char_length(host) BETWEEN 1 AND 30),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 150),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  place text NOT NULL CHECK (char_length(place) BETWEEN 1 AND 40),
  building_id text CHECK (building_id IS NULL OR building_id ~ '^[a-z0-9-]{1,40}$'),
  category text NOT NULL CHECK (category IN ('festival', 'briefing', 'lecture', 'recruit', 'other')),
  source_url text CHECK (source_url IS NULL OR (source_url LIKE 'https://%' AND char_length(source_url) <= 300)),
  reporter_count integer NOT NULL DEFAULT 0 CHECK (reporter_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CHECK (ends_at >= starts_at AND ends_at <= starts_at + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_event_clusters_env_status_starts
  ON public.event_clusters (env, status, starts_at);

-- 제보 한 건. 이메일 없음. 같은 사람은 같은 묶음에 한 번만(UNIQUE).
CREATE TABLE IF NOT EXISTS public.event_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cluster_id bigint NOT NULL REFERENCES public.event_clusters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  env text NOT NULL CHECK (env IN ('preview', 'production')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 40),
  host text CHECK (host IS NULL OR char_length(host) BETWEEN 1 AND 30),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 150),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  place text NOT NULL CHECK (char_length(place) BETWEEN 1 AND 40),
  building_id text CHECK (building_id IS NULL OR building_id ~ '^[a-z0-9-]{1,40}$'),
  category text NOT NULL CHECK (category IN ('festival', 'briefing', 'lecture', 'recruit', 'other')),
  source_url text CHECK (source_url IS NULL OR (source_url LIKE 'https://%' AND char_length(source_url) <= 300)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_reports_cluster_user_key UNIQUE (cluster_id, user_id),
  CHECK (ends_at >= starts_at AND ends_at <= starts_at + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_event_reports_user_created
  ON public.event_reports (user_id, created_at);

-- 하루 제보 시도 수(한국 날짜 · env · 계정별). 'duplicate'로 끝난 시도도 셉니다(AI 호출 수 상한).
-- 오늘 · 어제 행만 남기고 그보다 오래된 행은 event_report_hit 안에서 지웁니다.
CREATE TABLE IF NOT EXISTS public.event_report_usage (
  day date NOT NULL,
  env text NOT NULL CHECK (env IN ('preview', 'production')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  PRIMARY KEY (day, env, user_id)
);

-- RLS 활성화, 정책 없음 (service_role과 아래 SECURITY DEFINER 함수만 접근)
ALTER TABLE public.event_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_report_usage ENABLE ROW LEVEL SECURITY;

-- 브라우저 역할에 기본으로 붙는 테이블 권한도 회수 (RLS와 별개로 한 번 더 막음)
REVOKE ALL ON TABLE public.event_clusters FROM anon, authenticated;
REVOKE ALL ON TABLE public.event_reports FROM anon, authenticated;
REVOKE ALL ON TABLE public.event_report_usage FROM anon, authenticated;

-- 제보 시도 1번을 셉니다. 두 한도를 확인하고, 통과할 때만 +1 합니다(거절된 시도는 세지 않음).
--   p_user_limit   계정당 한국 날짜 하루 최대 시도 수(api/event-report.js EVENT_REPORT_DAILY_LIMIT = 3)
--   p_global_limit 같은 env 전체 한국 날짜 하루 최대 시도 수
-- 돌려주는 값: allowed, reason('global' · 'day', 허용이면 NULL), user_hits(이번 시도를 반영한 뒤의 계정 시도 수)
CREATE OR REPLACE FUNCTION public.event_report_hit(
  p_user_id uuid,
  p_env text,
  p_user_limit integer,
  p_global_limit integer
)
RETURNS TABLE (allowed boolean, reason text, user_hits integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_user integer := 0;
  v_global integer := 0;
BEGIN
  IF p_env IS NULL OR p_env NOT IN ('preview', 'production') THEN
    RAISE EXCEPTION 'invalid env' USING ERRCODE = '22023';
  END IF;

  -- 같은 env의 시도를 한 줄로 세워 동시에 들어온 요청이 한도를 함께 넘지 않게 합니다.
  PERFORM pg_advisory_xact_lock(hashtext('event_report_hit:' || p_env));

  DELETE FROM public.event_report_usage u WHERE u.day < v_today - 1;

  SELECT COALESCE(SUM(u.attempts), 0)::integer INTO v_global
  FROM public.event_report_usage u
  WHERE u.day = v_today AND u.env = p_env;

  SELECT COALESCE(MAX(u.attempts), 0)::integer INTO v_user
  FROM public.event_report_usage u
  WHERE u.day = v_today AND u.env = p_env AND u.user_id = p_user_id;

  IF v_global >= p_global_limit THEN
    RETURN QUERY SELECT false, 'global'::text, v_user;
    RETURN;
  END IF;

  IF v_user >= p_user_limit THEN
    RETURN QUERY SELECT false, 'day'::text, v_user;
    RETURN;
  END IF;

  INSERT INTO public.event_report_usage AS u (day, env, user_id, attempts)
  VALUES (v_today, p_env, p_user_id, 1)
  ON CONFLICT (day, env, user_id) DO UPDATE SET attempts = u.attempts + 1;

  RETURN QUERY SELECT true, NULL::text, v_user + 1;
END;
$$;

-- 제보 저장 + 서로 다른 user_id 수 다시 세기 + 기준 이상이면 collecting → published (한 트랜잭션)
--   p_cluster_id  HCX-007이 고른 기존 묶음 id. NULL이거나, 그 묶음이 없거나 · env가 다르거나 · hidden이면 새 묶음을 만듭니다.
--   p_threshold   공개 기준 인원(2 이상). api/event-report.js가 EVENT_REPORT_THRESHOLD(없으면 5)로 넘깁니다.
-- 돌려주는 값
--   result          'new'(새 묶음) · 'joined'(기존 묶음에 합류) · 'published'(이번 제보로 공개 기준을 넘음)
--                   · 'duplicate'(같은 사람이 이미 이 묶음에 제보함 → 저장하지 않음)
--   report_cluster  제보가 들어간(또는 duplicate면 이미 있는) 묶음 id
--   reporters       그 묶음의 서로 다른 제보자 수
--   cluster_status  그 묶음의 상태
CREATE OR REPLACE FUNCTION public.submit_event_report(
  p_user_id uuid,
  p_env text,
  p_cluster_id bigint,
  p_title text,
  p_host text,
  p_summary text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_place text,
  p_building_id text,
  p_category text,
  p_source_url text,
  p_threshold integer
)
RETURNS TABLE (result text, report_cluster bigint, reporters integer, cluster_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cluster bigint := NULL;
  v_prev_status text := NULL;
  v_status text;
  v_count integer;
  v_inserted integer := 0;
  v_new boolean := false;
BEGIN
  IF p_env IS NULL OR p_env NOT IN ('preview', 'production') THEN
    RAISE EXCEPTION 'invalid env' USING ERRCODE = '22023';
  END IF;
  IF p_threshold IS NULL OR p_threshold < 2 THEN
    RAISE EXCEPTION 'invalid threshold' USING ERRCODE = '22023';
  END IF;

  IF p_cluster_id IS NOT NULL THEN
    SELECT c.id, c.status INTO v_cluster, v_prev_status
    FROM public.event_clusters c
    WHERE c.id = p_cluster_id AND c.env = p_env AND c.status <> 'hidden'
    FOR UPDATE;
  END IF;

  IF v_cluster IS NULL THEN
    INSERT INTO public.event_clusters AS c
      (env, status, title, host, summary, starts_at, ends_at, place, building_id, category, source_url, reporter_count)
    VALUES
      (p_env, 'collecting', p_title, p_host, p_summary, p_starts_at, p_ends_at, p_place, p_building_id, p_category, p_source_url, 0)
    RETURNING c.id, c.status INTO v_cluster, v_prev_status;
    v_new := true;
  END IF;

  INSERT INTO public.event_reports
    (cluster_id, user_id, env, title, host, summary, starts_at, ends_at, place, building_id, category, source_url)
  VALUES
    (v_cluster, p_user_id, p_env, p_title, p_host, p_summary, p_starts_at, p_ends_at, p_place, p_building_id, p_category, p_source_url)
  ON CONFLICT ON CONSTRAINT event_reports_cluster_user_key DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    RETURN QUERY
      SELECT 'duplicate'::text, c.id, c.reporter_count, c.status
      FROM public.event_clusters c WHERE c.id = v_cluster;
    RETURN;
  END IF;

  SELECT count(DISTINCT r.user_id)::integer INTO v_count
  FROM public.event_reports r
  WHERE r.cluster_id = v_cluster;

  UPDATE public.event_clusters c
  SET reporter_count = v_count,
      status = CASE WHEN c.status = 'collecting' AND v_count >= p_threshold THEN 'published' ELSE c.status END,
      published_at = CASE WHEN c.status = 'collecting' AND v_count >= p_threshold THEN now() ELSE c.published_at END
  WHERE c.id = v_cluster
  RETURNING c.status INTO v_status;

  RETURN QUERY SELECT
    CASE
      WHEN v_prev_status = 'collecting' AND v_status = 'published' THEN 'published'
      WHEN v_new THEN 'new'
      ELSE 'joined'
    END::text,
    v_cluster,
    v_count,
    v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.event_report_hit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_report_hit(uuid, text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.submit_event_report(uuid, text, bigint, text, text, text, timestamptz, timestamptz, text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_event_report(uuid, text, bigint, text, text, text, timestamptz, timestamptz, text, text, text, text, integer) TO service_role;

-- ───────────── 실행 후 확인 쿼리 (주석을 풀어 하나씩 실행) ─────────────
--
-- ① RLS 켜짐 · 정책 0개 → relrowsecurity 셋 다 true, 정책 수 0
--   select relname, relrowsecurity from pg_class where relname in ('event_clusters', 'event_reports', 'event_report_usage');
--   select count(*) from pg_policies where tablename in ('event_clusters', 'event_reports', 'event_report_usage');
--
-- ② 함수 권한 → anon · authenticated는 false, service_role은 true
--   select r,
--          has_function_privilege(r, 'public.event_report_hit(uuid, text, integer, integer)', 'execute') as can_hit,
--          has_function_privilege(r, 'public.submit_event_report(uuid, text, bigint, text, text, text, timestamptz, timestamptz, text, text, text, text, integer)', 'execute') as can_submit
--   from unnest(array['anon', 'authenticated', 'service_role']) as r;
--
-- ③ 테이블 권한 → anon · authenticated는 셋 다 false (A 계정으로 B 계정 제보를 읽을 길이 없음)
--   select r, t, has_table_privilege(r, 'public.' || t, 'select') as can_select
--   from unnest(array['anon', 'authenticated']) as r, unnest(array['event_clusters', 'event_reports', 'event_report_usage']) as t;
--
-- ④ 팀 확인 · 숨김 (Table Editor 대신 SQL로 할 때)
--   update public.event_clusters set status = 'confirmed' where id = <묶음 id>;
--   update public.event_clusters set status = 'hidden' where id = <묶음 id>;
--
-- ⑤ 지금 공개 중인 묶음 보기(제보자 user_id는 보지 않음)
--   select id, env, status, reporter_count, title, starts_at, place, published_at
--   from public.event_clusters where status in ('published', 'confirmed') order by starts_at;
