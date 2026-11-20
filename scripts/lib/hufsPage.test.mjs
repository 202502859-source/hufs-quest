// 실행: npm test   (Windows PowerShell: npm.cmd test)
// 학교 페이지 본문 정리 규칙: 개인정보 줄 제거 · 캠퍼스 표시 · 짧은 조각 제거 · 각주 기호 정리
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPage, toChunks, stripFootnotes, campusTag } from "./hufsPage.mjs";

const page = (body) => `<html><head><title>t</title></head><body>
<div class="menu-title">휴·복학</div><div id="subContent">${body}</div></body></html>`;

const LONG = "휴학은 학기 개시일 전까지 학사정보시스템에서 신청하며, 일반휴학은 통산 6학기까지 가능합니다.";

test("개인정보 줄 제거: 전화번호 · 이메일 · 담당자 이름 줄은 버리고 부서 이름 · 위치는 남김", () => {
  const { lines, privacyRemoved } = extractPage(page(`
    <h2>문의</h2>
    <p>서울 학사종합지원센터</p>
    <p>본관 1층 103호</p>
    <p>TEL : 02-2173-2130</p>
    <p>글로벌캠퍼스 : TEL : 031-330-4027</p>
    <p>연락처 02)2173-2112</p>
    <p>휴대전화 010-1234-5678</p>
    <p>E-MAIL : haksamil@hufs.ac.kr</p>
    <p>담당자 홍길동</p>
    <p>담당자 : 김○○ (내선 2130)</p>
  `));
  assert.equal(privacyRemoved, 7);
  assert.ok(lines.includes("서울 학사종합지원센터"));
  assert.ok(lines.includes("본관 1층 103호"));
  const joined = lines.join("\n");
  assert.doesNotMatch(joined, /\d{3,4}-\d{4}/);
  assert.doesNotMatch(joined, /@/);
  assert.doesNotMatch(joined, /홍길동|김○○/);
});

test("개인정보가 아닌 숫자(학번 범위 · 날짜 · 학점)는 남김", () => {
  const keep = ["2015~2024학번 126학점", "2026.03.02 ~ 2026.03.09", "서울 2015-2024 입학생", "담당 부서: 학사종합지원센터"];
  const { lines, privacyRemoved } = extractPage(page(keep.map((t) => `<p>${t}</p>`).join("")));
  assert.equal(privacyRemoved, 0);
  assert.deepEqual(lines, keep);
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

test("머리글을 뺀 본문이 40자 미만인 조각은 버리고, id는 남은 조각 순서대로", () => {
  const short = "서울 학사종합지원센터"; // 문의 구간에서 전화번호를 지우면 이 정도만 남음
  const chunks = toChunks({
    pageId: "11387", title: "휴·복학", url: "u",
    lines: ["\u0000H2개요", LONG, "\u0000H2문의", short, "\u0000H2복학", LONG],
  });
  assert.deepEqual(chunks.map((c) => c.section), ["개요", "복학"]);
  assert.deepEqual(chunks.map((c) => c.id), ["11387-01", "11387-02"]);
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
