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

// 게시일은 사람이 입력한 YYYY-MM-DD 형식만 허용한다.
export function validPublishedAt(value) {
  if (typeof value !== "string") return false;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) return false;

  return Boolean(
    toISO(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      null,
      0,
      0
    )
  );
}

// 연도나 시각이 생략된 날짜를 검수용으로 보완한다.
// 명시된 날짜 및 시각을 임의로 변경하지 않는다.
function reviewableDate(
  text,
  publishedAt,
  { previousYear = null, previousMonth = null } = {}
) {
  const match = text.trim().match(
    /^(?:(\d{4})\s*(?:년|[./-])\s*)?(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*(?:일)?\.?\s*(?:\(([월화수목금토일])\))?\s*(?:(오전|오후)\s*)?(?:(\d{1,2}):(\d{2})|(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?)?\s*(?:까지)?\s*[.!]?$/
  );

  if (!match) return null;

  const [
    , explicitYear, m, d, weekday,
    meridiem, h, minute, koreanHour, koreanMinute
  ] = match;

  const month = Number(m);
  const day = Number(d);

  const notes = [];

  let year;

  if (explicitYear) {
    year = Number(explicitYear);
  } else if (previousYear !== null) {
    year = previousYear;

    if (previousMonth === 12 && month === 1) {
      year++;
    }

    notes.push(`연도 추정: 앞선 날짜 기준 ${year}년`);
  } else {
    if (!validPublishedAt(publishedAt)) {
      return null;
    }

    year = Number(publishedAt.slice(0, 4));

    const postedMonth = Number(
      publishedAt.slice(5, 7)
    );

    if (postedMonth === 12 && month === 1) {
      year++;
    }

    notes.push(
      `연도 추정: 게시일 ${publishedAt} 기준 ${year}년`
    );
  }

  const missingTime =
    h === undefined && koreanHour === undefined;

  if (missingTime && meridiem) return null;

  let hour;
  let min;

  if (missingTime) {
    hour = 23;
    min = 59;

    notes.push("시각 없음 → 23:59로 둠");
  } else {
    hour = Number(h ?? koreanHour);
    min = Number(minute ?? koreanMinute ?? 0);

    if (meridiem) {
      if (hour < 1 || hour > 12) return null;

      hour = hour % 12;

      if (meridiem === "오후") hour += 12;
    }
  }

  const deadline = toISO(
    year, month, day, null, hour, min
  );

  if (!deadline) return null;

  const actualWeekday =
    "일월화수목금토"[
      new Date(Date.UTC(
        year, month - 1, day
      )).getUTCDay()
    ];

  if (weekday && weekday !== actualWeekday) {
    // 연도가 명시되어 있는데 요일이 틀리면
    // 기존 검증 정책대로 보류한다.
    if (explicitYear) return null;

    // 연도를 보완한 경우에는 원문 날짜를 변경하지
    // 않고 요일 불일치 사실을 검수 메모에 남긴다.
    notes.push(
      `요일 불일치: 원문 ${weekday}요일, ` +
      `추정 날짜 ${actualWeekday}요일`
    );
  }

  return {
    deadline,
    year,
    month,
    missingTime,
    reviewNotes: notes,
  };
}

// 마감 또는 신청 기간을 명시한 문장만 처리한다.
// 다른 행사 일시나 결과 발표일을 마감으로 쓰지 않는다.
function reviewableLine(
  line,
  publishedAt
) {
  const text = line.trim();

  const label = text.match(
    /^(?:[•*-]\s*)?(?:(\d+)\s*차\s*)?(?:(?:신청|접수|제출|서류\s*제출)\s*)?(?:마감(?:일시|일)?|기한|종료|기간)\s*[:：]\s*/
  );

  const round = label?.[1]
    ? Number(label[1])
    : null;

  let body;

  if (label) {
    body = text.slice(label[0].length);
  } else if (/까지\s*[.!]?$/.test(text)) {
    body = text;
  } else {
    return null;
  }

  const parts = body.split(/[~∼～]/);

  if (parts.length > 2) return null;

  let start = null;
  let end;

  if (parts.length === 2 && parts[0].trim()) {
    start = reviewableDate(
      parts[0], publishedAt
    );

    if (!start) return null;

    end = reviewableDate(
      parts[1],
      publishedAt,
      {
        previousYear: start.year,
        previousMonth: start.month,
      }
    );
  } else {
    end = reviewableDate(
      parts.at(-1),
      publishedAt
    );
  }

  if (!end) return null;

  let startsAt = null;

  if (start && !start.missingTime) {
    startsAt = start.deadline;
  }

  if (
    start &&
    start.deadline.slice(0, 10) >
      end.deadline.slice(0, 10)
  ) {
    return null;
  }

  if (startsAt && startsAt >= end.deadline) {
    return null;
  }

  const notes = [];

  if (start) {
    notes.push(
      ...start.reviewNotes
        .filter(note =>
          note !== "시각 없음 → 23:59로 둠"
        )
        .map(note => "시작일: " + note)
    );

    if (start.missingTime) {
      notes.push(
        "시작 시각 없음 → startsAt 비워 둠"
      );
    }
  }

  notes.push(...end.reviewNotes);

  return {
    round,
    startsAt,
    deadline: end.deadline,
    evidence: text,
    reviewNotes: [...new Set(notes)],
  };
}

// PM이 허용한 날짜 보완 규칙을 적용한다.
// 모든 추정 및 복수 마감은 검수 메모에 기록한다.
export function extractReviewableDeadline(
  raw,
  publishedAt = null
) {
  if (
    typeof raw !== "string" ||
    !raw.trim()
  ) {
    return null;
  }

  if (
    publishedAt !== null &&
    !validPublishedAt(publishedAt)
  ) {
    return null;
  }

  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const candidates = [];

  for (const line of lines) {
    const result = reviewableLine(
      line, publishedAt
    );

    if (result) {
      candidates.push(result);
      continue;
    }

    // 명시적인 마감 문장이 해석되지 않으면
    // 다른 마감만 선택하지 않고 검수를 요청한다.
    if (
      /^(?:[•*-]\s*)?(?:\d+\s*차\s*)?(?:(?:신청|접수|제출|서류\s*제출)\s*)?(?:마감(?:일시|일)?|기한|종료)\s*[:：]/.test(line)
    ) {
      return null;
    }
  }

  const roundLines = lines.filter(line =>
    /^\s*(?:[•*-]\s*)?\d+\s*차\s*(?:신청\s*|접수\s*)?(?:마감|종료|기한|기간)/.test(line)
  );

  // 일부 차수만 해석된 상태로 마지막 마감을
  // 확정하는 것을 방지한다.
  if (
    roundLines.length > 0 &&
    roundLines.length !==
      candidates.filter(c => c.round !== null).length
  ) {
    return null;
  }

  if (candidates.length === 0) return null;

  if (candidates.length === 1) {
    if (hasMultipleRounds(raw)) return null;

    const { round, ...result } = candidates[0];

    return result;
  }

  // 여러 날짜를 무조건 합치지 않고,
  // 명시적인 차수 마감만 하나의 일정으로 취급한다.
  if (
    candidates.some(c => c.round === null) ||
    new Set(
      candidates.map(c => c.round)
    ).size !== candidates.length
  ) {
    return null;
  }

  const ordered = [...candidates].sort(
    (a, b) => a.deadline.localeCompare(b.deadline)
  );

  // 날짜 순서와 차수 순서가 충돌하면
  // 복수 마감으로 자동 확정하지 않는다.
  if (
    ordered.some((candidate, index) =>
      index > 0 &&
      candidate.round <= ordered[index - 1].round
    )
  ) {
    return null;
  }

  const last = ordered.at(-1);

  const notes = ["복수 마감"];

  for (const candidate of ordered) {
    notes.push(
      `${candidate.round}차 마감: ` +
      candidate.deadline
    );

    notes.push(
      ...candidate.reviewNotes.map(
        note => `${candidate.round}차: ${note}`
      )
    );
  }

  notes.push(
    `${last.round}차 마감을 최종 마감으로 적용`
  );

  return {
    startsAt: last.startsAt,
    deadline: last.deadline,
    evidence: last.evidence,
    reviewNotes: [...new Set(notes)],
  };
}


// 연도가 명시된 날짜의 요일 오류를 독립적으로 검사한다.
// 연도 없는 날짜는 기존 검수 메모 정책을 유지한다.
export function hasInvalidExplicitWeekday(raw) {
  const pattern =
    /(?<!\d)(\d{4})\s*(?:년|[./-])\s*(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*(?:일)?\.?\s*\(([월화수목금토일])(?:요일)?\)/g;

  for (const match of raw.matchAll(pattern)) {
    const [, year, month, day, weekday] = match;

    if (!toISO(
      Number(year),
      Number(month),
      Number(day),
      weekday,
      0,
      0
    )) {
      return true;
    }
  }

  return false;
}
