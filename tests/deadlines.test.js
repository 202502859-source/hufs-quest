import { test } from "node:test";
import assert from "node:assert/strict";
import { DEADLINES } from "../shared/deadlines.js";
import {
  THIS_WEEK_DAYS,
  WINDOW_DAYS,
  dday,
  deadlineStatus,
  filterDeadlinesByCategory,
  splitDeadlineGroups,
  upcomingDeadlines,
} from "../shared/deadlineCalc.js";
import handler, { buildResponse, isChecked } from "../api/deadlines.js";

const CATEGORIES = ["academic", "scholarship", "campus", "external"];
const TEAM_MEMBERS = ["이종헌", "신중혁", "임현규"];

test("기본 데이터: demo: true 항목 0건, 실제 공지 10건 이상", () => {
  assert.equal(DEADLINES.filter((d) => d.demo).length, 0);
  assert.ok(DEADLINES.length >= 10);
});

test("공지마다 id · 분류 · 한영 제목과 부서 · 학교 사이트 원문 링크", () => {
  const ids = new Set();
  for (const d of DEADLINES) {
    assert.ok(!ids.has(d.id), `${d.id}: id 중복`);
    ids.add(d.id);
    assert.ok(CATEGORIES.includes(d.category), `${d.id}: category`);
    assert.ok(d.title?.ko && d.title?.en && d.dept?.ko && d.dept?.en, `${d.id}: 한영 제목 · 부서`);
    assert.match(new URL(d.url).hostname, /(^|\.)hufs\.ac\.kr$/, `${d.id}: url`);
  }
});

test("실제 공지는 한국 시간 마감 일시를 직접 적음", () => {
  for (const d of DEADLINES) {
    assert.match(d.deadline ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$/, `${d.id}: 형식`);
    assert.ok(Number.isFinite(Date.parse(d.deadline)), `${d.id}: 날짜 오류`);
    assert.equal(d.daysFromNow, undefined, `${d.id}: 실제 공지에 daysFromNow`);
  }
});

test("실제 공지는 확인 기록(checked.on · 팀원 실명 checked.by)과 올바른 신청 시작일(startsAt)을 가짐", () => {
  for (const d of DEADLINES) {
    assert.match(d.checked?.on ?? "", /^\d{4}-\d{2}-\d{2}$/, `${d.id}: checked.on 형식`);
    assert.ok(TEAM_MEMBERS.includes(d.checked?.by), `${d.id}: checked.by는 팀원 실명이어야 함 (${d.checked?.by})`);
    if (d.startsAt !== undefined) {
      assert.match(d.startsAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$/, `${d.id}: startsAt 형식`);
      assert.ok(Number.isFinite(Date.parse(d.startsAt)), `${d.id}: startsAt 날짜 오류`);
      assert.ok(Date.parse(d.startsAt) < Date.parse(d.deadline), `${d.id}: startsAt이 deadline보다 앞이어야 함`);
    }
  }
});

test("공개 저장소: 전화번호 · 이메일 없음", () => {
  const text = JSON.stringify(DEADLINES);
  assert.doesNotMatch(text, /\d{2,4}-\d{3,4}-\d{4}/);
  assert.doesNotMatch(text, /@[\w-]+\.[\w.]+/);
});

test("deadlineCalc: 14일 경계 · D-0 시각 경계 · 자정 근처 D-day · status 계산", () => {
  assert.equal(WINDOW_DAYS, 14);
  assert.equal(THIS_WEEK_DAYS, 7);
  const now = Date.parse("2026-11-23T12:00:00+09:00");
  const sample = [
    { id: "past-today", deadline: "2026-11-23T11:59:00+09:00" },
    { id: "exact-now", deadline: "2026-11-23T12:00:00+09:00" },
    { id: "later-today", deadline: "2026-11-23T16:00:00+09:00" },
    { id: "upcoming-item", startsAt: "2026-11-25T09:00:00+09:00", deadline: "2026-11-30T16:00:00+09:00" },
    { id: "open-started", startsAt: "2026-11-23T09:00:00+09:00", deadline: "2026-12-01T16:00:00+09:00" },
    { id: "day-14", deadline: "2026-12-07T18:00:00+09:00" },
    { id: "day-15", deadline: "2026-12-08T09:00:00+09:00" },
  ];

  const list = upcomingDeadlines(sample, now);
  assert.deepEqual(list.map((x) => x.id), ["later-today", "upcoming-item", "open-started", "day-14"]);
  assert.equal(list[0].dday, 0);
  assert.equal(list[0].status, "open");
  assert.equal(list[1].status, "upcoming");
  assert.equal(list[2].status, "open");
  assert.equal(list[3].dday, 14);

  const target = Date.parse("2026-11-24T17:00:00+09:00");
  assert.equal(dday(target, Date.parse("2026-11-23T23:59:59+09:00")), 1);
  assert.equal(dday(target, Date.parse("2026-11-24T00:00:00+09:00")), 0);
  assert.equal(deadlineStatus({ startsAt: "2026-11-24T00:00:01+09:00" }, Date.parse("2026-11-24T00:00:00+09:00")), "upcoming");
  assert.equal(deadlineStatus({ startsAt: "2026-11-24T00:00:00+09:00" }, Date.parse("2026-11-24T00:00:00+09:00")), "open");
});

test("deadlineCalc: 두 묶음 나누기(D-7/D-8 경계) 및 분류 필터 계산", () => {
  const sample = [
    { id: "d0", category: "academic", dday: 0 },
    { id: "d7", category: "scholarship", dday: 7 },
    { id: "d8", category: "campus", dday: 8 },
    { id: "d14", category: "scholarship", dday: 14 },
  ];

  const groups = splitDeadlineGroups(sample);
  assert.deepEqual(groups.thisWeek.map((x) => x.id), ["d0", "d7"]);
  assert.deepEqual(groups.upcoming.map((x) => x.id), ["d8", "d14"]);

  const onlyUpcoming = splitDeadlineGroups([{ id: "d10", category: "campus", dday: 10 }]);
  assert.equal(onlyUpcoming.thisWeek.length, 0);
  assert.equal(onlyUpcoming.upcoming.length, 1);

  assert.equal(filterDeadlinesByCategory(sample, "all").length, 4);
  assert.deepEqual(filterDeadlinesByCategory(sample, "scholarship").map((x) => x.id), ["d7", "d14"]);
  assert.deepEqual(filterDeadlinesByCategory(sample, "external"), []);
});

test("api/deadlines.js: 고정 시각 기준 status/startsAt/checkedOn 포함 · 예시 및 이름 미포함", () => {
  const fixedNow = Date.parse("2026-11-24T12:00:00+09:00");
  const fakeItems = [
    {
      id: "demo-fake",
      title: { ko: "예시", en: "Demo" },
      dept: { ko: "부서", en: "Dept" },
      category: "academic",
      url: "https://www.hufs.ac.kr/hufs/11393/subview.do",
      demo: true,
      daysFromNow: 1,
    },
    {
      id: "open-item",
      title: { ko: "진행 중 공지", en: "Open Notice" },
      dept: { ko: "학사종합지원센터", en: "Academic Support Center" },
      category: "academic",
      deadline: "2026-11-27T16:00:00+09:00",
      url: "https://www.hufs.ac.kr/bbs/hufs/2181/270769/artclView.do",
      checked: { on: "2026-11-24", by: "임현규" },
    },
    {
      id: "upcoming-item",
      title: { ko: "접수 예정 공지", en: "Upcoming Notice" },
      dept: { ko: "장학팀", en: "Scholarship Team" },
      category: "scholarship",
      startsAt: "2026-11-26T09:00:00+09:00",
      deadline: "2026-12-04T16:00:00+09:00",
      url: "https://student.hufs.ac.kr/bbs/student/2431/272166/artclView.do",
      checked: { on: "2026-11-24", by: "이종헌" },
    },
  ];

  const body = buildResponse(fakeItems, fixedNow);
  assert.equal(body.serverTime, new Date(fixedNow).toISOString());
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0].status, "open");
  assert.equal(body.items[0].startsAt, null);
  assert.equal(body.items[1].status, "upcoming");
  assert.equal(body.items[1].startsAt, "2026-11-26T09:00:00+09:00");

  for (const item of body.items) {
    assert.match(item.checkedOn ?? "", /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(item.demo, undefined);
    assert.equal(item.checked, undefined);
  }

  const raw = JSON.stringify(body);
  for (const member of TEAM_MEMBERS) {
    assert.ok(!raw.includes(member));
  }

  const headers = {};
  let statusCode = 0;
  let handlerBody = null;
  const res = {
    setHeader(k, v) { headers[k] = v; },
    status(code) { statusCode = code; return this; },
    json(payload) { handlerBody = payload; return this; },
  };
  handler({ method: "GET" }, res);
  assert.equal(statusCode, 200);
  assert.equal(headers["Cache-Control"], "no-store");
  assert.ok(Array.isArray(handlerBody.items));
});
test("api/deadlines.js: checked(원문 대조 기록)가 없는 AI 초안은 응답에 넣지 않음 (notice:draft 안전장치)", () => {
  const fixedNow = Date.parse("2026-11-26T12:00:00+09:00");
  const base = {
    title: { ko: "초안 공지", en: "" },
    dept: { ko: "장학팀", en: "" },
    category: "scholarship",
    deadline: "2026-12-01T16:00:00+09:00",
    url: "https://www.hufs.ac.kr/bbs/hufs/2182/999999/artclView.do",
  };
  const items = [
    { ...base, id: "no-checked" },
    { ...base, id: "empty-checked", checked: { on: "", by: "" } },
    { ...base, id: "no-by", checked: { on: "2026-11-26", by: "" } },
    { ...base, id: "bad-date", checked: { on: "11/26", by: "임현규" } },
    { ...base, id: "checked-ok", checked: { on: "2026-11-26", by: "임현규" } },
  ];
  assert.deepEqual(buildResponse(items, fixedNow).items.map((x) => x.id), ["checked-ok"]);
  assert.equal(isChecked(items[4]), true);
  assert.equal(isChecked(items[0]), false);
});
