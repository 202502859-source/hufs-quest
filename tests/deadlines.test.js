// shared/deadlines.js 입력 규칙을 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEADLINES } from "../shared/deadlines.js";

const CATEGORIES = ["academic", "scholarship", "campus", "external"];

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
  for (const d of DEADLINES.filter((x) => !x.demo)) {
    assert.match(d.deadline ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$/, `${d.id}: 형식`);
    assert.ok(Number.isFinite(Date.parse(d.deadline)), `${d.id}: 날짜 오류`);
    assert.equal(d.daysFromNow, undefined, `${d.id}: 실제 공지에 daysFromNow`);
  }
});

test("공개 저장소: 전화번호 · 이메일 없음", () => {
  const text = JSON.stringify(DEADLINES);
  assert.doesNotMatch(text, /\d{2,4}-\d{3,4}-\d{4}/);
  assert.doesNotMatch(text, /@[\w-]+\.[\w.]+/);
});