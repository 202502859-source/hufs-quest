const FULL_DATE_TIME =
  /(\d{4})\s*(?:년|[./-])\s*(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*(?:일)?\.?\s*(?:\(([월화수목금토일])\))?\s*(\d{1,2}):(\d{2})/g;

const END_LABEL =
  /마감|종료|기한/;

const START_LABEL =
  /시작|개시/;

const ROUND_LABEL =
  /(?:\d+\s*차|[①②③④⑤])\s*(?:신청\s*|접수\s*)?(?:마감|종료|기한|신청\s*기간|접수\s*기간)/g;

function toISO(year, month, day, weekday, hour, minute) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  if (
    weekday &&
    "일월화수목금토"[date.getUTCDay()] !== weekday
  ) {
    return null;
  }

  const pad = number =>
    String(number).padStart(2, "0");

  return (
    `${year}-${pad(month)}-${pad(day)}` +
    `T${pad(hour)}:${pad(minute)}:00+09:00`
  );
}

export function hasMultipleRounds(raw) {
  const rounds = [
    ...raw.matchAll(ROUND_LABEL)
  ].map(match => match[0].match(/^\d+|^[①②③④⑤]/)?.[0]);

  return new Set(rounds.filter(Boolean)).size > 1;
}

// 명확한 단독 마감 문장만 지원한다.
// 기간이나 복수 날짜는 기존 기간 검증에서 별도로 처리한다.
export function extractStandaloneDeadline(raw) {
  if (typeof raw !== "string") {
    return null;
  }

  if (hasMultipleRounds(raw)) {
    return null;
  }

  const candidates = [];

  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim();

    if (!text) continue;

    const dates = [...text.matchAll(FULL_DATE_TIME)];

    if (dates.length !== 1) continue;

    const match = dates[0];

    const before = text.slice(0, match.index);
    const after = text.slice(
      match.index + match[0].length
    );

    const deadlineLabel = END_LABEL.test(before);
    const deadlineSuffix = /^\s*까지\s*[.!]?$/.test(after);

    if (!deadlineLabel && !deadlineSuffix) {
      continue;
    }

    // 시작일 또는 신청 기간의 일부를
    // 단독 마감일로 잘못 인식하지 않는다.
    if (
      START_LABEL.test(before) ||
      /[~∼～]|부터|오전|오후/.test(before) ||
      /\d/.test(before) ||
      !/^\s*(?:까지)?\s*[.!]?$/.test(after)
    ) {
      continue;
    }

    const [, y, m, d, weekday, h, minute] = match;

    const deadline = toISO(
      Number(y),
      Number(m),
      Number(d),
      weekday,
      Number(h),
      Number(minute)
    );

    if (!deadline) continue;

    candidates.push({
      startsAt: null,
      deadline,
      evidence: text,
    });
  }

  if (candidates.length !== 1) {
    return null;
  }

  return candidates[0];
}

export function verifyStandaloneDeadline(raw, value) {
  const period = extractStandaloneDeadline(raw);

  if (!period || period.deadline !== value) {
    return {
      ok: false,
      reason: "단독 마감 일시를 원문에서 확인할 수 없음",
    };
  }

  return {
    ok: true,
    evidence: period.evidence,
  };
}
