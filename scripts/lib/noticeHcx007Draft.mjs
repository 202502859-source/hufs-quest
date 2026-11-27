import {
  attachNoticeEvidence
} from "./noticeEvidence.mjs";

import {
  validateNotice
} from "./noticeExtract.mjs";

import {
  extractApplicationPeriod,
  extractCourseRegistrationPeriod
} from "./noticeDate.mjs";

import {
  hasMultipleRounds,
  extractStandaloneDeadline,
  extractReviewableDeadline,
  validPublishedAt,
  hasInvalidExplicitWeekday
} from "./noticeHcx007Date.mjs";

import {
  requestNoticeHcx007,
  hasPrivateNoticeInfo
} from "./noticeHcx007.mjs";

import {
  parseArticleUrl
} from "./noticeDraft.mjs";

function reject(reason) {
  return {
    ok: false,
    reason,
    draft: null,
    evidence: null,
  };
}

function findVerifiedPeriod(raw) {
  if (hasMultipleRounds(raw)) {
    return null;
  }

  const application = extractApplicationPeriod(raw);
  const course = extractCourseRegistrationPeriod(raw);
  const standalone = extractStandaloneDeadline(raw);

  const candidates = [
    application,
    course,
    standalone
  ].filter(period => period?.deadline);

  if (candidates.length === 0) {
    return null;
  }

  const first = candidates[0];

  const conflicts = candidates.some(period =>
    period.startsAt !== first.startsAt ||
    period.deadline !== first.deadline
  );

  if (conflicts) {
    return null;
  }

  return first;
}

export function validateHcx007Draft(
  raw,
  extracted,
  sourceUrl,
  { publishedAt = null } = {}
) {
  if (typeof raw !== "string" || !raw.trim()) {
    return reject("공지 원문이 비어 있음");
  }

  if (hasPrivateNoticeInfo(raw)) {
    return reject("개인정보 의심 표현: 원문 정리 후 다시 실행");
  }

  if (publishedAt !== null && !validPublishedAt(publishedAt)) {
    return reject("게시일 형식 또는 날짜 오류");
  }

  let article;

  try {
    article = parseArticleUrl(sourceUrl);

    const url = new URL(sourceUrl);

    if (url.username || url.password || url.port) {
      return reject("허용되지 않은 원문 주소");
    }
  } catch {
    return reject("유효한 학교 공지 원문 주소가 필요함");
  }

  // 기존 날짜 파서로 우회하기 전에
  // 명시된 연도와 요일의 일치 여부를 확인한다.
  if (hasInvalidExplicitWeekday(raw)) {
    return reject("명시 날짜와 요일 불일치");
  }

  const reviewable = extractReviewableDeadline(
    raw, publishedAt
  );

  const strictPeriod = findVerifiedPeriod(raw);

  // 종헌 요청: 시각·연도 보완과 복수 차수는
  // 원문 기반 검수용 초안으로 처리한다.
  const reviewMode = Boolean(
    reviewable &&
    (
      reviewable.reviewNotes.length > 0 ||
      !strictPeriod
    )
  );

  if (hasMultipleRounds(raw) && !reviewMode) {
    return reject("복수 차수 마감: 적용 대상 확인 필요");
  }

  // 날짜 파서가 일부 마감만 인식하더라도
  // 서로 다른 마감 문장이 여럿이면 보류한다.
  const deadlineLines = raw.split(/\r?\n/).filter(line =>
    /(?:마감|기한|종료)/.test(line) &&
    /(?:\d{1,2}\s*[./월-]\s*\d{1,2}|\d{1,2}:\d{2})/.test(line)
  );

  if (deadlineLines.length > 1 && !reviewMode) {
    return reject("복수 마감 문장: 원문 확인 필요");
  }

  const period = reviewMode
    ? reviewable
    : strictPeriod;

  // 신규 날짜 함수가 해석할 수 없는 별도 마감이
  // 존재하면 기존 단독 마감 파서로 우회하지 않는다.
  const explicitDeadlineLines = raw.split(/\r?\n/).filter(line =>
    /^(?:[•*-]\s*)?(?:\d+\s*차\s*)?(?:(?:신청|접수|제출|서류\s*제출)\s*)?(?:마감(?:일시|일)?|기한|종료)\s*[:：]/.test(line.trim())
  );

  if (explicitDeadlineLines.length > 1 && !reviewable) {
    return reject("복수 마감 문장: 원문 확인 필요");
  }

  if (!period) {
    return reject("마감 날짜 또는 시각을 확정할 수 없음");
  }

  // 별도 시작 일시가 있지만 날짜 파서가
  // 시작 일시를 인식하지 못한 경우 보류한다.
  if (
    period.startsAt == null &&
    raw.split(/\r?\n/).some(line =>
      /(?:신청|접수)\s*(?:시작|개시)|시작일/.test(line) &&
      /\d{1,2}:\d{2}|\d{1,2}\s*시|\d{1,2}\s*[./월-]\s*\d{1,2}/.test(line)
    )
  ) {
    return reject("시작 일시가 별도로 명시됨: 원문 확인 필요");
  }

  if (!reviewMode && extracted?.deadline?.value !== period.deadline) {
    return reject("AI 마감 일시와 원문 마감 일시 불일치");
  }

  if (
    !reviewMode &&
    (extracted?.startsAt?.value ?? null) !==
    (period.startsAt ?? null)
  ) {
    return reject("AI 시작 일시와 원문 시작 일시 불일치");
  }

  if (
    period.startsAt &&
    period.startsAt >= period.deadline
  ) {
    return reject("시작 일시가 마감 일시보다 빠르지 않음");
  }

  const attached = attachNoticeEvidence(
    raw,
    extracted
  );

  // 보완 날짜는 AI의 추정값을 사용하지 않는다.
  // 독립적인 원문 파서 결과로만 확정한다.
  if (reviewMode) {
    if (
      !period.evidence ||
      !raw.includes(period.evidence)
    ) {
      return reject("마감 일시 원문 근거 확인 실패");
    }

    attached.deadline = {
      value: period.deadline,
      evidence: period.evidence,
    };

    attached.startsAt = {
      value: period.startsAt ?? null,
      evidence: period.startsAt
        ? period.evidence
        : null,
    };
  }

  // 단독 마감은 신규 날짜 검증 함수의
  // 정확한 원문 근거를 사용한다.
  const standalone = extractStandaloneDeadline(raw);

  if (
    !reviewMode &&
    standalone &&
    standalone.deadline === period.deadline &&
    period.startsAt === null
  ) {
    attached.deadline.evidence = standalone.evidence;
  }

  const result = validateNotice(raw, attached);

  // 제목과 부서는 값 자체도 원문 근거에
  // 포함되어 있어야 한다.
  for (const field of ["title", "dept"]) {
    if (
      typeof result[field] !== "string" ||
      result[field] === "확인 필요" ||
      !result.evidence[field]?.includes(result[field])
    ) {
      return reject(`${field}: 원문 근거 확인 실패`);
    }
  }

  const categories = [
    "academic",
    "scholarship",
    "campus",
    "external",
  ];

  if (!categories.includes(result.category)) {
    return reject("공지 분류 확인 실패");
  }

  if (period.startsAt !== null && !reviewMode) {
    if (result.startsAt !== period.startsAt) {
      return reject("시작 일시 원문 검증 실패");
    }
  }

  const deadlineEvidence = attached.deadline?.evidence;

  if (
    typeof deadlineEvidence !== "string" ||
    !deadlineEvidence.trim() ||
    !raw.includes(deadlineEvidence)
  ) {
    return reject("마감 일시 원문 근거 확인 실패");
  }

  // 기존 검증기는 단독 날짜를 시작일로
  // 해석할 수 있어 신규 검증으로 보완한다.
  const standaloneVerified =
    standalone?.deadline === period.deadline &&
    standalone?.evidence === deadlineEvidence &&
    result.issues.every(issue =>
      issue ===
      "deadline: 날짜 형식 또는 원문 근거 확인 필요"
    );

  if (
    result.deadline !== period.deadline &&
    !standaloneVerified &&
    !reviewMode
  ) {
    return reject("마감 일시 최종 검증 실패");
  }

  const issues = result.issues.filter(issue => {
    if (
      (standaloneVerified || reviewMode) &&
      issue ===
      "deadline: 날짜 형식 또는 원문 근거 확인 필요"
    ) {
      return false;
    }

    if (
      reviewMode &&
      period.startsAt &&
      issue ===
      "startsAt: 날짜 형식 또는 원문 근거 확인 필요"
    ) {
      return false;
    }

    return true;
  });

  if (issues.length > 0) {
    return reject(issues.join(" / "));
  }

  if (
    period.startsAt &&
    (
      !result.evidence.startsAt ||
      !raw.includes(result.evidence.startsAt)
    )
  ) {
    return reject("시작 일시 원문 근거 확인 실패");
  }

  const draft = {
    id: `notice-${article.postId}`,
    title: {
      ko: result.title,
      en: "",
    },
    dept: {
      ko: result.dept,
      en: "",
    },
    category: result.category,
    startsAt: period.startsAt ?? null,
    deadline: period.deadline,
    url: article.url,
  };

  const evidence = {
    id: article.postId,
    title: result.evidence.title,
    dept: result.evidence.dept,
    category: result.evidence.category,
    startsAt: period.startsAt
      ? result.evidence.startsAt
      : null,
    deadline: deadlineEvidence,
    url: article.url,
  };

  return {
    ok: true,
    reason: null,
    draft,
    evidence,
    reviewNotes: reviewMode
      ? [...period.reviewNotes]
      : [],
  };
}

export async function extractHcx007Draft(
  raw,
  sourceUrl,
  options = {}
) {
  const response = await requestNoticeHcx007(
    raw,
    options
  );

  const verified = validateHcx007Draft(
    raw,
    response.extracted,
    sourceUrl,
    { publishedAt: options.publishedAt ?? null }
  );

  return {
    ...verified,
    elapsedMs: response.elapsedMs,
    usage: response.usage,
  };
}
