// 실행: npm test   (Windows PowerShell: npm.cmd test)
// 실제 졸업이수학점 페이지 HTML(fixtures/11373.html)로 대표 행이 원문 숫자 그대로 문장이 되는지 확인합니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as cheerio from "cheerio";
import { expandTable, tableRecords } from "./tableGrid.mjs";
import { buildTableChunks, josa } from "./tableSentences.mjs";
import { TABLE_PAGES } from "../tablePages.mjs";

const html = readFileSync(new URL("./fixtures/11373.html", import.meta.url), "utf8");
const result = buildTableChunks({
  pageId: "11373",
  title: "졸업이수학점",
  url: "https://www.hufs.ac.kr/hufs/11373/subview.do",
  html,
  config: TABLE_PAGES["11373"],
});
const sentences = result.review.flatMap((r) => r.sentences.map((s) => s.text));
const find = (...parts) => {
  const hits = sentences.filter((s) => parts.every((p) => s.includes(p)));
  assert.equal(hits.length, 1, `문장 1개를 기대했지만 ${hits.length}개: ${parts.join(" / ")}`);
  return hits[0];
};

test("rowspan/colspan을 풀면 모든 행의 칸 수가 같다", () => {
  const $ = cheerio.load(`<table>
    <tr><th rowspan="2" colspan="2">구분</th><th colspan="2">학점</th></tr>
    <tr><th>전공</th><th>교양</th></tr>
    <tr><th rowspan="2">A대학</th><th>이중</th><td>42</td><td rowspan="2">32</td></tr>
    <tr><th>부</th><td>54</td></tr>
  </table>`);
  const { grid, width } = expandTable($, $("table")[0]);
  assert.equal(width, 4);
  assert.ok(grid.every((row) => row.length === 4 && row.every(Boolean)));
  const t = tableRecords($, $("table")[0]);
  assert.equal(t.headerRows, 2);
  assert.equal(t.labelCols, 2);
  assert.deepEqual(t.records[1].labels, ["A대학", "부"]);
  assert.deepEqual(t.records[1].cells.map((c) => [c.header.join(">"), c.text, c.merged]), [
    ["학점>전공", "54", false],
    ["학점>교양", "32", true],
  ]);
});

test("서울 2025 이후 / 모든 대학(사범대학 제외) / 이중전공 → 126학점", () => {
  assert.equal(
    find("서울캠퍼스 2025학년도 이후", "모든 대학(사범대학 제외)에서 이중전공을"),
    "[졸업이수학점 > 서울캠퍼스 2025학년도 이후 입학생 졸업학점 배분표] 모든 대학(사범대학 제외)에서 이중전공을 하는 학생의 졸업학점은 126학점이며, 전공 42학점, 이중전공 42학점, 교양 32학점, 기초 6학점을 이수해야 한다.",
  );
});

test("구분 이름의 띄어쓰기를 다듬는다 (괄호 앞 공백 없음, '모든 대학')", () => {
  const labels = result.review.flatMap((r) => r.sentences.flatMap((s) => s.labels));
  assert.ok(labels.every((l) => !/ \(/.test(l) && !l.includes("모든대학")), labels.find((l) => / \(|모든대학/.test(l)));
  assert.ok(sentences.some((s) => s.includes("모든 대학(사범대학, AI융합대학 제외)에서")));
  assert.ok(sentences.some((s) => s.includes("공과대학(2015~2018학번)에서")));
});

test("사범대학 교양 값은 원문 '교양' 열 그대로 (16·18·20·22·32)", () => {
  assert.match(find("서울캠퍼스 2025학년도 이후", "사범대학에서 전공심화+부전공을"), /교양 20학점/);
  assert.match(find("서울캠퍼스 2015~2024학년도", "사범대학(2015~2023)에서 이중전공(사범대)를"), /교양 18학점, 교직 22학점/);
  assert.match(find("서울캠퍼스 2015~2024학년도", "사범대학(2015~2023)에서 전공심화+부전공을"), /교양 22학점, 교직 22학점/);
});

test("서울 2025 이후 / 사범대학 / 이중전공(사범대) → 140학점", () => {
  const s = find("서울캠퍼스 2025학년도 이후", "사범대학에서 이중전공(사범대)를");
  assert.match(s, /졸업학점은 140학점이며, 전공 50학점, 이중전공 50학점, 교양 16학점, 교직 24학점을/);
});

test("서울 2025 이후 / 사범대학 / 전공심화(단일전공) → 합쳐진 134학점과 교직 24학점", () => {
  const s = find("서울캠퍼스 2025학년도 이후", "사범대학에서 전공심화(단일전공)을");
  assert.match(s, /졸업학점은 134학점이며, 전공 68학점, 교양 32학점, 교직 24학점을/);
});

test("서울 2015~2024 / 사범대학(2024) / 부전공 → 134학점", () => {
  const s = find("서울캠퍼스 2015~2024학년도", "사범대학(2024)에서 부전공을");
  assert.match(s, /졸업학점은 134학점이며, 전공 50학점, 부전공 21학점, 교양 32학점, 교직 24학점을/);
});

test("글로벌 2025 이후 / 모든 대학(융합인재대학 제외) / 이중전공 → 126학점, 융합인재대학은 150학점", () => {
  const s = find("글로벌캠퍼스 2025학년도 이후", "모든 대학(융합인재대학 제외)에서 이중전공을");
  assert.match(s, /졸업학점은 126학점이며, 전공 42학점, 이중전공 42학점, 기초 6학점, 교양 32학점을/);
  assert.equal(
    find("글로벌캠퍼스 2025학년도 이후", "융합인재대학 학생의"),
    "[졸업이수학점 > 글로벌캠퍼스 2025학년도 이후 입학생 졸업학점 배분표] 융합인재대학 학생의 졸업학점은 150학점이며, 교양 32학점을 이수해야 한다.",
  );
});

test("150학점은 서울캠퍼스 문장에 나오지 않는다", () => {
  for (const s of sentences.filter((x) => x.includes("서울캠퍼스"))) assert.doesNotMatch(s, /150/);
});

test("괄호 값(42 (50), 140 (148))이 있는 행은 문장을 만들지 않고 보류 목록에 넣는다", () => {
  assert.ok(sentences.every((s) => !s.includes("148") && !s.includes("(50)")));
  const held = result.ambiguous.filter((a) => a.labels.includes("비사범대(복수교직)"));
  assert.equal(held.length, 3);
  assert.ok(held.every((a) => a.reason.includes('"42 (50)"')));
  assert.equal(result.ambiguous.length, 15);
  const modules = result.ambiguous.filter((a) => a.labels[0] === "융합인재대학");
  assert.equal(modules.length, 12);
});

test("문장 속 숫자는 모두 그 행의 원문 칸에 있다", () => {
  for (const r of result.review) {
    for (const s of r.sentences) {
      const body = s.text.replace(/^\[[^\]]*\]/, "").replace(/\([^)]*\)/g, "");
      const cellNumbers = new Set(s.cells.map((c) => c.text));
      for (const n of body.match(/\d+(?=학점)/g) ?? []) assert.ok(cellNumbers.has(n), `${n}이 원문 칸에 없음: ${s.text}`);
    }
  }
});

test("조각 id는 기존 조각(11373-01 …)과 겹치지 않는 11373-tNN 형식이다", () => {
  assert.equal(result.chunks.length, 19);
  assert.ok(result.chunks.every((c, i) => c.id === `11373-t${String(i + 1).padStart(2, "0")}`));
  assert.deepEqual(Object.keys(result.chunks[0]).sort(), ["id", "section", "text", "title", "url"]);
});

test("조사 고르기", () => {
  assert.equal(josa("이중전공", "을", "를"), "을");
  assert.equal(josa("이중전공(사범대)", "을", "를"), "를");
  assert.equal(josa("1학기 이수자", "은", "는"), "는");
});
