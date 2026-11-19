-- 작성·실행: 임현규 (Supabase SQL Editor, 11/19). Hook 연결: Authentication → Hooks → Before User Created
-- 학교 메일(@hufs.ac.kr)이 아니면 계정을 만들지 않습니다. Supabase Auth의 "Before User Created" Hook에 연결합니다.
create or replace function public.hook_hufs_only(event jsonb)
returns jsonb
language plpgsql
as $$
begin
  if lower(coalesce(event->'user'->>'email', '')) !~ '@hufs\.ac\.kr$' then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 403, 'message', 'Only @hufs.ac.kr addresses can sign up.')
    );
  end if;
  return '{}'::jsonb;
end;
$$;

-- Auth 서버만 부를 수 있게 합니다(브라우저 anon 키로는 실행 불가).
grant execute on function public.hook_hufs_only(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_hufs_only(jsonb) from public, anon, authenticated;
