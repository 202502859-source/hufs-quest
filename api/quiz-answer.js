/*
 * Vercel 서버 함수: 퀴즈 답 기록 및 경험치 지급 (POST /api/quiz-answer)
 * - O/X 퀴즈 요청: { questionId, choice } (choice: true = O, false = X)
 *   정답 여부·중복 지급·한국 시간 일일 상한(100)은 서버와 DB 함수(record_quiz_answer)가 판단합니다.
 * - 스탬프 랠리 부스 요청(11/27): { kind: "booth", buildingId, choiceIndex }
 *   서버가 shared/stampRally.js로 오늘(한국 날짜)의 문제를 다시 골라 채점합니다. 정답이면 reward_log에
 *   source 'stamp', ref_id "YYYY-MM-DD:<buildingId>", exp 0으로 기록합니다(같은 날 같은 부스는 UNIQUE 조건으로 한 번만).
 *   스탬프는 경험치를 주지 않습니다. 완주 보상은 api/quest-complete.js("stampRally")가 줍니다.
 */
import { QUIZ } from "../src/data/quiz.js";
import { QUIZ_DAILY_CAP, QUIZ_REWARD_EXP, kstToday, levelFromTotalExp } from "../shared/progressRules.js";
import { gradeBooth, isRallyStop } from "../shared/stampRally.js";
import { authenticateStudent, logServerError, buildProgress, getCurrentTotalExp, readJsonBody } from "./_lib/progressServer.js";

const ANSWER_MAP = new Map(QUIZ.map((q) => [q.id, q.answer]));

// 부스 답: { result: "ok" | "already" | "wrong", correct, gained(항상 0), leveledUp: false, progress }
async function handleBooth(auth, body, now, res) {
  if (typeof body.buildingId !== "string" || !isRallyStop(body.buildingId)) {
    return res.status(400).json({ error: "invalid_booth_answer" });
  }
  const today = kstToday(now);
  const correct = gradeBooth(body.buildingId, today, body.choiceIndex);
  if (correct === null) return res.status(400).json({ error: "invalid_booth_answer" });

  let result = "wrong";
  if (correct) {
    // 프로필이 아직 없는 계정도 스탬프부터 받을 수 있게 buildProgress 전에 넣어도 됩니다(reward_log는 auth.users만 참조).
    const { data, error } = await auth.supabase
      .from("reward_log")
      .upsert(
        { user_id: auth.userId, source: "stamp", ref_id: `${today}:${body.buildingId}`, exp: 0, points: 0 },
        { onConflict: "user_id,source,ref_id", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw error;
    result = (data ?? []).length > 0 ? "ok" : "already";
  }
  const progress = await buildProgress(auth.supabase, auth.userId, auth.email, now);
  return res.status(200).json({ result, correct, gained: { exp: 0, points: 0 }, leveledUp: false, progress });
}

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
    const now = deps.now ? deps.now() : new Date();

    if (body && body.kind === "booth") {
      try {
        return await handleBooth(auth, body, now, res);
      } catch (error) {
        logServerError("quiz-answer-booth", error);
        return res.status(500).json({ error: "booth_save_failed" });
      }
    }

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
      const progress = await buildProgress(auth.supabase, auth.userId, auth.email, now);
      const leveledUp = progress.level > beforeLevel;

      return res.status(200).json({
        result: row?.result ?? "wrong",
        correct,
        gained: { exp: Number(row?.gained_exp ?? 0), points: 0 },
        leveledUp,
        progress,
      });
    } catch (error) {
      logServerError("quiz-answer", error);
      return res.status(500).json({ error: "quiz_save_failed" });
    }
  };
}

export default createQuizAnswerHandler();
