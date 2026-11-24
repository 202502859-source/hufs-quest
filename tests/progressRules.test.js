// 레벨 규칙(shared/progressRules.js): 레벨 n → n+1에 10 × n, 도달하면 레벨업 · 남은 경험치 이월. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { expToNextLevel, levelFromTotalExp, totalExpForLevel } from "../shared/progressRules.js";
import { applyProgress, gainExp, resetSession, session } from "../src/state.js";

test("필요 경험치: Lv.1 10, Lv.2 20, Lv.3 30 …, Lv.L 시작 누적 = 5·L·(L−1)", () => {
  assert.deepEqual([1, 2, 3, 10].map(expToNextLevel), [10, 20, 30, 100]);
  assert.deepEqual([1, 2, 3, 4, 5].map(totalExpForLevel), [0, 10, 30, 60, 100]);
});

test("경계: 9 → Lv.1 9/10, 10 → Lv.2 0/20, 29 → Lv.2 19/20, 30 → Lv.3 0/30", () => {
  assert.deepEqual(levelFromTotalExp(9), { level: 1, exp: 9, expMax: 10 });
  assert.deepEqual(levelFromTotalExp(10), { level: 2, exp: 0, expMax: 20 });
  assert.deepEqual(levelFromTotalExp(29), { level: 2, exp: 19, expMax: 20 });
  assert.deepEqual(levelFromTotalExp(30), { level: 3, exp: 0, expMax: 30 });
});

test("이월: Lv.1 EXP 8에서 +5 → Lv.2 EXP 3/20", () => {
  assert.deepEqual(levelFromTotalExp(8), { level: 1, exp: 8, expMax: 10 });
  assert.deepEqual(levelFromTotalExp(8 + 5), { level: 2, exp: 3, expMax: 20 });
});

test("한 번에 여러 레벨: 누적 0에서 +65 → Lv.4 5/40", () => {
  assert.deepEqual(levelFromTotalExp(65), { level: 4, exp: 5, expMax: 40 });
});

test("큰 값 · 잘못된 값도 안전: 매 레벨 경계가 정확하고 음수 · 문자는 0으로", () => {
  for (let level = 1; level <= 300; level++) {
    const start = totalExpForLevel(level);
    assert.deepEqual(levelFromTotalExp(start), { level, exp: 0, expMax: 10 * level });
    if (start > 0) assert.equal(levelFromTotalExp(start - 1).level, level - 1);
  }
  assert.deepEqual(levelFromTotalExp(-5), { level: 1, exp: 0, expMax: 10 });
  assert.deepEqual(levelFromTotalExp("abc"), { level: 1, exp: 0, expMax: 10 });
});

test("게스트(메모리)도 같은 규칙: 8 + 5 → Lv.2 3/20, +62 → Lv.4 15/40, 알림은 마지막 레벨 한 번", () => {
  resetSession();
  assert.equal(session.expMax, 10);
  gainExp(8);
  assert.equal(session.pendingLevelUp, null);
  assert.equal(gainExp(5), true);
  assert.deepEqual([session.level, session.exp, session.expMax], [2, 3, 20]);
  session.pendingLevelUp = null;
  assert.equal(gainExp(62), true); // 누적 13 + 62 = 75 → Lv.4(시작 60) 15/40
  assert.deepEqual([session.level, session.exp, session.expMax], [4, 15, 40]);
  assert.deepEqual(levelFromTotalExp(75), { level: 4, exp: 15, expMax: 40 }, "게스트 결과가 서버 계산과 같음");
  assert.equal(session.pendingLevelUp, 4, "Lv.3을 건너뛰어도 알림은 마지막 Lv.4 하나");
});

test("재학생: 처음 불러올 때는 레벨 업 알림 없음, 그 뒤 여러 레벨이 올라도 마지막 레벨만", () => {
  resetSession();
  const progress = (total) => ({
    ...levelFromTotalExp(total),
    points: 0,
    completedQuests: [],
    quiz: { rewarded: [], answered: [], todayExp: 0, dailyCap: 50 },
  });
  applyProgress(progress(120)); // 로그인 직후 Lv.5
  assert.equal(session.level, 5);
  assert.equal(session.pendingLevelUp, null, "기존 사용자가 새 규칙으로 레벨이 올라 보여도 알림은 없음");
  applyProgress(progress(125));
  assert.equal(session.pendingLevelUp, null);
  applyProgress(progress(220)); // Lv.5 → Lv.7(시작 210)
  assert.equal(session.pendingLevelUp, 7);
});
