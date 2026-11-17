-- 2026-11-17 Supabase SQL Editor에서 실행함 (실행: 이종헌). 아래는 실행한 원문 그대로입니다.
-- HUFS Quest: 로그인 · 진행 저장 DB 스키마 및 RLS, 원자적 보상 처리 함수
-- Supabase Dashboard > SQL Editor 에 전체 내용을 붙여넣고 Run 하세요.

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  total_exp integer NOT NULL DEFAULT 0 CHECK (total_exp >= 0),
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  correct boolean NOT NULL,
  rewarded boolean NOT NULL DEFAULT false,
  answered_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz,
  PRIMARY KEY (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_log_user_rewarded_at
  ON public.quiz_log (user_id, rewarded_at);

CREATE TABLE IF NOT EXISTS public.quest_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_id text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quest_id)
);

CREATE TABLE IF NOT EXISTS public.reward_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,
  ref_id text NOT NULL,
  exp integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, ref_id)
);

-- RLS 활성화 (브라우저는 본인 데이터 조회만 가능, 쓰기는 서버 service_role 전용)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "quiz_log_select_own" ON public.quiz_log;
CREATE POLICY "quiz_log_select_own" ON public.quiz_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "quest_log_select_own" ON public.quest_log;
CREATE POLICY "quest_log_select_own" ON public.quest_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reward_log_select_own" ON public.reward_log;
CREATE POLICY "reward_log_select_own" ON public.reward_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 퀴즈 답안 기록 및 경험치 지급 (한국 시간 자정 기준 일일 상한 검증 + 트랜잭션 보장)
CREATE OR REPLACE FUNCTION public.record_quiz_answer(
  p_user_id uuid,
  p_email text,
  p_question_id text,
  p_correct boolean,
  p_reward_exp integer,
  p_daily_cap integer
)
RETURNS TABLE (result text, gained_exp integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_kst_today date := (v_now AT TIME ZONE 'Asia/Seoul')::date;
  v_already_rewarded boolean := false;
  v_today_exp integer := 0;
  v_inserted_reward integer := 0;
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (p_user_id, p_email)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM 1 FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;

  SELECT ql.rewarded INTO v_already_rewarded
  FROM public.quiz_log ql
  WHERE ql.user_id = p_user_id AND ql.question_id = p_question_id;

  IF NOT FOUND THEN
    INSERT INTO public.quiz_log (user_id, question_id, correct, rewarded, answered_at, rewarded_at)
    VALUES (p_user_id, p_question_id, p_correct, false, v_now, NULL);
    v_already_rewarded := false;
  ELSE
    IF p_correct THEN
      UPDATE public.quiz_log
      SET correct = true
      WHERE user_id = p_user_id AND question_id = p_question_id;
    END IF;
  END IF;

  IF NOT p_correct THEN
    RETURN QUERY SELECT 'wrong'::text, 0;
    RETURN;
  END IF;

  IF v_already_rewarded THEN
    RETURN QUERY SELECT 'already'::text, 0;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(rl.exp), 0)::integer INTO v_today_exp
  FROM public.reward_log rl
  WHERE rl.user_id = p_user_id
    AND rl.source = 'quiz'
    AND (rl.created_at AT TIME ZONE 'Asia/Seoul')::date = v_kst_today;

  IF v_today_exp + p_reward_exp > p_daily_cap THEN
    RETURN QUERY SELECT 'cap'::text, 0;
    RETURN;
  END IF;

  INSERT INTO public.reward_log (user_id, source, ref_id, exp, points, created_at)
  VALUES (p_user_id, 'quiz', p_question_id, p_reward_exp, 0, v_now)
  ON CONFLICT (user_id, source, ref_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_reward = ROW_COUNT;

  IF v_inserted_reward = 0 THEN
    RETURN QUERY SELECT 'already'::text, 0;
    RETURN;
  END IF;

  UPDATE public.quiz_log
  SET rewarded = true, rewarded_at = v_now
  WHERE user_id = p_user_id AND question_id = p_question_id;

  UPDATE public.profiles
  SET total_exp = total_exp + p_reward_exp,
      updated_at = v_now
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT 'ok'::text, p_reward_exp;
END;
$$;

-- 퀘스트 완료 기록 및 경험치·포인트 지급
CREATE OR REPLACE FUNCTION public.complete_quest(
  p_user_id uuid,
  p_email text,
  p_quest_id text,
  p_reward_exp integer,
  p_reward_points integer
)
RETURNS TABLE (result text, gained_exp integer, gained_points integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_inserted integer := 0;
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (p_user_id, p_email)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM 1 FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;

  INSERT INTO public.quest_log (user_id, quest_id, completed_at)
  VALUES (p_user_id, p_quest_id, v_now)
  ON CONFLICT (user_id, quest_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    RETURN QUERY SELECT 'already'::text, 0, 0;
    RETURN;
  END IF;

  INSERT INTO public.reward_log (user_id, source, ref_id, exp, points, created_at)
  VALUES (p_user_id, 'quest', p_quest_id, p_reward_exp, p_reward_points, v_now)
  ON CONFLICT (user_id, source, ref_id) DO NOTHING;

  UPDATE public.profiles
  SET total_exp = total_exp + p_reward_exp,
      points = points + p_reward_points,
      updated_at = v_now
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT 'ok'::text, p_reward_exp, p_reward_points;
END;
$$;

-- 하루 첫 접속(출석) 포인트 지급 (한국 시간 날짜 기준 1일 1회)
CREATE OR REPLACE FUNCTION public.daily_check_in(
  p_user_id uuid,
  p_email text,
  p_reward_points integer
)
RETURNS TABLE (result text, gained_points integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_kst_date text := to_char(v_now AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD');
  v_inserted integer := 0;
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (p_user_id, p_email)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM 1 FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;

  INSERT INTO public.reward_log (user_id, source, ref_id, exp, points, created_at)
  VALUES (p_user_id, 'check-in', v_kst_date, 0, p_reward_points, v_now)
  ON CONFLICT (user_id, source, ref_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    RETURN QUERY SELECT 'already'::text, 0;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET points = points + p_reward_points,
      updated_at = v_now
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT 'ok'::text, p_reward_points;
END;
$$;

REVOKE ALL ON FUNCTION public.record_quiz_answer(uuid, text, text, boolean, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_quiz_answer(uuid, text, text, boolean, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.complete_quest(uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_quest(uuid, text, text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.daily_check_in(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_check_in(uuid, text, integer) TO service_role;