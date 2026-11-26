/*
 * 앱 안 행사 제보 입력 검사 (순수 함수, 서버 api/event-report.js와 2단계 화면이 함께 씁니다)
 * - 거절하면 어떤 칸(field)이 왜(code) 문제인지 코드만 돌려줍니다. 제보 내용은 돌려주지도, 로그에 남기지도 않습니다.
 * - 개인정보: 모든 글 칸(url 포함)에 전화번호 · 이메일 · 카카오 링크가 있으면 거절합니다.
 *   shared/eventCalc.js의 PHONE · EMAIL · KAKAO 규칙보다 엄격합니다(점 · 공백 · 붙여쓰기 · 전각 숫자 · +82까지).
 * - 날짜는 "+09:00"이 붙은 한국 시간 문자열만 받습니다.
 */
import { EVENT_CATEGORIES } from "./eventCalc.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$/;
const BUILDING_ID = /^[a-z0-9-]{1,40}$/;

export const REPORT_LIMITS = Object.freeze({
  title: 40,
  host: 30,
  place: 40,
  summary: 150,
  url: 300,
  pastDays: 1, // 시작 시각: 지금 - 1일부터
  futureDays: 14, // 지금 + 14일까지
  maxDurationDays: 7, // 끝 시각: 시작 이후 7일 이내
});

// 글 칸: [이름, 최대 글자 수, 필수]
const TEXT_FIELDS = [
  ["title", REPORT_LIMITS.title, true],
  ["host", REPORT_LIMITS.host, false],
  ["place", REPORT_LIMITS.place, true],
  ["summary", REPORT_LIMITS.summary, true],
];

// 숫자 사이 구분자로 쓰이는 문자(하이픈 · 대시 · 점 · 가운뎃점 · 공백 · 괄호 · 밑줄 · 슬래시는 날짜 때문에 제외)
const PHONE_SEPARATORS = /[\s\-‐‑‒–—―.·・_()]/g;
// 구분자를 지운 뒤의 전화번호 모양: 0으로 시작하는 9~11자리(010 · 02 · 031 · 070 …), +82 국제 표기, 15xx · 16xx · 18xx 대표번호
const PHONE_DIGITS = /(?:^|\D)(?:0\d{8,10}|82\d{9,10}|1[568]\d{6})(?!\d)/;
// eventCalc.js EMAIL보다 엄격: @ 앞뒤 공백 · 전각 @ · 점 앞뒤 공백도 잡음
const EMAIL_LIKE = /[\w.+-]+\s*[@＠]\s*[\w-]+(?:\s*\.\s*[\w-]+)+/i;
// eventCalc.js KAKAO + kakao.co.kr · 카카오 단축 주소
const KAKAO_TEXT = /kakao\.(?:com|co\.kr)|open\.kakao|pf\.kakao|kko\.to|kakaolink/i;
const KAKAO_HOST = /(^|\.)kakao\.com$|(^|\.)kakao\.co\.kr$|(^|\.)kko\.to$/;

const length = (s) => [...s].length;

// 글 하나에 연락처 · 카카오 링크가 있으면 그 코드("phone" · "email" · "kakao"), 없으면 null.
// api/events.js도 DB에서 읽은 묶음을 내보내기 전에 한 번 더 씁니다.
export function contactProblem(text) {
  if (typeof text !== "string" || !text) return null;
  const normalized = text.normalize("NFKC");
  if (PHONE_DIGITS.test(normalized.replace(PHONE_SEPARATORS, ""))) return "phone";
  if (EMAIL_LIKE.test(normalized)) return "email";
  if (KAKAO_TEXT.test(normalized)) return "kakao";
  return null;
}

// 원문 · 근거 주소 검사(https://만, 계정 정보 · 카카오 금지). 문제 코드 또는 null. 지도 신고(shared/mapReport.js)도 씁니다.
export function urlProblem(raw) {
  if (length(raw) > REPORT_LIMITS.url) return "too_long";
  let url;
  try {
    url = new URL(raw);
  } catch {
    return "format";
  }
  if (url.protocol !== "https:" || !raw.startsWith("https://")) return "https_only";
  if (url.username || url.password) return "format";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!host.includes(".")) return "format";
  if (KAKAO_HOST.test(host)) return "kakao";
  return null;
}

/*
 * 제보 입력 검사.
 *   input: { title, host?, place, summary, startsAt, endsAt, category, buildingId?, url? }
 *   options.nowMs: 지금 시각(ms)
 *   options.buildingIds: 있으면 buildingId가 이 목록(src/data/buildingInfo.js 키)에 있어야 함
 * 돌려주는 값
 *   통과: { ok: true, value: { title, host, place, summary, startsAt, endsAt, category, buildingId, url } } — 앞뒤 공백만 지운 원문, 빈 선택 칸은 null
 *   거절: { ok: false, problems: [{ field, code }] }
 *     code: required(빈 칸) · type(글자가 아님) · too_long · phone · email · kakao · format · range · https_only · unknown
 */
export function validateEventReport(input, { nowMs = Date.now(), buildingIds = null } = {}) {
  const problems = [];
  const add = (field, code) => problems.push({ field, code });
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, problems: [{ field: "body", code: "type" }] };

  const value = {};
  for (const [field, max, required] of TEXT_FIELDS) {
    const raw = input[field];
    if (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim())) {
      if (required) add(field, "required");
      value[field] = null;
      continue;
    }
    if (typeof raw !== "string") {
      add(field, "type");
      continue;
    }
    const text = raw.trim();
    if (length(text) > max) add(field, "too_long");
    const contact = contactProblem(text);
    if (contact) add(field, contact);
    value[field] = text;
  }

  // 분류
  if (!EVENT_CATEGORIES.includes(input.category)) add("category", input.category ? "unknown" : "required");
  else value.category = input.category;

  // 시각
  const startsAt = typeof input.startsAt === "string" ? input.startsAt.trim() : "";
  const endsAt = typeof input.endsAt === "string" ? input.endsAt.trim() : "";
  const start = KST_TIME.test(startsAt) ? Date.parse(startsAt) : NaN;
  const end = KST_TIME.test(endsAt) ? Date.parse(endsAt) : NaN;
  if (!startsAt) add("startsAt", "required");
  else if (!Number.isFinite(start)) add("startsAt", "format");
  else if (start < nowMs - REPORT_LIMITS.pastDays * DAY_MS || start > nowMs + REPORT_LIMITS.futureDays * DAY_MS) add("startsAt", "range");
  if (!endsAt) add("endsAt", "required");
  else if (!Number.isFinite(end)) add("endsAt", "format");
  else if (Number.isFinite(start) && (end < start || end - start > REPORT_LIMITS.maxDurationDays * DAY_MS)) add("endsAt", "range");
  value.startsAt = startsAt;
  value.endsAt = endsAt;

  // 건물(선택)
  const buildingId = input.buildingId;
  if (buildingId === undefined || buildingId === null || buildingId === "") value.buildingId = null;
  else if (typeof buildingId !== "string" || !BUILDING_ID.test(buildingId)) add("buildingId", "format");
  else if (buildingIds && !buildingIds.includes(buildingId)) add("buildingId", "unknown");
  else value.buildingId = buildingId;

  // 원문 주소(선택): https://만, 카카오 금지, 전화번호 · 이메일 금지
  const url = typeof input.url === "string" ? input.url.trim() : input.url;
  if (url === undefined || url === null || url === "") value.url = null;
  else if (typeof url !== "string") add("url", "type");
  else {
    const urlCode = urlProblem(url) ?? contactProblem(url);
    if (urlCode) add("url", urlCode);
    else value.url = url;
  }

  if (problems.length) return { ok: false, problems };
  return { ok: true, value };
}
