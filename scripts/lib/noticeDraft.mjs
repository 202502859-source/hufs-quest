/*
 * 공지 초안 → shared/deadlines.js 항목 (작업지시서 11/26 작업 1의 notice:draft)
 * scripts/notice-draft.mjs가 부르는 순수 함수 모음. 추출 자체는 공지 추출 도우미(scripts/extract-notice.mjs)가 합니다.
 * 도우미가 HCX-007로 바뀌어도 출력의 "=== … ===" 구획만 같으면 이 파일은 그대로 씁니다.
 *
 * 원칙: AI 초안은 초안일 뿐. checked는 항상 비워 둡니다(사람이 원문과 대조한 뒤에만 채움).
 */

// 도우미 출력에서 "=== 제목 ===" 다음에 오는 JSON 덩어리를 꺼냅니다.
function jsonAfterHeading(output, heading) {
  const start = output.indexOf(`=== ${heading} ===`);
  if (start < 0) return null;
  const open = output.indexOf("{", start);
  if (open < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = open; i < output.length; i++) {
    const ch = output[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return JSON.parse(output.slice(open, i + 1));
  }
  return null;
}

/** 도우미 표준 출력 → { draft, evidence } (못 찾으면 오류) */
export function parseExtractOutput(output) {
  const draft = jsonAfterHeading(output, "shared/deadlines.js 입력용 초안");
  const result = jsonAfterHeading(output, "공지 추출 JSON 초안");
  if (!draft) throw new Error("도우미 출력에서 'shared/deadlines.js 입력용 초안'을 찾지 못했습니다.");
  return { draft, evidence: result?.evidence ?? {} };
}

/** 원문 주소 → { site, boardNo, postId } (학교 공지 본문 주소 모양만) */
export function parseArticleUrl(url) {
  const u = new URL(url);
  if (u.protocol !== "https:" || !/(^|\.)hufs\.ac\.kr$/.test(u.hostname)) {
    throw new Error("한국외국어대학교 공식 HTTPS 주소만 쓸 수 있습니다.");
  }
  const m = u.pathname.match(/^\/bbs\/([a-z]+)\/(\d+)\/(\d+)\/artclView\.do$/);
  if (!m) throw new Error("공지 원문 주소 모양이 아닙니다(…/bbs/사이트/게시판/글번호/artclView.do).");
  return { site: m[1], boardNo: m[2], postId: m[3], url: `https://${u.hostname}${u.pathname}` };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$/;
const CATEGORIES = ["academic", "scholarship", "campus", "external"];

/**
 * 초안 → deadlines.js 항목. 근거 검사를 통과한(값이 있는) 칸만 넣고, 비어 있는 칸은 problems에 적습니다.
 * checked는 넣지 않습니다(테스트가 빨간불이 되어 사람 확인 없이 Merge되지 않음).
 */
export function buildDeadlineEntry(draft, articleUrl) {
  const { postId, url } = parseArticleUrl(articleUrl);
  const problems = [];
  const titleKo = draft?.title?.ko?.trim() ?? "";
  const deptKo = draft?.dept?.ko?.trim() ?? "";
  const category = CATEGORIES.includes(draft?.category) ? draft.category : "";
  const deadline = DATE_RE.test(draft?.deadline ?? "") ? draft.deadline : "";
  const startsAt = DATE_RE.test(draft?.startsAt ?? "") ? draft.startsAt : null;

  if (!titleKo) problems.push("제목(ko) 없음");
  if (!deptKo) problems.push("부서(ko) 없음");
  if (!category) problems.push("분류 없음");
  if (!deadline) problems.push("마감 일시 없음 — 원문에서 직접 확인");
  if (startsAt && deadline && startsAt >= deadline) problems.push("시작이 마감보다 늦음 — 원문 확인");
  problems.push("영문 제목 · 부서(en) 비어 있음 — 대조할 때 채우기");
  problems.push("checked 비어 있음 — 원문 대조 뒤 { on, by } 채우기");

  const entry = {
    id: `notice-${postId}`,
    title: { ko: titleKo, en: "" },
    dept: { ko: deptKo, en: "" },
    category,
    ...(startsAt ? { startsAt } : {}),
    deadline,
    url,
  };
  return { entry, problems };
}

const q = (s) => JSON.stringify(s);

/** 항목 → deadlines.js 모양의 코드 조각(들여쓰기 2칸, checked 자리는 주석으로 표시) */
export function formatEntry(entry) {
  return [
    "  {",
    `    id: ${q(entry.id)},`,
    "    title: {",
    `      ko: ${q(entry.title.ko)},`,
    `      en: ${q(entry.title.en)},`,
    "    },",
    `    dept: { ko: ${q(entry.dept.ko)}, en: ${q(entry.dept.en)} },`,
    `    category: ${q(entry.category)},`,
    ...(entry.startsAt ? [`    startsAt: ${q(entry.startsAt)},`] : []),
    `    deadline: ${q(entry.deadline)},`,
    `    url: ${q(entry.url)},`,
    "    // AI 초안(notice:draft). 원문 대조 뒤 아래 줄을 채우세요: checked: { on: \"YYYY-MM-DD\", by: \"임현규\" },",
    "  },",
  ].join("\n");
}

/** deadlines.js 원본에 항목을 DEADLINES 배열 끝에 넣은 새 원본. 같은 원문 주소가 이미 있으면 오류. */
export function insertDeadline(source, entry) {
  if (source.includes(`url: ${q(entry.url)}`)) throw new Error(`이미 들어 있는 공지입니다: ${entry.url}`);
  if (source.includes(`id: ${q(entry.id)}`)) throw new Error(`id가 겹칩니다: ${entry.id}`);
  const start = source.indexOf("export const DEADLINES = [");
  if (start < 0) throw new Error("shared/deadlines.js에서 DEADLINES 배열을 찾지 못했습니다.");
  const end = source.indexOf("\n];", start);
  if (end < 0) throw new Error("DEADLINES 배열 끝을 찾지 못했습니다.");
  return `${source.slice(0, end)}\n${formatEntry(entry)}${source.slice(end)}`;
}

/** 원문 근거 문장 ↔ 입력값 비교표(마크다운). 사람이 이 표를 보고 원문과 하나씩 대조합니다. */
export function comparisonTable(entry, evidence = {}) {
  const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim() || "(없음)";
  const rows = [
    ["제목", entry.title.ko, evidence.title],
    ["부서", entry.dept.ko, evidence.dept],
    ["분류", entry.category, evidence.category],
    ["시작", entry.startsAt ?? "", evidence.startsAt],
    ["마감", entry.deadline, evidence.deadline],
    ["원문 주소", entry.url, ""],
  ];
  return [
    "| 칸 | 입력값(AI 초안) | 원문 근거 문장 | 대조 |",
    "| --- | --- | --- | --- |",
    ...rows.map(([k, v, e]) => `| ${k} | ${cell(v)} | ${cell(e)} | [ ] |`),
  ].join("\n");
}
