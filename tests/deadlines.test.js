import { test } from "node:test";
import assert from "node:assert/strict";
import { DEADLINES } from "../shared/deadlines.js";
import { WINDOW_DAYS, dday, deadlineStatus, upcomingDeadlines } from "../shared/deadlineCalc.js";
import handler from "../api/deadlines.js";

const CATEGORIES = ["academic", "scholarship", "campus", "external"];

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

test("실제 공지는 확인 기록(checked.on · checked.by)과 올바른 신청 시작일(startsAt)을 가짐", () => {
  for (const d of DEADLINES) {
    assert.match(d.checked?.on ?? "", /^\d{4}-\d{2}-\d{2}$/, `${d.id}: checked.on 형식`);
    assert.ok(typeof d.checked?.by === "string" && d.checked.by.trim().length > 0, `${d.id}: checked.by 누락`);
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

test("api/deadlines.js: no-store · status/startsAt/checkedOn 포함 · 예시 및 이름 미포함", () => {
  const headers = {};
  let statusCode = 0;
  let body = null;
  const res = {
    setHeader(k, v) { headers[k] = v; },
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };
  handler({ method: "GET" }, res);

  assert.equal(statusCode, 200);
  assert.equal(headers["Cache-Control"], "no-store");
  assert.ok(Array.isArray(body.items) && body.items.length > 0);

  for (const item of body.items) {
    assert.ok(item.status === "open" || item.status === "upcoming");
    assert.ok("startsAt" in item);
    assert.match(item.checkedOn ?? "", /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(item.demo, undefined);
    assert.equal(item.checked, undefined);
  }

  const raw = JSON.stringify(body);
  for (const d of DEADLINES) {
    if (d.checked?.by) assert.ok(!raw.includes(d.checked.by));
  }
});
