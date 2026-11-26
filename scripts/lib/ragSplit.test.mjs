import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { splitDoubleMajor } from "./ragSplit.mjs";
import { buildMetadata } from "./ragMetadata.mjs";

const chunks = JSON.parse(readFileSync(
  new URL("../../data/chunks.json", import.meta.url),
  "utf8"
));

const originals = chunks.filter(
  c => c.id.startsWith("11384-")
);

const result = originals.flatMap(splitDoubleMajor);

const find = id => {
  const chunk = result.find(c => c.id === id);
  assert.ok(chunk, `Missing chunk: ${id}`);
  return chunk;
};

test("이중전공 12개를 19개로 세분화", () => {
  assert.equal(originals.length, 12);
  assert.equal(result.length, 19);
});

test("세분화 조각의 ID 중복 방지", () => {
  assert.equal(
    new Set(result.map(c => c.id)).size,
    result.length
  );
});

test("모든 원본 조각을 손실 없이 복원", () => {
  for (const original of originals) {
    const parts = result.filter(
      c => c.parent_id === original.id
    );

    assert.ok(parts.length);

    const restored = [
      original.text.split("\n")[0],
      ...parts.flatMap(
        c => c.text.split("\n").slice(1)
      )
    ].join("\n");

    assert.equal(restored, original.text);
  }
});

test("출처 및 원본 메타데이터 보존", () => {
  for (const c of result) {
    const parent = originals.find(
      o => o.id === c.parent_id
    );

    assert.ok(parent);
    assert.equal(c.url, parent.url);
    assert.equal(c.title, parent.title);
    assert.equal(c.section, parent.section);
    assert.equal(c.collected_at, parent.collected_at);
  }
});

test("학번별 이중전공 우선 선발 기준 보존", () => {
  assert.ok(find("11384-03-a").text.includes("34학점"));
  assert.ok(find("11384-03-a").text.includes("32학점"));
  assert.ok(!find("11384-03-b").text.includes("32학점"));
  assert.ok(!find("11384-03-c").text.includes("32학점"));
});

test("배정비율과 예외 조건 보존", () => {
  assert.ok(find("11384-03-c").text.includes("150%"));
  assert.ok(find("11384-03-c").text.includes("100%"));
});

test("캠퍼스 제한표의 문맥 보존", () => {
  const c = find("11384-04-b");

  assert.ok(c.text.includes("서울캠퍼스"));
  assert.ok(c.text.includes("글로벌캠퍼스"));
  assert.ok(c.text.includes("제한함"));
});

test("후기 이중전공 필수 조건 및 예외 보존", () => {
  assert.ok(find("11384-06").text.includes("9학기"));
  assert.ok(find("11384-09").text.includes("신청 불가"));

  assert.equal(
    buildMetadata(find("11384-11-a")).subtopic,
    "late_double_major"
  );
});

test("원문 구조 변경 시 무조건 세분화하지 않음", () => {
  const original = originals.find(
    c => c.id === "11384-03"
  );

  assert.throws(() => splitDoubleMajor({
    ...original,
    text: original.text + "\n추가 문장"
  }));
});

test("세분화 대상이 아닌 조각은 원문과 ID 유지", () => {
  const original = chunks.find(c => c.id === "11377-01");

  assert.deepEqual(splitDoubleMajor(original), [{
    ...original,
    parent_id: original.id
  }]);
});
