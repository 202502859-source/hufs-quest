// 일일 퀘스트 서버 규칙(api/quiz-answer.js 부스 답 · api/quest-complete.js 일일 완료 · progress.daily). 새 SQL 없이 기존 DB 함수만 씁니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { QUIZ } from "../src/data/quiz.js";
import { DAILY_QUIZ_BONUS_EXP, DAILY_QUIZ_GOAL, QUIZ_DAILY_CAP, QUIZ_REWARD_EXP, STAMP_RALLY_REWARD } from "../shared/progressRules.js";
import { STAMP_RALLY_IDS, boothQuestionFor } from "../shared/stampRally.js";
import { resetProgressRateLimit } from "../api/_lib/progressServer.js";
import { createProgressHandler } from "../api/progress.js";
import { createQuizAnswerHandler } from "../api/quiz-answer.js";
import { createQuestCompleteHandler } from "../api/quest-complete.js";
import { createFakeSupabase, createMockRes } from "./helpers/fakeProgressDb.js";

const headers = { authorization: "Bearer hufs-token" };

function setup(iso = "2026-11-27T03:00:00Z") {
  resetProgressRateLimit();
  let current = new Date(iso);
  const now = () => current;
  const supabase = createFakeSupabase({ users: { "hufs-token": { id: "u-hufs", email: "student@hufs.ac.kr" } }, now });
  const call = (handler, method, body) => async (payload = body) => {
    const res = createMockRes();
    await handler({ method, headers, body: payload }, res);
    return res;
  };
  return {
    supabase,
    setTime: (next) => (current = new Date(next)),
    progress: call(createProgressHandler({ supabase, now }), "GET"),
    quiz: call(createQuizAnswerHandler({ supabase, now }), "POST"),
    quest: call(createQuestCompleteHandler({ supabase, now }), "POST"),
  };
}
const right = (id, day) => boothQuestionFor(id, day).answer;
const booth = (buildingId, choiceIndex) => ({ kind: "booth", buildingId, choiceIndex });

test("부스 채점: 정답 → stamp 기록 1번(두 번째는 중복 무시), 오답 → 기록 없음, 경험치 없음", async () => {
  const s = setup();
  const day = "2026-11-27";
  const wrong = await s.quiz(booth("library", (right("library", day) + 1) % 3));
  assert.equal(wrong.statusCode, 200);
  assert.deepEqual([wrong.body.result, wrong.body.correct, wrong.body.progress.daily.stamps], ["wrong", false, []]);
  assert.equal(s.supabase.rewardLog.length, 0, "오답은 기록 없음");

  const ok = await s.quiz(booth("library", right("library", day)));
  assert.deepEqual([ok.body.result, ok.body.correct, ok.body.gained], ["ok", true, { exp: 0, points: 0 }]);
  assert.deepEqual(ok.body.progress.daily.stamps, ["library"]);
  assert.equal(ok.body.progress.exp, 0);
  assert.deepEqual(s.supabase.rewardLog.map((r) => [r.source, r.ref_id, r.exp, r.points]), [["stamp", "2026-11-27:library", 0, 0]]);

  const again = await s.quiz(booth("library", right("library", day)));
  assert.equal(again.body.result, "already");
  assert.equal(s.supabase.rewardLog.length, 1, "같은 날 같은 부스는 한 번만 기록");
  assert.deepEqual(again.body.progress.daily.stamps, ["library"]);
});

test("부스 요청 검증: 대상 아닌 건물 · 잘못된 보기 번호는 400, 응답에 이메일 · user_id 없음", async () => {
  const s = setup();
  for (const body of [booth("cyber", 0), booth("gatehouse", 0), booth("flc", 1), booth("library", 3), booth("library", "0"), booth(undefined, 0), { kind: "booth" }]) {
    const res = await s.quiz(body);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
  }
  assert.equal(s.supabase.rewardLog.length, 0);
  const ok = await s.quiz(booth("union", right("union", "2026-11-27")));
  assert.doesNotMatch(JSON.stringify(ok.body), /u-hufs|student@|hufs\.ac\.kr/);
});

test("기존 O/X 퀴즈 요청은 그대로 동작(오답 · 정답 · 중복 · 없는 문제 400)", async () => {
  const s = setup();
  const q = QUIZ[0];
  assert.equal((await s.quiz({ questionId: q.id, choice: !q.answer })).body.result, "wrong");
  const ok = await s.quiz({ questionId: q.id, choice: q.answer });
  assert.deepEqual([ok.body.result, ok.body.gained], ["ok", { exp: QUIZ_REWARD_EXP, points: 0 }]);
  assert.equal(ok.body.progress.daily.quizCorrect, 1);
  assert.equal((await s.quiz({ questionId: q.id, choice: q.answer })).body.result, "already");
  assert.equal((await s.quiz({ questionId: "no-such", choice: true })).statusCode, 400);
  assert.equal((await s.quiz({ questionId: q.id, choice: "O" })).statusCode, 400);
});

test("일일 퀴즈: 보너스는 5개(DAILY_QUIZ_GOAL) 미만이면 400, 5개면 50, 두 번째는 already. 하루 10문제(경험치 100)까지 지급, 11번째는 cap", async () => {
  const s = setup();
  assert.equal(QUIZ_DAILY_CAP, 100);
  assert.equal(DAILY_QUIZ_GOAL, 5, "11/27 서버 리뷰: 10 → 5");
  for (let i = 0; i < 4; i++) assert.equal((await s.quiz({ questionId: QUIZ[i].id, choice: QUIZ[i].answer })).body.result, "ok");
  const early = await s.quest({ questId: "dailyQuiz" });
  assert.equal(early.statusCode, 400, "4개에서는 보너스 없음");

  const fifth = await s.quiz({ questionId: QUIZ[4].id, choice: QUIZ[4].answer });
  assert.deepEqual([fifth.body.result, fifth.body.progress.daily.quizCorrect, fifth.body.progress.daily.quizGoal, fifth.body.progress.quiz.todayExp], ["ok", 5, 5, 50]);
  for (let i = 5; i < 10; i++) assert.equal((await s.quiz({ questionId: QUIZ[i].id, choice: QUIZ[i].answer })).body.result, "ok");
  const eleventh = await s.quiz({ questionId: QUIZ[10].id, choice: QUIZ[10].answer });
  assert.equal(eleventh.body.result, "cap");
  assert.equal(eleventh.body.progress.daily.quizCorrect, 10);

  const bonus = await s.quest({ questId: "dailyQuiz" });
  assert.deepEqual([bonus.body.result, bonus.body.gained], ["ok", { exp: DAILY_QUIZ_BONUS_EXP, points: 0 }]);
  assert.equal(bonus.body.progress.daily.quizBonusDone, true);
  assert.deepEqual(s.supabase.questLog.map((r) => r.quest_id), ["dailyQuiz:2026-11-27"]);
  assert.deepEqual(bonus.body.progress.completedQuests, [], "일일 완료 기록은 completedQuests에 싣지 않음");
  const twice = await s.quest({ questId: "dailyQuiz" });
  assert.deepEqual([twice.body.result, twice.body.gained], ["already", { exp: 0, points: 0 }]);
  assert.equal(s.supabase.profiles.get("u-hufs").total_exp, 150);
});

test("랠리: 스탬프 3개면 400, 4개면 지급(50 EXP · 10P), 같은 날 두 번째는 already, 다음 날 다시 지급", async () => {
  const s = setup("2026-11-27T03:00:00Z");
  for (const id of STAMP_RALLY_IDS.slice(0, 3)) assert.equal((await s.quiz(booth(id, right(id, "2026-11-27")))).body.result, "ok");
  assert.equal((await s.quest({ questId: "stampRally" })).statusCode, 400);

  // 받는 순서는 자유: 마지막 한 곳을 받으면 완주 가능
  const last = await s.quiz(booth("humanities", right("humanities", "2026-11-27")));
  assert.deepEqual(last.body.progress.daily.stamps, STAMP_RALLY_IDS);
  assert.equal(last.body.progress.daily.rallyDone, false);
  const done = await s.quest({ questId: "stampRally" });
  assert.deepEqual([done.body.result, done.body.gained], ["ok", STAMP_RALLY_REWARD]);
  assert.deepEqual(STAMP_RALLY_REWARD, { exp: 50, points: 10 });
  assert.equal(done.body.progress.daily.rallyDone, true);
  assert.equal((await s.quest({ questId: "stampRally" })).body.result, "already");

  // 한국 시간 자정이 지나면 스탬프 · 완주가 0으로, 다시 모으면 또 받음
  s.setTime("2026-11-27T15:00:00Z"); // 한국 시간 11/28 00:00
  const next = await s.progress();
  assert.deepEqual([next.body.progress.daily.date, next.body.progress.daily.stamps, next.body.progress.daily.rallyDone, next.body.progress.daily.quizCorrect], ["2026-11-28", [], false, 0]);
  assert.equal((await s.quest({ questId: "stampRally" })).statusCode, 400, "새 날에는 스탬프가 없어 완주 불가");
  for (const id of STAMP_RALLY_IDS) assert.equal((await s.quiz(booth(id, right(id, "2026-11-28")))).body.result, "ok");
  assert.equal((await s.quest({ questId: "stampRally" })).body.result, "ok");
  assert.deepEqual(s.supabase.questLog.map((r) => r.quest_id), ["stampRally:2026-11-27", "stampRally:2026-11-28"]);
  assert.deepEqual([s.supabase.profiles.get("u-hufs").total_exp, s.supabase.profiles.get("u-hufs").points], [100, 20]);
});

test("11/24 이전의 영구 stampRally 완료 기록이 있는 계정도 일일 랠리를 새로 진행하고 보상을 받음", async () => {
  const s = setup();
  s.supabase.questLog.push({ user_id: "u-hufs", quest_id: "stampRally" }, { user_id: "u-hufs", quest_id: "doubleMajor" });
  const before = await s.progress();
  assert.deepEqual(before.body.progress.completedQuests, ["doubleMajor"], "날짜 없는 옛 stampRally는 completedQuests에서 빠짐");
  assert.equal(before.body.progress.daily.rallyDone, false);
  for (const id of STAMP_RALLY_IDS) await s.quiz(booth(id, right(id, "2026-11-27")));
  assert.equal((await s.quest({ questId: "stampRally" })).body.result, "ok");
});

test("퀘스트 완료 검증: 범위 밖 · 날짜를 직접 붙인 id는 400, 영구 퀘스트 doubleMajor는 그대로", async () => {
  const s = setup();
  for (const questId of ["mockReg", "stampRally:2026-11-27", "dailyQuiz:2026-11-27", "", 3]) {
    assert.equal((await s.quest({ questId })).statusCode, 400, String(questId));
  }
  const dm = await s.quest({ questId: "doubleMajor" });
  assert.deepEqual([dm.body.result, dm.body.gained], ["ok", { exp: 10, points: 10 }]);
});
