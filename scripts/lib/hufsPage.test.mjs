// 실행: npm test   (Windows PowerShell: npm.cmd test)
// 학교 페이지 본문 정리 규칙: 개인 연락처 줄 제거 · 캠퍼스 표시 · 짧은 조각 제거 · 각주 기호 정리
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractPage, toChunks, stripFootnotes, campusTag, isPersonalContact } from "./hufsPage.mjs";

const page = (body) => `<html><head><title>t</title></head><body>
<div class="menu-title">휴·복학</div><div id="subContent">${body}</div></body></html>`;

const LONG = "휴학은 학기 개시일 전까지 학사정보시스템에서 신청하며, 일반휴학은 통산 6학기까지 가능합니다.";

test("개인 연락처 줄 제거: 사람 이름이 붙은 연락처 · 개인 메일만 지움", () => {
  const { lines, personalRemoved } = extractPage(page(`
    <h2>문의</h2>
    <p>담당자 홍길동</p>
    <p>담당자 : 김○○ (내선 2130)</p>
    <p>홍길동 선생님 02-2173-1234</p>
    <p>이영희 주무관 | 2135</p>
    <p>E-MAIL : gildong@hufs.ac.kr</p>
    <p>서울 학사종합지원센터</p>
  `));
  assert.equal(personalRemoved, 5);
  assert.deepEqual(lines.slice(1), ["서울 학사종합지원센터"]);
});

test("부서 대표 전화 · 부서 공용 메일 · 직책만 있는 줄은 남김", () => {
  const keep = [
    "문의 : 학사종합지원센터 TEL : 02-2173-2130",
    "TEL : 02-2173-2112",
    "글로벌캠퍼스 : TEL : 031-330-4027",
    "E-MAIL : haksamil@hufs.ac.kr",
    "E-MAIL : academic@hufs.ac.kr",
    "인사팀 | 인사팀장 | 2163",
    "장학팀 | 장학 팀장 | 2135",
    "담당자 : 학사종합지원센터",
    "담당자 장학팀 02-2173-2138",
    "2015~2024학번 126학점",
    "서울 2015-2024 입학생",
  ];
  for (const line of keep) assert.equal(isPersonalContact(line), false, line);
  const { lines, personalRemoved } = extractPage(page(keep.map((t) => `<p>${t}</p>`).join("")));
  assert.equal(personalRemoved, 0);
  assert.deepEqual(lines, keep);
});

// 11/20 이전 collect 결과(data/chunks.json)의 실제 조각으로, 새 규칙에서도 문의 조각 · 전화안내(11159)가 그대로 남는지 확인
test("실제 조각: 문의 조각 · 전화안내(11159) 페이지는 줄도 조각도 빠지지 않음(40자 미만 연락처 조각 포함)", () => {
  const data = JSON.parse(readFileSync(new URL("../../data/chunks.json", import.meta.url), "utf8"));
  const targets = data.filter((c) => c.id.startsWith("11159-") || (c.section || "").includes("문의"));
  assert.ok(targets.length >= 60, `대상 조각 ${targets.length}개`);
  let short = 0;
  for (const c of targets) {
    const body = c.text.slice(c.text.indexOf("\n") + 1).split("\n");
    for (const line of body) assert.equal(isPersonalContact(line), false, `${c.id}: ${line}`);
    if (body.join("\n").length < 40) short += 1;
    const again = toChunks({ pageId: "x", title: c.title, url: c.url, lines: body });
    assert.equal(again.length, 1, `${c.id} 조각이 빠짐`);
  }
  assert.ok(short >= 20, `40자 미만 연락처 조각 ${short}개도 남아야 함`);
});

test("캠퍼스 표시: 글로벌캠퍼스만 → [글로벌], 서울캠퍼스만 → [서울], 둘 다 · 둘 다 없음 → 표시 없음", () => {
  assert.equal(campusTag("글로벌캠퍼스 학생은 ..."), "[글로벌] ");
  assert.equal(campusTag("서울캠퍼스 학생은 ..."), "[서울] ");
  assert.equal(campusTag("서울캠퍼스와 글로벌캠퍼스 모두"), "");
  assert.equal(campusTag("캠퍼스 구분 없음"), "");

  const chunks = toChunks({
    pageId: "11387", title: "휴·복학", url: "u",
    lines: ["\u0000H2서울", `서울캠퍼스 ${LONG}`, "\u0000H2글로벌", `글로벌캠퍼스 ${LONG}`, "\u0000H2공통", LONG],
  });
  assert.deepEqual(chunks.map((c) => c.text.split("\n")[0]), ["[서울] [휴·복학 > 서울]", "[글로벌] [휴·복학 > 글로벌]", "[휴·복학 > 공통]"]);
});

test("머리글을 뺀 본문이 40자 미만인 조각은 버리고(연락처 조각은 예외), id는 남은 조각 순서대로", () => {
  const chunks = toChunks({
    pageId: "11387", title: "휴·복학", url: "u",
    lines: ["\u0000H2개요", LONG, "\u0000H2참고", "자세한 내용은 아래를 보세요", "\u0000H2문의", "장학팀", "02-2173-2138", "\u0000H2복학", LONG],
  });
  assert.deepEqual(chunks.map((c) => c.section), ["개요", "문의", "복학"]);
  assert.deepEqual(chunks.map((c) => c.id), ["11387-01", "11387-02", "11387-03"]);
  // 경계: 정확히 40자는 남김
  const forty = "가".repeat(40);
  assert.equal(toChunks({ pageId: "1", title: "t", url: "u", lines: [forty] }).length, 1);
  assert.equal(toChunks({ pageId: "1", title: "t", url: "u", lines: [forty.slice(1)] }).length, 0);
});

test("각주 기호(* · ** · ***) 정리", () => {
  assert.equal(stripFootnotes("졸업학점 126학점**"), "졸업학점 126학점");
  assert.equal(stripFootnotes("* 재학생은 1차 신청기간에 신청"), "재학생은 1차 신청기간에 신청");
  assert.equal(stripFootnotes("교양 42(**), 전공 54"), "교양 42, 전공 54");
  assert.equal(stripFootnotes("기호 없는 줄 , 그대로"), "기호 없는 줄 , 그대로");
  const { lines } = extractPage(page("<p>*** 2025학번부터 적용</p>"));
  assert.deepEqual(lines, ["2025학번부터 적용"]);
});
