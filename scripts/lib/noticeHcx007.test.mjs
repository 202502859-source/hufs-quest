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

for (const [name, raw, expected] of dateCases.slice(1, 4)) {
  test("초안 폐기: " + name, () => {
    const result = validateHcx007Draft(
      HEADER + "\n" + raw,
      EXTRACTED,
      URL_OK
    );

    assert.equal(expected, null);
    assert.equal(result.ok, false);
    assert.equal(result.draft, null);
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
