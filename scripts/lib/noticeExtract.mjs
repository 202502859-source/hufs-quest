import {
  extractNoticePeriod,
  extractCourseRegistrationPeriod,
  extractApplicationPeriod,
} from "./noticeDate.mjs";
export const CATEGORIES = [
  "academic",
  "scholarship",
  "campus",
  "external",
];

export const FIELDS = [
  "title",
  "dept",
  "category",
  "startsAt",
  "deadline",
];

const NEEDS_REVIEW = "확인 필요";

const DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\+09:00$/;

const PRIVATE_INFO =
  /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:01[016789])[-.\s]?\d{3,4}[-.\s]?\d{4}|\b\d{2,3}-\d{3,4}-\d{4}\b)/i;

function validDate(value) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day, hour, minute, second] =
    match.map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59
  );
}


function dateSupported(value, evidence, field, raw) {
  const applicationPeriod = extractApplicationPeriod(raw);
  if (
    applicationPeriod &&
    applicationPeriod[field] === value &&
    applicationPeriod.evidence === evidence
  ) {
    return true;
  }

  const coursePeriod = extractCourseRegistrationPeriod(raw);

  if (coursePeriod && raw.includes(evidence)) {
    const lines = raw.split(/\r?\n/).map(line => line.trim());
    const index = lines.findIndex(line =>
      /^(?:[•*]\s*)?수강신청$/.test(line)
    );

    if (index !== -1) {
      const schedule = lines
        .slice(index + 1, index + 12)
        .find(line =>
          /매일\s*\d{1,2}:\d{2}\s*[~∼～]\s*\d{1,2}:\d{2}/.test(line)
        );

      if (
        schedule === evidence &&
        coursePeriod[field] === value
      ) {
        return true;
      }
    }
  }

  const period = extractNoticePeriod(evidence);

  if (period) {
    const expected = field === "startsAt"
      ? period.startsAt
      : period.deadline;

    if (expected === value) return true;
  }

  // 기존 날짜 형식도 지원
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day, hour, minute] = match;

  const y = String(Number(year));
  const m = String(Number(month));
  const d = String(Number(day));
  const h = String(Number(hour));
  const min = String(Number(minute));

  const escaped = (n) => `0*${n}`;

  const dateTimePattern = new RegExp(
    `${y}\\s*(?:년|[-./])\\s*${escaped(m)}\\s*(?:월|[-./])\\s*${escaped(d)}\\s*(?:일)?\\s*(?:오전\\s*|오후\\s*)?${escaped(h)}\\s*:\\s*${escaped(min)}(?:\\s*분)?`
  );

  return dateTimePattern.test(evidence);
}


export function validateNotice(raw, extracted) {
  const result = {};
  const evidence = {};
  const issues = [];

  for (const field of FIELDS) {
    const entry = extracted?.[field];
    const value = entry?.value;
    const quote = entry?.evidence;

    if (
      (field === "startsAt" || field === "deadline") &&
      value === null &&
      (quote === null || quote === "")
    ) {
      const dateLines = raw.split(/\r?\n/);

      const labelPattern = field === "startsAt"
        ? /신청\s*시작|접수\s*시작|시작일/
        : /신청\s*마감|접수\s*마감|마감일/;

      const hasExplicitDateTime = dateLines.some(line =>
        labelPattern.test(line) &&
        /\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/.test(line) &&
        /\d{1,2}:\d{2}/.test(line)
      );

      const periodPattern =
        /신청\s*기간\s*[:：]\s*\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일\s*\d{1,2}:\d{2}\s*부터\s*\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일\s*\d{1,2}:\d{2}\s*까지/;

      const hasExplicitPeriod = dateLines.some(line =>
        periodPattern.test(line)
      );

      const hasApplicationSchedule = dateLines.some((line, index) => {
        const label = line.trim();
        if (!/^(?:[•*\-]\s*)?수강신청$/.test(label)) return false;

        const following = dateLines
          .slice(index + 1, index + 5)
          .join(" ");

        return /\d{1,2}\s*\.\s*\d{1,2}\s*\./.test(following) &&
          /매일\s*\d{1,2}:\d{2}\s*[~∼～]\s*\d{1,2}:\d{2}/.test(following);
      });

      if (hasExplicitDateTime || hasExplicitPeriod || hasApplicationSchedule) {
        result[field] = NEEDS_REVIEW;
        issues.push(`${field}: 원문에 날짜와 시간이 있지만 AI가 누락함`);
      } else {
        result[field] = null;
      }

      evidence[field] = "";
      continue;
    }

    if (
      typeof value !== "string" ||
      !value.trim() ||
      typeof quote !== "string" ||
      !quote.trim()
    ) {
      result[field] = NEEDS_REVIEW;
      evidence[field] = "";
      issues.push(`${field}: 값 또는 근거 누락`);
      continue;
    }

    if (!raw.includes(quote)) {
      result[field] = NEEDS_REVIEW;
      evidence[field] = "";
      issues.push(`${field}: 원문 근거 불일치`);
      continue;
    }

    const personName =
      /(?:담당자|작성자|문의자|담당교수)\s*[:：]?\s*[가-힣]{2,4}/;

    const departmentName =
      /^(?=.{3,40}$)[가-힣A-Za-z0-9&·.()\s-]+(?:센터|팀|처|부|실|과|본부|사무국)$/;

    const isDepartmentMetadata =
      field === "dept" &&
      departmentName.test(value) &&
      raw.split(/\r?\n/).some(line => {
        const trimmed = line.trim();
        const prefixes = [
          `작성자 ${value}`,
          `작성자: ${value}`,
          `작성자： ${value}`,
        ];

        return prefixes.some(prefix =>
          trimmed === prefix ||
          trimmed.startsWith(`${prefix} 조회수 `) ||
          trimmed.startsWith(`${prefix} 등록일 `)
        );
      });

    if (
      PRIVATE_INFO.test(value) ||
      PRIVATE_INFO.test(quote) ||
      personName.test(value) ||
      (field === "dept" && personName.test(quote) && !isDepartmentMetadata)
    ) {
      result[field] = NEEDS_REVIEW;
      evidence[field] = "";
      issues.push(`${field}: 개인정보 가능성`);
      continue;
    }

    if (field === "category" && !CATEGORIES.includes(value)) {
      result[field] = NEEDS_REVIEW;
      evidence[field] = quote;
      issues.push(`${field}: 허용되지 않은 분류`);
      continue;
    }

    if (
      (field === "startsAt" || field === "deadline") &&
      (!validDate(value) || !dateSupported(value, quote, field, raw))    ) {
      result[field] = NEEDS_REVIEW;
      evidence[field] = quote;
      issues.push(`${field}: 날짜 형식 또는 원문 근거 확인 필요`);
      continue;
    }

    result[field] = value;
    evidence[field] = quote;
  }

  return {
    ...result,
    evidence,
    checked: { on: "", by: "" },
    issues,
  };
}
