// 학사일정 바로 찾기(C03, 11/27 PM 결정: 이종헌). 검색창이 날짜 질문을 받으면 shared/academicCalendar.js에서
// 맞는 학기의 일정 줄을 찾아 근거 1순위로 넣고, 어느 학기 기준으로 답했는지(termBasis)와 다른 학기 버튼(alternatives)을 돌려줍니다.
// 규칙(docs/ACADEMIC_CALENDAR.md 10장):
//  1) 날짜 질문: DATE_QUESTION(언제 · 기간은 · 날짜 · 며칠 · 일정 · 마감 · 시작 · 끝 …)이 있고, CALENDAR_TOPICS 항목 하나와 맞을 때만.
//  2) 대상 학기
//     - 질문에 학년도 · 학기가 있으면 그대로("2027학년도 1학기", "2027년 1학기", "이번/다음/지난 학기", "여름/겨울 계절학기").
//       연도 없이 "1학기" · "2학기"만 있으면 아직 끝나지 않은 가장 가까운 그 학기.
//     - 학기 말이 없으면(방식 B): 그 항목이 있는 학기 중 일정이 오늘 이후에 끝나는 가장 가까운 학기.
//     - 방식 B로 하나를 못 정하면(후보 일정이 모두 지났거나, 같은 날짜의 후보 학기가 둘 이상) clarify(방식 A).
//  3) 연도를 질문에서 직접 받지 않았으면 termBasis를 붙이고, 같은 항목이 있는 다른 학기를 최대 2개 alternatives로.
// 순수 함수: 오늘 날짜(YYYY-MM-DD, 한국 날짜)를 받아 판단하고, 네트워크 · 로그가 없습니다.
import { ACADEMIC_CALENDAR } from "./academicCalendar.js";
import { CALENDAR_TOPICS, DATE_QUESTION } from "./calendarTerms.js";

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
  // 학기 없이 연도만("2027학년도 개강일", "2027년 수강신청"): 그 학년도의 학기 중에서 방식 B로 고릅니다.
  { re: /(\d{4})\s*(?:학년도|년)(?!\s*(?:제\s*)?[12]\s*학기)(?!\s*(?:여름|하계|겨울|동계))/, read: (m) => ({ year: Number(m[1]) }) },
  { re: /(이번|다음|지난|저번)\s*학기|\b(this|next|last)\s+semester/i, read: (m) => ({ relative: { 이번: 0, this: 0, 다음: 1, next: 1, 지난: -1, 저번: -1, last: -1 }[(m[1] || m[2]).toLowerCase()] }) },
  { re: /(여름|하계|겨울|동계)\s*계절\s*학기|\b(summer|winter)\s*session/i, read: (m) => ({ part: /여름|하계|summer/i.test(m[1] || m[2]) ? "summer" : "winter" }) },
  { re: /(?:제\s*)?([12])\s*학기|\b(1st|first|2nd|second)\s+semester|\b(spring|fall|autumn)\s+(?:semester|term)\b/i, read: (m) => ({ part: m[1] || (/1st|first|spring/i.test(m[2] || m[3]) ? "1" : "2") }) },
];

export function findTerm(question, today) {
  for (const { re, read } of TERM_PATTERNS) {
    const m = question.match(re);
    if (!m) continue;
    const found = read(m);
    if (found.semester) return { semester: found.semester, part: parseSemester(found.semester).part, explicitYear: true, text: m[0] };
    if (found.year) return { semester: null, part: null, year: found.year, explicitYear: false, text: m[0] };
    if (found.relative !== undefined) {
      return { semester: shiftSemester(currentSemester(today), found.relative), part: null, explicitYear: false, text: m[0] };
    }
    // 연도 없이 학기만: 아직 끝나지 않은 가장 가까운 그 학기
    const y = Number(today.slice(0, 4));
    const semester = [y - 1, y, y + 1].map((year) => `${year}-${found.part}`).find((id) => semesterEnd(id) >= today);
    return { semester, part: found.part, explicitYear: false, text: m[0] };
  }
  return null;
}

// ── 바로 찾기 ──
const itemDate = (item) => item.endDate || item.startDate;
const fmt = (iso) => iso.replaceAll("-", ".");
const daysBetween = (a, b) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

function topicOf(question) {
  return CALENDAR_TOPICS.find((t) => t.ask.test(question)) || null;
}

function matchingItems(topic, question, items) {
  return items.filter((item) => {
    if (!item.targetSemester || !topic.item.test(item.name)) return false;
    if (topic.exclude && topic.exclude.test(item.name) && !topic.exclude.test(question)) return false;
    // 계절학기를 물으면서 개강 · 종강을 말했으면 그 일정만
    if (topic.key === "seasonal" && /개강/.test(question) && !/개강/.test(item.name)) return false;
    if (topic.key === "seasonal" && /종강/.test(question) && !/종강/.test(item.name)) return false;
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
  const rest = (termText ? question.replace(termText, " ") : question).replace(/\s+/g, " ").trim();
  return `${semesterLabel(semester)} ${rest}`.trim();
}

function alternativesFor(question, termText, semesters, chosen, today, max = 2) {
  return semesters
    .filter((s) => s.id !== chosen)
    .sort((a, b) => daysBetween(a.date, today) - daysBetween(b.date, today) || a.id.localeCompare(b.id))
    .slice(0, max)
    .map((s) => ({ semester: s.id, label: semesterLabel(s.id), labelEn: semesterLabel(s.id, "en"), question: retarget(question, termText, s.id) }));
}

// question: 원 질문, today: 한국 날짜 "YYYY-MM-DD". 해당 없으면 null(검색창은 지금과 똑같이 동작).
export function routeCalendar(question, { today, calendar = ACADEMIC_CALENDAR } = {}) {
  const q = String(question ?? "");
  if (!today || !DATE_QUESTION.test(q)) return null;
  const topic = topicOf(q);
  if (!topic) return null;
  const items = matchingItems(topic, q, calendar.items || []);
  if (!items.length) return null;

  const term = findTerm(q, today);
  // 학기 말과 종류가 맞는 후보 학기(계절학기 말이면 계절학기만, "1학기"면 1학기만)
  const bySemester = new Map();
  for (const item of items) {
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
      return { id, list, next: upcoming[0] || null, date: upcoming[0] || dates.at(-1) };
    });

  let chosen = null;
  if (term?.semester) {
    chosen = term.semester;
    if (!bySemester.has(chosen)) return null; // 그 학기에 그 일정이 없으면 지금처럼 검색
  } else if (!term || term.year) {
    // 방식 B: 일정이 오늘 이후에 끝나는 가장 가까운 학기. 못 정하면 방식 A(clarify)
    // 연도만 있으면 그 학년도의 학기만 후보로 보고, 그 학년도에 그 일정이 없으면 지금처럼 검색합니다.
    if (!candidates.length) return null;
    const upcoming = candidates.filter((c) => c.next).sort((a, b) => a.next.localeCompare(b.next));
    const tie = upcoming.length > 1 && upcoming[0].next === upcoming[1].next;
    if (!upcoming.length || tie) {
      return {
        clarify: true,
        topic: topic.key,
        alternatives: alternativesFor(q, null, candidates, null, today),
      };
    }
    chosen = upcoming[0].id;
  } else {
    // "1학기"처럼 학기만 있는데 끝나지 않은 그 학기를 못 찾음
    return { clarify: true, topic: topic.key, alternatives: alternativesFor(q, term.text, candidates, null, today) };
  }

  const rows = [...bySemester.get(chosen)].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
  const lines = rows.map(
    (i) => `[${CALENDAR_DOC_TITLE}] ${docLabel(chosen)} > ${fmt(i.startDate)}${i.endDate ? ` ~ ${fmt(i.endDate)}` : ""}: ${i.name}`,
  );
  const urls = [...new Set(rows.map((i) => i.sourceUrl))];
  return {
    clarify: false,
    topic: topic.key,
    semester: chosen,
    explicitYear: Boolean(term?.explicitYear),
    lines,
    doc: {
      id: `calendar:${chosen}:${topic.key}`,
      title: CALENDAR_DOC_TITLE,
      url: urls.length === 1 ? urls[0] : CALENDAR_PAGE,
      text: lines.join("\n"),
      method: "calendar",
    },
    termBasis: term?.explicitYear ? null : { semester: chosen, label: semesterLabel(chosen), labelEn: semesterLabel(chosen, "en") },
    alternatives: alternativesFor(q, term?.text ?? null, candidates, chosen, today),
  };
}
