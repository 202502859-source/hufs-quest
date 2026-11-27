// 지도 위 퀴즈 상자 표시(src/ui/quizDot.js): 작은 샛노란 원 + 1px 어두운 테두리, 깜빡이지 않음. 미니맵 · 전체 지도 공통. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HERE_COLOR, HERE_COLOR_BEFORE, QUIZ_DOT, QUIZ_DOT_RADIUS, drawQuizDot } from "../src/ui/quizDot.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("색 · 크기 상수: 샛노란색(#FFE600) · 테두리 #10182a 1px · 지름이 예전 네모(한 변 4k)의 약 60% · 깜빡임 없음", () => {
  assert.equal(QUIZ_DOT.color, 0xffe600);
  assert.equal(QUIZ_DOT.edge, 0x10182a);
  assert.equal(QUIZ_DOT.edgePx, 1);
  assert.equal(QUIZ_DOT.blink, false);
  assert.equal(QUIZ_DOT_RADIUS, 1.2);
  const ratio = (QUIZ_DOT_RADIUS * 2) / QUIZ_DOT.squareBefore;
  assert.ok(Math.abs(ratio - 0.6) < 0.05, `지름 비율 ${ratio}`);
  // 다음 부스 강조(0xffe14d) · 내 위치(흰색)와 같은 색이 아님
  assert.notEqual(QUIZ_DOT.color, 0xffe14d);
});

test("그리기: 어두운 원(반지름 + 1px) 위에 노란 원(반지름 1.2 × k), 네모는 그리지 않음", () => {
  const calls = [];
  const g = {
    fillStyle(color, alpha) {
      calls.push(["fillStyle", color, alpha]);
      return this;
    },
    fillCircle(x, y, r) {
      calls.push(["fillCircle", x, y, r]);
      return this;
    },
    fillRect() {
      calls.push(["fillRect"]);
      return this;
    },
  };
  drawQuizDot(g, 50, 60, 1.2);
  assert.deepEqual(calls, [
    ["fillStyle", 0x10182a, 1],
    ["fillCircle", 50, 60, 1.2 * 1.2 + 1],
    ["fillStyle", 0xffe600, 1],
    ["fillCircle", 50, 60, 1.2 * 1.2],
  ]);
});

test("미니맵 · 전체 지도 모두 같은 함수로 그리고, 퀴즈 점에는 깜빡임(tween)이 없음. 내 위치 표시는 흰색 깜빡이는 네모(11/27 저녁), 다음 부스 강조는 노랑 그대로", () => {
  const hud = read("../src/scenes/HudScene.js");
  const map = read("../src/scenes/MapScene.js");
  assert.match(hud, /drawQuizDot\(this\.quizDots, x, y, k\)/);
  assert.match(map, /drawQuizDot\(g, x, y, QUIZ_DOT\.fullMapK\)/);
  assert.doesNotMatch(hud, /0xff9f1c|QUIZ_DOT_COLOR/, "예전 주황 네모가 남아 있음");
  assert.doesNotMatch(map, /image\(x, y, "quiz-box"\)/, "전체 지도에 예전 '?' 상자 그림이 남아 있음");
  assert.doesNotMatch(hud, /targets: this\.quizDots/, "퀴즈 점이 깜빡임");
  // 내 위치: 흰색(HERE_COLOR) 네모 + 어두운 그림자 네모 + 깜빡임. 크기 · 그림자 · 깜빡임은 그대로
  assert.deepEqual([HERE_COLOR, HERE_COLOR_BEFORE], [0xffffff, 0xffe14d]);
  assert.notEqual(HERE_COLOR, QUIZ_DOT.color, "퀴즈 점과 같은 색");
  assert.match(hud, /this\.markerShadow = this\.add\.rectangle\(0, 0, 8 \* k, 8 \* k, 0x10182a\);\s*this\.marker = this\.add\.rectangle\(0, 0, 4 \* k, 4 \* k, HERE_COLOR\);\s*this\.tweens\.add\(\{ targets: this\.marker, alpha: 0\.25/);
  assert.match(map, /this\.add\.rectangle\(x, y, 12, 12, 0x10182a\);\s*const dot = this\.add\.rectangle\(x, y, 8, 8, HERE_COLOR\);\s*this\.tweens\.add\(\{ targets: dot, alpha: 0\.2/);
  assert.doesNotMatch(hud + map, /rectangle\([^)]*0xffe14d\)/, "예전 노란 네모(내 위치)가 남아 있음");
  // 다음 부스 강조 테두리는 노랑 그대로
  assert.match(hud, /this\.boothBlink = this\.add\.rectangle\(0, 0, 12 \* k, 12 \* k\)\.setStrokeStyle\(2, 0xffe14d\)/);
});
