import test from "node:test";
import assert from "node:assert/strict";
import { QUIZ } from "../src/data/quiz.js";
import { CHECKIN_POINTS, QUEST_REWARD, QUIZ_DAILY_CAP, QUIZ_REWARD_EXP, kstToday } from "../shared/progressRules.js";
import { resetProgressRateLimit } from "../api/_lib/progressServer.js";
import { createProgressHandler } from "../api/progress.js";
import { createQuizAnswerHandler } from "../api/quiz-answer.js";
import { createQuestCompleteHandler } from "../api/quest-complete.js";
import { createCheckInHandler } from "../api/check-in.js";
import { createFakeSupabase, createMockRes } from "./helpers/fakeProgressDb.js";

test("인증 실패(401) 및 외부 이메일(403) 차단", async () => {
  resetProgressRateLimit();
  const supabase = createFakeSupabase({
    users: {
      "gmail-token": { id: "u-gmail", email: "outsider@gmail.com" },
    },
  });
  const getProgress = createProgressHandler({ supabase });

  const resNoAuth = createMockRes();
  await getProgress({ method: "GET", headers: {} }, resNoAuth);
  assert.equal(resNoAuth.statusCode, 401);

  const resGmail = createMockRes();
  await getProgress({ method: "GET", headers: { authorization: "Bearer gmail-token" } }, resGmail);
  assert.equal(resGmail.statusCode, 403);
});

test("재학생 진행 조회 · 출석 · 퀴즈 · 퀘스트 전체 흐름 및 일일 상한 검증", async () => {
  resetProgressRateLimit();
  const supabase = createFakeSupabase({
    users: {
      "hufs-token": { id: "u-hufs", email: "student@hufs.ac.kr" },
    },
  });
  const authHeader = { authorization: "Bearer hufs-token" };
  const getProgress = createProgressHandler({ supabase });
  const postQuiz = createQuizAnswerHandler({ supabase });
  const postQuest = createQuestCompleteHandler({ supabase });
  const postCheckIn = createCheckInHandler({ supabase });

  // 1. 초기 조회 (Lv.1, 0 exp, 0 points)
  const r1 = createMockRes();
  await getProgress({ method: "GET", headers: authHeader }, r1);
  assert.equal(r1.statusCode, 200);
  assert.deepEqual(r1.body.progress, {
    level: 1,
    exp: 0,
    expMax: 10, // 레벨 n → n+1에 10·n
    points: 0,
    completedQuests: [],
    quiz: { rewarded: [], answered: [], todayExp: 0, dailyCap: QUIZ_DAILY_CAP },
    daily: { date: kstToday(), quizCorrect: 0, quizGoal: 5, quizBonusDone: false, stamps: [], rallyDone: false },
  });

  // 2. 출석 보상 (1회 ok -> 2회 already)
  const rCheck1 = createMockRes();
  await postCheckIn({ method: "POST", headers: authHeader }, rCheck1);
  assert.equal(rCheck1.body.result, "ok");
  assert.equal(rCheck1.body.gained.points, CHECKIN_POINTS);
  assert.equal(rCheck1.body.progress.points, CHECKIN_POINTS);

  const rCheck2 = createMockRes();
  await postCheckIn({ method: "POST", headers: authHeader }, rCheck2);
  assert.equal(rCheck2.body.result, "already");
  assert.equal(rCheck2.body.gained.points, 0);

  // 3. 퀴즈 오답 → 정답 → 중복 → 일일 상한(100) 도달
  const q0 = QUIZ[0];
  const rWrong = createMockRes();
  await postQuiz({ method: "POST", headers: authHeader, body: { questionId: q0.id, choice: !q0.answer } }, rWrong);
  assert.equal(rWrong.body.result, "wrong");
  assert.equal(rWrong.body.correct, false);

  const rOk = createMockRes();
  await postQuiz({ method: "POST", headers: authHeader, body: { questionId: q0.id, choice: q0.answer } }, rOk);
  assert.equal(rOk.body.result, "ok");
  assert.equal(rOk.body.gained.exp, QUIZ_REWARD_EXP);

  const rAlready = createMockRes();
  await postQuiz({ method: "POST", headers: authHeader, body: { questionId: q0.id, choice: q0.answer } }, rAlready);
  assert.equal(rAlready.body.result, "already");

  for (let i = 1; i < QUIZ_DAILY_CAP / QUIZ_REWARD_EXP; i++) {
    const q = QUIZ[i];
    const r = createMockRes();
    await postQuiz({ method: "POST", headers: authHeader, body: { questionId: q.id, choice: q.answer } }, r);
    assert.equal(r.body.result, "ok");
  }
  const qCap = QUIZ[QUIZ_DAILY_CAP / QUIZ_REWARD_EXP];
  const rCap = createMockRes();
  await postQuiz({ method: "POST", headers: authHeader, body: { questionId: qCap.id, choice: qCap.answer } }, rCap);
  assert.equal(rCap.body.result, "cap");
  assert.equal(rCap.body.progress.quiz.todayExp, QUIZ_DAILY_CAP);

  // 4. 퀘스트 완료 (범위 밖 mockReg 400 차단, doubleMajor ok → already)
  const rOutOfScope = createMockRes();
  await postQuest({ method: "POST", headers: authHeader, body: { questId: "mockReg" } }, rOutOfScope);
  assert.equal(rOutOfScope.statusCode, 400);

  const rQuest1 = createMockRes();
  await postQuest({ method: "POST", headers: authHeader, body: { questId: "doubleMajor" } }, rQuest1);
  assert.equal(rQuest1.body.result, "ok");
  assert.equal(rQuest1.body.gained.exp, QUEST_REWARD.exp);
  assert.equal(rQuest1.body.gained.points, QUEST_REWARD.points);
});