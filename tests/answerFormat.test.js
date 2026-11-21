// 검색창 답변 다듬기(api/_lib/answerFormat.js)와 api/ask.js 연결을 확인합니다. 네트워크는 부르지 않습니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { stripListNumbers, dropInvalidCitations } from "../api/_lib/answerFormat.js";

test("stripListNumbers: 줄 맨 앞 목록 번호(1. · 2) · ①)만 지움", () => {
  assert.equal(stripListNumbers("1. 조기졸업 조건입니다. [1]\n2) 졸업 조건입니다. [2]\n  3. 들여쓴 번호\n① 동그라미 번호"),
    "조기졸업 조건입니다. [1]\n졸업 조건입니다. [2]\n들여쓴 번호\n동그라미 번호");
  // 문장 안의 숫자 · 줄 맨 앞 날짜 · 연도는 그대로
  assert.equal(stripListNumbers("평점 3.0 이상입니다. 2. 입니다"), "평점 3.0 이상입니다. 2. 입니다");
  assert.equal(stripListNumbers("2026.03.02 개강\n2025. 신청"), "2026.03.02 개강\n2025. 신청");
  assert.equal(stripListNumbers(""), "");
});

test("dropInvalidCitations: 넘긴 자료 수를 넘는 번호 · 0번은 지우고 개수를 셈", () => {
  assert.deepEqual(dropInvalidCitations("조기졸업은 평점 기준이 있습니다 [1][4]. 졸업도 기준이 있습니다 [5] [6].", 3),
    { text: "조기졸업은 평점 기준이 있습니다 [1]. 졸업도 기준이 있습니다.", dropped: 3 });
  assert.deepEqual(dropInvalidCitations("근거 [0] 와 [2] 입니다.", 2), { text: "근거 와 [2] 입니다.", dropped: 1 });
  assert.deepEqual(dropInvalidCitations("모두 맞는 번호 [1] [2] [3]", 3), { text: "모두 맞는 번호 [1] [2] [3]", dropped: 0 });
  assert.deepEqual(dropInvalidCitations("자료가 없을 때 [1]", 0), { text: "자료가 없을 때", dropped: 1 });
});

test("ask.js: 번호 목록을 지우고, 자료 수를 넘는 인용은 지운 뒤 출처도 실제 번호만", async () => {
  const ENV = { ASK_IP_SALT: "test-salt", SUPABASE_URL: "https://db.example.test", SUPABASE_SERVICE_KEY: "test-service-key", CLOVA_API_KEY: "test-clova-key" };
  const saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  let systemPrompt = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    if (u.includes("/rpc/ask_hit")) return json([{ allowed: true, reason: null, retry_after: 0, minute_hits: 1, day_hits: 1, global_hits: 1 }]);
    if (u.includes("HCX-DASH-002")) return json({ result: { message: { content: '{"queries": ["조기졸업 평점 기준"]}' }, finishReason: "stop" } });
    if (u.includes("/embedding/v2")) return json({ result: { embedding: [0.1] } });
    if (u.includes("/rpc/match_chunks")) {
      return json([
        { title: "조기졸업", url: "https://www.hufs.ac.kr/a", text: "조기졸업은 평점평균 4.0 이상", similarity: 0.8 },
        { title: "졸업", url: "https://www.hufs.ac.kr/b", text: "졸업 평점평균 2.0 이상", similarity: 0.79 },
      ]);
    }
    if (u.includes("HCX-005")) {
      systemPrompt = JSON.parse(init.body).messages[0].content;
      return json({ result: { message: { content: "1. 조기졸업은 평점 4.0 이상입니다. [1][4]\n2. 졸업에는 평점 2.0 이상이 필요합니다. [2][5]" }, finishReason: "stop", usage: { promptTokens: 10, completionTokens: 5 } } });
    }
    throw new Error(`unexpected fetch ${u}`);
  };
  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...a) => logs.push(a.join(" "));
  console.error = () => {};
  try {
    const { default: handler } = await import("../api/ask.js");
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    await handler({ method: "POST", headers: { "x-forwarded-for": "203.0.113.95" }, body: { question: "조기졸업 조건 평점과 졸업에 필요한 평점은 각각 몇 이상이야?", lang: "ko" } }, res);
    assert.equal(res.body.mode, "ai");
    assert.equal(res.body.answer, "조기졸업은 평점 4.0 이상입니다. [1]\n졸업에는 평점 2.0 이상이 필요합니다. [2]");
    assert.deepEqual(res.body.sources.map((s) => s.refs), [[1], [2]]);
    const log = JSON.parse(logs.at(-1));
    assert.equal(log.droppedCitations, 2);
    assert.match(systemPrompt, /번호 목록\(1\. 2\. 3\.\)이나 ① ② 없이/);
    assert.match(systemPrompt, /\[자료\]에 실제로 있는 번호만 쓴다/);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
