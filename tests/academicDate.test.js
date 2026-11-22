// 검색창 날짜 처리(shared/academicDate.js)와 api/ask.js의 날짜 근거 검사를 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { datesIn, seoulToday, todayContext, ungroundedDates } from "../shared/academicDate.js";

// 한국 시간 정오로 만들어 날짜 경계 문제 없이 학기만 봅니다.
const kstNoon = (date) => new Date(`${date}T12:00:00+09:00`);

test("학기 경계: 2~3월 · 6~7월 · 8~9월 · 12~1월", () => {
  const cases = [
    ["2026-02-28", 2025, "겨울방학"],
    ["2026-03-01", 2026, "제1학기"],
    ["2026-06-30", 2026, "제1학기"],
    ["2026-07-01", 2026, "여름방학"],
    ["2026-08-31", 2026, "여름방학"],
    ["2026-09-01", 2026, "제2학기"],
    ["2026-12-31", 2026, "제2학기"],
    ["2027-01-01", 2026, "겨울방학"],
  ];
  for (const [date, academicYear, term] of cases) {
    const t = seoulToday(kstNoon(date));
    assert.equal(t.date, date);
    assert.equal(t.academicYear, academicYear, date);
    assert.equal(t.term.ko, term, date);
  }
});

test("서버(UTC)와 한국 날짜가 다른 시각은 한국 날짜 기준", () => {
  const t = seoulToday(new Date("2026-08-31T15:30:00Z")); // 한국 9/1 00:30
  assert.equal(t.date, "2026-09-01");
  assert.equal(t.term.ko, "제2학기");
  const u = seoulToday(new Date("2026-12-31T15:00:00Z")); // 한국 2027-01-01 00:00
  assert.equal(u.date, "2027-01-01");
  assert.equal(u.academicYear, 2026);
  assert.equal(u.term.ko, "겨울방학");
  assert.equal(seoulToday(new Date("2026-02-28T14:59:59Z")).term.ko, "겨울방학"); // 한국 2/28 23:59
});

test("AI에 넘기는 문장: 오늘 날짜 · 요일 · 학년도 · 학기", () => {
  const now = new Date("2026-11-20T03:00:00Z"); // 한국 11/20(금) 12:00
  assert.equal(todayContext(now), "오늘은 2026-11-20(금), 2026학년도 제2학기입니다. '이번 학기'·'다음 달' 같은 말은 이 날짜 기준으로 해석하세요.");
  assert.match(todayContext(now, "en"), /^Today is 2026-11-20 \(Fri, Korea time\), in the 2nd semester of the 2026 academic year\./);
});

test("날짜 표기 맞추기: YYYY.MM.DD · YYYY년 M월 D일 · YYYY-MM-DD", () => {
  assert.deepEqual([...datesIn("2026.03.02 개강, 2026년 3월 2일, 2026-03-02, 2026. 3. 2.")], ["2026-03-02"]);
  assert.deepEqual([...datesIn("2026년 10월 20일부터 26일까지")], ["2026-10-20"]); // 연도 없는 끝 날짜는 세지 않음
  assert.deepEqual([...datesIn("2026학년도 2학기, 4.0 이상, 126학점")], []);
  // 근거 쪽: 기간 끝 날짜에 연도가 없으면 앞 날짜 연도를 붙임
  assert.deepEqual([...datesIn("2026.10.20 ~ 10.26: 제2학기 중간시험", { rangeEnds: true })].sort(), ["2026-10-20", "2026-10-26"]);
});

test("근거에 2026.03.02만 있을 때: 2027년 3월 2일은 차단, 2026년 3월 2일은 통과, 날짜 없는 답변은 영향 없음", () => {
  const docs = [{ title: "학사일정(대학) > 2026학년도 제1학기", text: "2026.03.02: 2026학년도 제1학기 개강·대체휴업일" }];
  assert.deepEqual(ungroundedDates("2027년 1학기 개강일은 2027년 3월 2일입니다. [1]", docs), ["2027-03-02", "2027년"]);
  assert.deepEqual(ungroundedDates("2026학년도 1학기 개강일은 2026년 3월 2일입니다. [1]", docs), []);
  assert.deepEqual(ungroundedDates("개강일은 2026.03.02입니다. [1]", docs), []);
  assert.deepEqual(ungroundedDates("졸업하려면 126학점이 필요합니다. [1]", docs), []);
});

test("근거 '2026.03.02: 제1학기 개강'만 있을 때: 학년도 · 월일 검사", () => {
  const docs = [{ title: "학사일정(대학)", text: "2026.03.02: 제1학기 개강" }];
  assert.deepEqual(ungroundedDates("2027학년도 1학기 개강은 3월 2일입니다. [1]", docs), ["2027학년도"]); // 차단
  assert.deepEqual(ungroundedDates("3월 2일에 개강해요. [1]", docs), []); // 통과
  assert.deepEqual(ungroundedDates("2026학년도 1학기 개강은 3월 2일입니다. [1]", docs), []); // 통과: 2026.03.02는 2026학년도
  assert.deepEqual(ungroundedDates("2027년에 개강해요. [1]", docs), ["2027년"]); // 근거에 없는 연도 단독
  assert.deepEqual(ungroundedDates("4월 31일까지 신청하세요. [1]", docs), ["04-31"]); // 근거에 없는 월·일
  assert.deepEqual(ungroundedDates("10.26까지 신청하세요. [1]", docs), ["10-26"]); // MM.DD 표기
  assert.deepEqual(ungroundedDates("개강은 학기 초에 해요. 평점 3.5 이상, 4.0 이상이면 돼요. [1]", docs), []); // 날짜 · 연도 없음
});

test("학년도: 1~2월 날짜는 전년도 학년도, 근거에 'YYYY학년도' 글자가 있어도 통과", () => {
  const winter = [{ title: "학사일정(대학)", text: "2027.02.26: 학위수여식" }];
  assert.deepEqual(ungroundedDates("2026학년도 학위수여식은 2월 26일이에요. [1]", winter), []);
  assert.deepEqual(ungroundedDates("2027학년도 학위수여식은 2월 26일이에요. [1]", winter), ["2027학년도"]);
  const text = [{ title: "졸업이수학점", text: "2025학년도 이후 입학생: 126학점" }];
  assert.deepEqual(ungroundedDates("2025학년도 이후 입학생은 126학점이에요. [1]", text), []);
});

// 기존 eval 학사 문항의 실제 답변(data/eval/20261120-1214.json)이 실제 근거 조각(data/chunks.json, 같은 출처 페이지의 조각 전부)으로 잘못 막히지 않는지
test("실제 조각: 졸업학점 · 최우등 · 휴학 · 조기졸업 · 이중전공 답변은 막히지 않음", async () => {
  const { readFile } = await import("node:fs/promises");
  const chunks = JSON.parse(await readFile(new URL("../data/chunks.json", import.meta.url), "utf8"));
  const page = (n) => chunks.filter((c) => c.url === `https://www.hufs.ac.kr/hufs/${n}/subview.do`);
  const cases = [
    ["11373", "2025학년도 이후 입학생이 졸업을 하려면 126학점을 이수해야 합니다. 단 융합 인재 대학에 속한 학생이라면 150학점을 이수해야 합니다. 전공 및 이중 전공: 42학점\n부전공: 21학점\n전공 심화 + 부전공: 54학점, 부전공 21학점\n전공 심화(단일 전공): 54학점 [1][2]"],
    ["11390", "최우등 졸업 기준은 졸업 성적 평점이 4.25 이상입니다. 이는 2026년 전기(2월) 졸업생부터 적용되며, 학위증 및 학적부에 기재됩니다[1]."],
    ["11387", "휴학은 최대 3년까지 할 수 있습니다. 단, 2012학년도 제2학기 3학년 편입학생부터는 2년을 초과할 수 없습니다. 또한 일반 휴학 기간은 1년에 1회씩 분할하여 신청해야 합니다[2]."],
    ["11389", "조기졸업 시 7학기만에 졸업합니다. 다만, 총 평점 평균 4.00 미만이거나 1개 학기라도 3.75 미만인 경우, 7학기까지 졸업요건을 채우지 못하면 조기졸업 자격이 취소되어 8학기를 등록해야 합니다[1]."],
    ["11384", "25학번부터 이중전공 우선 선발 기준은 32학점입니다. [1]"],
  ];
  for (const [n, answer] of cases) {
    const docs = page(n);
    assert.ok(docs.length > 0, `${n} 조각 없음`);
    assert.deepEqual(ungroundedDates(answer, docs), [], n);
  }
  // 같은 근거라도 없는 연도를 붙이면 막힘
  assert.deepEqual(ungroundedDates("2030학년도 이후 입학생은 126학점이에요. [1]", page("11373")), ["2030학년도"]);
});

// ── api/ask.js: 근거에 없는 날짜를 말하면 "찾지 못함"(mode none)으로, 로그에는 guard만 ──
test("ask.js: 근거에 없는 날짜 답변은 mode none, 로그 mode guard · reason ungrounded-date(질문 원문 없음)", async () => {
  const ENV = { ASK_IP_SALT: "test-salt", SUPABASE_URL: "https://db.example.test", SUPABASE_SERVICE_KEY: "test-service-key", CLOVA_API_KEY: "test-clova-key" };
  const saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  let reply = "";
  let systemPrompt = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    if (u.includes("/rpc/get_answer_cache")) return json([]);
    if (u.includes("/rpc/set_answer_cache")) return json(null);
    if (u.includes("/rpc/ask_hit")) return json([{ allowed: true, reason: null, retry_after: 0, minute_hits: 1, day_hits: 1, global_hits: 1 }]);
    if (u.includes("HCX-DASH-002")) return { ok: false, status: 500, json: async () => ({}) }; // 검색어 정리 실패 → 원래 질문으로 검색
    if (u.includes("/embedding/v2")) return json({ result: { embedding: [0.1, 0.2] } });
    if (u.includes("/rpc/match_chunks")) {
      return json([{ title: "학사일정(대학)", url: "https://www.hufs.ac.kr/hufs/11360/subview.do", text: "2026.03.02: 2026학년도 제1학기 개강·대체휴업일", similarity: 0.8 }]);
    }
    if (u.includes("HCX-005")) {
      systemPrompt = JSON.parse(init.body).messages[0].content;
      return json({ result: { message: { content: reply }, finishReason: "stop", usage: { promptTokens: 10, completionTokens: 5 } } });
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
    const call = async (question, ip) => {
      const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
      await handler({ method: "POST", headers: { "x-forwarded-for": ip }, body: { question, lang: "ko" } }, res);
      return res;
    };

    reply = "2027년 1학기 개강일은 2027년 3월 2일입니다. [1]";
    const blocked = await call("2027년 1학기 개강일이 언제야?", "203.0.113.70");
    assert.deepEqual(blocked.body, { mode: "none", answer: null, sources: [] });
    const guard = logs.map((l) => JSON.parse(l)).find((l) => l.mode === "guard");
    assert.equal(guard?.reason, "ungrounded-date");
    assert.match(systemPrompt, /오늘은 \d{4}-\d{2}-\d{2}\([일월화수목금토]\), \d{4}학년도 (제1학기|여름방학|제2학기|겨울방학)입니다\./);
    assert.equal(/개강일이|2027년 3월/.test(logs.join("\n")), false); // 질문 · 답변 내용은 로그에 없음

    reply = "2026학년도 1학기 개강일은 2026년 3월 2일입니다. [1]";
    const ok = await call("2026년 1학기 개강일이 언제야?", "203.0.113.71");
    assert.equal(ok.body.mode, "ai");
    assert.equal(ok.body.answer, reply);

    reply = "2027학년도 1학기 개강은 3월 2일입니다. [1]";
    const yearOnly = await call("2027학년도 개강일 알려줘", "203.0.113.72");
    assert.equal(yearOnly.body.mode, "none");
    assert.equal(logs.map((l) => JSON.parse(l)).filter((l) => l.mode === "guard").at(-1)?.reason, "ungrounded-year");
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
