-- 2026-11-20 Supabase SQL Editor에서 실행함 (실행: 이종헌). 이 파일은 실행한 내용의 기록입니다. 다시 실행하지 마세요.
-- 목적: 문서 확대(사이트맵 48개 추가 · 수집 정리 규칙) 결과를 실서비스 chunks와 섞지 않고 넣어 보는 시험용 DB.
--       scripts/ingest.mjs --target next 로 chunks_next에 저장하고, 11/21 eval로 chunks와 비교한 뒤 실서비스 전환 여부를 정합니다.
--       api/ask.js는 계속 match_chunks(chunks)만 부릅니다.
-- 권한: 002와 같이 브라우저(anon · authenticated)에서 검색 함수를 직접 부르지 못하게 막고 service_role만 허용.
-- 되돌리기:
--   drop function public.match_chunks_next(vector, integer, double precision);
--   drop table public.chunks_next;

create table public.chunks_next (like public.chunks including all);

alter table public.chunks_next enable row level security;

CREATE OR REPLACE FUNCTION public.match_chunks_next(query_embedding vector, match_count integer DEFAULT 5, min_similarity double precision DEFAULT 0.5)
 RETURNS TABLE(id text, title text, url text, section text, text text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  select c.id, c.title, c.url, c.section, c.text,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks_next c
  where 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$function$;

revoke execute on function public.match_chunks_next(vector, integer, double precision) from public, anon, authenticated;
grant execute on function public.match_chunks_next(vector, integer, double precision) to service_role;

-- 참고: 실서비스 검색 함수 match_chunks 원본 정의 (대시보드에서 복사, 저장소에 처음 기록). 실행하지 않음.
-- CREATE OR REPLACE FUNCTION public.match_chunks(query_embedding vector, match_count integer DEFAULT 5, min_similarity double precision DEFAULT 0.5)
--  RETURNS TABLE(id text, title text, url text, section text, text text, similarity double precision)
--  LANGUAGE sql
--  STABLE
-- AS $function$
--   select c.id, c.title, c.url, c.section, c.text,
--          1 - (c.embedding <=> query_embedding) as similarity
--   from chunks c
--   where 1 - (c.embedding <=> query_embedding) >= min_similarity
--   order by c.embedding <=> query_embedding
--   limit match_count;
-- $function$
