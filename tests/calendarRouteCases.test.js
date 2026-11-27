// 학사일정 바로 찾기 정답표 D1~D10(11/27 PM이 학교 홈페이지에서 확인, 오늘 = 2026-11-27).
// 다른 학기 버튼 규칙(11/27 PM 확정): 1개. 기본 답 다음의 같은 항목(종류를 말했으면 같은 종류), 없으면 바로 전 것.
// 학기가 분명한 질문(연도+학기, 이번 · 다음 · 지난 학기)은 termBasis · alternatives 없음.
import { test } from "node:test";
import assert from "node:assert/strict";
import { routeCalendar, answerHasRouteDate, isUnavailableCalendarTerm } from "../shared/calendarRoute.js";
import { ACADEMIC_CALENDAR } from "../shared/academicCalendar.js";

const TODAY = "2026-11-27";
const rows = (r) => r.lines.map((l) => l.replace(/^.* > /, "").replace(" (오늘 기준 지난 일정)", ""));
const alt = (r) => r.alternatives.map((a) => a.semester);

test("D1 기말고사 언제야? → 2026-2 12/15~12/21, 버튼 2027-1 기말", () => {
  const r = routeCalendar("기말고사 언제야?", { today: TODAY });
  assert.equal(r.semester, "2026-2");
  assert.deepEqual(rows(r), ["2026.12.15 ~ 2026.12.21: 제2학기 기말시험"]);
  assert.equal(r.termBasis.semester, "2026-2");
  assert.deepEqual(alt(r), ["2027-1"]);
  assert.equal(r.alternatives[0].question, "2027학년도 1학기 기말고사 언제야?");
});

test("D2 1학기 중간고사 언제야? → 2027-1 4/20~4/26, 버튼 2026-1(다음 1학기 중간 없음 → 바로 전 것)", () => {
  const r = routeCalendar("1학기 중간고사 언제야?", { today: TODAY });
  assert.equal(r.semester, "2027-1");
  assert.deepEqual(rows(r), ["2027.04.20 ~ 2027.04.26: 제1학기 중간시험"]);
  assert.equal(r.termBasis.semester, "2027-1");
  assert.deepEqual(alt(r), ["2026-1"]);
  // 버튼을 누르면 2026-1 4/21~4/27
  assert.deepEqual(rows(routeCalendar(r.alternatives[0].question, { today: TODAY })), ["2026.04.21 ~ 2026.04.27: 제1학기 중간시험"]);
});

test("D3 수강신청 언제야? → 2027-1 2~4학년 · 1학년 두 줄, 버튼은 다음 수강신청(2027-2 8/9~8/13)", () => {
  const r = routeCalendar("수강신청 언제야?", { today: TODAY });
  assert.equal(r.semester, "2027-1");
  assert.deepEqual(rows(r), ["2027.02.10 ~ 2027.02.12: 수강신청(2~4학년)", "2027.02.22 ~ 2027.02.23: 수강신청(1학년, 전체)"]);
  assert.equal(r.termBasis.semester, "2027-1");
  // 데이터에 계절학기 수강신청 항목이 따로 없어 규칙이 고른 것은 2027-2
  assert.deepEqual(alt(r), ["2027-2"]);
  assert.deepEqual(rows(routeCalendar(r.alternatives[0].question, { today: TODAY })), ["2027.08.09 ~ 2027.08.13: 수강신청"]);
});

test("D4 사전수강신청 언제야? → 2027.02.01, 버튼 2027-2 2027.08.02", () => {
  const r = routeCalendar("사전수강신청 언제야?", { today: TODAY });
  assert.deepEqual(rows(r), ["2027.02.01: 사전수강신청"]);
  assert.equal(r.termBasis.semester, "2027-1");
  assert.deepEqual(alt(r), ["2027-2"]);
  assert.deepEqual(rows(routeCalendar(r.alternatives[0].question, { today: TODAY })), ["2027.08.02: 사전수강신청"]);
});

test("D5 2학기 수강 취소 기간 알려줘 → 2026-2 9/22~9/28(지난 일정 표시), 버튼 2027-2 수강 취소", () => {
  const r = routeCalendar("2학기 수강 취소 기간 알려줘", { today: TODAY });
  assert.equal(r.semester, "2026-2");
  assert.deepEqual(r.lines, ["[학사일정 바로 찾기] 2026학년도 제2학기 > 2026.09.22 ~ 2026.09.28: 수강신청 취소 (오늘 기준 지난 일정)"]);
  assert.equal(r.termBasis.semester, "2026-2");
  assert.deepEqual(alt(r), ["2027-2"]);
  assert.deepEqual(rows(routeCalendar(r.alternatives[0].question, { today: TODAY })), ["2027.09.22 ~ 2027.09.28: 수강신청 취소"]);
});

test("D6 다음 학기 개강일 언제야? → 2027-1 3/2, 버튼 없음", () => {
  const r = routeCalendar("다음 학기 개강일 언제야?", { today: TODAY });
  assert.equal(r.semester, "2027-1");
  assert.deepEqual(rows(r), ["2027.03.02: 2027학년도 제1학기 개강"]);
  assert.equal(r.termBasis, null);
  assert.deepEqual(r.alternatives, []);
});

test("D7 계절학기 언제 시작해? → 겨울 12/22, 버튼 2027 여름 계절학기", () => {
  const r = routeCalendar("계절학기 언제 시작해?", { today: TODAY });
  assert.equal(r.semester, "2026-winter");
  assert.deepEqual(rows(r), ["2026.12.22: 동계방학 및 계절학기 개강"]);
  assert.equal(r.termBasis.semester, "2026-winter");
  assert.deepEqual(alt(r), ["2027-summer"]);
  assert.equal(r.alternatives[0].question, "2027학년도 여름 계절학기 언제 시작해?");
  assert.deepEqual(rows(routeCalendar(r.alternatives[0].question, { today: TODAY })), ["2027.06.22: 하계방학 및 계절학기 개강"]);
});

test("D8 휴학 신청 언제까지야? → 2027-1 2/1~2/5, 버튼 2027-2 휴 · 복학 신청(8월 초)", () => {
  const r = routeCalendar("휴학 신청 언제까지야?", { today: TODAY });
  assert.equal(r.semester, "2027-1");
  assert.deepEqual(rows(r), ["2027.02.01 ~ 2027.02.05: 2027학년도 제1학기 휴․복학신청"]);
  assert.equal(r.termBasis.semester, "2027-1");
  assert.deepEqual(alt(r), ["2027-2"]);
  assert.deepEqual(rows(routeCalendar(r.alternatives[0].question, { today: TODAY })), ["2027.08.02 ~ 2027.08.06: 제2학기 휴․복학 신청"]);
});

test("D9 2026학년도 1학기 중간고사 언제였어? → 4/21~4/27, termBasis · 버튼 없음", () => {
  const r = routeCalendar("2026학년도 1학기 중간고사 언제였어?", { today: TODAY });
  assert.equal(r.semester, "2026-1");
  assert.deepEqual(rows(r), ["2026.04.21 ~ 2026.04.27: 제1학기 중간시험"]);
  assert.equal(r.termBasis, null);
  assert.deepEqual(r.alternatives, []);
});

test("D10 이중전공은 몇 학년부터 시작해? → 날짜 질문 아님(바로 찾기 없음)", () => {
  assert.equal(routeCalendar("이중전공은 몇 학년부터 시작해?", { today: TODAY }), null);
});

// ── 학년도 vs 달력 연도(11/27 PM 확정) ──
// 일정표는 학년도(3월~다음 해 2월) 단위지만 일정 이름 · 날짜는 달력 연도를 씁니다(예: 2026학년도 안의 "2027년 전기 학위수여식" = 2027.02).
// 날짜 질문 판별(언제 · 기간 · 일정 …)은 그대로라서, 테스트 질문은 "…언제야?" 꼴로 씁니다.
test("달력 연도 + 월: '2028년 2월 학위수여식 언제야?' → 2027학년도 · 2028.02.18, termBasis · 버튼 없음", () => {
  const r = routeCalendar("2028년 2월 학위수여식 언제야?", { today: TODAY });
  assert.equal(r.semester, "2027-2");
  assert.deepEqual(rows(r), ["2028.02.18: 2028년 전기 학위수여식"]);
  assert.equal(r.termBasis, null);
  assert.deepEqual(r.alternatives, []);
  // 같은 이름 꼴의 2027년 2월은 2026학년도 일정
  assert.deepEqual(rows(routeCalendar("2027년 2월 학위수여식 언제야?", { today: TODAY })), ["2027.02.19: 2027년 전기 학위수여식"]);
});

test("달력 연도 + 월: '2027년 1월 겨울 계절학기 시작 언제야?' → 2026학년도 겨울 계절학기(12/22 개강)", () => {
  const r = routeCalendar("2027년 1월 겨울 계절학기 시작 언제야?", { today: TODAY });
  assert.equal(r.semester, "2026-winter");
  assert.deepEqual(rows(r), ["2026.12.22: 동계방학 및 계절학기 개강"]);
  assert.equal(r.termBasis, null);
  assert.deepEqual(r.alternatives, []);
});

test("달력 연도 + 월: '2027년 8월 후기 학위수여식 언제야?' → 2027학년도 · 2027.08.20", () => {
  const r = routeCalendar("2027년 8월 후기 학위수여식 언제야?", { today: TODAY });
  assert.equal(r.semester, "2027-1");
  assert.deepEqual(rows(r), ["2027.08.20: 2027년 후기 학위수여식"]);
  assert.equal(r.termBasis, null);
});

test("학년도: '2027학년도 학위수여식 언제야?' → 지금처럼 2027학년도 안에서 고름(2027.08.20, 버튼 2027학년도 2학기)", () => {
  const r = routeCalendar("2027학년도 학위수여식 언제야?", { today: TODAY });
  assert.equal(r.semester, "2027-1");
  assert.deepEqual(rows(r), ["2027.08.20: 2027년 후기 학위수여식"]);
  assert.equal(r.termBasis.semester, "2027-1");
  assert.deepEqual(alt(r), ["2027-2"]);
});

test("달력 연도(월 없음): '2027년 수강신청 언제야?' → 날짜가 2027년인 것 중 가장 가까운 것(2027-1 두 줄), 없으면 일반 검색", () => {
  const r = routeCalendar("2027년 수강신청 언제야?", { today: TODAY });
  assert.equal(r.semester, "2027-1");
  assert.deepEqual(rows(r), ["2027.02.10 ~ 2027.02.12: 수강신청(2~4학년)", "2027.02.22 ~ 2027.02.23: 수강신청(1학년, 전체)"]);
  assert.equal(r.termBasis, null);
  assert.deepEqual(r.alternatives, []);
  assert.equal(routeCalendar("2029년 수강신청 언제야?", { today: TODAY }), null);
});

test("'YYYY년 N학기'는 지금처럼 YYYY학년도 N학기", () => {
  assert.equal(routeCalendar("2027년 1학기 개강일이 언제야?", { today: TODAY }).semester, "2027-1");
  assert.equal(routeCalendar("2026년 2학기 정규 수강신청 기간은?", { today: TODAY }).semester, "2026-2");
});

// ── 11/27 PM 결정: 계절학기만 말한 질문 · 날짜 말고 다른 것을 같이 묻는 질문 · 날짜 질문 넓히기 · 일정 이름의 다른 말 ──
test("계절학기만 말하면 계절학기 학기만 후보: '계절학기 수강신청 언제야?'는 학사일정에 없어 바로 찾기 건너뜀(정규 수강신청으로 가지 않음)", () => {
  assert.equal(routeCalendar("계절학기 수강신청 언제야?", { today: TODAY }), null);
  assert.equal(routeCalendar("여름 계절학기 수강신청 언제야?", { today: TODAY }), null);
  // 계절학기 일정 자체(개강 · 종강)는 그대로
  assert.deepEqual(rows(routeCalendar("계절학기 종강 언제야?", { today: TODAY })), ["2027.01.13: 계절학기 종강"]);
});

test("날짜 말고 다른 것(성적 · 방법 · 장소 · 대상 · 자격 · 서류 등)을 같이 물으면 바로 찾기 건너뜀", () => {
  for (const q of [
    "겨울 계절학기 성적 언제 나와?",
    "수강신청 언제 어떻게 해?",
    "졸업식 어디서 해?",
    "휴학 신청 언제까지 하고 서류는 뭐가 필요해?",
    "수강신청 대상이 누구고 언제야?",
    "계절학기 학점은 언제 들어와?",
  ]) {
    assert.equal(routeCalendar(q, { today: TODAY }), null, q);
  }
  // 성적은 학사일정 일정 이름(성적 열람 · 정정)일 때만 날짜 질문
  assert.deepEqual(rows(routeCalendar("2학기 성적 열람 기간 언제야?", { today: TODAY })), ["2026.12.28 ~ 2027.01.04: 제2학기 성적 열람 및 정정"]);
});

test("날짜 질문 넓히기: 며칠 · 몇 월 며칠 · 몇일 · 언제부터/언제까지 · 일자", () => {
  for (const q of ["중간고사 몇 월 며칠이야?", "기말고사 몇일이야?", "기말고사 언제부터야?", "휴학 신청 언제까지야?", "학위수여식 일자 알려줘"]) {
    assert.ok(routeCalendar(q, { today: TODAY }), q);
  }
  const r = routeCalendar("2028년 2월 졸업식 며칠이야?", { today: TODAY });
  assert.deepEqual(rows(r), ["2028.02.18: 2028년 전기 학위수여식"]);
  assert.equal(r.termBasis, null);
});

test("일정 이름의 다른 말: 졸업식 → 학위수여식, 개학 → 개강. '예비수강신청'은 다른 제도라 넣지 않음", () => {
  assert.deepEqual(rows(routeCalendar("개학 언제야?", { today: TODAY })), ["2027.03.02: 2027학년도 제1학기 개강"]);
  assert.deepEqual(rows(routeCalendar("2027년 8월 졸업식 언제야?", { today: TODAY })), ["2027.08.20: 2027년 후기 학위수여식"]);
  assert.equal(routeCalendar("예비수강신청 언제야?", { today: TODAY }), null);
});


test("R01 regression: 전기와 후기 학위수여식 구분", () => {
  const cases = [
    ["2027년 후기 학위수여식 언제야?", ["2027-08-20"]],
    ["2027년 전기 학위수여식 언제야?", ["2027-02-19"]],
    ["2027년 전기와 후기 학위수여식 언제야?", null],
  ];

  for (const [q, expected] of cases) {
    assert.deepEqual(
      routeCalendar(q, { today: TODAY })?.dates ?? null,
      expected,
      q
    );
  }
});

test("R02 regression: 명시한 월과 다른 일정 반환 방지", () => {
  const cases = [
    ["2027년 1월 수강신청 언제야?", null],
    ["2027년 1월 겨울 계절학기 시작 언제야?", ["2026-12-22"]],
    ["2027년 2월 사전수강신청 언제야?", ["2027-02-01"]],
    ["2027년 8월 수강신청 언제야?", ["2027-08-09", "2027-08-13"]],
  ];

  for (const [q, expected] of cases) {
    assert.deepEqual(
      routeCalendar(q, { today: TODAY })?.dates ?? null,
      expected,
      q
    );
  }
});

test("R03 regression: 복합 일정은 일반 검색으로 전달", () => {
  const cases = [
    ["중간고사랑 기말고사 언제야?", null],
    ["수강신청이랑 수강취소 언제야?", null],
    ["사전수강신청과 수강신청 언제야?", null],
    ["개강일과 종강일 언제야?", null],
    ["When are midterm and final exams?", null],
    ["사전수강신청 언제야?", "preRegistration"],
    ["수강신청 변경 언제야?", "registrationChange"],
    ["수강신청 취소 언제야?", "registrationCancel"],
    ["겨울 계절학기 개강 언제야?", "seasonal"],
    ["겨울 계절학기 종강 언제야?", "seasonal"],
  ];

  for (const [q, expected] of cases) {
    assert.equal(
      routeCalendar(q, { today: TODAY })?.topic ?? null,
      expected,
      q
    );
  }
});

test("R04 regression: 잘못된 날짜 및 연도 차단", () => {
  const r = routeCalendar(
    "사전수강신청 언제야?",
    { today: TODAY }
  );

  const cases = [
    ["2026년 2월 1일입니다. [1]", false],
    ["2027년 2월 1일과 8월 3일입니다. [1]", false],
    ["2027년 2월 1일입니다. [1]", true],
    ["February 1, 2026. [1]", false],
    ["February 1, 2027. [1]", true],
    ["2027.02.01입니다. [1]", true],
    ["2026-02-01입니다. [1]", false],
    ["2027-02-01입니다. [1]", true],
    ["2월 1일입니다. [1]", true],
    ["2027년 8월 3일입니다. [1]", false],
    ["아직 공개되지 않았습니다.", false],
  ];

  for (const [answer, expected] of cases) {
    assert.equal(
      answerHasRouteDate(answer, r),
      expected,
      answer
    );
  }
});

test("R04 regression: 기간 시작일과 종료일 검증", () => {
  const r = routeCalendar(
    "기말고사 언제야?",
    { today: TODAY }
  );

  assert.equal(
    answerHasRouteDate("12월 15일부터 12월 25일까지", r),
    false
  );

  assert.equal(
    answerHasRouteDate("12월 15일부터 12월 21일까지", r),
    true
  );

  assert.equal(
    answerHasRouteDate("2026.12.15 ~ 2026.12.21", r),
    true
  );
});

test("R04 regression: 연도가 바뀌는 일정 검증", () => {
  const r = routeCalendar(
    "2학기 성적 열람 기간 언제야?",
    { today: TODAY }
  );

  assert.equal(
    answerHasRouteDate(
      "2026년 12월 28일부터 2027년 1월 4일까지",
      r
    ),
    true
  );

  assert.equal(
    answerHasRouteDate(
      "2026년 12월 28일부터 2026년 1월 4일까지",
      r
    ),
    false
  );

  assert.equal(answerHasRouteDate("일반 답변", null), true);
});

test("R04 compact range regression: 축약 날짜 기간 검증", () => {
  const r = routeCalendar(
    "기말고사 언제야?",
    { today: TODAY }
  );

  const cases = [
    ["12월 15~21일", true],
    ["12월 15일~21일", true],
    ["12월 15일~25일", false],
    ["12월 15~25일", false],
    ["2025년 12월 15일~21일", false],
    ["2026년 12월 15일부터 21일까지", true],
    ["2026.12.15~12.21", true],
    ["2026.12.15~12.25", false],
    ["December 15-21, 2026", true],
    ["December 15-25, 2026", false],
    ["December 15-21, 2025", false],
    ["12월 15일", true],
  ];

  for (const [answer, expected] of cases) {
    assert.equal(
      answerHasRouteDate(answer, r),
      expected,
      answer
    );
  }
});


// ── 미수집 학년도 개강·종강 환각 방지 ──

const scopeCases = [
  ["G01", "2028학년도 1학기 개강일이 언제야?", true],
  ["G02", "2028년 1학기 개강일이 언제야?", true],
  ["G03", "2028학년도 개강일 알려줘", true],
  ["G04", "2028학년도 2학기 종강일이 언제야?", true],
  ["G05", "2029학년도 1학기 개강 언제야?", true],
  ["G06", "When do classes begin in Spring 2028?", true],
  ["G07", "2027년 1학기 개강일이 언제야?", false],
  ["G08", "2026학년도 2학기 개강 언제야?", false],
  ["G09", "2028년 2월 학위수여식 언제야?", false],
  ["G10", "2028년 2월 졸업식 며칠이야?", false],
  ["G11", "2028학년도 1학기 수강신청 언제야?", false],
  ["G12", "2028학년도 1학기 휴학 신청 언제야?", false],
  ["G13", "계절학기 수강신청 언제야?", false],
  ["G14", "2027년 1월 겨울 계절학기 시작 언제야?", false],
  ["G15", "이중전공은 몇 학년부터 시작해?", false],
  ["G16", "2028학년도 졸업학점은 몇이야?", false],
  ["G17", "2028학년도 개강일과 수강신청 방법 알려줘", false],
  ["G18", "개강 언제야?", false],
  ["G19", "다음 학기 개강일 언제야?", false],
  ["G20", "When do classes begin in Spring 2027?", false],
];

for (const [id, question, expected] of scopeCases) {
  test(`${id} calendar scope: ${question}`, () => {
    const route = routeCalendar(question, { today: TODAY });
    const blocked = !route &&
      isUnavailableCalendarTerm(question, { today: TODAY });

    assert.equal(blocked, expected);

    if (expected) assert.equal(route, null);
  });
}

test("calendar scope: 2028년 정상 일정의 날짜를 유지", () => {
  const options = { today: TODAY };

  assert.deepEqual(
    routeCalendar("2028년 2월 학위수여식 언제야?", options).dates,
    ["2028-02-18"]
  );

  assert.deepEqual(
    routeCalendar("2028학년도 1학기 수강신청 언제야?", options).dates,
    ["2028-02-07", "2028-02-09", "2028-02-24", "2028-02-25"]
  );

  assert.deepEqual(
    routeCalendar("2028학년도 1학기 휴학 신청 언제야?", options).dates,
    ["2028-01-31", "2028-02-04"]
  );
});

test("calendar scope: 미래 학년도 수집 후 정상 탐색", () => {
  const calendar = {
    ...ACADEMIC_CALENDAR,
    items: [
      ...ACADEMIC_CALENDAR.items,
      {
        academicYear: 2028,
        targetSemester: "2028-1",
        id: "test-future-opening",
        name: "2028학년도 제1학기 개강",
        startDate: "2028-03-02",
        sourceUrl: "https://example.test/calendar",
      },
    ],
  };

  const question = "2028학년도 1학기 개강일이 언제야?";
  const options = { today: TODAY, calendar };

  assert.equal(
    isUnavailableCalendarTerm(question, options),
    false
  );

  assert.deepEqual(
    routeCalendar(question, options).dates,
    ["2028-03-02"]
  );
});
