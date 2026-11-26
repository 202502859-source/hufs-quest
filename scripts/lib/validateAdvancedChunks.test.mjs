import test from "node:test";
import assert from "node:assert/strict";

import {
  validateAdvancedChunks
} from "./validateAdvancedChunks.mjs";

const valid = {
  id: "test-01",
  title: "테스트",
  url: "",
  section: null,
  text: "테스트 본문",
  collected_at: "2026-11-26T00:00:00Z",
  parent_id: "test-01",
  topic: "registration",
  subtopic: null,
  campus: "seoul",
  cohort_min: null,
  cohort_max: null
};

test("정상 조각 및 허용된 null 값 통과", () => {
  const result = validateAdvancedChunks([valid], 1);

  assert.equal(result.length, 1);
  assert.equal(result[0].split_label, null);
});

test("예상 조각 수 불일치 차단", () => {
  assert.throws(
    () => validateAdvancedChunks([valid], 2),
    /조각 수/
  );
});

test("중복 ID 차단", () => {
  assert.throws(
    () => validateAdvancedChunks([valid, valid], 2),
    /ID 중복/
  );
});

test("필수 필드 누락 차단", () => {
  const c = { ...valid };
  delete c.topic;

  assert.throws(
    () => validateAdvancedChunks([c], 1),
    /필수 필드/
  );
});

test("허용되지 않은 필드 차단", () => {
  assert.throws(
    () => validateAdvancedChunks([
      { ...valid, unexpected: true }
    ], 1),
    /허용되지 않은 필드/
  );
});

test("빈 본문 차단", () => {
  assert.throws(
    () => validateAdvancedChunks([
      { ...valid, text: " " }
    ], 1),
    /text 값 오류/
  );
});

test("문자열 학번 차단", () => {
  assert.throws(
    () => validateAdvancedChunks([
      { ...valid, cohort_min: "2025" }
    ], 1),
    /cohort_min/
  );
});

test("잘못된 학번 범위 차단", () => {
  assert.throws(
    () => validateAdvancedChunks([
      {
        ...valid,
        cohort_min: 2025,
        cohort_max: 2024
      }
    ], 1),
    /학번 범위/
  );
});

test("잘못된 캠퍼스 차단", () => {
  assert.throws(
    () => validateAdvancedChunks([
      { ...valid, campus: "unknown-campus" }
    ], 1),
    /campus/
  );
});

test("잘못된 수집일 차단", () => {
  assert.throws(
    () => validateAdvancedChunks([
      { ...valid, collected_at: "invalid" }
    ], 1),
    /수집일/
  );
});

test("검증 과정에서 원본 객체 변경 없음", () => {
  const before = JSON.stringify(valid);

  validateAdvancedChunks([valid], 1);

  assert.equal(JSON.stringify(valid), before);
});
