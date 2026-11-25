import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { hasTimeSensitiveWords } from "../shared/academicDate.js";
import { normalizeQuestion, buildCacheKey, canUseAnswerCache, shouldCacheAnswer } from "../api/_lib/answerCache.js";
import { resetMemoryLimit } from "../api/_lib/usageLimit.js";
beforeEach(() => resetMemoryLimit());
test("캐시 키 정규화 및 언어 분리", () => {
  assert.equal(normalizeQuestion("  휴학은   최대 몇 년이야?? "), "휴학은 최대 몇 년이야");
  assert.equal(buildCacheKey("휴학은 최대 몇 년이야?", "ko"), buildCacheKey("  휴학은  최대 몇 년이야 ", "ko"));
  assert.notEqual(buildCacheKey("휴학은 최대 몇 년이야?", "ko"), buildCacheKey("휴학은 최대 몇 년이야?", "en"));
  assert.match(buildCacheKey("이중전공 학점", "ko"), /^[0-9a-f]{64}$/);
});
test("배포 환경 및 커밋별 캐시 키 분리", () => {
  const originalEnv = process.env.VERCEL_ENV;
  const originalSha = process.env.VERCEL_GIT_COMMIT_SHA;

  try {
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_GIT_COMMIT_SHA = "commit-A";
    const productionA = buildCacheKey("이중전공 신청 방법은?", "ko");

    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_SHA = "commit-A";
    const previewA = buildCacheKey("이중전공 신청 방법은?", "ko");

    process.env.VERCEL_GIT_COMMIT_SHA = "commit-B";
    const previewB = buildCacheKey("이중전공 신청 방법은?", "ko");

    assert.notEqual(productionA, previewA);
    assert.notEqual(previewA, previewB);
    assert.equal(
      previewB,
      buildCacheKey("이중전공 신청 방법은?", "ko")
    );
  } finally {
    if (originalEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalEnv;

    if (originalSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = originalSha;
  }
});

test("시간 표현 제외 및 영어 단어 경계(\\b)", () => {
  for (const q of ["오늘 도서관 열어?", "이번 학기 수강신청 언제야?", "다음 달 등록금", "마감됐나요?", "What is the schedule today?", "Can I apply now?", "Is registration still open?"]) { assert.equal(hasTimeSensitiveWords(q), true, q); assert.equal(canUseAnswerCache({ evalMode: false, question: q }), false, q); }
  for (const q of ["휴학은 최대 몇 년이야?", "이중전공과 부전공은 각각 몇 학점이야?", "I want to know double major credits", "Unknown graduation requirements"]) { assert.equal(hasTimeSensitiveWords(q), false, q); assert.equal(canUseAnswerCache({ evalMode: false, question: q }), true, q); }
});
test("eval 우회 및 저장 조건", () => {
  assert.equal(canUseAnswerCache({ evalMode: true, question: "휴학은 최대 몇 년이야?" }), false);
  assert.equal(shouldCacheAnswer({ mode: "ai", truncated: false }), true);
  assert.equal(shouldCacheAnswer({ mode: "ai", truncated: true }), false);
  assert.equal(shouldCacheAnswer({ mode: "evidence", truncated: false }), false);
});
test("ask.js 캐시 적중/미적중/eval 통합", async () => {
  const ENV = { ASK_IP_SALT: "test-salt", SUPABASE_URL: "https://db.example.test", SUPABASE_SERVICE_KEY: "test-service-key", CLOVA_API_KEY: "test-clova-key", ASK_EVAL_TOKEN: "test-eval-token" };
  const saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]])); Object.assign(process.env, ENV);
  const store = new Map(); const calls = []; const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url); const body = init?.body ? JSON.parse(init.body) : null; calls.push({ url: u, body });
    const json = (b) => ({ ok: true, status: 200, json: async () => b });
    if (u.endsWith("/rpc/get_answer_cache")) { const r = store.get(body.p_cache_key); return json(r ? [r] : []); }
    if (u.endsWith("/rpc/set_answer_cache")) { store.set(body.p_cache_key, { answer: body.p_answer, sources: body.p_sources }); return json(null); }
    if (u.endsWith("/rpc/ask_hit")) return json([{ allowed: true, reason: null, retry_after: 0, minute_hits: 1, day_hits: 1, global_hits: 1 }]);
    if (u.includes("HCX-DASH-002")) return json({ result: { message: { content: "{\"queries\":[\"휴학 최대 기간\"]}" }, finishReason: "stop", usage: { promptTokens: 5, completionTokens: 5 } } });
    if (u.includes("/embedding/v2")) return json({ result: { embedding: [0.1, 0.2] } });
    if (u.endsWith("/rpc/match_chunks")) return json([{ id: 1, title: "휴학 안내", url: "https://www.hufs.ac.kr/hufs/11387/subview.do", text: "휴학은 최대 3년까지 할 수 있습니다.", similarity: 0.9 }]);
    if (new URL(u).pathname === "/rest/v1/chunks") {
      assert.equal(init.method, "GET");
      assert.equal(new URL(u).searchParams.get("select"), "id,collected_at");
      assert.equal(new URL(u).searchParams.get("id"), "in.(1)");
      return json([{ id: 1, collected_at: "2026-11-24T16:00:00Z" }]);
    }
    if (u.includes("HCX-005")) return json({ result: { message: { content: "휴학은 최대 3년까지 가능합니다. [1]" }, finishReason: "stop", usage: { promptTokens: 20, completionTokens: 10 } } });
    throw new Error(`unexpected fetch ${u}`);
  };
  const logs = []; const origLog = console.log; console.log = (...a) => logs.push(a.join(" "));
  try {
    const { default: handler } = await import("../api/ask.js");
    const call = async (question, headers = {}) => { const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } }; await handler({ method: "POST", headers: { "x-forwarded-for": "203.0.113.99", ...headers }, body: { question, lang: "ko" } }, res); return res; };
    const r1 = await call("휴학은 최대 몇 년이야?"); assert.equal(r1.code, 200);
    assert.equal(r1.body.sources[0].collectedAt, "2026-11-25");
    assert.equal(calls.filter((c) => new URL(c.url).pathname === "/rest/v1/chunks").length, 1);
    assert.equal(store.size, 1); assert.equal(JSON.parse(logs.at(-1)).cacheHit, false);
    calls.length = 0; const r2 = await call("  휴학은  최대 몇 년이야?? "); assert.equal(r2.code, 200); assert.deepEqual(r2.body, r1.body); assert.deepEqual(calls.map((c) => new URL(c.url).pathname), ["/rest/v1/rpc/get_answer_cache"]); assert.equal(JSON.parse(logs.at(-1)).cacheHit, true); assert.equal(JSON.parse(logs.at(-1)).limit, "memory-first");
    calls.length = 0; const r3 = await call("휴학은 최대 몇 년이야?", { "x-ask-eval-token": "test-eval-token" }); assert.equal(r3.code, 200);
    assert.equal(r3.body.sources[0].collectedAt, "2026-11-25");
    assert.equal(calls.some((c) => c.url.includes("answer_cache")), false); assert.equal(JSON.parse(logs.at(-1)).cacheHit, false);
  } finally { globalThis.fetch = origFetch; console.log = origLog; for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});
