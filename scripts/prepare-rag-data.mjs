// 기존 검색 데이터를 변경하지 않고
// Advanced RAG 시험용 데이터를 생성합니다.

import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { buildMetadata } from "./lib/ragMetadata.mjs";
import { splitRagChunk } from "./lib/ragSplit.mjs";

const source = new URL("../data/chunks.json", import.meta.url);
const target = new URL(
  "../data/chunks-next-full.json", import.meta.url
);

const manualSource = new URL(
  "../data/manual/sugang2026-2-seoul.json",
  import.meta.url
);

const originalBytes = await readFile(source);
const originalHash = createHash("sha256")
  .update(originalBytes)
  .digest("hex");

const originals = JSON.parse(
  originalBytes.toString("utf8")
);

assert.ok(Array.isArray(originals));
// 11/27 2027학년도 학사일정 조각 4개(11360-2027-01~04) 추가로 510 → 514
assert.equal(originals.length, 514);

assert.equal(
  new Set(originals.map(c => c.id)).size,
  originals.length,
  "기존 데이터 ID 중복"
);

// 신규 수동 자료를 기존 원본과 별도로 읽습니다.
const manual = JSON.parse(
  await readFile(manualSource, "utf8")
);

assert.ok(Array.isArray(manual));
assert.equal(manual.length, 15);

const fields = [
  "id", "title", "url",
  "section", "text", "collected_at"
].sort();

for (const chunk of manual) {
  assert.deepEqual(
    Object.keys(chunk).sort(),
    fields
  );
  assert.equal(buildMetadata(chunk).topic, "registration");
  assert.equal(buildMetadata(chunk).campus, "seoul");
  assert.ok(buildMetadata(chunk).subtopic);
}

const combined = [...originals, ...manual];

assert.equal(combined.length, 529);
assert.equal(
  new Set(combined.map(c => c.id)).size,
  combined.length,
  "원본 및 수동 자료 ID 중복"
);

// 원문 세분화 및 메타데이터 연결
const next = combined
  .flatMap(splitRagChunk)
  .map(chunk => ({
    ...chunk,
    ...buildMetadata(chunk)
  }));

// 이중전공 세분화 +7, 수강신청지침(11377-02) 세분화 +1(11/26 C17), 2027학년도 학사일정 조각 +4(11/27)
assert.equal(next.length, 537);

assert.equal(
  new Set(next.map(c => c.id)).size,
  next.length,
  "신규 데이터 ID 중복"
);

const originalMap = new Map(
  combined.map(c => [c.id, c])
);

// 출처 및 원문 연결 확인
for (const chunk of next) {
  const parent = originalMap.get(chunk.parent_id);

  assert.ok(parent, `부모 조각 없음: ${chunk.id}`);

  assert.equal(chunk.url, parent.url);
  assert.equal(chunk.title, parent.title);
  assert.equal(chunk.section, parent.section);
  assert.equal(chunk.collected_at, parent.collected_at);

  assert.ok(chunk.text.trim());
  assert.ok(chunk.topic);

  if (
    chunk.cohort_min !== null &&
    chunk.cohort_max !== null
  ) {
    assert.ok(chunk.cohort_min <= chunk.cohort_max);
  }
}

// 모든 원본 조각 복원 확인
for (const original of combined) {
  const parts = next.filter(
    c => c.parent_id === original.id
  );

  assert.ok(parts.length);

  const restored = parts.length === 1
    ? parts[0].text
    : [
        original.text.split("\n")[0],
        ...parts.flatMap(
          c => c.text.split("\n").slice(1)
        )
      ].join("\n");

  assert.equal(
    restored,
    original.text,
    `원문 손실: ${original.id}`
  );
}

// 원본 파일 해시 재검사
const currentHash = createHash("sha256")
  .update(await readFile(source))
  .digest("hex");

assert.equal(currentHash, originalHash);

// 기존 결과 파일은 덮어쓰지 않습니다.
await writeFile(
  target,
  JSON.stringify(next, null, 2) + "\n",
  { flag: "wx" }
);

const topics = {};
const campuses = {};

for (const chunk of next) {
  topics[chunk.topic] = (topics[chunk.topic] || 0) + 1;

  const campus = chunk.campus || "unknown";
  campuses[campus] = (campuses[campus] || 0) + 1;
}

console.log("===== 개선 데이터 생성 완료 =====");
console.log("원본 조각:", originals.length);
console.log("수강편람 신규 조각:", manual.length);
console.log("세분화 증가 조각:", next.length - combined.length);
console.log("신규 조각:", next.length);
console.log("증가 조각:", next.length - originals.length);
console.log("중복 ID: 0개");
console.log("원문 손실: 0개");
console.log("출처 변경: 0개");
console.log("원본 SHA-256:", originalHash);

console.log("\n===== 주제별 조각 수 =====");
console.log(topics);

console.log("\n===== 캠퍼스별 조각 수 =====");
console.log(campuses);

console.log("\n저장 위치: data/chunks-next-full.json");
console.log("외부 API 호출 및 DB 변경 없음");
