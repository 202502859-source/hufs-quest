import { DEADLINES, DEMO_DEADLINES } from "../../shared/deadlines.js";
import { upcomingDeadlines } from "../../shared/deadlineCalc.js";

const ENDPOINT = "/api/deadlines";
const TIMEOUT_MS = 8_000;
const REFRESH_MS = 5 * 60 * 1000;

function hasDemoFlag() {
  try {
    return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demoDeadlines") === "1";
  } catch {
    return false;
  }
}

function toClientItem(item) {
  return {
    id: item.id,
    title: item.title,
    dept: item.dept,
    category: item.category,
    startsAt: item.startsAt ?? null,
    deadline: item.deadline,
    url: item.url,
    dday: item.dday,
    status: item.status,
    checkedOn: item.checkedOn ?? item.checked?.on ?? null,
    ...(item.demo ? { demo: true } : {}),
  };
}

function appendDemoIfRequested(items, nowMs) {
  if (!hasDemoFlag()) return items;
  const demoItems = upcomingDeadlines(DEMO_DEADLINES, nowMs).map(toClientItem);
  return [...items, ...demoItems].sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline));
}

export async function fetchDeadlines() {
  try {
    const response = await fetch(ENDPOINT, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !type.includes("json")) throw new Error(`deadlines ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.items) || !data.serverTime) throw new Error("bad response");
    const now = Date.parse(data.serverTime) || Date.now();
    return { ...data, items: appendDemoIfRequested(data.items, now), source: "server" };
  } catch {
    const now = Date.now();
    const items = upcomingDeadlines(DEADLINES, now).map(toClientItem);
    return { serverTime: new Date(now).toISOString(), items: appendDemoIfRequested(items, now), source: "device" };
  }
}

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

export const urgentCount = () => (deadlineState.data?.items ?? []).filter((item) => item.dday <= 3).length;

let timer = null;
export function startDeadlineRefresh() {
  if (timer) return;
  refreshDeadlines();
  timer = setInterval(refreshDeadlines, REFRESH_MS);
}
