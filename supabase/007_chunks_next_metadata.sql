-- Advanced RAG 2단계: 시험용 검색 데이터 메타데이터 확장
-- 작성일: 2026-11-26
-- 상태: 검토용 초안 / 아직 실행하지 않음
-- 팀 검토 및 승인 이후 Supabase SQL Editor에서 실행합니다.
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
