// 학교 이메일 로그인의 형식 규칙입니다. 화면(loginOverlay)과 가짜 인증(authMock), 테스트가 같이 씁니다.
// 화면에서 막아도 우회할 수 있으므로, 실제로 다른 도메인을 막는 일은 서버(Supabase Auth Hook, 진행 API의 403)가 합니다.

export const STUDENT_ID_LENGTH = 9;
// 로그인에 쓸 수 있는 학교 메일 도메인. 나중에 다른 도메인을 허용하면 여기에 추가합니다(서버 Auth Hook도 같이).
export const EMAIL_DOMAINS = ["hufs.ac.kr"];
export const CODE_LENGTH = 6;
export const RESEND_SECONDS = 60; // 같은 주소로 코드를 다시 받으려면 기다려야 하는 시간 (Supabase 기본값과 같음)
export const OTP_EXPIRY_SECONDS = 600; // 인증 코드 유효 시간 10분. Supabase 대시보드의 Email OTP Expiration과 같은 값으로 맞춥니다.
export const MOCK_FAST_EXPIRY_SECONDS = 20; // 가짜 모드에서 ?mockotp=fast를 붙였을 때의 유효 시간 (만료 확인용)

// 로그인 실패 이유. 학번·이메일 같은 개인 정보는 절대 메시지에 넣지 않습니다.
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

export const isValidStudentId = (value) => typeof value === "string" && /^\d{9}$/.test(value);

export const isValidCode = (value) => typeof value === "string" && /^\d{6}$/.test(value);

// 최종 이메일은 "학번 + 선택한 도메인"으로만 만듭니다. 목록에 없는 도메인이나 9자리 숫자가 아닌 학번은 거절합니다.
export function buildEmail(studentId, domain) {
  if (!isValidStudentId(studentId)) throw new AuthError("invalid");
  if (!EMAIL_DOMAINS.includes(domain)) throw new AuthError("invalid");
  return `${studentId}@${domain}`;
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
