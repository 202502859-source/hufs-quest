// 학사일정 바로 찾기(shared/calendarRoute.js, C03)와 api/ask.js 연결을 확인합니다. 오늘 날짜를 넣어서 확인하고, 네트워크는 부르지 않습니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { routeCalendar, findTerm, semesterLabel } from "../shared/calendarRoute.js";

const TODAY = "2026-11-27"; // 2026학년도 2학기

test("'2학기 수강취소 기간' → 아직 끝나지 않은 2학기(2026-2)의 9/22~28, 연도를 안 말했으니 termBasis", () => {
  const r = routeCalendar("2학기 수강취소 기간", { today: TODAY });
  assert.equal(r.clarify, false);
  assert.equal(r.semester, "2026-2");
  assert.deepEqual(r.lines, ["[학사일정 바로 찾기] 2026학년도 제2학기 > 2026.09.22 ~ 2026.09.28: 수강신청 취소"]);
  assert.deepEqual(r.termBasis, { semester: "2026-2", label: "2026학년도 2학기", labelEn: "2026 Fall (2nd semester)" });
  assert.equal(r.doc.title, "학사일정 바로 찾기");
  assert.equal(r.doc.url, "https://www.hufs.ac.kr/hufs/11360/subview.do");
});

test("'1학기 중간고사 언제야'(11/27 기준) → 2027-1 기본값 + 2026-1 대안", () => {
  const r = routeCalendar("1학기 중간고사 언제야", { today: TODAY });
  assert.equal(r.semester, "2027-1");
  assert.deepEqual(r.lines, ["[학사일정 바로 찾기] 2027학년도 제1학기 > 2027.04.20 ~ 2027.04.26: 제1학기 중간시험"]);
  assert.equal(r.termBasis.label, "2027학년도 1학기");
  assert.deepEqual(r.alternatives, [
    { semester: "2026-1", label: "2026학년도 1학기", labelEn: "2026 Spring (1st semester)", question: "2026학년도 1학기 중간고사 언제야" },
  ]);
  // 2027학년도 화면에서 나온 일정이라 출처도 그 화면
  assert.equal(r.doc.url, "https://www.hufs.ac.kr/hufs/11360/subview.do?year=2027");
});

test("'사전수강신청 언제야' → 2027.02.01(targetSemester 2027-1)", () => {
  const r = routeCalendar("사전수강신청 언제야", { today: TODAY });
  assert.equal(r.semester, "2027-1");
  assert.deepEqual(r.lines, ["[학사일정 바로 찾기] 2027학년도 제1학기 > 2027.02.01: 사전수강신청"]);
  assert.equal(r.termBasis.label, "2027학년도 1학기");
  assert.ok(r.alternatives.length >= 1 && r.alternatives.length <= 2);
});

test("'수강신청 언제야' → 2027-1의 2~4학년 · 1학년 두 줄(같은 학기의 같은 이름 항목 전부), 변경 · 취소 · 사전은 빼기", () => {
  const r = routeCalendar("수강신청 언제야", { today: TODAY });
  assert.equal(r.semester, "2027-1");
  assert.deepEqual(r.lines, [
    "[학사일정 바로 찾기] 2027학년도 제1학기 > 2027.02.10 ~ 2027.02.12: 수강신청(2~4학년)",
    "[학사일정 바로 찾기] 2027학년도 제1학기 > 2027.02.22 ~ 2027.02.23: 수강신청(1학년, 전체)",
  ]);
  assert.ok(r.alternatives.length <= 2);
  assert.ok(r.alternatives.every((a) => a.semester !== "2027-1" && a.question.endsWith("수강신청 언제야")));
});

test("날짜 질문이 아니거나 맞는 일정이 없으면 null(지금과 똑같이 검색)", () => {
  for (const q of [
    "졸업하려면 몇 학점 필요해?",
    "수강신청 변경 기간에 여석이 있는 과목을 추가할 수 있어?", // '기간에'는 날짜를 묻는 말이 아님
    "4학년은 수강취소로 12학점 미만이 되거나 전체 과목을 취소해도 돼?",
    "이중전공은 몇 학년부터 시작해?", // 날짜 말은 있지만 학사일정 항목이 아님
    "도서관 운영 시간 알려줘",
    "2028년 1학기 개강일이 언제야?", // 2028학년도 일정표 없음
    "2028학년도 개강일 알려줘",
  ]) {
    assert.equal(routeCalendar(q, { today: TODAY }), null, q);
  }
  assert.equal(routeCalendar("수강신청 언제야", {}), null); // 오늘 날짜가 없으면 하지 않음
});

test("clarify(방식 A): 후보 일정이 모두 지났으면 answer 없이 학기 버튼만", () => {
  const r = routeCalendar("중간고사 언제야", { today: "2028-12-01" });
  assert.equal(r.clarify, true);
  assert.equal(r.topic, "midterm");
  assert.deepEqual(r.alternatives.map((a) => a.question), ["2027학년도 2학기 중간고사 언제야", "2027학년도 1학기 중간고사 언제야"]);
  assert.equal(r.lines, undefined);
});

test("clarify(방식 A): 같은 날짜의 후보 학기가 둘이면 고르지 않음", () => {
  const calendar = {
    items: [
      { id: "a", targetSemester: "2027-1", name: "제1학기 중간시험", startDate: "2027-04-20", endDate: "2027-04-26", sourceUrl: "u" },
      { id: "b", targetSemester: "2027-2", name: "제2학기 중간시험", startDate: "2027-04-20", endDate: "2027-04-26", sourceUrl: "u" },
    ],
  };
  assert.equal(routeCalendar("중간고사 언제야", { today: TODAY, calendar }).clarify, true);
});

test("질문에 학년도 · 학기가 있으면 그대로, termBasis 없음(C01 · C02 · C03 · C07 같은 질문)", () => {
  const cases = [
    ["2026년 1학기 수강신청 변경 기간은?", "2026-1", ["2026.03.03 ~ 2026.03.09: 수강신청 변경"]],
    ["2026년 1학기 기말고사 기간은?", "2026-1", ["2026.06.16 ~ 2026.06.22: 제1학기 기말시험"]],
    ["2026년 2학기 정규 수강신청 기간은?", "2026-2", ["2026.08.10 ~ 2026.08.14: 수강신청"]],
    ["2027년 1학기 2~4학년 수강신청은 언제야?", "2027-1", ["2027.02.10 ~ 2027.02.12: 수강신청(2~4학년)", "2027.02.22 ~ 2027.02.23: 수강신청(1학년, 전체)"]],
    ["2026년 2학기 final exam 기간 알려줘.", "2026-2", ["2026.12.15 ~ 2026.12.21: 제2학기 기말시험"]],
  ];
  for (const [q, semester, rows] of cases) {
    const r = routeCalendar(q, { today: TODAY });
    assert.equal(r.semester, semester, q);
    assert.deepEqual(r.lines.map((l) => l.replace(/^.* > /, "")), rows, q);
    assert.equal(r.termBasis, null, q);
  }
});

test("이번 · 다음 · 지난 학기, 계절학기, 학기 이름 표기", () => {
  assert.equal(findTerm("이번 학기 중간고사 언제야", TODAY).semester, "2026-2");
  assert.equal(findTerm("다음 학기 수강신청 언제야", TODAY).semester, "2027-1");
  assert.equal(findTerm("지난 학기 성적 정정 기간", TODAY).semester, "2026-1");
  assert.equal(findTerm("1학기 개강 언제야", "2027-02-10").semester, "2027-1");
  assert.equal(findTerm("2학기 개강 언제야", "2027-02-10").semester, "2026-2"); // 2026-2는 2월 말까지
  const winter = routeCalendar("겨울 계절학기 개강 언제야?", { today: TODAY });
  assert.equal(winter.semester, "2026-winter");
  assert.deepEqual(winter.lines, ["[학사일정 바로 찾기] 2026학년도 겨울 계절학기 > 2026.12.22: 동계방학 및 계절학기 개강"]);
  // "개강"만 물으면 계절학기 개강은 빼고 다음 정규 학기 개강
  assert.deepEqual(routeCalendar("개강 언제야?", { today: TODAY }).lines, ["[학사일정 바로 찾기] 2027학년도 제1학기 > 2027.03.02: 2027학년도 제1학기 개강"]);
  assert.equal(semesterLabel("2027-summer"), "2027학년도 여름 계절학기");
  assert.equal(semesterLabel("2027-winter", "en"), "2027 Winter session");
});

// ── api/ask.js 연결 ──
function fakeFetch(answers, calls) {
  return async (url, init) => {
    const u = String(url);
    calls.push(u);
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    if (u.includes("/rpc/ask_hit")) return json([{ allowed: true, reason: null, retry_after: 0, minute_hits: 1, day_hits: 1, global_hits: 1 }]);
    if (u.includes("HCX-DASH-002")) return { ok: false, status: 500, json: async () => ({}) };
    if (u.includes("/embedding/v2")) return json({ result: { embedding: [0.1] } });
    if (u.includes("/rpc/match_chunks")) return json([{ id: "11360-03", title: "학사일정(대학)", url: "https://www.hufs.ac.kr/hufs/11360/subview.do", text: "2026.12.15 ~ 2026.12.21: 제2학기 기말시험", similarity: 0.7 }]);
    if (u.includes("HCX-005")) {
      const prompt = JSON.parse(init.body).messages.map((m) => m.content).join("\n");
      return json({ result: { message: { content: answers.shift()(prompt) }, finishReason: "stop", usage: { promptTokens: 10, completionTokens: 5 } } });
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

test("ask.js: 날짜 질문은 학사일정 바로 찾기 줄을 근거 1순위로 넣고 termBasis · alternatives를 붙임, 아니면 예전과 같음", async () => {
  const ENV = { ASK_IP_SALT: "test-salt", SUPABASE_URL: "https://db.example.test", SUPABASE_SERVICE_KEY: "test-service-key", CLOVA_API_KEY: "test-clova-key" };
  const saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  const calls = [];
  let firstDoc = "";
  const answers = [
    (prompt) => {
      // [자료] 다음의 첫 자료(2번 자료 앞까지)
      const material = prompt.slice(prompt.lastIndexOf("[자료]"));
      firstDoc = material.slice(0, material.indexOf("[2]") > 0 ? material.indexOf("[2]") : undefined);
      return "2학기 수강신청 취소 기간은 2026년 9월 22일부터 9월 28일까지입니다. [1]";
    },
    () => "2026학년도 2학기 기말시험은 2026년 12월 15일부터 12월 21일까지입니다. [1]",
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch(answers, calls);
  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...a) => logs.push(a.join(" "));
  console.error = () => {};
  try {
    const { default: handler } = await import("../api/ask.js");
    const call = async (question, ip) => {
      const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
      await handler({ method: "POST", headers: { "x-forwarded-for": ip }, body: { question, lang: "ko" } }, res);
      return res;
    };
    // 오늘 날짜에 따라 기본 학기가 달라지므로, 이 테스트는 "날짜 질문이면 바로 찾기 근거가 들어간다"만 확인합니다.
    const routed = await call("2026년 2학기 수강취소 기간은?", "203.0.113.80");
    assert.equal(routed.body.mode, "ai");
    assert.equal(routed.body.termBasis, undefined); // 연도를 말했으므로 기준 학기 안내 없음
    assert.ok(Array.isArray(routed.body.alternatives));
    assert.ok(routed.body.alternatives.every((a) => a.label && a.question));
    assert.match(firstDoc, /학사일정 바로 찾기/);
    assert.match(firstDoc, /2026\.09\.22 ~ 2026\.09\.28: 수강신청 취소/);
    assert.ok(!calls.some((u) => u.includes("get_answer_cache"))); // 날짜 질문은 캐시를 쓰지 않음
    const log = JSON.parse(logs.at(-1));
    assert.equal(log.calendar, "route");
    assert.equal(log.calendarSemester, "2026-2");
    assert.equal(/수강취소|9월 22일/.test(logs.join("\n")), false); // 질문 · 답 내용은 로그에 없음

    // 날짜 질문이 아니면 응답에 새 칸이 없음
    const plain = await call("2026년 2학기 기말시험 범위는 어떻게 정해?", "203.0.113.81");
    assert.equal(plain.body.mode, "ai");
    assert.equal("termBasis" in plain.body, false);
    assert.equal("alternatives" in plain.body, false);
    assert.equal(JSON.parse(logs.at(-1)).calendar, undefined);
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
