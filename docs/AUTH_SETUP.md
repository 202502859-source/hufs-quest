# 🔐 학교 이메일 로그인 설정 체크리스트 (Supabase · Vercel)

> 화면 코드(`src/data/auth.js`)는 이미 들어가 있습니다. **진짜 메일을 보내려면 아래 설정을 대시보드에서 직접 해야 합니다.**
> 공개 저장소이므로 이 문서와 PR에 **실제 학번 · 메일 주소 · 키 값을 적지 않습니다.**
> 기준 문서: [PROGRESS_API.md](PROGRESS_API.md) 3장(로그인) · 8장(결정 사항)

## 0. 모드 한눈에 보기

| 변수 | 값 | 뜻 |
| --- | --- | --- |
| `VITE_AUTH_MODE` | `mock`(기본) | 메일을 보내지 않고 6자리 코드를 화면 왼쪽 아래와 콘솔에 보여 줌 (개발용) |
| | `real` | Supabase Auth로 학교 메일에 진짜 6자리 코드를 보냄 |
| `VITE_PROGRESS_MODE` | `mock`(기본) | 진행 저장을 브라우저 메모리에서 흉내 냄 (새로고침하면 초기화) |
| | `real` | 서버 `api/progress` 등에 저장 (**서버 함수가 생기기 전에는 쓰지 않음**) |

두 값은 따로 고르고, 둘 다 기본값은 `mock`입니다.

| 로그인(행) · 진행 저장(열) | 진행 `mock` | 진행 `real` |
| --- | --- | --- |
| 로그인 `mock` | 기본. 메일 없이 끝까지 시험 | ⚠️ 진짜 토큰이 없어 **콘솔에 경고하고 진행 저장도 mock으로 동작** |
| 로그인 `real` | **로그인만 먼저 시험** (서버 진행 API가 생기기 전) | 최종 형태 (서버 진행 API 완성 후) |

- 가짜 모드에서 만료를 빨리 보려면 주소 끝에 `?mockotp=fast` (코드가 20초 뒤 만료)

## 1. 사전 확인: RLS (완료 · 2026-11-18)

브라우저에 Publishable(anon) 키가 공개되므로, 모든 public 테이블의 RLS가 켜져 있어야 합니다.
- 결과: 모든 public 테이블 RLS 켜짐. `chunks` · `reviews`는 정책 없음, 진행 저장 테이블 4개는 `select_own`만. 보상 함수 3개는 anon 실행 불가. `match_chunks`는 anon · authenticated 실행 권한 회수(`supabase/002_revoke_match_chunks.sql`)
- **새 테이블이나 함수를 만들 때마다** RLS와 실행 권한을 다시 확인합니다(`CLAUDE.md` 규칙).

## 2. Supabase: 이메일 로그인 켜기

1. Supabase 대시보드 → 프로젝트 → **Authentication → Sign In / Providers → Email**
2. **Enable Email provider** 켜기
3. **Email OTP Length**: `6`
4. **Email OTP Expiration**: `600`초 (10분)
   - 화면 코드의 `OTP_EXPIRY_SECONDS`(`src/data/authRules.js`)와 같은 값이어야 합니다. 바꾸면 둘 다 바꿉니다.
   - Supabase는 "틀린 코드"와 "만료된 코드"를 같은 오류로 돌려줍니다. 화면은 코드를 보낸 시각과 이 값으로 둘을 구분해 안내합니다.
5. **Allow new users to sign up**은 켜 둡니다(처음 로그인하는 학생은 이때 계정이 생김). 학교 메일이 아닌 주소는 4장의 Auth Hook이 막습니다.
6. 저장

## 3. Supabase: 메일을 링크 대신 6자리 코드로

**Authentication → Emails → Templates**에서 **두 템플릿 모두** 바꿉니다.
- 처음 로그인하는 사람은 **Confirm signup**, 이미 가입한 사람은 **Magic Link** 템플릿으로 메일이 갑니다.
- 본문에 `{{ .ConfirmationURL }}`(링크)이 있으면 지우고 `{{ .Token }}`(6자리 코드)을 넣습니다.

예시 (두 템플릿에 같은 내용):

- 제목: `[HUFS Quest] 로그인 인증 코드`
- 본문:
  ```html
  <h2>HUFS Quest 로그인 인증 코드</h2>
  <p>아래 6자리 코드를 게임 화면에 입력해 주세요. 코드는 10분 동안 쓸 수 있어요.</p>
  <p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
  <p>본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
  ```

## 4. Supabase: 학교 메일이 아닌 가입 막기 (Auth Hook)

화면에서 `@hufs.ac.kr`만 고르게 해도 브라우저 코드를 고치면 우회할 수 있습니다. 그래서 **서버에서 두 번 막습니다.**
1. **가입 단계:** Supabase Auth Hook이 다른 도메인의 계정 생성 자체를 거절합니다. (아래)
2. **진행 API 단계:** 서버 함수(`api/progress` 등, 임현규)가 토큰의 이메일이 `@hufs.ac.kr`로 끝나지 않으면 `403`을 돌려줍니다. ([PROGRESS_API.md](PROGRESS_API.md) 4장)

**SQL Editor**에서 실행합니다.

```sql
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
```

그다음:
1. **Authentication → Hooks → Before User Created** → **Postgres** 선택 → `public.hook_hufs_only` 지정 → 켜기
2. 실행한 SQL은 원문 그대로 `supabase/003_auth_hook_hufs_only.sql`에 기록하고 PR "작업 기록"에 적습니다(테이블 구조·함수 변경 규칙).
3. 확인: 학교 메일이 아닌 주소로 시험할 때(예: 개인 메일을 브라우저 개발자 도구로 억지로 넣어 보기) 화면에 "학교 메일로만 로그인할 수 있어요."가 나오고 **Authentication → Users**에 계정이 생기지 않으면 성공입니다.

## 5. Supabase: 사이트 주소 등록

**Authentication → URL Configuration**
- **Site URL**: 배포 주소 `https://hufs-quest.vercel.app`
- **Redirect URLs**에 추가:
  - `http://localhost:5173/**` (로컬)
  - `https://hufs-quest.vercel.app/**` (배포)
  - Vercel Preview 주소: PR에 달린 Preview 링크의 모양을 보고 `https://hufs-quest-*-<팀 이름>.vercel.app/**`처럼 별표로 등록

6자리 코드 방식은 링크를 누르지 않으므로 이 주소들로 이동하지는 않지만, Supabase가 요청 출처를 확인하므로 등록해 둡니다.

## 6. 메일 발송 한도와 외부 SMTP (베타테스트 20명 전에 필수)

- **Authentication → Rate Limits**에서 "이메일 발송" 한도(시간당 통수)를 확인합니다. 기본 메일 서버는 **시험용이라 한도가 아주 낮습니다.**
- **Authentication → Emails → SMTP Settings** 화면 안내도 확인합니다. 기본 메일 서버는 받는 사람을 프로젝트 팀원 주소로 제한할 수 있습니다. 내 학교 메일로 시험하다가 메일이 안 오면 이 제한부터 의심합니다.
- 같은 주소로는 60초에 한 번만 보낼 수 있습니다(화면도 60초 동안 "코드 다시 받기"를 막음).

**외부 SMTP로 바꾸기**
1. 메일 발송 서비스(예: Resend, Brevo, Amazon SES 등)에 가입하고, 무료 한도가 베타테스트(20명 × 몇 번)에 충분한지 확인합니다.
2. 보내는 주소에 쓸 도메인을 그 서비스에 등록하고 SPF · DKIM DNS 기록을 추가합니다. 학교 메일 서버가 스팸으로 거르지 않게 하려면 이 단계가 중요합니다.
3. Supabase **SMTP Settings** → **Enable Custom SMTP** → 서비스가 알려 준 Host · Port · Username · Password, 보내는 주소, 보내는 이름(`HUFS Quest`) 입력
4. **Rate Limits**의 이메일 한도를 베타테스트에 맞게 올립니다.
5. 팀원 학교 메일로 받아 보고, 스팸함으로 가지 않는지 확인합니다.

SMTP 비밀번호는 Supabase 대시보드에만 넣습니다. 저장소 · `.env.example` · PR에 적지 않습니다.

## 7. Vercel 환경 변수

**Vercel → 프로젝트 → Settings → Environment Variables**

| 이름 | 값 | Production | Preview |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API의 **Project URL** | ✅ | ✅ |
| `VITE_SUPABASE_ANON_KEY` | 같은 화면의 **Publishable key**(`sb_publishable_…`). 예전 형식이면 **anon public** 키 | ✅ | ✅ |
| `VITE_AUTH_MODE` | `real` | 시험이 끝난 뒤 | ✅ 먼저 |
| `VITE_PROGRESS_MODE` | `mock` (서버 진행 API가 생기면 `real`) | ✅ | ✅ |

- **Secret key(`sb_secret_…`)는 절대 `VITE_`에 넣지 않습니다.** 넣는 순간 누구나 DB 전체를 읽고 지울 수 있습니다.
- `VITE_` 값은 빌드할 때 화면 코드에 박힙니다. 값을 바꾸면 **Deployments → 최신 배포 → Redeploy**를 해야 반영됩니다.
- 환경 변수 추가는 CLAUDE.md 규칙상 PR "작업 기록"에 적습니다(값은 적지 않음).

## 8. 내 학교 메일로 진짜 모드 시험하기

**로컬에서**
1. 프로젝트 폴더에 `.env.local` 파일을 만들고(이미 `.gitignore`에 있어 커밋되지 않음) 아래 네 줄을 넣습니다. 값은 7장의 값입니다.
   ```
   VITE_AUTH_MODE=real
   VITE_PROGRESS_MODE=mock
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
2. `npm.cmd run dev` → http://localhost:5173
3. 타이틀 아래 문구에 "가짜 로그인"이 **없는지** 확인합니다(있으면 `VITE_AUTH_MODE`가 안 읽힌 것).
4. "재학생 로그인" → 내 학번 9자리 → "인증 코드 받기"
5. 학교 메일함(스팸함 포함)에서 6자리 코드 확인. 링크가 오면 3장 템플릿을 다시 확인합니다.
6. 코드 입력 → 진행 기록을 불러온 뒤 캠퍼스에 들어가면 성공. Supabase **Authentication → Users**에 내 계정이 생겼는지 봅니다.
7. 틀린 코드(아무 6자리), 60초 재발송 제한, 새로고침 후 로그인 유지, HUD 로그아웃을 차례로 봅니다.
8. 시험이 끝나면 `.env.local`을 지우거나 `VITE_AUTH_MODE=mock`으로 되돌립니다.

**Preview에서:** 7장의 Preview 변수만 넣고 Redeploy한 뒤, PR의 Preview 링크에서 4~7번을 반복합니다.

**문제가 생기면**
| 화면 문구 | 확인할 곳 |
| --- | --- |
| 로그인 서버가 아직 설정되지 않았어요 | `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY`가 비어 있음 / Redeploy 안 함 |
| N초 뒤에 다시 받을 수 있어요 | 60초 제한 또는 6장의 시간당 한도 |
| 학교 메일로만 로그인할 수 있어요 | 4장 Hook이 거절함(학교 메일인데 나오면 Hook SQL 확인) |
| 연결이 불안정해요 | 네트워크 또는 Supabase 주소 오타 |
| 메일이 안 옴 | 6장의 기본 메일 서버 제한 · 스팸함 |
