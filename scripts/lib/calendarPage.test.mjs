// 실행: npm test   (Windows PowerShell: npm.cmd test)
// 학사일정(11360) 페이지의 줄 목록이 연도 붙은 일정으로 바뀌는지 확인합니다.
// 아래 줄은 11/19 collect 결과(이종헌 PC 화면)에서 옮긴 실제 순서입니다(중간 일부 생략, 12월은 공식 페이지 일정으로 채움).
import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarChunks, parseCalendar } from "./calendarPage.mjs";

const LINES = [
  "2026", "2025년", "2027년", "달력으로 보기", "목록으로 보기",
  "3월", "March", "03.01", "삼일절·학기개시일", "03.03", "제1학기 개강", "03.03", "~ 03.09", "수강신청 변경",
  "03.24", "~ 03.30", "수강신청 취소", "03.30", "제1학기 1/4선",
  "4월", "April", "04.20", "제72주년 개교기념일", "04.21", "~ 04.27", "제1학기 중간시험",
  "7월", "July", "07.29", "2026년 후기 졸업 사정회의",
  "8월", "August", "08.03", "~ 08.07", "제2학기 휴.복학 신청", "08.10", "~ 08.14", "수강신청",
  "9월", "September", "09.01", "제2학기 학기개시일·개강", "09.01", "~ 09.07", "수강신청 변경", "09.28", "제2학기 1/4선",
  "11월", "November", "11.23", "제2학기 3/4선",
  "12월", "December", "12.15", "~ 12.21", "제2학기 기말시험", "12.21", "제2학기 종강",
  "12.28", "~ 01.04", "제2학기 성적 열람 및 정정",
  "2027", "1월", "January", "01.01", "신정", "01.13", "계절학기 종강",
  "2월", "February", "02.01", "~ 02.05", "2027학년도 제1학기 휴.복학신청", "02.10", "~ 02.12", "수강신청(2~4학년)",
  "02.22", "~ 02.23", "수강신청(1학년,", "전체)",
];

test("학년도는 맨 앞 연도, 1~2월은 다음 해로", () => {
  const { year, items } = parseCalendar(LINES);
  assert.equal(year, 2026);
  const find = (name) => items.find((it) => it.name === name);
  assert.deepEqual(find("삼일절·학기개시일"), { month: 3, start: "2026.03.01", end: null, name: "삼일절·학기개시일" });
  assert.equal(find("제2학기 기말시험").start, "2026.12.15");
  assert.equal(find("제2학기 기말시험").end, "2026.12.21");
  // 해를 넘기는 일정: 끝 날짜만 다음 해
  assert.equal(find("제2학기 성적 열람 및 정정").start, "2026.12.28");
  assert.equal(find("제2학기 성적 열람 및 정정").end, "2027.01.04");
  assert.equal(find("수강신청(2~4학년)").start, "2027.02.10");
  // 두 줄로 나뉜 이름은 이어 붙임, 중간의 "2027" 같은 줄은 이름에 섞이지 않게
  assert.ok(find("수강신청(1학년, 전체)"));
  assert.equal(find("계절학기 종강").start, "2027.01.13");
});

test("조각 4개(1학기 · 여름 · 2학기 · 겨울), 줄마다 연도 포함", () => {
  const chunks = calendarChunks({ pageId: "11360", title: "대학", url: "https://www.hufs.ac.kr/hufs/11360/subview.do", lines: LINES, minItems: 5 });
  assert.equal(chunks.length, 4);
  assert.deepEqual(chunks.map((c) => c.id), ["11360-01", "11360-02", "11360-03", "11360-04"]);
  const fall = chunks[2].text;
  assert.match(fall, /^\[학사일정\(대학\) > 2026학년도 제2학기 \(2026년 9~12월\)\]/);
  assert.match(fall, /2026\.12\.15 ~ 2026\.12\.21: 제2학기 기말시험/);
  assert.match(chunks[3].text, /2027\.02\.10 ~ 2027\.02\.12: 수강신청\(2~4학년\)/);
  for (const c of chunks) {
    for (const line of c.text.split("\n").slice(2)) assert.match(line, /^20\d{2}\.\d{2}\.\d{2}/, `연도 없는 줄: ${line}`);
  }
});

test("일정이 너무 적게 읽히면 null(collect가 기존 방식으로 자름)", () => {
  assert.equal(calendarChunks({ pageId: "11360", title: "대학", url: "u", lines: LINES.slice(0, 12) }), null);
});
