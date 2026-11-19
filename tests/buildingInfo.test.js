// src/data/buildingInfo.js의 건물 정보 규칙(근거 없는 내용 금지)을 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_INFO, SOURCES, buildingSources, isChecked } from "../src/data/buildingInfo.js";

const entries = Object.entries(BUILDING_INFO);

test("근거 페이지는 학교 공식 사이트(*.hufs.ac.kr)만, 현장 확인(url null)은 확인한 사람 · 날짜를 적음", () => {
  for (const [key, source] of Object.entries(SOURCES)) {
    assert.ok(source.title, `${key}: title 없음`);
    if (source.url === null && source.doc) continue; // 공개 주소를 아직 모르는 학교 공식 문서(PDF)
    if (source.url === null) {
      assert.match(source.title, /현장 확인\(.+, \d{4}-\d{2}-\d{2}\)/, `${key}: 현장 확인 표기`);
      continue;
    }
    assert.match(new URL(source.url).hostname, /(^|\.)hufs\.ac\.kr$/, `${key}: ${source.url}`);
  }
});

test("offices 줄마다 있는 src · 이름 · 하는 일(한국어 · 영어)", () => {
  for (const [id, info] of entries) {
    for (const office of info.offices) {
      const label = `${id} / ${office.name?.ko}`;
      assert.ok(SOURCES[office.src], `${label}: src '${office.src}'가 SOURCES에 없음`);
      assert.ok(office.name.ko && office.name.en, `${label}: 이름`);
      assert.ok(office.does.ko && office.does.en, `${label}: 하는 일`);
      assert.ok(office.floor === null || /^(B?\d+F)( · B?\d+F)*$/.test(office.floor), `${label}: floor 형식 '${office.floor}'`);
      assert.ok(office.room === null || /^\d+(-\d+)?호$/.test(office.room), `${label}: room 형식 '${office.room}'`);
    }
  }
});

test("use · offices를 채운 건물은 checkedAt도 있고, 확인된 건물로 판정", () => {
  for (const [id, info] of entries) {
    const filled = Boolean(info.use) || info.offices.length > 0;
    if (!filled) {
      assert.equal(info.checkedAt, null, `${id}: 내용 없이 checkedAt만 있음`);
      assert.equal(isChecked(info), false, id);
      continue;
    }
    assert.match(info.checkedAt ?? "", /^\d{4}-\d{2}-\d{2}$/, `${id}: checkedAt`);
    assert.ok(info.use?.ko && info.use?.en, `${id}: use 한국어 · 영어`);
    assert.ok(info.offices.length > 0, `${id}: use만 있고 offices 없음`);
    assert.equal(isChecked(info), true, id);
    assert.ok(buildingSources(info).length > 0, `${id}: 출처 목록`);
  }
});

test("공개 저장소: 전화번호 · 이메일을 넣지 않음", () => {
  const text = JSON.stringify(BUILDING_INFO);
  assert.doesNotMatch(text, /\d{2,4}-\d{3,4}-\d{4}/);
  assert.doesNotMatch(text, /@[\w-]+\.[\w.]+/);
});
