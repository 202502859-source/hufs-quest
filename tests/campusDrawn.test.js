// 맵 v2의 모든 건물이 게임 텍스처 · 미니맵/전체 지도 그림에 실제로 그려지고, 주변 바닥과 구분되는지 확인합니다.
// 배경: 교수회관 · 외국어연수평가원은 그려져 있었지만 녹색 지붕이 잔디 · 숲과 같은 색이라 보이지 않았습니다(#60 리뷰).
// 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILDINGS, BUILDING_BASE, GRID_H, GRID_W, WORLD_W, pointInPolygon, rasterize } from "../src/data/campusV2.js";
import { PALETTE, paintOverview, paintRegion } from "../src/gfx/campusV2Paint.js";
import { WORLD } from "../src/data/world.js";
import { BUILDING_INFO } from "../src/data/buildingInfo.js";

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const OUTLINE = hex(PALETTE.outline);
const GREENS = ["lawn", "lawnDark", "lawnLight", "grove", "canopy", "canopyLight", "forest", "forestLight"].map((k) => hex(PALETTE[k]));
const sameColor = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const { W, mat } = rasterize();

// 건물 다각형 안쪽 픽셀(가운데 점 기준)을 모두 돌며 fn(x, y)
function eachInside(b, fn) {
  for (let y = Math.floor(b.box.y0); y <= b.box.y1; y++) {
    for (let x = Math.floor(b.box.x0); x <= b.box.x1; x++) {
      if (b.polysPx.some((p) => pointInPolygon([x + 0.5, y + 0.5], p))) fn(x, y);
    }
  }
}

test("게임 화면에 쓰는 건물(WORLD.buildings)은 모두 맵 v2 건물 데이터에 있음", () => {
  const ids = new Set(BUILDINGS.map((b) => b.id));
  assert.equal(WORLD.version, "v2");
  for (const b of WORLD.buildings) assert.ok(ids.has(b.id), `${b.id}가 맵 v2에 없음`);
});

test("모든 건물: 다각형 안쪽 픽셀이 그 건물 재질(다른 바닥 다각형에 덮이지 않음)", () => {
  for (const b of BUILDINGS) {
    let inside = 0;
    let own = 0;
    eachInside(b, (x, y) => {
      inside += 1;
      if (mat[y * W + x] === BUILDING_BASE + b.index) own += 1;
    });
    assert.ok(inside > 0, `${b.name}: 다각형 안 픽셀 없음`);
    assert.ok(own / inside >= 0.99, `${b.name}: 건물 재질 ${own}/${inside}`);
  }
});

test("모든 건물: 게임 텍스처에서 다각형 안쪽이 잔디 · 숲 색이 아니고, 지상 건물은 둘레에 윤곽선이 있음", () => {
  for (const b of BUILDINGS) {
    const x0 = Math.floor(b.box.x0) - 1;
    const y0 = Math.floor(b.box.y0) - 1;
    const w = Math.ceil(b.box.x1) - x0 + 2;
    const h = Math.ceil(b.box.y1) - y0 + 2;
    const rgba = paintRegion(x0, y0, w, h);
    const color = (x, y) => {
      const o = ((y - y0) * w + (x - x0)) * 4;
      return [rgba[o], rgba[o + 1], rgba[o + 2]];
    };
    const id = BUILDING_BASE + b.index;
    let inside = 0;
    let green = 0;
    let edge = 0;
    let outlined = 0;
    eachInside(b, (x, y) => {
      if (mat[y * W + x] !== id) return;
      inside += 1;
      const c = color(x, y);
      if (GREENS.some((g) => sameColor(g, c))) green += 1; // 가로수 잎이 건물 위에 조금 걸치는 것만 허용
      const isEdge = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => mat[(y + dy) * W + x + dx] !== id);
      if (isEdge) {
        edge += 1;
        if (sameColor(c, OUTLINE)) outlined += 1;
      }
    });
    // 지하 건물(Minerva Complex)은 위가 공원이라 가로수가 덮여 있어 제외
    if (b.underground) continue;
    assert.ok(green / inside < 0.05, `${b.name}: 잔디 · 숲 색 픽셀 ${green}/${inside}`);
    assert.ok(outlined / edge >= 0.9, `${b.name}: 윤곽선 ${outlined}/${edge}`);
  }
});

test("모든 건물: 미니맵 · 전체 지도 그림(1m = 1px)에 칸이 있고, 지상 건물은 둘레 칸이 윤곽선", () => {
  const rgba = paintOverview();
  const cell = (i, j) => mat[(j * 4 + 2) * WORLD_W + i * 4 + 2];
  for (const b of BUILDINGS) {
    const id = BUILDING_BASE + b.index;
    let cells = 0;
    let edge = 0;
    let outlined = 0;
    for (let j = 0; j < GRID_H; j++) {
      for (let i = 0; i < GRID_W; i++) {
        if (cell(i, j) !== id) continue;
        cells += 1;
        if ([[-1, 0], [1, 0], [0, -1], [0, 1]].some(([di, dj]) => cell(i + di, j + dj) !== id)) {
          edge += 1;
          const o = (j * GRID_W + i) * 4;
          if (sameColor([rgba[o], rgba[o + 1], rgba[o + 2]], OUTLINE)) outlined += 1;
        }
      }
    }
    assert.ok(cells > 0, `${b.name}: 축소 지도에 칸 없음`);
    if (!b.underground) assert.equal(outlined, edge, `${b.name}: 축소 지도 윤곽선 ${outlined}/${edge}`);
  }
});

test("건물 이름: 두 줄 이름(mapName)은 줄바꿈만 다르고 띄어쓰기를 넣지 않음(예: 인문과학관)", () => {
  for (const [id, info] of Object.entries(BUILDING_INFO)) {
    if (!info.mapName) continue;
    assert.equal(info.mapName.replace(/\n/g, ""), info.name, `${id}: mapName "${info.mapName}"`);
  }
  assert.equal(BUILDING_INFO.humanities.name, "인문과학관");
});
