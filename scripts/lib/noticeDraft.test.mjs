import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseExtractOutput, parseArticleUrl, buildDeadlineEntry, insertDeadline, comparisonTable } from "./noticeDraft.mjs";

// 공지 추출 도우미(scripts/extract-notice.mjs) 출력 모양을 흉내 낸 시험용 값(실제 공지 아님)
const output = `=== AI 원본 추출 결과 ===
{ "title": { "value": "x", "evidence": "x" } }

=== 공지 추출 JSON 초안 ===
{
  "title": "2026학년도 시험 장학금 신청 안내",
  "evidence": {
    "title": "2026학년도 시험 장학금 신청 안내",
    "dept": "담당 부서: 학생지원팀",
    "category": "장학금",
    "startsAt": "신청 시작: 2026년 11월 24일 09:00",
    "deadline": "신청 마감: 2026년 11월 27일 17:00 {괄호}"
  }
}

=== shared/deadlines.js 입력용 초안 ===
{
  "id": "",
  "title": { "ko": "2026학년도 시험 장학금 신청 안내", "en": "" },
  "dept": { "ko": "학생지원팀", "en": "" },
  "category": "scholarship",
  "startsAt": "2026-11-24T09:00:00+09:00",
  "deadline": "2026-11-27T17:00:00+09:00",
  "url": "",
  "checked": { "on": "", "by": "" }
}

※ 사람이 확인한 후에만 공지 데이터에 반영하세요.`;

const URL_OK = "https://www.hufs.ac.kr/bbs/hufs/2182/999001/artclView.do";

test("도우미 출력에서 초안과 근거를 꺼냄(문자열 안의 괄호도 안전)", () => {
  const { draft, evidence } = parseExtractOutput(output);
  assert.equal(draft.category, "scholarship");
  assert.equal(evidence.deadline, "신청 마감: 2026년 11월 27일 17:00 {괄호}");
  assert.throws(() => parseExtractOutput("아무것도 없음"), /입력용 초안/);
});

test("원문 주소: 학교 공지 본문 주소만, 쿼리는 버림", () => {
  assert.deepEqual(parseArticleUrl(URL_OK + "?layout=unknown"), { site: "hufs", boardNo: "2182", postId: "999001", url: URL_OK });
  assert.throws(() => parseArticleUrl("https://evil.example/bbs/hufs/1/2/artclView.do"));
  assert.throws(() => parseArticleUrl("https://www.hufs.ac.kr/hufs/11282/subview.do"));
});

test("항목: checked 없음 · 영문은 비워 둠 · 빠진 칸은 확인할 것에 적음", () => {
  const { entry, problems } = buildDeadlineEntry(parseExtractOutput(output).draft, URL_OK);
  assert.equal(entry.id, "notice-999001");
  assert.equal(entry.checked, undefined);
  assert.equal(entry.title.en, "");
  assert.equal(entry.startsAt, "2026-11-24T09:00:00+09:00");
  assert.ok(problems.some((p) => p.startsWith("checked")));

  const missing = buildDeadlineEntry({ title: { ko: "" }, deadline: "11월 27일" }, URL_OK);
  assert.equal(missing.entry.deadline, "");
  assert.ok(missing.problems.some((p) => p.startsWith("마감")));
  assert.ok(missing.problems.some((p) => p.startsWith("제목")));
});

test("deadlines.js에 넣기: DEADLINES 끝에 추가, 원본은 그대로 · 중복 주소 거부", async () => {
  const source = readFileSync(new URL("../../shared/deadlines.js", import.meta.url), "utf8");
  const { entry } = buildDeadlineEntry(parseExtractOutput(output).draft, URL_OK);
  const next = insertDeadline(source, entry);
  assert.ok(next.startsWith(source.slice(0, source.lastIndexOf("\n];"))));
  assert.ok(next.endsWith("\n];\n") || next.endsWith("\n];"));
  assert.match(next, /id: "notice-999001"/);
  assert.doesNotMatch(next.slice(next.indexOf('id: "notice-999001"')), /^\s*checked:/m);
  assert.throws(() => insertDeadline(next, entry), /이미 들어 있는/);

  // 넣은 결과가 JS로 읽히고, 새 항목은 checked가 없음
  const mod = await import("data:text/javascript," + encodeURIComponent(next));
  const added = mod.DEADLINES.at(-1);
  assert.equal(added.id, "notice-999001");
  assert.equal(added.checked, undefined);
});

test("비교표: 칸마다 입력값 ↔ 근거 문장, | 는 이스케이프", () => {
  const { draft, evidence } = parseExtractOutput(output);
  const { entry } = buildDeadlineEntry(draft, URL_OK);
  const table = comparisonTable(entry, { ...evidence, dept: "부서 | 학생지원팀" });
  assert.match(table, /\| 마감 \| 2026-11-27T17:00:00\+09:00 \| 신청 마감: 2026년 11월 27일 17:00 \{괄호\} \| \[ \] \|/);
  assert.match(table, /부서 \\\| 학생지원팀/);
});
