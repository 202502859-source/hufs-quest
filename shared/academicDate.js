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

// 연도 없는 월·일: "3월 2일" 또는 "10.26"(점 뒤가 두 자리일 때만. 3.5 · 4.0 같은 평점은 안 셈).
// 연도가 붙은 날짜의 일부(2026.10.20의 10.20)는 앞의 점 때문에 여기서 따로 세지 않고, 아래에서 연-월-일의 월·일로 넣습니다.
const MONTH_DAY = /(?<![\d.])(\d{1,2})\s*월\s*(\d{1,2})\s*일|(?<![\d.])(\d{1,2})\.(\d{2})(?![\d.])/g;

export function monthDaysIn(text) {
  const source = String(text ?? "");
  const found = new Set();
  for (const key of datesIn(source, { rangeEnds: true })) found.add(key.slice(5));
  for (const m of source.matchAll(MONTH_DAY)) {
    const key = toKey("0000", m[1] ?? m[3], m[2] ?? m[4]);
    if (key) found.add(key.slice(5));
  }
  return found;
}

// 학년도: 근거에 "2026학년도"라고 쓰여 있거나, 근거의 연-월-일 날짜가 그 학년도(3월~다음 해 2월)에 들면 근거가 있다고 봅니다.
const ACADEMIC_YEAR = /(?<!\d)(\d{4})\s*학년도/g;
// 연도 단독: "2027년"(뒤에 월이 와도 같음). 근거에 그 네 자리 숫자가 있어야 합니다.
const YEAR = /(?<!\d)(\d{4})\s*년/g;

function evidenceYears(evidence) {
  const academicYears = new Set([...evidence.matchAll(ACADEMIC_YEAR)].map((m) => m[1]));
  for (const key of datesIn(evidence, { rangeEnds: true })) {
    const [y, m] = key.split("-").map(Number);
    academicYears.add(String(m <= 2 ? y - 1 : y));
  }
  const years = new Set(evidence.match(/(?<!\d)\d{4}(?!\d)/g) || []);
  return { academicYears, years };
}

// 답변의 날짜 · 연도 중 근거(docs의 title · text)에 없는 것. 비어 있으면 통과입니다.
// 예: "2027-03-02"(연-월-일), "03-02"(월·일), "2027학년도", "2027년"
export function ungroundedDates(answer, docs) {
  const evidence = docs.map((d) => `${d.title ?? ""}\n${d.text ?? ""}`).join("\n");
  const fullDates = datesIn(evidence, { rangeEnds: true });
  const monthDays = monthDaysIn(evidence);
  const { academicYears, years } = evidenceYears(evidence);
  const text = String(answer ?? "");
  const missing = [
    ...[...datesIn(text)].filter((key) => !fullDates.has(key)),
    ...[...monthDaysIn(text)].filter((key) => !monthDays.has(key)),
    ...[...text.matchAll(ACADEMIC_YEAR)].map((m) => m[1]).filter((y) => !academicYears.has(y)).map((y) => `${y}학년도`),
    ...[...text.matchAll(YEAR)].map((m) => m[1]).filter((y) => !years.has(y)).map((y) => `${y}년`),
  ];
  return [...new Set(missing)];
}
