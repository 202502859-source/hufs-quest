// 검색창 사용량 제한(api/_lib/usageLimit.js)과 api/ask.js의 400 · 429 응답을 확인합니다. 실행: npm test
// IP는 문서용 예시 주소(203.0.113.x, RFC 5737)만 씁니다. Supabase · CLOVA는 부르지 않고 가짜 fetch로 대신합니다.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  ASK_LIMITS,
  EVAL_MINUTE_LIMIT,
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

test("한도 상수: 분당 10, 학생 하루 50, 게스트 IP 하루 150, 전체 하루 2000(11/27 500 → 2000), eval 1분 120", () => {
  assert.deepEqual({ ...ASK_LIMITS }, { minute: 10, day: 50, guestDay: 150, globalDay: 2000 });
  assert.equal(EVAL_MINUTE_LIMIT, 120);
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

test("게스트(토큰 없음) → Supabase로 보내는 값: IP 해시 · 게스트 한도 · 서버 키(apikey)만, 원본 IP는 없음", async () => {
  const { calls, fetchImpl } = fakeDb(allowRow);
  const result = await checkAskLimit(req("203.0.113.7"), { env: ENV, fetchImpl, now: NOW });
  assert.deepEqual(result, { allowed: true, reason: null, retryAfter: 0, source: "db", eval: false, who: "guest" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://db.example.test/rest/v1/rpc/ask_hit");
  assert.deepEqual(calls[0].body, {
    p_ip_hash: ipHash("203.0.113.7", "test-salt", "2026-11-19"),
    p_minute_limit: 10,
    p_day_limit: 150,
    p_global_day_limit: 2000,
  });
  assert.equal(calls[0].headers.apikey, "test-service-key");
  assert.equal(JSON.stringify(calls[0]).includes("203.0.113.7"), false);
});

test("ask_hit 거절은 이유와 남은 초를 그대로 돌려줌", async () => {
  for (const reason of ["minute", "day", "global"]) {
    const { fetchImpl } = fakeDb({ ...allowRow, allowed: false, reason, retry_after: 42 });
    const result = await checkAskLimit(req("203.0.113.8"), { env: ENV, fetchImpl, now: NOW });
    assert.deepEqual(result, { allowed: false, reason, retryAfter: 42, source: "db", eval: false, who: "guest" });
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
      assert.equal(r.source, "memory-fallback", "DB를 못 써서 메모리로 통과시킨 요청은 memory-fallback");
    }
    const r11 = await checkAskLimit(req(ip), { env: c.env, fetchImpl: c.fetchImpl, now: NOW });
    assert.equal(r11.allowed, false);
    assert.equal(r11.reason, "minute");
    assert.equal(r11.source, "memory-first", "11번째는 1차 메모리 제한에서 끊김");
    assert.ok(r11.retryAfter >= 1 && r11.retryAfter <= 60);
  }
});

test("1차 메모리 제한에 걸리면 Supabase를 부르지 않음, 다른 IP는 영향 없음", async () => {
  const { calls, fetchImpl } = fakeDb(allowRow);
  for (let n = 0; n < 10; n++) await checkAskLimit(req("203.0.113.30"), { env: ENV, fetchImpl, now: NOW });
  const before = calls.length;
  const blocked = await checkAskLimit(req("203.0.113.30"), { env: ENV, fetchImpl, now: NOW });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.source, "memory-first");
  assert.equal(calls.length, before);
  const other = await checkAskLimit(req("203.0.113.31"), { env: ENV, fetchImpl, now: NOW });
  assert.equal(other.allowed, true);
  // 1분이 지나면 다시 통과
  const later = await checkAskLimit(req("203.0.113.30"), { env: ENV, fetchImpl, now: new Date(NOW.getTime() + 61_000) });
  assert.equal(later.allowed, true);
});

test("eval 토큰: 맞으면 Supabase ask_hit을 부르지 않음 → 사용자 · 전체 하루 한도에 더해지지 않음(11/27)", async () => {
  const headers = { [EVAL_TOKEN_HEADER]: "test-eval-token" };
  assert.equal(isEvalRequest(req("203.0.113.40", headers), ENV.ASK_EVAL_TOKEN), true);
  const { calls, fetchImpl } = fakeDb(allowRow);
  // 일반 1분 한도(10)를 넘겨도 eval은 막히지 않고, DB는 한 번도 부르지 않음
  for (let n = 0; n < 12; n++) {
    const r = await checkAskLimit(req("203.0.113.40", headers), { env: ENV, fetchImpl, now: NOW });
    assert.deepEqual(r, { allowed: true, reason: null, retryAfter: 0, source: "eval-bypass", eval: true, who: "eval" });
  }
  assert.equal(calls.length, 0);
});

test("eval 토큰: 인스턴스 메모리 1분 120회까지 통과, 121번째는 minute 거절, 1분 지나면 다시 통과", async () => {
  const headers = { [EVAL_TOKEN_HEADER]: "test-eval-token" };
  const { calls, fetchImpl } = fakeDb(allowRow);
  for (let n = 1; n <= 120; n++) {
    assert.equal((await checkAskLimit(req("203.0.113.43", headers), { env: ENV, fetchImpl, now: NOW })).allowed, true, `#${n}`);
  }
  // IP가 달라도 eval은 같은 칸으로 셈
  const over = await checkAskLimit(req("203.0.113.44", headers), { env: ENV, fetchImpl, now: NOW });
  assert.equal(over.allowed, false);
  assert.equal(over.reason, "minute");
  assert.equal(over.source, "eval-bypass");
  assert.ok(over.retryAfter >= 1 && over.retryAfter <= 60);
  const later = await checkAskLimit(req("203.0.113.43", headers), { env: ENV, fetchImpl, now: new Date(NOW.getTime() + 61_000) });
  assert.equal(later.allowed, true);
  assert.equal(calls.length, 0);
  // eval이 1분 한도를 다 써도 일반 사용자는 영향 없음(DB로 판단)
  const user = await checkAskLimit(req("203.0.113.45"), { env: ENV, fetchImpl, now: NOW });
  assert.equal(user.allowed, true);
  assert.equal(user.source, "db");
});

test("일반 요청은 지금과 똑같이 ask_hit을 부르고, 전체 하루 한도 2000을 넘김", async () => {
  const { calls, fetchImpl } = fakeDb(allowRow);
  const r = await checkAskLimit(req("203.0.113.46"), { env: ENV, fetchImpl, now: NOW });
  assert.deepEqual(r, { allowed: true, reason: null, retryAfter: 0, source: "db", eval: false, who: "guest" });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/rest\/v1\/rpc\/ask_hit$/);
  assert.deepEqual(
    { minute: calls[0].body.p_minute_limit, day: calls[0].body.p_day_limit, global: calls[0].body.p_global_day_limit },
    { minute: 10, day: 150, global: 2000 },
  );
});

test("eval 토큰이 틀리거나 서버에 토큰이 없으면 일반 요청", async () => {
  assert.equal(isEvalRequest(req("203.0.113.41", { [EVAL_TOKEN_HEADER]: "wrong" }), "test-eval-token"), false);
  assert.equal(isEvalRequest(req("203.0.113.41", { [EVAL_TOKEN_HEADER]: "" }), "test-eval-token"), false);
  assert.equal(isEvalRequest(req("203.0.113.41", { [EVAL_TOKEN_HEADER]: "anything" }), undefined), false);
  const { calls, fetchImpl } = fakeDb(allowRow);
  await checkAskLimit(req("203.0.113.41", { [EVAL_TOKEN_HEADER]: "wrong" }), { env: ENV, fetchImpl, now: NOW });
  assert.equal(calls[0].body.p_day_limit, 150); // 일반 게스트 한도
});

test("eval 요청은 Supabase 설정이 없거나 실패해도 같음: DB를 부르지 않고 메모리 1분 120회만", async () => {
  const headers = { [EVAL_TOKEN_HEADER]: "test-eval-token" };
  const { calls, fetchImpl } = fakeDb(new Error("fetch failed"));
  for (let n = 0; n < 11; n++) {
    const r = await checkAskLimit(req("203.0.113.42", headers), { env: ENV, fetchImpl, now: NOW });
    assert.equal(r.allowed, true);
    assert.equal(r.source, "eval-bypass");
  }
  assert.equal(calls.length, 0);
});

// ── 학생(로그인 토큰)은 계정 기준으로 셈 ──
// 가짜 fetch: /auth/v1/user에는 토큰별 사용자, /rpc/ask_hit에는 허용을 돌려줍니다.
function fakeAuthAndDb(users, { authStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : null });
    if (String(url).endsWith("/auth/v1/user")) {
      if (authStatus instanceof Error) throw authStatus;
      const token = init.headers.Authorization.replace("Bearer ", "");
      const user = users[token];
      return user && authStatus === 200
        ? { ok: true, status: 200, json: async () => user }
        : { ok: false, status: authStatus === 200 ? 401 : authStatus, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => [allowRow] };
  };
  return { calls, fetchImpl };
}
const USERS = {
  "token-a": { id: "11111111-aaaa-4aaa-8aaa-111111111111", email: "studenta@hufs.ac.kr" },
  "token-b": { id: "22222222-bbbb-4bbb-8bbb-222222222222", email: "studentb@hufs.ac.kr" },
  "token-gmail": { id: "33333333-cccc-4ccc-8ccc-333333333333", email: "someone@gmail.com" },
};
const bearer = (t) => ({ authorization: `Bearer ${t}` });

test("학생: 같은 IP(같은 와이파이)여도 계정마다 다른 해시 · 학생 한도(하루 50)로 셈, 원본 id · 토큰은 DB에 안 감", async () => {
  const { calls, fetchImpl } = fakeAuthAndDb(USERS);
  const a = await checkAskLimit(req("203.0.113.60", bearer("token-a")), { env: ENV, fetchImpl, now: NOW });
  const b = await checkAskLimit(req("203.0.113.60", bearer("token-b")), { env: ENV, fetchImpl, now: NOW });
  assert.equal(a.who, "student");
  assert.equal(b.who, "student");
  const hits = calls.filter((c) => c.url.endsWith("/rpc/ask_hit")).map((c) => c.body);
  assert.equal(hits[0].p_ip_hash, ipHash(`user:${USERS["token-a"].id}`, "test-salt", "2026-11-19"));
  assert.notEqual(hits[0].p_ip_hash, hits[1].p_ip_hash);
  assert.notEqual(hits[0].p_ip_hash, ipHash("203.0.113.60", "test-salt", "2026-11-19"));
  assert.equal(hits[0].p_day_limit, 50);
  const sent = JSON.stringify(hits);
  assert.equal(sent.includes(USERS["token-a"].id) || sent.includes("token-a") || sent.includes("203.0.113.60"), false);
  // 토큰 확인은 서버 키(apikey) + 사용자 토큰으로
  const auth = calls.find((c) => c.url.endsWith("/auth/v1/user"));
  assert.equal(auth.url, "https://db.example.test/auth/v1/user");
  assert.equal(auth.init.headers.apikey, "test-service-key");
});

test("학생: 한 사람이 1분 한도를 넘겨도 같은 와이파이의 다른 학생은 통과(메모리 1차 제한도 계정별)", async () => {
  const { fetchImpl } = fakeAuthAndDb(USERS);
  for (let n = 0; n < 10; n++) await checkAskLimit(req("203.0.113.61", bearer("token-a")), { env: ENV, fetchImpl, now: NOW });
  const aBlocked = await checkAskLimit(req("203.0.113.61", bearer("token-a")), { env: ENV, fetchImpl, now: NOW });
  assert.equal(aBlocked.allowed, false);
  assert.equal(aBlocked.source, "memory-first");
  const bOk = await checkAskLimit(req("203.0.113.61", bearer("token-b")), { env: ENV, fetchImpl, now: NOW });
  assert.equal(bOk.allowed, true);
  const guestOk = await checkAskLimit(req("203.0.113.61"), { env: ENV, fetchImpl, now: NOW });
  assert.equal(guestOk.allowed, true);
});

test("토큰이 틀리거나 · 학교 메일이 아니거나 · 확인이 실패하면 게스트(IP · 게스트 한도)로 셈", async () => {
  const cases = [
    { token: "wrong-token", opts: {} },
    { token: "token-gmail", opts: {} },
    { token: "token-a", opts: { authStatus: 500 } },
    { token: "token-a", opts: { authStatus: new Error("timeout") } },
  ];
  for (const c of cases) {
    resetMemoryLimit();
    const { calls, fetchImpl } = fakeAuthAndDb(USERS, c.opts);
    const r = await checkAskLimit(req("203.0.113.62", bearer(c.token)), { env: ENV, fetchImpl, now: NOW });
    assert.equal(r.who, "guest", c.token);
    const hit = calls.find((x) => x.url.endsWith("/rpc/ask_hit")).body;
    assert.equal(hit.p_ip_hash, ipHash("203.0.113.62", "test-salt", "2026-11-19"));
    assert.equal(hit.p_day_limit, 150);
  }
});

test("Supabase 설정이 없으면 토큰 확인을 하지 않고 게스트로 봄", async () => {
  const { calls, fetchImpl } = fakeAuthAndDb(USERS);
  const r = await checkAskLimit(req("203.0.113.63", bearer("token-a")), { env: { ASK_IP_SALT: "s" }, fetchImpl, now: NOW });
  assert.equal(r.who, "guest");
  assert.equal(calls.length, 0);
});

// ── api/ask.js 처리 함수: 한도 · 길이 검사 순서 ──
test("ask.js: 201자 질문은 자르지 않고 400, 한도에 걸리면 429 { error, reason, retryAfter }이고 AI를 부르지 않음", async () => {
  Object.assign(process.env, { ...ENV, CLOVA_API_KEY: "test-clova-key" });
  const fetched = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    fetched.push(String(url));
    if (String(url).includes("/rpc/get_answer_cache")) return { ok: true, status: 200, json: async () => [] };
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
    assert.deepEqual(fetched.map((u) => new URL(u).pathname), ["/rest/v1/rpc/get_answer_cache", "/rest/v1/rpc/ask_hit"]); // CLOVA 호출 없음

    const joined = logs.join("\n");
    assert.equal(/203\.0\.113|졸업학점|[0-9a-f]{64}/.test(joined), false); // 로그에 IP · 질문 · 해시 없음
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test("ask.js: eval 토큰 요청이 1분 120회를 넘으면 429 { reason: minute }, ask_hit · CLOVA를 부르지 않고 로그 limit은 eval-bypass", async () => {
  Object.assign(process.env, { ...ENV, CLOVA_API_KEY: "test-clova-key" });
  const headers = { [EVAL_TOKEN_HEADER]: "test-eval-token" };
  // 같은 모듈의 메모리 칸을 120회 채움(ask.js도 같은 usageLimit.js 인스턴스를 씀)
  for (let n = 0; n < EVAL_MINUTE_LIMIT; n++) {
    assert.equal((await checkAskLimit(req("203.0.113.60", headers), { env: ENV, fetchImpl: async () => { throw new Error("no db"); } })).allowed, true);
  }
  const fetched = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    throw new Error(`unexpected fetch ${url}`);
  };
  const logs = [];
  const originalLog = console.log;
  console.log = (...a) => logs.push(a.join(" "));
  try {
    const { default: handler } = await import("../api/ask.js");
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    await handler({ method: "POST", headers: { "x-forwarded-for": "203.0.113.61", ...headers }, body: { question: "졸업학점 몇 학점이야?", lang: "ko" } }, res);
    assert.equal(res.code, 429);
    assert.equal(res.body.reason, "minute");
    assert.ok(res.body.retryAfter >= 1 && res.body.retryAfter <= 60);
    assert.deepEqual(fetched, []); // ask_hit · 캐시 · CLOVA 모두 부르지 않음
    const line = logs.map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((l) => l?.mode === "limited");
    assert.equal(line.limit, "eval-bypass");
    assert.equal(line.eval, true);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});
