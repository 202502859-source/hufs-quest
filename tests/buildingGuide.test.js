// 정문 고정값(campusV2Data.js DOOR_OVERRIDES)과 정문 옆 "건물 소개 안내원" 자리를 확인합니다. 실행: npm test
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
import { WORLD } from "../src/data/world.js";
import { GUIDE_FALLBACK, GUIDE_NEAR_LABEL, GUIDE_TEXT_HALF, guideTextRect, guideTextRects } from "../src/data/guides.js";
import { estimateLabelSize, placeBuildingLabel, splitTwoLines } from "../src/data/buildingLabels.js";
import { setLang, t } from "../src/state.js";
import { BUILDING_INFO } from "../src/data/buildingInfo.js";
import { GUIDE_EXCLUDED, hasOfficeInfo, nearestOfficePlace } from "../src/ui/officeView.js";

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

test("건물 소개 안내원: 정문 지정 11곳 + 법학관 + Minerva Complex(13곳)에 한 명씩, 나머지 건물에는 없음", () => {
  assert.deepEqual(guides().map((b) => b.id).sort(), [...GUIDED].sort());
  assert.equal(guides().length, 13);
});

test("Minerva Complex 안내원은 정문 대신 맵 위 \"Minerva Complex\" 이름표 바로 옆(걸을 수 있는 칸), 시설 소개가 열림", () => {
  assert.ok(GUIDE_NEAR_LABEL.minerva);
  const minerva = WORLD.buildings.find((b) => b.id === "minerva");
  const g = minerva.guide;
  assert.ok(g, "Minerva 안내원 없음");
  assert.ok(fits(g.x, g.y) && isReachable(g.x, g.y), "걸을 수 있는 칸");
  const b = BUILDINGS.find((x) => x.id === "minerva");
  const spot = placeBuildingLabel(b, (scale, lines) => estimateLabelSize(b.name, scale, lines), guideTextRects());
  const { w, h } = estimateLabelSize(b.name, spot.scale, spot.lines);
  // 이름표 사각형 가장자리에서 40px 안
  const dx = Math.max(spot.x - w / 2 - g.x, 0, g.x - (spot.x + w / 2));
  const dy = Math.max(spot.y - h / 2 - g.y, 0, g.y - (spot.y + h / 2));
  assert.ok(Math.hypot(dx, dy) <= 40, `이름표에서 ${Math.round(Math.hypot(dx, dy))}px`);
  assert.equal(nearestOfficePlace(WORLD.buildings, g.x, g.y + 8)?.id, "minerva");
});

test("법학관(law)에는 안내원이 있고, 자동 계산 정문 옆에서 시설 소개가 열림", () => {
  const law = WORLD.buildings.find((b) => b.id === "law");
  assert.ok(law.guide, "법학관 안내원 없음");
  assert.ok(!law.door.fixed, "법학관 정문은 자동 계산 그대로");
  assert.equal(nearestOfficePlace(WORLD.buildings, law.guide.x, law.guide.y + 8)?.id, "law");
});

test("정문안내실(gatehouse)에는 안내원이 없고, 다가가도 시설 소개가 열리지 않음(건물 정보는 그대로)", () => {
  const gate = WORLD.buildings.find((b) => b.id === "gatehouse");
  assert.equal(gate.guide, null);
  assert.equal(GUIDE_EXCLUDED.gatehouse, "11/25 종헌 결정: 기능 없음");
  assert.equal(hasOfficeInfo("gatehouse"), false);
  assert.ok(BUILDING_INFO.gatehouse?.offices?.length, "정문안내실 건물 정보는 지우지 않음");
  const front = doorFrontOf(BUILDINGS.find((b) => b.id === "gatehouse"));
  for (const [dx, dy] of [[0, 0], [16, 0], [-16, 0], [0, -16]]) {
    assert.notEqual(nearestOfficePlace(WORLD.buildings, front.x + dx, front.y + dy)?.id, "gatehouse");
  }
  // 모든 건물 안내원 대상(=시설 소개를 여는 길)에 정문안내실이 없음
  assert.ok(!guides().some((b) => b.id === "gatehouse"));
});

test("건물 소개 안내원(11/26): 문 그림 바로 옆 칸(같은 외벽 앞, 문 앞 칸에서 한 칸 = 16px), 걸을 수 있고 어느 문 앞도 막지 않음", () => {
  const fronts = BUILDINGS.map(doorFrontOf).filter(Boolean);
  // 두 옆 칸이 모두 막혀 예전 자리에 둔 건물: 국제관(꺾인 외벽 안쪽, 한쪽은 벽 · 다른 쪽은 길을 끊음)
  assert.deepEqual([...GUIDE_FALLBACK].sort(), ["intl"]);
  for (const b of guides()) {
    if (GUIDE_NEAR_LABEL[b.id]) continue; // Minerva Complex는 이름표 옆(위 테스트)
    const { x, y } = b.guide;
    const front = doorFrontOf(b);
    const vertical = b.door.face === "left" || b.door.face === "right";
    const along = Math.abs(vertical ? y - front.y : x - front.x);
    const away = Math.abs(vertical ? x - front.x : y - front.y);
    if (GUIDE_FALLBACK.has(b.id)) assert.ok(along >= 16 && along <= 32 && away <= 16, `${b.id}: 예전 규칙 자리 (${x}, ${y})`);
    else assert.ok(along === 16 && away === 0, `${b.id}: 안내원이 문 바로 옆 칸이 아님 (${x}, ${y})`);
    assert.ok(fits(x, y) && isReachable(x, y), `${b.id}: 안내원 자리에 못 감`);
    for (const f of fronts) assert.ok(!feetOverlap(f.x, f.y, x, y), `${b.id}: 안내원이 문 앞 칸과 겹침`);
  }
});

test("건물 소개 안내원: 안내원 칸을 막아도 캠퍼스에서 끊기는 곳이 없음(모든 문 앞 · 통로가 그대로 이어짐)", () => {
  const spots = guides().map((b) => b.guide);
  const blocked = (x, y) => spots.some((g) => feetOverlap(x, y, g.x, g.y));
  const key = (x, y) => ((y - 2) / CELL_PX) * GRID_W + (x - 2) / CELL_PX;
  const seen = new Uint8Array(GRID_W * (WORLD_H / CELL_PX));
  const queue = [[SPAWN.x, SPAWN.y]];
  seen[key(SPAWN.x, SPAWN.y)] = 1;
  for (let q = 0; q < queue.length; q++) {
    const [x, y] = queue[q];
    for (const [dx, dy] of [[CELL_PX, 0], [-CELL_PX, 0], [0, CELL_PX], [0, -CELL_PX]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WORLD_W || ny >= WORLD_H || seen[key(nx, ny)] || !fits(nx, ny) || blocked(nx, ny)) continue;
      seen[key(nx, ny)] = 1;
      queue.push([nx, ny]);
    }
  }
  // 안내원이 없을 때 갈 수 있던 칸은, 안내원과 겹치는 칸만 빼고 모두 그대로 갈 수 있어야 함
  const lost = reachable().list.filter(({ x, y }) => !seen[key(x, y)] && !blocked(x, y));
  assert.equal(lost.length, 0, `끊긴 칸 ${lost.length}개, 예: ${JSON.stringify(lost.slice(0, 3))}`);
  for (const b of BUILDINGS) {
    const f = doorFrontOf(b);
    if (f) assert.ok(seen[key(f.x, f.y)], `${b.id}: 문 앞에 못 감`);
  }
});

test("건물 소개 안내원: 캐릭터가 안내원을 통과하지 못함(이동 판정)", () => {
  const g = guides()[0].guide;
  const blocked = (x, y) => feetOverlap(x, y, g.x, g.y);
  // 안내원 바로 옆에서 안내원 쪽으로 걸어도 겹치지 않음
  for (const [sx, sy, dx, dy] of [[g.x - 12, g.y, 2, 0], [g.x + 12, g.y, -2, 0], [g.x, g.y - 9, 0, 2], [g.x, g.y + 9, 0, -2]]) {
    if (!fits(sx, sy)) continue;
    let p = { x: sx, y: sy };
    for (let i = 0; i < 20; i++) p = moveFeet(p.x, p.y, dx, dy, blocked);
    assert.ok(!blocked(p.x, p.y), `(${sx}, ${sy})에서 안내원을 뚫고 지나감`);
  }
});

test("건물 소개 안내원 글자: 건물 이름표(한/영) · 퀴즈 상자와 겹치지 않음", () => {
  const tags = [];
  for (const b of BUILDINGS) {
    for (const lang of ["ko", "en"]) {
      const name = (lang === "en" ? b.nameEn : b.name) ?? b.name;
      const two = lang === "en" ? name : b.mapName ?? name;
      const spot = placeBuildingLabel(b, (scale, lines) => estimateLabelSize(lines === 2 ? two : name, scale, lines), guideTextRects());
      const { w, h } = estimateLabelSize(spot.lines === 2 ? splitTwoLines(two) : name, spot.scale, spot.lines);
      tags.push({ id: `${b.id}(${lang})`, x0: spot.x - w / 2, x1: spot.x + w / 2, y0: spot.y - h / 2, y1: spot.y + h / 2 });
    }
  }
  const boxes = WORLD.quizSpots();
  for (const b of guides()) {
    const g = b.guide;
    const r = guideTextRect(g);
    assert.equal(r.x1 - r.x0, GUIDE_TEXT_HALF * 2);
    for (const tag of tags) {
      const overlap = r.x0 < tag.x1 && tag.x0 < r.x1 && r.y0 < tag.y1 && tag.y0 < r.y1;
      assert.ok(!overlap, `${b.id} 안내원 글자가 ${tag.id} 이름표와 겹침`);
    }
    for (const q of boxes) {
      const box = { x0: q.x - 8, x1: q.x + 8, y0: q.y - 8, y1: q.y + 8 };
      const overlap = (box.x0 < r.x1 && r.x0 < box.x1 && box.y0 < r.y1 && r.y0 < box.y1) || Math.hypot(q.x - g.x, q.y - g.y) < 20;
      assert.ok(!overlap, `${b.id} 안내원 · 글자가 퀴즈 상자 (${q.x}, ${q.y})와 겹침`);
    }
  }
});

// 11/26 #75 검토: "문 바로 옆 칸"이 "글자가 지붕에 걸리지 않게 물러서기"(11/25)보다 우선.
// 교수회관은 문이 건물 위쪽 면이라 발밑 이름표 아래쪽이 초록 지붕 끝에 조금 걸림(이름표를 작게 줄여 덜 튐)
test("교수회관 안내원은 문 바로 옆 칸(위쪽 면 문의 왼쪽 또는 오른쪽 16px)", () => {
  const club = WORLD.buildings.find((b) => b.id === "club");
  const front = doorFrontOf(BUILDINGS.find((b) => b.id === "club"));
  assert.equal(club.guide.y, front.y);
  assert.equal(Math.abs(club.guide.x - front.x), 16);
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
