-- 작성 · 실행: 이종헌 (2026-11-18 밤, Supabase SQL Editor). 아래 확인 쿼리 결과:
--   ②분당 초과 · ③전체 초과 테스트 통과 / ④권한 확인 통과(anon · authenticated 실행 불가, service_role만 가능)
--   / RLS 확인(ask_usage_ip · ask_usage_global 둘 다 켜짐) / ⑤시험 행 정리 완료(IP 하루 9건, 전체 1행 · 9건 삭제).
-- HUFS Quest: 검색창(api/ask.js) 공용 사용량 카운터
-- 이유: api/ask.js의 1분 제한은 메모리 Map이라 Vercel 인스턴스마다 따로 셉니다. 모든 인스턴스가 같은 수를 보도록 DB에서 셉니다.
-- Supabase Dashboard > SQL Editor 에 전체 내용을 붙여넣고 Run 하세요. 기존 테이블 · 함수는 건드리지 않습니다.
--
-- 되돌리기 (이 파일이 만든 것만 지움):
--   drop function if exists public.ask_hit(text, integer, integer, integer);
--   drop table if exists public.ask_usage_ip;
--   drop table if exists public.ask_usage_global;
--
-- 규칙
--   · 원본 IP는 저장하지 않습니다. 서버가 비밀 소금(salt)을 섞은 SHA-256 해시(소문자 16진수 64자)만 보냅니다.
--     64자 16진수가 아니면 함수가 거절하므로, 실수로 원본 IP를 넘겨도 저장되지 않습니다.
--   · 날짜는 한국 시간(Asia/Seoul) 자정 기준입니다(shared/progressRules.js kstToday와 같은 기준).
--   · 거절된 요청은 세지 않습니다. 1분 제한에 걸린 사람이 계속 눌러도 전체 하루 수가 늘지 않게 하기 위해서입니다.
--   · 한국 날짜로 오늘 · 어제 행만 남기고, 그보다 오래된 행은 ask_hit 안에서 지웁니다.
--   · RLS를 켜고 정책은 만들지 않습니다. 브라우저(anon · authenticated)는 테이블과 함수 모두 쓸 수 없고,
--     서버(service_role)만 ask_hit를 부릅니다.

-- IP 해시별 카운트. period = 'minute'이면 bucket_start는 그 분의 시작 시각,
-- 'day'이면 그 한국 날짜의 자정(00:00 KST)입니다.
CREATE TABLE IF NOT EXISTS public.ask_usage_ip (
  ip_hash text NOT NULL CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  period text NOT NULL CHECK (period IN ('minute', 'day')),
  bucket_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0 CHECK (hits >= 0),
  PRIMARY KEY (ip_hash, period, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_ask_usage_ip_bucket_start
  ON public.ask_usage_ip (bucket_start);

-- 서비스 전체 하루 카운트. day는 한국 날짜.
CREATE TABLE IF NOT EXISTS public.ask_usage_global (
  day date PRIMARY KEY,
  hits integer NOT NULL DEFAULT 0 CHECK (hits >= 0)
);

-- RLS 활성화, 정책 없음 (service_role과 아래 SECURITY DEFINER 함수만 접근)
ALTER TABLE public.ask_usage_ip ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ask_usage_global ENABLE ROW LEVEL SECURITY;

-- 브라우저 역할에 기본으로 붙는 테이블 권한도 회수 (RLS와 별개로 한 번 더 막음)
REVOKE ALL ON TABLE public.ask_usage_ip FROM anon, authenticated;
REVOKE ALL ON TABLE public.ask_usage_global FROM anon, authenticated;

-- 검색창 요청 1번을 셉니다. 세 한도를 한 번에 확인하고, 모두 통과할 때만 세 카운트를 함께 +1 합니다.
--   p_ip_hash          서버가 만든 IP 해시(16진수 64자)
--   p_minute_limit     IP당 1분 최대 횟수
--   p_day_limit        IP당 한국 날짜 하루 최대 횟수
--   p_global_day_limit 서비스 전체 한국 날짜 하루 최대 횟수
-- 돌려주는 값
--   allowed       true면 AI를 불러도 됨
--   reason        거절 이유: 'global'(전체 하루) · 'day'(IP 하루) · 'minute'(IP 1분), 허용이면 NULL.
--                 여러 개에 걸리면 오래 기다려야 하는 것부터 알려 줍니다(global → day → minute).
--   retry_after   다시 시도할 수 있을 때까지 남은 초 (minute: 다음 분까지, day · global: 한국 시간 자정까지), 허용이면 0
--   minute_hits · day_hits · global_hits  이번 요청을 반영한 뒤의 카운트(거절이면 반영 전 값)
CREATE OR REPLACE FUNCTION public.ask_hit(
  p_ip_hash text,
  p_minute_limit integer,
  p_day_limit integer,
  p_global_day_limit integer
)
RETURNS TABLE (
  allowed boolean,
  reason text,
  retry_after integer,
  minute_hits integer,
  day_hits integer,
  global_hits integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := now();
  v_minute_start timestamptz := date_trunc('minute', v_now);
  v_kst_day date := (v_now AT TIME ZONE 'Asia/Seoul')::date;
  v_day_start timestamptz := (v_kst_day::timestamp) AT TIME ZONE 'Asia/Seoul';
  v_next_day_start timestamptz := ((v_kst_day + 1)::timestamp) AT TIME ZONE 'Asia/Seoul';
  v_minute_hits integer;
  v_day_hits integer;
  v_global_hits integer;
BEGIN
  IF p_ip_hash IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'ask_hit: ip hash must be 64 lowercase hex characters' USING ERRCODE = '22023';
  END IF;
  IF p_minute_limit IS NULL OR p_day_limit IS NULL OR p_global_day_limit IS NULL
     OR p_minute_limit < 0 OR p_day_limit < 0 OR p_global_day_limit < 0 THEN
    RAISE EXCEPTION 'ask_hit: limits must be 0 or more' USING ERRCODE = '22023';
  END IF;

  -- 오늘 · 어제(한국 날짜)보다 오래된 행 정리
  DELETE FROM public.ask_usage_ip WHERE bucket_start < v_day_start - interval '1 day';
  DELETE FROM public.ask_usage_global WHERE day < v_kst_day - 1;

  -- 이번 구간의 행이 없으면 0으로 만들고, 세 행을 항상 같은 순서(IP 분 → IP 하루 → 전체)로 잠급니다.
  -- 같은 순서로 잠그므로 동시에 여러 요청이 와도 서로 기다리다 멈추지(교착) 않고, 확인과 +1 사이에 끼어들 수 없습니다.
  INSERT INTO public.ask_usage_ip (ip_hash, period, bucket_start, hits)
  VALUES (p_ip_hash, 'minute', v_minute_start, 0), (p_ip_hash, 'day', v_day_start, 0)
  ON CONFLICT (ip_hash, period, bucket_start) DO NOTHING;
  INSERT INTO public.ask_usage_global (day, hits)
  VALUES (v_kst_day, 0)
  ON CONFLICT (day) DO NOTHING;

  SELECT u.hits INTO v_minute_hits FROM public.ask_usage_ip u
  WHERE u.ip_hash = p_ip_hash AND u.period = 'minute' AND u.bucket_start = v_minute_start
  FOR UPDATE;
  SELECT u.hits INTO v_day_hits FROM public.ask_usage_ip u
  WHERE u.ip_hash = p_ip_hash AND u.period = 'day' AND u.bucket_start = v_day_start
  FOR UPDATE;
  SELECT g.hits INTO v_global_hits FROM public.ask_usage_global g
  WHERE g.day = v_kst_day
  FOR UPDATE;

  IF v_global_hits >= p_global_day_limit THEN
    RETURN QUERY SELECT false, 'global'::text, ceil(extract(epoch FROM v_next_day_start - v_now))::integer,
      v_minute_hits, v_day_hits, v_global_hits;
    RETURN;
  END IF;
  IF v_day_hits >= p_day_limit THEN
    RETURN QUERY SELECT false, 'day'::text, ceil(extract(epoch FROM v_next_day_start - v_now))::integer,
      v_minute_hits, v_day_hits, v_global_hits;
    RETURN;
  END IF;
  IF v_minute_hits >= p_minute_limit THEN
    RETURN QUERY SELECT false, 'minute'::text, ceil(extract(epoch FROM v_minute_start + interval '1 minute' - v_now))::integer,
      v_minute_hits, v_day_hits, v_global_hits;
    RETURN;
  END IF;

  UPDATE public.ask_usage_ip u SET hits = u.hits + 1
  WHERE u.ip_hash = p_ip_hash AND u.period = 'minute' AND u.bucket_start = v_minute_start;
  UPDATE public.ask_usage_ip u SET hits = u.hits + 1
  WHERE u.ip_hash = p_ip_hash AND u.period = 'day' AND u.bucket_start = v_day_start;
  UPDATE public.ask_usage_global g SET hits = g.hits + 1
  WHERE g.day = v_kst_day;

  RETURN QUERY SELECT true, NULL::text, 0, v_minute_hits + 1, v_day_hits + 1, v_global_hits + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.ask_hit(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ask_hit(text, integer, integer, integer) TO service_role;

-- ───────────── 실행 후 확인 (SQL Editor에서 한 덩어리씩 따로 실행) ─────────────
-- 시험용 해시는 'a' · 'b' · 'c' 64개짜리 가짜 값입니다. 실제 IP 해시가 아닙니다.
--
-- ① 허용 → allowed = true, reason = NULL, 세 카운트 1씩 증가
--   select * from public.ask_hit(repeat('a', 64), 3, 100, 1000);
--
-- ② 분당 초과 (1분 한도 3으로 4번) → 1~3번 allowed = true, 4번 allowed = false, reason = 'minute'
--   select n, (public.ask_hit(repeat('b', 64), 3, 100, 1000)).* from generate_series(1, 4) n;
--
-- ③ 전체 초과 (전체 하루 한도를 지금 카운트와 같게) → allowed = false, reason = 'global', 카운트는 늘지 않음
--   select * from public.ask_hit(repeat('c', 64), 100, 100,
--     coalesce((select hits from public.ask_usage_global where day = (now() at time zone 'Asia/Seoul')::date), 0));
--
-- ④ 권한 · RLS → anon · authenticated는 false, service_role은 true / relrowsecurity 둘 다 true / 정책 0개
--   select r, has_function_privilege(r, 'public.ask_hit(text, integer, integer, integer)', 'execute') as can_call
--   from unnest(array['anon', 'authenticated', 'service_role']) as r;
--   select relname, relrowsecurity from pg_class where relname in ('ask_usage_ip', 'ask_usage_global');
--   select count(*) from pg_policies where tablename in ('ask_usage_ip', 'ask_usage_global');
--
-- ⑤ 시험 행 지우기. 날짜는 시험한 한국 날짜로 고정합니다(자정을 넘겨 실행해도 다른 날 행을 지우지 않게).
-- 전체 카운트 행은 시험 횟수(2026-11-18은 9)와 정확히 같을 때만 지웁니다. 실제 요청이 섞였으면 지우지 않고 0행으로 끝납니다.
--   with ip as (
--     delete from public.ask_usage_ip
--     where ip_hash in (repeat('a', 64), repeat('b', 64), repeat('c', 64))
--     returning period, hits
--   ), g as (
--     delete from public.ask_usage_global
--     where day = date '2026-11-18' and hits = 9
--     returning hits
--   )
--   select (select count(*) from ip) as ip_rows_deleted,
--          (select coalesce(sum(hits), 0) from ip where period = 'day') as ip_day_hits_deleted,
--          (select count(*) from g) as global_rows_deleted,
--          (select coalesce(sum(hits), 0) from g) as global_hits_deleted;
