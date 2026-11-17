// 학교 이메일 로그인의 형식 규칙입니다. 화면(loginOverlay)과 가짜 인증(authMock), 테스트가 같이 씁니다.
// 화면에서 막아도 우회할 수 있으므로, 실제로 다른 도메인을 막는 일은 서버(Supabase Auth Hook, 진행 API의 403)가 합니다.

// 학교 메일 아이디(@ 앞부분) 규칙. HUFS 메일은 Google Workspace 기반이라 구글 아이디 규칙을 따릅니다.
// 영문 소문자 · 숫자 · 마침표(.) · 밑줄(_) · 하이픈(-), 1~64자. 마침표는 맨 앞 · 맨 끝 · 연속(..) 불가. 9자리 학번도 그대로 통과합니다.
export const MAIL_ID_MAX_LENGTH = 64;
const MAIL_ID_CHARS = /^[a-z0-9._-]+$/;
// 로그인에 쓸 수 있는 학교 메일 도메인. 나중에 다른 도메인을 허용하면 여기에 추가합니다(서버 Auth Hook도 같이).
export const EMAIL_DOMAINS = ["hufs.ac.kr"];
export const CODE_LENGTH = 6;
export const RESEND_SECONDS = 60; // 같은 주소로 코드를 다시 받으려면 기다려야 하는 시간 (Supabase 기본값과 같음)
export const OTP_EXPIRY_SECONDS = 600; // 인증 코드 유효 시간 10분. Supabase 대시보드의 Email OTP Expiration과 같은 값으로 맞춥니다.
export const MOCK_FAST_EXPIRY_SECONDS = 20; // 가짜 모드에서 ?mockotp=fast를 붙였을 때의 유효 시간 (만료 확인용)

// 로그인 실패 이유. 메일 아이디·이메일 같은 개인 정보는 절대 메시지에 넣지 않습니다.
//   wrong 코드가 다름 · expired 코드가 만료됨 · rate_limited 너무 자주 요청함(retryAfter초 뒤 가능)
//   no_code 받은 코드가 없음 · invalid 형식이 맞지 않음 · not_configured 서버 설정 없음 · network · unknown
export class AuthError extends Error {
  constructor(code, { retryAfter = 0 } = {}) {
    super(`auth error: ${code}`);
    this.name = "AuthError";
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export const onlyDigits = (value) => String(value ?? "").replace(/\D/g, "");

// 입력칸 정리: 대문자는 소문자로 바꾸고, 허용 글자가 아닌 것은 지우고, 64자까지만 남깁니다.
export const normalizeMailId = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, MAIL_ID_MAX_LENGTH);

// 아이디가 규칙에 맞지 않는 이유. 맞으면 null.
//   "empty" 비어 있음 · "chars" 허용 글자가 아니거나 64자 초과 · "dots" 마침표가 맨 앞 · 맨 끝 · 연속
export function mailIdProblem(value) {
  if (typeof value !== "string" || value === "") return "empty";
  if (value.length > MAIL_ID_MAX_LENGTH || !MAIL_ID_CHARS.test(value)) return "chars";
  if (value.startsWith(".") || value.endsWith(".") || value.includes("..")) return "dots";
  return null;
}

export const isValidMailId = (value) => mailIdProblem(value) === null;

// "아이디@도메인" 전체를 붙여 넣었을 때: 목록에 있는 도메인이면 아이디와 도메인을 나눠 돌려주고, 아니면 foreign: true.
// @가 없거나 @ 뒤가 비어 있으면(아직 도메인을 안 친 상태) 아이디만 정리해서 돌려줍니다.
// → { id, domain(목록에 있을 때만, 아니면 null), foreign }
export function splitMailInput(raw) {
  const text = String(raw ?? "").trim();
  const at = text.indexOf("@");
  if (at === -1) return { id: normalizeMailId(text), domain: null, foreign: false };
  const domain = text.slice(at + 1).trim().toLowerCase();
  const id = normalizeMailId(text.slice(0, at));
  if (!domain) return { id, domain: null, foreign: false };
  return EMAIL_DOMAINS.includes(domain) ? { id, domain, foreign: false } : { id, domain: null, foreign: true };
}

export const isValidCode = (value) => typeof value === "string" && /^\d{6}$/.test(value);

// 최종 이메일은 "메일 아이디 + 선택한 도메인"으로만 만듭니다. 규칙에 맞지 않는 아이디나 목록에 없는 도메인은 거절합니다.
export function buildEmail(mailId, domain) {
  if (!isValidMailId(mailId)) throw new AuthError("invalid");
  if (!EMAIL_DOMAINS.includes(domain)) throw new AuthError("invalid");
  return `${mailId}@${domain}`;
}

// 코드를 보낸 뒤 다시 받기까지 남은 초. 0이면 바로 다시 받을 수 있습니다.
export function resendWaitSeconds(sentAtMs, nowMs) {
  if (sentAtMs == null) return 0;
  return Math.max(0, Math.ceil((sentAtMs + RESEND_SECONDS * 1000 - nowMs) / 1000));
}

export const isExpired = (sentAtMs, nowMs, expirySeconds = OTP_EXPIRY_SECONDS) => nowMs > sentAtMs + expirySeconds * 1000;

// Supabase는 틀린 코드와 만료된 코드를 같은 오류로 돌려줍니다. 코드를 보낸 시각으로 둘을 나눕니다.
export const rejectedReason = (sentAtMs, nowMs, expirySeconds = OTP_EXPIRY_SECONDS) =>
  isExpired(sentAtMs, nowMs, expirySeconds) ? "expired" : "wrong";
