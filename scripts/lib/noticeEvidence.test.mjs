import { test } from "node:test";
import assert from "node:assert/strict";
import { attachNoticeEvidence } from "./noticeEvidence.mjs";
import { validateNotice } from "./noticeExtract.mjs";

const raw = `2026학년도 장학금 신청 안내

담당 부서: 학생지원팀
분류: 장학금

신청 시작: 2026년 11월 24일 09:00
신청 마감: 2026년 11월 27일 17:00`;

const extracted = {
  title: {
    value: "2026학년도 장학금 신청 안내",
    evidence: "공지 제목으로 명확히 표시됨",
  },
  dept: {
    value: "학생지원팀",
    evidence: "담당 부서로 명시되어 있음",
  },
  category: {
    value: "scholarship",
    evidence: "장학금 관련 공지임",
  },
  startsAt: {
    value: "2026-11-24T09:00:00+09:00",
    evidence: "신청 시작 날짜에서 확인 가능",
  },
  deadline: {
    value: "2026-11-27T17:00:00+09:00",
    evidence: "신청 마감 날짜에서 확인 가능",
  },
};

test("AI 설명형 근거를 원문 근거로 교체", () => {
  const result = attachNoticeEvidence(raw, extracted);

  assert.equal(
    result.title.evidence,
    "2026학년도 장학금 신청 안내"
  );
  assert.equal(
    result.dept.evidence,
    "담당 부서: 학생지원팀"
  );
  assert.equal(
    result.startsAt.evidence,
    "신청 시작: 2026년 11월 24일 09:00"
  );
  assert.equal(
    result.deadline.evidence,
    "신청 마감: 2026년 11월 27일 17:00"
  );
});

test("자동 연결한 근거가 최종 검증을 통과", () => {
  const attached = attachNoticeEvidence(raw, extracted);
  const result = validateNotice(raw, attached);

  assert.equal(result.title, extracted.title.value);
  assert.equal(result.dept, extracted.dept.value);
  assert.equal(result.category, "scholarship");
  assert.equal(result.startsAt, extracted.startsAt.value);
  assert.equal(result.deadline, extracted.deadline.value);
  assert.deepEqual(result.issues, []);
});

test("원문에 없는 날짜는 연결하지 않음", () => {
  const modified = structuredClone(extracted);

  modified.deadline.value = "2026-12-30T17:00:00+09:00";

  const result = attachNoticeEvidence(raw, modified);

  assert.equal(result.deadline.evidence, null);
});

test("시작일과 마감일이 혼합된 문장은 자동 연결하지 않음", () => {
  const mixed = `신청 시작: 2026년 11월 24일 09:00부터 신청 마감: 2026년 11월 27일 17:00까지`;

  const result = attachNoticeEvidence(mixed, extracted);

  assert.equal(result.startsAt.evidence, null);
  assert.equal(result.deadline.evidence, null);
});
