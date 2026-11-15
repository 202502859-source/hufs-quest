import { DEADLINES } from "../../shared/deadlines.js";
import { upcomingDeadlines } from "../../shared/deadlineCalc.js";

const ENDPOINT = "/api/deadlines";
const TIMEOUT_MS = 8_000;
const REFRESH_MS = 5 * 60 * 1000;

/*
 * 마감 임박 공지를 서버(api/deadlines.js)에서 받아 옵니다.
 * npm run dev처럼 서버 함수가 없으면 shared/deadlines.js를 직접 읽어 브라우저 시간으로 같은 계산을 합니다(source: "device").
 */
export async function fetchDeadlines() {
  try {
    const response = await fetch(ENDPOINT, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !type.includes("json")) throw new Error(`deadlines ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.items) || !data.serverTime) throw new Error("bad response");
    return { ...data, source: "server" };
  } catch {
    const now = Date.now();
    return { serverTime: new Date(now).toISOString(), items: upcomingDeadlines(DEADLINES, now), source: "device" };
  }
}

// HUD 아이콘과 공지 창이 함께 쓰는 최신 결과입니다.
const listeners = new Set();
export const deadlineState = { data: null };

export function onDeadlinesChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function refreshDeadlines() {
  deadlineState.data = await fetchDeadlines();
  listeners.forEach((fn) => fn(deadlineState.data));
  return deadlineState.data;
}

// D-3 이하 항목 수(아이콘 배지에 표시)
export const urgentCount = () => (deadlineState.data?.items ?? []).filter((item) => item.dday <= 3).length;

let timer = null;
export function startDeadlineRefresh() {
  if (timer) return;
  refreshDeadlines();
  timer = setInterval(refreshDeadlines, REFRESH_MS);
}
