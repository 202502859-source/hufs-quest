/*
 * Vercel 서버 함수: 퀘스트 완료 기록 및 보상 지급 (POST /api/quest-complete)
 * - 허용된 퀘스트 목록(REWARD_QUESTS)만 인정하며, 범위 밖(mockReg)은 400으로 거절합니다.
 */
import { QUEST_REWARD, REWARD_QUESTS, levelFromTotalExp } from "../shared/progressRules.js";
import { authenticateStudent, logServerError, buildProgress, getCurrentTotalExp, readJsonBody } from "./_lib/progressServer.js";

export function createQuestCompleteHandler(deps = {}) {
  return async function handler(req, res) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "POST only" });
    }

    const auth = await authenticateStudent(req, res, deps);
    if (!auth) return;

    const body = await readJsonBody(req);
    if (!body || typeof body.questId !== "string" || !REWARD_QUESTS.includes(body.questId)) {
      return res.status(400).json({ error: "unknown_quest" });
    }

    try {
      const beforeExp = await getCurrentTotalExp(auth.supabase, auth.userId);
      const beforeLevel = levelFromTotalExp(beforeExp).level;

      const { data, error } = await auth.supabase.rpc("complete_quest", {
        p_user_id: auth.userId,
        p_email: auth.email,
        p_quest_id: body.questId,
        p_reward_exp: QUEST_REWARD.exp,
        p_reward_points: QUEST_REWARD.points,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const now = deps.now ? deps.now() : new Date();
      const progress = await buildProgress(auth.supabase, auth.userId, auth.email, now);
      const leveledUp = progress.level > beforeLevel;

      return res.status(200).json({
        result: row?.result ?? "already",
        gained: {
          exp: Number(row?.gained_exp ?? 0),
          points: Number(row?.gained_points ?? 0),
        },
        leveledUp,
        progress,
      });
    } catch (error) {
      logServerError("quest-complete", error);
      return res.status(500).json({ error: "quest_save_failed" });
    }
  };
}

export default createQuestCompleteHandler();