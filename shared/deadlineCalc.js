// 마감 임박 공지 계산 (서버 api/deadlines.js와 브라우저가 함께 씁니다)
export const WINDOW_DAYS = 14;
export const THIS_WEEK_DAYS = 7;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_HOUR_KST = 17;

export function kstParts(ms) {
  const k = new Date(ms + KST_OFFSET_MS);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth(), d: k.getUTCDate(), hh: k.getUTCHours(), mm: k.getUTCMinutes(), weekday: k.getUTCDay() };
}

function kstDayNumber(ms) {
  const { y, m, d } = kstParts(ms);
  return Date.UTC(y, m, d) / DAY_MS;
}

export function demoDeadline(daysFromNow, nowMs) {
  const { y, m, d } = kstParts(nowMs);
  return Date.UTC(y, m, d + daysFromNow, DEMO_HOUR_KST) - KST_OFFSET_MS;
}

export function dday(deadlineMs, nowMs) {
  return kstDayNumber(deadlineMs) - kstDayNumber(nowMs);
}

export function deadlineStatus(item, nowMs) {
  if (!item.startsAt) return "open";
  const startMs = Date.parse(item.startsAt);
  return Number.isFinite(startMs) && startMs > nowMs ? "upcoming" : "open";
}

export function upcomingDeadlines(items, nowMs) {
  return items
    .map(({ daysFromNow, ...item }) => {
      const deadlineMs = item.demo ? demoDeadline(daysFromNow ?? 0, nowMs) : Date.parse(item.deadline);
      return {
        ...item,
        deadline: new Date(deadlineMs).toISOString(),
        deadlineMs,
        dday: dday(deadlineMs, nowMs),
        status: deadlineStatus(item, nowMs),
      };
    })
    .filter((item) => Number.isFinite(item.deadlineMs) && item.deadlineMs > nowMs && item.dday <= WINDOW_DAYS)
    .sort((a, b) => a.deadlineMs - b.deadlineMs)
    .map(({ deadlineMs, ...item }) => item);
}
