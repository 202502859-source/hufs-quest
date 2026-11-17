// 학교 이메일 6자리 인증 코드 로그인입니다. 화면은 이 파일의 함수만 부릅니다.
//
// 모드: VITE_AUTH_MODE (비밀 값 아님). 진행 저장 모드(VITE_PROGRESS_MODE)와 따로 고릅니다.
//   "real"      Supabase Auth 이메일 OTP로 진짜 메일을 보냅니다. VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY(공개용 키)가 필요합니다.
//   없음 · "mock" 메일을 보내지 않고 6자리 코드를 만들어 화면 구석과 콘솔에 보여 줍니다(개발용). ?mockotp=fast면 20초 뒤 만료.
//
// 개인 정보: 메일 아이디 · 이메일은 메모리에만 잠깐 두고 콘솔 · 오류 메시지 · 저장소 어디에도 남기지 않습니다.
// 서버 비밀 키(SUPABASE_SERVICE_KEY)는 이 파일을 포함한 브라우저 코드에 절대 넣지 않습니다.
import {
  AuthError,
  MOCK_FAST_EXPIRY_SECONDS,
  OTP_EXPIRY_SECONDS,
  buildEmail,
  isValidCode,
  rejectedReason,
  resendWaitSeconds,
} from "./authRules.js";
import { createMockAuth } from "./authMock.js";

export { AuthError };

const env = import.meta.env ?? {};
export const AUTH_MODE = env.VITE_AUTH_MODE === "real" ? "real" : "mock";

let pending = null; // { email, sentAt } 마지막으로 코드를 보낸 주소와 시각 (메모리에만)
const lastSent = new Map(); // 이메일 → 보낸 시각. 같은 주소로 60초 안에 다시 보내지 않게 합니다.

// 학교 메일 아이디 + 선택한 도메인으로 인증 코드를 보냅니다. → { sentAt, devCode? } (devCode는 가짜 모드에서만)
export async function sendCode(mailId, domain) {
  const email = buildEmail(mailId, domain);
  const wait = resendWaitSeconds(lastSent.get(email), Date.now());
  if (wait > 0) throw new AuthError("rate_limited", { retryAfter: wait });

  const result = AUTH_MODE === "real" ? await realSend(email) : mockSend(email);
  pending = { email, sentAt: result.sentAt };
  lastSent.set(email, result.sentAt);
  return result;
}

// 마지막으로 받은 코드를 확인합니다. 맞으면 로그인 상태가 되고, 아니면 AuthError(wrong · expired …)를 던집니다.
export async function verifyCode(code) {
  if (!isValidCode(code)) throw new AuthError("invalid");
  if (!pending) throw new AuthError("no_code");
  if (AUTH_MODE === "real") await realVerify(pending, code);
  else mockVerify(pending, code);
  pending = null;
}

// 새로고침 뒤에도 로그인이 남아 있는지 확인합니다.
export async function restoreSession() {
  if (AUTH_MODE === "mock") return readMockLogin();
  try {
    const { data } = await (await supabase()).auth.getSession();
    return Boolean(data.session);
  } catch (error) {
    logError("restore", error);
    return false;
  }
}

// 진행 API 요청에 붙일 로그인 토큰. 로그인 안 했으면 null.
export async function getAccessToken() {
  if (AUTH_MODE === "mock") return readMockLogin() ? "mock-access-token" : null;
  try {
    const { data } = await (await supabase()).auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function signOut() {
  pending = null;
  if (AUTH_MODE === "mock") {
    writeMockLogin(false);
    return;
  }
  try {
    await (await supabase()).auth.signOut({ scope: "local" });
  } catch (error) {
    logError("signOut", error);
  }
}

// 오류 종류와 HTTP 상태만 남깁니다. Supabase 오류 객체를 통째로 찍으면 요청 정보가 섞일 수 있어 쓰지 않습니다.
function logError(step, error) {
  console.warn(`[auth] ${step} 실패`, { code: error?.code ?? null, status: error?.status ?? null });
}

// ── 진짜 모드 (Supabase Auth 이메일 OTP) ──────────────────
let clientPromise = null;

function supabase() {
  clientPromise ??= (async () => {
    const url = env.VITE_SUPABASE_URL;
    const key = env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) throw new AuthError("not_configured");
    // 가짜 모드에서는 라이브러리를 아예 불러오지 않도록 필요할 때만 가져옵니다.
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "hufs-quest-auth" },
    });
  })();
  return clientPromise;
}

function toAuthError(error, fallback) {
  if (error instanceof AuthError) return error;
  const status = error?.status ?? 0;
  if (status === 429 || /rate_limit/.test(error?.code ?? "")) return new AuthError("rate_limited", { retryAfter: 60 });
  if (status === 403 || status === 422) return new AuthError("forbidden"); // 학교 메일이 아니라며 서버(Auth Hook)가 거절
  if (!status || error?.name === "AuthRetryableFetchError") return new AuthError("network");
  return new AuthError(fallback);
}

async function realSend(email) {
  try {
    const { error } = await (await supabase()).auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
  } catch (error) {
    logError("sendCode", error);
    throw toAuthError(error, "unknown");
  }
  return { sentAt: Date.now() };
}

async function realVerify({ email, sentAt }, code) {
  let failure = null;
  try {
    const { error } = await (await supabase()).auth.verifyOtp({ email, token: code, type: "email" });
    failure = error;
  } catch (error) {
    failure = error;
  }
  if (!failure) return;
  logError("verifyCode", failure);
  const mapped = toAuthError(failure, "unknown");
  if (mapped.code === "rate_limited" || mapped.code === "network" || mapped.code === "not_configured") throw mapped;
  // Supabase는 틀린 코드와 만료된 코드를 같은 오류로 돌려주므로, 코드를 보낸 시각으로 나눕니다.
  throw new AuthError(rejectedReason(sentAt, Date.now(), OTP_EXPIRY_SECONDS));
}

// ── 가짜 모드 ─────────────────────────────────────────────
const MOCK_LOGIN_KEY = "hufs-quest-mock-login"; // 로그인했다는 표시만 저장합니다(메일 아이디 · 이메일은 저장하지 않음).

function mockQueryFast() {
  try {
    return new URLSearchParams(window.location.search).get("mockotp") === "fast";
  } catch {
    return false;
  }
}

let mockAuth = null;
const mock = () =>
  (mockAuth ??= createMockAuth({ expirySeconds: mockQueryFast() ? MOCK_FAST_EXPIRY_SECONDS : OTP_EXPIRY_SECONDS }));

function mockSend(email) {
  const { code, sentAt } = mock().sendCode(email);
  console.info(`[개발용 · 가짜 로그인] 인증 코드: ${code}`);
  return { sentAt, devCode: code };
}

function mockVerify({ email }, code) {
  mock().verifyCode(email, code);
  writeMockLogin(true);
}

function readMockLogin() {
  try {
    return localStorage.getItem(MOCK_LOGIN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMockLogin(loggedIn) {
  try {
    if (loggedIn) localStorage.setItem(MOCK_LOGIN_KEY, "1");
    else localStorage.removeItem(MOCK_LOGIN_KEY);
  } catch {
    // 저장소를 쓸 수 없는 환경이면 새로고침 때 다시 로그인합니다.
  }
}
