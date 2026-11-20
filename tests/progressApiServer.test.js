import test from "node:test";
import assert from "node:assert/strict";
import { QUIZ } from "../src/data/quiz.js";
import { CHECKIN_POINTS, QUEST_REWARD, QUIZ_DAILY_CAP, QUIZ_REWARD_EXP, kstToday } from "../shared/progressRules.js";
import { resetProgressRateLimit } from "../api/_lib/progressServer.js";
import { createProgressHandler } from "../api/progress.js";
import { createQuizAnswerHandler } from "../api/quiz-answer.js";
import { createQuestCompleteHandler } from "../api/quest-complete.js";
import { createCheckInHandler } from "../api/check-in.js";

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function createFakeSupabase({ users = {}, now = () => new Date() } = {}) {
  const profiles = new Map();
  const quizLog = [];
  const questLog = [];
  const rewardLog = [];

  function ensure(userId, email) {
    if (!profiles.has(userId)) {
      profiles.set(userId, { user_id: userId, email, total_exp: 0, points: 0 });
    }
  }

  return {
    auth: {
      async getUser(token) {
        const user = users[token];
        if (!user) return { data: { user: null }, error: { message: "invalid token" } };
        return { data: { user }, error: null };
      },
    },
    from(table) {
      const filters = {};
      return {
        async upsert(row) {
          if (table === "profiles") ensure(row.user_id, row.email);
          return { error: null };
        },
        select() {
          return this;
        },
        eq(col, val) {
          filters[col] = val;
          return this;
        },
        gte() {
          return this;
        },
        lte() {
          return this;
        },
        order() {
          if (table === "quiz_log") {
            return Promise.resolve({ data: quizLog.filter((r) => r.user_id === filters.user_id), error: null });
          }
          if (table === "quest_log") {
            return Promise.resolve({ data: questLog.filter((r) => r.user_id === filters.user_id), error: null });
          }
          return Promise.resolve({ data: [], error: null });
        },
        maybeSingle() {
          const p = profiles.get(filters.user_id) || null;
          return Promise.resolve({ data: p, error: null });
        },
        single() {
          const p = profiles.get(filters.user_id);
          return Promise.resolve({ data: p, error: p ? null : { message: "not found" } });
        },
        then(resolve) {
          if (table === "reward_log") {
            const today = kstToday(now());
            const rows = rewardLog.filter(
              (r) => r.user_id === filters.user_id && r.source === filters.source && r.day === today,
            );
            return Promise.resolve({ data: rows, error: null }).then(resolve);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve);
        },
      };
    },
    async rpc(fn, params) {
      const uid = params.p_user_id;
      ensure(uid, params.p_email);
      const prof = profiles.get(uid);
      const today = kstToday(now());

      if (fn === "record_quiz_answer") {
        let existing = quizLog.find((r) => r.user_id === uid && r.question_id === params.p_question_id);
        if (!existing) {
          existing = { user_id: uid, question_id: params.p_question_id, correct: params.p_correct, rewarded: false };
          quizLog.push(existing);
        } else if (params.p_correct) {
          existing.correct = true;
        }
        if (!params.p_correct) return { data: [{ result: "wrong", gained_exp: 0 }], error: null };
        if (existing.rewarded) return { data: [{ result: "already", gained_exp: 0 }], error: null };

        const todayExp = rewardLog
          .filter((r) => r.user_id === uid && r.source === "quiz" && r.day === today)
          .reduce((s, r) => s + r.exp, 0);
        if (todayExp + params.p_reward_exp > params.p_daily_cap) {
          return { data: [{ result: "cap", gained_exp: 0 }], error: null };
        }
        existing.rewarded = true;
        prof.total_exp += params.p_reward_exp;
        rewardLog.push({ user_id: uid, source: "quiz", ref_id: params.p_question_id, exp: params.p_reward_exp, day: today });
        return { data: [{ result: "ok", gained_exp: params.p_reward_exp }], error: null };
      }

      if (fn === "complete_quest") {
        if (questLog.some((r) => r.user_id === uid && r.quest_id === params.p_quest_id)) {
          return { data: [{ result: "already", gained_exp: 0, gained_points: 0 }], error: null };
        }
        questLog.push({ user_id: uid, quest_id: params.p_quest_id });
        prof.total_exp += params.p_reward_exp;
        prof.points += params.p_reward_points;
        return { data: [{ result: "ok", gained_exp: params.p_reward_exp, gained_points: params.p_reward_points }], error: null };
      }

      if (fn === "daily_check_in") {
        if (rewardLog.some((r) => r.user_id === uid && r.source === "check-in" && r.ref_id === today)) {
          return { data: [{ result: "already", gained_points: 0 }], error: null };
        }
        rewardLog.push({ user_id: uid, source: "check-in", ref_id: today, exp: 0, day: today });
        prof.points += params.p_reward_points;
        return { data: [{ result: "ok", gained_points: params.p_reward_points }], error: null };
      }

      return { data: null, error: { message: "unknown rpc" } };
    },
  };
}

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
    expMax: 100,
    points: 0,
    completedQuests: [],
    quiz: { rewarded: [], answered: [], todayExp: 0, dailyCap: QUIZ_DAILY_CAP },
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

  // 3. 퀴즈 오답 → 정답 → 중복 → 일일 상한(50) 도달
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