// 검색창 답변이 날짜를 지어내지 않게 돕는 순수 함수들입니다(api/ask.js에서 사용, 테스트: tests/academicDate.test.js).
// 1) seoulToday: 서버 시간(UTC)이 아니라 한국(Asia/Seoul) 날짜로 오늘과 현재 학기를 계산합니다.
//    학기 묶음은 학사일정 수집(scripts/lib/calendarPage.mjs)과 같습니다.
//    3~6월 제1학기 · 7~8월 여름방학 · 9~12월 제2학기 · 1~2월 겨울방학. 학년도는 3월부터, 1~2월은 전년도 학년도.
// 2) ungroundedDates: 답변에 쓴 연·월·일 날짜 중 근거 조각 어디에도 없는 날짜를 찾습니다.

const SEOUL_OFFSET_MS = 9 * 3600 * 1000; // 한국은 서머타임이 없어 항상 UTC+9
const WEEKDAY = { ko: ["일", "월", "화", "수", "목", "금", "토"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
const TERMS = [
  { months: [3, 4, 5, 6], ko: "제1학기", en: "1st semester" },
  { months: [7, 8], ko: "여름방학", en: "summer vacation" },
  { months: [9, 10, 11, 12], ko: "제2학기", en: "2nd semester" },
  { months: [1, 2], ko: "겨울방학", en: "winter vacation" },
];

const pad = (n) => String(n).padStart(2, "0");

export function seoulToday(now = new Date()) {
  const d = new Date(now.getTime() + SEOUL_OFFSET_MS);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const term = TERMS.find((t) => t.months.includes(month));
  return {
    date: `${year}-${pad(month)}-${pad(day)}`,
    year,
    month,
    day,
    weekday: d.getUTCDay(),
    academicYear: month <= 2 ? year - 1 : year,
    term: { ko: term.ko, en: term.en },
  };
}

// AI 지시문에 덧붙일 한 줄. 예: "오늘은 2026-11-20(금), 2026학년도 제2학기입니다. …"
export function todayContext(now = new Date(), lang = "ko") {
  const t = seoulToday(now);
  if (lang === "en") {
    return `Today is ${t.date} (${WEEKDAY.en[t.weekday]}, Korea time), in the ${t.term.en} of the ${t.academicYear} academic year. Interpret words like 'this semester' or 'next month' relative to this date.`;
  }
  return `오늘은 ${t.date}(${WEEKDAY.ko[t.weekday]}), ${t.academicYear}학년도 ${t.term.ko}입니다. '이번 학기'·'다음 달' 같은 말은 이 날짜 기준으로 해석하세요.`;
}

// 연도가 붙은 날짜만 셉니다: 2026.03.02 · 2026. 3. 2. · 2026-03-02 · 2026/03/02 · 2026년 3월 2일
const FULL_DATE = /(?<!\d)(\d{4})\s*(?:[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})|년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일)(?!\d)/g;
// 근거 쪽 기간의 끝 날짜에 연도가 빠진 경우(2026.10.20 ~ 10.26)는 앞 날짜의 연도를 붙여 셉니다.
const RANGE_END = /^\s*[~∼～-]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?![\d.\-/])/;

function toKey(y, m, d) {
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${pad(month)}-${pad(day)}`;
}

export function datesIn(text, { rangeEnds = false } = {}) {
  const found = new Set();
  const source = String(text ?? "");
  for (const m of source.matchAll(FULL_DATE)) {
    const key = toKey(m[1], m[2] ?? m[4], m[3] ?? m[5]);
    if (key) found.add(key);
    if (!rangeEnds) continue;
    const end = source.slice(m.index + m[0].length).match(RANGE_END);
    const endKey = end && toKey(m[1], end[1], end[2]);
    if (endKey) found.add(endKey);
  }
  return found;
}

// 답변의 날짜 중 근거(docs의 title · text)에 없는 것. 비어 있으면 통과입니다.
export function ungroundedDates(answer, docs) {
  const evidence = datesIn(docs.map((d) => `${d.title ?? ""}\n${d.text ?? ""}`).join("\n"), { rangeEnds: true });
  return [...datesIn(answer)].filter((key) => !evidence.has(key));
}
