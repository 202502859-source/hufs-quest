-- 작성: 행사 제보 보상(feat/event-report-reward). 실행 전 — 실행한 사람 · 날짜 · 확인 결과를 이 줄에 적어 주세요.
-- HUFS Quest: 행사 제보가 팀 확인(confirmed)되면 제보자에게 경험치 + 게임 안 알림
-- 먼저 001_progress_schema.sql · 008_event_reports.sql이 실행되어 있어야 합니다.
-- Supabase Dashboard > SQL Editor 에 전체 내용을 붙여넣고 Run 하세요. 기존 테이블 · 함수는 건드리지 않습니다.
--
-- 되돌리기 (이 파일이 만든 것만 지움. 이미 지급한 경험치 · reward_log는 그대로 남음):
--   drop trigger if exists event_clusters_confirm_reward on public.event_clusters;
--   drop function if exists public.reward_event_reporters();
--   drop function if exists public.take_event_reward_notices(uuid);
--   drop table if exists public.event_reward_notices;
--
-- 규칙 (PM 결정: 이종헌, 11/26)
--   · 팀이 Table Editor에서 event_clusters.status를 'confirmed'로 바꾸는 순간 트리거가 지급합니다(서버 API를 거치지 않음).
--   · 받는 사람: 그 묶음이 공개(published_at)되기 전에 제보한 학생. 공개된 뒤 목록을 보고 같은 행사를 제보해 합류한 사람은
--     받지 않습니다(이미 보이는 행사를 베껴 경험치를 모으는 것 방지). 공개 없이 바로 confirmed면 그때까지의 제보자 모두.
--   · 행사(묶음)마다 한 사람 1번, 경험치 20(shared/progressRules.js EVENT_REPORT_REWARD_EXP와 같게). 하루 상한 없음.
--     reward_log의 UNIQUE(user_id, source, ref_id)로 confirmed를 여러 번 바꿔도 한 번만 지급합니다.
--   · hidden은 지급하지 않습니다. confirmed 뒤 hidden으로 바꿔도 이미 지급한 경험치는 되돌리지 않습니다.
--   · 지급할 때 event_reward_notices에 알림 한 줄을 남기고, 게임(api/reward-notices.js)이 접속 중이면 바로,
--     아니면 다음 접속 때 가져가 "제보한 행사가 확인되어 경험치가 올랐어요"를 띄웁니다.
--   · RLS를 켜고 정책은 만들지 않습니다. 브라우저(anon · authenticated)는 테이블 · 함수 모두 쓸 수 없습니다.

-- 게임 안 알림(아직 안 보여 준 것 = seen_at NULL)
CREATE TABLE IF NOT EXISTS public.event_reward_notices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cluster_id bigint NOT NULL REFERENCES public.event_clusters(id) ON DELETE CASCADE,
  exp integer NOT NULL CHECK (exp > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz,
  CONSTRAINT event_reward_notices_user_cluster_key UNIQUE (user_id, cluster_id)
);

CREATE INDEX IF NOT EXISTS idx_event_reward_notices_unseen
  ON public.event_reward_notices (user_id)
  WHERE seen_at IS NULL;

ALTER TABLE public.event_reward_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_reward_notices FROM anon, authenticated;

-- confirmed가 되면 공개 전 제보자에게 경험치 + 알림 (트리거 함수)
CREATE OR REPLACE FUNCTION public.reward_event_reporters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_exp constant integer := 20; -- shared/progressRules.js EVENT_REPORT_REWARD_EXP
  v_user uuid;
  v_inserted integer;
BEGIN
  FOR v_user IN
    SELECT DISTINCT r.user_id
    FROM public.event_reports r
    WHERE r.cluster_id = NEW.id
      AND (NEW.published_at IS NULL OR r.created_at <= NEW.published_at)
  LOOP
    -- 진행 기록이 아직 없는 학생이면 프로필을 만듭니다(001과 같은 방식, 이메일은 auth.users 값).
    INSERT INTO public.profiles (user_id, email)
    SELECT u.id, COALESCE(u.email, '')
    FROM auth.users u
    WHERE u.id = v_user
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.reward_log (user_id, source, ref_id, exp, points)
    VALUES (v_user, 'event-report', NEW.id::text, v_exp, 0)
    ON CONFLICT (user_id, source, ref_id) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    IF v_inserted > 0 THEN
      UPDATE public.profiles
      SET total_exp = total_exp + v_exp,
          updated_at = now()
      WHERE user_id = v_user;

      INSERT INTO public.event_reward_notices (user_id, cluster_id, exp)
      VALUES (v_user, NEW.id, v_exp)
      ON CONFLICT ON CONSTRAINT event_reward_notices_user_cluster_key DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reward_event_reporters() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_clusters_confirm_reward ON public.event_clusters;
CREATE TRIGGER event_clusters_confirm_reward
  AFTER UPDATE OF status ON public.event_clusters
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed')
  EXECUTE FUNCTION public.reward_event_reporters();

-- 아직 안 보여 준 알림을 가져가면서 본 것으로 표시합니다(api/reward-notices.js, service_role 전용).
-- 돌려주는 값: 알림마다 exp 한 줄. 서버가 건수 · 합계만 화면에 보냅니다(행사 id · 제목은 보내지 않음).
CREATE OR REPLACE FUNCTION public.take_event_reward_notices(p_user_id uuid)
RETURNS TABLE (exp integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.event_reward_notices n
  SET seen_at = now()
  WHERE n.user_id = p_user_id AND n.seen_at IS NULL
  RETURNING n.exp;
$$;

REVOKE ALL ON FUNCTION public.take_event_reward_notices(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_event_reward_notices(uuid) TO service_role;

-- ───────────── 실행 후 확인 쿼리 (주석을 풀어 하나씩 실행) ─────────────
--
-- ① RLS 켜짐 · 정책 0개 → relrowsecurity true, 정책 수 0
--   select relname, relrowsecurity from pg_class where relname = 'event_reward_notices';
--   select count(*) from pg_policies where tablename = 'event_reward_notices';
--
-- ② 권한 → anon · authenticated는 false, service_role은 true / 테이블 select는 anon · authenticated false
--   select r, has_function_privilege(r, 'public.take_event_reward_notices(uuid)', 'execute') as can_take
--   from unnest(array['anon', 'authenticated', 'service_role']) as r;
--   select r, has_table_privilege(r, 'public.event_reward_notices', 'select') as can_select
--   from unnest(array['anon', 'authenticated']) as r;
--
-- ③ 트리거 등록 확인 → 1행
--   select tgname from pg_trigger where tgname = 'event_clusters_confirm_reward';
--
-- ④ Preview 시험 묶음으로 지급 확인(<묶음 id>는 Preview에서 2명이 제보해 published된 묶음)
--   update public.event_clusters set status = 'confirmed' where id = <묶음 id> and env = 'preview';
--   select source, ref_id, exp, created_at from public.reward_log where source = 'event-report' and ref_id = '<묶음 id>';
--   select exp, seen_at from public.event_reward_notices where cluster_id = <묶음 id>;
--   -- 다시 confirmed로 바꿔도(hidden → confirmed) reward_log 행 수가 늘지 않아야 합니다.
