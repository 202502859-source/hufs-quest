// "실제와 달라요" 신고 폼 주소(src/data/buildingInfo.js의 reportFormUrl)를 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BUILDING_INFO, REPORT_FORM_PLACE_ENTRY, REPORT_FORM_URL, reportFormUrl } from "../src/data/buildingInfo.js";
import { placeNames, placesBlock } from "../scripts/report-form/buildPlaceList.mjs";

const FORM = "https://docs.google.com/forms/d/e/TESTFORM/viewform";
const ENTRY = "entry.123";

test("설정값: 응답 주소는 구글 폼 viewform, entry는 entry.숫자", () => {
  assert.match(REPORT_FORM_URL, /^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/viewform$/);
  assert.match(REPORT_FORM_PLACE_ENTRY, /^entry\.\d+$/);
  assert.equal(REPORT_FORM_URL.includes("/edit"), false); // 편집 주소가 들어가면 안 됨
});

test("근처 장소가 있으면 usp=pp_url과 건물 이름 하나만 미리 채움", () => {
  const url = new URL(reportFormUrl("gatehouse", { formUrl: FORM, entry: ENTRY }));
  assert.equal(url.origin + url.pathname, FORM);
  assert.deepEqual([...url.searchParams.entries()], [["usp", "pp_url"], [ENTRY, "정문안내실"]]);
});

test("한글 · 공백 이름은 퍼센트 인코딩되어 원래 이름으로 되돌아옴", () => {
  const href = reportFormUrl("union", { formUrl: FORM, entry: ENTRY });
  assert.equal(/[가-힣]/.test(href), false); // 주소 문자열에 한글이 그대로 남지 않음
  assert.ok(href.includes("%ED%95%99%EC%83%9D%ED%9A%8C%EA%B4%80")); // "학생회관"
  assert.equal(new URL(href).searchParams.get(ENTRY), "학생회관 및 기숙사");
});

test("장소를 모르거나 목록에 없는 ID면 미리 채우기 없이 폼 주소만", () => {
  for (const id of [undefined, null, "", "no-such-place"]) {
    assert.equal(reportFormUrl(id, { formUrl: FORM, entry: ENTRY }), FORM);
  }
});

test("폼 주소가 비어 있으면 빈 문자열(버튼 숨김과 같은 조건)", () => {
  assert.equal(reportFormUrl("main", { formUrl: "", entry: ENTRY }), "");
});

test("기본값(실제 폼)으로도 모든 건물 ID가 미리 채워짐", () => {
  for (const [id, info] of Object.entries(BUILDING_INFO)) {
    const url = new URL(reportFormUrl(id));
    assert.equal(url.searchParams.get(REPORT_FORM_PLACE_ENTRY), info.name);
    assert.deepEqual([...url.searchParams.keys()].sort(), ["usp", REPORT_FORM_PLACE_ENTRY].sort()); // 좌표 · 이메일 등 다른 값 없음
  }
});

test("폼 스크립트(createReportForm.gs)의 선택지가 buildingInfo.js 이름과 같음 — 다르면 미리 채우기가 안 맞음", async () => {
  const gs = await readFile(new URL("../scripts/report-form/createReportForm.gs", import.meta.url), "utf8");
  assert.ok(gs.includes(placesBlock(placeNames())), "node scripts/report-form/buildPlaceList.mjs 를 실행하고 폼 선택지도 맞추세요");
});
