// 맵 v2 건물 이름표 자리(src/data/buildingLabels.js)를 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDINGS, BUILDING_BASE, OPEN_SPACES, doorOf, matAt } from "../src/data/campusV2.js";
import { estimateLabelSize, placeBuildingLabel, splitTwoLines } from "../src/data/buildingLabels.js";

const DEMO_ROUTE = ["gatehouse", "cyber", "main", "library", "flc"];
const own = (b, x, y) => matAt(Math.floor(x), Math.floor(y)) === BUILDING_BASE + b.index;
// 화면은 한국어 두 줄로 mapName(줄바꿈을 넣은 이름)을 씁니다(CampusScene.layoutNameTag)
const placeFor = (b, lang) => {
  const name = (lang === "en" ? b.nameEn : b.name) ?? b.name;
  const two = lang === "en" ? name : b.mapName ?? name;
  return placeBuildingLabel(b, (scale, lines) => estimateLabelSize(lines === 2 ? two : name, scale, lines));
};

for (const lang of ["ko", "en"]) {
  test(`모든 건물의 이름표 위치(가운데)가 그 건물 다각형 안 (${lang})`, () => {
    for (const b of BUILDINGS) {
      const spot = placeFor(b, lang);
      assert.ok(own(b, spot.x, spot.y), `${b.id}: 이름표 (${Math.round(spot.x)}, ${Math.round(spot.y)})가 건물 밖`);
    }
  });
}

test("지붕에 들어가는 건물은 이름표 사각형 네 모서리도 모두 지붕 안", () => {
  for (const b of BUILDINGS) {
    const spot = placeFor(b, "ko");
    if (spot.fit !== "roof") continue;
    const name = spot.lines === 2 ? splitTwoLines(b.mapName ?? b.name) : b.name;
    const { w, h } = estimateLabelSize(name, spot.scale, spot.lines);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      assert.ok(own(b, spot.x + (dx * w) / 2, spot.y + (dy * h) / 2), `${b.id}: 모서리가 지붕 밖`);
    }
  }
});

test("시연 동선 건물은 이름표가 입구 가까이(입구에서 120px 안)", () => {
  for (const id of DEMO_ROUTE) {
    const b = BUILDINGS.find((x) => x.id === id);
    const spot = placeFor(b, "ko");
    const door = doorOf(b);
    assert.ok(Math.hypot(spot.x - door.x, spot.y - door.y) < 120, `${id}: 입구에서 ${Math.round(Math.hypot(spot.x - door.x, spot.y - door.y))}px`);
  }
});

// #60 리뷰: 이 건물들의 이름표가 건물에서 멀리 떨어져 있었음(옛 자리 = 건물을 감싸는 사각형 위쪽 끝, 돌아간 건물은 건물 밖)
const REVIEW_60 = ["social", "law", "history", "main", "humanities", "tlc", "flc", "grad"];
for (const lang of ["ko", "en"]) {
  test(`#60 리뷰 건물 8개: 이름표 중심이 건물 안, 입구 쪽 지붕 위(입구에서 80px 안) (${lang})`, () => {
    for (const id of REVIEW_60) {
      const b = BUILDINGS.find((x) => x.id === id);
      const spot = placeFor(b, lang);
      const door = doorOf(b);
      const d = Math.hypot(spot.x - door.x, spot.y - door.y);
      assert.ok(own(b, spot.x, spot.y), `${id}: 이름표 중심이 건물 밖`);
      assert.equal(spot.fit, "roof", `${id}: 지붕에 못 들어가 가운데로 감`);
      assert.ok(d < 80, `${id}: 입구에서 ${Math.round(d)}px`);
    }
  });

  test(`Minerva Complex 이름표는 유리 천창 위, Minerva Square 이름표와 겹치지 않음 (${lang})`, () => {
    const complex = BUILDINGS.find((x) => x.id === "minerva");
    const square = OPEN_SPACES.find((x) => x.id === "square");
    const c = placeFor(complex, lang);
    assert.ok(own(complex, c.x, c.y), "Complex 이름표가 유리 천창(건물) 밖");
    const cName = c.lines === 2 ? splitTwoLines((lang === "en" ? complex.nameEn : complex.name) ?? complex.name) : (lang === "en" ? complex.nameEn : complex.name) ?? complex.name;
    const cs = estimateLabelSize(cName, c.scale, c.lines);
    const ss = estimateLabelSize((lang === "en" ? square.nameEn : square.name) ?? square.name, 1, 1);
    const apart = Math.abs(c.x - square.tag.x) * 2 >= cs.w + ss.w || Math.abs(c.y - square.tag.y) * 2 >= cs.h + ss.h;
    assert.ok(apart, `겹침: Complex (${Math.round(c.x)}, ${Math.round(c.y)}) · Square (${Math.round(square.tag.x)}, ${Math.round(square.tag.y)})`);
  });
}

test("두 줄 나누기: 이미 줄바꿈이 있으면 그대로(mapName), 띄어쓰기가 있으면 가운데에 가까운 곳, 없으면 절반", () => {
  assert.equal(splitTwoLines("정문\n안내실"), "정문\n안내실");
  assert.equal(splitTwoLines("인문\n과학관"), "인문\n과학관");
  assert.equal(splitTwoLines("Foreign Language Training Center"), "Foreign Language\nTraining Center");
  assert.equal(splitTwoLines("사이버관"), "사이\n버관");
});
