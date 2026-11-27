// 근거에 없는 연락처 · 주소 검사(api/_lib/contactGuard.js)와 api/ask.js 연결을 확인합니다. 네트워크는 부르지 않습니다. 실행: npm test
// 연락처는 근거 조각에 실제로 있는 학교 부서 대표번호 · 부서 메일 · 공식 주소와, 예시용 가짜 값(example.com 등)만 씁니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findContacts, unsupportedContacts } from "../api/_lib/contactGuard.js";

// 근거 조각(시험용 DB 원문과 같은 모양)
const DOCS = [
  { title: "보험계리학전공", url: "https://www.hufs.ac.kr/hufs/11267/subview.do", text: "[보험계리학전공 > 문의처]\n보험계리학전공 주임교수 E-mail : (개인 연락처 생략)\n학사종합지원센터 TEL: 02-2173-2109 e-mail: haksaseoul@hufs.ac.kr" },
  { title: "복지", url: "https://www.hufs.ac.kr/hufs/11316/subview.do", text: "인문과학관 | 1층 | 학생 식당 | 조식 08:00~10:00 | 02)2173-2211 | 한식, 양식, 면, 분식코너" },
  { title: "기타", url: "https://www.hufs.ac.kr/hufs/11159/subview.do", text: "영양사실(학생) | 2211" },
  { title: "동아리", url: "https://www.hufs.ac.kr/hufs/11292/subview.do", text: "[동아리 > 문의]\n학생지원팀\n02-2173-2134(서울) / 031-330-4033(글로벌)" },
];

test("unsupportedContacts: 근거에 없는 이메일은 걸림(11/27 '교수님 이메일' 같은 경우)", () => {
  const r = unsupportedContacts("교수님 이메일은 professor.kim@example.com 입니다. [1]", DOCS, "○○ 교수님 이메일 알려줘");
  assert.deepEqual(r.map((c) => c.kind), ["email"]);
  // 근거에 있는 부서 메일은 통과(대소문자 · 점 차이 무시)
  assert.deepEqual(unsupportedContacts("학사종합지원센터 메일 HaksaSeoul@hufs.ac.kr 로 문의하세요. [1]", DOCS), []);
});

test("unsupportedContacts: 근거에 있는 부서 대표번호는 하이픈 · 점 · 공백 · 괄호 · 붙여쓰기가 달라도 통과", () => {
  for (const phone of ["02-2173-2211", "02)2173-2211", "(02) 2173 2211", "02.2173.2211", "0221732211", "02 – 2173 – 2109"]) {
    assert.deepEqual(unsupportedContacts(`학생 식당 전화는 ${phone}입니다. [2]`, DOCS), [], phone);
  }
  assert.deepEqual(unsupportedContacts("학생지원팀 02-2173-2134(서울), 031-330-4033(글로벌)으로 전화하세요. [4]", DOCS), []);
});

test("unsupportedContacts: 근거에 없는 휴대폰 번호는 붙여 써도 · 띄어 써도 걸림", () => {
  for (const phone of ["01012345678", "010-1234-5678", "010 1234 5678", "010.1234.5678"]) {
    const r = unsupportedContacts(`담당자 휴대폰 ${phone}로 연락하세요. [1]`, DOCS);
    assert.deepEqual(r, [{ kind: "phone", value: "01012345678" }], phone);
  }
});

test("unsupportedContacts: 내선을 국번과 붙여 만든 번호 '(02)2211'은 걸림(11/27 학식 점검 사례), 근거에 없는 대표번호도 걸림", () => {
  assert.deepEqual(unsupportedContacts("영양사실(학생)(02)2211로 문의하세요. [2]", DOCS).map((c) => c.value), ["022211"]);
  assert.deepEqual(unsupportedContacts("고객센터 1588-0000으로 문의하세요. [1]", DOCS).map((c) => c.kind), ["phone"]);
  // 근거에 있는 4자리 내선만 쓰면 전화번호로 보지 않음(숫자 검사가 따로 확인)
  assert.deepEqual(unsupportedContacts("영양사실(학생) 내선은 2211입니다. [3]", DOCS), []);
});

test("unsupportedContacts: 근거(출처 주소 포함)에 있는 https 주소는 통과, 없는 주소는 걸림", () => {
  assert.deepEqual(unsupportedContacts("자세한 내용은 https://www.hufs.ac.kr/hufs/11316/subview.do 에서 확인하세요. [2]", DOCS), []);
  assert.deepEqual(unsupportedContacts("학교 홈페이지 www.hufs.ac.kr에서 확인하세요.", DOCS), []);
  const r = unsupportedContacts("메뉴는 https://menu.example.com/today 에서 확인하세요. [2]", DOCS);
  assert.deepEqual(r.map((c) => c.kind), ["url"]);
  assert.deepEqual(unsupportedContacts("www.example.org에서 예약하세요.", DOCS).map((c) => c.kind), ["url"]);
});

test("unsupportedContacts: 연락처가 없는 일반 답 · 날짜 · 학점 · 학번은 통과(전화번호로 잘못 보지 않음)", () => {
  assert.deepEqual(unsupportedContacts("조기졸업은 평점평균 4.0 이상입니다. [1]", DOCS), []);
  assert.deepEqual(unsupportedContacts("수강신청은 2026.02.10~2026.02.12, 08:00~10:00에 합니다. [1]", DOCS), []);
  assert.deepEqual(unsupportedContacts("25학번 이후는 32학점 이상, 2025학년도부터 적용됩니다. [1]", DOCS), []);
  assert.deepEqual(findContacts("20250285 학생, 2026-03-02 개강"), []);
  assert.deepEqual(unsupportedContacts("", DOCS), []);
  assert.deepEqual(unsupportedContacts(null, DOCS), []);
});

test("unsupportedContacts: 질문에 있는 연락처는 통과(사용자가 쓴 값)", () => {
  assert.deepEqual(unsupportedContacts("010-9876-5432 번호로는 안내할 수 없습니다.", DOCS, "010-9876-5432 이 번호 학교 번호야?"), []);
});

test("ask.js: 근거에 없는 연락처가 있으면 근거 원문 보여 주기(evidence)로, 로그 reason은 unsupported_contact이고 답 · 연락처는 로그에 없음", async () => {
  const ENV = { ASK_IP_SALT: "test-salt", SUPABASE_URL: "https://db.example.test", SUPABASE_SERVICE_KEY: "test-service-key", CLOVA_API_KEY: "test-clova-key" };
  const saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  const answers = [
    "교수님 이메일은 professor.kim@example.com 입니다. 담당 부서 02-2173-2109로도 문의하세요. [1]",
    "학사종합지원센터 02-2173-2109 또는 haksaseoul@hufs.ac.kr로 문의하세요. [1]",
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    if (u.includes("/rpc/ask_hit")) return json([{ allowed: true, reason: null, retry_after: 0, minute_hits: 1, day_hits: 1, global_hits: 1 }]);
    if (u.includes("HCX-DASH-002")) return json({ result: { message: { content: '{"queries": ["교수 이메일 문의처"]}' }, finishReason: "stop" } });
    if (u.includes("/embedding/v2")) return json({ result: { embedding: [0.1] } });
    if (u.includes("/rpc/match_chunks")) return json([{ id: "11267-05", ...DOCS[0], similarity: 0.8 }]);
    if (u.includes("HCX-005")) {
      return json({ result: { message: { content: answers.shift() }, finishReason: "stop", usage: { promptTokens: 10, completionTokens: 5 } } });
    }
    return { ok: false, status: 404, json: async () => ({}) }; // 캐시 · 수집일 조회는 실패로(답에는 영향 없음)
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

    const blocked = await call("교수님 이메일 알려줘", "203.0.113.96");
    assert.equal(blocked.body.mode, "evidence");
    assert.equal(blocked.body.answer, DOCS[0].text); // 지어낸 답 대신 근거 원문
    const log = JSON.parse(logs.at(-1));
    assert.equal(log.mode, "evidence");
    assert.equal(log.reason, "unsupported_contact");
    assert.equal(log.unsupportedContacts, 1);
    assert.deepEqual(log.unsupportedContactKinds, ["email"]);
    assert.equal(/example\.com|professor|이메일|2173/.test(logs.join("\n")), false); // 답 · 질문 · 연락처 값은 로그에 없음

    // 근거에 있는 부서 번호 · 메일만 쓴 답은 그대로(mode ai)
    const ok = await call("학사종합지원센터 연락처 알려줘", "203.0.113.97");
    assert.equal(ok.body.mode, "ai");
    assert.match(ok.body.answer, /02-2173-2109/);
    assert.equal(JSON.parse(logs.at(-1)).reason, undefined);
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
