import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNoticeRequest,
  parseNoticeResponse,
} from "./noticeHcx007.mjs";

import {
  hasMultipleRounds,
  extractStandaloneDeadline,
  verifyStandaloneDeadline,
} from "./noticeHcx007Date.mjs";

import {
  validateHcx007Draft,
} from "./noticeHcx007Draft.mjs";

import {
  parseExtractOutput,
  buildDeadlineEntry,
} from "./noticeDraft.mjs";

import {
  formatHcx007Output,
  formatNoticeError,
  runNoticeHcx007,
} from "../extract-notice-hcx007.mjs";

const URL_OK =
  "https://www.hufs.ac.kr/bbs/hufs/2182/999001/artclView.do";

const HEADER = [
  "시험용 장학금 신청 안내",
  "담당 부서: 학생지원팀",
  "분류: 장학금",
].join("\n");

const DEADLINE_LINE =
  "신청 마감: 2026. 11. 30.(월) 17:00까지";

const DEADLINE =
  "2026-11-30T17:00:00+09:00";

const RAW = HEADER + "\n" + DEADLINE_LINE;

const EXTRACTED = {
  title: {
    value: "시험용 장학금 신청 안내",
    evidence: "시험용 장학금 신청 안내",
  },
  dept: {
    value: "학생지원팀",
    evidence: "담당 부서: 학생지원팀",
  },
  category: {
    value: "scholarship",
    evidence: "분류: 장학금",
  },
  startsAt: {
    value: null,
    evidence: null,
  },
  deadline: {
    value: DEADLINE,
    evidence: DEADLINE_LINE,
  },
};

function mockResponse(extracted) {
  const fields = Object.fromEntries(
    Object.entries(extracted).map(([key, field]) => [
      key,
      {
        value: field.value ?? "",
        evidence: field.evidence ?? "",
      },
    ])
  );

  return {
    status: { code: "20000" },
    result: {
      message: {
        content: JSON.stringify(fields),
      },
      finishReason: "stop",
    },
  };
}

test("HCX-007 Structured Outputs 요청 형식", () => {
  const body = buildNoticeRequest(RAW);

  assert.equal(body.thinking.effort, "none");
  assert.equal(body.maxCompletionTokens, 1200);
  assert.equal(body.responseFormat.type, "json");
  assert.equal(body.messages.length, 2);
  assert.equal(body.messages[1].content, RAW);

  assert.deepEqual(
    body.responseFormat.schema.required,
    ["title", "dept", "category", "startsAt", "deadline"]
  );
});

test("누락값을 null로 변환", () => {
  assert.deepEqual(
    parseNoticeResponse(mockResponse(EXTRACTED)),
    EXTRACTED
  );
});

test("비정상 응답 차단", () => {
  assert.throws(() => parseNoticeResponse({
    status: { code: "40000" },
  }));

  assert.throws(() => parseNoticeResponse({
    status: { code: "20000" },
    result: {
      message: { content: "invalid json" },
    },
  }));

  const truncated = mockResponse(EXTRACTED);
  truncated.result.finishReason = "length";

  assert.throws(() => parseNoticeResponse(truncated));
  assert.throws(() => buildNoticeRequest(""));
  assert.throws(() => buildNoticeRequest("가".repeat(30001)));
});

const dateCases = [
  [
    "F01 명시된 날짜 및 시각",
    "2026. 11. 30.(월) 17:00까지",
    DEADLINE,
  ],
  [
    "F02 연도·시각 미기재",
    "신청 기간: ~12/5(금)",
    null,
  ],
  [
    "F03 복수 차수",
    "1차 마감: 2026.11.30.(월) 17:00\n" +
      "2차 마감: 2026.12.04.(금) 18:00",
    null,
  ],
  [
    "F04 시각 미기재",
    "신청 마감: 2026.11.30.(월)까지",
    null,
  ],
  [
    "잘못된 요일",
    "신청 마감: 2026.11.30.(화) 17:00",
    null,
  ],
  [
    "존재하지 않는 날짜",
    "신청 마감: 2026.11.31. 17:00",
    null,
  ],
  [
    "잘못된 시각",
    "신청 마감: 2026.11.30.(월) 25:00",
    null,
  ],
  [
    "시작일과 마감일 구분",
    "신청 시작: 2026.11.30.(월) 17:00",
    null,
  ],
  [
    "기간과 단독 마감 구분",
    "신청 기간: 2026.11.25.(수) 09:00 ~ 11.30.(월) 17:00",
    null,
  ],
  [
    "한글 날짜",
    "신청 마감: 2026년 11월 30일 17:00",
    DEADLINE,
  ],
  [
    "서로 다른 마감 후보",
    "신청 마감: 2026.11.30.(월) 17:00\n" +
      "서류 제출 마감: 2026.12.04.(금) 18:00",
    null,
  ],
];

for (const [name, raw, expected] of dateCases) {
  test("날짜 검증: " + name, () => {
    const result = extractStandaloneDeadline(raw);

    assert.equal(result?.deadline ?? null, expected);
  });
}

test("AI 날짜와 독립 원문 검증 결과 일치", () => {
  assert.equal(
    verifyStandaloneDeadline(RAW, DEADLINE).ok,
    true
  );

  assert.equal(
    verifyStandaloneDeadline(
      RAW,
      "2026-11-30T18:00:00+09:00"
    ).ok,
    false
  );

  assert.equal(
    verifyStandaloneDeadline(
      RAW,
      "2027-11-30T17:00:00+09:00"
    ).ok,
    false
  );

  assert.equal(hasMultipleRounds(dateCases[2][1]), true);
});

test("정상 공지 초안 생성 및 checked 제외", () => {
  const result = validateHcx007Draft(
    RAW, EXTRACTED, URL_OK
  );

  assert.equal(result.ok, true, result.reason);
  assert.equal(result.draft.id, "notice-999001");
  assert.equal(result.draft.startsAt, null);
  assert.equal(result.draft.deadline, DEADLINE);
  assert.equal(result.draft.title.en, "");
  assert.equal(result.draft.dept.en, "");
  assert.equal(Object.hasOwn(result.draft, "checked"), false);
});

const updatedDraftCases = [
  {
    name: "F02 연도 및 시각 보완",
    raw: dateCases[1][1],
    expected: "2026-12-05T23:59:00+09:00",
    notes: ["연도 추정", "시각 없음", "요일 불일치"],
  },
  {
    name: "F03 복수 마감",
    raw: dateCases[2][1],
    expected: "2026-12-04T18:00:00+09:00",
    notes: ["복수 마감", "1차 마감:"],
  },
  {
    name: "F04 시각 보완",
    raw: dateCases[3][1],
    expected: "2026-11-30T23:59:00+09:00",
    notes: ["시각 없음 → 23:59로 둠"],
  },
];

for (const fixture of updatedDraftCases) {
  test("검수용 초안 생성: " + fixture.name, () => {
    const extracted = structuredClone(EXTRACTED);

    extracted.deadline = {
      value: null,
      evidence: null,
    };

    const result = validateHcx007Draft(
      HEADER + "\n" + fixture.raw,
      extracted,
      URL_OK,
      { publishedAt: "2026-11-27" }
    );

    assert.equal(result.ok, true, result.reason);
    assert.equal(result.draft.deadline, fixture.expected);
    assert.equal(Object.hasOwn(result.draft, "checked"), false);

    for (const note of fixture.notes) {
      assert.ok(
        result.reviewNotes.some(value => value.includes(note)),
        "검수 메모 누락: " + note
      );
    }
  });
}

const rejectedFields = [
  ["deadline", "2026-11-30T18:00:00+09:00"],
  ["deadline", "2027-11-30T17:00:00+09:00"],
  ["startsAt", "2026-11-29T09:00:00+09:00"],
  ["title", "원문에 없는 제목"],
  ["dept", "교무처"],
];

for (const [field, value] of rejectedFields) {
  test("근거 불일치 차단: " + field + " / " + value, () => {
    const extracted = structuredClone(EXTRACTED);
    extracted[field].value = value;

    const result = validateHcx007Draft(
      RAW, extracted, URL_OK
    );

    assert.equal(result.ok, false);
    assert.equal(result.draft, null);
  });
}

test("일반 신청 기간 검증", () => {
  const line =
    "신청기간: 2026. 11. 24.(화) 09:00 ~ 11. 27.(금) 17:00";

  const extracted = structuredClone(EXTRACTED);

  extracted.startsAt = {
    value: "2026-11-24T09:00:00+09:00",
    evidence: line,
  };

  extracted.deadline = {
    value: "2026-11-27T17:00:00+09:00",
    evidence: line,
  };

  const result = validateHcx007Draft(
    HEADER + "\n" + line,
    extracted,
    URL_OK
  );

  assert.equal(result.ok, true, result.reason);
  assert.equal(result.draft.startsAt, extracted.startsAt.value);
  assert.equal(result.draft.deadline, extracted.deadline.value);
});

test("학교 외부 URL 차단", () => {
  const result = validateHcx007Draft(
    RAW, EXTRACTED, "https://example.com/notice"
  );

  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
});

test("현규 기존 파서와 호환", () => {
  const result = validateHcx007Draft(
    RAW, EXTRACTED, URL_OK
  );

  const output = formatHcx007Output(result);
  const parsed = parseExtractOutput(output);

  assert.deepEqual(parsed.draft, result.draft);
  assert.deepEqual(parsed.evidence, result.evidence);

  const { entry } = buildDeadlineEntry(
    parsed.draft, URL_OK
  );

  assert.equal(entry.id, result.draft.id);
  assert.equal(entry.deadline, DEADLINE);
  assert.equal(Object.hasOwn(entry, "checked"), false);
});

test("폐기 사유를 안전하게 출력", () => {
  assert.throws(
    () => formatHcx007Output({
      ok: false,
      reason: "AI 마감 일시와 원문 마감 일시 불일치",
      draft: null,
    }),
    error => {
      assert.equal(
        formatNoticeError(error),
        "공지 초안 폐기: AI 마감 일시와 원문 마감 일시 불일치"
      );
      return true;
    }
  );
});

test("알 수 없는 오류의 세부 내용은 출력하지 않음", () => {
  const error = new Error("TEST_ONLY_PRIVATE_VALUE");

  assert.doesNotMatch(
    formatNoticeError(error),
    /TEST_ONLY_PRIVATE_VALUE/
  );
});

test("허용 목록 밖 폐기 사유도 그대로 출력하지 않음", () => {
  assert.throws(
    () => formatHcx007Output({
      ok: false,
      reason: "TEST_ONLY_PRIVATE_VALUE",
      draft: null,
    }),
    error => {
      assert.equal(
        formatNoticeError(error),
        "공지 초안 폐기: 기타 원문 검증 실패"
      );
      return true;
    }
  );
});

test("checked 포함 초안 출력 차단", () => {
  const result = validateHcx007Draft(
    RAW, EXTRACTED, URL_OK
  );

  result.draft.checked = { on: "", by: "" };

  assert.throws(
    () => formatHcx007Output(result),
    /checked/
  );
});

test("CLI import 및 실행 호환", async () => {
  const result = validateHcx007Draft(
    RAW, EXTRACTED, URL_OK
  );

  let calls = 0;

  const output = await runNoticeHcx007(
    ["fixture.txt", URL_OK],
    {
      read: async () => RAW,
      extract: async (raw, url) => {
        calls++;
        assert.equal(raw, RAW);
        assert.equal(url, URL_OK);
        return result;
      },
    }
  );

  assert.equal(calls, 1);
  assert.deepEqual(
    parseExtractOutput(output).draft,
    result.draft
  );
});

test("잘못된 URL은 모델 호출 전에 차단", async () => {
  let calls = 0;

  await assert.rejects(
    () => runNoticeHcx007(
      ["fixture.txt", "https://example.com/notice"],
      {
        read: async () => RAW,
        extract: async () => {
          calls++;
        },
      }
    )
  );

  assert.equal(calls, 0);
});

test("빈 원문 및 인수 오류 차단", async () => {
  let calls = 0;

  await assert.rejects(
    () => runNoticeHcx007([])
  );

  await assert.rejects(
    () => runNoticeHcx007(
      ["fixture.txt", URL_OK],
      {
        read: async () => " ",
        extract: async () => {
          calls++;
        },
      }
    )
  );

  assert.equal(calls, 0);
});

test("이메일이 있는 원문은 API 요청 전에 차단", () => {
  assert.throws(
    () => buildNoticeRequest(
      RAW + "\n문의: test@example.invalid"
    ),
    /개인정보 의심 표현/
  );
});

test("휴대전화 번호가 있는 원문 차단", () => {
  assert.throws(
    () => buildNoticeRequest(
      RAW + "\n문의: 010-0000-0000"
    ),
    /개인정보 의심 표현/
  );
});

test("학번이 명시된 원문 차단", () => {
  assert.throws(
    () => buildNoticeRequest(
      RAW + "\n학번: 000000000"
    ),
    /개인정보 의심 표현/
  );
});

test("담당자 이름이 명시된 원문 차단", () => {
  assert.throws(
    () => buildNoticeRequest(
      RAW + "\n담당자: 홍길동"
    ),
    /개인정보 의심 표현/
  );
});

test("개인정보 검사에서 정상 시험 원문 허용", () => {
  assert.equal(
    buildNoticeRequest(RAW).messages[1].content,
    RAW
  );
});

test("시각이 없는 별도 마감도 함께 있으면 보류", () => {
  const result = validateHcx007Draft(
    RAW + "\n서류 제출 마감: 2026.12.04.(금)",
    EXTRACTED,
    URL_OK
  );

  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
  assert.equal(
    result.reason,
    "복수 마감 문장: 원문 확인 필요"
  );
});

test("별도 시작 일시가 누락되면 보류", () => {
  const result = validateHcx007Draft(
    RAW + "\n신청 시작: 2026.11.24.(화) 09:00",
    EXTRACTED,
    URL_OK
  );

  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
  assert.equal(
    result.reason,
    "시작 일시가 별도로 명시됨: 원문 확인 필요"
  );
});

test("개인정보 폐기 사유를 안전하게 표시", () => {
  const error = new Error(
    "개인정보 의심 표현: 원문 정리 후 다시 실행"
  );

  assert.equal(
    formatNoticeError(error),
    "공지 초안 폐기: 개인정보 의심 표현을 제거한 후 다시 실행하세요."
  );
});

test("Structured Outputs에서 공지 분류 enum 제한", () => {
  const schema = buildNoticeRequest(RAW)
    .responseFormat.schema;

  assert.deepEqual(
    schema.properties.category.properties.value.enum,
    [
      "academic",
      "scholarship",
      "campus",
      "external",
      "",
    ]
  );

  assert.equal(
    schema.properties.title.properties.value.enum,
    undefined
  );
});

test("허용되지 않은 AI 분류값은 파싱에서 차단", () => {
  const extracted = structuredClone(EXTRACTED);

  extracted.category.value = "unknown";

  assert.throws(
    () => parseNoticeResponse(mockResponse(extracted)),
    /허용되지 않은 공지 분류/
  );
});

test("분류 누락은 null 처리 후 최종 초안에서 차단", () => {
  const extracted = structuredClone(EXTRACTED);

  extracted.category = {
    value: null,
    evidence: null,
  };

  const parsed = parseNoticeResponse(
    mockResponse(extracted)
  );

  assert.equal(parsed.category.value, null);

  const result = validateHcx007Draft(
    RAW,
    parsed,
    URL_OK
  );

  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
});

import {
  validPublishedAt,
  extractReviewableDeadline
} from "./noticeHcx007Date.mjs";

const POSTED_AT = "2026-11-27";

const reviewableCases = [
  {
    name: "F01 정상 마감",
    raw: DEADLINE_LINE,
    expected: DEADLINE,
    notes: [],
  },
  {
    name: "F02 연도 및 시각 보완",
    raw: "신청 기간: ~12/5(금)",
    expected: "2026-12-05T23:59:00+09:00",
    notes: [
      "연도 추정",
      "시각 없음 → 23:59로 둠",
      "요일 불일치",
    ],
  },
  {
    name: "F03 마지막 차수 마감",
    raw: "1차 마감: 2026.11.30.(월) 17:00\n" +
      "2차 마감: 2026.12.04.(금) 18:00",
    expected: "2026-12-04T18:00:00+09:00",
    notes: [
      "복수 마감",
      "1차 마감: 2026-11-30T17:00:00+09:00",
    ],
  },
  {
    name: "F04 시각 보완",
    raw: "신청 마감: 2026.11.30.(월)까지",
    expected: "2026-11-30T23:59:00+09:00",
    notes: ["시각 없음 → 23:59로 둠"],
  },
  {
    name: "날짜만 있는 신청 기간",
    raw: "신청기간: 2026.11.28. ~ 12.04.",
    expected: "2026-12-04T23:59:00+09:00",
    notes: [
      "시작 시각 없음",
      "시각 없음 → 23:59로 둠",
    ],
  },
  {
    name: "명시된 시각이 있는 기간",
    raw: "신청기간: 2026.11.24.(화) 09:00 ~ 11.27.(금) 17:00",
    expected: "2026-11-27T17:00:00+09:00",
    startsAt: "2026-11-24T09:00:00+09:00",
    notes: [],
  },
  {
    name: "12월 게시 1월 마감",
    raw: "신청 마감: 1/5",
    publishedAt: "2026-12-27",
    expected: "2027-01-05T23:59:00+09:00",
    notes: ["연도 추정"],
  },
  {
    name: "한글 오후 시각",
    raw: "신청 마감: 2026년 11월 30일 오후 5시",
    expected: DEADLINE,
    notes: [],
  },
];

for (const fixture of reviewableCases) {
  test("검수용 날짜 보완: " + fixture.name, () => {
    const result = extractReviewableDeadline(
      fixture.raw,
      fixture.publishedAt ?? POSTED_AT
    );

    assert.ok(result);
    assert.equal(
      result.deadline,
      fixture.expected
    );

    assert.equal(
      result.startsAt,
      fixture.startsAt ?? null
    );

    assert.ok(
      fixture.raw.includes(result.evidence)
    );

    for (const note of fixture.notes) {
      assert.ok(
        result.reviewNotes.some(
          value => value.includes(note)
        ),
        "검수 메모 누락: " + note
      );
    }
  });
}

test("게시일 없이 연도 추정 금지", () => {
  assert.equal(
    extractReviewableDeadline(
      "신청 마감: 12/5"
    ),
    null
  );
});

test("연도 명시 시 게시일 없이 처리 가능", () => {
  assert.equal(
    extractReviewableDeadline(
      "신청 마감: 2026.11.30."
    ).deadline,
    "2026-11-30T23:59:00+09:00"
  );
});

test("게시일 형식과 실제 날짜 검증", () => {
  assert.equal(validPublishedAt(POSTED_AT), true);
  assert.equal(validPublishedAt("2026-02-30"), false);
  assert.equal(validPublishedAt("2026-13-01"), false);
  assert.equal(validPublishedAt("26-11-27"), false);
  assert.equal(validPublishedAt(null), false);
});

const invalidReviewableDates = [
  ["날짜 없음", "신청 마감: 추후 공지"],
  ["존재하지 않는 날짜", "신청 마감: 2026.11.31."],
  ["잘못된 시각", "신청 마감: 2026.11.30. 25:00"],
  ["잘못된 분", "신청 마감: 2026.11.30. 17:60"],
  ["명시 연도 요일 오류", "신청 마감: 2026.11.30.(화)"],
  ["다른 일정", "결과 발표: 2026.12.05."],
  ["시작일만 존재", "신청 시작: 2026.11.30."],
  [
    "복수 차수 중 일부 날짜 없음",
    "1차 마감: 2026.11.30.\n2차 마감: 추후 공지"
  ],
  [
    "차수 없는 별도 마감",
    "신청 마감: 2026.11.30.\n" +
      "서류 제출 마감: 2026.12.04."
  ],
];

for (const [name, raw] of invalidReviewableDates) {
  test("검수용 날짜 차단: " + name, () => {
    assert.equal(
      extractReviewableDeadline(raw, POSTED_AT),
      null
    );
  });
}

test("검수용 날짜: 해석 불가능한 별도 마감 무시 금지", () => {
  assert.equal(
    extractReviewableDeadline(
      "신청 마감: 2026.11.30. 17:00\n" +
      "서류 제출 마감: 추후 공지",
      POSTED_AT
    ),
    null
  );
});

test("검수용 날짜: 별도 마감의 잘못된 시각 차단", () => {
  assert.equal(
    extractReviewableDeadline(
      "신청 마감: 2026.11.30. 17:00\n" +
      "서류 제출 마감: 2026.12.04. 25:00",
      POSTED_AT
    ),
    null
  );
});

test("검수용 날짜: 차수와 날짜 순서 충돌 차단", () => {
  assert.equal(
    extractReviewableDeadline(
      "1차 마감: 2026.12.04. 18:00\n" +
      "2차 마감: 2026.11.30. 17:00",
      POSTED_AT
    ),
    null
  );
});

test("검수용 날짜: 게시일과 무관한 명시 연도 보존", () => {
  const result = extractReviewableDeadline(
    "신청 마감: 2027.01.05. 17:00",
    POSTED_AT
  );

  assert.ok(result);

  assert.equal(
    result.deadline,
    "2027-01-05T17:00:00+09:00"
  );

  assert.deepEqual(result.reviewNotes, []);
});

test("검수용 날짜: 원문 문장 순서와 관계없이 차수 처리", () => {
  const result = extractReviewableDeadline(
    "2차 마감: 2026.12.04. 18:00\n" +
    "1차 마감: 2026.11.30. 17:00",
    POSTED_AT
  );

  assert.ok(result);

  assert.equal(
    result.deadline,
    "2026-12-04T18:00:00+09:00"
  );

  assert.ok(
    result.reviewNotes.includes("복수 마감")
  );
});

test("검수용 날짜: 명시 시각에는 23:59 보완 금지", () => {
  const result = extractReviewableDeadline(
    "신청 마감: 2026.11.30. 09:30",
    POSTED_AT
  );

  assert.ok(result);

  assert.equal(
    result.deadline,
    "2026-11-30T09:30:00+09:00"
  );

  assert.deepEqual(result.reviewNotes, []);
});


test("날짜 보완 초안: 개인정보 포함 원문 폐기", () => {
  const result = validateHcx007Draft(
    RAW + "\n문의: test@example.invalid",
    EXTRACTED,
    URL_OK
  );

  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
  assert.match(result.reason, /개인정보/);
});

test("날짜 보완 초안: 날짜 없는 공지 폐기", () => {
  const result = validateHcx007Draft(
    HEADER + "\n신청 마감: 추후 공지",
    EXTRACTED,
    URL_OK,
    { publishedAt: POSTED_AT }
  );

  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
});

test("날짜 보완 초안: 잘못된 게시일 차단", () => {
  const result = validateHcx007Draft(
    RAW,
    EXTRACTED,
    URL_OK,
    { publishedAt: "2026-02-30" }
  );

  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
});

test("날짜 보완 초안: 보완된 날짜도 원문 제목 검증 유지", () => {
  const extracted = structuredClone(EXTRACTED);
  extracted.title.value = "원문에 없는 제목";

  const result = validateHcx007Draft(
    HEADER + "\n신청 마감: 2026.11.30.",
    extracted,
    URL_OK
  );

  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
});

test("날짜 보완 초안: 불명확한 별도 마감 우회 금지", () => {
  const result = validateHcx007Draft(
    RAW + "\n서류 제출 마감: 추후 공지",
    EXTRACTED,
    URL_OK
  );

  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
});

test("날짜 보완 초안: 정상 날짜는 검수 메모 없음", () => {
  const result = validateHcx007Draft(
    RAW,
    EXTRACTED,
    URL_OK
  );

  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(result.reviewNotes, []);
});


test("게시일 CLI: 입력 게시일을 검증 함수에 전달", async () => {
  const raw = HEADER + "\n신청 기간: ~12/5(금)";

  const output = await runNoticeHcx007(
    ["fixture.txt", URL_OK, "--published-at", POSTED_AT],
    {
      read: async () => raw,
      extract: async (text, url, options) => {
        assert.equal(text, raw);
        assert.equal(url, URL_OK);
        assert.equal(options.publishedAt, POSTED_AT);

        return validateHcx007Draft(
          text, EXTRACTED, url, options
        );
      },
    }
  );

  const parsed = parseExtractOutput(output);

  assert.equal(
    parsed.draft.deadline,
    "2026-12-05T23:59:00+09:00"
  );

  assert.match(output, /=== 검수 메모 ===/);
  assert.match(output, /연도 추정/);
  assert.match(output, /시각 없음 → 23:59로 둠/);
  assert.match(output, /요일 불일치/);
});

test("게시일 CLI: 잘못된 날짜는 모델 호출 전에 차단", async () => {
  let calls = 0;

  await assert.rejects(
    () => runNoticeHcx007(
      ["fixture.txt", URL_OK, "--published-at", "2026-02-30"],
      {
        read: async () => RAW,
        extract: async () => {
          calls++;
        },
      }
    ),
    /게시일 형식 또는 날짜 오류/
  );

  assert.equal(calls, 0);
});

test("게시일 CLI: 게시일 생략 시 기존 호출 호환", async () => {
  const output = await runNoticeHcx007(
    ["fixture.txt", URL_OK],
    {
      read: async () => RAW,
      extract: async (raw, url, options) => {
        assert.equal(options.publishedAt, null);

        return validateHcx007Draft(
          raw, EXTRACTED, url, options
        );
      },
    }
  );

  assert.equal(
    parseExtractOutput(output).draft.deadline,
    DEADLINE
  );
});

test("게시일 CLI: 연도 추정에 필요한 게시일 누락 차단", async () => {
  await assert.rejects(
    () => runNoticeHcx007(
      ["fixture.txt", URL_OK],
      {
        read: async () =>
          HEADER + "\n신청 기간: ~12/5(금)",
        extract: async (raw, url, options) =>
          validateHcx007Draft(
            raw, EXTRACTED, url, options
          ),
      }
    ),
    /공지 초안 폐기/
  );
});

test("게시일 CLI: 검수 메모와 실제 공지 데이터 분리", () => {
  const result = validateHcx007Draft(
    HEADER + "\n신청 마감: 2026.11.30.",
    EXTRACTED,
    URL_OK
  );

  assert.equal(result.ok, true, result.reason);

  const output = formatHcx007Output(result);
  const parsed = parseExtractOutput(output);

  assert.match(output, /"reviewNotes":/);
  assert.match(output, /시각 없음 → 23:59로 둠/);

  assert.equal(
    Object.hasOwn(parsed.draft, "reviewNotes"),
    false
  );

  assert.equal(
    Object.hasOwn(parsed.draft, "checked"),
    false
  );

  const { entry } = buildDeadlineEntry(
    parsed.draft, URL_OK
  );

  assert.equal(
    Object.hasOwn(entry, "reviewNotes"),
    false
  );

  assert.equal(
    Object.hasOwn(entry, "checked"),
    false
  );
});

test("게시일 CLI: 잘못된 게시일 오류 안내", () => {
  assert.equal(
    formatNoticeError(
      new Error("게시일 형식 또는 날짜 오류")
    ),
    "게시일은 실제 날짜를 YYYY-MM-DD 형식으로 입력하세요."
  );
});


test("검수 연동: 출력 파서에서 검수 메모 유지", () => {
  const result = validateHcx007Draft(
    HEADER + "\n신청 기간: ~12/5(금)",
    EXTRACTED,
    URL_OK,
    { publishedAt: POSTED_AT }
  );

  assert.equal(result.ok, true, result.reason);

  const parsed = parseExtractOutput(
    formatHcx007Output(result)
  );

  assert.deepEqual(
    parsed.reviewNotes,
    result.reviewNotes
  );

  assert.deepEqual(parsed.draft, result.draft);

  assert.equal(
    Object.hasOwn(parsed.draft, "reviewNotes"),
    false
  );
});

test("검수 연동: 기존 HCX-005 출력 호환", () => {
  const output = [
    "=== 공지 추출 JSON 초안 ===",
    JSON.stringify({ evidence: {} }),
    "=== shared/deadlines.js 입력용 초안 ===",
    JSON.stringify({
      deadline: DEADLINE
    }),
  ].join("\n");

  const parsed = parseExtractOutput(output);

  assert.deepEqual(parsed.reviewNotes, []);
  assert.equal(parsed.draft.deadline, DEADLINE);
});

test("검수 연동: 잘못된 검수 메모 형식 차단", () => {
  for (const reviewNotes of [
    "잘못된 형식",
    [123],
    ["첫째 줄\n둘째 줄"],
    [""]
  ]) {
    const output = [
      "=== 공지 추출 JSON 초안 ===",
      JSON.stringify({
        evidence: {},
        reviewNotes
      }),
      "=== shared/deadlines.js 입력용 초안 ===",
      JSON.stringify({
        deadline: DEADLINE
      }),
    ].join("\n");

    assert.throws(
      () => parseExtractOutput(output),
      /검수 메모 형식 오류/
    );
  }
});

test("검수 연동: 실제 notice:draft dry-run 문서에 메모 보존", async () => {
  const {
    mkdtemp, writeFile, readFile, rm
  } = await import("node:fs/promises");

  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { spawnSync } = await import("node:child_process");

  const dir = await mkdtemp(
    join(tmpdir(), "hcx007-review-")
  );

  try {
    const result = validateHcx007Draft(
      HEADER + "\n신청 기간: ~12/5(금)",
      EXTRACTED,
      URL_OK,
      { publishedAt: POSTED_AT }
    );

    assert.equal(result.ok, true, result.reason);

    const outputFile = join(dir, "fixture-output.txt");

    await writeFile(
      outputFile,
      formatHcx007Output(result)
    );

    const cli = fileURLToPath(
      new URL("../notice-draft.mjs", import.meta.url)
    );

    const run = spawnSync(
      process.execPath,
      [
        cli,
        "fixture.txt",
        URL_OK,
        "--published-at",
        POSTED_AT,
        "--from-output",
        outputFile,
        "--dry-run",
      ],
      {
        cwd: dir,
        encoding: "utf8"
      }
    );

    assert.equal(run.status, 0, run.stderr);

    const note = await readFile(
      join(dir, ".local", "notice-draft-999001.md"),
      "utf8"
    );

    for (const expected of result.reviewNotes) {
      assert.ok(
        run.stdout.includes(expected),
        "터미널 검수 메모 누락"
      );

      assert.ok(
        note.includes(expected),
        "로컬 검수 문서 메모 누락"
      );
    }

    assert.match(note, /2026-12-05T23:59:00\+09:00/);
    assert.match(note, /checked/);
    assert.match(note, /원문 근거/);
    assert.match(run.stdout, /--dry-run/);

  } finally {
    // 이 테스트가 직접 만든 임시 디렉터리만 정리한다.
    await rm(dir, {
      recursive: true,
      force: true
    });
  }
});


test("요일 우회 방지: S08 신청 시작일 요일 오류", () => {
  const line =
    "신청기간: 2026.11.24.(월) 09:00 ~ " +
    "2026.11.30.(월) 17:00";

  const extracted = structuredClone(EXTRACTED);

  extracted.startsAt = {
    value: "2026-11-24T09:00:00+09:00",
    evidence: line,
  };

  extracted.deadline = {
    value: DEADLINE,
    evidence: line,
  };

  const result = validateHcx007Draft(
    HEADER + "\n" + line,
    extracted,
    URL_OK,
    { publishedAt: POSTED_AT }
  );

  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
  assert.equal(result.reason, "명시 날짜와 요일 불일치");
});

test("요일 우회 방지: 명시된 마감일 요일 오류", () => {
  const line =
    "신청기간: 2026.11.24.(화) 09:00 ~ " +
    "2026.11.30.(화) 17:00";

  const extracted = structuredClone(EXTRACTED);

  extracted.startsAt = {
    value: "2026-11-24T09:00:00+09:00",
    evidence: line,
  };

  extracted.deadline = {
    value: DEADLINE,
    evidence: line,
  };

  const result = validateHcx007Draft(
    HEADER + "\n" + line,
    extracted,
    URL_OK,
    { publishedAt: POSTED_AT }
  );

  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
  assert.equal(result.reason, "명시 날짜와 요일 불일치");
});

test("요일 우회 방지: 정상 신청 기간 유지", () => {
  const line =
    "신청기간: 2026.11.24.(화) 09:00 ~ " +
    "2026.11.30.(월) 17:00";

  const extracted = structuredClone(EXTRACTED);

  extracted.startsAt = {
    value: "2026-11-24T09:00:00+09:00",
    evidence: line,
  };

  extracted.deadline = {
    value: DEADLINE,
    evidence: line,
  };

  const result = validateHcx007Draft(
    HEADER + "\n" + line,
    extracted,
    URL_OK,
    { publishedAt: POSTED_AT }
  );

  assert.equal(result.ok, true, result.reason);
  assert.equal(result.draft.deadline, DEADLINE);
  assert.equal(
    result.draft.startsAt,
    extracted.startsAt.value
  );
  assert.deepEqual(result.reviewNotes, []);
});

test("요일 우회 방지: 연도 생략 F02 검수 정책 유지", () => {
  const result = validateHcx007Draft(
    HEADER + "\n신청 기간: ~12/5(금)",
    EXTRACTED,
    URL_OK,
    { publishedAt: POSTED_AT }
  );

  assert.equal(result.ok, true, result.reason);

  assert.equal(
    result.draft.deadline,
    "2026-12-05T23:59:00+09:00"
  );

  assert.ok(
    result.reviewNotes.some(
      note => note.includes("요일 불일치")
    )
  );
});

// 11/27 연도 추정 규칙 보완(이종헌)
// 게시일과 같은 해 → 30일 넘게 앞서면 다음 해 → 요일로 확인.
// weekday 값은 node로 계산해 확인한 값이다(아래 테스트에서 다시 계산).
const weekdayOfISO = iso =>
  "일월화수목금토"[
    new Date(Date.UTC(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)) - 1,
      Number(iso.slice(8, 10))
    )).getUTCDay()
  ];

const yearRolloverCases = [
  {
    name: "11월 게시 1월 마감은 다음 해",
    raw: "~1/8(금)까지",
    publishedAt: "2026-11-27",
    expected: "2027-01-08T23:59:00+09:00",
    weekday: "금", // 2026-01-08은 목요일
    year: 2027,
    mismatch: false,
  },
  {
    name: "11월 게시 2월 마감은 다음 해",
    raw: "2/26(금) 17:00까지",
    publishedAt: "2026-11-27",
    expected: "2027-02-26T17:00:00+09:00",
    weekday: "금", // 2026-02-26은 목요일
    year: 2027,
    mismatch: false,
  },
  {
    name: "30일 이내로 앞선 날짜는 게시 연도 유지",
    raw: "11/20(금)까지",
    publishedAt: "2026-11-27",
    expected: "2026-11-20T23:59:00+09:00",
    weekday: "금", // 7일 전, 2027-11-20은 토요일
    year: 2026,
    mismatch: false,
  },
  {
    name: "12월 게시 요일 없는 1월 마감은 다음 해(기존 동작)",
    raw: "1/5까지",
    publishedAt: "2026-12-20",
    expected: "2027-01-05T23:59:00+09:00",
    weekday: null,
    year: 2027,
    mismatch: false,
  },
  {
    name: "같은 달 뒤 날짜는 게시 연도",
    raw: "3/13(금)까지",
    publishedAt: "2026-03-02",
    expected: "2026-03-13T23:59:00+09:00",
    weekday: "금", // 2027-03-13은 토요일
    year: 2026,
    mismatch: false,
  },
  {
    name: "정확히 30일 앞선 날짜는 게시 연도 유지",
    raw: "10/28까지",
    publishedAt: "2026-11-27",
    expected: "2026-10-28T23:59:00+09:00",
    weekday: null,
    year: 2026,
    mismatch: false,
  },
  {
    name: "30일 넘게 앞서도 요일이 게시 연도와 맞으면 게시 연도",
    raw: "10/23(금)까지",
    publishedAt: "2026-11-27",
    // 35일 전이라 2)까지는 2027년이지만
    // 2027-10-23은 토요일, 2026-10-23은 금요일
    expected: "2026-10-23T23:59:00+09:00",
    weekday: "금",
    year: 2026,
    mismatch: false,
  },
  {
    name: "요일이 어느 해와도 안 맞으면 날짜 유지 + 요일 불일치",
    raw: "~1/9(월)까지",
    publishedAt: "2026-11-27",
    // 2026-01-09는 금요일, 2027-01-09는 토요일
    expected: "2027-01-09T23:59:00+09:00",
    weekday: "토",
    year: 2027,
    mismatch: true,
  },
];

for (const fixture of yearRolloverCases) {
  test("연도 추정 규칙: " + fixture.name, () => {
    const result = extractReviewableDeadline(
      fixture.raw,
      fixture.publishedAt
    );

    assert.ok(result);
    assert.equal(result.deadline, fixture.expected);
    assert.equal(result.startsAt, null);

    if (fixture.weekday) {
      assert.equal(
        weekdayOfISO(result.deadline),
        fixture.weekday
      );
    }

    assert.ok(
      result.reviewNotes.includes(
        `연도 추정: 게시일 ${fixture.publishedAt} ` +
        `기준 ${fixture.year}년`
      ),
      "연도 추정 메모 누락: " +
        result.reviewNotes.join(" / ")
    );

    assert.equal(
      result.reviewNotes.some(
        note => note.startsWith("요일 불일치")
      ),
      fixture.mismatch
    );
  });
}

test("연도 추정 규칙: 앞선 날짜 기준 연도는 그대로", () => {
  const result = extractReviewableDeadline(
    "신청 기간: 12/28(월) ~ 1/8(금)",
    "2026-11-27"
  );

  assert.ok(result);
  // 시작일 12/28은 게시 연도, 종료일은 앞선 날짜를 따라 다음 해
  assert.equal(
    result.deadline,
    "2027-01-08T23:59:00+09:00"
  );
  assert.ok(
    result.reviewNotes.includes(
      "시작일: 연도 추정: 게시일 2026-11-27 기준 2026년"
    )
  );
  assert.ok(
    result.reviewNotes.includes(
      "연도 추정: 앞선 날짜 기준 2027년"
    )
  );
});


test("부서 근거의 연속 공백 차이는 실제 원문으로 복원", () => {
  const signature = "2026.  11. 학생지원팀";
  const raw = RAW.replace("담당 부서: 학생지원팀", signature);
  const extracted = structuredClone(EXTRACTED);

  extracted.dept.evidence = "2026. 11. 학생지원팀";

  const result = validateHcx007Draft(raw, extracted, URL_OK);

  assert.equal(result.ok, true, result.reason);
  assert.equal(result.evidence.dept, signature);
  assert.ok(raw.includes(result.evidence.dept));
});

test("부서 근거의 누락된 숫자는 공백 정규화로 승인하지 않음", () => {
  const signature = "2026.  11. 학생지원팀";
  const raw = RAW.replace("담당 부서: 학생지원팀", signature);
  const extracted = structuredClone(EXTRACTED);

  extracted.dept.evidence = "2026. 학생지원팀";

  const result = validateHcx007Draft(raw, extracted, URL_OK);

  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
});

test("원문에서 짧은 부서명만 정확하게 인용", () => {
  const raw = RAW.replace(
    "담당 부서: 학생지원팀",
    "2026.  11. 학생지원팀"
  );
  const extracted = structuredClone(EXTRACTED);

  extracted.dept.evidence = "학생지원팀";

  const result = validateHcx007Draft(raw, extracted, URL_OK);

  assert.equal(result.ok, true, result.reason);
  assert.equal(result.evidence.dept, "학생지원팀");
});

test("공백 복원으로 원문에 없는 부서를 승인하지 않음", () => {
  const raw = RAW.replace(
    "담당 부서: 학생지원팀",
    "2026.  11. 학생지원팀"
  );
  const extracted = structuredClone(EXTRACTED);

  extracted.dept.value = "교무처";
  extracted.dept.evidence = "2026. 11. 교무처";

  const result = validateHcx007Draft(raw, extracted, URL_OK);

  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
});
