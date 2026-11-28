/*
 * Vercel 서버 함수: 퀘스트 완료 기록 및 보상 지급 (POST /api/quest-complete)
 * - 영구 퀘스트(REWARD_QUESTS): 퀘스트마다 한 번. 범위 밖(mockReg)은 400으로 거절합니다.
 * - 일일 퀘스트(DAILY_QUESTS, 11/27): "stampRally"는 오늘 스탬프 4곳, "dailyQuiz"는 오늘 정답 DAILY_QUIZ_GOAL개(11/27부터 5)를 서버가 직접 확인한 뒤
 *   완료 기록 id에 한국 날짜를 붙여("stampRally:2026-11-27") complete_quest를 부릅니다. 하루 한 번(같은 날 다시 부르면 already),
 *   다음 날 다시 받을 수 있습니다. 조건을 못 채웠으면 400.
 */
import { DAILY_QUESTS, DAILY_QUIZ_GOAL, QUEST_REWARD, REWARD_QUESTS, dailyQuestKey, dailyQuestReward, kstToday, levelFromTotalExp } from "../shared/progressRules.js";
import { rallyComplete } from "../shared/stampRally.js";
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
    const questId = body && typeof body.questId === "string" ? body.questId : null;
    const daily = questId !== null && DAILY_QUESTS.includes(questId);
    if (questId === null || (!daily && !REWARD_QUESTS.includes(questId))) {
      return res.status(400).json({ error: "unknown_quest" });
    }

    try {
      const now = deps.now ? deps.now() : new Date();
      let recordId = questId;
      let reward = QUEST_REWARD;
      if (daily) {
        // 화면이 "완료했다"고 보낸 것을 믿지 않고, 오늘 기록으로 조건을 다시 확인합니다.
        const before = await buildProgress(auth.supabase, auth.userId, auth.email, now);
        const met = questId === "stampRally" ? rallyComplete(before.daily.stamps) : before.daily.quizCorrect >= DAILY_QUIZ_GOAL;
        if (!met) return res.status(400).json({ error: "quest_not_ready" });
        recordId = dailyQuestKey(questId, kstToday(now));
        reward = dailyQuestReward(questId);
      }

      const beforeExp = await getCurrentTotalExp(auth.supabase, auth.userId);
      const beforeLevel = levelFromTotalExp(beforeExp).level;

      const { data, error } = await auth.supabase.rpc("complete_quest", {
        p_user_id: auth.userId,
        p_email: auth.email,
        p_quest_id: recordId,
        p_reward_exp: reward.exp,
        p_reward_points: reward.points,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
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
