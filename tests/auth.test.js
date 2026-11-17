// 학교 이메일 로그인 형식 규칙과 가짜 인증이 약속대로 동작하는지 확인합니다. 실행: npm test
// 학번은 실제 학번이 아닌 예시 값(123456789)만 씁니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AuthError,
  EMAIL_DOMAINS,
  MOCK_FAST_EXPIRY_SECONDS,
  OTP_EXPIRY_SECONDS,
  buildEmail,
  isValidCode,
  isValidStudentId,
  onlyDigits,
  rejectedReason,
  resendWaitSeconds,
} from "../src/data/authRules.js";
import { createMockAuth } from "../src/data/authMock.js";

const ID = "123456789";
const EMAIL = `${ID}@hufs.ac.kr`;

// 시계를 마음대로 옮길 수 있는 가짜 인증. random은 고정 순서로 숫자를 냅니다.
function setup({ expirySeconds } = {}) {
  let time = Date.parse("2026-11-19T01:00:00Z");
  let seed = 0;
  const auth = createMockAuth({ now: () => time, random: () => ((seed++ * 7 + 3) % 10) / 10, expirySeconds });
  return { auth, advance: (seconds) => (time += seconds * 1000) };
}

const rejectsWith = (fn, code) => assert.throws(fn, (e) => e instanceof AuthError && e.code === code);

test("학번은 9자리 숫자만 통과", () => {
  assert.equal(isValidStudentId("123456789"), true);
  assert.equal(isValidStudentId("12345678"), false); // 8자리
  assert.equal(isValidStudentId("1234567890"), false); // 10자리
  assert.equal(isValidStudentId("12345678a"), false);
  assert.equal(isValidStudentId(" 123456789"), false);
  assert.equal(isValidStudentId("123456789@"), false);
  assert.equal(isValidStudentId(123456789), false); // 숫자형은 받지 않음
  assert.equal(isValidStudentId(""), false);
});

test("입력칸 정리: 숫자가 아닌 글자와 @는 지운다", () => {
  assert.equal(onlyDigits("1234-5678 9"), "123456789");
  assert.equal(onlyDigits("123@evil.com"), "123");
  assert.equal(onlyDigits("１２３"), ""); // 전각 숫자도 받지 않음
  assert.equal(onlyDigits(null), "");
});

test("이메일은 학번 + 목록에 있는 도메인으로만 조립", () => {
  assert.deepEqual(EMAIL_DOMAINS, ["hufs.ac.kr"]);
  assert.equal(buildEmail(ID, "hufs.ac.kr"), EMAIL);
  rejectsWith(() => buildEmail(ID, "gmail.com"), "invalid");
  rejectsWith(() => buildEmail(ID, "hufs.ac.kr.evil.com"), "invalid");
  rejectsWith(() => buildEmail(ID, "@hufs.ac.kr"), "invalid");
  rejectsWith(() => buildEmail("evil@gmail.com#", "hufs.ac.kr"), "invalid");
  rejectsWith(() => buildEmail("12345678", "hufs.ac.kr"), "invalid");
});

test("오류 메시지에 학번·이메일이 들어가지 않는다", () => {
  try {
    buildEmail("12345678", "hufs.ac.kr");
  } catch (error) {
    assert.equal(error.message.includes("12345678"), false);
  }
  const { auth } = setup();
  auth.sendCode(EMAIL);
  try {
    auth.verifyCode(EMAIL, "000000");
  } catch (error) {
    assert.equal(/\d{9}|@/.test(error.message), false);
  }
});

test("인증 코드는 숫자 6자리만 통과", () => {
  assert.equal(isValidCode("012345"), true);
  assert.equal(isValidCode("12345"), false);
  assert.equal(isValidCode("1234567"), false);
  assert.equal(isValidCode("12345a"), false);
  assert.equal(isValidCode(123456), false);
});

test("가짜 모드: 받은 코드와 같으면 로그인, 같은 코드는 다시 못 씀", () => {
  const { auth } = setup();
  const { code } = auth.sendCode(EMAIL);
  assert.match(code, /^\d{6}$/);
  assert.deepEqual(auth.verifyCode(EMAIL, code), { ok: true });
  rejectsWith(() => auth.verifyCode(EMAIL, code), "no_code");
});

test("가짜 모드: 틀린 코드는 wrong으로 거절, 다시 맞는 코드를 넣으면 통과", () => {
  const { auth } = setup();
  const { code } = auth.sendCode(EMAIL);
  const wrong = code === "000000" ? "111111" : "000000";
  rejectsWith(() => auth.verifyCode(EMAIL, wrong), "wrong");
  rejectsWith(() => auth.verifyCode(EMAIL, "12a456"), "invalid");
  assert.deepEqual(auth.verifyCode(EMAIL, code), { ok: true });
});

test("가짜 모드: 10분이 지나면 맞는 코드도 expired로 거절", () => {
  const { auth, advance } = setup();
  const { code } = auth.sendCode(EMAIL);
  advance(OTP_EXPIRY_SECONDS); // 정확히 10분까지는 유효
  advance(1);
  rejectsWith(() => auth.verifyCode(EMAIL, code), "expired");
});

test("가짜 모드 ?mockotp=fast: 20초 뒤 만료", () => {
  const { auth, advance } = setup({ expirySeconds: MOCK_FAST_EXPIRY_SECONDS });
  const { code } = auth.sendCode(EMAIL);
  advance(MOCK_FAST_EXPIRY_SECONDS + 1);
  rejectsWith(() => auth.verifyCode(EMAIL, code), "expired");
});

test("가짜 모드: 같은 주소는 60초 안에 다시 못 받고, 새 코드를 받으면 옛 코드는 무효", () => {
  const { auth, advance } = setup();
  const first = auth.sendCode(EMAIL);
  advance(30);
  assert.throws(() => auth.sendCode(EMAIL), (e) => e.code === "rate_limited" && e.retryAfter === 30);
  advance(30);
  const second = auth.sendCode(EMAIL);
  assert.notEqual(second.code, first.code);
  rejectsWith(() => auth.verifyCode(EMAIL, first.code), "wrong");
  assert.deepEqual(auth.verifyCode(EMAIL, second.code), { ok: true });
});

test("가짜 모드: 코드를 받은 주소와 다른 주소로는 확인할 수 없음", () => {
  const { auth } = setup();
  const { code } = auth.sendCode(EMAIL);
  rejectsWith(() => auth.verifyCode("987654321@hufs.ac.kr", code), "no_code");
});

test("재발송 대기 시간과 틀림·만료 구분(진짜 모드에서 쓰는 규칙)", () => {
  const sent = Date.parse("2026-11-19T01:00:00Z");
  assert.equal(resendWaitSeconds(null, sent), 0);
  assert.equal(resendWaitSeconds(sent, sent), 60);
  assert.equal(resendWaitSeconds(sent, sent + 59_001), 1);
  assert.equal(resendWaitSeconds(sent, sent + 60_000), 0);
  assert.equal(rejectedReason(sent, sent + 599_000), "wrong");
  assert.equal(rejectedReason(sent, sent + 601_000), "expired");
});
