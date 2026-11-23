// 캠퍼스 맵 v2(기본 맵, src/data/campusV2.js)를 확인합니다. 기준: docs/GRAPHICS.md. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUILDINGS,
  BUILDING_BASE,
  GRID_W,
  MAT,
  OPEN_SPACES,
  PASSAGES,
  ROTATION_DEG,
  SPAWN,
  WORLD_H,
  WORLD_W,
  cellWalkable,
  doorFrontOf,
  doorOf,
  fillPolygon,
  fits,
  isReachable,
  matAt,
  moveFeet,
  npcSpotOf,
  pathTo,
  pointInPolygon,
  quizSpots,
  toWorld,
  walkGrid,
} from "../src/data/campusV2.js";
import { paintOverview, paintRegion } from "../src/gfx/campusV2Paint.js";
import { BUILDING_INFO } from "../src/data/buildingInfo.js";
import { MAP_VERSION, WORLD } from "../src/data/world.js";

const blockedAt = (x, y) => !cellWalkable(Math.floor(x / 4), Math.floor(y / 4));
const forestOrBuilding = (x, y) => {
  const m = matAt(x, y);
  return m >= BUILDING_BASE || m === MAT.forest;
};

test("기본 맵은 v2, 회전 각도는 진입로 측정값(약 66°)", () => {
  assert.equal(MAP_VERSION, "v2");
  assert.equal(WORLD.version, "v2");
  assert.ok(Math.abs(ROTATION_DEG - 66) <= 2, `ROTATION_DEG ${ROTATION_DEG}`);
});

test("정문에서 위를 보면 대운동장은 오른쪽, 사이버관은 왼쪽", () => {
  const field = toWorld(OPEN_SPACES.find((s) => s.id === "field").official);
  const cyber = toWorld(BUILDINGS.find((b) => b.id === "cyber").official);
  assert.ok(field[0] > SPAWN.x && field[1] < SPAWN.y, "대운동장이 정문 오른쪽 위");
  assert.ok(cyber[0] < SPAWN.x && cyber[1] < SPAWN.y, "사이버관이 정문 왼쪽 위");
});

test("텍스처 조각(2×2)은 모바일 WebGL 한도 4096px 안", () => {
  assert.ok(Math.ceil(WORLD_W / 2) <= 4096 && Math.ceil(WORLD_H / 2) <= 4096, `${WORLD_W}×${WORLD_H}`);
  assert.equal(paintRegion(0, 0, 16, 16).length, 16 * 16 * 4);
  assert.equal(paintOverview().length, GRID_W * Math.round(WORLD_H / 4) * 4);
});

test("공식 좌표 점이 건물(지하 건물은 지하 범위) · 열린 공간 안", () => {
  for (const b of BUILDINGS) {
    if (!b.official) continue; // 정문안내실은 자체 좌표 없음
    const polys = b.footprint ? [b.footprint] : b.polys;
    assert.ok(polys.some((p) => pointInPolygon(b.official, p)), `${b.id}: 공식 좌표 ${b.official}가 건물 밖`);
  }
  for (const s of OPEN_SPACES) assert.ok(pointInPolygon(s.official, s.poly), `${s.id}: 공식 좌표가 공간 밖`);
});

test("건물끼리 겹치지 않음", () => {
  const owner = new Int16Array(WORLD_W * WORLD_H).fill(-1);
  for (const b of BUILDINGS) {
    const mine = new Uint8Array(WORLD_W * WORLD_H);
    b.polysPx.forEach((p) => fillPolygon(mine, WORLD_W, WORLD_H, p, 1));
    for (let k = 0; k < mine.length; k++) {
      if (!mine[k]) continue;
      assert.ok(owner[k] === -1, `${b.id} · ${BUILDINGS[owner[k]]?.id} 겹침 (${k % WORLD_W}, ${Math.floor(k / WORLD_W)})`);
      owner[k] = b.index;
    }
  }
});

test("모든 건물에 입구가 있고, 입구 앞 · 안내원 자리는 걸을 수 있고 SPAWN에서 닿음", () => {
  assert.ok(fits(SPAWN.x, SPAWN.y), "SPAWN 자리가 막힘");
  const fronts = BUILDINGS.map(doorFrontOf);
  for (const b of BUILDINGS) {
    const door = doorOf(b);
    const front = doorFrontOf(b);
    assert.ok(door && front, `${b.id}: 입구 없음`);
    assert.equal(matAt(door.x, door.y), BUILDING_BASE + b.index, `${b.id}: 입구가 건물 벽이 아님`);
    assert.ok(fits(front.x, front.y) && isReachable(front.x, front.y), `${b.id}: 입구 앞에 못 감`);
    const npc = npcSpotOf(b);
    assert.ok(npc && fits(npc.x, npc.y) && isReachable(npc.x, npc.y), `${b.id}: 안내원 자리에 못 감`);
    assert.ok(!forestOrBuilding(npc.x, npc.y), `${b.id}: 안내원이 건물 · 숲 안`);
    assert.ok(fronts.every((f) => f === front || Math.hypot(f.x - npc.x, f.y - npc.y) >= 12), `${b.id}: 안내원이 다른 입구 앞을 막음`);
  }
});

test("퀴즈 상자 자리: 걸을 수 있고 SPAWN에서 닿으며 건물 · 숲 · 입구 앞이 아님", () => {
  const spots = quizSpots();
  assert.ok(spots.length >= 300, `후보 ${spots.length}곳`);
  const fronts = BUILDINGS.map(doorFrontOf);
  for (const { x, y } of spots) {
    assert.ok(fits(x, y) && isReachable(x, y), `(${x},${y}) 못 감`);
    assert.ok(!forestOrBuilding(x, y), `(${x},${y}) 건물 · 숲 안`);
    assert.ok(fronts.every((f) => Math.hypot(f.x - x, f.y - y) >= 20), `(${x},${y}) 입구 앞`);
  }
});

test("요구된 통로(대학원 옆 · 국제관 옆 · 법학관-학생회관 사이 · 사회과학관 앞 · 도서관 양옆 · 사이버관-교수회관 사이 · 진입로)는 막히지 않음", () => {
  for (const { name, segPx: [a, b] } of PASSAGES) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
    for (let i = 0; i <= n; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / n;
      const y = a[1] + ((b[1] - a[1]) * i) / n;
      assert.ok(!blockedAt(x, y), `${name}: (${Math.round(x)},${Math.round(y)}) 막힘`);
      assert.ok(isReachable(x, y), `${name}: (${Math.round(x)},${Math.round(y)}) SPAWN과 이어지지 않음`);
    }
  }
});

test("끼임 방지: SPAWN에서 모든 입구 앞까지 BFS 경로를 실제 이동 함수로 걸어가면 도착", () => {
  const SPEED = 1.5; // 프레임당 px(90px/s ÷ 60fps)
  for (const b of BUILDINGS) {
    const front = doorFrontOf(b);
    const path = pathTo(front.x, front.y);
    assert.ok(path, `${b.id}: 경로 없음`);
    let pos = { x: SPAWN.x, y: SPAWN.y };
    let steps = 0;
    for (const wp of path) {
      while (Math.hypot(wp.x - pos.x, wp.y - pos.y) > 0.01) {
        const dx = wp.x - pos.x;
        const dy = wp.y - pos.y;
        const len = Math.hypot(dx, dy);
        const s = Math.min(SPEED, len);
        const next = moveFeet(pos.x, pos.y, (dx / len) * s, (dy / len) * s);
        assert.ok(next.x !== pos.x || next.y !== pos.y, `${b.id}: (${Math.round(pos.x)},${Math.round(pos.y)})에서 멈춤`);
        pos = next;
        assert.ok(++steps < 20000, `${b.id}: 너무 오래 걸림`);
      }
    }
    assert.ok(Math.hypot(pos.x - front.x, pos.y - front.y) < 1, `${b.id}: 입구 앞에 도착하지 못함`);
  }
});

test("끼임 방지: 비스듬한 벽에 대고 한 방향 키만 눌러도 벽을 따라 미끄러짐", () => {
  // 진입로에서 위로 똑바로 걷기: 막히지 않고 끝(가운데 큰길 쪽)까지 감
  let pos = { ...SPAWN };
  for (let i = 0; i < 400; i++) pos = moveFeet(pos.x, pos.y, 0, -1.5);
  assert.ok(SPAWN.y - pos.y > 400, `진입로를 ${Math.round(SPAWN.y - pos.y)}px만 감`);
  // 진입로 끝에서 오른쪽 키만: 비스듬한 가장자리를 만나도 계속 움직임
  let moved = 0;
  for (let i = 0; i < 200; i++) {
    const next = moveFeet(pos.x, pos.y, 1.5, 0);
    moved += Math.hypot(next.x - pos.x, next.y - pos.y);
    pos = next;
  }
  assert.ok(moved > 0, "오른쪽으로 전혀 못 감");
});

test("걷기 기본값: 캠퍼스 땅은 대부분 걸을 수 있음(막힌 칸은 건물 · 숲 · 물 · 밖뿐)", () => {
  const walk = walkGrid();
  let inside = 0;
  let open = 0;
  for (let k = 0; k < walk.length; k++) {
    const m = matAt((k % GRID_W) * 4 + 2, Math.floor(k / GRID_W) * 4 + 2);
    if (m === MAT.outside || m === MAT.outerRoad) continue;
    inside++;
    if (walk[k]) open++;
  }
  assert.ok(open / inside > 0.65, `캠퍼스 안 걷는 칸 비율 ${(open / inside).toFixed(2)}`);
});

test("buildingInfo.js와 v2 맵의 id가 일치(onMap: false만 예외)", () => {
  const onMap = new Set([...WORLD.buildings, ...WORLD.openSpaces].map((p) => p.id));
  for (const id of onMap) assert.ok(BUILDING_INFO[id], `${id}: buildingInfo.js에 없음`);
  for (const [id, info] of Object.entries(BUILDING_INFO)) {
    if (info.onMap === false) assert.ok(!onMap.has(id), `${id}: onMap false인데 맵에 있음`);
    else assert.ok(onMap.has(id), `${id}: buildingInfo.js에만 있고 맵에 없음`);
  }
  for (const b of WORLD.buildings) assert.ok(b.door && b.npc, `${b.id}: 입구 · 안내원 자리`);
});
