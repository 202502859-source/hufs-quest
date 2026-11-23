/*
 * 학교 행사 계산 · 형식 규칙 (서버 api/events.js와 브라우저가 함께 씁니다)
 * 모든 날짜는 한국 시간(UTC+9, 서머타임 없음) 기준입니다. deadlineCalc.js와 같은 방식입니다.
 */
import { kstParts } from "./deadlineCalc.js";

export const EVENT_WINDOW_DAYS = 14;
export const EVENT_CATEGORIES = ["festival", "briefing", "lecture", "recruit", "other"];
export const SOURCE_TYPES = ["school", "sns", "host"];
// 공식 공개 SNS로 인정하는 주소(계정이 공식인지는 사람이 확인합니다)
export const SNS_HOSTS = ["instagram.com", "facebook.com", "youtube.com", "x.com", "twitter.com", "blog.naver.com", "threads.net"];

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /\d{2,4}-\d{3,4}-\d{4}/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const KAKAO = /(^|\.)kakao\.com$|(^|\.)kakao\.co\.kr$/;

const kstDay = (ms) => {
  const { y, m, d } = kstParts(ms);
  return Date.UTC(y, m, d) / DAY_MS;
};
const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};
const sameOrSub = (host, base) => host === base || host.endsWith(`.${base}`);

// 행사 상태: ended(끝남) · ongoing(진행 중) · today(오늘 시작) · upcoming(14일 안 시작) · later(그 뒤)
export function eventStatus(item, nowMs) {
  const start = Date.parse(item.startsAt);
  const end = Date.parse(item.endsAt ?? item.startsAt);
  if (end < nowMs) return "ended";
  if (start <= nowMs) return "ongoing";
  const days = kstDay(start) - kstDay(nowMs);
  if (days === 0) return "today";
  return days <= EVENT_WINDOW_DAYS ? "upcoming" : "later";
}

// 지금 진행 중이거나 오늘부터 14일 안에 시작하는 행사만, 시작 시각 순으로. 확인한 사람(checked.by) · 허락 기록은 내보내지 않습니다.
export function upcomingEvents(items, nowMs) {
  return items
    .map((item) => ({ item, status: eventStatus(item, nowMs) }))
    .filter(({ status }) => status === "ongoing" || status === "today" || status === "upcoming")
    .sort((a, b) => Date.parse(a.item.startsAt) - Date.parse(b.item.startsAt))
    .map(({ item, status }) => {
      const { checked, hostConsent, ...rest } = item;
      return { ...rest, checkedOn: checked?.on ?? null, status };
    });
}

// HUD 행사 버튼 배지: 오늘 시작하거나 진행 중인 행사 수
export const activeEventCount = (items) => items.filter((e) => e.status === "ongoing" || e.status === "today").length;

const bilingual = (v) => v && typeof v.ko === "string" && v.ko.trim() && typeof v.en === "string" && v.en.trim();

// 한 항목의 형식 · 출처 규칙 위반을 문장 목록으로 돌려줍니다(없으면 []).
export function eventProblems(e) {
  const p = [];
  if (typeof e.id !== "string" || !/^[a-z0-9-]+$/.test(e.id)) p.push("id: 영문 소문자 · 숫자 · - 만");
  for (const key of ["title", "host", "summary", "place"]) if (!bilingual(e[key])) p.push(`${key}: 한국어 · 영어 필요`);
  for (const key of ["target", "signup", "note"]) if (e[key] !== undefined && !bilingual(e[key])) p.push(`${key}: 쓰면 한국어 · 영어 둘 다`);
  if (!KST_TIME.test(e.startsAt ?? "")) p.push("startsAt: +09:00 형식");
  if (!KST_TIME.test(e.endsAt ?? "")) p.push("endsAt: +09:00 형식");
  if (Date.parse(e.endsAt) < Date.parse(e.startsAt)) p.push("endsAt이 startsAt보다 빠름");
  if (!EVENT_CATEGORIES.includes(e.category)) p.push(`category: ${EVENT_CATEGORIES.join(" · ")} 중 하나`);
  if (!SOURCE_TYPES.includes(e.sourceType)) p.push(`sourceType: ${SOURCE_TYPES.join(" · ")} 중 하나`);
  if (!e.checked || !DATE.test(e.checked.on ?? "") || typeof e.checked.by !== "string" || !e.checked.by.trim()) p.push("checked: { on: YYYY-MM-DD, by } 필요");

  const host = e.url === undefined ? null : hostOf(e.url);
  if (e.url !== undefined && (!host || !e.url.startsWith("https://"))) p.push("url: https:// 주소");
  if (e.sourceType === "school" && !(host && sameOrSub(host, "hufs.ac.kr"))) p.push("school: url은 학교 · 학과 홈페이지(*.hufs.ac.kr)");
  if (e.sourceType === "sns" && !(host && SNS_HOSTS.some((h) => sameOrSub(host, h)))) p.push("sns: url은 공식 공개 SNS 게시물 주소");
  if (e.sourceType === "host" && !(e.hostConsent && DATE.test(e.hostConsent.on ?? ""))) p.push("host: hostConsent.on(주최 측 허락 날짜) 필요");
  if (host && KAKAO.test(host)) p.push("url: 카카오 · 오픈채팅 링크 금지");

  const text = JSON.stringify({ ...e, checked: { on: e.checked?.on } });
  if (PHONE.test(text)) p.push("전화번호 형식이 들어 있음");
  if (EMAIL.test(text)) p.push("이메일 주소가 들어 있음");
  if (/open\.kakao|pf\.kakao|kakao\.com/i.test(text)) p.push("카카오 · 오픈채팅 링크가 들어 있음");
  return p;
}
