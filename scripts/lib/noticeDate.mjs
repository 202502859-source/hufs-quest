
const DATE_RE = /(\d{4})\s*(?:년|[./-])\s*(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*(?:일)?\.?\s*(?:\([월화수목금토일]\))?\s*(\d{1,2}):(\d{2})/g;

const SHORT_DATE_RE = /(\d{1,2})\s*[./-]\s*(\d{1,2})\.?\s*(?:\([월화수목금토일]\))?\s*(\d{1,2}):(\d{2})/g;

function toISO(year, month, day, hour, minute) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`;
}

export function extractNoticePeriod(text) {
  const fullDates = [...text.matchAll(DATE_RE)];

  if (!fullDates.length) return null;

  const first = fullDates[0];

  const startsAt = toISO(
    Number(first[1]),
    Number(first[2]),
    Number(first[3]),
    Number(first[4]),
    Number(first[5])
  );

  if (!startsAt) return null;

  const remaining = text.slice(first.index + first[0].length);

  if (!/^\s*(?:~|∼|～|부터|[-–])/.test(remaining)) {
    return { startsAt, deadline: null };
  }

  const nextFull = [...remaining.matchAll(DATE_RE)][0];

  if (nextFull) {
    return {
      startsAt,
      deadline: toISO(
        Number(nextFull[1]),
        Number(nextFull[2]),
        Number(nextFull[3]),
        Number(nextFull[4]),
        Number(nextFull[5])
      )
    };
  }

  const nextShort = [...remaining.matchAll(SHORT_DATE_RE)][0];

  if (!nextShort) {
    return { startsAt, deadline: null };
  }

  const deadline = toISO(
    Number(first[1]),
    Number(nextShort[1]),
    Number(nextShort[2]),
    Number(nextShort[3]),
    Number(nextShort[4])
  );

  if (deadline && deadline < startsAt) {
    return { startsAt, deadline: null };
  }

  return { startsAt, deadline };
}

export function extractCourseRegistrationPeriod(raw) {
  const lines = raw.split(/\r?\n/).map(line => line.trim());

  const index = lines.findIndex(line =>
    /^(?:[•*]\s*)?수강신청$/.test(line)
  );

  if (index === -1) return null;

  const title = lines.find(line =>
    /수강신청/.test(line) && /\d{4}/.test(line)
  );

  const titleYear = title?.match(/(?:19|20)\d{2}/);
  const year = titleYear ? Number(titleYear[0]) : null;

  const schedule = lines.slice(index + 1, index + 12).join(" ");

  const datePart =
    String.raw`(?:(\d{4})\s*[./-]\s*)?(\d{1,2})\s*[./-]\s*(\d{1,2})\.?\s*(?:\([월화수목금토일]\))?`;

  const range = new RegExp(
    datePart + String.raw`\s*[~∼～]\s*` + datePart
  );

  const timedRange = new RegExp(
    datePart +
    String.raw`\s+(\d{1,2}):(\d{2})\s*[~∼～]\s*` +
    datePart +
    String.raw`\s+(\d{1,2}):(\d{2})`
  );

  const timedMatch = schedule.match(timedRange);

  if (timedMatch) {
    const [, sy, sm, sd, sh, smin, ey, em, ed, eh, emin] = timedMatch;

    const startYear = sy ? Number(sy) : year;
    const endYear = ey ? Number(ey) : startYear;

    if (!startYear || !endYear) return null;

    const startsAt = toISO(startYear, +sm, +sd, +sh, +smin);
    const deadline = toISO(endYear, +em, +ed, +eh, +emin);

    if (!startsAt || !deadline || deadline < startsAt) return null;

    return { startsAt, deadline };
  }

  const match = schedule.match(range);
  if (!match) return null;

  const [, sy, sm, sd, ey, em, ed] = match;

  const startYear = sy ? Number(sy) : year;
  const endYear = ey ? Number(ey) : startYear;

  if (!startYear || !endYear) return null;

  const afterRange = schedule.slice(match.index + match[0].length);

  const daily = afterRange.match(
    /\(\s*매일\s*(\d{1,2}):(\d{2})\s*[~∼～]\s*(\d{1,2}):(\d{2})\s*\)/
  );

  let sh, smin, eh, emin;

  if (daily) {
    [, sh, smin, eh, emin] = daily;
  } else {
    const firstTime = schedule.slice(0, match.index).match(
      /(\d{1,2}):(\d{2})\s*$/
    );

    const secondTime = afterRange.match(
      /^\s*(\d{1,2}):(\d{2})/
    );

    if (!firstTime || !secondTime) return null;

    [, sh, smin] = firstTime;
    [, eh, emin] = secondTime;
  }

  const startsAt = toISO(startYear, +sm, +sd, +sh, +smin);
  const deadline = toISO(endYear, +em, +ed, +eh, +emin);

  if (!startsAt || !deadline || deadline < startsAt) return null;

  return { startsAt, deadline };
}
export function extractApplicationPeriod(raw) {
  const lines = raw.split(/\r?\n/).map(line => line.trim());

  const applicationLines = lines.filter(line =>
    /^\s*(?:\d+[.)]\s*)?(?:신청|접수)\s*기간\s*[:：]/.test(line)
  );

  if (applicationLines.length !== 1) return null;

  const evidence = applicationLines[0];
  const koreanTimeRange = evidence.match(
    /[:：]\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*\(([월화수목금토일])\)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?\s*[~∼～]\s*(?:(\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일\s*\(([월화수목금토일])\)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?\s*(?:까지)?\s*$/
  );

  if (koreanTimeRange) {
    const [
      , sy, sm, sd, sw, sh, smin,
      ey, em, ed, ew, eh, emin
    ] = koreanTimeRange;

    const startYear = Number(sy);
    const endYear = ey ? Number(ey) : startYear;

    const startsAt = toISO(
      startYear, +sm, +sd, +sh, Number(smin ?? 0)
    );

    const deadline = toISO(
      endYear, +em, +ed, +eh, Number(emin ?? 0)
    );

    if (!startsAt || !deadline || deadline < startsAt) {
      return null;
    }

    const weekdays = "일월화수목금토";

    if (
      weekdays[new Date(Date.UTC(startYear, +sm - 1, +sd)).getUTCDay()] !== sw ||
      weekdays[new Date(Date.UTC(endYear, +em - 1, +ed)).getUTCDay()] !== ew
    ) {
      return null;
    }

    return { startsAt, deadline, evidence };
  }

  const explicit = extractNoticePeriod(evidence);
  if (
    explicit?.startsAt &&
    explicit?.deadline &&
    explicit.startsAt <= explicit.deadline
  ) {
    return { ...explicit, evidence };
  }
  const deadlineOnly = evidence.match(
    /[:：]\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*\(([월화수목금토일])\)\s*[~∼～]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*\(([월화수목금토일])\)\s*(\d{1,2}):(\d{2})(?:까지)?\s*$/
  );

  if (deadlineOnly) {
    const [, y, sm, sd, sw, em, ed, ew, eh, emin] =
      deadlineOnly;

    const year = Number(y);
    const weekdays = "일월화수목금토";

    const startDate = toISO(year, +sm, +sd, 0, 0);
    const deadline = toISO(year, +em, +ed, +eh, +emin);

    if (!startDate || !deadline || deadline < startDate) {
      return null;
    }

    if (
      weekdays[new Date(Date.UTC(year, +sm - 1, +sd)).getUTCDay()] !== sw ||
      weekdays[new Date(Date.UTC(year, +em - 1, +ed)).getUTCDay()] !== ew
    ) {
      return null;
    }

    return { startsAt: null, deadline, evidence };
  }

  const metadata = lines.filter(line =>
    /^작성자\s+/.test(line)
  );

  if (metadata.length !== 1) return null;

  const registered = metadata[0].match(
    /등록일\s+(\d{4})\.\s*\d{1,2}\.\s*\d{1,2}/
  );

  const title = lines.find(Boolean);
  const titleYear = title?.match(/(\d{4})학년도/);

  if (!registered || !titleYear) return null;
  if (registered[1] !== titleYear[1]) return null;

  const year = Number(registered[1]);

  const match = evidence.match(
    /[:：]\s*(\d{1,2})월\s*(\d{1,2})일\s*\(([월화수목금토일])\)\s*(\d{1,2}):(\d{2})\s*[~∼～]\s*(\d{1,2})월\s*(\d{1,2})일\s*\(([월화수목금토일])\)\s*(\d{1,2}):(\d{2})(?:까지)?\s*$/
  );

  if (!match) return null;

  const [, sm, sd, sw, sh, smin,
    em, ed, ew, eh, emin] = match;

  if (+sm <= 2 || +em <= 2) return null;

  const weekdays = "일월화수목금토";

  if (
    weekdays[new Date(Date.UTC(year, +sm - 1, +sd)).getUTCDay()] !== sw ||
    weekdays[new Date(Date.UTC(year, +em - 1, +ed)).getUTCDay()] !== ew
  ) return null;

  const startsAt = toISO(year, +sm, +sd, +sh, +smin);
  const deadline = toISO(year, +em, +ed, +eh, +emin);

  if (!startsAt || !deadline || deadline < startsAt) return null;

  return { startsAt, deadline, evidence };
}
