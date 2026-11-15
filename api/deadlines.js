/*
 * Vercel 서버 함수: 마감 임박 공지 (GET /api/deadlines)
 * shared/deadlines.js(팀이 직접 입력한 데이터)를 서버 시간 기준으로 계산해 돌려줍니다.
 * 학교 게시판을 크롤링하지 않습니다(robots.txt로 금지).
 *
 * 응답: { serverTime, items: [{ id, title, dept, category, deadline, url, demo, dday }] }
 */
import { DEADLINES } from "../shared/deadlines.js";
import { upcomingDeadlines } from "../shared/deadlineCalc.js";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const now = Date.now();
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    serverTime: new Date(now).toISOString(),
    items: upcomingDeadlines(DEADLINES, now),
  });
}
