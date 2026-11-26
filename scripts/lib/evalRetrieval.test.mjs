import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeRetrieval } from "./evalRetrieval.mjs";

const docs = (...ids) => ids.map(id => ({
  id,
  score: 0.9
}));

test("모든 정답 근거 검색 성공", () => {
  const result = gradeRetrieval(
    ["11384-01", "11384-10"],
    docs("11384-01", "11384-10")
  );

  assert.equal(result.hitAt6, true);
  assert.equal(result.recallAt6, 1);
  assert.equal(result.allHitAt6, true);
  assert.deepEqual(result.missingIds, []);
  assert.equal(result.retrievedCount, 2);
});

test("일부 정답 근거만 검색", () => {
  const result = gradeRetrieval(
    ["11384-01", "11384-10"],
    docs("11384-01", "11254-03")
  );

  assert.equal(result.hitAt6, true);
  assert.equal(result.recallAt6, 0.5);
  assert.equal(result.allHitAt6, false);
  assert.deepEqual(result.matchedIds, ["11384-01"]);
  assert.deepEqual(result.missingIds, ["11384-10"]);
});

test("관련 없는 근거만 검색", () => {
  const result = gradeRetrieval(
    ["11384-01"],
    docs("11254-03", "11377-01")
  );

  assert.equal(result.hitAt6, false);
  assert.equal(result.recallAt6, 0);
  assert.equal(result.allHitAt6, false);
});

test("상위 6개를 벗어난 근거는 제외", () => {
  const result = gradeRetrieval(
    ["11384-01"],
    docs("a", "b", "c", "d", "e", "f", "11384-01")
  );

  assert.equal(result.hitAt6, false);
  assert.equal(result.recallAt6, 0);
  assert.equal(result.retrievedCount, 6);
});

test("검색 결과가 없으면 적중률 0", () => {
  const result = gradeRetrieval(["11384-01"], []);

  assert.equal(result.hitAt6, false);
  assert.equal(result.recallAt6, 0);
  assert.equal(result.allHitAt6, false);
  assert.equal(result.retrievedCount, 0);
});

test("debug 미제공은 측정 불가로 처리", () => {
  assert.equal(
    gradeRetrieval(["11384-01"], undefined),
    null
  );

  assert.equal(
    gradeRetrieval(["11384-01"], null),
    null
  );
});

test("정답 근거가 없으면 측정 불가로 처리", () => {
  assert.equal(
    gradeRetrieval([], docs("11384-01")),
    null
  );
});

test("중복된 근거는 한 번만 계산", () => {
  const result = gradeRetrieval(
    ["11384-01", "11384-01", "11384-10"],
    docs("11384-01", "11384-01")
  );

  assert.equal(result.recallAt6, 0.5);
  assert.deepEqual(result.matchedIds, ["11384-01"]);
  assert.deepEqual(result.missingIds, ["11384-10"]);
});
