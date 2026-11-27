// 스탬프 랠리 부스 · "시설 안내문" 팻말 자리(src/data/stampRallySpots.js)와 [Enter] 시설 소개 위치를 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDINGS, BUILDING_BASE, CELL_PX, GRID_W, MAT, PASSAGES, SPAWN, WORLD_H, WORLD_W, doorFrontOf, doorOf, feetOverlap, fits, gateRects, quizSpots, isReachable, matAt, moveFeet, reachable } from "../src/data/campusV2.js";
import { WORLD } from "../src/data/world.js";
import { BOOTH_TALK, boothRect, boothTalkPoint, feetHitBooth, feetHitSign, rallySpotsOf, rallyStops } from "../src/data/stampRallySpots.js";
import { GUIDE_RANGE, nearestOfficePlace, officeSpot } from "../src/ui/officeView.js";
import { STAMP_RALLY_IDS } from "../shared/stampRally.js";
import { BOOTH_SIZE } from "../src/gfx/rallyTextures.js";

const stops = rallyStops();
const NOT_TARGETS = ["cyber", "gatehouse", "flc"];
const blockedByRally = (x, y) => stops.some((s) => feetHitSign(x, y, s.sign) || feetHitBooth(x, y, s.booth));
const blockedByAll = (x, y) => blockedByRally(x, y) || WORLD.buildings.some((b) => b.guide && feetOverlap(x, y, b.guide.x, b.guide.y));

test("부스 · 팻말은 대상 4곳에만 있음(사이버관 · 정문안내실 · 외국어연수평가원 · 정문 광장에는 없음)", () => {
  assert.deepEqual(WORLD.buildings.filter((b) => b.booth).map((b) => b.id).sort(), [...STAMP_RALLY_IDS].sort());
  assert.deepEqual(WORLD.buildings.filter((b) => b.sign).map((b) => b.id).sort(), [...STAMP_RALLY_IDS].sort());
  for (const id of NOT_TARGETS) {
    const b = WORLD.buildings.find((x) => x.id === id);
    assert.equal(b.booth, null, id);
    assert.equal(b.sign, null, id);
    assert.equal(rallySpotsOf(BUILDINGS.find((x) => x.id === id)), null, id);
  }
  assert.ok(WORLD.openSpaces.every((s) => !s.booth && !s.sign), "정문 & 진입광장 등 열린 공간");
});

test("대상이 아닌 건물의 [Enter] 시설 소개는 그대로 안내원에서 열림(사이버관 · 외국어연수평가원), 정문안내실은 안 열림", () => {
  for (const id of ["cyber", "flc"]) {
    const b = WORLD.buildings.find((x) => x.id === id);
    assert.ok(b.guide, `${id}: 안내원 그대로`);
    assert.equal(nearestOfficePlace(WORLD.buildings, b.guide.x + 8, b.guide.y + 8)?.id, id);
  }
  const gatehouse = WORLD.buildings.find((x) => x.id === "gatehouse");
  assert.equal(gatehouse.guide, null);
  const front = doorFrontOf(BUILDINGS.find((x) => x.id === "gatehouse"));
  assert.notEqual(nearestOfficePlace(WORLD.buildings, front.x, front.y)?.id, "gatehouse");
});

test("대상 4곳: [Enter] 시설 소개는 팻말에서 열리고 안내원(예전 자리)과 중복되지 않음", () => {
  for (const id of STAMP_RALLY_IDS) {
    const b = WORLD.buildings.find((x) => x.id === id);
    assert.equal(b.guide, null, `${id}: 안내원 NPC 없음`);
    assert.deepEqual(officeSpot(b), b.sign);
    assert.equal(nearestOfficePlace(WORLD.buildings, b.sign.x + 6, b.sign.y + 10)?.id, id, `${id}: 팻말 옆에서 열림`);
    // 팻말에서 먼 곳(안내 거리 밖)에서는 뜨지 않음
    const far = nearestOfficePlace([b], b.sign.x + GUIDE_RANGE + 4, b.sign.y);
    assert.equal(far, null);
  }
});

test("팻말: 출입구 옆 1~2칸(같은 외벽 앞), 걸을 수 있는 칸, 문 앞 칸을 막지 않고 문과 같은 방향을 봄", () => {
  const fronts = BUILDINGS.map(doorFrontOf).filter(Boolean);
  for (const { id, building, sign } of stops) {
    const front = doorFrontOf(building);
    const face = doorOf(building).face;
    assert.equal(sign.face, face, `${id}: 팻말 방향 = 문 방향`);
    const vertical = face === "left" || face === "right";
    const along = Math.abs(vertical ? sign.y - front.y : sign.x - front.x);
    const away = Math.abs(vertical ? sign.x - front.x : sign.y - front.y);
    assert.ok((along === 16 || along === 32) && away === 0, `${id}: 문에서 ${along / 16}칸 옆, 벽에서 ${away}px`);
    assert.equal(sign.cells, along / 16);
    assert.ok(fits(sign.x, sign.y) && isReachable(sign.x, sign.y), `${id}: 팻말 자리가 걸을 수 없는 칸`);
    for (const f of fronts) assert.ok(!feetHitSign(f.x, f.y, sign), `${id}: 팻말이 문 앞 칸과 겹침`);
  }
});

test("부스: 출입구를 사이에 두고 팻말 반대쪽, 문에서 살짝 떨어진 바깥쪽. 바닥 전체가 걸을 수 있는 칸이고 차도 · 건널목 · 주차장이 아님", () => {
  const fronts = BUILDINGS.map(doorFrontOf).filter(Boolean);
  const outward = { down: [0, 1], up: [0, -1], right: [1, 0], left: [-1, 0] };
  for (const { id, building, sign, booth } of stops) {
    const front = doorFrontOf(building);
    const face = doorOf(building).face;
    const vertical = face === "left" || face === "right";
    const side = (p) => Math.sign(vertical ? p.y - front.y : p.x - front.x);
    assert.equal(side(booth), -side(sign), `${id}: 팻말과 부스가 같은 쪽`);
    assert.equal(booth.side, -sign.side);
    const [ox, oy] = outward[face];
    const out = (booth.x - front.x) * ox + (booth.y - front.y) * oy;
    const along = Math.abs(vertical ? booth.y - front.y : booth.x - front.x);
    assert.ok(out >= 12 && out <= 44, `${id}: 문에서 바깥으로 ${out}px`);
    assert.ok(along >= 28 && along <= 56, `${id}: 문에서 옆으로 ${along}px`);
    assert.ok(Math.hypot(booth.x - front.x, booth.y - front.y) > Math.hypot(sign.x - front.x, sign.y - front.y), `${id}: 부스가 팻말보다 문에서 멂`);

    const r = boothRect(booth);
    for (let y = r.y0; y <= r.y1; y += 2) {
      for (let x = r.x0; x <= r.x1; x += 2) {
        const m = matAt(x, y);
        assert.ok(m < BUILDING_BASE && ![MAT.road, MAT.crosswalk, MAT.parking, MAT.outerRoad, MAT.outside, MAT.forest, MAT.water].includes(m), `${id}: 부스 바닥 (${x}, ${y}) 재질 ${m}`);
      }
    }
    for (const f of fronts) assert.ok(!feetHitBooth(f.x, f.y, booth), `${id}: 부스가 문 앞 칸을 덮음`);
    assert.ok(!feetHitBooth(sign.x, sign.y, booth), `${id}: 부스가 팻말을 덮음`);
    // 앞쪽(아래)에서 말을 걸 수 있는 자리
    const talk = boothTalkPoint(booth);
    assert.ok(fits(talk.x, talk.y) && isReachable(talk.x, talk.y) && !blockedByAll(talk.x, talk.y), `${id}: 부스 앞에 설 자리가 없음`);
    assert.ok(BOOTH_TALK.range >= 24);
  }
});

test("부스 · 팻말을 막아도 캠퍼스에서 끊기는 곳이 없음(모든 문 앞 · 요구된 통로가 그대로 이어짐)", () => {
  const key = (x, y) => ((y - 2) / CELL_PX) * GRID_W + (x - 2) / CELL_PX;
  const seen = new Uint8Array(GRID_W * (WORLD_H / CELL_PX));
  const queue = [[SPAWN.x, SPAWN.y]];
  seen[key(SPAWN.x, SPAWN.y)] = 1;
  for (let q = 0; q < queue.length; q++) {
    const [x, y] = queue[q];
    for (const [dx, dy] of [[CELL_PX, 0], [-CELL_PX, 0], [0, CELL_PX], [0, -CELL_PX]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WORLD_W || ny >= WORLD_H || seen[key(nx, ny)] || !fits(nx, ny) || blockedByAll(nx, ny)) continue;
      seen[key(nx, ny)] = 1;
      queue.push([nx, ny]);
    }
  }
  const lost = reachable().list.filter(({ x, y }) => !seen[key(x, y)] && !blockedByAll(x, y));
  assert.equal(lost.length, 0, `끊긴 칸 ${lost.length}개, 예: ${JSON.stringify(lost.slice(0, 3))}`);
  for (const b of BUILDINGS) {
    const f = doorFrontOf(b);
    if (f) assert.ok(seen[key(f.x, f.y)], `${b.id}: 문 앞에 못 감`);
  }
  // 요구된 통로(campusV2Data.js PASSAGES_M)의 선 위 점들이 부스 · 팻말에 막히지 않음
  const snap = (v) => Math.floor(v / CELL_PX) * CELL_PX + CELL_PX / 2;
  for (const { name, segPx } of PASSAGES) {
    const [[x0, y0], [x1, y1]] = segPx;
    for (let i = 0; i <= 20; i++) {
      const x = snap(x0 + ((x1 - x0) * i) / 20);
      const y = snap(y0 + ((y1 - y0) * i) / 20);
      assert.ok(!blockedByRally(x, y), `${name}: (${x}, ${y})가 부스 · 팻말에 막힘`);
    }
  }
});

test("부스 · 팻말은 통과할 수 없음(이동 판정), 퀴즈 상자는 부스 · 팻말과 겹치지 않음", () => {
  for (const { id, sign, booth } of stops) {
    const r = boothRect(booth);
    // 부스 아래에서 위로 걸어도 바닥 사각형 안으로 들어가지 않음
    let p = boothTalkPoint(booth);
    for (let i = 0; i < 30; i++) p = moveFeet(p.x, p.y, 0, -2, blockedByAll);
    assert.ok(!feetHitBooth(p.x, p.y, booth) && p.y > r.y1 - 8, `${id}: 부스를 뚫고 지나감 (${p.x}, ${p.y})`);
    // 팻말 옆에서 팻말 쪽으로 걸어도 겹치지 않음
    for (const [sx, sy, dx, dy] of [[sign.x - 12, sign.y, 2, 0], [sign.x + 12, sign.y, -2, 0], [sign.x, sign.y + 9, 0, -2]]) {
      if (!fits(sx, sy) || blockedByAll(sx, sy)) continue;
      let q = { x: sx, y: sy };
      for (let i = 0; i < 20; i++) q = moveFeet(q.x, q.y, dx, dy, blockedByAll);
      assert.ok(!feetHitSign(q.x, q.y, sign), `${id}: 팻말을 뚫고 지나감`);
    }
  }
  for (const q of WORLD.quizSpots()) {
    for (const { id, sign, booth } of stops) {
      const r = boothRect(booth);
      const inBooth = q.x + 8 > r.x0 && q.x - 8 < r.x1 && q.y + 8 > booth.y - 40 && q.y - 8 < r.y1 + 12;
      assert.ok(!inBooth, `${id}: 퀴즈 상자 (${q.x}, ${q.y})가 부스와 겹침`);
      assert.ok(Math.hypot(q.x - sign.x, q.y - sign.y) >= 28, `${id}: 퀴즈 상자 (${q.x}, ${q.y})가 팻말과 겹침`);
    }
  }
});

test("정문 기둥 · 현수막(#114)과 겹치지 않음: 부스 그림 · 팻말이 정문 그림에서 떨어져 있고, 퀴즈 상자 후보는 정문 · 부스 · 팻말 제외가 함께 걸림", () => {
  const gate = gateRects();
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const { id, sign, booth } of stops) {
    // 부스 그림(46×46, 바닥 기준점 23 · 39)과 이름표 칸, 팻말 판 · 기둥 칸
    const boothArt = { x: booth.x - BOOTH_SIZE.originX, y: booth.y - BOOTH_SIZE.originY - 12, w: BOOTH_SIZE.w, h: BOOTH_SIZE.h + 12 };
    const signArt = { x: sign.x - 28, y: sign.y - 24, w: 56, h: 32 };
    for (const r of gate) {
      assert.ok(!hit(boothArt, r), `${id}: 부스가 정문 그림과 겹침`);
      assert.ok(!hit(signArt, r), `${id}: 팻말이 정문 그림과 겹침`);
    }
    // 정문 기둥 받침 칸(판정 격자에서 막힘) 위에 부스 바닥 · 팻말 · 부스 앞 말 거는 자리가 없음
    for (const p of [sign, boothTalkPoint(booth)]) assert.ok(fits(p.x, p.y), `${id}: (${p.x}, ${p.y})가 막힌 칸`);
  }
  // WORLD.quizSpots = 맵 후보(정문 그림 제외, campusV2.quizSpots) ∩ 안내원 · 부스 · 팻말 제외
  const v2Spots = new Set(quizSpots().map((p) => `${p.x},${p.y}`));
  const worldSpots = WORLD.quizSpots();
  assert.ok(worldSpots.length > 100, `퀴즈 상자 후보 ${worldSpots.length}개`);
  for (const q of worldSpots) {
    assert.ok(v2Spots.has(`${q.x},${q.y}`), `(${q.x}, ${q.y})는 정문 제외 목록에 없는 후보`);
    for (const r of gate) assert.ok(!hit({ x: q.x - 8, y: q.y - 10, w: 16, h: 18 }, r), `(${q.x}, ${q.y}) 정문 그림과 겹침`);
  }
});
