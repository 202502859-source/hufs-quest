// 학사일정 바로 찾기 정답표 D1~D10(11/27 PM이 학교 홈페이지에서 확인, 오늘 = 2026-11-27).
// 다른 학기 버튼 규칙(11/27 PM 확정): 1개. 기본 답 다음의 같은 항목(종류를 말했으면 같은 종류), 없으면 바로 전 것.
// 학기가 분명한 질문(연도+학기, 이번 · 다음 · 지난 학기)은 termBasis · alternatives 없음.
import { test } from "node:test";
import assert from "node:assert/strict";
import { routeCalendar } from "../shared/calendarRoute.js";

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
