// 퀘스트 목록(11/27): 일일 퀘스트(캠퍼스 스탬프 랠리 · 일일 퀴즈)만 화면에 있고, 이중전공 · 모의 수강신청은 숨김. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { DAILY_QUEST_LIST, QUEST_LIST, activeQuests, applyProgress, session, t, setLang } from "../src/state.js";
import { DAILY_QUESTS, REWARD_QUESTS } from "../shared/progressRules.js";

const progress = (completedQuests, daily) => ({
  level: 1,
  exp: 0,
  expMax: 10,
  points: 0,
  completedQuests,
  quiz: { rewarded: [], answered: [], todayExp: 0, dailyCap: 100 },
  ...(daily ? { daily } : {}),
});

test("화면 퀘스트 목록: 일일 퀘스트 2개(스탬프 랠리 · 일일 퀴즈)만, 이중전공 · 모의 수강신청은 숨김", () => {
  assert.deepEqual(QUEST_LIST.map((q) => q.id), ["stampRally", "dailyQuiz"]);
  assert.deepEqual(DAILY_QUEST_LIST.map((q) => q.id), DAILY_QUESTS);
  assert.deepEqual(DAILY_QUEST_LIST.map((q) => q.name.ko), ["캠퍼스 스탬프 랠리", "일일 퀴즈"]);
  assert.deepEqual(DAILY_QUEST_LIST.map((q) => q.name.en), ["Campus Stamp Rally", "Daily Quiz"]);
  assert.equal(activeQuests().length, 0, "일반(영구) 퀘스트는 0개 → 예전 HUD 퀘스트 버튼 없음");
});

test("서버 보상 목록: 영구 퀘스트는 doubleMajor, 일일 퀘스트는 stampRally · dailyQuiz", () => {
  assert.deepEqual(REWARD_QUESTS, ["doubleMajor"]);
  assert.deepEqual(DAILY_QUESTS, ["stampRally", "dailyQuiz"]);
});

test("서버가 보낸 완료 기록에 화면 목록에 없는 퀘스트 id가 있어도 오류 없이 무시", () => {
  assert.doesNotThrow(() => applyProgress(progress(["doubleMajor", "unknownQuest"])));
  assert.equal(activeQuests().length, 0);
  session.trackedQuest = "doubleMajor";
  applyProgress(progress(["doubleMajor"]));
  assert.equal(session.trackedQuest, null, "완료된(목록에 없는) 퀘스트 안내는 꺼짐");
});

test("daily가 없는 옛 응답은 0으로, 있으면 그대로 session.daily에 들어감", () => {
  applyProgress(progress([]));
  assert.deepEqual([session.daily.quizCorrect, session.daily.stamps, session.daily.rallyDone], [0, [], false]);
  const daily = { date: "2026-11-27", quizCorrect: 3, quizGoal: 10, quizBonusDone: false, stamps: ["library", "union"], rallyDone: false };
  applyProgress(progress([], daily));
  assert.deepEqual(session.daily, daily);
});

test("문구(한/영): 일일 퀘스트 창 · 부스 · 팻말", () => {
  const both = (key, vars) => {
    setLang("ko");
    const ko = t(key, vars);
    setLang("en");
    const en = t(key, vars);
    setLang("ko");
    return [ko, en];
  };
  assert.deepEqual(both("dailyTitle"), ["일일 퀘스트", "Daily Quests"]);
  assert.deepEqual(both("dailyQuizCount", { n: 0, goal: 10 }), ["맞춘 정답: 0/10개", "Correct today: 0/10"]);
  assert.deepEqual(both("dailyQuizDone", { exp: 50 }), ["완료! 보너스 +50 EXP", "Done! Bonus +50 EXP"]);
  assert.equal(both("dailyRallyNext", { place: "본관" })[0], "다음: 본관");
  assert.equal(both("dailyRallyDone", { exp: 50 })[0], "완주! +50 EXP");
  assert.equal(both("dailyGuestNote")[0], "게스트는 경험치가 저장되지 않아요");
  assert.deepEqual(both("boothPrompt"), ["스탬프 랠리", "Stamp Rally"]);
  assert.equal(both("boothLabel")[0], "[스탬프 랠리 부스]");
  assert.equal(both("signLabel")[0], "[시설 안내문]");
  assert.deepEqual(both("boothHint"), ["답은 옆 '시설 안내문'에 있어요", "The answer is on the 'Facility Guide' sign next to the entrance"]);
  assert.deepEqual(both("boothWrong"), ["시설 안내문에서 다시 찾아보세요", "Check the Facility Guide sign and try again"]);
  assert.deepEqual(both("boothAlready"), ["오늘 이 부스 스탬프는 이미 받았어요", "You already got today's stamp here"]);
  assert.deepEqual(both("stampCollected", { n: 2, total: 4 }), ["스탬프 획득! (2/4)", "Stamp collected! (2/4)"]);
  assert.equal(both("rallyComplete", { exp: 50 })[0], "랠리 완주! +50 EXP");
});
