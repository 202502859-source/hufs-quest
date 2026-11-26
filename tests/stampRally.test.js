// 스탬프 랠리 문제 은행(shared/stampRally.js): 문제 · 정답 · 오답 보기가 모두 buildingInfo.js 시설 안내의 공식 출처 내용인지 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_INFO, SOURCES, allOffices, officeSourceKeys } from "../src/data/buildingInfo.js";
import { floorLabel, floorsOf } from "../src/ui/officeView.js";
import { STAMP_RALLY_IDS, STAMP_RALLY_QUESTIONS, STAMP_RALLY_STOPS, boothQuestionFor, gradeBooth, isRallyStop, nextRallyStop, rallyComplete } from "../shared/stampRally.js";

const isExternal = (office) => officeSourceKeys(office).some((key) => SOURCES[key]?.kind === "external");
// 공식 출처(학교 · 부서 페이지, 팀 현장 확인) 항목만
const officialOffices = (buildingId) => allOffices(BUILDING_INFO[buildingId].offices).filter((office) => !isExternal(office));
// 시설 안내 화면에 보이는 짧은 글자(이름 · 호실)
const shownTexts = (offices) => new Set(offices.flatMap((office) => [office.name.ko, office.room].filter(Boolean)));
// 시설 안내 화면의 층 표시("9층" · "9F"). 층 문제(kind: "floor")의 보기는 이 값만 씁니다.
const floorTexts = (offices, lang = "ko") => new Set(offices.flatMap((office) => floorsOf(office).map((f) => floorLabel(f, lang))));
const isFloorQuestion = (q) => q.kind === "floor";
const allQuestions = STAMP_RALLY_IDS.flatMap((id) => STAMP_RALLY_QUESTIONS[id].map((q) => ({ buildingId: id, q })));

test("대상은 4곳(도서관 → 학생회관 → 본관 → 인문과학관), 모두 buildingInfo에 있고 사이버관 · 정문 · 외국어연수평가원은 아님", () => {
  assert.deepEqual(STAMP_RALLY_IDS, ["library", "union", "main", "humanities"]);
  assert.deepEqual(STAMP_RALLY_STOPS.map((s) => s.label.ko), ["도서관", "학생회관", "본관", "인문"]);
  for (const id of STAMP_RALLY_IDS) assert.ok(BUILDING_INFO[id]?.offices.length, id);
  for (const id of ["cyber", "gatehouse", "gate", "flc"]) {
    assert.equal(isRallyStop(id), false, id);
    assert.equal(STAMP_RALLY_QUESTIONS[id], undefined, id);
  }
});

test("건물마다 3지선다 후보 1~3개, 보기 3개, 문제 id 중복 없음", () => {
  for (const id of STAMP_RALLY_IDS) {
    const list = STAMP_RALLY_QUESTIONS[id];
    assert.ok(list.length >= 1 && list.length <= 3, `${id}: ${list.length}개`);
    for (const q of list) {
      assert.equal(q.options.length, 3, q.id);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 3, q.id);
      assert.equal(new Set(q.options.map((o) => o.text.ko)).size, 3, `${q.id}: 보기 중복`);
    }
  }
  const ids = allQuestions.map(({ q }) => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("정답은 그 건물 시설 안내(공식 출처 항목)에 글자 그대로 있고, 근거 항목 · 출처 키가 실제 데이터와 맞음", () => {
  for (const { buildingId, q } of allQuestions) {
    const offices = officialOffices(buildingId);
    const answer = q.options[q.answer];
    assert.equal(answer.from, buildingId, `${q.id}: 정답은 그 건물 것이어야 함`);
    const office = offices.find((x) => x.name.ko === q.basis.office);
    assert.ok(office, `${q.id}: 근거 항목 "${q.basis.office}"가 공식 출처 항목에 없음`);
    if (isFloorQuestion(q)) {
      // 층 문제: 근거 항목이 그 건물에서 한 층에만 나오고(같은 이름이 다른 층에 또 있으면 안 됨), 정답은 그 floor 그대로
      const sameName = offices.filter((x) => x.name.ko === office.name.ko);
      const floors = new Set(sameName.flatMap((x) => floorsOf(x).map((f) => floorLabel(f, "ko"))));
      assert.equal(floors.size, 1, `${q.id}: "${office.name.ko}"가 여러 층(${[...floors].join(", ")})에 나옴`);
      assert.equal(answer.text.ko, [...floors][0], `${q.id}: 정답이 근거 항목의 층이 아님`);
      assert.ok(q.question.ko.includes(office.name.ko), `${q.id}: 문제에 근거 항목 이름이 없음`);
      assert.equal(q.basis.field, "floor");
    } else {
      assert.ok(shownTexts(offices).has(answer.text.ko), `${q.id}: 정답 "${answer.text.ko}"가 ${buildingId} 시설 안내에 없음`);
      assert.ok([office.name.ko, office.room].includes(answer.text.ko), `${q.id}: 정답이 근거 항목의 이름 · 호실이 아님`);
    }
    assert.deepEqual([...q.basis.src].sort(), [...officeSourceKeys(office)].sort(), `${q.id}: 출처 키`);
    for (const key of q.basis.src) assert.notEqual(SOURCES[key].kind, "external", `${q.id}: 외부 참고 출처 ${key}`);

    // 문제 속 따옴표 글귀는 근거 항목의 "하는 일"에 그대로, "N층"은 근거 항목의 층과 같아야 함
    const quoted = [...q.question.ko.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    for (const phrase of quoted) assert.ok(office.does.ko.includes(phrase), `${q.id}: '${phrase}'가 "${office.does.ko}"에 없음`);
    const floor = /(\d+)층/.exec(q.question.ko);
    if (floor) assert.ok(floorsOf(office).some((f) => floorLabel(f, "ko") === floor[0]), `${q.id}: ${floor[0]}`);
    if (q.question.ko.includes(office.name.ko) && office.room && answer.text.ko !== office.room) assert.fail(`${q.id}: 문제에 이름이 있으면 정답은 호실`);
  }
});

test("오답 보기는 다른 건물의 실제 시설 안내(공식 출처) 글자이고, 그 건물(문제 건물)에는 없는 글자. 층 문제만 예외로 같은 건물의 실제 층 값", () => {
  for (const { buildingId, q } of allQuestions) {
    if (isFloorQuestion(q)) {
      // 층 문제: 보기 3개 모두 그 건물 시설 안내(공식 출처)에 실제로 있는 floor 값
      const floors = floorTexts(officialOffices(buildingId));
      q.options.forEach((option) => {
        assert.equal(option.from, buildingId, `${q.id}: 층 보기 "${option.text.ko}"`);
        assert.ok(floors.has(option.text.ko), `${q.id}: "${option.text.ko}"는 ${buildingId} 시설 안내에 없는 층`);
      });
      continue;
    }
    const own = shownTexts(allOffices(BUILDING_INFO[buildingId].offices));
    q.options.forEach((option, i) => {
      if (i === q.answer) return;
      assert.notEqual(option.from, buildingId, `${q.id}: 오답 "${option.text.ko}"`);
      assert.ok(BUILDING_INFO[option.from], `${q.id}: ${option.from}`);
      assert.ok(shownTexts(officialOffices(option.from)).has(option.text.ko), `${q.id}: 오답 "${option.text.ko}"가 ${option.from} 공식 출처 항목에 없음`);
      assert.ok(!own.has(option.text.ko), `${q.id}: 오답 "${option.text.ko}"가 ${buildingId}에도 있어 헷갈림`);
    });
  }
});

test("영어 보기는 시설 안내 화면과 같은 표기(영어 이름, 없으면 한국어 이름, 호실은 Room N, 층은 9F)", () => {
  for (const { q } of allQuestions) {
    if (isFloorQuestion(q)) {
      const ko = [...floorTexts(officialOffices(q.options[0].from), "ko")];
      const en = [...floorTexts(officialOffices(q.options[0].from), "en")];
      for (const option of q.options) assert.equal(option.text.en, en[ko.indexOf(option.text.ko)], `${q.id}: ${option.text.ko}`);
      continue;
    }
    for (const option of q.options) {
      const offices = officialOffices(option.from);
      const byName = offices.find((x) => x.name.ko === option.text.ko);
      const expected = byName ? byName.name.en ?? byName.name.ko : `Room ${option.text.ko.replace(/호$/, "")}`;
      assert.equal(option.text.en, expected, `${q.id}: ${option.text.ko}`);
    }
  }
});

test("외부 참고 출처 항목 · 운영시간 · 전화번호 · 이메일은 문제에 쓰이지 않음", () => {
  const externalNames = Object.values(BUILDING_INFO).flatMap((info) => allOffices(info.offices).filter(isExternal).map((x) => x.name.ko));
  assert.ok(externalNames.includes("대강당"), "인문과학관 대강당(나무위키)은 외부 참고 항목");
  for (const { q } of allQuestions) {
    const text = [q.question.ko, q.question.en, ...q.options.flatMap((o) => [o.text.ko, o.text.en])].join(" | ");
    for (const name of externalNames) assert.ok(!text.includes(name), `${q.id}: 외부 참고 항목 "${name}"`);
    assert.doesNotMatch(text, /\d{2,4}-\d{3,4}|@|\d{1,2}:\d{2}|운영시간|전화|이메일|hours|phone|e-?mail/i, q.id);
  }
});

test("오늘의 문제: 한국 날짜로만 정해지고(결정적), 날마다 다음 후보로 바뀌며 3일이면 한 바퀴", () => {
  for (const id of STAMP_RALLY_IDS) {
    const list = STAMP_RALLY_QUESTIONS[id];
    const days = ["2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30"].map((d) => boothQuestionFor(id, d));
    assert.equal(boothQuestionFor(id, "2026-11-27"), days[0], "같은 날은 같은 문제");
    assert.ok(days.every((q) => list.includes(q)));
    if (list.length === 3) {
      assert.equal(new Set(days.slice(0, 3)).size, 3, `${id}: 3일 동안 서로 다른 문제`);
      assert.equal(days[3], days[0]);
    }
  }
  assert.equal(boothQuestionFor("cyber", "2026-11-27"), null);
  assert.equal(boothQuestionFor("library", "날짜아님"), null);
});

test("채점: 정답 번호만 true, 0~2가 아닌 값 · 대상 아닌 건물은 null", () => {
  const day = "2026-11-27";
  for (const id of STAMP_RALLY_IDS) {
    const q = boothQuestionFor(id, day);
    assert.equal(gradeBooth(id, day, q.answer), true);
    assert.equal(gradeBooth(id, day, (q.answer + 1) % 3), false);
    for (const bad of [-1, 3, 1.5, "1", null, undefined]) assert.equal(gradeBooth(id, day, bad), null);
  }
  assert.equal(gradeBooth("cyber", day, 0), null);
});

test("다음 목적지는 표시 순서에서 아직 안 받은 첫 곳(받는 순서는 자유)", () => {
  assert.equal(nextRallyStop([]), "library");
  assert.equal(nextRallyStop(["main"]), "library");
  assert.equal(nextRallyStop(["library", "union"]), "main");
  assert.equal(nextRallyStop(["humanities", "library", "union", "main"]), null);
  assert.equal(rallyComplete(["library", "union", "main"]), false);
  assert.equal(rallyComplete(["humanities", "library", "union", "main"]), true);
});
