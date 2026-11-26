// 검색창 답변 다듬기(api/_lib/answerFormat.js)와 api/ask.js 연결을 확인합니다. 네트워크는 부르지 않습니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { stripListNumbers, dropInvalidCitations, trimTruncated, isRefusalAnswer } from "../api/_lib/answerFormat.js";

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

// ── 출력 토큰 상한에 걸려 끊긴 답(11/22~ ANSWER_MAX_TOKENS 400) ──
test("trimTruncated: 문장 중간에서 끊기면 마지막으로 끝난 문장(뒤 인용 포함)까지만", () => {
  assert.deepEqual(trimTruncated("휴학은 학기 시작 전에 신청합니다. [1] 군입대 휴학은 입대일 기준으로 신청하며 [2"),
    { text: "휴학은 학기 시작 전에 신청합니다. [1]", sentences: 1 });
  assert.deepEqual(trimTruncated("첫 문장입니다 [1]. 둘째 문장입니다. [2][3]\n셋째 문장은 끝나지 않"),
    { text: "첫 문장입니다 [1]. 둘째 문장입니다. [2][3]", sentences: 2 });
  // 물음표 · 느낌표도 문장 끝
  assert.equal(trimTruncated("가능할까요? 네, 가능합니다! 다만 조건").text, "가능할까요? 네, 가능합니다!");
});

test("trimTruncated: 숫자 뒤 마침표(평점 4. · 2026.)는 문장 끝으로 보지 않음", () => {
  assert.deepEqual(trimTruncated("조기졸업은 평점 4."), { text: "", sentences: 0 });
  assert.deepEqual(trimTruncated("졸업 평점은 2.00 이상입니다. [1] 조기졸업은 평점 4."),
    { text: "졸업 평점은 2.00 이상입니다. [1]", sentences: 1 });
  assert.equal(trimTruncated("개강은 2026.03.02 입니다. 종강은 2026.").text, "개강은 2026.03.02 입니다.");
});

test("trimTruncated: 끝난 문장이 하나도 없으면 sentences 0", () => {
  assert.deepEqual(trimTruncated("휴학 신청은 종합정보시스템에서 [1"), { text: "", sentences: 0 });
  assert.deepEqual(trimTruncated(""), { text: "", sentences: 0 });
});

// ask.js 연결: 가짜 fetch로 HCX-005의 finishReason을 바꿔 가며 확인
async function askWith(reply, finishReason, ip) {
  const ENV = { ASK_IP_SALT: "test-salt", SUPABASE_URL: "https://db.example.test", SUPABASE_SERVICE_KEY: "test-service-key", CLOVA_API_KEY: "test-clova-key" };
  const saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  let maxTokens = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    if (u.includes("/rpc/ask_hit")) return json([{ allowed: true, reason: null, retry_after: 0, minute_hits: 1, day_hits: 1, global_hits: 1 }]);
    if (u.includes("HCX-DASH-002")) return json({ result: { message: { content: '{"queries": ["휴학 신청 방법"]}' }, finishReason: "stop" } });
    if (u.includes("/embedding/v2")) return json({ result: { embedding: [0.1] } });
    if (u.includes("/rpc/match_chunks")) {
      return json([
        { id: "11387-01", title: "휴·복학", url: "https://www.hufs.ac.kr/hufs/11387/subview.do", text: "휴학은 학기 시작 전에 종합정보시스템에서 신청한다.", similarity: 0.8 },
        { id: "11387-02", title: "휴·복학", url: "https://www.hufs.ac.kr/hufs/11387/subview.do", text: "군입대 휴학은 입대일 기준으로 신청한다.", similarity: 0.79 },
      ]);
    }
    if (u.includes("HCX-005")) {
      maxTokens = JSON.parse(init.body).maxTokens;
      return json({ result: { message: { content: reply }, finishReason, usage: { promptTokens: 1000, completionTokens: 400 } } });
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
    await handler({ method: "POST", headers: { "x-forwarded-for": ip }, body: { question: "휴학 신청 방법 알려줘", lang: "ko" } }, res);
    return { body: res.body, log: JSON.parse(logs.at(-1)), maxTokens };
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("ask.js: 출력 상한 400을 보내고, 끊긴 답은 끝난 문장까지만 · 로그 truncated true", async () => {
  const r = await askWith("휴학은 학기 시작 전에 종합정보시스템에서 신청합니다. [1] 군입대 휴학은 입대일 기준으로 신청하며 [2", "length", "203.0.113.110");
  assert.equal(r.maxTokens, 400);
  assert.equal(r.body.mode, "ai");
  assert.equal(r.body.answer, "휴학은 학기 시작 전에 종합정보시스템에서 신청합니다. [1]");
  assert.deepEqual(r.body.sources.map((s) => s.refs), [[1]]);
  assert.equal(r.log.truncated, true);
  assert.equal(r.log.finishReason, "length");
});

test("ask.js: 끊긴 답에 끝난 문장이 없으면 원문 보여 주기(evidence) · 로그 truncated true", async () => {
  const r = await askWith("휴학은 학기 시작 전에 종합정보시스템에서 신청하며 [1", "length", "203.0.113.111");
  assert.equal(r.body.mode, "evidence");
  assert.match(r.body.answer, /종합정보시스템에서 신청한다/);
  assert.equal(r.log.mode, "evidence");
  assert.equal(r.log.truncated, true);
});

test("ask.js: 끊기지 않은 답은 그대로 · 로그 truncated false", async () => {
  const r = await askWith("휴학은 학기 시작 전에 종합정보시스템에서 신청합니다. [1] 군입대 휴학은 입대일 기준으로 신청합니다. [2]", "stop", "203.0.113.112");
  assert.equal(r.body.mode, "ai");
  assert.equal(r.body.answer, "휴학은 학기 시작 전에 종합정보시스템에서 신청합니다. [1] 군입대 휴학은 입대일 기준으로 신청합니다. [2]");
  assert.equal(r.log.truncated, false);
});

// ── 거절만 하는 답(근거 번호 없음) → "찾지 못함"(11/26 셔틀버스) ──
test("isRefusalAnswer: 근거 번호 없이 거절 표현만 있으면 true(실제 사례)", () => {
  // 11/26 시험용 DB eval: 근거에 없는 부서 · 앱 이름을 지어낸 답
  assert.equal(isRefusalAnswer("셔틀버스 시간표에 대한 정보는 공개되어 있지 않습니다. 담당 부서인 교무팀에 문의하시거나 'HUFS Dormitory' 앱에서 확인하시기 바랍니다."), true);
  // 11/26 #98 eval: 정상 거절
  assert.equal(isRefusalAnswer("셔틀버스 시간표에 대한 내용은 공개된 학사 안내에서 찾지 못했습니다. 담당 부서에 확인해 주세요."), true);
  assert.equal(isRefusalAnswer("셔틀버스 시간표에 대한 정보는 제공해 드리는 자료에서 찾을 수 없습니다. 담당 부서에 문의하시기 바랍니다."), true);
  assert.equal(isRefusalAnswer("그 내용은 학사 안내에 나와 있지 않습니다."), true);
});

test("isRefusalAnswer: 근거 번호가 있으면 일부에 '찾지 못했어요'가 있어도 false", () => {
  assert.equal(isRefusalAnswer("수강신청은 최대 19학점까지 가능합니다. [1] 다만 그 내용은 공개된 학사 안내에서 찾지 못했어요."), false);
  assert.equal(isRefusalAnswer("후기 이중전공은 9학기 이수가 필수입니다. [5]"), false);
  assert.equal(isRefusalAnswer("Graduation requires a GPA of 2.0. [2]"), false);
});

test("isRefusalAnswer: '제공해 드릴 수 없' · '제공해 드리기 어렵'도 근거 번호가 없으면 거절(11/27 추가)", () => {
  // 11/27 시험용 Preview 범위 밖 점검 "학교 근처 맛집 추천해줘": 근거 번호 없이 mode ai로 남았던 답
  assert.equal(isRefusalAnswer("죄송합니다만 학교 근처 맛집에 대한 정보는 제공해 드릴 수 없습니다. 사용자님께서 학교 근처 맛집을 찾고 싶으시다면 인터넷 검색 또는 지도 앱을 이용하시는 것을 추천드립니다."), true);
  // 11/26 셔틀버스 재확인과 같은 표현(띄어쓰기가 달라도 같음)
  assert.equal(isRefusalAnswer("셔틀버스 시간표는 제공해 드리기 어렵습니다. 학교 홈페이지를 확인해 주세요."), true);
  assert.equal(isRefusalAnswer("셔틀버스 시간표는 제공해드리기 어렵습니다."), true);
  assert.equal(isRefusalAnswer("그 정보는 제공해드릴 수 없습니다."), true);
});

test("isRefusalAnswer: '제공해 드릴 수 없'이 있어도 근거 번호가 있으면 정상 답(false)", () => {
  // 11/27 범위 밖 점검 "교수님 이메일": 근거 번호가 붙은 답은 지금처럼 그대로 둠
  assert.equal(isRefusalAnswer("개인정보 보호를 위해 특정 인물의 이메일 주소는 제공해 드릴 수 없습니다. 교수님의 이메일 정보는 학교 홈페이지 또는 학과 사무실을 통해 확인하시기 바랍니다. [1]"), false);
  assert.equal(isRefusalAnswer("실시간 메뉴는 제공해 드리기 어렵습니다. 학생 식당 전화는 02)2173-2211입니다. [2]"), false);
});

test("isRefusalAnswer: 영어 거절 · 빈 값", () => {
  assert.equal(isRefusalAnswer("I couldn't find the shuttle bus timetable in the provided materials."), true);
  assert.equal(isRefusalAnswer("That information is not available in the academic guides."), true);
  assert.equal(isRefusalAnswer("There is no information about the shuttle bus."), true);
  assert.equal(isRefusalAnswer(""), false);
  assert.equal(isRefusalAnswer(null), false);
  // 거절 표현이 없는 번호 없는 답은 거절이 아님(다른 검사가 맡음)
  assert.equal(isRefusalAnswer("수강신청 기간은 학사 공지를 확인하세요."), false);
});

test("ask.js: AI가 근거 번호 없이 거절만 하면 mode none으로 바꾸고, 답 내용은 로그 · 캐시에 남기지 않음", async () => {
  const ENV = { ASK_IP_SALT: "test-salt", SUPABASE_URL: "https://db.example.test", SUPABASE_SERVICE_KEY: "test-service-key", CLOVA_API_KEY: "test-clova-key" };
  const saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  const REFUSAL = "셔틀버스 시간표에 대한 정보는 공개되어 있지 않습니다. 담당 부서인 교무팀에 문의하시거나 'HUFS Dormitory' 앱에서 확인하시기 바랍니다.";
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    if (u.includes("/rpc/ask_hit")) return json([{ allowed: true, reason: null, retry_after: 0, minute_hits: 1, day_hits: 1, global_hits: 1 }]);
    if (u.includes("/rpc/get_answer_cache")) return json([]);
    if (u.includes("/rpc/set_answer_cache")) return json([]);
    if (u.includes("HCX-DASH-002")) return json({ result: { message: { content: '{"queries": ["셔틀버스 시간표"]}' }, finishReason: "stop" } });
    if (u.includes("/embedding/v2")) return json({ result: { embedding: [0.1] } });
    if (u.includes("/rpc/match_chunks")) return json([{ id: "11316-03", title: "복지", url: "https://www.hufs.ac.kr/c", text: "학생 식당 운영 시간", similarity: 0.61 }]);
    if (u.includes("HCX-005")) return json({ result: { message: { content: REFUSAL }, finishReason: "stop", usage: { promptTokens: 10, completionTokens: 5 } } });
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
    await handler({ method: "POST", headers: { "x-forwarded-for": "203.0.113.96" }, body: { question: "서울캠퍼스 셔틀버스 시간표 알려줘", lang: "ko" } }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body, { mode: "none", answer: null, sources: [] });
    const log = JSON.parse(logs.at(-1));
    assert.equal(log.mode, "none");
    assert.equal(log.reason, "refusal");
    assert.ok(!logs.some((line) => line.includes("교무팀") || line.includes("Dormitory") || line.includes("셔틀버스")), "로그에 질문 · 답 내용 없음");
    assert.ok(!calls.some((u) => u.includes("/rpc/set_answer_cache")), "답변 캐시에 저장하지 않음");
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
