// Vercel 서버 함수: 마감 임박 공지 (GET /api/deadlines)
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

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const now = Date.now();
  res.setHeader("Cache-Control", "no-store");
  const realOnly = DEADLINES.filter((item) => !item.demo);
  return res.status(200).json({
    serverTime: new Date(now).toISOString(),
    items: upcomingDeadlines(realOnly, now).map(toPublicDeadline),
  });
}
