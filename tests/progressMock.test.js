// 가짜 서버(src/data/progressMock.js)가 PROGRESS_API.md의 서버 규칙을 지키는지 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { QUIZ } from "../src/data/quiz.js";
import { ProgressApiError, createMockServer } from "../src/data/progressMock.js";
import { QUIZ_DAILY_CAP, kstToday, levelFromTotalExp } from "../shared/progressRules.js";

// 시계를 마음대로 옮길 수 있는 가짜 서버를 만듭니다. 시작: 한국 시간 2026-11-19 10:00
function setup(seed = null, start = "2026-11-19T01:00:00Z") {
  let time = new Date(start).getTime();
  const server = createMockServer({ now: () => new Date(time), seed });
  return { server, setTime: (iso) => (time = new Date(iso).getTime()) };
}

const right = (q) => q.answer;
const wrongChoice = (q) => !q.answer;

test("새 계정은 Lv.1 · 경험치 0 · 포인트 0, 응답 모양이 문서와 같다", () => {
  const { server } = setup();
  const { progress } = server.getProgress();
  assert.deepEqual(progress, {
    level: 1,
    exp: 0,
    expMax: 10, // 레벨 n → n+1에 10·n
    points: 0,
    completedQuests: [],
    quiz: { rewarded: [], answered: [], todayExp: 0, dailyCap: 100 },
    daily: { date: progress.daily.date, quizCorrect: 0, quizGoal: 5, quizBonusDone: false, stamps: [], rallyDone: false },
  });
});

test("정답이면 경험치 10, 같은 문제를 다시 맞히면 already", () => {
  const { server } = setup();
  const q = QUIZ[0];
  const first = server.answerQuiz({ questionId: q.id, choice: right(q) });
  assert.equal(first.result, "ok");
  assert.equal(first.correct, true);
  assert.deepEqual(first.gained, { exp: 10, points: 0 });
  // 새 레벨 규칙: Lv.1 → Lv.2에 10이 필요해 첫 정답에서 Lv.2(0/20)
  assert.equal(first.leveledUp, true);
  assert.equal(first.progress.level, 2);
  assert.equal(first.progress.exp, 0);
  assert.deepEqual(first.progress.quiz.rewarded, [q.id]);
  assert.equal(first.progress.quiz.todayExp, 10);

  const again = server.answerQuiz({ questionId: q.id, choice: right(q) });
  assert.equal(again.result, "already");
  assert.deepEqual(again.gained, { exp: 0, points: 0 });
  assert.equal(again.leveledUp, false);
  assert.equal(again.progress.exp, 0);
});

test("오답이면 wrong, 경험치는 그대로이고 푼 문제(answered)에는 들어간다", () => {
  const { server } = setup();
  const q = QUIZ[1];
  const res = server.answerQuiz({ questionId: q.id, choice: wrongChoice(q) });
  assert.equal(res.result, "wrong");
  assert.equal(res.correct, false);
  assert.deepEqual(res.gained, { exp: 0, points: 0 });
  assert.equal(res.progress.exp, 0);
  assert.equal(res.progress.level, 1);
  assert.deepEqual(res.progress.quiz.answered, [q.id]);
  assert.deepEqual(res.progress.quiz.rewarded, []);
});

test("정답 여부는 화면 값이 아니라 quiz.js의 answer로 판단한다", () => {
  const { server } = setup();
  const oQuestion = QUIZ.find((q) => q.answer === true);
  const xQuestion = QUIZ.find((q) => q.answer === false);
  assert.equal(server.answerQuiz({ questionId: oQuestion.id, choice: true }).result, "ok");
  assert.equal(server.answerQuiz({ questionId: xQuestion.id, choice: true }).result, "wrong");
  assert.equal(server.answerQuiz({ questionId: xQuestion.id, choice: false }).result, "ok");
  // 화면이 "correct: true" 같은 값을 덧붙여 보내도 무시합니다.
  const other = QUIZ.find((q) => q.answer === true && q.id !== oQuestion.id);
  assert.equal(server.answerQuiz({ questionId: other.id, choice: false, correct: true }).result, "wrong");
});

test("없는 문제 ID나 O/X가 아닌 답은 400", () => {
  const { server } = setup();
  assert.throws(() => server.answerQuiz({ questionId: "no-such-question", choice: true }), (e) => e instanceof ProgressApiError && e.status === 400);
  assert.throws(() => server.answerQuiz({ questionId: QUIZ[0].id, choice: "O" }), (e) => e.status === 400);
});

test("하루 100(10문제)을 넘기면 cap, 한국 시간 날짜가 바뀌면 다시 받는다", () => {
  const { server, setTime } = setup(null, "2026-11-19T14:00:00Z"); // 한국 시간 23:00
  const perDay = QUIZ_DAILY_CAP / 10;
  QUIZ.slice(0, perDay).forEach((q) => assert.equal(server.answerQuiz({ questionId: q.id, choice: right(q) }).result, "ok"));

  const sixth = QUIZ[perDay];
  const capped = server.answerQuiz({ questionId: sixth.id, choice: right(sixth) });
  assert.equal(capped.result, "cap");
  assert.equal(capped.progress.quiz.todayExp, 100);
  assert.equal(capped.progress.daily.quizCorrect, 10);
  assert.equal(capped.progress.level, 5); // 누적 100 = Lv.5 0/50
  assert.equal(capped.progress.exp, 0);

  setTime("2026-11-19T14:59:59Z"); // 한국 시간 23:59:59 — 아직 같은 날
  assert.equal(server.answerQuiz({ questionId: sixth.id, choice: right(sixth) }).result, "cap");

  setTime("2026-11-19T15:00:00Z"); // 한국 시간 11/20 00:00 — UTC로는 아직 11/19
  const nextDay = server.answerQuiz({ questionId: sixth.id, choice: right(sixth) });
  assert.equal(nextDay.result, "ok");
  assert.equal(nextDay.progress.quiz.todayExp, 10);
  assert.equal(nextDay.progress.daily.quizCorrect, 1, "날짜가 바뀌면 일일 퀴즈 정답 수도 새로 셈");
  assert.equal(nextDay.progress.level, 5); // 누적 110 = Lv.5 10/50
  assert.equal(nextDay.progress.exp, 10);
});

test("출석은 하루 한 번 ok, 두 번째는 already, 다음 날 다시 ok", () => {
  const { server, setTime } = setup();
  const first = server.checkIn();
  assert.equal(first.result, "ok");
  assert.deepEqual(first.gained, { exp: 0, points: 5 });
  assert.equal(first.progress.points, 5);
  assert.equal("leveledUp" in first, false); // 문서의 출석 응답에는 leveledUp이 없습니다.

  const second = server.checkIn();
  assert.equal(second.result, "already");
  assert.deepEqual(second.gained, { exp: 0, points: 0 });
  assert.equal(second.progress.points, 5);

  setTime("2026-11-19T15:00:00Z");
  assert.equal(server.checkIn().result, "ok");
  assert.equal(server.getProgress().progress.points, 10);
});

test("퀘스트 완료는 경험치 10 · 포인트 10, 두 번째는 already, 목록 밖(mockReg)은 400", () => {
  const { server } = setup();
  const done = server.completeQuest({ questId: "doubleMajor" });
  assert.equal(done.result, "ok");
  assert.deepEqual(done.gained, { exp: 10, points: 10 });
  assert.deepEqual(done.progress.completedQuests, ["doubleMajor"]);
  assert.equal(done.progress.points, 10);

  const again = server.completeQuest({ questId: "doubleMajor" });
  assert.equal(again.result, "already");
  assert.equal(again.progress.points, 10);

  assert.throws(() => server.completeQuest({ questId: "mockReg" }), (e) => e.status === 400);
});

test("레벨 계산: 레벨 n → n+1에 10·n, 도달하면 레벨업 · 이월", () => {
  assert.deepEqual(levelFromTotalExp(0), { level: 1, exp: 0, expMax: 10 });
  assert.deepEqual(levelFromTotalExp(9), { level: 1, exp: 9, expMax: 10 });
  assert.deepEqual(levelFromTotalExp(10), { level: 2, exp: 0, expMax: 20 });
  assert.deepEqual(levelFromTotalExp(250), { level: 7, exp: 40, expMax: 70 }); // Lv.7 시작 누적 210

  // 이틀에 걸쳐 10문제(누적 10 → 100): 누적 10 · 30 · 60 · 100에서 Lv.2 · 3 · 4 · 5
  const { server, setTime } = setup();
  const results = QUIZ.slice(0, 10).map((q, i) => {
    if (i === 5) setTime("2026-11-20T01:00:00Z");
    return server.answerQuiz({ questionId: q.id, choice: right(q) });
  });
  assert.deepEqual(results.map((r) => r.leveledUp), [true, false, true, false, false, true, false, false, false, true]);
  assert.equal(results[9].progress.level, 5);
  assert.equal(results[9].progress.exp, 0);
});

test("?mock=cap 계정: 오늘 이미 100을 받아 새 문제를 맞혀도 cap", () => {
  const { server } = setup("cap");
  const { progress } = server.getProgress();
  assert.equal(progress.quiz.todayExp, 100);
  assert.equal(progress.level, 5); // 누적 100
  assert.equal(progress.exp, 0);
  const fresh = QUIZ[12];
  assert.equal(server.answerQuiz({ questionId: fresh.id, choice: right(fresh) }).result, "cap");
});

test("?mock=already 계정: 퀴즈·퀘스트·출석 모두 already, 숫자가 서로 맞음", () => {
  const { server } = setup("already");
  const { progress } = server.getProgress();
  assert.equal(progress.quiz.rewarded.length, QUIZ.length);
  assert.equal(progress.quiz.todayExp, 0);
  assert.equal(progress.level, 14); // 100문제 1000 + 퀘스트 2개 20 = 1020 → Lv.14 시작 누적 910
  assert.equal(progress.exp, 110);
  assert.equal(progress.expMax, 140);
  assert.equal(progress.points, 25); // 퀘스트 2개 20 + 출석 5
  const q = QUIZ[0];
  assert.equal(server.answerQuiz({ questionId: q.id, choice: right(q) }).result, "already");
  assert.equal(server.completeQuest({ questId: "doubleMajor" }).result, "already");
  assert.equal(server.checkIn().result, "already");
  // 11/24 이전의 날짜 없는 "stampRally" 완료 기록이 있는 계정: 응답 completedQuests에는 싣지 않고, 오늘 일일 랠리는 새로 시작
  assert.deepEqual(progress.completedQuests, ["doubleMajor"]);
  assert.equal(progress.daily.rallyDone, false);
});

test("kstToday는 한국 시간 자정을 기준으로 날짜를 바꾼다", () => {
  assert.equal(kstToday(new Date("2026-11-19T14:59:59Z")), "2026-11-19");
  assert.equal(kstToday(new Date("2026-11-19T15:00:00Z")), "2026-11-20");
  assert.equal(kstToday(new Date("2026-12-31T15:00:00Z")), "2027-01-01");
});
