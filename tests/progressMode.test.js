// 로그인 방식(VITE_AUTH_MODE)과 진행 저장 방식(VITE_PROGRESS_MODE)의 조합 규칙을 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveProgressMode } from "../src/data/progressApi.js";

test("기본값은 둘 다 mock", () => {
  assert.equal(resolveProgressMode(undefined, "mock"), "mock");
  assert.equal(resolveProgressMode("mock", "mock"), "mock");
});

test("진짜 메일 로그인 + 가짜 진행 저장: 로그인만 먼저 시험", () => {
  assert.equal(resolveProgressMode("mock", "real"), "mock");
  assert.equal(resolveProgressMode(undefined, "real"), "mock");
});

test("진짜 로그인 + 진짜 진행 저장", () => {
  assert.equal(resolveProgressMode("real", "real"), "real");
});

test("가짜 로그인 + 진짜 진행 저장은 진짜 토큰이 없으므로 진행 저장도 mock", () => {
  assert.equal(resolveProgressMode("real", "mock"), "mock");
});

test("알 수 없는 값은 mock", () => {
  assert.equal(resolveProgressMode("REAL", "real"), "mock");
  assert.equal(resolveProgressMode("yes", "real"), "mock");
});
