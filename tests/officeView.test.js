// 건물 입구 [주요 기능 알아보기] 창의 순수 함수(src/ui/officeView.js)를 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_INFO } from "../src/data/buildingInfo.js";
import {
  OFFICE_RANGE,
  displayName,
  firstTel,
  floorLabel,
  groupByFloor,
  hasOfficeInfo,
  locationText,
  nearestOfficePlace,
  officeName,
  parseFloor,
} from "../src/ui/officeView.js";

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
  assert.equal(locationText({ floor: "2F · 3F · 4F · 5F", room: null }, "ko"), "2층 · 3층 · 4층 · 5층");
  assert.equal(locationText({ floor: "B1", room: null }, "ko"), "지하 1층");
  assert.equal(locationText({ floor: "B1F", room: null }, "en"), "B1");
  assert.equal(locationText({ floor: "LF", room: null }, "ko"), "로비층");
  assert.equal(locationText({ floor: "LF", room: null }, "en"), "Lobby");
  assert.equal(locationText({ floor: null, room: null }, "ko"), null);
});

test("층 읽기 · 묶음 제목: 6층 · 로비층 · 지하 1층 / 6F · Lobby · B1", () => {
  assert.deepEqual(parseFloor("6F"), { kind: "up", n: 6 });
  assert.deepEqual(parseFloor("LF"), { kind: "lobby", n: 0 });
  assert.deepEqual(parseFloor("B1F"), { kind: "basement", n: 1 });
  assert.deepEqual(parseFloor("B1"), { kind: "basement", n: 1 });
  assert.equal(parseFloor("옥상"), null);
  assert.equal(floorLabel(parseFloor("6F"), "ko"), "6층");
  assert.equal(floorLabel(parseFloor("LF"), "ko"), "로비층");
  assert.equal(floorLabel(parseFloor("B1F"), "ko"), "지하 1층");
  assert.equal(floorLabel(parseFloor("6F"), "en"), "6F");
  assert.equal(floorLabel(parseFloor("LF"), "en"), "Lobby");
  assert.equal(floorLabel(parseFloor("B1F"), "en"), "B1");
});

const o = (name, floor, category = "office") => ({ name: { ko: name, en: null }, floor, category });
const order = (groups) => groups.map((g) => (g.floor ? floorLabel(g.floor, "ko") : "없음"));

test("층별 묶음: 높은 층 → 1층 → 로비층 → 지하 → 층 안내 없음(마지막)", () => {
  const groups = groupByFloor([o("가", "1F"), o("나", null), o("다", "B1F"), o("라", "6F"), o("마", "LF"), o("바", "3F")]);
  assert.deepEqual(order(groups), ["6층", "3층", "1층", "로비층", "지하 1층", "없음"]);
});

test("여러 층 항목은 각 층 묶음에 모두, floor null은 '층 안내 없음'에(호수로 층을 짐작하지 않음)", () => {
  const offices = [o("무인 복사실", "1F · 2F · 3F", "amenity"), o("학생상담센터", null), { ...o("인권센터", null), room: "346호" }];
  const groups = groupByFloor(offices);
  assert.deepEqual(order(groups), ["3층", "2층", "1층", "없음"]);
  for (const g of groups.slice(0, 3)) assert.deepEqual(g.items.map((i) => i.index), [0]);
  assert.deepEqual(groups.at(-1).items.map((i) => i.office.name.ko), ["학생상담센터", "인권센터"]);
});

test("실제 데이터: 모든 항목이 한 번 이상 들어가고, 도서관은 6층부터 '층 안내 없음'까지", () => {
  for (const [id, info] of Object.entries(BUILDING_INFO)) {
    const seen = new Set(groupByFloor(info.offices).flatMap((g) => g.items.map((i) => i.index)));
    assert.equal(seen.size, info.offices.length, id);
  }
  const library = order(groupByFloor(BUILDING_INFO.library.offices));
  assert.deepEqual(library, ["6층", "5층", "4층", "3층", "2층", "1층", "로비층", "없음"]);
});

test("전화 링크는 첫 번호로(표시는 원문 그대로)", () => {
  assert.equal(firstTel("02-2173-2152~4"), "tel:0221732152");
  assert.equal(firstTel("02-2173-2133, 2134"), "tel:0221732133");
  assert.equal(firstTel("02-2173-2525, 2515, 2557"), "tel:0221732525");
  assert.equal(firstTel("안내 없음"), null);
});

test("영어 이름이 없으면 한국어 이름, 편의시설만 이름 뒤에 (편의시설)", () => {
  assert.equal(officeName({ name: { ko: "휴플레이스", en: null } }, "en"), "휴플레이스");
  assert.equal(officeName({ name: { ko: "장학팀", en: "Scholarship Support Team" } }, "en"), "Scholarship Support Team");
  const cu = BUILDING_INFO.union.offices.find((x) => x.name.ko === "CU 편의점");
  assert.equal(displayName(cu, "ko", "(편의시설)"), "CU 편의점(편의시설)");
  assert.equal(displayName(cu, "en", " (Amenity)"), "CU convenience store (Amenity)");
  assert.equal(displayName(o("제2자유열람실", "2F"), "ko", "(편의시설)"), "제2자유열람실");
  assert.equal(displayName(o("학생지원팀", null), "ko", "(편의시설)"), "학생지원팀");
  assert.equal(cu.name.ko, "CU 편의점", "데이터의 name은 그대로");
});
