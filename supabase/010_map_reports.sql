-- 작성: 게임 안 지도 신고(feat/map-report-ingame). 실행 전 — 실행한 사람 · 날짜 · 확인 결과를 이 줄에 적어 주세요.
-- HUFS Quest: "실제와 달라요(신고)"를 게임 안 창으로 받는 테이블 · 함수, 반영되면 경험치 20 + 게임 안 알림
-- 먼저 001 · 008 · 009가 실행되어 있어야 합니다(009의 event_reward_notices · take_event_reward_notices를 지도 신고도 쓰게 넓힘).
-- Supabase Dashboard > SQL Editor 에 전체 내용을 붙여넣고 Run 하세요.
--
-- 되돌리기 (이 파일이 만든 것만 지움. 이미 지급한 경험치 · reward_log는 그대로 남음):
--   drop trigger if exists map_reports_accept_reward on public.map_reports;
--   drop trigger if exists map_reports_decided_at on public.map_reports;
--   drop function if exists public.reward_map_reporter();
--   drop function if exists public.set_map_report_decided_at();
--   drop function if exists public.submit_map_report(uuid, text, text, text, text, text, integer, integer);
--   delete from public.event_reward_notices where kind = 'map';
--   alter table public.event_reward_notices drop constraint if exists event_reward_notices_target_check;
--   alter table public.event_reward_notices drop constraint if exists event_reward_notices_user_map_key;
--   alter table public.event_reward_notices drop column if exists map_report_id;
--   alter table public.event_reward_notices drop column if exists kind;
--   alter table public.event_reward_notices alter column cluster_id set not null;
--   drop function if exists public.take_event_reward_notices(uuid);  -- 그다음 009의 take_event_reward_notices 부분만 다시 실행
--   drop table if exists public.map_report_usage;
--   drop table if exists public.map_reports;
--
-- 팀이 하는 일 (Table Editor에서 map_reports.status를 바꿈)
--   · 'open'     : 새 신고(기본값). 팀이 내용을 확인합니다.
--   · 'accepted' : 신고가 맞아 지도 · 건물 정보를 고침 → **고치는 PR을 merge한 뒤에** accepted로 바꿉니다.
--                  바꾸는 순간 트리거가 신고한 학생에게 경험치 20 + 알림("신고한 지도 정보가 고쳐져서 경험치가 올랐어요")을 줍니다.
--   · 'rejected' : 사실이 아니거나 고칠 수 없음 → 지급 없음.
--   · decided_at은 open에서 다른 상태로 바뀔 때 자동으로 적힙니다. accepted 뒤 다시 바꿔도 지급한 경험치는 회수하지 않습니다.
--
-- 규칙
--   · 신고마다 1번 지급(reward_log UNIQUE(user_id, source, ref_id), source 'map-report', ref_id 신고 id). 서로 다른 신고는 제한 없음.
--   · 한 사람 한국 날짜 하루 5건, env 전체 하루 300건(submit_map_report 안에서 셈, 008 event_report_usage와 같은 방식).
--   · 이메일 · 전화번호는 저장하지 않습니다(설명은 서버가 연락처 · 카카오 링크를 거른 뒤 저장, shared/mapReport.js).
--   · RLS를 켜고 정책은 만들지 않습니다. 브라우저(anon · authenticated)는 테이블 · 함수 모두 쓸 수 없고, 서버(service_role)만 씁니다.

-- 지도 신고
CREATE TABLE IF NOT EXISTS public.map_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  env text NOT NULL CHECK (env IN ('preview', 'production')),
  building_id text NOT NULL CHECK (building_id ~ '^[a-z0-9-]{1,40}$'),
  kind text NOT NULL CHECK (kind IN ('location', 'name', 'hours', 'phone', 'does', 'other')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 200),
  source_url text CHECK (source_url IS NULL OR (source_url LIKE 'https://%' AND char_length(source_url) <= 300)),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_map_reports_env_status_created
  ON public.map_reports (env, status, created_at);

-- 하루 신고 수(한국 날짜 · env · 계정별). 오늘 · 어제 행만 남깁니다.
CREATE TABLE IF NOT EXISTS public.map_report_usage (
  day date NOT NULL,
  env text NOT NULL CHECK (env IN ('preview', 'production')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  PRIMARY KEY (day, env, user_id)
);

ALTER TABLE public.map_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_report_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.map_reports FROM anon, authenticated;
REVOKE ALL ON TABLE public.map_report_usage FROM anon, authenticated;

-- 신고 1건: 하루 한도 확인 + 저장을 한 번에 (api/map-report.js, service_role 전용)
-- 돌려주는 값: result 'ok'(저장) · 'limited'(한도), reason 'day' · 'global'(limited일 때)
CREATE OR REPLACE FUNCTION public.submit_map_report(
  p_user_id uuid,
  p_env text,
  p_building_id text,
  p_kind text,
  p_description text,
  p_source_url text,
  p_user_limit integer,
  p_global_limit integer
)
RETURNS TABLE (result text, reason text)
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

  -- 같은 env의 신고를 한 줄로 세워 동시에 들어온 요청이 한도를 함께 넘지 않게 합니다.
  PERFORM pg_advisory_xact_lock(hashtext('map_report_hit:' || p_env));

  DELETE FROM public.map_report_usage u WHERE u.day < v_today - 1;

  SELECT COALESCE(SUM(u.attempts), 0)::integer INTO v_global
  FROM public.map_report_usage u
  WHERE u.day = v_today AND u.env = p_env;

  SELECT COALESCE(MAX(u.attempts), 0)::integer INTO v_user
  FROM public.map_report_usage u
  WHERE u.day = v_today AND u.env = p_env AND u.user_id = p_user_id;

  IF v_global >= p_global_limit THEN
    RETURN QUERY SELECT 'limited'::text, 'global'::text;
    RETURN;
  END IF;
  IF v_user >= p_user_limit THEN
    RETURN QUERY SELECT 'limited'::text, 'day'::text;
    RETURN;
  END IF;

  INSERT INTO public.map_reports (user_id, env, building_id, kind, description, source_url)
  VALUES (p_user_id, p_env, p_building_id, p_kind, p_description, p_source_url);

  INSERT INTO public.map_report_usage AS u (day, env, user_id, attempts)
  VALUES (v_today, p_env, p_user_id, 1)
  ON CONFLICT (day, env, user_id) DO UPDATE SET attempts = u.attempts + 1;

  RETURN QUERY SELECT 'ok'::text, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_map_report(uuid, text, text, text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_map_report(uuid, text, text, text, text, text, integer, integer) TO service_role;

-- open → accepted · rejected로 바뀔 때 decided_at 자동 기록
CREATE OR REPLACE FUNCTION public.set_map_report_decided_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'open' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.decided_at := now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_map_report_decided_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS map_reports_decided_at ON public.map_reports;
CREATE TRIGGER map_reports_decided_at
  BEFORE UPDATE OF status ON public.map_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_map_report_decided_at();

-- ───── 009 알림 표를 지도 신고도 쓰게 넓히기 (이미 있는 행사 알림 행 · 009 트리거는 그대로 동작) ─────
-- kind: 'event'(행사 제보, 기존 행은 모두 이 값) · 'map'(지도 신고). 행사 알림은 cluster_id, 지도 알림은 map_report_id만 채웁니다.
ALTER TABLE public.event_reward_notices ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'event';
ALTER TABLE public.event_reward_notices ADD COLUMN IF NOT EXISTS map_report_id bigint REFERENCES public.map_reports(id) ON DELETE CASCADE;
ALTER TABLE public.event_reward_notices ALTER COLUMN cluster_id DROP NOT NULL;

ALTER TABLE public.event_reward_notices DROP CONSTRAINT IF EXISTS event_reward_notices_target_check;
ALTER TABLE public.event_reward_notices ADD CONSTRAINT event_reward_notices_target_check CHECK (
  (kind = 'event' AND cluster_id IS NOT NULL AND map_report_id IS NULL)
  OR (kind = 'map' AND map_report_id IS NOT NULL AND cluster_id IS NULL)
);

ALTER TABLE public.event_reward_notices DROP CONSTRAINT IF EXISTS event_reward_notices_user_map_key;
ALTER TABLE public.event_reward_notices ADD CONSTRAINT event_reward_notices_user_map_key UNIQUE (user_id, map_report_id);

-- 알림 가져가기: 종류(kind)도 돌려줍니다. 돌려주는 칼럼이 바뀌어 지우고 다시 만듭니다(지금 배포된 서버는 exp만 읽으므로 그대로 동작).
DROP FUNCTION IF EXISTS public.take_event_reward_notices(uuid);
CREATE FUNCTION public.take_event_reward_notices(p_user_id uuid)
RETURNS TABLE (exp integer, kind text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.event_reward_notices n
  SET seen_at = now()
  WHERE n.user_id = p_user_id AND n.seen_at IS NULL
  RETURNING n.exp, n.kind;
$$;

REVOKE ALL ON FUNCTION public.take_event_reward_notices(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_event_reward_notices(uuid) TO service_role;

-- accepted가 되면 신고한 학생에게 경험치 + 알림 (트리거 함수)
CREATE OR REPLACE FUNCTION public.reward_map_reporter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_exp constant integer := 20; -- shared/progressRules.js MAP_REPORT_REWARD_EXP
  v_inserted integer;
BEGIN
  INSERT INTO public.profiles (user_id, email)
  SELECT u.id, COALESCE(u.email, '')
  FROM auth.users u
  WHERE u.id = NEW.user_id
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.reward_log (user_id, source, ref_id, exp, points)
  VALUES (NEW.user_id, 'map-report', NEW.id::text, v_exp, 0)
  ON CONFLICT (user_id, source, ref_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted > 0 THEN
    UPDATE public.profiles
    SET total_exp = total_exp + v_exp,
        updated_at = now()
    WHERE user_id = NEW.user_id;

    INSERT INTO public.event_reward_notices (user_id, kind, map_report_id, exp)
    VALUES (NEW.user_id, 'map', NEW.id, v_exp)
    ON CONFLICT ON CONSTRAINT event_reward_notices_user_map_key DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reward_map_reporter() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS map_reports_accept_reward ON public.map_reports;
CREATE TRIGGER map_reports_accept_reward
  AFTER UPDATE OF status ON public.map_reports
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted')
  EXECUTE FUNCTION public.reward_map_reporter();

-- ───────────── 실행 후 확인 쿼리 (주석을 풀어 하나씩 실행) ─────────────
--
-- ① RLS 켜짐 · 정책 0개 → relrowsecurity 둘 다 true, 정책 수 0
--   select relname, relrowsecurity from pg_class where relname in ('map_reports', 'map_report_usage');
--   select count(*) from pg_policies where tablename in ('map_reports', 'map_report_usage', 'event_reward_notices');
--
-- ② 권한 → anon · authenticated는 false, service_role은 true / 테이블 select는 anon · authenticated false
--   select r,
--          has_function_privilege(r, 'public.submit_map_report(uuid, text, text, text, text, text, integer, integer)', 'execute') as can_submit,
--          has_function_privilege(r, 'public.take_event_reward_notices(uuid)', 'execute') as can_take
--   from unnest(array['anon', 'authenticated', 'service_role']) as r;
--   select r, t, has_table_privilege(r, 'public.' || t, 'select') as can_select
--   from unnest(array['anon', 'authenticated']) as r, unnest(array['map_reports', 'map_report_usage']) as t;
--
-- ③ 트리거 2개 · 알림 표 넓힘 확인 → 트리거 2행, 기존 행사 알림은 모두 kind = 'event'
--   select tgname from pg_trigger where tgname in ('map_reports_accept_reward', 'map_reports_decided_at');
--   select kind, count(*) from public.event_reward_notices group by kind;
--
-- ④ Preview 시험(<신고 id>는 Preview에서 넣은 신고)
--   update public.map_reports set status = 'accepted' where id = <신고 id> and env = 'preview';
--   select status, decided_at from public.map_reports where id = <신고 id>;
--   select source, ref_id, exp from public.reward_log where source = 'map-report' and ref_id = '<신고 id>';
--   select kind, exp, seen_at from public.event_reward_notices where map_report_id = <신고 id>;
--   -- rejected → accepted로 다시 바꿔도 reward_log 행 수가 늘지 않아야 합니다.
