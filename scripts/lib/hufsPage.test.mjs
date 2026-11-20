// 실행: npm test   (Windows PowerShell: npm.cmd test)
// 학교 페이지 본문 정리 규칙: 개인 연락처 줄 제거 · 캠퍼스 표시 · 짧은 조각 제거 · 각주 기호 정리
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractPage, toChunks, stripFootnotes, campusTag, isPersonalContact, maskPersonalContact, isGlobalOnly, dropGlobalOnly } from "./hufsPage.mjs";

const page = (body) => `<html><head><title>t</title></head><body>
<div class="menu-title">휴·복학</div><div id="subContent">${body}</div></body></html>`;

const LONG = "휴학은 학기 개시일 전까지 학사정보시스템에서 신청하며, 일반휴학은 통산 6학기까지 가능합니다.";

test("개인 연락처 가림: 이름 표시가 있는 줄은 지우지 않고 이름 · 메일 · 직통번호만 가림", () => {
  const M = "(개인 연락처 생략)";
  assert.equal(maskPersonalContact("담당자 홍길동 (gildong@hufs.ac.kr, 02-2173-1234)").line, `담당자 ${M}`);
  assert.equal(maskPersonalContact("담당자 : 김○○ (내선 2130)").line, `담당자 : ${M}`);
  assert.equal(maskPersonalContact("학사종합지원센터 홍길동 선생님 02-2173-1234").line, `학사종합지원센터 ${M}`);
  assert.equal(maskPersonalContact("장학팀 이영희 주무관 | 2135").line, `장학팀 ${M}`);
  assert.equal(maskPersonalContact("지도 : 박철수 교수 (cspark@hufs.ac.kr)").line, `지도 : ${M}`);
  // 대표번호와 나머지 문장은 남김
  assert.equal(
    maskPersonalContact("학사종합지원센터(대표 02-2173-2114) 담당자 홍길동 02-2173-1234, 2026학년도 신청 접수").line,
    `학사종합지원센터(대표 02-2173-2114) 담당자 ${M}, 2026학년도 신청 접수`,
  );
  // " / "로 나뉜 줄: 부서 번호 구간은 남기고 이름 구간만 가림(11325 생협 문의 줄 형태)
  assert.equal(
    maskPersonalContact("문의 : 생협 사무국(후생관 3층) 031-330-4192, 4060 / 담당자 : 홍길동 총무팀장").line,
    `문의 : 생협 사무국(후생관 3층) 031-330-4192, 4060 / 담당자 : ${M} 총무팀장`,
  );
  const { lines, personalMasked } = extractPage(page(`
    <h2>문의</h2>
    <p>담당자 홍길동 (gildong@hufs.ac.kr, 02-2173-1234)</p>
    <p>서울 학사종합지원센터</p>
  `));
  assert.equal(personalMasked, 1);
  assert.deepEqual(lines.slice(1), [`담당자 ${M}`, "서울 학사종합지원센터"]);
  for (const line of lines) assert.equal(isPersonalContact(line), false, `가린 뒤에도 이름 표시: ${line}`);
});

test("가린 메일 아이디만 돌려줌(이름 표시 없는 줄의 메일은 남고 목록에도 없음)", () => {
  const { personalEmails, lines } = extractPage(page(`
    <p>E-MAIL : gildong@hufs.ac.kr</p>
    <p>홍길동 선생님 hong.gd@hufs.ac.kr</p>
    <p>E-MAIL : haksamil@hufs.ac.kr</p>
  `));
  assert.deepEqual(personalEmails, ["hong.gd"]);
  assert.ok(lines.includes("E-MAIL : gildong@hufs.ac.kr"));
  assert.ok(lines.includes("E-MAIL : haksamil@hufs.ac.kr"));
});

test("전공 · 부서 메일은 그대로 남음(11/20 2차 collect에서 잘못 지워졌던 14개 형태)", () => {
  assert.equal(maskPersonalContact("BRICs(브릭스)전공 e-mail: brics@hufs.ac.kr").line, "BRICs(브릭스)전공 e-mail: brics@hufs.ac.kr");
  const ids = ["brics", "euliaison", "neasia", "muncon21", "nationalleader.seoul", "dhks", "aic", "langai", "bizai", "psych", "notice", "haksa", "hufspr", "infra"];
  for (const id of ids) {
    for (const line of [`E-mail : ${id}@hufs.ac.kr`, `학사종합지원센터 TEL: 02-2173-2109 e-mail: ${id}@hufs.ac.kr`, `${id}@hufs.ac.kr`]) {
      const r = maskPersonalContact(line);
      assert.equal(r.masked, false, line);
      assert.equal(r.line, line);
    }
  }
  // 직위 · 부서만 있는 줄도 이름으로 보지 않음
  for (const line of ["비전임 교수 | 3322", "외국인 교수 02-2173-2792", "인사팀 | 인사팀장 | 2163", "담당자 장학팀 02-2173-2138"]) {
    assert.equal(isPersonalContact(line), false, line);
  }
});

test("글로벌 전용 조각 제외: 머리글이 [글로벌]인 조각만 빼고 [서울] · 표시 없음은 그대로", () => {
  const chunks = toChunks({
    pageId: "11373", title: "졸업이수학점", url: "u",
    lines: ["\u0000H2서울", `서울캠퍼스 ${LONG}`, "\u0000H2글로벌", `글로벌캠퍼스 ${LONG}`, "\u0000H2공통", LONG, "\u0000H2양쪽", `서울캠퍼스와 글로벌캠퍼스 ${LONG}`],
  });
  assert.deepEqual(chunks.map(isGlobalOnly), [false, true, false, false]);
  const { kept, dropped } = dropGlobalOnly(chunks);
  assert.equal(dropped, 1);
  assert.deepEqual(kept.map((c) => c.section), ["서울", "공통", "양쪽"]);
  // 본문 중간에 [글로벌]이 나오는 조각은 빼지 않음
  assert.equal(isGlobalOnly({ text: "[졸업 > 안내]\n[글로벌] 기준은 별도" }), false);
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
  const { lines, personalMasked } = extractPage(page(keep.map((t) => `<p>${t}</p>`).join("")));
  assert.equal(personalMasked, 0);
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
