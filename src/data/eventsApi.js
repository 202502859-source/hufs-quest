import { EVENTS } from "../../shared/events.js";
import { activeEventCount, upcomingEvents } from "../../shared/eventCalc.js";
import { kstParts } from "../../shared/deadlineCalc.js";

const ENDPOINT = "/api/events";
const TIMEOUT_MS = 8_000;
const REFRESH_MS = 5 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
// 행사가 없을 때 안내하는 학교 홈페이지 공지 게시판("공지안내", 2026-11-24 확인)
export const SCHOOL_NOTICE_URL = "https://www.hufs.ac.kr/hufs/11281/subview.do";

/*
 * 학교 행사를 서버(api/events.js)에서 받아 옵니다.
 * npm run dev처럼 서버 함수가 없으면 shared/events.js를 직접 읽어 기기 시간으로 같은 계산을 합니다(source: "device").
 */
export async function fetchEvents() {
  let data;
  try {
    const response = await fetch(ENDPOINT, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !type.includes("json")) throw new Error(`events ${response.status}`);
    data = await response.json();
    if (!Array.isArray(data.items) || !data.serverTime) throw new Error("bad response");
    data = { ...data, source: "server" };
  } catch {
    const now = Date.now();
    data = { serverTime: new Date(now).toISOString(), items: upcomingEvents(EVENTS, now), source: "device" };
  }
  // [예시]는 주소에 ?demoEvents=1이 있을 때만 화면에서 덧붙입니다(서버 응답 · 기본 화면에는 섞지 않음).
  if (demoEventsEnabled()) data = { ...data, items: [...data.items, ...upcomingEvents(demoEvents(Date.parse(data.serverTime)), Date.parse(data.serverTime))] };
  return data;
}

export const demoEventsEnabled = (search = typeof location === "undefined" ? "" : location.search) =>
  new URLSearchParams(search).get("demoEvents") === "1";

// 화면 확인용 예시 행사(실제 행사 아님). 오늘 기준 상대 날짜로 만들고 제목에 [예시]를 붙입니다.
export function demoEvents(nowMs) {
  const { y, m, d } = kstParts(nowMs);
  // 한국 날짜 기준 days일 뒤 hour시(한국 시간)를 "+09:00" 문자열로
  const at = (days, hour) => `${new Date(Date.UTC(y, m, d + days, hour)).toISOString().slice(0, 13)}:00:00+09:00`;
  const base = { sourceType: "school", url: SCHOOL_NOTICE_URL, checked: { on: new Date(nowMs + KST_OFFSET_MS).toISOString().slice(0, 10), by: "예시" }, demo: true };
  return [
    {
      ...base,
      id: "demo-now",
      title: { ko: "[예시] 진행 중인 행사", en: "[Example] Ongoing event" },
      host: { ko: "[예시] 주최 부서", en: "[Example] Host office" },
      summary: { ko: "화면 확인용 예시입니다. 실제 행사가 아니에요.", en: "A sample for checking the screen. Not a real event." },
      startsAt: at(-1, 0),
      endsAt: at(2, 23),
      place: { ko: "도서관", en: "Library" },
      buildingId: "library",
      category: "other",
    },
    {
      ...base,
      id: "demo-today",
      title: { ko: "[예시] 오늘 시작하는 설명회", en: "[Example] Briefing starting today" },
      host: { ko: "[예시] 학과 학생회", en: "[Example] Department student council" },
      summary: { ko: "화면 확인용 예시입니다. 실제 행사가 아니에요.", en: "A sample for checking the screen. Not a real event." },
      startsAt: at(0, 22),
      endsAt: at(0, 23),
      place: { ko: "사이버관", en: "Cyber Building" },
      buildingId: "cyber",
      category: "briefing",
      note: { ko: "예시 비고", en: "Sample note" },
    },
    {
      ...base,
      id: "demo-later",
      sourceType: "host",
      url: undefined,
      hostConsent: { on: base.checked.on },
      title: { ko: "[예시] 다음 주 특강", en: "[Example] Lecture next week" },
      host: { ko: "[예시] 주최 측", en: "[Example] Organizer" },
      summary: { ko: "화면 확인용 예시입니다. 실제 행사가 아니에요.", en: "A sample for checking the screen. Not a real event." },
      startsAt: at(7, 6),
      endsAt: at(7, 8),
      place: { ko: "본관", en: "Main Hall" },
      buildingId: "main",
      category: "lecture",
    },
  ];
}

// HUD 버튼과 행사 창이 함께 쓰는 최신 결과입니다.
const listeners = new Set();
export const eventState = { data: null };

export function onEventsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function refreshEvents() {
  eventState.data = await fetchEvents();
  listeners.forEach((fn) => fn(eventState.data));
  return eventState.data;
}

// 오늘 시작하거나 진행 중인 행사 수(버튼 배지)
export const eventBadgeCount = () => activeEventCount(eventState.data?.items ?? []);

let timer = null;
export function startEventRefresh() {
  if (timer) return;
  refreshEvents();
  timer = setInterval(refreshEvents, REFRESH_MS);
}
