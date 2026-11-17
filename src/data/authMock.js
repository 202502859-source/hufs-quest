// 서버 설정 전에 로그인 화면을 끝까지 시험하기 위한 "가짜 인증"입니다. 메일을 보내지 않고 6자리 코드를 만들어 돌려줍니다.
// 진짜와 같은 규칙: 마지막으로 받은 코드와 같을 때만 통과, 유효 시간이 지나면 만료, 같은 주소는 60초 안에 다시 못 받음.
// 화면은 이 파일을 직접 부르지 않고 auth.js를 통해서만 씁니다. (테스트: tests/auth.test.js)
import { AuthError, CODE_LENGTH, OTP_EXPIRY_SECONDS, isExpired, isValidCode, resendWaitSeconds } from "./authRules.js";

export function createMockAuth({ now = () => Date.now(), random = Math.random, expirySeconds = OTP_EXPIRY_SECONDS } = {}) {
  let pending = null; // { email, code, sentAt } — 메모리에만 두고 기록하지 않습니다.
  const lastSent = new Map(); // 이메일 → 마지막으로 보낸 시각 (재발송 제한용)

  const makeCode = () =>
    Array.from({ length: CODE_LENGTH }, () => Math.floor(random() * 10))
      .join("")
      .slice(0, CODE_LENGTH);

  return {
    // 코드를 "보내고" 개발용으로 그 코드를 돌려줍니다.
    sendCode(email) {
      const wait = resendWaitSeconds(lastSent.get(email), now());
      if (wait > 0) throw new AuthError("rate_limited", { retryAfter: wait });
      const code = makeCode();
      const sentAt = now();
      pending = { email, code, sentAt };
      lastSent.set(email, sentAt);
      return { code, sentAt };
    },

    // 마지막으로 보낸 코드와 같으면 통과합니다. 통과하면 같은 코드를 다시 쓸 수 없습니다.
    verifyCode(email, code) {
      if (!isValidCode(code)) throw new AuthError("invalid");
      if (!pending || pending.email !== email) throw new AuthError("no_code");
      if (isExpired(pending.sentAt, now(), expirySeconds)) throw new AuthError("expired");
      if (code !== pending.code) throw new AuthError("wrong");
      pending = null;
      return { ok: true };
    },
  };
}
