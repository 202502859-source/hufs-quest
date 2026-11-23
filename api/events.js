/*
 * Vercel 서버 함수: 학교 행사 (GET /api/events)
 * shared/events.js(팀이 원문을 보고 직접 입력한 데이터)를 서버 시간 기준으로 골라 돌려줍니다.
 * 게시판 · SNS를 수집하지 않습니다. 확인한 사람(checked.by) · 주최 측 허락 기록은 응답에 넣지 않습니다.
 * [예시] 행사는 화면에서 ?demoEvents=1일 때만 만들며, 이 응답에는 절대 섞지 않습니다.
 *
 * 응답: { serverTime, items: [{ id, title, host, summary, startsAt, endsAt, place, buildingId?, target?, signup?,
 *        category, sourceType, url?, note?, checkedOn, status }] }
 */
import { EVENTS } from "../shared/events.js";
import { upcomingEvents } from "../shared/eventCalc.js";

export function eventsResponse(events, nowMs) {
  return { serverTime: new Date(nowMs).toISOString(), items: upcomingEvents(events, nowMs) };
}

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(eventsResponse(EVENTS, Date.now()));
}
