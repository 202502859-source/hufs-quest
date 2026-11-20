// 학사일정(대학, /hufs/11360/subview.do) 페이지를 '연도까지 붙은 한 줄 일정'으로 바꿉니다.
//
// 이 페이지 본문은 "3월 / March / 03.03 / ~ 03.09 / 수강신청 변경 / ..." 처럼 날짜 · 끝 날짜 · 일정 이름이
// 줄마다 따로 나오고 연도가 없습니다. 그대로 자르면 "02.10 수강신청"이 2026년인지 2027년인지 알 수 없어
// 검색창이 연도를 틀리게 답할 수 있습니다(11/19 수집 결과로 확인).
//
// 규칙
// - 학년도(year): 본문 맨 앞 연도 이동 버튼 중 첫 번째 4자리 숫자(지금 보고 있는 학년도). 2026학년도 = 2026.03 ~ 2027.02
// - 3~12월 일정은 year년, 1~2월 일정은 year+1년. 끝 날짜가 1~2월이면 끝 날짜도 year+1년
// - 3~6월 · 7~8월 · 9~12월 · 이듬해 1~2월로 묶어 조각 4개를 만듭니다
// - 일정 이름은 원문 그대로(바꾸지 않음)
const DATE = /^(\d{2})\.(\d{2})$/;
const END = /^~\s*(\d{2})\.(\d{2})$/;
const MONTH_KO = /^\d{1,2}월$/;
const MONTH_EN = /^(January|February|March|April|May|June|July|August|September|October|November|December)$/;
const YEAR = /^(\d{4})년?$/;
const NAV = /^(달력으로 보기|목록으로 보기)$/;

const GROUPS = [
  { key: "spring", months: [3, 4, 5, 6], label: (y) => `${y}학년도 제1학기 (${y}년 3~6월)` },
  { key: "summer", months: [7, 8], label: (y) => `${y}학년도 여름방학 (${y}년 7~8월)` },
  { key: "fall", months: [9, 10, 11, 12], label: (y) => `${y}학년도 제2학기 (${y}년 9~12월)` },
  { key: "winter", months: [1, 2], label: (y) => `${y}학년도 겨울방학 (${y + 1}년 1~2월)` },
];

const yearOf = (year, month) => (month <= 2 ? year + 1 : year);
const fmt = (year, m, d) => `${yearOf(year, m)}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;

// lines: extractPage()의 줄 목록. 반환: { year, items: [{ start, end, month, name }] }
export function parseCalendar(lines) {
  let year = null;
  let started = false;
  const items = [];
  let current = null;
  const close = () => {
    if (current?.name) items.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!started) {
      const y = line.match(YEAR);
      if (y && year === null) year = Number(y[1]);
      if (MONTH_KO.test(line)) started = true;
      continue;
    }
    // 해가 바뀌는 곳의 "2027" 같은 연도 줄도 건너뜁니다(연도는 월로 계산).
    if (MONTH_KO.test(line) || MONTH_EN.test(line) || NAV.test(line) || YEAR.test(line)) continue;
    const date = line.match(DATE);
    if (date) {
      close();
      const m = Number(date[1]);
      current = { month: m, start: fmt(year, m, Number(date[2])), end: null, name: "" };
      continue;
    }
    const end = line.match(END);
    if (end && current && !current.name) {
      current.end = fmt(year, Number(end[1]), Number(end[2]));
      continue;
    }
    if (current) current.name = current.name ? `${current.name} ${line}` : line;
  }
  close();
  return { year, items };
}

// collect.mjs가 부릅니다. 일정이 너무 적게 읽히면(페이지 구조가 바뀐 경우) null을 돌려주고, collect는 기존 방식으로 자릅니다.
export function calendarChunks({ pageId, title, url, lines, minItems = 20 }) {
  const { year, items } = parseCalendar(lines);
  if (!year || items.length < minItems) return null;
  const pageTitle = `학사일정(${title || "대학"})`;
  return GROUPS.map((group) => {
    const rows = items.filter((it) => group.months.includes(it.month));
    if (!rows.length) return null;
    const section = group.label(year);
    const body = rows.map((it) => `${it.end ? `${it.start} ~ ${it.end}` : it.start}: ${it.name}`);
    return {
      section,
      text: [`[${pageTitle} > ${section}]`, `${year}학년도 학사일정(학교 홈페이지 대학 학사일정, 캠퍼스 구분 없이 게시됨)`, ...body].join("\n"),
    };
  })
    .filter(Boolean)
    .map((chunk, i) => ({ id: `${pageId}-${String(i + 1).padStart(2, "0")}`, title: pageTitle, url, ...chunk }));
}
