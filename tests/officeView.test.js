// 건물 입구 [주요 기능 알아보기] 창의 순수 함수(src/ui/officeView.js)를 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_INFO } from "../src/data/buildingInfo.js";
import {
  OFFICE_RANGE,
  ROOT_VIEW,
  backView,
  childLabel,
  crumbs,
  displayName,
  firstTel,
  floorLabel,
  groupByFloor,
  hasOfficeInfo,
  locationText,
  nearestOfficePlace,
  officeName,
  openChild,
  openItem,
  parseFloor,
  resolveView,
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
  for (const id of ["faculty", "press", "history", "square", "field", "없는건물"]) assert.equal(hasOfficeInfo(id), false, id);
  assert.equal(hasOfficeInfo("minerva"), true, "Minerva Complex는 11/25부터 동아리방 · 오바마홀");
});

test("위치 한 줄: 호실이 있으면 호실만(층 생략), 없으면 위치 글 · 층, 모두 없으면 null", () => {
  assert.equal(locationText({ floor: "1F", room: "114호" }, "ko"), "114호");
  assert.equal(locationText({ floor: "1F", room: "122호" }, "en"), "Room 122");
  assert.equal(locationText({ floor: "B1", room: "B1-08호" }, "ko"), "B1-08호");
  assert.equal(locationText({ floor: "OUT", room: null, where: { ko: "도서관 뒤(건물 밖)", en: "Behind the library (outside)" } }, "ko"), "도서관 뒤(건물 밖)");
  assert.equal(locationText({ floor: "B1 · B2", room: null }, "ko"), "지하 1층 · 지하 2층");
  assert.equal(locationText({ floor: null, room: "603호" }, "ko"), "603호");
  assert.equal(locationText({ floor: "2F · 3F · 4F · 5F", room: null }, "ko"), "2층 · 3층 · 4층 · 5층");
  assert.equal(locationText({ floor: "LF", room: null }, "ko"), "라운지층");
  assert.equal(locationText({ floor: "LF", room: null }, "en"), "Lounge");
  assert.equal(locationText({ floor: null, room: null }, "ko"), null);
});

test("층 읽기 · 묶음 제목: 6층 · 라운지층 · 지하 1층 · 건물 밖 / 6F · Lounge · B1 · Outside", () => {
  assert.deepEqual(parseFloor("6F"), { kind: "up", n: 6 });
  assert.deepEqual(parseFloor("LF"), { kind: "lounge", n: 0 });
  assert.deepEqual(parseFloor("B1"), { kind: "basement", n: 1 });
  assert.deepEqual(parseFloor("OUT"), { kind: "out", n: 0 });
  for (const token of ["B1F", "옥상"]) assert.equal(parseFloor(token), null, token);
  assert.equal(floorLabel(parseFloor("B1"), "ko"), "지하 1층");
  assert.equal(floorLabel(parseFloor("B2"), "en"), "B2");
  assert.equal(floorLabel(parseFloor("OUT"), "ko"), "건물 밖");
  assert.equal(floorLabel(parseFloor("OUT"), "en"), "Outside");
  assert.equal(floorLabel(parseFloor("6F"), "ko"), "6층");
  assert.equal(floorLabel(parseFloor("LF"), "ko"), "라운지층");
  assert.equal(floorLabel(parseFloor("6F"), "en"), "6F");
  assert.equal(floorLabel(parseFloor("LF"), "en"), "Lounge");
});

const o = (name, floor, category = "office") => ({ name: { ko: name, en: null }, floor, category });
const order = (groups) => groups.map((g) => (g.top ? "맨 위" : g.floor ? floorLabel(g.floor, "ko") : "없음"));

test("층별 묶음: 맨 위 안내(top) → 지하 2층 → 지하 1층 → 라운지층 → 1층 → … → 건물 밖 → 층 안내 없음(마지막)", () => {
  const groups = groupByFloor([o("가", "1F"), o("나", null), { ...o("건물 안내", null), top: true }, o("라", "6F"), o("마", "LF"), o("바", "3F"), o("사", "B1"), o("아", "OUT"), o("자", "B2")]);
  assert.deepEqual(order(groups), ["맨 위", "지하 2층", "지하 1층", "라운지층", "1층", "3층", "6층", "건물 밖", "없음"]);
  assert.deepEqual(groups[0].items.map((i) => i.office.name.ko), ["건물 안내"]);
});

test("여러 층 항목은 각 층 묶음에 모두, floor null은 '층 안내 없음'에(층 계산은 데이터에서 floorFromRoom으로)", () => {
  const offices = [o("무인 복사실", "1F · 2F · 3F", "amenity"), o("학생상담센터", null), { ...o("인권센터", null), room: "346호" }];
  const groups = groupByFloor(offices);
  assert.deepEqual(order(groups), ["1층", "2층", "3층", "없음"]);
  for (const g of groups.slice(0, 3)) assert.deepEqual(g.items.map((i) => i.index), [0]);
  assert.deepEqual(groups.at(-1).items.map((i) => i.office.name.ko), ["학생상담센터", "인권센터"]);
});

test("실제 데이터: 모든 항목이 한 번 이상 들어가고, 도서관은 안내 → 라운지층 → 1층 → 6층(층 안내 없음 없음)", () => {
  for (const [id, info] of Object.entries(BUILDING_INFO)) {
    const seen = new Set(groupByFloor(info.offices).flatMap((g) => g.items.map((i) => i.index)));
    assert.equal(seen.size, info.offices.length, id);
  }
  const library = groupByFloor(BUILDING_INFO.library.offices);
  assert.deepEqual(order(library), ["맨 위", "라운지층", "1층", "2층", "3층", "4층", "5층", "6층", "건물 밖"]);
  assert.deepEqual(library.at(-1).items.map((i) => i.office.name.ko), ["빵명장"]);
  // Minerva Complex: 오바마홀(B1 · B2)은 지하 2층 · 지하 1층 묶음에 모두
  const minerva = groupByFloor(BUILDING_INFO.minerva.offices);
  assert.deepEqual(order(minerva), ["지하 2층", "지하 1층"]);
  for (const g of minerva) assert.ok(g.items.some((i) => i.office.name.ko === "오바마홀"), floorLabel(g.floor, "ko"));
  assert.deepEqual(library[0].items.map((i) => i.office.name.ko), ["서울캠퍼스 도서관 안내"]);
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

test("묶음 항목: 층 목록 → 동아리방 → 그림촌 상세 → 뒤로 → 뒤로(한 단계씩), 위치 한 줄", () => {
  const info = BUILDING_INFO.union;
  const index = info.offices.findIndex((x) => x.name.ko === "동아리방" && x.floor === "3F");
  let view = openItem(info.offices, index);
  assert.deepEqual(view, { group: index, item: null });
  let r = resolveView(info.offices, view);
  assert.equal(r.kind, "group");
  assert.deepEqual(r.children.slice(0, 2).map((c) => childLabel(c, "ko")), ["산악부(304-1호)", "그림촌(312호)"]);
  assert.equal(crumbs(info.name, info.offices, view, "ko"), "국제학사 및 학생회관 › 3층 › 동아리방");
  view = openChild(view, 1);
  r = resolveView(info.offices, view);
  assert.equal(r.kind, "detail");
  assert.equal(r.office.name.ko, "그림촌");
  assert.equal(locationText(r.office, "ko"), "312호");
  assert.equal(crumbs(info.name, info.offices, view, "ko"), "국제학사 및 학생회관 › 3층 › 동아리방 › 그림촌");
  view = backView(view);
  assert.deepEqual(view, { group: index, item: null });
  view = backView(view);
  assert.deepEqual(view, ROOT_VIEW);
  assert.equal(resolveView(info.offices, view).kind, "list");
});

test("묶음 항목: 본관 3층 서양어대학 → 노어과 상세(호실 · 학교 전화), 영어 이름 없으면 한국어 + Room", () => {
  const info = BUILDING_INFO.main;
  const index = info.offices.findIndex((x) => x.name.ko === "서양어대학");
  const view = openChild(openItem(info.offices, index), 1);
  const r = resolveView(info.offices, view);
  assert.equal(r.office.name.ko, "노어과");
  assert.equal(locationText(r.office, "ko"), "321호");
  assert.deepEqual(r.office.phone, ["02-2173-2284"]);
  assert.equal(childLabel(r.office, "en"), "노어과 (Room 321)");
  // 묶음이 아닌 줄은 바로 상세
  const plain = info.offices.findIndex((x) => x.name.ko === "정보시스템팀");
  assert.deepEqual(openItem(info.offices, plain), { group: null, item: plain });
  assert.equal(crumbs(info.name, info.offices, openItem(info.offices, plain), "ko"), "본관 › 4층");
});
