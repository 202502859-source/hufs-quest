/*
 * Vercel 서버 함수: 마감 임박 공지 (GET /api/deadlines)
 * shared/deadlines.js(팀이 직접 입력한 데이터)를 서버 시간 기준으로 계산해 돌려줍니다.
 * 학교 게시판을 크롤링하지 않습니다(robots.txt로 금지).
 *
 * 응답: { serverTime, items: [{ id, title, dept, category, startsAt, deadline, url, dday, status, checkedOn }] }
 */
import { DEADLINES } from "../shared/deadlines.js";
import { upcomingDeadlines } from "../shared/deadlineCalc.js";

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
  const realOnly = items.filter((item) => !item.demo);
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