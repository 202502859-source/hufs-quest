/*
 * Vercel 서버 함수: 퀴즈 답 기록 및 경험치 지급 (POST /api/quiz-answer)
 * - 요청: { questionId, choice } (choice: true = O, false = X)
 * - 정답 여부·중복 지급·한국 시간 일일 상한(50)은 서버와 DB 함수(record_quiz_answer)가 판단합니다.
 */
import { QUIZ } from "../src/data/quiz.js";
import { QUIZ_DAILY_CAP, QUIZ_REWARD_EXP, levelFromTotalExp } from "../shared/progressRules.js";
import { authenticateStudent, buildProgress, getCurrentTotalExp, readJsonBody } from "./_lib/progressServer.js";

const ANSWER_MAP = new Map(QUIZ.map((q) => [q.id, q.answer]));

export function createQuizAnswerHandler(deps = {}) {
  const answers = deps.answerMap ?? ANSWER_MAP;

  return async function handler(req, res) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "POST only" });
    }

    const auth = await authenticateStudent(req, res, deps);
    if (!auth) return;

    const body = await readJsonBody(req);
    if (!body || typeof body.questionId !== "string" || typeof body.choice !== "boolean" || !answers.has(body.questionId)) {
      return res.status(400).json({ error: "invalid_quiz_answer" });
    }

    const correct = body.choice === answers.get(body.questionId);

    try {
      const beforeExp = await getCurrentTotalExp(auth.supabase, auth.userId);
      const beforeLevel = levelFromTotalExp(beforeExp).level;

      const { data, error } = await auth.supabase.rpc("record_quiz_answer", {
        p_user_id: auth.userId,
        p_email: auth.email,
        p_question_id: body.questionId,
        p_correct: correct,
        p_reward_exp: QUIZ_REWARD_EXP,
        p_daily_cap: QUIZ_DAILY_CAP,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const now = deps.now ? deps.now() : new Date();
      const progress = await buildProgress(auth.supabase, auth.userId, auth.email, now);
      const leveledUp = progress.level > beforeLevel;

      return res.status(200).json({
        result: row?.result ?? "wrong",
        correct,
        gained: { exp: Number(row?.gained_exp ?? 0), points: 0 },
        leveledUp,
        progress,
      });
    } catch {
      return res.status(500).json({ error: "quiz_save_failed" });
    }
  };
}

export default createQuizAnswerHandler();