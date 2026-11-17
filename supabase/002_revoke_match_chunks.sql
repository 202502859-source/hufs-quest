-- 2026-11-18 Supabase SQL Editor에서 실행함 (실행: 이종헌). 아래는 실행한 원문 그대로입니다.
-- 이유: anon 키가 브라우저에 공개되므로 검색 함수를 브라우저에서 직접 부르지 못하게 막음.
-- api/ask.js는 서버 비밀 키(service_role)를 쓰므로 영향 없음.
-- 되돌리기: grant execute on function public.match_chunks(vector, integer, double precision) to anon, authenticated;

revoke execute on function public.match_chunks(vector, integer, double precision) from public, anon, authenticated;
grant execute on function public.match_chunks(vector, integer, double precision) to service_role;
