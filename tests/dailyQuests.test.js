// 일일 퀘스트 화면 로직(src/dailyQuests.js): 게스트는 서버를 부르지 않고 메모리로만, 재학생은 서버 응답으로, 자정이 지나면 0으로. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { QUIZ } from "../src/data/quiz.js";
import { createMockServer } from "../src/data/progressMock.js";
import { STAMP_RALLY_IDS, boothQuestionFor } from "../shared/stampRally.js";
import { applyProgress, resetSession, session } from "../src/state.js";
import { afterQuizAnswer, dailyState, nextStop, refreshDailyIfNewDay, resetGuestDaily, submitBoothAnswer, todayBoothQuestion } from "../src/dailyQuests.js";

// 호출을 세는 가짜 서버 통로(progressApi와 같은 모양). 시간은 주입합니다.
function fakeApi(iso) {
  let current = new Date(iso);
  const server = createMockServer({ now: () => current });
  const calls = [];
  const wrap = (name, fn) => async (...args) => {
    calls.push(name);
    return JSON.parse(JSON.stringify(fn(...args)));
  };
  return {
    calls,
    server,
    now: () => current,
    setTime: (next) => (current = new Date(next)),
    api: {
      answerBooth: wrap("answerBooth", (buildingId, choiceIndex) => server.answerBooth({ buildingId, choiceIndex })),
      completeQuest: wrap("completeQuest", (questId) => server.completeQuest({ questId })),
      getProgress: wrap("getProgress", () => server.getProgress()),
    },
  };
}
const right = (id, day) => boothQuestionFor(id, day).answer;
const DAY1 = "2026-11-27T03:00:00Z"; // 한국 시간 11/27 12:00

function asGuest(iso = DAY1) {
  resetSession();
  resetGuestDaily();
  const now = new Date(iso);
  dailyState(now);
  return now;
}
function asStudent(env) {
  resetSession();
  session.mode = "student";
  applyProgress(env.server.getProgress().progress);
}

test("게스트: 서버 호출 없이 메모리로 스탬프 · 완주, 오답은 벌점 없이 다시 풀 수 있음", async () => {
  const now = asGuest();
  const env = fakeApi(DAY1);
  const opts = { now, api: env.api };
  const day = "2026-11-27";
  assert.equal(todayBoothQuestion("library", now), boothQuestionFor("library", day), "화면과 서버가 같은 함수로 같은 문제를 고름");

  const wrong = await submitBoothAnswer("library", (right("library", day) + 1) % 3, opts);
  assert.deepEqual([wrong.result, wrong.count], ["wrong", 0]);
  const ok = await submitBoothAnswer("library", right("library", day), opts);
  assert.deepEqual([ok.result, ok.count, ok.completedNow], ["ok", 1, false]);
  assert.equal((await submitBoothAnswer("library", right("library", day), opts)).result, "already");
  assert.equal(nextStop(), "union");

  // 순서와 상관없이 받아도 됨: 인문 → 본관 → 학생회관
  for (const id of ["humanities", "main"]) assert.equal((await submitBoothAnswer(id, right(id, day), opts)).completedNow, false);
  assert.equal(nextStop(), "union");
  const last = await submitBoothAnswer("union", right("union", day), opts);
  assert.deepEqual([last.result, last.count, last.completedNow, last.gained], ["ok", 4, true, { exp: 0, points: 0 }]);
  assert.deepEqual(session.daily.stamps, STAMP_RALLY_IDS);
  assert.equal(session.daily.rallyDone, true);
  assert.deepEqual([session.exp, session.points, session.level], [0, 0, 1], "게스트는 경험치 · 포인트가 쌓이지 않음");
  assert.equal(nextStop(), null);
  assert.deepEqual(env.calls, [], "게스트는 서버를 한 번도 부르지 않음");
  assert.equal((await submitBoothAnswer("cyber", 0, opts)).result, "error", "대상이 아닌 건물");
});

test("게스트 일일 퀴즈: 처음 맞힌 문제만 세고 10개에서 완료, 서버 호출 없음", async () => {
  const now = asGuest();
  const env = fakeApi(DAY1);
  const opts = { now, api: env.api };
  await afterQuizAnswer(QUIZ[0].id, "wrong", opts);
  assert.equal(session.daily.quizCorrect, 0);
  await afterQuizAnswer(QUIZ[0].id, "guest", opts);
  await afterQuizAnswer(QUIZ[0].id, "guest", opts);
  assert.equal(session.daily.quizCorrect, 1, "같은 문제는 한 번만");
  for (let i = 1; i < 12; i++) await afterQuizAnswer(QUIZ[i].id, "guest", opts);
  assert.deepEqual([session.daily.quizCorrect, session.daily.quizBonusDone], [10, true]);
  assert.deepEqual([session.exp, session.level], [0, 1]);
  assert.deepEqual(env.calls, []);
});

test("자정 넘김(시간 주입): 게스트는 스탬프 · 일일 퀴즈 카운트가 0으로", async () => {
  const now = asGuest("2026-11-27T14:59:00Z"); // 한국 시간 23:59
  const env = fakeApi(DAY1);
  await submitBoothAnswer("library", right("library", "2026-11-27"), { now, api: env.api });
  await afterQuizAnswer(QUIZ[0].id, "guest", { now, api: env.api });
  assert.deepEqual([session.daily.stamps, session.daily.quizCorrect], [["library"], 1]);

  assert.equal(await refreshDailyIfNewDay({ now: new Date("2026-11-27T14:59:59Z"), api: env.api }), false, "아직 같은 날");
  const after = new Date("2026-11-27T15:00:30Z"); // 한국 시간 11/28 00:00:30
  assert.equal(await refreshDailyIfNewDay({ now: after, api: env.api }), true);
  assert.deepEqual(session.daily, { date: "2026-11-28", quizCorrect: 0, quizGoal: 10, quizBonusDone: false, stamps: [], rallyDone: false });
  await afterQuizAnswer(QUIZ[0].id, "guest", { now: after, api: env.api });
  assert.equal(session.daily.quizCorrect, 1, "새 날에는 같은 문제도 다시 셈");
  assert.deepEqual(env.calls, []);
});

test("재학생: 부스 답은 서버로, 4번째 스탬프 직후 자동으로 완주를 요청해 보상(50 EXP · 10P)을 받음", async () => {
  const env = fakeApi(DAY1);
  asStudent(env);
  const opts = { now: env.now(), api: env.api };
  const day = "2026-11-27";
  const wrong = await submitBoothAnswer("main", (right("main", day) + 2) % 3, opts);
  assert.equal(wrong.result, "wrong");
  for (const id of STAMP_RALLY_IDS.slice(0, 3)) {
    const r = await submitBoothAnswer(id, right(id, day), opts);
    assert.deepEqual([r.result, r.completedNow], ["ok", false]);
  }
  assert.ok(!env.calls.includes("completeQuest"), "3곳까지는 완주 요청 없음");
  const last = await submitBoothAnswer("humanities", right("humanities", day), opts);
  assert.deepEqual([last.result, last.count, last.completedNow, last.gained], ["ok", 4, true, { exp: 50, points: 10 }]);
  assert.equal(env.calls.filter((c) => c === "completeQuest").length, 1);
  assert.deepEqual([session.daily.rallyDone, session.points], [true, 10]);
  assert.deepEqual([session.level, session.exp], [3, 20], "누적 50 → Lv.3 20/30");
  const again = await submitBoothAnswer("humanities", right("humanities", day), opts);
  assert.deepEqual([again.result, again.completedNow], ["already", false]);
  assert.equal(env.calls.filter((c) => c === "completeQuest").length, 1, "이미 완주했으면 다시 요청하지 않음");
});

test("재학생 일일 퀴즈: 10번째 정답 직후에만 보너스를 자동 요청(하루 한 번)", async () => {
  const env = fakeApi(DAY1);
  asStudent(env);
  const opts = { now: env.now(), api: env.api };
  for (let i = 0; i < 10; i++) {
    const response = env.server.answerQuiz({ questionId: QUIZ[i].id, choice: QUIZ[i].answer });
    applyProgress(response.progress);
    const bonus = await afterQuizAnswer(QUIZ[i].id, response.result, opts);
    assert.equal(bonus, i === 9, `${i + 1}번째`);
  }
  assert.deepEqual(env.calls, ["completeQuest"]);
  assert.deepEqual([session.daily.quizCorrect, session.daily.quizBonusDone], [10, true]);
  assert.equal(session.pendingReward.label, "dailyQuizBonus");
  assert.equal(session.pendingReward.exp, 50);
  assert.equal(await afterQuizAnswer(QUIZ[9].id, "already", opts), false);
  assert.deepEqual(env.calls, ["completeQuest"], "보너스는 다시 요청하지 않음");
});

test("자정 넘김(시간 주입): 재학생은 진행 상태를 다시 불러와 도장 · 일일 퀴즈 카운트가 0으로", async () => {
  const env = fakeApi("2026-11-27T14:00:00Z");
  asStudent(env);
  await submitBoothAnswer("library", right("library", "2026-11-27"), { now: env.now(), api: env.api });
  applyProgress(env.server.answerQuiz({ questionId: QUIZ[0].id, choice: QUIZ[0].answer }).progress);
  assert.deepEqual([session.daily.stamps, session.daily.quizCorrect], [["library"], 1]);
  env.calls.length = 0;

  assert.equal(await refreshDailyIfNewDay({ now: env.now(), api: env.api }), false);
  assert.deepEqual(env.calls, [], "같은 날에는 서버를 부르지 않음");
  env.setTime("2026-11-27T15:00:40Z"); // 한국 시간 11/28 00:00:40 — 30초마다 확인하면 1분 안에 바뀜
  assert.equal(await refreshDailyIfNewDay({ now: env.now(), api: env.api }), true);
  assert.deepEqual(env.calls, ["getProgress"]);
  assert.deepEqual([session.daily.date, session.daily.stamps, session.daily.quizCorrect, session.daily.rallyDone], ["2026-11-28", [], 0, false]);
  assert.equal(session.exp, 0, "경험치(누적 10 → Lv.2 0/20)는 그대로");
  assert.equal(session.level, 2);
});
