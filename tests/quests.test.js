// 퀘스트 목록 정리(11/24): 이중전공 · 스탬프 랠리 퀘스트는 화면에서 빠지고, 서버 기록은 그대로입니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { QUEST_LIST, activeQuests, applyProgress, session } from "../src/state.js";
import { REWARD_QUESTS } from "../shared/progressRules.js";

const progress = (completedQuests) => ({
  level: 1,
  exp: 0,
  expMax: 10,
  points: 0,
  completedQuests,
  quiz: { rewarded: [], answered: [], todayExp: 0, dailyCap: 50 },
});

test("화면 퀘스트 목록에 이중전공 · 스탬프 랠리가 없음(진행 중 퀘스트 0개 → HUD 퀘스트 버튼 숨김)", () => {
  const ids = QUEST_LIST.map((q) => q.id);
  assert.ok(!ids.includes("doubleMajor") && !ids.includes("stampRally"), ids.join(","));
  assert.equal(activeQuests().length, 0);
});

test("서버 쪽 보상 퀘스트 목록은 그대로(저장된 완료 기록 · api/quest-complete.js 유지)", () => {
  assert.deepEqual(REWARD_QUESTS, ["doubleMajor", "stampRally"]);
});

test("서버가 보낸 완료 기록에 화면 목록에 없는 퀘스트 id가 있어도 오류 없이 무시", () => {
  assert.doesNotThrow(() => applyProgress(progress(["doubleMajor", "stampRally", "unknownQuest"])));
  assert.equal(activeQuests().length, 0);
  session.trackedQuest = "stampRally";
  applyProgress(progress(["stampRally"]));
  assert.equal(session.trackedQuest, null, "완료된(목록에 없는) 퀘스트 안내는 꺼짐");
});
