import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNotice } from "./noticeExtract.mjs";

const raw = `2026학년도 장학금 신청 안내
학생지원팀
신청 기간: 2026년 11월 24일 09:00부터 2026년 11월 27일 17:00까지`;

const valid = {
  title: {
    value: "2026학년도 장학금 신청 안내",
    evidence: "2026학년도 장학금 신청 안내",
  },
  dept: {
    value: "학생지원팀",
    evidence: "학생지원팀",
  },
  category: {
    value: "scholarship",
    evidence: "장학금 신청 안내",
  },
  startsAt: {
    value: "2026-11-24T09:00:00+09:00",
    evidence: "2026년 11월 24일 09:00",
  },
  deadline: {
    value: "2026-11-27T17:00:00+09:00",
    evidence: "2026년 11월 27일 17:00",
  },
};

test("정상 공지 추출 결과 검증", () => {
  const result = validateNotice(raw, valid);

  assert.equal(result.title, valid.title.value);
  assert.equal(result.dept, "학생지원팀");
  assert.equal(result.category, "scholarship");
  assert.equal(result.startsAt, valid.startsAt.value);
  assert.equal(result.deadline, valid.deadline.value);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.checked, { on: "", by: "" });
});

test("원문에 없는 근거는 확인 필요", () => {
  const result = validateNotice(raw, {
    ...valid,
    dept: { value: "교무처", evidence: "교무처" },
  });

  assert.equal(result.dept, "확인 필요");
});

test("허용되지 않은 공지 분류는 확인 필요", () => {
  const result = validateNotice(raw, {
    ...valid,
    category: { value: "sports", evidence: "장학금 신청 안내" },
  });

  assert.equal(result.category, "확인 필요");
});

test("원문에 없는 날짜는 확인 필요", () => {
  const result = validateNotice(raw, {
    ...valid,
    deadline: {
      value: "2026-12-30T17:00:00+09:00",
      evidence: "2026년 11월 27일 17:00",
    },
  });

  assert.equal(result.deadline, "확인 필요");
});

test("개인 연락처가 포함된 값은 확인 필요", () => {
  const result = validateNotice(raw, {
    ...valid,
    dept: {
      value: "010-1234-5678",
      evidence: "학생지원팀",
    },
  });

  assert.equal(result.dept, "확인 필요");
});

test("명시된 시작 날짜를 AI가 누락하면 확인 필요", () => {
  const result = validateNotice(raw, {
    ...valid,
    startsAt: { value: null, evidence: null },
  });

  assert.equal(result.startsAt, "확인 필요");
});


test("담당자 이름이 포함된 값은 확인 필요", () => {
  const notice = raw + "\n담당자: 김철수";

  const result = validateNotice(notice, {
    ...valid,
    dept: {
      value: "담당자: 김철수",
      evidence: "담당자: 김철수",
    },
  });

  assert.equal(result.dept, "확인 필요");
});


test("명시된 날짜와 시간을 AI가 누락하면 확인 필요", () => {
  const result = validateNotice(raw, {
    ...valid,
    startsAt: { value: null, evidence: null },
    deadline: { value: null, evidence: null },
  });

  assert.equal(result.startsAt, "확인 필요");
  assert.equal(result.deadline, "확인 필요");
  assert.ok(result.issues.length > 0);
});


test("AI가 명시된 시작 시간을 누락하면 확인 필요", () => {
  const result = validateNotice(raw, {
    ...valid,
    startsAt: { value: null, evidence: null },
  });

  assert.equal(result.startsAt, "확인 필요");
  assert.ok(result.issues.some(issue => issue.includes("AI가 누락함")));
});

test("원문에 날짜와 시간이 없으면 null 유지", () => {
  const notice = `장학금 신청 안내
담당 부서: 학생지원팀
분류: 장학금
신청 일정은 추후 안내 예정`;

  const result = validateNotice(notice, {
    startsAt: { value: null, evidence: null },
    deadline: { value: null, evidence: null },
  });

  assert.equal(result.startsAt, null);
  assert.equal(result.deadline, null);
});
