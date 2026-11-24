// src/data/buildingInfo.js의 건물 정보 규칙(근거 없는 내용 금지)을 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_INFO, SOURCES, buildingSources, isChecked, officeSourceKeys } from "../src/data/buildingInfo.js";

const entries = Object.entries(BUILDING_INFO);
const offices = entries.flatMap(([id, info]) => info.offices.map((office) => ({ id, office, label: `${id} / ${office.name?.ko}` })));

test("근거 페이지는 학교 공식 사이트(*.hufs.ac.kr)만, 현장 · 팀 확인(url null)은 확인한 사람 · 날짜를 적음", () => {
  for (const [key, source] of Object.entries(SOURCES)) {
    assert.ok(source.title, `${key}: title 없음`);
    if (source.url === null) {
      assert.match(source.title, /(현장|팀) 확인\(.+, \d{4}-\d{2}-\d{2}\)/, `${key}: 현장 · 팀 확인 표기`);
      continue;
    }
    assert.match(new URL(source.url).hostname, /(^|\.)hufs\.ac\.kr$/, `${key}: ${source.url}`);
  }
});

test("offices 줄마다 있는 src · 이름 · 하는 일(한국어 · 영어)", () => {
  for (const { office, label } of offices) {
    assert.ok(SOURCES[office.src], `${label}: src '${office.src}'가 SOURCES에 없음`);
    // 영어 이름은 근거에 적힌 공식 표기만 씁니다. 없으면 null이고 화면은 한국어 이름으로 대신 보여 줍니다.
    assert.ok(office.name.ko, `${label}: 한국어 이름`);
    assert.ok(office.name.en === null || (typeof office.name.en === "string" && office.name.en), `${label}: 영어 이름은 문자열 또는 null`);
    assert.ok(office.does.ko && office.does.en, `${label}: 하는 일`);
    // "1F" · "LF"(로비층) · "B1F", 여러 층이면 " · "로 잇기
    assert.ok(office.floor === null || /^(B?\d+F|LF)( · (B?\d+F|LF))*$/.test(office.floor), `${label}: floor 형식 '${office.floor}'`);
    assert.ok(office.room === null || /^\d+(-\d+)?호$/.test(office.room), `${label}: room 형식 '${office.room}'`);
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

// 전화번호는 phone 칸에만 둡니다. phone 칸을 뺀 나머지 글에 전화번호 모양이 있으면 실패합니다.
test("공개 저장소: phone 칸 밖에는 전화번호 · 이메일을 넣지 않음", () => {
  const withoutPhone = JSON.stringify(BUILDING_INFO, (key, value) => (key === "phone" ? undefined : value));
  assert.doesNotMatch(withoutPhone, /\d{2,4}-\d{3,4}-\d{4}/);
  assert.doesNotMatch(withoutPhone, /@[\w-]+\.[\w.]+/);
});

test("phone은 학교 부서 번호(02-2173- · 02-6235-)만, 어디에도 010- · 031- · @ 없음", () => {
  for (const { office, label } of offices) {
    if (office.phone === null) continue;
    assert.ok(Array.isArray(office.phone) && office.phone.length > 0, `${label}: phone은 배열 또는 null`);
    for (const number of office.phone) assert.match(number, /^02-(2173|6235)-/, `${label}: phone '${number}'`);
  }
  const text = JSON.stringify(BUILDING_INFO);
  for (const banned of ["010-", "031-", "0507-", "@"]) assert.ok(!text.includes(banned), `'${banned}'가 들어 있음`);
});

test("category · hours · details 형식", () => {
  for (const { office, label } of offices) {
    assert.ok(["office", "amenity"].includes(office.category), `${label}: category '${office.category}'`);
    if (office.hours !== null) assert.ok(office.hours.ko && office.hours.en, `${label}: hours 한국어 · 영어`);
    if (office.details !== null) {
      const { ko, en } = office.details;
      assert.ok(Array.isArray(ko) && Array.isArray(en) && ko.length > 0, `${label}: details는 { ko: [], en: [] }`);
      assert.ok(ko.length <= 5, `${label}: details 최대 5줄(지금 ${ko.length}줄)`);
      assert.equal(en.length, ko.length, `${label}: details 한국어 · 영어 줄 수`);
      for (const line of [...ko, ...en]) assert.ok(typeof line === "string" && line.trim(), `${label}: 빈 details 줄`);
      for (const line of ko) assert.ok(line.length <= 45, `${label}: details 줄이 김(${line.length}자) '${line}'`);
    }
  }
});

test("덧붙인 칸의 근거(extraSrc)도 SOURCES에 있고, 새로 넣거나 덧붙인 줄은 확인한 날이 있음", () => {
  for (const { office, label } of offices) {
    for (const key of officeSourceKeys(office)) assert.ok(SOURCES[key], `${label}: 근거 '${key}'가 SOURCES에 없음`);
    const extra = office.extraSrc;
    if (extra && typeof extra === "object") {
      for (const field of Object.keys(extra)) {
        assert.ok(["phone", "hours", "details"].includes(field), `${label}: extraSrc 칸 '${field}'`);
        assert.ok(office[field] !== null, `${label}: extraSrc에 적은 '${field}' 칸이 비어 있음`);
      }
    }
    if (office.checkedAt !== undefined) assert.match(office.checkedAt, /^\d{4}-\d{2}-\d{2}$/, `${label}: checkedAt`);
    const usesNewSource = officeSourceKeys(office).some((key) => key === "lifeguide2026" || key === "team1124");
    if (usesNewSource) assert.ok(office.checkedAt, `${label}: lifeguide2026 · team1124 줄에 checkedAt 없음`);
  }
});

test("글로벌캠퍼스 전용 건물 이름이 들어가지 않음", () => {
  const text = JSON.stringify(BUILDING_INFO);
  const globalOnly = ["백년관", "어문학관", "교양관", "자연과학관", "인문경상관", "공학관", "왕산문화예술관", "명수당", "후생관", "창업보육센터", "국제사회교육원", "HUFS Dorm"];
  for (const name of globalOnly) assert.ok(!text.includes(name), `글로벌 전용 이름 '${name}'`);
});

test("도서관 자유열람실: 옛 시간 줄은 없고, 층별(홈페이지 층별안내 · 이용시간) 줄과 시험기간 줄이 있음", () => {
  const names = BUILDING_INFO.library.offices.map((office) => office.name.ko);
  for (const old of ["제1 · 제2자유열람실", "제3 · 제4자유열람실", "제1 · 5 자유열람실", "제2~4 자유열람실"]) assert.ok(!names.includes(old), `${old} 줄이 남아 있음`);
  const byName = Object.fromEntries(BUILDING_INFO.library.offices.map((office) => [office.name.ko, office]));
  for (const [name, floor] of [["제1자유열람실", "5F"], ["제5자유열람실", "5F"]]) {
    assert.equal(byName[name]?.floor, floor, name);
    assert.match(byName[name]?.hours?.ko ?? "", /^24시간 개방/, name);
  }
  for (const [name, floor] of [["제2자유열람실", "2F"], ["제3자유열람실", "3F"], ["제4자유열람실", "4F"]]) {
    assert.equal(byName[name]?.floor, floor, name);
    assert.match(byName[name]?.hours?.ko ?? "", /^06:00~23:00/, name);
    assert.ok(byName[name]?.details?.ko.some((line) => line.includes("시험기간에는 24시간 개방")), `${name}: 시험기간 비고`);
  }
  assert.equal(byName["시험기간 자유열람실"]?.src, "team1124");
});
