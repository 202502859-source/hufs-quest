// 학사일정 바로 찾기(C03, 11/27 PM 결정: 이종헌). 검색창이 날짜 질문을 받으면 shared/academicCalendar.js에서
// 맞는 학기의 일정 줄을 찾아 근거 1순위로 넣고, 어느 학기 기준으로 답했는지(termBasis)와 다른 학기 버튼(alternatives)을 돌려줍니다.
// 규칙(docs/ACADEMIC_CALENDAR.md 10장):
//  1) 날짜 질문: DATE_QUESTION(언제 · 기간은 · 날짜 · 며칠 · 일정 · 마감 · 시작 · 끝 …)이 있고, CALENDAR_TOPICS 항목 하나와 맞을 때만.
//  2) 대상 학기
//     - 질문에 학년도 · 학기가 있으면 그대로("2027학년도 1학기", "2027년 1학기", "이번/다음/지난 학기", "여름/겨울 계절학기").
//       연도 없이 "1학기" · "2학기"만 있으면 아직 끝나지 않은 가장 가까운 그 학기.
//     - 학기 말이 없으면(방식 B): 그 항목이 있는 학기 중 일정이 오늘 이후에 끝나는 가장 가까운 학기.
//     - 방식 B로 하나를 못 정하면(후보 일정이 모두 지났거나, 같은 날짜의 후보 학기가 둘 이상) clarify(방식 A).
//  3) 학기가 분명하지 않은 질문이면 termBasis를 붙이고, alternatives는 1개(11/27 PM 확정):
//     기본 답 다음에 오는 같은 항목(종류를 말했으면 같은 종류 중 다음), 없으면 바로 전 것, 둘 다 없으면 없음.
//     학기가 분명하면(연도+학기, 이번 · 다음 · 지난 학기) termBasis · alternatives 없음. clarify는 기본 답을 못 고를 때만.
// 순수 함수: 오늘 날짜(YYYY-MM-DD, 한국 날짜)를 받아 판단하고, 네트워크 · 로그가 없습니다.
import { ACADEMIC_CALENDAR } from "./academicCalendar.js";
import { CALENDAR_TOPICS, DATE_QUESTION, OTHER_INTENT, SEASONAL_WORD } from "./calendarTerms.js";

const CALENDAR_PAGE = "https://www.hufs.ac.kr/hufs/11360/subview.do";
export const CALENDAR_DOC_TITLE = "학사일정 바로 찾기";

// ── 학기 이름 · 기간 ──
const parseSemester = (id) => {
  const m = String(id).match(/^(\d{4})-(1|2|summer|winter)$/);
  return m ? { year: Number(m[1]), part: m[2] } : null;
};

// 화면 · 버튼용 이름
export function semesterLabel(id, lang = "ko") {
  const s = parseSemester(id);
  if (!s) return String(id);
  if (lang === "en") {
    if (s.part === "1") return `${s.year} Spring (1st semester)`;
    if (s.part === "2") return `${s.year} Fall (2nd semester)`;
    return `${s.year} ${s.part === "summer" ? "Summer" : "Winter"} session`;
  }
  if (s.part === "summer") return `${s.year}학년도 여름 계절학기`;
  if (s.part === "winter") return `${s.year}학년도 겨울 계절학기`;
  return `${s.year}학년도 ${s.part}학기`;
}

// 근거 줄의 학기 이름(원문 표기에 맞춰 "제1학기")
const docLabel = (id) => {
  const s = parseSemester(id);
  return s && (s.part === "1" || s.part === "2") ? `${s.year}학년도 제${s.part}학기` : semesterLabel(id);
};

// 학기가 끝나는 날(그날까지는 "끝나지 않은 학기"). 1학기 3~8월, 2학기 9월~다음 해 2월, 여름 계절학기 ~8월, 겨울 계절학기 ~다음 해 2월.
function semesterEnd(id) {
  const s = parseSemester(id);
  if (!s) return "0000-00-00";
  return s.part === "1" || s.part === "summer" ? `${s.year}-08-31` : `${s.year + 1}-02-31`;
}

// 학기가 걸치는 달(YYYY-MM) 범위: 1학기 3~8월, 2학기 9월~다음 해 2월, 여름 계절학기 6~8월, 겨울 계절학기 12월~다음 해 2월
function semesterMonths(id) {
  const s = parseSemester(id);
  if (!s) return ["9999-99", "0000-00"];
  if (s.part === "1") return [`${s.year}-03`, `${s.year}-08`];
  if (s.part === "2") return [`${s.year}-09`, `${s.year + 1}-02`];
  if (s.part === "summer") return [`${s.year}-06`, `${s.year}-08`];
  return [`${s.year}-12`, `${s.year + 1}-02`];
}

// 오늘이 속한 정규 학기(방학은 바로 앞 학기로 봄: 7~8월 → 1학기, 1~2월 → 전년도 2학기)
function currentSemester(today) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  if (m >= 3 && m <= 8) return `${y}-1`;
  return m >= 9 ? `${y}-2` : `${y - 1}-2`;
}

function shiftSemester(id, step) {
  const s = parseSemester(id);
  let index = s.year * 2 + (s.part === "2" ? 1 : 0) + step;
  return `${Math.floor(index / 2)}-${index % 2 === 0 ? 1 : 2}`;
}

// ── 질문에서 학기 말 찾기 ──
// 돌려줌: { semester | null, part | null, explicitYear, text(질문에서 찾은 학기 말) } 또는 null(학기 말 없음)
const TERM_PATTERNS = [
  { re: /(\d{4})\s*(?:학년도|년)\s*(?:제\s*)?([12])\s*학기/, read: (m) => ({ semester: `${m[1]}-${m[2]}`, explicitYear: true }) },
  { re: /(\d{4})\s*(?:학년도|년)\s*(여름|하계|겨울|동계)\s*계절\s*학기/, read: (m) => ({ semester: `${m[1]}-${/여름|하계/.test(m[2]) ? "summer" : "winter"}`, explicitYear: true }) },
  { re: /(\d{4})\s*(summer|winter)\s*session|\b(summer|winter)\s*session\s*(?:of\s*)?(\d{4})/i, read: (m) => ({ semester: `${m[1] || m[4]}-${/summer/i.test(m[2] || m[3]) ? "summer" : "winter"}`, explicitYear: true }) },
  { re: /(\d{4})\s*(spring|fall|autumn)\b|\b(spring|fall|autumn)\s*(?:semester|term)?\s*(?:of\s*)?(\d{4})/i, read: (m) => ({ semester: `${m[1] || m[4]}-${/spring/i.test(m[2] || m[3]) ? 1 : 2}`, explicitYear: true }) },
  // 학년도 vs 달력 연도(11/27 PM 확정): 일정표는 학년도(3월~다음 해 2월) 단위지만 일정 이름 · 날짜는 달력 연도를 씁니다.
  // "YYYY년 M월"은 달력 날짜: 1~2월이면 (YYYY-1)학년도, 3~12월이면 YYYY학년도 안에서 실제 날짜가 그 달에 걸치는 일정만.
  { re: /(\d{4})\s*년\s*(\d{1,2})\s*월/, read: (m) => ({ calMonth: { year: Number(m[1]), month: Number(m[2]) } }) },
  // "YYYY학년도"(학기 없음): 그 학년도의 학기 중에서 방식 B로 고릅니다(지금과 같음).
  { re: /(\d{4})\s*학년도(?!\s*(?:제\s*)?[12]\s*학기)(?!\s*(?:여름|하계|겨울|동계))/, read: (m) => ({ year: Number(m[1]) }) },
  // "YYYY년"(월 · 학기 없음): 실제 날짜(시작일 또는 종료일)가 YYYY년인 일정만 후보로 봅니다.
  { re: /(\d{4})\s*년(?!\s*(?:제\s*)?[12]\s*학기)(?!\s*(?:여름|하계|겨울|동계))(?!\s*\d{1,2}\s*월)/, read: (m) => ({ calYear: Number(m[1]) }) },
  { re: /(이번|다음|지난|저번)\s*학기|\b(this|next|last)\s+semester/i, read: (m) => ({ relative: { 이번: 0, this: 0, 다음: 1, next: 1, 지난: -1, 저번: -1, last: -1 }[(m[1] || m[2]).toLowerCase()] }) },
  { re: /(여름|하계|겨울|동계)\s*계절\s*학기|\b(summer|winter)\s*session/i, read: (m) => ({ part: /여름|하계|summer/i.test(m[1] || m[2]) ? "summer" : "winter" }) },
  { re: /(?:제\s*)?([12])\s*학기|\b(1st|first|2nd|second)\s+semester|\b(spring|fall|autumn)\s+(?:semester|term)\b/i, read: (m) => ({ part: m[1] || (/1st|first|spring/i.test(m[2] || m[3]) ? "1" : "2") }) },
];

// 질문 안의 학기 종류 말(여름/겨울 계절학기, 1학기/2학기)만 따로 읽습니다(달력 연도와 함께 쓰인 경우용).
function partOf(question) {
  const season = question.match(/(여름|하계|겨울|동계)\s*계절\s*학기|\b(summer|winter)\s*session/i);
  if (season) return /여름|하계|summer/i.test(season[1] || season[2]) ? "summer" : "winter";
  const sem = question.match(/(?:제\s*)?([12])\s*학기/);
  return sem ? sem[1] : null;
}

export function findTerm(question, today) {
  for (const { re, read } of TERM_PATTERNS) {
    const m = question.match(re);
    if (!m) continue;
    const found = read(m);
    // explicit: 학기가 분명한 질문(연도+학기, 이번 · 다음 · 지난 학기). 이때는 termBasis · alternatives를 붙이지 않습니다(11/27 PM 확정).
    if (found.semester) return { semester: found.semester, part: parseSemester(found.semester).part, explicit: true, text: m[0] };
    if (found.year) return { semester: null, part: null, year: found.year, explicit: false, text: m[0] };
    // 달력 연도로 물은 질문도 연도가 분명하므로 termBasis · 버튼을 붙이지 않습니다(D9처럼). 같은 질문에 학기 종류 말이 있으면 함께 씁니다.
    if (found.calMonth || found.calYear) {
      return { semester: null, part: partOf(question), calMonth: found.calMonth, calYear: found.calYear, explicit: true, text: m[0] };
    }
    if (found.relative !== undefined) {
      return { semester: shiftSemester(currentSemester(today), found.relative), part: null, explicit: true, text: m[0] };
    }
    // 연도 없이 학기만: 아직 끝나지 않은 가장 가까운 그 학기
    const y = Number(today.slice(0, 4));
    const semester = [y - 1, y, y + 1].map((year) => `${year}-${found.part}`).find((id) => semesterEnd(id) >= today);
    return { semester, part: found.part, explicit: false, text: m[0] };
  }
  return null;
}

// ── 바로 찾기 ──
const itemDate = (item) => item.endDate || item.startDate;
const fmt = (iso) => iso.replaceAll("-", ".");
const daysBetween = (a, b) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

function topicOf(question) {
  let rest = question;
  const matched = [];

  // 구체적인 일정 표현부터 확인하고 중복 인식을 피합니다.
  for (const topic of CALENDAR_TOPICS) {
    const pattern = new RegExp(topic.ask.source, topic.ask.flags + "g");
    if (!topic.ask.test(rest)) continue;
    matched.push(topic);
    rest = rest.replace(pattern, " ");
  }

  // 계절학기 개강·종강은 하나의 일정 질문으로 봅니다.
  if (matched.length === 2 && matched[0].key === "seasonal") {
    if (["semesterStart", "semesterEnd"].includes(matched[1].key)) {
      return matched[0];
    }
  }

  // 서로 다른 일정 질문은 기존 일반 검색으로 넘깁니다.
  return matched.length === 1 ? matched[0] : null;
}

// 수집하지 않은 학년도의 정규학기 개강·종강 날짜를 추측하지 않도록 합니다.
// 달력 연도와 다른 일정(수강신청·학위수여식 등)은 기존 검색을 유지합니다.
export function isUnavailableCalendarTerm(question, {
  today,
  calendar = ACADEMIC_CALENDAR,
} = {}) {
  const q = String(question ?? "");

  if (!today || !DATE_QUESTION.test(q) || OTHER_INTENT.test(q)) return false;

  const topic = topicOf(q);
  if (!topic || !["semesterStart", "semesterEnd"].includes(topic.key)) return false;

  const term = findTerm(q, today);
  if (!term) return false;

  const year = term.semester && term.explicit
    ? parseSemester(term.semester)?.year
    : term.year;

  if (!year) return false;

  const items = calendar.items || [];
  if (!items.length) return false;

  return !items.some(item => item.academicYear === year);
}

function matchingItems(topic, question, items) {
  return items.filter((item) => {
    if (!item.targetSemester || !topic.item.test(item.name)) return false;
    // 전기와 후기 학위수여식을 구분합니다.
    if (topic.key === "commencement") {
      if (/전기/.test(question) && !/전기/.test(item.name)) return false;
      if (/후기/.test(question) && !/후기/.test(item.name)) return false;
    }
    if (topic.exclude && topic.exclude.test(item.name) && !topic.exclude.test(question)) return false;
    // 계절학기를 물으면서 시작(개강) · 끝(종강)을 말했으면 그 일정만
    if (topic.key === "seasonal" && /개강|시작|start|begin/i.test(question) && !/개강/.test(item.name)) return false;
    if (topic.key === "seasonal" && /종강|끝나|끝이|\bend/i.test(question) && !/종강/.test(item.name)) return false;
    return true;
  });
}

// 원 질문에서 학기 말을 빼고 앞에 학기 이름을 붙인 다시 묻기 문장
// 한글이 없는 영어 질문이면 영어 학기 이름("2026 Spring")을 붙여 다시 물어도 영어로 답하게 합니다.
// 영어는 학기 말을 빼면 문장이 어색해져 원 질문 앞에 "2027 Spring:"처럼 붙입니다(앞의 연도 · 학기가 먼저 읽힘).
function retarget(question, termText, semester) {
  if (!/[가-힣]/.test(question)) {
    return `${semesterLabel(semester, "en").replace(/\s*\((?:1st|2nd) semester\)$/, "")}: ${question.trim()}`;
  }
  let rest = termText ? question.replace(termText, " ") : question;
  // "계절학기 언제 시작해?"처럼 학기 종류 말만 있으면 그 말을 학기 이름으로 바꿔 "계절학기"가 두 번 나오지 않게 합니다.
  if (!termText && /summer|winter/.test(semester)) rest = rest.replace(/계절\s*학기/, " ");
  rest = rest.replace(/\s+/g, " ").trim();
  return `${semesterLabel(semester)} ${rest}`.trim();
}

const alternativeOf = (question, termText, id) => ({
  semester: id,
  label: semesterLabel(id),
  labelEn: semesterLabel(id, "en"),
  question: retarget(question, termText, id),
});

// clarify용: 오늘과 가까운 학기 최대 2개
function alternativesFor(question, termText, semesters, chosen, today, max = 2) {
  return semesters
    .filter((s) => s.id !== chosen)
    .sort((a, b) => daysBetween(a.date, today) - daysBetween(b.date, today) || a.id.localeCompare(b.id))
    .slice(0, max)
    .map((s) => alternativeOf(question, termText, s.id));
}

// 다른 학기 버튼(11/27 PM 확정): 1개. 기본 답 다음에 오는 같은 항목(종류를 말했으면 같은 종류 중 다음),
// 다음 것이 데이터에 없으면 바로 전 것, 둘 다 없으면 없음. 학기 순서는 그 학기 일정의 가장 이른 시작일로 정합니다.
function nextOrPrevious(question, termText, semesters, chosen) {
  const ordered = [...semesters].sort((a, b) => a.first.localeCompare(b.first) || a.id.localeCompare(b.id));
  const index = ordered.findIndex((s) => s.id === chosen);
  const pick = ordered[index + 1] || ordered[index - 1];
  return index >= 0 && pick ? [alternativeOf(question, termText, pick.id)] : [];
}

// 답변 생성에 덧붙이는 한 줄(바로 찾기를 한 질문에만). 다른 학기 자료의 날짜로 답하지 않게 합니다(11/27 Preview D3 · D4 · D8에서 확인).
export function calendarNote(route, lang = "ko") {
  if (!route || route.clarify) return "";
  if (lang === "en") {
    return `[Academic calendar] Treat this question as asking about ${semesterLabel(route.semester, "en")}. Answer with the dates in source [1] (academic calendar lookup), not dates from other semesters or years in other sources. If the dates have already passed as of today, say so.`;
  }
  return `[학사일정 기준] 이 질문은 ${semesterLabel(route.semester)} 일정을 묻는 것으로 본다. [1] 학사일정 바로 찾기 자료의 날짜로 답하고, 다른 자료에 있는 다른 학기 · 연도의 날짜로 대신하지 않는다. 오늘 기준 이미 지난 일정이면 지났다고 말한다.`;
}

// 답에 나온 날짜가 바로 찾기 일정과 모두 일치하는지 검사합니다.
// 연도가 명시되면 연도도 비교하고, 생략되면 월과 일을 비교합니다.
export function answerHasRouteDate(answer, route) {
  if (!route?.dates?.length) return true;

  const text = String(answer ?? "")
    // 한국어 축약 기간을 시작일과 종료일로 펼칩니다.
    .replace(
      /(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*(?:일)?\s*(?:[~∼～–—-]|부터)\s*(\d{1,2})\s*일/g,
      (_, year, month, first, last) => {
        const prefix = year ? `${year}년 ` : "";
        return `${prefix}${month}월 ${first}일 ~ ${prefix}${month}월 ${last}일`;
      }
    )
    // 영어 축약 기간도 두 날짜로 펼칩니다.
    .replace(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[~–—-]\s*(\d{1,2})\b(?:,?\s+(\d{4}))?/gi,
      (_, month, first, last, year) => {
        const suffix = year ? `, ${year}` : "";
        return `${month} ${first}${suffix} ~ ${month} ${last}${suffix}`;
      }
    );
  const found = [];

  const add = (year, month, day) => {
    found.push({
      year: year ? Number(year) : null,
      month: Number(month),
      day: Number(day),
    });
  };

  // 한국어 날짜
  for (const m of text.matchAll(
    /(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/g
  )) {
    add(m[1], m[2], m[3]);
  }

  // 숫자로 표기된 날짜
  for (const m of text.matchAll(
    /(?<![\d.\-/])(?:(\d{4})\s*[.\-/]\s*)?(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?!\d)/g
  )) {
    add(m[1], m[2], m[3]);
  }

  // 영어 날짜
  for (const m of text.matchAll(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b(?:,?\s+(\d{4}))?/gi
  )) {
    add(
      m[3],
      MONTH_NAMES.indexOf(m[1].toLowerCase()) + 1,
      m[2]
    );
  }

  if (!found.length) return false;

  return found.every((date) =>
    route.dates.some((iso) =>
      (date.year === null || date.year === Number(iso.slice(0, 4))) &&
      date.month === Number(iso.slice(5, 7)) &&
      date.day === Number(iso.slice(8, 10))
    )
  );
}

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// question: 원 질문, today: 한국 날짜 "YYYY-MM-DD". 해당 없으면 null(검색창은 지금과 똑같이 동작).
export function routeCalendar(question, { today, calendar = ACADEMIC_CALENDAR } = {}) {
  const q = String(question ?? "");
  if (!today || !DATE_QUESTION.test(q)) return null;
  // 날짜 말고 다른 것(성적 · 방법 · 장소 · 대상 · 자격 · 서류 등)을 같이 물으면 바로 찾기를 건너뜁니다(11/27 PM 결정).
  if (OTHER_INTENT.test(q)) return null;
  const topic = topicOf(q);
  if (!topic) return null;
  const items = matchingItems(topic, q, calendar.items || []);
  if (!items.length) return null;

  const term = findTerm(q, today);
  // 달력 연도 · 달로 물었으면 후보 일정을 실제 날짜로 좁힙니다(학년도 vs 달력 연도, 11/27 PM 확정).
  let pool = items;
  if (term?.calMonth) {
    const { year, month } = term.calMonth;
    const academicYear = month <= 2 ? year - 1 : year;
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const inYear = items.filter((i) => i.academicYear === academicYear);
    pool = inYear.filter((i) => i.startDate.slice(0, 7) <= ym && itemDate(i).slice(0, 7) >= ym);
    // 그 달에 실제 날짜가 없으면(예: 1월에 진행 중인 겨울 계절학기의 개강일은 12월) 그 달을 포함하는 학기의 일정으로 봅니다.
    if (!pool.length && topic.key === "seasonal") {
      pool = inYear.filter((i) => {
        const [from, to] = semesterMonths(i.targetSemester);
        return from <= ym && ym <= to;
      });
    }
  } else if (term?.calYear) {
    const y = String(term.calYear);
    pool = items.filter((i) => i.startDate.startsWith(y) || (i.endDate || "").startsWith(y));
  }
  // "계절학기"를 말했으면(여름 · 겨울 없이도) 계절학기 학기만 후보로 봅니다. 정규 학기 일정으로 가지 않게(11/27 PM 결정).
  if (SEASONAL_WORD.test(q) && topic.key !== "seasonal") {
    pool = pool.filter((i) => /-(?:summer|winter)$/.test(i.targetSemester));
  }
  if (!pool.length) return null; // 그 연도 · 달 · 계절학기에 그 일정이 없으면 지금처럼 검색
  // 학기 말과 종류가 맞는 후보 학기(계절학기 말이면 계절학기만, "1학기"면 1학기만)
  const bySemester = new Map();
  for (const item of pool) {
    const list = bySemester.get(item.targetSemester) || [];
    list.push(item);
    bySemester.set(item.targetSemester, list);
  }
  const sameKind = (id) =>
    (!term?.part || parseSemester(id)?.part === term.part) && (!term?.year || parseSemester(id)?.year === term.year);
  const candidates = [...bySemester.entries()]
    .filter(([id]) => sameKind(id))
    .map(([id, list]) => {
      const upcoming = list.map(itemDate).filter((d) => d >= today).sort();
      const dates = list.map((i) => i.startDate).sort();
      return { id, list, next: upcoming[0] || null, date: upcoming[0] || dates.at(-1), first: dates[0] };
    });

  let chosen = null;
  if (term?.semester) {
    chosen = term.semester;
    if (!bySemester.has(chosen)) return null; // 그 학기에 그 일정이 없으면 지금처럼 검색
  } else if (!term || term.year || term.calMonth || term.calYear) {
    // 방식 B: 일정이 오늘 이후에 끝나는 가장 가까운 학기. 못 정하면 방식 A(clarify)
    // 연도만 있으면 그 학년도의 학기만 후보로 보고, 그 학년도에 그 일정이 없으면 지금처럼 검색합니다.
    if (!candidates.length) return null;
    const upcoming = candidates.filter((c) => c.next).sort((a, b) => a.next.localeCompare(b.next));
    const tie = upcoming.length > 1 && upcoming[0].next === upcoming[1].next;
    // 달력 연도 · 달로 물었는데 후보가 모두 지난 일정이면: 달은 그 달 일정(가장 늦은 것), 연도는 후보 학기가 하나일 때만 그대로 답합니다.
    const past = [...candidates].sort((a, b) => b.date.localeCompare(a.date));
    if (!upcoming.length && (term?.calMonth || (term?.calYear && candidates.length === 1))) {
      chosen = past[0].id;
    } else if (!upcoming.length || tie) {
      return {
        clarify: true,
        topic: topic.key,
        alternatives: alternativesFor(q, null, candidates, null, today),
      };
    } else {
      chosen = upcoming[0].id;
    }
  } else {
    // "1학기"처럼 학기만 있는데 끝나지 않은 그 학기를 못 찾음
    return { clarify: true, topic: topic.key, alternatives: alternativesFor(q, term.text, candidates, null, today) };
  }

  const rows = [...bySemester.get(chosen)].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
  // 오늘 이전에 끝난 일정은 줄 끝에 "(오늘 기준 지난 일정)"을 붙여, 이미 지났다는 것을 답에 말할 수 있게 합니다.
  const lines = rows.map(
    (i) =>
      `[${CALENDAR_DOC_TITLE}] ${docLabel(chosen)} > ${fmt(i.startDate)}${i.endDate ? ` ~ ${fmt(i.endDate)}` : ""}: ${i.name}` +
      (itemDate(i) < today ? " (오늘 기준 지난 일정)" : ""),
  );
  const urls = [...new Set(rows.map((i) => i.sourceUrl))];
  const explicit = Boolean(term?.explicit);
  return {
    clarify: false,
    topic: topic.key,
    semester: chosen,
    explicit,
    lines,
    dates: rows.flatMap((i) => [i.startDate, i.endDate].filter(Boolean)),
    doc: {
      id: `calendar:${chosen}:${topic.key}`,
      title: CALENDAR_DOC_TITLE,
      url: urls.length === 1 ? urls[0] : CALENDAR_PAGE,
      text: lines.join("\n"),
      method: "calendar",
    },
    // 학기가 분명한 질문(연도+학기, 이번 · 다음 · 지난 학기)에는 기준 학기 안내 · 다른 학기 버튼을 붙이지 않습니다.
    termBasis: explicit ? null : { semester: chosen, label: semesterLabel(chosen), labelEn: semesterLabel(chosen, "en") },
    alternatives: explicit ? [] : nextOrPrevious(q, term?.text ?? null, candidates, chosen),
  };
}
