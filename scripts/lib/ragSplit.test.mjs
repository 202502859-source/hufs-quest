import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { splitDoubleMajor, splitRagChunk } from "./ragSplit.mjs";
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

// ── 11/26: 수강신청지침(11377-02) 분리 ──
test("11384 이중전공 분리 결과는 규칙 일반화 전과 한 글자도 같음", () => {
  // 일반화 전 splitDoubleMajor(11/26 main)로 만든 결과(JSON)의 SHA-256
  const json = JSON.stringify(originals.flatMap(splitRagChunk));
  assert.equal(
    createHash("sha256").update(json).digest("hex"),
    "264f498f17e44c99f4739007a2680eafed2557e3d449c350059265ba4044413b"
  );
  assert.equal(splitDoubleMajor, splitRagChunk);
});

test("11377-02: 일정 표(-a) · 본인 신청 · 성적 불인정(-b) 두 조각, 원문 줄 순서 그대로, 머리글 유지", () => {
  const original = chunks.find(c => c.id === "11377-02");
  const lines = original.text.split("\n");
  assert.equal(lines.length, 11, "머리글 1줄 + 본문 10줄");

  const parts = splitRagChunk(original);
  assert.deepEqual(parts.map(c => c.id), ["11377-02-a", "11377-02-b"]);
  assert.deepEqual(parts.map(c => c.split_label), ["수강신청 일정", "본인 신청·미신청 성적 불인정"]);

  for (const c of parts) {
    assert.equal(c.text.split("\n")[0], lines[0], "머리글 유지");
    assert.equal(c.parent_id, "11377-02");
    assert.equal(c.title, "수강신청지침");
    assert.equal(c.url, original.url);
    assert.equal(c.section, original.section);
    assert.equal(c.collected_at, original.collected_at);
  }

  // 원문 줄 그대로: -a는 본문 1~9줄(일정 표 · "일정별 신청학년…" · "(예시 …)"), -b는 마지막 줄
  assert.deepEqual(parts[0].text.split("\n").slice(1), lines.slice(1, 10));
  assert.deepEqual(parts[1].text.split("\n").slice(1), lines.slice(10));
  assert.ok(parts[0].text.includes("일정별 신청학년은 해당 학기 등록횟수를 기준으로 함"));
  assert.ok(parts[0].text.includes("(예시 :"));
  assert.ok(parts[1].text.includes("수강신청하지 않고 수업에 참여한 경우 성적으로 인정하지 않음"));

  // 합치면 원문과 같음
  assert.equal(
    [lines[0], ...parts.flatMap(c => c.text.split("\n").slice(1))].join("\n"),
    original.text
  );
});

test("11377-02: 제목 · 줄 수가 바뀌면 나누지 않고 오류", () => {
  const original = chunks.find(c => c.id === "11377-02");
  assert.throws(() => splitRagChunk({ ...original, title: "이중전공" }), /예상하지 못한 원문 제목/);
  assert.throws(() => splitRagChunk({ ...original, text: original.text + "\n추가 문장" }), /원문 구조 변경/);
});
