/*
 * Vercel 서버 함수: 하루 첫 접속(출석) 포인트 지급 (POST /api/check-in)
 * - 한국 시간(Asia/Seoul) 자정 기준 하루 1회만 포인트 5 지급
 */
import { CHECKIN_POINTS } from "../shared/progressRules.js";
import { authenticateStudent, buildProgress } from "./_lib/progressServer.js";

export function createCheckInHandler(deps = {}) {
  return async function handler(req, res) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "POST only" });
    }

    const auth = await authenticateStudent(req, res, deps);
    if (!auth) return;

    try {
      const { data, error } = await auth.supabase.rpc("daily_check_in", {
        p_user_id: auth.userId,
        p_email: auth.email,
        p_reward_points: CHECKIN_POINTS,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const now = deps.now ? deps.now() : new Date();
      const progress = await buildProgress(auth.supabase, auth.userId, auth.email, now);

      return res.status(200).json({
        result: row?.result ?? "already",
        gained: {
          exp: 0,
          points: Number(row?.gained_points ?? 0),
        },
        progress,
      });
    } catch {
      return res.status(500).json({ error: "checkin_save_failed" });
    }
  };
}

export default createCheckInHandler();