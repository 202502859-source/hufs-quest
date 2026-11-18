// 검색창 사용량 제한(api/_lib/usageLimit.js)과 api/ask.js의 400 · 429 응답을 확인합니다. 실행: npm test
// IP는 문서용 예시 주소(203.0.113.x, RFC 5737)만 씁니다. Supabase · CLOVA는 부르지 않고 가짜 fetch로 대신합니다.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  ASK_LIMITS,
  EVAL_TOKEN_HEADER,
  checkAskLimit,
  clientIp,
  ipHash,
  isEvalRequest,
  resetMemoryLimit,
} from "../api/_lib/usageLimit.js";

const ENV = { ASK_IP_SALT: "test-salt", SUPABASE_URL: "https://db.example.test", SUPABASE_SERVICE_KEY: "test-service-key", ASK_EVAL_TOKEN: "test-eval-token" };
const NOW = new Date("2026-11-19T03:00:00Z"); // 한국 시간 11/19 12:00
const req = (ip, headers = {}) => ({ headers: { "x-forwarded-for": ip, ...headers } });

// ask_hit 응답을 흉내 내는 가짜 fetch. 받은 요청 본문을 calls에 모읍니다.
function fakeDb(reply) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    if (reply instanceof Error) throw reply;
    if (typeof reply === "number") return { ok: false, status: reply, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => [reply] };
  };
  return { calls, fetchImpl };
}
const allowRow = { allowed: true, reason: null, retry_after: 0, minute_hits: 1, day_hits: 1, global_hits: 1 };

beforeEach(() => resetMemoryLimit());

test("한도 상수: 분당 10, 하루 50, 전체 하루 500", () => {
  assert.deepEqual({ ...ASK_LIMITS }, { minute: 10, day: 50, globalDay: 500 });
});

test("IP는 x-forwarded-for 첫 값, 없으면 unknown", () => {
  assert.equal(clientIp(req("203.0.113.7, 10.0.0.1")), "203.0.113.7");
  assert.equal(clientIp({ headers: {} }), "unknown");
});

test("해시: 소문자 16진수 64자, 원본 IP가 들어가지 않고 날짜 · 소금이 바뀌면 달라짐", () => {
  const h = ipHash("203.0.113.7", "salt", "2026-11-19");
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h.includes("203"), false);
  assert.notEqual(h, ipHash("203.0.113.7", "salt", "2026-11-20"));
  assert.notEqual(h, ipHash("203.0.113.7", "other", "2026-11-19"));
});

test("Supabase로 보내는 값: 해시 · 세 한도 · 서버 키(apikey)만, 원본 IP는 없음", async () => {
  const { calls, fetchImpl } = fakeDb(allowRow);
  const result = await checkAskLimit(req("203.0.113.7"), { env: ENV, fetchImpl, now: NOW });
  assert.deepEqual(result, { allowed: true, reason: null, retryAfter: 0, source: "db", eval: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://db.example.test/rest/v1/rpc/ask_hit");
  assert.deepEqual(calls[0].body, {
    p_ip_hash: ipHash("203.0.113.7", "test-salt", "2026-11-19"),
    p_minute_limit: 10,
    p_day_limit: 50,
    p_global_day_limit: 500,
  });
  assert.equal(calls[0].headers.apikey, "test-service-key");
  assert.equal(JSON.stringify(calls[0]).includes("203.0.113.7"), false);
});

test("ask_hit 거절은 이유와 남은 초를 그대로 돌려줌", async () => {
  for (const reason of ["minute", "day", "global"]) {
    const { fetchImpl } = fakeDb({ ...allowRow, allowed: false, reason, retry_after: 42 });
    const result = await checkAskLimit(req("203.0.113.8"), { env: ENV, fetchImpl, now: NOW });
    assert.deepEqual(result, { allowed: false, reason, retryAfter: 42, source: "db", eval: false });
  }
});

test("Supabase 실패(오류 · 500 · 설정 없음)면 메모리 제한으로 대체: 1분 10번까지 통과, 11번째 minute", async () => {
  const cases = [
    { env: ENV, ...fakeDb(new Error("fetch failed")) },
    { env: ENV, ...fakeDb(500) },
    { env: { ...ENV, ASK_IP_SALT: "" }, ...fakeDb(allowRow) },
  ];
  for (const [i, c] of cases.entries()) {
    resetMemoryLimit();
    const ip = `203.0.113.${20 + i}`;
    for (let n = 1; n <= 10; n++) {
      const r = await checkAskLimit(req(ip), { env: c.env, fetchImpl: c.fetchImpl, now: NOW });
      assert.equal(r.allowed, true, `case ${i} #${n}`);
      assert.equal(r.source, "memory");
    }
    const r11 = await checkAskLimit(req(ip), { env: c.env, fetchImpl: c.fetchImpl, now: NOW });
    assert.equal(r11.allowed, false);
    assert.equal(r11.reason, "minute");
    assert.ok(r11.retryAfter >= 1 && r11.retryAfter <= 60);
  }
});

test("1차 메모리 제한에 걸리면 Supabase를 부르지 않음, 다른 IP는 영향 없음", async () => {
  const { calls, fetchImpl } = fakeDb(allowRow);
  for (let n = 0; n < 10; n++) await checkAskLimit(req("203.0.113.30"), { env: ENV, fetchImpl, now: NOW });
  const before = calls.length;
  const blocked = await checkAskLimit(req("203.0.113.30"), { env: ENV, fetchImpl, now: NOW });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.source, "memory");
  assert.equal(calls.length, before);
  const other = await checkAskLimit(req("203.0.113.31"), { env: ENV, fetchImpl, now: NOW });
  assert.equal(other.allowed, true);
  // 1분이 지나면 다시 통과
  const later = await checkAskLimit(req("203.0.113.30"), { env: ENV, fetchImpl, now: new Date(NOW.getTime() + 61_000) });
  assert.equal(later.allowed, true);
});

test("eval 토큰: 맞으면 IP 한도를 건너뛰고 전체 한도에는 셈, 'eval' 칸에 따로 셈", async () => {
  const headers = { [EVAL_TOKEN_HEADER]: "test-eval-token" };
  assert.equal(isEvalRequest(req("203.0.113.40", headers), ENV.ASK_EVAL_TOKEN), true);
  const { calls, fetchImpl } = fakeDb(allowRow);
  // 메모리 1분 한도(10)를 넘겨도 eval은 막히지 않음
  for (let n = 0; n < 12; n++) {
    const r = await checkAskLimit(req("203.0.113.40", headers), { env: ENV, fetchImpl, now: NOW });
    assert.equal(r.allowed, true);
    assert.equal(r.eval, true);
  }
  const body = calls[0].body;
  assert.equal(body.p_ip_hash, ipHash("eval", "test-salt", "2026-11-19"));
  assert.ok(body.p_minute_limit > 1_000_000 && body.p_day_limit > 1_000_000);
  assert.equal(body.p_global_day_limit, 500);
});

test("eval 토큰이 틀리거나 서버에 토큰이 없으면 일반 요청", async () => {
  assert.equal(isEvalRequest(req("203.0.113.41", { [EVAL_TOKEN_HEADER]: "wrong" }), "test-eval-token"), false);
  assert.equal(isEvalRequest(req("203.0.113.41", { [EVAL_TOKEN_HEADER]: "" }), "test-eval-token"), false);
  assert.equal(isEvalRequest(req("203.0.113.41", { [EVAL_TOKEN_HEADER]: "anything" }), undefined), false);
  const { calls, fetchImpl } = fakeDb(allowRow);
  await checkAskLimit(req("203.0.113.41", { [EVAL_TOKEN_HEADER]: "wrong" }), { env: ENV, fetchImpl, now: NOW });
  assert.equal(calls[0].body.p_day_limit, 50);
});

test("eval 요청도 Supabase가 실패하면 메모리 제한(1분 10회)을 받음", async () => {
  const headers = { [EVAL_TOKEN_HEADER]: "test-eval-token" };
  const { fetchImpl } = fakeDb(new Error("fetch failed"));
  for (let n = 0; n < 10; n++) assert.equal((await checkAskLimit(req("203.0.113.42", headers), { env: ENV, fetchImpl, now: NOW })).allowed, true);
  assert.equal((await checkAskLimit(req("203.0.113.42", headers), { env: ENV, fetchImpl, now: NOW })).allowed, false);
});

// ── api/ask.js 처리 함수: 한도 · 길이 검사 순서 ──
test("ask.js: 201자 질문은 자르지 않고 400, 한도에 걸리면 429 { error, reason, retryAfter }이고 AI를 부르지 않음", async () => {
  Object.assign(process.env, { ...ENV, CLOVA_API_KEY: "test-clova-key" });
  const fetched = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    fetched.push(String(url));
    if (String(url).includes("/rpc/ask_hit")) return { ok: true, status: 200, json: async () => [{ ...allowRow, allowed: false, reason: "day", retry_after: 3600 }] };
    throw new Error(`unexpected fetch ${url}`);
  };
  const logs = [];
  const originalLog = console.log;
  console.log = (...a) => logs.push(a.join(" "));
  try {
    const { default: handler } = await import("../api/ask.js");
    const call = async (question) => {
      const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
      await handler({ method: "POST", headers: { "x-forwarded-for": "203.0.113.50" }, body: { question, lang: "ko" } }, res);
      return res;
    };

    const long = await call("가".repeat(201));
    assert.equal(long.code, 400);
    assert.equal(long.body.error, "question too long");
    assert.equal(fetched.length, 0); // 길이 검사에서 끝나 한도 · AI 모두 부르지 않음

    const limited = await call("졸업학점 몇 학점이야?");
    assert.equal(limited.code, 429);
    assert.deepEqual(limited.body, { error: "too many requests", reason: "day", retryAfter: 3600 });
    assert.equal(limited.headers["Retry-After"], "3600");
    assert.deepEqual(fetched.map((u) => u.includes("ask_hit")), [true]); // CLOVA 호출 없음

    const joined = logs.join("\n");
    assert.equal(/203\.0\.113|졸업학점|[0-9a-f]{64}/.test(joined), false); // 로그에 IP · 질문 · 해시 없음
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});
