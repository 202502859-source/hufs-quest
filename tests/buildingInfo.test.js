// src/data/buildingInfo.js의 건물 정보 규칙(근거 없는 내용 금지)을 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_INFO, CLUB_COUNT, DEPT_COUNT, SOURCES, allOffices, buildingSources, floorFromRoom, isChecked, officeSourceKeys, roomSortKey } from "../src/data/buildingInfo.js";

const entries = Object.entries(BUILDING_INFO);
// 하위 줄(children: 동아리 · 학과)까지 모두. child: true면 하위 줄
const offices = entries.flatMap(([id, info]) => [
  ...info.offices.map((office) => ({ id, office, child: false, label: `${id} / ${office.name?.ko}` })),
  ...info.offices.flatMap((parent) => allOffices(parent.children).map((office) => ({ id, office, child: true, label: `${id} / ${parent.name.ko} / ${office.name?.ko}` }))),
]);

test("근거: 학교 공식 사이트(*.hufs.ac.kr), 현장 · 팀 확인(url null), 종헌이 준 외부 주소(kind external, 제목에 외부 참고)만", () => {
  for (const [key, source] of Object.entries(SOURCES)) {
    assert.ok(source.title, `${key}: title 없음`);
    if (source.url === null) {
      assert.match(source.title, /(현장|팀) 확인\(.+, \d{4}-\d{2}-\d{2}\)/, `${key}: 현장 · 팀 확인 표기`);
      continue;
    }
    if (source.kind === "external") {
      assert.match(source.title, /\(외부 참고\)/, `${key}: 외부 출처는 제목에 (외부 참고)`);
      continue;
    }
    assert.equal(source.kind, undefined, `${key}: kind는 external만`);
    assert.match(new URL(source.url).hostname, /(^|\.)hufs\.ac\.kr$/, `${key}: ${source.url}`);
  }
  // 외부 참고는 종헌이 준 주소 6개뿐(나무위키 · 올리브영 · 네이버 지도 4곳), 추적 값 없음
  const external = Object.values(SOURCES).filter((source) => source.kind === "external");
  assert.equal(external.length, 6);
  for (const source of external.filter((x) => x.url.includes("map.naver.com"))) assert.match(source.url, /^https:\/\/map\.naver\.com\/p\/entry\/place\/\d+$/, source.url);
  for (const source of external) assert.doesNotMatch(source.url, /utm_|[?&]c=|entry=|from=/, source.url);
});

test("offices 줄마다 있는 src · 이름 · 하는 일(한국어 · 영어, 하위 동아리 줄은 영어 생략 가능)", () => {
  for (const { office, label, child } of offices) {
    assert.ok(SOURCES[office.src], `${label}: src '${office.src}'가 SOURCES에 없음`);
    // 영어 이름은 근거에 적힌 공식 표기만 씁니다. 없으면 null이고 화면은 한국어 이름으로 대신 보여 줍니다.
    assert.ok(office.name.ko, `${label}: 한국어 이름`);
    assert.ok(office.name.en === null || (typeof office.name.en === "string" && office.name.en), `${label}: 영어 이름은 문자열 또는 null`);
    // 하위 줄(동아리)은 영어 하는 일이 없을 수 있음(길라잡이에 영어 없음 → 화면은 한국어)
    assert.ok(office.does.ko && (office.does.en || child), `${label}: 하는 일`);
    // "1F" · "LF"(라운지층) · "B1"(지하) · "OUT"(건물 밖), 여러 층이면 " · "로 잇기
    assert.ok(office.floor === null || /^(\d+F|LF|B\d|OUT)( · (\d+F|LF|B\d))*$/.test(office.floor), `${label}: floor 형식 '${office.floor}'`);
    assert.ok(office.room === null || /^(B\d-\d+|B\d{3}|\d+(-\d+)?)호$/.test(office.room), `${label}: room 형식 '${office.room}'`);
  }
});

test("호수로 층 정하기(11/25 규칙): 마지막 두 자리를 뺀 앞자리, 붙은 번호 무시, 지하 B1-08 · B105 · B001", () => {
  const cases = [["321호", "3F"], ["114호", "1F"], ["446호", "4F"], ["1201호", "12F"], ["101-2호", "1F"], ["304-1호", "3F"], ["122-1~6호", "1F"], ["B1-08호", "B1"], ["B2-05호", "B2"], ["B105호", "B1"], ["B001호", "B1"], ["902호", "9F"]];
  for (const [room, floor] of cases) assert.equal(floorFromRoom(room), floor, room);
  assert.equal(floorFromRoom(null), null);
});

test("호실이 있는 줄은 모두 층이 있고, 적힌 층과 호실로 계산한 층이 다르지 않음(충돌 없음)", () => {
  for (const { office, label } of offices) {
    if (!office.room) continue;
    assert.equal(office.floor, floorFromRoom(office.room), `${label}: floor '${office.floor}' · room '${office.room}'`);
  }
});

test("AED(자동심장충격기)는 시설이 아니라 어느 건물에도 없음(11/25)", () => {
  const text = JSON.stringify(BUILDING_INFO);
  for (const word of ["AED", "자동심장충격기", "제세동기"]) assert.ok(!text.includes(word), word);
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

test("phone(11/25 규칙): 서울 02- 번호와 0507 업체 안심번호만, 010(개인) · 031(글로벌) · 이메일 없음", () => {
  for (const { office, label } of offices) {
    if (office.phone === null || office.phone === undefined) continue;
    assert.ok(Array.isArray(office.phone) && office.phone.length > 0, `${label}: phone은 배열 또는 null`);
    for (const number of office.phone) assert.match(number, /^(02-\d{3,4}-\d{4}|0507-\d{4}-\d{4})/, `${label}: phone '${number}'`);
  }
  const text = JSON.stringify(BUILDING_INFO);
  for (const banned of ["010-", "031-", "@"]) assert.ok(!text.includes(banned), `'${banned}'가 들어 있음`);
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
        assert.ok(["phone", "hours", "details", "room", "floor", "does"].includes(field), `${label}: extraSrc 칸 '${field}'`);
        assert.ok(office[field] !== null, `${label}: extraSrc에 적은 '${field}' 칸이 비어 있음`);
      }
    }
    if (office.checkedAt !== undefined) assert.match(office.checkedAt, /^\d{4}-\d{2}-\d{2}$/, `${label}: checkedAt`);
    const usesNewSource = officeSourceKeys(office).some((key) => ["lifeguide2026", "team1124", "team1125"].includes(key) || SOURCES[key]?.kind === "external");
    if (usesNewSource) assert.ok(office.checkedAt, `${label}: lifeguide2026 · 팀 확인 · 외부 참고 줄에 checkedAt 없음`);
  }
});

test("글로벌캠퍼스 전용 건물 이름이 들어가지 않음", () => {
  const text = JSON.stringify(BUILDING_INFO);
  const globalOnly = ["백년관", "어문학관", "교양관", "자연과학관", "인문경상관", "공학관", "왕산문화예술관", "명수당", "후생관", "창업보육센터", "국제사회교육원", "HUFS Dorm"];
  for (const name of globalOnly) assert.ok(!text.includes(name), `글로벌 전용 이름 '${name}'`);
});

test("도서관 자유열람실: 옛 시간 줄은 없고, 층별(홈페이지 층별안내 · 이용시간) 줄에 시험기간 비고가 있음", () => {
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
  // 도서관은 층 안내 없는 줄을 두지 않음(맨 위 건물 안내 한 줄만 예외)
  const noFloor = BUILDING_INFO.library.offices.filter((office) => !office.floor && !office.top).map((office) => office.name.ko);
  assert.deepEqual(noFloor, []);
});

test("도서관: 지하층 줄 없음, 건물 밖(OUT)은 빵명장 하나뿐이고 OUT은 도서관에만", () => {
  const library = allOffices(BUILDING_INFO.library.offices);
  assert.deepEqual(library.filter((office) => /B\d/.test(office.floor ?? "")).map((office) => office.name.ko), []);
  assert.deepEqual(library.filter((office) => office.floor === "OUT").map((office) => office.name.ko), ["빵명장"]);
  const bread = library.find((office) => office.name.ko === "빵명장");
  assert.equal(bread.category, "amenity");
  assert.equal(bread.where.ko, "도서관 뒤(건물 밖)");
  for (const { id, office } of offices) if (office.floor === "OUT") assert.equal(id, "library");
});

test("동아리방(76~77p): 66개 모두, 층마다 동아리방 하나, 하위 목록은 호실 오름차순", () => {
  const rooms = offices.filter(({ office }) => office.name.ko === "동아리방");
  const count = Object.fromEntries(rooms.map(({ id, office }) => [`${id} ${office.floor}`, office.children.length]));
  assert.deepEqual(count, { "tlc B1": 1, "social B1": 7, "union B1": 4, "union 2F": 1, "union 3F": 13, "union 4F": 30, "minerva B1": 4, "minerva B2": 6 });
  assert.equal(rooms.reduce((n, { office }) => n + office.children.length, 0), CLUB_COUNT);
  assert.equal(CLUB_COUNT, 66);
  for (const { office, label } of rooms) {
    const sorted = [...office.children].sort((a, b) => {
      const [x, y] = [roomSortKey(a.room), roomSortKey(b.room)];
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
    });
    assert.deepEqual(office.children, sorted, `${label}: 호실 오름차순`);
    for (const c of office.children) {
      assert.equal(c.phone, null, `${label}/${c.name.ko}: 동아리는 전화 없음`);
      assert.equal(c.details.ko[0], "동아리 활동 지원 및 운영");
      assert.equal(c.src, "lifeguide2026");
    }
  }
  const union3 = rooms.find(({ id, office }) => id === "union" && office.floor === "3F").office.children;
  assert.deepEqual(union3.slice(0, 3).map((c) => `${c.name.ko}(${c.room})`), ["산악부(304-1호)", "그림촌(312호)", "세레브로(313호)"]);
  assert.equal(union3.find((c) => c.name.ko === "그림촌").does.ko, "순수미술");
});

test("학과(부) 사무실(80p): 42줄, 층 → 단과대학 → 학과, 같은 단과대학이 여러 층이면 층마다 그 층 학과만", () => {
  const colleges = offices.filter(({ office, child }) => !child && office.children && office.name.ko !== "동아리방");
  const depts = colleges.flatMap(({ office }) => office.children);
  assert.equal(depts.length, DEPT_COUNT);
  assert.equal(DEPT_COUNT, 42);
  for (const d of depts) {
    assert.match(d.phone[0], /^02-2173-\d{4}$/, d.name.ko);
    assert.equal(d.does.ko, "학과(부) 사무실");
    assert.deepEqual(d.details.ko, ["해당 학과의 행정 업무 처리 및 학과 운영 지원"]);
  }
  const at = (id, college, floor) => colleges.find((c) => c.id === id && c.office.name.ko === college && c.office.floor === floor)?.office.children.map((x) => x.name.ko);
  assert.deepEqual(at("main", "일본학대학", "3F"), ["일본언어문화학부"]);
  assert.deepEqual(at("main", "일본학대학", "4F"), ["융합일본지역학부"]);
  assert.deepEqual(at("main", "중국학대학", "3F"), ["중국언어문화학부"]);
  assert.deepEqual(at("main", "중국학대학", "4F"), ["중국외교통상학부"]);
  assert.deepEqual(at("main", "서양어대학", "3F"), ["네덜란드어과", "노어과", "독일어과", "프랑스어학부", "스칸디나비아어과", "스페인어과", "포르투갈어과", "이탈리아어과"]);
  assert.deepEqual(at("main", "KFL학부", "9F"), ["외국어로서의한국어교육전공", "외국어로서의한국어통번역전공"]);
  assert.deepEqual(at("cyber", "경영대학", "5F"), ["경영학부"]);
  assert.deepEqual(at("social", "사회과학대학", "1F"), ["정치외교학과", "행정학과", "미디어커뮤니케이션학부"]);
});

test("11/25 결정: 여행사 없음, 대학원 카페 HUFS동문커피, 오바마홀 B1 · B2, 인문과학관 2층 대강당(외부 참고)", () => {
  const all = offices.map(({ office }) => office.name.ko);
  for (const name of ["하나투어", "플러스엠엔씨"]) assert.ok(!all.includes(name), name);
  assert.equal(BUILDING_INFO.grad.offices[0].name.ko, "HUFS동문커피");
  assert.equal(BUILDING_INFO.grad.offices[0].name.en, "HUFS Alumni Coffee");
  // 운영시간 · 비고(네이버 지도 외부 참고), 전화 없음(010)
  assert.match(BUILDING_INFO.grad.offices[0].hours.ko, /^월~목 08:30~20:30/);
  assert.deepEqual(BUILDING_INFO.grad.offices[0].details.ko, ["행사·시험 기간에는 연장 영업"]);
  assert.equal(BUILDING_INFO.grad.offices[0].phone, null);
  const namu = BUILDING_INFO.intl.offices.find((office) => office.name.ko === "나무라듸오");
  assert.match(namu.hours.ko, /토·일 정기휴무$/);
  assert.equal(namu.phone, null);
  assert.equal(SOURCES[namu.extraSrc.hours].kind, "external");
  const obama = BUILDING_INFO.minerva.offices.find((office) => office.name.ko === "오바마홀");
  assert.equal(obama.floor, "B1 · B2");
  assert.deepEqual(officeSourceKeys(obama).sort(), ["campus3d", "team1125"]);
  const hall = BUILDING_INFO.humanities.offices.find((office) => office.name.ko === "대강당");
  assert.equal(hall.floor, "2F");
  assert.equal(SOURCES[hall.src].kind, "external");
  assert.equal(BUILDING_INFO.union.offices.find((office) => office.name.ko === "국제학사 운영팀").room, "111호");
});
