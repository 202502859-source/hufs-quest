// src/data/campus.js 캠퍼스 맵 배치를 확인합니다(docs/GRAPHICS.md 1단계 확정 배치). 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUILDINGS,
  BUILDING_AT,
  BUILDING_CHAR,
  GROUND,
  MAP_HEIGHT,
  MAP_WIDTH,
  OPEN_SPACES,
  SPAWN,
  WALKABLE_GROUND,
  buildCampusLayers,
  doorFront,
  doorTile,
  npcTile,
  officialToTile,
  quizBoxTiles,
  reachableTiles,
} from "../src/data/campus.js";
import { BUILDING_INFO } from "../src/data/buildingInfo.js";
import { TILE } from "../src/gfx/textures.js";

const QUIZ_BOX_COUNT = 15; // src/quizBoxes.js (Phaser를 불러와 테스트에서 직접 못 씀)
const key = (x, y) => `${x},${y}`;
const { ground, solid } = buildCampusLayers();
const reachable = new Set(reachableTiles(solid).map(({ x, y }) => key(x, y)));
const isForest = (x, y) => GROUND[y][x] === "T" || solid[y][x] === TILE.TREE;

test("바닥 격자 크기 88×90, 아는 글자만", () => {
  assert.equal(MAP_WIDTH, 88);
  assert.equal(MAP_HEIGHT, 90);
  assert.equal(GROUND.length, MAP_HEIGHT);
  const known = new Set(['"', ".", ":", "=", "P", "F", "T", "-", "#", "x", "%", "o", ...Object.values(BUILDING_CHAR)]);
  GROUND.forEach((row, y) => {
    assert.equal(row.length, MAP_WIDTH, `${y}행 길이`);
    [...row].forEach((c, x) => assert.ok(known.has(c), `(${x},${y}) 모르는 글자 '${c}'`));
  });
});

test("건물 사각형은 맵 안, 다른 건물끼리 겹치지 않음", () => {
  const owner = new Map();
  for (const b of BUILDINGS) {
    assert.ok(b.parts.length >= 1 && b.parts.length <= 4, `${b.id}: 사각형 1~4개`);
    for (const [x, y, w, h] of b.parts) {
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= MAP_WIDTH && y + h <= MAP_HEIGHT, `${b.id}: 맵 밖 [${x},${y},${w},${h}]`);
      for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) {
          const other = owner.get(key(i, j));
          assert.ok(!other || other === b.id, `${b.id} · ${other} 겹침 (${i},${j})`);
          owner.set(key(i, j), b.id);
        }
      }
    }
  }
});

test("GROUND의 건물 글자와 parts가 같은 자리", () => {
  const charOf = Object.fromEntries(Object.entries(BUILDING_CHAR).map(([id, c]) => [c, id]));
  GROUND.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const id = BUILDING_AT.get(key(x, y));
      if (charOf[c]) assert.equal(id, charOf[c], `(${x},${y}) 글자 '${c}'인데 parts는 ${id ?? "없음"}`);
      else assert.equal(id, undefined, `(${x},${y}) ${id}의 parts인데 글자는 '${c}'`);
    }),
  );
  BUILDINGS.forEach((b) => assert.ok(BUILDING_CHAR[b.id], `${b.id}: BUILDING_CHAR 없음`));
});

test("공식 좌표 점이 건물 안(열린 공간은 1칸 이내)", () => {
  for (const place of [...BUILDINGS, ...OPEN_SPACES]) {
    if (!place.official) continue; // 정문안내실은 자체 좌표 없음
    const { x, y } = officialToTile(...place.official);
    const dist = Math.min(
      ...place.parts.map(([px, py, pw, ph]) => Math.max(px - x, 0, x - (px + pw - 1), py - y, 0, y - (py + ph - 1))),
    );
    const allowed = BUILDINGS.includes(place) ? 0 : 1;
    assert.ok(dist <= allowed, `${place.id}: 공식 좌표 타일 (${x},${y})이 ${dist}칸 떨어짐`);
  }
});

test("입구는 건물 가장자리, 앞 칸은 걸을 수 있는 바닥(건물 · 숲 아님)", () => {
  for (const b of BUILDINGS) {
    const door = doorTile(b);
    assert.equal(BUILDING_AT.get(key(door.x, door.y)), b.id, `${b.id}: 입구가 건물 칸이 아님`);
    const front = doorFront(b);
    assert.equal(BUILDING_AT.get(key(front.x, front.y)), undefined, `${b.id}: 입구 앞이 건물`);
    assert.ok(WALKABLE_GROUND.has(GROUND[front.y][front.x]), `${b.id}: 입구 앞 바닥 '${GROUND[front.y][front.x]}'`);
    assert.equal(solid[front.y][front.x], -1, `${b.id}: 입구 앞이 막힘`);
  }
});

test("안내원(NPC) 자리는 건물 · 숲 · 입구 앞이 아니고 걸을 수 있는 칸", () => {
  const fronts = new Set(BUILDINGS.map((b) => key(doorFront(b).x, doorFront(b).y)));
  for (const b of BUILDINGS) {
    const { x, y } = npcTile(b);
    assert.equal(BUILDING_AT.get(key(x, y)), undefined, `${b.id}: NPC가 건물 안`);
    assert.ok(!isForest(x, y), `${b.id}: NPC가 숲 안`);
    assert.ok(!fronts.has(key(x, y)), `${b.id}: NPC가 입구 앞을 막음`);
    assert.equal(solid[y][x], -1, `${b.id}: NPC 자리가 막힘`);
  }
});

test("SPAWN(정문 광장)에서 모든 입구 앞 · NPC 자리까지 걸어서 갈 수 있음(BFS)", () => {
  assert.ok(WALKABLE_GROUND.has(GROUND[SPAWN.y][SPAWN.x]), "SPAWN은 걸을 수 있는 칸");
  assert.equal(solid[SPAWN.y][SPAWN.x], -1);
  const gate = OPEN_SPACES.find((s) => s.id === "gate");
  assert.ok(SPAWN.x >= gate.x && SPAWN.x < gate.x + gate.w && SPAWN.y >= gate.y && SPAWN.y < gate.y + gate.h, "SPAWN은 정문&진입광장 안");
  for (const b of BUILDINGS) {
    const front = doorFront(b);
    assert.ok(reachable.has(key(front.x, front.y)), `${b.id}: 입구 앞 (${front.x},${front.y})에 못 감`);
    const npc = npcTile(b);
    assert.ok(reachable.has(key(npc.x, npc.y)), `${b.id}: NPC 자리 (${npc.x},${npc.y})에 못 감`);
  }
});

test("퀴즈 상자 자리: 걸어서 닿고, 건물 · 숲 · 입구 앞이 아니며, 15개를 놓을 만큼 넉넉함", () => {
  const tiles = quizBoxTiles(ground, solid);
  assert.ok(tiles.length >= QUIZ_BOX_COUNT * 20, `후보 ${tiles.length}칸`);
  const fronts = new Set(BUILDINGS.map((b) => key(doorFront(b).x, doorFront(b).y)));
  for (const { x, y } of tiles) {
    assert.ok(reachable.has(key(x, y)), `(${x},${y}) 못 감`);
    assert.equal(BUILDING_AT.get(key(x, y)), undefined, `(${x},${y}) 건물 안`);
    assert.ok(!isForest(x, y), `(${x},${y}) 숲 안`);
    assert.ok(!fronts.has(key(x, y)), `(${x},${y}) 입구 앞`);
    assert.ok(!["=", "P", "F", "x"].includes(GROUND[y][x]), `(${x},${y}) 차도 · 주차장 · 운동장 · 건널목`);
  }
});

test("걸을 수 있는 칸은 모두 한 덩어리(숲에 갇힌 빈칸 없음)", () => {
  const lost = [];
  GROUND.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (WALKABLE_GROUND.has(c) && solid[y][x] === -1 && !reachable.has(key(x, y))) lost.push(key(x, y));
    }),
  );
  assert.deepEqual(lost, []);
});

test("buildingInfo.js와 campus.js의 id가 일치(onMap: false만 예외)", () => {
  const onMap = new Set([...BUILDINGS, ...OPEN_SPACES].map((p) => p.id));
  assert.equal(onMap.size, BUILDINGS.length + OPEN_SPACES.length, "campus.js 안에서 id 중복");
  for (const id of onMap) assert.ok(BUILDING_INFO[id], `${id}: buildingInfo.js에 없음`);
  for (const [id, info] of Object.entries(BUILDING_INFO)) {
    if (info.onMap === false) assert.ok(!onMap.has(id), `${id}: onMap false인데 맵에 있음`);
    else assert.ok(onMap.has(id), `${id}: buildingInfo.js에만 있고 맵에 없음(빼려면 onMap: false)`);
  }
});
