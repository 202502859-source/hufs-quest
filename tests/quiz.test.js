// src/data/quiz.js의 O/X 퀴즈 100문제 규칙을 확인합니다. 실행: npm test
// 새 40문제의 근거 원문은 docs/quiz-100-check.md 표에 있습니다(사람이 원문과 대조).
import { test } from "node:test";
import assert from "node:assert/strict";
import { QUIZ, QUIZ_CATEGORIES } from "../src/data/quiz.js";

const TOTAL = 100;
const BY_CATEGORY = { academic: 45, hufs: 25, life: 30 };
// 2026-11-27 이전부터 있던 문제 중 학교 밖 출처(대학저널)를 쓰는 3개. 기존 문제는 바꾸지 않기로 해 예외로 둡니다.
// 새 문제는 여기에 더하지 않습니다(학교 공식 도메인만).
const LEGACY_EXTERNAL = { slogan: "dhnews.co.kr", "festival-name": "dhnews.co.kr", "festival-origin": "dhnews.co.kr" };
const isOfficialHost = (hostname) => /(^|\.)hufs\.ac\.kr$/.test(hostname);
const filled = (value) => typeof value === "string" && value.trim().length > 0;

test("퀴즈: 모두 100문제이고 id가 겹치지 않음(경험치 중복 방지에 쓰는 값)", () => {
  assert.equal(QUIZ.length, TOTAL);
  const ids = QUIZ.map((q) => q.id);
  const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(duplicated, [], `겹치는 id: ${duplicated.join(", ")}`);
  for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `id 형식: ${id}`);
});

test("퀴즈: O 50 · X 50", () => {
  for (const q of QUIZ) assert.equal(typeof q.answer, "boolean", `${q.id}: answer는 true/false`);
  assert.equal(QUIZ.filter((q) => q.answer === true).length, TOTAL / 2, "O 개수");
  assert.equal(QUIZ.filter((q) => q.answer === false).length, TOTAL / 2, "X 개수");
});

test("퀴즈: 분류별 개수 — 학사 45 · 외대 상식 25 · 학교생활 30", () => {
  const counts = {};
  for (const q of QUIZ) {
    assert.ok(q.category in QUIZ_CATEGORIES, `${q.id}: 모르는 분류 ${q.category}`);
    counts[q.category] = (counts[q.category] ?? 0) + 1;
  }
  assert.deepEqual(counts, BY_CATEGORY);
});

test("퀴즈: 모든 문제에 한국어 · 영어 문제와 해설, 출처 이름이 있음", () => {
  for (const q of QUIZ) {
    for (const lang of ["ko", "en"]) {
      assert.ok(filled(q.question?.[lang]), `${q.id}: question.${lang} 없음`);
      assert.ok(filled(q.explain?.[lang]), `${q.id}: explain.${lang} 없음`);
      assert.ok(filled(q.source?.name?.[lang]), `${q.id}: source.name.${lang} 없음`);
    }
    assert.notEqual(q.question.ko, q.question.en, `${q.id}: 영어 문제가 한국어와 같음`);
  }
});

test("퀴즈: 출처 주소는 학교 공식 도메인(hufs.ac.kr과 그 하위)뿐 — 예전 3문제만 예외", () => {
  for (const q of QUIZ) {
    assert.ok(filled(q.source?.url), `${q.id}: source.url 없음`);
    const url = new URL(q.source.url);
    assert.equal(url.protocol, "https:", `${q.id}: https가 아님 ${q.source.url}`);
    if (q.id in LEGACY_EXTERNAL) {
      assert.equal(url.hostname, LEGACY_EXTERNAL[q.id], `${q.id}: 예외 문제의 출처가 바뀜 ${q.source.url}`);
      continue;
    }
    assert.ok(isOfficialHost(url.hostname), `${q.id}: 공식 도메인이 아님 ${q.source.url}`);
  }
  assert.equal(isOfficialHost("www.hufs.ac.kr"), true);
  assert.equal(isOfficialHost("lib.hufs.ac.kr"), true);
  assert.equal(isOfficialHost("hufs.ac.kr.example.com"), false, "뒤에 다른 도메인이 붙은 주소는 공식이 아님");
  assert.equal(isOfficialHost("nothufs.ac.kr"), false, "hufs.ac.kr로 끝나기만 하는 다른 도메인은 공식이 아님");
});

test("퀴즈: 2026-11-27에 더한 40문제는 O 14 · X 26, 전화번호 · 이메일 · 시각이 없음", () => {
  const added = QUIZ.slice(60);
  assert.equal(added.length, 40);
  assert.equal(added.filter((q) => q.answer).length, 14, "새 문제 O 개수");
  assert.equal(added.filter((q) => !q.answer).length, 26, "새 문제 X 개수");
  for (const q of added) {
    const text = [q.question.ko, q.question.en, q.explain.ko, q.explain.en].join("\n");
    assert.doesNotMatch(text, /\d{2,4}-\d{3,4}-\d{4}/, `${q.id}: 전화번호`);
    assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[\w.]+/, `${q.id}: 이메일`);
    assert.doesNotMatch(text, /\b\d{1,2}:\d{2}\b/, `${q.id}: 운영 시각`);
    assert.doesNotMatch(text, /\d[\d,]*\s*원(?![가-힣])/, `${q.id}: 금액`);
  }
});
