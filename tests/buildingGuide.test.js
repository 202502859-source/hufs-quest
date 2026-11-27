// 정문 고정값(campusV2Data.js DOOR_OVERRIDES)과 시설 소개를 여는 곳(11/27 오후: 안내원 NPC → "시설 안내문" 팻말)을 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUILDINGS,
  BUILDING_BASE,
  CELL_PX,
  FIXED_DOOR_IDS,
  GRID_W,
  SPAWN,
  WORLD_H,
  WORLD_W,
  cellWalkable,
  doorFrontOf,
  doorOf,
  feetOverlap,
  fits,
  isReachable,
  matAt,
  moveFeet,
  reachable,
  toWorld,
} from "../src/data/campusV2.js";
import { DOOR_OVERRIDES } from "../src/data/campusV2Data.js";
import { DOOR_ART_BASE, DOOR_ART_SCALE, doorArtOffsets, doorArtRect } from "../src/data/campusV2.js";
import { PALETTE, paintRegion } from "../src/gfx/campusV2Paint.js";
import { WORLD } from "../src/data/world.js";
import { readFileSync } from "node:fs";
import { GUIDE_NEAR_LABEL, guideSpotOf } from "../src/data/guides.js";
import { estimateLabelSize, placeBuildingLabel } from "../src/data/buildingLabels.js";
import { setLang, t } from "../src/state.js";
import { BUILDING_INFO } from "../src/data/buildingInfo.js";
import { GUIDE_EXCLUDED, GUIDE_RANGE, hasOfficeInfo, nearestOfficePlace } from "../src/ui/officeView.js";

const ELEVEN = ["union", "social", "library", "club", "cyber", "grad", "intl", "flc", "tlc", "humanities", "main"];
// 안내원 13곳: 정문 지정 11곳 + 법학관(자동 계산 정문) + Minerva Complex(이름표 옆). 정문안내실은 제외(11/25 종헌 결정)
const GUIDED = [...ELEVEN, "law", "minerva"];
const FACE = { union: "down", cyber: "down", humanities: "down", main: "down", club: "up", social: "right", library: "right", grad: "left", intl: "left", flc: "left", tlc: "left" };
const byId = (id) => BUILDINGS.find((b) => b.id === id);
const guides = () => WORLD.buildings.filter((b) => b.guide);

test("정문 고정값: 정해 둔 11개 건물만, 외벽 면은 11/25 종헌 확인대로", () => {
  assert.deepEqual([...FIXED_DOOR_IDS].sort(), [...ELEVEN].sort());
  for (const id of ELEVEN) assert.equal(DOOR_OVERRIDES[id].face, FACE[id], id);
  for (const b of BUILDINGS) assert.equal(Boolean(doorOf(b)?.fixed), ELEVEN.includes(b.id), `${b.id}: 고정 입구 여부`);
});

test("정문 고정값: 문 앞 자리는 걸을 수 있는 칸, 문은 그 건물 외벽이고 문 앞에서 3m 안", () => {
  for (const id of ELEVEN) {
    const b = byId(id);
    const door = doorOf(b);
    const front = doorFrontOf(b);
    const [wx, wy] = toWorld(DOOR_OVERRIDES[id].front);
    assert.ok(Math.hypot(front.x - wx, front.y - wy) <= 3, `${id}: 문 앞 자리가 지정 좌표에서 벗어남`);
    assert.ok(fits(front.x, front.y) && isReachable(front.x, front.y), `${id}: 문 앞에 못 감`);
    assert.ok(cellWalkable(Math.floor(front.x / CELL_PX), Math.floor((front.y + 4) / CELL_PX)), `${id}: 문 앞 칸이 막힘`);
    assert.equal(matAt(door.x, door.y), BUILDING_BASE + b.index, `${id}: 문이 그 건물 외벽이 아님`);
    // 발 가운데(문 앞 y + 4)에서 문까지 3m(12px) 안 = 외벽 바로 앞
    assert.ok(Math.hypot(door.x - front.x, door.y - (front.y + 4)) <= 12, `${id}: 문 앞이 외벽에서 멂`);
    // 문 바로 바깥 한 칸은 건물이 아님(외벽 가장자리)
    const out = { down: [0, 1], up: [0, -1], right: [1, 0], left: [-1, 0] }[door.face];
    assert.notEqual(matAt(door.x + out[0], door.y + out[1]), BUILDING_BASE + b.index, `${id}: 문이 외벽 가장자리가 아님`);
  }
});

// 11/27 오후: "건물 소개 안내원" NPC를 모두 없애고 "시설 안내문" 팻말로 바꿈(자리 · 크기 테스트는 tests/stampRallySpots.test.js)
const RALLY = ["library", "union", "main", "humanities"];
test("안내원 0명, 팻말 수 = 예전 안내원 9곳 + 스탬프 랠리 4곳 = 13곳(시설 소개를 여는 곳은 그대로). 그 밖의 건물에는 없음", () => {
  assert.equal(guides().length, 0, "안내원 NPC가 남아 있음");
  const signs = WORLD.buildings.filter((b) => b.sign).map((b) => b.id);
  assert.deepEqual([...signs].sort(), [...GUIDED].sort());
  assert.equal(signs.length, GUIDED.filter((id) => !RALLY.includes(id)).length + RALLY.length);
  assert.equal(signs.length, 13);
  // 예전 안내원 자리 계산(guides.js guideSpotOf)이 있는 건물과 같은 건물
  assert.deepEqual(BUILDINGS.filter((x) => guideSpotOf(x)).map((x) => x.id).sort(), [...GUIDED].sort());
  // 안내원 NPC 그리기 코드가 남아 있지 않음
  const scene = readFileSync(new URL("../src/scenes/CampusScene.js", import.meta.url), "utf8");
  assert.doesNotMatch(scene, /addGuide|GUIDE_LOOK|guideLabel|guideTextRect/);
});

test("Minerva Complex 팻말은 정문 대신 맵 위 \"Minerva Complex\" 이름표 바로 옆(예전 안내원 자리, 걸을 수 있는 칸), 시설 소개가 열림", () => {
  assert.ok(GUIDE_NEAR_LABEL.minerva);
  const minerva = WORLD.buildings.find((b) => b.id === "minerva");
  const g = minerva.sign;
  assert.ok(g, "Minerva 팻말 없음");
  assert.equal(g.attached, false, "외벽에 붙이지 않는 예외 자리");
  assert.deepEqual([g.x, g.y], [guideSpotOf(byId("minerva")).x, guideSpotOf(byId("minerva")).y]);
  assert.ok(fits(g.x, g.y) && isReachable(g.x, g.y), "걸을 수 있는 칸");
  const b = BUILDINGS.find((x) => x.id === "minerva");
  const spot = placeBuildingLabel(b, (scale, lines) => estimateLabelSize(b.name, scale, lines), []);
  const { w, h } = estimateLabelSize(b.name, spot.scale, spot.lines);
  const dx = Math.max(spot.x - w / 2 - g.x, 0, g.x - (spot.x + w / 2));
  const dy = Math.max(spot.y - h / 2 - g.y, 0, g.y - (spot.y + h / 2));
  assert.ok(Math.hypot(dx, dy) <= 48, `이름표에서 ${Math.round(Math.hypot(dx, dy))}px`);
  assert.equal(nearestOfficePlace(WORLD.buildings, g.x, g.y + 8)?.id, "minerva");
});

test("법학관(law)에는 팻말이 있고, 자동 계산 정문 옆에서 시설 소개가 열림", () => {
  const law = WORLD.buildings.find((b) => b.id === "law");
  assert.ok(law.sign?.attached, "법학관 팻말 없음");
  assert.ok(!law.door.fixed, "법학관 정문은 자동 계산 그대로");
  assert.equal(nearestOfficePlace(WORLD.buildings, law.sign.x, law.sign.y + 12)?.id, "law");
});

test("정문안내실(gatehouse)에는 팻말 · 안내원이 없고, 다가가도 시설 소개가 열리지 않음(건물 정보는 그대로)", () => {
  const gate = WORLD.buildings.find((b) => b.id === "gatehouse");
  assert.equal(gate.guide, null);
  assert.equal(gate.sign, null);
  assert.equal(GUIDE_EXCLUDED.gatehouse, "11/25 종헌 결정: 기능 없음");
  assert.equal(hasOfficeInfo("gatehouse"), false);
  assert.ok(BUILDING_INFO.gatehouse?.offices?.length, "정문안내실 건물 정보는 지우지 않음");
  const front = doorFrontOf(BUILDINGS.find((b) => b.id === "gatehouse"));
  for (const [dx, dy] of [[0, 0], [16, 0], [-16, 0], [0, -16]]) {
    assert.notEqual(nearestOfficePlace(WORLD.buildings, front.x + dx, front.y + dy)?.id, "gatehouse");
  }
});

test("[Enter] 시설 소개 거리(GUIDE_RANGE 64px)는 그대로: 팻말에서 64px 안이면 열리고 밖이면 안 열림", () => {
  assert.equal(GUIDE_RANGE, 64);
  for (const b of WORLD.buildings.filter((x) => x.sign)) {
    assert.equal(nearestOfficePlace([b], b.sign.x + 60, b.sign.y)?.id, b.id, b.id);
    assert.equal(nearestOfficePlace([b], b.sign.x + 66, b.sign.y), null, b.id);
  }
});

test("문구: [Enter] 시설 소개 · [터치] 시설 소개, 안내원 글자 (한/영)", () => {
  setLang("ko");
  assert.equal(`${t("officeKeyHint")} ${t("officePrompt")}`, "[Enter] 시설 소개");
  assert.equal(`${t("officeKeyHintTouch")} ${t("officePrompt")}`, "[터치] 시설 소개");
  assert.equal(t("guideLabel"), "건물 소개 안내원");
  setLang("en");
  assert.equal(`${t("officeKeyHint")} ${t("officePrompt")}`, "[Enter] Facility guide");
  assert.equal(`${t("officeKeyHintTouch")} ${t("officePrompt")}`, "[Tap] Facility guide");
  assert.equal(t("guideLabel"), "Building Guide");
  setLang("ko");
});

test("출입문 그림 1.5배(11/27 오후): 그림 칸만 커지고(아래 · 위 7×8 → 11×12, 옆 6×8 → 9×12) 문 자리 · 문 앞 칸은 그대로, 실제로 그렇게 칠해짐", () => {
  assert.equal(DOOR_ART_SCALE, 1.5);
  const size = (o) => [o.x1 - o.x0 + 1, o.y1 - o.y0 + 1];
  for (const [face, base] of Object.entries(DOOR_ART_BASE)) {
    const [bw, bh] = size(base);
    const [w, h] = size(doorArtOffsets(face));
    assert.ok(Math.abs(w - bw * 1.5) <= 1 && Math.abs(h - bh * 1.5) <= 1, `${face}: ${bw}×${bh} → ${w}×${h}`);
  }
  assert.deepEqual(size(doorArtOffsets("down")), [11, 12]);
  assert.deepEqual(size(doorArtOffsets("right")), [9, 12]);
  // 문 자리 · 문 앞 칸(충돌 · 맵)은 그대로: 11/27 오전 값
  const main = byId("main");
  assert.deepEqual([doorOf(main).x, doorOf(main).y, doorFrontOf(main).x, doorFrontOf(main).y], [1046, 532, 1046, 534]);
  const library = byId("library");
  assert.deepEqual([doorOf(library).x, doorOf(library).y, doorFrontOf(library).x, doorFrontOf(library).y], [618, 1002, 626, 998]);
  // 칠해진 문 색 픽셀이 문 그림 칸 안에만 있고, 예전 크기(7×8 = 56)보다 많음
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)].join(",");
  const doorColors = new Set([hex(PALETTE.door), hex(PALETTE.doorFrame)]);
  for (const b of [main, byId("humanities"), byId("cyber")]) {
    const r = doorArtRect(b);
    const pad = 6;
    const x0 = r.x0 - pad, y0 = r.y0 - pad, w = r.x1 - r.x0 + pad * 2, h = r.y1 - r.y0 + pad * 2;
    const px = paintRegion(x0, y0, w, h);
    let inside = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (!doorColors.has(`${px[o]},${px[o + 1]},${px[o + 2]}`)) continue;
        const wx = x0 + x, wy = y0 + y;
        assert.ok(wx >= r.x0 && wx < r.x1 && wy >= r.y0 && wy < r.y1, `${b.id}: 문 색이 문 그림 칸 밖 (${wx}, ${wy})`);
        inside += 1;
      }
    }
    assert.ok(inside > 56 && inside <= 11 * 12, `${b.id}: 문 픽셀 ${inside}개`);
  }
});
