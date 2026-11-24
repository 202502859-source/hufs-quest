import test from "node:test";
import assert from "node:assert/strict";
import { extractCourseRegistrationPeriod, extractApplicationPeriod } from "./noticeDate.mjs";
const cases = [
  {
    name: "연도 생략 및 매일 시간 표기",
    raw: `2026-겨울계절학기 수강신청 안내
수강신청
11. 25.(수) ~ 11. 27.(금) (매일 10:00 ~ 16:00)`,
    expected: {
      startsAt: "2026-11-25T10:00:00+09:00",
      deadline: "2026-11-27T16:00:00+09:00",
    },
  },
  {
    name: "날짜별 시간 표기",
    raw: `2026학년도 수강신청 안내
수강신청
2026. 11. 25.(수) 09:00 ~ 11. 27.(금) 17:00`,
    expected: {
      startsAt: "2026-11-25T09:00:00+09:00",
      deadline: "2026-11-27T17:00:00+09:00",
    },
  },
  {
    name: "연도가 바뀌는 신청 기간",
    raw: `2026학년도 수강신청 안내
수강신청
2026. 12. 30.(수) ~ 2027. 1. 3.(일) (매일 10:00 ~ 16:00)`,
    expected: {
      startsAt: "2026-12-30T10:00:00+09:00",
      deadline: "2027-01-03T16:00:00+09:00",
    },
  },
  {
    name: "시간이 없는 날짜는 추측하지 않음",
    raw: `2026학년도 수강신청 안내
수강신청
11. 25.(수) ~ 11. 27.(금)`,
    expected: null,
  },
];

for (const { name, raw, expected } of cases) {
  test(name, () => {
    assert.deepEqual(extractCourseRegistrationPeriod(raw), expected);
  });
}
const applicationRaw = `2026학년도 동계방학 기숙사 모집
작성자 기숙사 운영팀 조회수 100 등록일 2026.11.12
2. 신청기간 : 11월 17일(화) 09:00 ~ 11월 27일(금) 23:59까지`;

test("연도가 생략된 한글 신청기간 추출", () => {
  assert.deepEqual(extractApplicationPeriod(applicationRaw), {
    startsAt: "2026-11-17T09:00:00+09:00",
    deadline: "2026-11-27T23:59:00+09:00",
    evidence: "2. 신청기간 : 11월 17일(화) 09:00 ~ 11월 27일(금) 23:59까지",
  });
});

test("등록일과 제목의 연도가 다르면 보류", () => {
  const raw = applicationRaw.replace(
    "2026.11.12", "2025.11.12"
  );
  assert.equal(extractApplicationPeriod(raw), null);
});

test("요일이 일치하지 않으면 보류", () => {
  const raw = applicationRaw.replace(
    "17일(화)", "17일(수)"
  );
  assert.equal(extractApplicationPeriod(raw), null);
});

test("마감 시간이 없으면 추측하지 않음", () => {
  const raw = applicationRaw.replace("23:59", "");
  assert.equal(extractApplicationPeriod(raw), null);
});

test("신청기간이 여러 개면 보류", () => {
  const raw = applicationRaw + "\n3. 신청기간 : 11월 30일(월) 10:00";
  assert.equal(extractApplicationPeriod(raw), null);
});

const koreanTimeRaw =
  "2. 신청 기간 : 2026년 11월 24일(화) 10시 ~ 11월 30일(월) 16시";

test("한글 시간 표현과 종료 연도 생략", () => {
  assert.deepEqual(extractApplicationPeriod(koreanTimeRaw), {
    startsAt: "2026-11-24T10:00:00+09:00",
    deadline: "2026-11-30T16:00:00+09:00",
    evidence: koreanTimeRaw,
  });
});

test("한글 시간의 분 단위 처리", () => {
  const raw = koreanTimeRaw
    .replace("10시", "10시 30분")
    .replace("16시", "16시 45분");

  assert.deepEqual(extractApplicationPeriod(raw), {
    startsAt: "2026-11-24T10:30:00+09:00",
    deadline: "2026-11-30T16:45:00+09:00",
    evidence: raw,
  });
});

test("한글 시간 표현의 잘못된 요일 거부", () => {
  const raw = koreanTimeRaw.replace("24일(화)", "24일(수)");
  assert.equal(extractApplicationPeriod(raw), null);
});

test("잘못된 시간 거부", () => {
  const raw = koreanTimeRaw.replace("16시", "25시");
  assert.equal(extractApplicationPeriod(raw), null);
});

test("잘못된 분 단위 거부", () => {
  const raw = koreanTimeRaw.replace("16시", "16시 60분");
  assert.equal(extractApplicationPeriod(raw), null);
});

test("마감 시간이 없는 한글 날짜는 보류", () => {
  const raw = koreanTimeRaw.replace("16시", "");
  assert.equal(extractApplicationPeriod(raw), null);
});

test("시작 시간이 없는 한글 날짜는 보류", () => {
  const raw = koreanTimeRaw.replace("10시", "");
  assert.equal(extractApplicationPeriod(raw), null);
});

const deadlineOnlyRaw =
  "신청기간: 2026. 10. 27.(화) ~ 11. 27.(금) 23:59까지";

test("마감 시간만 명시된 신청기간 추출", () => {
  assert.deepEqual(extractApplicationPeriod(deadlineOnlyRaw), {
    startsAt: null,
    deadline: "2026-11-27T23:59:00+09:00",
    evidence: deadlineOnlyRaw,
  });
});

test("마감 시간 단독 추출 시 잘못된 요일 거부", () => {
  const raw = deadlineOnlyRaw.replace("27.(금)", "27.(목)");
  assert.equal(extractApplicationPeriod(raw), null);
});

test("마감 시간이 없으면 임의로 생성하지 않음", () => {
  const raw = deadlineOnlyRaw.replace("23:59", "");
  assert.equal(extractApplicationPeriod(raw), null);
});

test("마감일이 시작일보다 이전이면 보류", () => {
  const raw =
    "신청기간: 2026. 11. 27.(금) ~ 11. 24.(화) 23:59까지";

  assert.equal(extractApplicationPeriod(raw), null);
});
