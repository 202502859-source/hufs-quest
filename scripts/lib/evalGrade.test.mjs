// eval 범위 밖 문항의 거절 판정(scripts/lib/evalGrade.mjs). 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { isRefusal } from "./evalGrade.mjs";

test("isRefusal: mode none이면 거절", () => {
  assert.equal(isRefusal("", "none"), true);
});

test("isRefusal: 원래 표현(찾지 못 · 찾을 수 없 · couldn't find)은 숫자가 있어도 거절", () => {
  assert.equal(isRefusal("공개된 학사 안내에서는 오늘 학식의 메뉴에 대한 정보를 찾을 수 없습니다.", "ai"), true);
  assert.equal(isRefusal("2027학년도 일정은 찾지 못했어요.", "ai"), true);
  assert.equal(isRefusal("I couldn't find this in the public academic guides.", "ai"), true);
});

test("isRefusal: 11/21 셔틀버스 답(공개되지 않았습니다 … 문의)은 거절", () => {
  const shuttle = "셔틀버스 시간표에 대한 정보는 공개되지 않았습니다. 구체적인 정보를 확인하려면 담당 부서에 문의하시기 바랍니다.";
  assert.equal(isRefusal(shuttle, "ai"), true);
  assert.equal(isRefusal("해당 내용은 공개된 자료로는 확인할 수 없습니다. [1]", "ai"), true);
  assert.equal(isRefusal("That information is not publicly available.", "ai"), true);
});

test("isRefusal: 새 거절 표현이 있어도 숫자를 함께 말하면 거절로 치지 않음(지어냄)", () => {
  assert.equal(isRefusal("셔틀버스는 8시 30분에 출발합니다. 자세한 시간표는 공개되지 않았습니다.", "ai"), false);
  assert.equal(isRefusal("정확한 내용은 확인할 수 없지만 보통 3월에 신청합니다.", "ai"), false);
});

test("isRefusal: 거절 표현이 없는 답은 거절이 아님", () => {
  assert.equal(isRefusal("셔틀버스는 정문에서 출발합니다.", "ai"), false);
  assert.equal(isRefusal("", "ai"), false);
});
