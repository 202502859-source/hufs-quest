import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { validPublishedAt } from "./lib/noticeHcx007Date.mjs";

import {
  extractHcx007Draft
} from "./lib/noticeHcx007Draft.mjs";

import {
  parseArticleUrl
} from "./lib/noticeDraft.mjs";

// 내부 검증 실패만 별도로 구분합니다.
class NoticeDraftRejected extends Error {
  constructor(reason) {
    super("공지 초안 폐기: " + reason);
    this.name = "NoticeDraftRejected";
  }
}

export function formatHcx007Output(result) {
  if (!result?.ok || !result.draft) {
    throw new NoticeDraftRejected(
      result?.reason || "검증 실패"
    );
  }

  if (Object.hasOwn(result.draft, "checked")) {
    throw new Error(
      "공지 초안에 checked가 포함되어 있음"
    );
  }

  const reviewNotes = result.reviewNotes ?? [];

  const extracted = {
    title: result.draft.title.ko,
    dept: result.draft.dept.ko,
    category: result.draft.category,
    startsAt: result.draft.startsAt,
    deadline: result.draft.deadline,
    evidence: result.evidence,
    reviewNotes,
  };

  return [
    "=== 공지 추출 JSON 초안 ===",
    JSON.stringify(extracted, null, 2),
    "",
    "=== shared/deadlines.js 입력용 초안 ===",
    JSON.stringify(result.draft, null, 2),
    "",
    "=== 검수 메모 ===",
    ...(reviewNotes.length
      ? reviewNotes.map(note => "- " + note)
      : ["- 추가 검수 메모 없음"]),
    "",
    "=== 모델 사용 정보 ===",
    JSON.stringify({
      model: "HCX-007",
      elapsedMs: result.elapsedMs ?? null,
      usage: result.usage ?? null,
    }, null, 2),
    "",
    "※ 사람이 원문을 확인한 후에만 반영하세요.",
    "※ 영문 제목·부서 및 checked는 사람이 작성합니다.",
  ].join("\n");
}

export async function runNoticeHcx007(
  args,
  {
    extract = extractHcx007Draft,
    read = readFile,
  } = {}
) {
  if (
    args.length !== 2 &&
    !(args.length === 4 && args[2] === "--published-at")
  ) {
    throw new Error(
      "사용법: node --env-file=.env " +
      "scripts/extract-notice-hcx007.mjs " +
      "<공지 파일> <원문 주소> " +
      "[--published-at YYYY-MM-DD]"
    );
  }

  const [noticeFile, sourceUrl] = args;

  const publishedAt =
    args.length === 4 ? args[3] : null;

  if (
    publishedAt !== null &&
    !validPublishedAt(publishedAt)
  ) {
    throw new Error("게시일 형식 또는 날짜 오류");
  }

  const url = new URL(sourceUrl);

  if (url.username || url.password || url.port) {
    throw new Error("허용되지 않은 원문 주소");
  }

  const article = parseArticleUrl(sourceUrl);

  const raw = await read(noticeFile, "utf8");

  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("공지 원문이 비어 있습니다.");
  }

  const result = await extract(
    raw,
    article.url,
    { publishedAt }
  );

  return formatHcx007Output(result);
}

// 정해진 내부 검증 사유만 공개합니다.
export function formatNoticeError(error) {
  const allowed = [
    "공지 원문이 비어 있음",
    "게시일 형식 또는 날짜 오류",
    "허용되지 않은 원문 주소",
    "유효한 학교 공지 원문 주소가 필요함",
    "복수 차수 마감: 적용 대상 확인 필요",
    "복수 마감 문장: 원문 확인 필요",
    "시작 일시가 별도로 명시됨: 원문 확인 필요",
    "마감 날짜 또는 시각을 확정할 수 없음",
    "명시 날짜와 요일 불일치",
    "AI 마감 일시와 원문 마감 일시 불일치",
    "AI 시작 일시와 원문 시작 일시 불일치",
    "시작 일시가 마감 일시보다 빠르지 않음",
    "title: 원문 근거 확인 실패",
    "dept: 원문 근거 확인 실패",
    "공지 분류 확인 실패",
    "시작 일시 원문 검증 실패",
    "마감 일시 원문 근거 확인 실패",
    "마감 일시 최종 검증 실패",
    "시작 일시 원문 근거 확인 실패",
  ];

  if (error instanceof NoticeDraftRejected) {
    const reason = error.message.slice("공지 초안 폐기: ".length);

    if (allowed.includes(reason)) {
      return error.message;
    }

    return "공지 초안 폐기: 기타 원문 검증 실패";
  }

  if (
    error?.message ===
    "개인정보 의심 표현: 원문 정리 후 다시 실행"
  ) {
    return "공지 초안 폐기: 개인정보 의심 표현을 제거한 후 다시 실행하세요.";
  }

  if (error?.message === "게시일 형식 또는 날짜 오류") {
    return "게시일은 실제 날짜를 YYYY-MM-DD 형식으로 입력하세요.";
  }

  return "공지 초안 생성 실패. 입력 및 API 설정을 확인하세요.";
}

// 다른 파일에서 import할 때 CLI를 실행하지 않는다.
const isMain =
  process.argv[1] &&
  import.meta.url ===
    pathToFileURL(process.argv[1]).href;

if (isMain) {
  runNoticeHcx007(process.argv.slice(2))
    .then(output => console.log(output))
    .catch(error => {
      console.error(formatNoticeError(error));
      process.exitCode = 1;
    });
}
