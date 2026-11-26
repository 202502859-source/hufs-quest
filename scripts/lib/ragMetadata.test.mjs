import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  classifyTopic,
  classifySubtopic,
  classifyCampus,
  classifyCohort,
  buildMetadata
} from "./ragMetadata.mjs";

const chunks = JSON.parse(readFileSync(
  new URL("../../data/chunks.json", import.meta.url),
  "utf8"
));

const manual = JSON.parse(readFileSync(
  new URL("../../data/manual/sugang2026-2-seoul.json", import.meta.url),
  "utf8"
));

const find = id => {
  const chunk = chunks.find(c => c.id === id);
  assert.ok(chunk, `Missing chunk: ${id}`);
  return chunk;
};

test("학사일정 주제 및 학기 분류", () => {
  assert.equal(classifyTopic(find("11360-01")), "calendar");
  assert.equal(classifySubtopic(find("11360-01")), "spring_semester");
  assert.equal(classifySubtopic(find("11360-02")), "summer_break");
  assert.equal(classifySubtopic(find("11360-03")), "fall_semester");
  assert.equal(classifySubtopic(find("11360-04")), "winter_break");
});

test("일반 이중전공과 후기 이중전공 분리", () => {
  assert.equal(classifyTopic(find("11384-01")), "major");
  assert.equal(classifySubtopic(find("11384-01")), "double_major");
  assert.equal(classifySubtopic(find("11384-03")), "double_major");
  assert.equal(classifySubtopic(find("11384-09")), "late_double_major");
  assert.equal(classifySubtopic(find("11384-10")), "late_double_major");
  assert.equal(classifySubtopic(find("11384-12")), "major_contact");
});

test("부전공 및 융합전공 분류", () => {
  assert.equal(classifySubtopic(find("11385-01")), "minor");
  assert.equal(classifySubtopic(find("11254-03")), "convergence_major");
});

test("기존 수강신청 세부 주제 분류", () => {
  const expected = [
    "registration_basket",
    "registration_schedule",
    "registration_credits",
    "registration_change",
    "registration_cancel"
  ];

  expected.forEach((subtopic, i) => {
    const id = `11377-0${i + 1}`;
    assert.equal(classifyTopic(find(id)), "registration");
    assert.equal(classifySubtopic(find(id)), subtopic);
  });
});

test("서울캠퍼스 및 학번 조건 분류", () => {
  assert.equal(classifyCampus(find("11373-t01")), "seoul");

  assert.deepEqual(classifyCohort(find("11373-t01")), {
    cohort_min: 2025,
    cohort_max: null
  });

  assert.deepEqual(classifyCohort(find("11373-t03")), {
    cohort_min: 2015,
    cohort_max: 2024
  });
});

test("복수 학번 조건을 단일 학번 범위로 제한하지 않음", () => {
  for (const id of [
    "11384-03",
    "11384-04",
    "11384-07",
    "11388-01"
  ]) {
    assert.deepEqual(classifyCohort(find(id)), {
      cohort_min: null,
      cohort_max: null
    });
  }
});

test("신규 수강편람 15개 메타데이터 분류", () => {
  assert.equal(manual.length, 15);

  for (const c of manual) {
    const m = buildMetadata(c);
    assert.equal(m.topic, "registration");
    assert.equal(m.campus, "seoul");
    assert.ok(m.subtopic);
    assert.equal(m.cohort_min, null);
    assert.equal(m.cohort_max, null);
  }
});

test("관심강좌와 사전수강신청 구분", () => {
  const basket = manual.find(c => c.id === "sugang2026-2-03");
  const preapply = manual.find(c => c.id === "sugang2026-2-04");

  assert.equal(classifySubtopic(basket), "registration_basket");
  assert.equal(classifySubtopic(preapply), "registration_preapply");
  assert.ok(basket.text.includes("반드시 수강신청"));
  assert.ok(preapply.text.includes("자동으로 수강확정"));
  assert.ok(preapply.text.includes("별도로 신청"));
});

test("메타데이터 생성 시 원본 객체를 수정하지 않음", () => {
  const before = JSON.stringify(chunks);

  for (const c of chunks) {
    buildMetadata(c);
  }

  assert.equal(JSON.stringify(chunks), before);
});
