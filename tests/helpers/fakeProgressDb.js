// 진행 저장 서버 함수 테스트용 가짜 Supabase(메모리). tests/progressApiServer.test.js · tests/dailyQuestsServer.test.js가 같이 씁니다.
// DB 함수(record_quiz_answer · complete_quest · daily_check_in)는 supabase/001_progress_schema.sql과 같은 규칙으로 흉내 냅니다.
import { kstToday } from "../../shared/progressRules.js";

export function createMockRes() {
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

export function createFakeSupabase({ users = {}, now = () => new Date() } = {}) {
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
    rewardLog,
    questLog,
    profiles,
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
        // profiles: 없으면 만듦. reward_log(스탬프): UNIQUE(user_id, source, ref_id)가 겹치면 무시하고, select()는 새로 들어간 줄만 돌려줌
        upsert(row) {
          if (table === "profiles") {
            ensure(row.user_id, row.email);
            return Promise.resolve({ error: null });
          }
          if (table === "reward_log") {
            const dup = rewardLog.some((r) => r.user_id === row.user_id && r.source === row.source && r.ref_id === row.ref_id);
            const inserted = dup ? [] : [{ id: rewardLog.length + 1 }];
            if (!dup) rewardLog.push({ ...row, day: kstToday(now()) });
            return { select: () => Promise.resolve({ data: inserted, error: null }) };
          }
          return Promise.resolve({ error: null });
        },
        in(col, values) {
          filters[`${col}:in`] = values;
          return this;
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
              (r) =>
                r.user_id === filters.user_id &&
                (filters["source:in"] ? filters["source:in"].includes(r.source) : r.source === filters.source) &&
                r.day === today,
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
