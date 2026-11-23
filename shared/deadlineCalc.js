/*
 * 마감 임박 공지 계산 (서버 api/deadlines.js와 브라우저가 함께 씁니다)
 * 모든 날짜는 한국 시간(UTC+9, 서머타임 없음) 기준으로 계산합니다.
 */
export const WINDOW_DAYS = 14;
export const THIS_WEEK_DAYS = 7;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_HOUR_KST = 17;

// 시각(ms)을 한국 날짜로 바꿔 줍니다. { y, m(0~11), d, hh, mm, weekday(0=일) }
export function kstParts(ms) {
  const k = new Date(ms + KST_OFFSET_MS);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth(), d: k.getUTCDate(), hh: k.getUTCHours(), mm: k.getUTCMinutes(), weekday: k.getUTCDay() };
}

// 한국 날짜의 일련번호입니다. 두 날짜의 차이가 곧 남은 날짜 수가 됩니다.
function kstDayNumber(ms) {
  const { y, m, d } = kstParts(ms);
  return Date.UTC(y, m, d) / DAY_MS;
}

// demo 항목: 오늘(한국 날짜)로부터 daysFromNow일 뒤 17:00(한국 시간)
export function demoDeadline(daysFromNow, nowMs) {
  const { y, m, d } = kstParts(nowMs);
  return Date.UTC(y, m, d + daysFromNow, DEMO_HOUR_KST) - KST_OFFSET_MS;
}

// 한국 날짜 기준 남은 날짜. 오늘 마감이면 0입니다.
export function dday(deadlineMs, nowMs) {
  return kstDayNumber(deadlineMs) - kstDayNumber(nowMs);
}

// 접수 시작 시각(startsAt)이 현재보다 뒤면 "upcoming"(접수 예정), 아니면 "open"입니다.
export function deadlineStatus(item, nowMs) {
  if (!item.startsAt) return "open";
  const startMs = Date.parse(item.startsAt);
  return Number.isFinite(startMs) && startMs > nowMs ? "upcoming" : "open";
}

// 마감이 지나지 않았고 14일 이내(D-14 이하)인 항목만, 마감에 가까운 순으로 돌려줍니다.
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

// 분류 필터("all" 또는 category 값)에 맞는 공지만 골라 줍니다.
export function filterDeadlinesByCategory(items, category = "all") {
  if (!category || category === "all") return items;
  return items.filter((item) => item.category === category);
}

// 공지 목록을 이번 주 마감(D-7 이내)과 다가오는 공지(D-8~D-14) 두 묶음으로 나눕니다.
export function splitDeadlineGroups(items) {
  return {
    thisWeek: items.filter((item) => item.dday <= THIS_WEEK_DAYS),
    upcoming: items.filter((item) => item.dday > THIS_WEEK_DAYS),
  };
}