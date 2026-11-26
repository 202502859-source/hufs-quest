-- Advanced RAG 2단계: 시험용 검색 데이터 메타데이터 확장
-- 작성일: 2026-11-26
-- 상태: 2026-11-26 16:35 Supabase SQL Editor에서 실행함 (실행: 임현규, #88 Merge 뒤). 다시 실행해도 IF NOT EXISTS라 바뀌는 것 없음.
--       확인 조회 결과: chunks_next 14칸(기존 7 + 아래 7칸, 모두 nullable)
--
-- 되돌리기:
--   ALTER TABLE public.chunks_next DROP COLUMN IF EXISTS parent_id, DROP COLUMN IF EXISTS topic, DROP COLUMN IF EXISTS subtopic,
--     DROP COLUMN IF EXISTS campus, DROP COLUMN IF EXISTS cohort_min, DROP COLUMN IF EXISTS cohort_max, DROP COLUMN IF EXISTS split_label;
--
-- 실서비스 public.chunks는 변경하지 않습니다.
-- 기존 match_chunks / match_chunks_next 함수는 변경하지 않습니다.
-- 기존 데이터 삭제 및 권한 변경은 하지 않습니다.

BEGIN;

ALTER TABLE public.chunks_next
  ADD COLUMN IF NOT EXISTS parent_id text,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS subtopic text,
  ADD COLUMN IF NOT EXISTS campus text,
  ADD COLUMN IF NOT EXISTS cohort_min integer,
  ADD COLUMN IF NOT EXISTS cohort_max integer,
  ADD COLUMN IF NOT EXISTS split_label text;

COMMIT;

-- 실행 후 확인용 조회문
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'chunks_next'
-- ORDER BY ordinal_position;
