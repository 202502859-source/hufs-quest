import {
  extractNoticePeriod,
  extractCourseRegistrationPeriod,
  extractApplicationPeriod,
} from "./noticeDate.mjs";
const DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\+09:00$/;

const START_WORDS = /시작|개시|접수\s*시작|신청\s*시작/;
const END_WORDS = /마감|종료|접수\s*마감|신청\s*마감/;

function findDateEvidence(raw, value, field) {
  const applicationPeriod = extractApplicationPeriod(raw);

  if (applicationPeriod && applicationPeriod[field] === value) {
    return applicationPeriod.evidence;
  }
  const coursePeriod = extractCourseRegistrationPeriod(raw);

  if (coursePeriod && coursePeriod[field] === value) {
    const lines = raw.split(/\r?\n/).map(line => line.trim());
    const index = lines.findIndex(line =>
      /^(?:[•*]\s*)?수강신청$/.test(line)
    );

    if (index !== -1) {
      const evidence = lines
        .slice(index + 1, index + 12)
        .find(line =>
          /매일\s*\d{1,2}:\d{2}\s*[~∼～]\s*\d{1,2}:\d{2}/.test(line)
        );

      if (evidence) return evidence;
    }
  }

  // 점·요일·물결표가 포함된 학교 공지 날짜 지원
  const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  const periodMatches = lines.filter(line => {
  // 시작과 마감이 각각 명시된 혼합 문장은 기존 안전장치 유지
  if (START_WORDS.test(line) && END_WORDS.test(line)) {
    return false;
  }

  const period = extractNoticePeriod(line);
  if (!period) return false;

  return field === "startsAt"
    ? period.startsAt === value
    : period.deadline === value;
});

  if (periodMatches.length === 1) {
    return periodMatches[0];
  }

  if (periodMatches.length > 1) {
    return null;
  }
  const match = DATE_RE.exec(value);
  if (!match) return null;

  const [, y, mo, d, h, mi] = match;

  const datePattern = new RegExp(
    `${y}\\s*년\\s*0*${Number(mo)}\\s*월\\s*0*${Number(d)}\\s*일\\s*0*${Number(h)}\\s*:\\s*0*${Number(mi)}`
  );

    const matches = lines.filter(line => {    if (!datePattern.test(line)) return false;

    if (field === "startsAt") {
      return START_WORDS.test(line) && !END_WORDS.test(line);
    }

    return END_WORDS.test(line) && !START_WORDS.test(line);
  });

  return matches.length === 1 ? matches[0] : null;
}

function findTextEvidence(raw, value, field) {
  const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  const matches = lines.filter(line => line.includes(value));

if (field === "title") {
  return lines.find(line => line === value) ?? null;
}

  if (field === "dept") {
    const departments = matches.filter(
      line => /담당\s*부서|주관\s*부서|담당\s*기관|^작성자\s+/.test(line)
    );

    if (departments.length === 1) {
      return departments[0];
    }

    if (departments.length > 1) {
      return null;
    }

    const isDepartment =
      /^[가-힣A-Za-z0-9&·()\s-]{3,40}$/.test(value) &&
      /센터|지원단|사업단|운영단|팀|처|본부|사무국$/.test(value) &&
      /(?:센터|지원단|사업단|운영단|팀|처|본부|사무국)$/.test(value);

    if (!isDepartment) return null;

    const organizers = matches.filter(line =>
      line.startsWith(`한국외국어대학교 ${value}에서는`) ||
      line.startsWith(`한국외국어대학교 ${value}에서`) ||
      line.startsWith(`${value}에서는`) ||
      line.startsWith(`${value}에서`)
    );

    return organizers.length === 1 ? organizers[0] : null;
  }
  return null;
}

export function attachNoticeEvidence(raw, extracted) {
  const result = structuredClone(extracted);

  for (const field of [
    "title", "dept", "category", "startsAt", "deadline"
  ]) {
    const entry = result?.[field];

    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.value !== "string") continue;

    if (
      typeof entry.evidence === "string" && entry.evidence.length > 0 &&
      raw.includes(entry.evidence)
    ) continue;

    let evidence = null;

    if (field === "startsAt" || field === "deadline") {
      evidence = findDateEvidence(raw, entry.value, field);
    } else if (field === "category") {
      const titleLine = raw.split(/\r?\n/)
        .map(line => line.trim())
        .find(line =>
          /^(?:\[(?:공통|서울|글로벌)\]\s*)?.*(?:수강신청|이중전공|전공신청|학적변동|졸업신청|학과[·・\s]*세부전공\s*신청)/.test(line)
        );

      if (entry.value === "academic" && titleLine) {
        entry.evidence = titleLine;
        continue;
      }
           const firstLine = raw.split(/\r?\n/)
        .map(line => line.trim())
        .find(Boolean);

      if (
        entry.value === "scholarship" &&
        firstLine &&
        result.title?.value === firstLine &&
        /장학금|장학생/.test(firstLine)
      ) {
        entry.evidence = firstLine;
        continue;
      }

      const categoryWords = {
        academic: /학사|수강|등록|졸업/,
        scholarship: /장학금|장학생/,
        campus: /교내|캠퍼스|학생\s*행사/,
        external: /대외|외부|공모전/,
      };

      const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const pattern = categoryWords[entry.value];

      const matches = pattern
        ? lines.filter(line => pattern.test(line))
        : [];

      const explicit = matches.filter(
        line => /^(?:분류|구분|카테고리)\s*[:：]/.test(line)
      );

      if (explicit.length === 1) {
        evidence = explicit[0];
      } else if (explicit.length === 0 && matches.length === 1) {
        evidence = matches[0];
      } else {
        evidence = null;
      }
    } else {
      evidence = findTextEvidence(raw, entry.value, field);
    }

    entry.evidence = evidence;
  }

  return result;
}
