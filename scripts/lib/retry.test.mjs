// ingest 재시도 · 진행 표시(scripts/lib/retry.mjs). 실제로 기다리지 않도록 가짜 sleep을 씁니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { withRetry, progressLine, stopMessage, RETRY_DELAYS_MS } from "./retry.mjs";

const fakeSleep = () => {
  const waits = [];
  return { waits, sleep: async (ms) => { waits.push(ms); } };
};

test("withRetry: 기본 간격은 2초 · 5초 · 10초", () => {
  assert.deepEqual(RETRY_DELAYS_MS, [2000, 5000, 10000]);
});

test("withRetry: 처음에 성공하면 기다리지 않음", async () => {
  const { waits, sleep } = fakeSleep();
  assert.equal(await withRetry(async () => "ok", { sleep }), "ok");
  assert.deepEqual(waits, []);
});

test("withRetry: 두 번 실패 후 세 번째에 성공하면 2초 · 5초만 기다리고 같은 일을 다시 함", async () => {
  const { waits, sleep } = fakeSleep();
  const calls = [];
  const retries = [];
  const result = await withRetry(async (attempt) => {
    calls.push(attempt);
    if (attempt < 3) throw new Error("fetch failed");
    return "vector";
  }, { sleep, onRetry: (err, next, wait) => retries.push([err.message, next, wait]) });
  assert.equal(result, "vector");
  assert.deepEqual(calls, [1, 2, 3]);
  assert.deepEqual(waits, [2000, 5000]);
  assert.deepEqual(retries, [["fetch failed", 2, 2000], ["fetch failed", 3, 5000]]);
});

test("withRetry: 처음 + 다시 시도 3번이 모두 실패하면 마지막 오류를 던지고 시도 횟수 4를 붙임", async () => {
  const { waits, sleep } = fakeSleep();
  let calls = 0;
  await assert.rejects(
    withRetry(async () => { calls += 1; throw new Error(`ENOTFOUND ${calls}`); }, { sleep }),
    (err) => err.message === "ENOTFOUND 4" && err.attempts === 4,
  );
  assert.equal(calls, 4);
  assert.deepEqual(waits, [2000, 5000, 10000]);
});

test("progressLine: 50조각마다 한 줄, 마지막 조각에도 한 줄", () => {
  const lines = [];
  for (let done = 1; done <= 485; done += 1) {
    const line = progressLine(done, 485);
    if (line) lines.push(line);
  }
  assert.deepEqual(lines, [
    "임베딩 50/485", "임베딩 100/485", "임베딩 150/485", "임베딩 200/485", "임베딩 250/485",
    "임베딩 300/485", "임베딩 350/485", "임베딩 400/485", "임베딩 450/485", "임베딩 485/485",
  ]);
});

test("stopMessage: 멈춘 조각 번호 · id · 저장을 마친 조각 수 · 옛 조각을 지우지 않았다는 안내", () => {
  const text = stopMessage({ step: "임베딩", index: 340, id: "11340-02", total: 485, savedCount: 340, error: new Error("fetch failed") });
  assert.match(text, /341번째 조각\(id 11340-02\)의 임베딩/);
  assert.match(text, /485개 중/);
  assert.match(text, /앞 340개/);
  assert.match(text, /옛 조각 삭제는 하지 않았습니다/);
  assert.match(text, /fetch failed/);
});
