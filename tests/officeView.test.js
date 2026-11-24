// 건물 입구 [주요 기능 알아보기] 창의 순수 함수(src/ui/officeView.js)를 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_INFO } from "../src/data/buildingInfo.js";
import { OFFICE_RANGE, firstTel, groupOffices, hasOfficeInfo, locationText, nearestOfficePlace, officeName } from "../src/ui/officeView.js";

test("가장 가까운 입구 하나만, 거리 안이고 안내가 있는 건물만", () => {
  const places = [
    { id: "a", door: { x: 100, y: 100 } },
    { id: "b", door: { x: 130, y: 100 } },
    { id: "c", door: null },
  ];
  const all = () => true;
  assert.equal(nearestOfficePlace(places, 120, 100, OFFICE_RANGE, all).id, "b");
  assert.equal(nearestOfficePlace(places, 105, 100, OFFICE_RANGE, all).id, "a");
  assert.equal(nearestOfficePlace(places, 100 + OFFICE_RANGE + 40, 100, OFFICE_RANGE, all), null, "멀면 없음");
  assert.equal(nearestOfficePlace(places, 128, 100, OFFICE_RANGE, (id) => id !== "b").id, "a", "안내 없는 건물은 건너뜀");
});

test("안내 없는 건물(offices가 비었거나 확인 전)에는 문구를 띄우지 않음", () => {
  assert.equal(hasOfficeInfo("union"), true);
  assert.equal(hasOfficeInfo("library"), true);
  for (const id of ["faculty", "press", "history", "minerva", "square", "field", "없는건물"]) assert.equal(hasOfficeInfo(id), false, id);
});

test("위치 한 줄: 층 · 호수, 없으면 null", () => {
  assert.equal(locationText({ floor: "1F", room: "122호" }, "ko"), "1층 122호");
  assert.equal(locationText({ floor: "1F", room: "122호" }, "en"), "1F, Room 122");
  assert.equal(locationText({ floor: null, room: "603호" }, "ko"), "603호");
  assert.equal(locationText({ floor: "2F · 3F · 4F · 5F", room: null }, "ko"), "2 · 3 · 4 · 5층");
  assert.equal(locationText({ floor: "B1", room: null }, "ko"), "지하 1층");
  assert.equal(locationText({ floor: null, room: null }, "ko"), null);
});

test("전화 링크는 첫 번호로(표시는 원문 그대로)", () => {
  assert.equal(firstTel("02-2173-2152~4"), "tel:0221732152");
  assert.equal(firstTel("02-2173-2133, 2134"), "tel:0221732133");
  assert.equal(firstTel("02-2173-2525, 2515, 2557"), "tel:0221732525");
  assert.equal(firstTel("안내 없음"), null);
});

test("영어 이름이 없으면 한국어 이름, 목록은 행정 · 센터 / 편의시설 두 묶음", () => {
  assert.equal(officeName({ name: { ko: "휴플레이스", en: null } }, "en"), "휴플레이스");
  assert.equal(officeName({ name: { ko: "장학팀", en: "Scholarship Support Team" } }, "en"), "Scholarship Support Team");
  const groups = groupOffices(BUILDING_INFO.union.offices);
  assert.ok(groups.office.some(({ office }) => office.name.ko === "진로취업지원센터"));
  assert.ok(groups.amenity.some(({ office }) => office.name.ko === "CU 편의점"));
  assert.equal(groups.office.length + groups.amenity.length, BUILDING_INFO.union.offices.length);
});
