/*
 * Vercel 서버 함수: 마감 임박 공지 (GET /api/deadlines)
 * shared/deadlines.js(팀이 직접 입력한 데이터)를 서버 시간 기준으로 계산해 돌려줍니다.
 * 학교 게시판을 크롤링하지 않습니다(robots.txt로 금지).
 *
 * checked(원문 대조 기록 on · by)가 없는 항목은 내보내지 않습니다. AI 초안(notice:draft)이 사람 확인 없이 Merge돼도 화면에 나오지 않게 하려는 장치입니다.
 *
 * 응답: { serverTime, items: [{ id, title, dept, category, startsAt, deadline, url, dday, status, checkedOn }] }
 */
import { DEADLINES } from "../shared/deadlines.js";
import { upcomingDeadlines } from "../shared/deadlineCalc.js";

// 사람이 원문과 대조했다는 기록이 있는지(날짜 형식 on + 확인한 사람 by)
export function isChecked(item) {
  return /^\d{4}-\d{2}-\d{2}$/.test(item.checked?.on ?? "") && Boolean(item.checked?.by);
}

export function toPublicDeadline(item) {
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
    checkedOn: item.checked?.on ?? null,
  };
}

export function buildResponse(items, nowMs) {
  const realOnly = items.filter((item) => !item.demo && isChecked(item));
  return {
    serverTime: new Date(nowMs).toISOString(),
    items: upcomingDeadlines(realOnly, nowMs).map(toPublicDeadline),
  };
}

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(buildResponse(DEADLINES, Date.now()));
}