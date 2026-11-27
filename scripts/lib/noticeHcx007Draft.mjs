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
  extractStandaloneDeadline
} from "./noticeHcx007Date.mjs";

import {
  requestNoticeHcx007
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
  sourceUrl
) {
  if (typeof raw !== "string" || !raw.trim()) {
    return reject("공지 원문이 비어 있음");
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

  if (hasMultipleRounds(raw)) {
    return reject("복수 차수 마감: 적용 대상 확인 필요");
  }

  // 날짜 파서가 일부 마감만 인식하더라도
  // 서로 다른 마감 문장이 여럿이면 보류한다.
  const deadlineLines = raw.split(/\r?\n/).filter(line =>
    /(?:마감|기한|종료)/.test(line) &&
    /(?:\d{1,2}\s*[./월-]\s*\d{1,2}|\d{1,2}:\d{2})/.test(line)
  );

  if (deadlineLines.length > 1) {
    return reject("복수 마감 문장: 원문 확인 필요");
  }

  const period = findVerifiedPeriod(raw);

  if (!period) {
    return reject("마감 날짜 또는 시각을 확정할 수 없음");
  }

  // 별도 시작 일시가 있지만 날짜 파서가
  // 시작 일시를 인식하지 못한 경우 보류한다.
  if (
    period.startsAt == null &&
    raw.split(/\r?\n/).some(line =>
      /(?:신청|접수)\s*(?:시작|개시)|시작일/.test(line) &&
      /\d{1,2}:\d{2}|\d{1,2}\s*시/.test(line)
    )
  ) {
    return reject("시작 일시가 별도로 명시됨: 원문 확인 필요");
  }

  if (extracted?.deadline?.value !== period.deadline) {
    return reject("AI 마감 일시와 원문 마감 일시 불일치");
  }

  if (
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

  // 단독 마감은 신규 날짜 검증 함수의
  // 정확한 원문 근거를 사용한다.
  const standalone = extractStandaloneDeadline(raw);

  if (
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

  if (period.startsAt !== null) {
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
    !standaloneVerified
  ) {
    return reject("마감 일시 최종 검증 실패");
  }

  const issues = result.issues.filter(issue =>
    !(
      standaloneVerified &&
      issue ===
      "deadline: 날짜 형식 또는 원문 근거 확인 필요"
    )
  );

  if (issues.length > 0) {
    return reject(issues.join(" / "));
  }

  if (
    period.startsAt &&
    !raw.includes(result.evidence.startsAt)
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
    sourceUrl
  );

  return {
    ...verified,
    elapsedMs: response.elapsedMs,
    usage: response.usage,
  };
}
