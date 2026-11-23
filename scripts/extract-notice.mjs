import { readFile } from "node:fs/promises";
import { validateNotice } from "./lib/noticeExtract.mjs";
import { attachNoticeEvidence } from "./lib/noticeEvidence.mjs";

const CHAT_URL =
  "https://clovastudio.stream.ntruss.com/v3/chat-completions/HCX-005";

const NOTICE_PATH = ".local/notice.txt";

async function main() {
  if (!process.env.CLOVA_API_KEY) {
    throw new Error("CLOVA_API_KEY가 설정되지 않았습니다.");
  }

  const raw = await readFile(NOTICE_PATH, "utf8");

  if (!raw.trim()) {
    throw new Error("공지 원문이 비어 있습니다.");
  }

  const messages = [
    {
      role: "system",
      content: `너는 한국외국어대학교 공지사항 정보 추출기다.

공지 원문에 명시된 정보만 추출한다.
추측하거나 없는 날짜와 시간을 만들어서는 안 된다.

반드시 JSON 객체 하나만 출력한다.

필드:
title, dept, category, startsAt, deadline

중요: 모든 필드는 반드시 value와 evidence를 가진 객체여야 한다.
title, dept, category, startsAt, deadline 중 어떤 필드도 문자열로 직접 출력하지 마라.

반드시 아래 JSON 구조를 그대로 따라라.

{
  "title": {
    "value": "공지 제목",
    "evidence": "원문에 있는 제목 그대로"
  },
  "dept": {
    "value": "담당 부서",
    "evidence": "원문에 있는 담당 부서 표현 그대로"
  },
  "category": {
    "value": "academic 또는 scholarship 또는 campus 또는 external",
    "evidence": "분류 판단에 사용한 원문 표현 그대로"
  },
  "startsAt": {
    "value": "YYYY-MM-DDTHH:mm:ss+09:00",
    "evidence": "시작 날짜와 시간이 함께 명시된 원문 표현 그대로"
  },
  "deadline": {
    "value": "YYYY-MM-DDTHH:mm:ss+09:00",
    "evidence": "마감 날짜와 시간이 함께 명시된 원문 표현 그대로"
  }
}

값이나 근거가 없으면 해당 필드의 value와 evidence를 모두 null로 설정한다.
절대로 필드를 문자열 하나로 반환하지 마라.
JSON 외에 설명이나 마크다운을 출력하지 마라.

category는 academic, scholarship, campus, external 중 하나다.
날짜는 YYYY-MM-DDTHH:mm:ss+09:00 형식이다.
날짜 또는 시간이 명시되지 않았다면 해당 날짜 필드는 null이다.
개인 이름, 전화번호, 이메일은 추출하지 않는다.
각 evidence는 원문에 실제로 존재하는 문자열이어야 한다.

[근거 추출 절대 규칙]
evidence는 설명문이 아니라 원문에서 복사한 정확한 문자열이다.
원문에 없는 단어를 하나라도 추가하면 안 된다.
따옴표, 조사, 해석, 부연 설명을 추가하지 마라.

잘못된 예:
"value": "학생지원팀",
"evidence": "담당 부서로 학생지원팀이라고 명시되어 있음"

올바른 예:
"value": "학생지원팀",
"evidence": "담당 부서: 학생지원팀"

잘못된 예:
"value": "2026-11-27T17:00:00+09:00",
"evidence": "신청 마감 날짜 및 시간에서 확인 가능함"

올바른 예:
"value": "2026-11-27T17:00:00+09:00",
"evidence": "신청 마감: 2026년 11월 27일 17:00"

원문에서 evidence 부분을 그대로 복사할 수 없다면
해당 필드의 value와 evidence를 모두 null로 반환하라.`,
    },
    {
      role: "user",
      content: raw,
    },
  ];

  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CLOVA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      maxTokens: 1200,
      temperature: 0,
      topP: 0.8,
      repetitionPenalty: 1.1,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`HCX API 요청 실패: HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data?.result?.message?.content;

  if (typeof content !== "string") {
    throw new Error("AI 응답에서 텍스트를 찾지 못했습니다.");
  }

  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  const extracted = JSON.parse(cleaned);

  const withEvidence = attachNoticeEvidence(raw, extracted);
  const result = validateNotice(raw, withEvidence);

  console.log("\n=== 공지 추출 JSON 초안 ===");
  console.log(JSON.stringify(result, null, 2));

  console.log("\n=== 원문 근거 검토표 ===");

  for (const [field, quote] of Object.entries(result.evidence)) {
    console.log(`${field}: ${quote || "확인 필요"}`);
  }

  console.log("\n※ 사람이 확인한 후에만 공지 데이터에 반영하세요.");
}

main().catch((error) => {
  console.error("공지 추출 실패:", error.message);
  process.exitCode = 1;
});
