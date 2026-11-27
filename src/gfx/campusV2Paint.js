import { BUILDINGS, BUILDING_BASE, GRID_H, GRID_W, MAT, PX_PER_M, WORLD_W, cleanedTrees, doorArtOffsets, doorOf, pointInPolygon, rasterize, toWorld } from "../data/campusV2.js";

/*
 * 캠퍼스 맵 v2의 색칠. 재질 격자(campusV2.js)를 RGBA 픽셀로 바꿉니다. 브라우저 API를 쓰지 않습니다.
 * 색은 docs/GRAPHICS.md 3장 팔레트(2026-11 v2: 차도 · 보행로는 베이지 계열)를 따릅니다.
 */
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const PALETTE = {
  outside: "#4f5451", outsideHatch: "#464b48",
  outerRoad: "#b8ab93", outerDash: "#d9cfba",
  road: "#d4c4a1", roadDark: "#cbb995", roadLight: "#dacbaa",
  pave: "#e4d8bc", paveJoint: "#d4c7a8",
  parkingLine: "#eee6d3",
  dirt: "#c7a46f", dirtDark: "#b8925c", dirtLight: "#d1b17f",
  lawn: "#80b35c", lawnDark: "#76a853", lawnLight: "#8bbd66",
  grove: "#73a855", canopy: "#3f7d45", canopyLight: "#4f9150",
  forest: "#2f5f37", forestLight: "#3a7040",
  field: "#3e8b4f", fieldDark: "#378048", track: "#b5573f", trackDark: "#a94f39", line: "#f2f0e6",
  court: "#dcc79c", water: "#6fb3d6", waterLight: "#8fc6e2",
  steps: "#d9cbab", stepsLine: "#c2b391",
  wall: "#e7e0cf", wallLine: "#d8cdb6", window: "#4b6878", windowLight: "#9fbccb", eave: "#6f7b79", door: "#5b3a26", doorFrame: "#8a5c3c",
  outline: "#2b3135", // 건물 윤곽 1px: 녹색 옥상(교수회관 · 외국어연수평가원)이 잔디 · 숲에 묻히지 않게
  // 정문 현수막(src/gfx/campusGate.js, 11/27). 기둥 석재는 위 옥상 회색 · 흰색 · 처마 · 윤곽 색을 그대로 씁니다.
  bannerBlue: "#2e5f9e", bannerEdge: "#1d3d6b", bannerYellow: "#f2c94c", bannerYellowEdge: "#b8862b",

  roof: { gray: "#9ba7a4", white: "#dde3df", green: "#5d9676", greenDark: "#3f7058", teal: "#5f8f9a", solar: "#4b6878", glass: "#4b6878", stairs: "#9ba7a4" },
  roofRim: { gray: "#7f8b88", white: "#b9c2bf", green: "#467a5d", greenDark: "#2f5643", teal: "#4a737c", solar: "#3a5361", glass: "#3a5361", stairs: "#6f7b79" },
};
const C = Object.fromEntries(Object.entries(PALETTE).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, hex(v)]));
const ROOF = Object.fromEntries(Object.entries(PALETTE.roof).map(([k, v]) => [k, hex(v)]));
const RIM = Object.fromEntries(Object.entries(PALETTE.roofRim).map(([k, v]) => [k, hex(v)]));
const WALL_PX = { none: 0, low: 6, mid: 10, high: 14 };

// 고정 시드 해시(0~1). 같은 자리는 늘 같은 무늬가 나옵니다.
const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
// 8px 칸 값 노이즈(나무 덩어리 무늬)
const blob = (x, y) => {
  const gx = Math.floor(x / 8), gy = Math.floor(y / 8), fx = (x % 8) / 8, fy = (y % 8) / 8;
  const a = hash(gx, gy), b = hash(gx + 1, gy), c = hash(gx, gy + 1), d = hash(gx + 1, gy + 1);
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
};

function groundColor(m, x, y) {
  const r = hash(x, y);
  switch (m) {
    case MAT.outside: return (x + y) % 6 === 0 ? C.outsideHatch : C.outside;
    case MAT.outerRoad: return x % 12 < 5 && y % 12 === 6 ? C.outerDash : C.outerRoad;
    case MAT.road: return r < 0.06 ? C.roadDark : r > 0.95 ? C.roadLight : C.road;
    case MAT.pave: return x % 8 === 0 || y % 8 === 0 ? C.paveJoint : C.pave;
    case MAT.parking: return x % 12 === 0 && y % 24 > 3 ? C.parkingLine : r < 0.05 ? C.roadDark : C.road;
    case MAT.dirt: return r < 0.1 ? C.dirtDark : r > 0.92 ? C.dirtLight : C.dirt;
    case MAT.lawn: return r < 0.1 ? C.lawnDark : r > 0.93 ? C.lawnLight : C.lawn;
    case MAT.grove: { const v = blob(x, y); return v > 0.62 ? (r < 0.3 ? C.canopyLight : C.canopy) : r < 0.1 ? C.lawnDark : C.grove; }
    case MAT.forest: return blob(x, y) > 0.45 ? C.forestLight : C.forest;
    case MAT.field: return Math.floor(y / 16) % 2 ? C.fieldDark : C.field;
    case MAT.track: return r < 0.08 ? C.trackDark : C.track;
    case MAT.line: return C.line;
    case MAT.court: return C.court;
    case MAT.water: return r < 0.1 ? C.waterLight : C.water;
    case MAT.steps: return y % 3 === 0 ? C.stepsLine : C.steps;
    case MAT.crosswalk: return x % 6 < 3 ? C.line : C.outerRoad;
    default: return C.lawn;
  }
}

// 건물 한 픽셀: 옥상 · 테두리 · 처마 · 남쪽(화면 아래쪽) 벽 · 창문
function buildingColor(b, x, y, mat, W, H) {
  const id = BUILDING_BASE + b.index;
  const same = (i, j) => i >= 0 && j >= 0 && i < W && j < H && mat[j * W + i] === id;
  const roofKey = b.partRoofs ? b.partRoofs[b.polysPx.findIndex((p) => pointInPolygon([x + 0.5, y + 0.5], p))] ?? b.roof : b.roof;
  if (b.underground) {
    if (roofKey === "stairs") return y % 3 === 0 ? RIM.stairs : ROOF.stairs;
    return x % 3 === 0 ? C.windowLight : C.window;
  }
  // 바깥 둘레 1px는 어두운 윤곽선(옥상 · 벽 모두). 지붕색이 주변 바닥과 비슷해도 건물 경계가 보입니다.
  if (!same(x - 1, y) || !same(x + 1, y) || !same(x, y - 1) || !same(x, y + 1)) return C.outline;
  const wallPx = WALL_PX[b.height] ?? 10;
  let run = 0; // 아래로 같은 건물이 이어지는 픽셀 수
  while (run <= wallPx + 1 && same(x, y + run + 1)) run++;
  if (run < wallPx) {
    const floor = run % 5;
    if (floor === 0) return C.wallLine;
    return (x + b.index) % 6 >= 2 && (x + b.index) % 6 <= 4 && floor >= 2 ? (floor === 4 ? C.windowLight : C.window) : C.wall;
  }
  if (run <= wallPx + 1) return C.eave;
  // 윤곽선 바로 안쪽 1px는 옥상 테두리(같은 계열 어두운 색)
  if (!same(x - 2, y) || !same(x + 2, y) || !same(x, y - 2)) return RIM[roofKey];
  if (roofKey === "solar") return x % 6 === 0 || y % 5 === 0 ? C.windowLight : ROOF.solar;
  return ROOF[roofKey];
}

// 월드 픽셀 사각형(x0, y0, w, h)을 RGBA로 칠합니다.
export function paintRegion(x0, y0, w, h) {
  const { mat, W, H } = rasterize();
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const wx = x0 + x, wy = y0 + y;
      const m = wx < W && wy < H ? mat[wy * W + wx] : MAT.outside;
      const c = m >= BUILDING_BASE ? buildingColor(BUILDINGS[m - BUILDING_BASE], wx, wy, mat, W, H) : groundColor(m, wx, wy);
      const o = (y * w + x) * 4;
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
    }
  }
  const put = (wx, wy, c) => {
    const x = wx - x0, y = wy - y0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const o = (y * w + x) * 4;
    out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2];
  };
  // 가로수(그림만): 그림자 → 잎 → 밝은 면. 길 위 나무(보도 가장자리 가로수 줄은 남김) · 크게 겹친 나무는 뺀 목록(campusV2.js cleanedTrees)
  for (const [E, N, r] of cleanedTrees().kept) {
    const [cx, cy] = toWorld([E, N]);
    const R = r * PX_PER_M;
    if (cx + R + 3 < x0 || cy + R + 3 < y0 || cx - R > x0 + w || cy - R > y0 + h) continue;
    for (let dy = -R; dy <= R + 2; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const px = Math.round(cx + dx), py = Math.round(cy + dy);
        const inShadow = dx * dx + (dy - 2) * (dy - 2) <= R * R;
        const inLeaf = dx * dx + dy * dy <= R * R;
        if (inLeaf) put(px, py, dx + dy < -R * 0.4 ? C.canopyLight : C.canopy);
        else if (inShadow && matAt(px, py) < BUILDING_BASE) put(px, py, C.forest);
      }
    }
  }
  // 입구(벽에 문, 지하 건물은 계단 입구)
  for (const b of BUILDINGS) {
    const d = doorOf(b);
    if (!d) continue;
    // 문 그림 칸은 src/data/campusV2.js doorArtOffsets(DOOR_ART_SCALE 배율 포함). 문을 붙일 면에서 건물 안쪽으로 그리고,
    // 건물 밖으로 삐져나온 픽셀은 버립니다(비스듬한 벽). 자동 계산 입구는 아래쪽 면 모양입니다.
    const own = BUILDING_BASE + b.index;
    const face = d.fixed ? d.face : "down";
    const rect = doorArtOffsets(d.face, Boolean(d.fixed));
    for (let dy = rect.y0; dy <= rect.y1; dy++) {
      for (let dx = rect.x0; dx <= rect.x1; dx++) {
        if (matAt(d.x + dx, d.y + dy) !== own) continue;
        const frame = dx === rect.x0 || dx === rect.x1 || dy === rect.y0 || dy === rect.y1;
        // 바깥쪽(캐릭터 쪽) 가장자리는 열린 문이라 틀을 두지 않습니다.
        const open = (face === "down" && dy === rect.y1) || (face === "up" && dy === rect.y0) || (face === "right" && dx === rect.x1) || (face === "left" && dx === rect.x0);
        put(d.x + dx, d.y + dy, frame && !open ? C.doorFrame : C.door);
      }
    }
  }
  return out;
}
const matAt = (x, y) => {
  const { mat, W, H } = rasterize();
  return x < 0 || y < 0 || x >= W || y >= H ? MAT.outside : mat[y * W + x];
};

// 전체 지도 · 미니맵용: 1m = 1px, 장식 없이 재질 대표색
export function paintOverview() {
  const { mat } = rasterize();
  const out = new Uint8ClampedArray(GRID_W * GRID_H * 4);
  const cellMat = (i, j) => (i < 0 || j < 0 || i >= GRID_W || j >= GRID_H ? MAT.outside : mat[(j * 4 + 2) * WORLD_W + i * 4 + 2]);
  const flat = {
    [MAT.outside]: C.outside, [MAT.outerRoad]: C.outerRoad, [MAT.road]: C.road, [MAT.pave]: C.pave, [MAT.parking]: C.road,
    [MAT.dirt]: C.dirt, [MAT.lawn]: C.lawn, [MAT.grove]: C.canopyLight, [MAT.forest]: C.forest, [MAT.field]: C.field,
    [MAT.track]: C.track, [MAT.line]: C.line, [MAT.court]: C.court, [MAT.water]: C.water, [MAT.steps]: C.steps, [MAT.crosswalk]: C.line,
  };
  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      const m = mat[(j * 4 + 2) * WORLD_W + i * 4 + 2];
      const b = m >= BUILDING_BASE ? BUILDINGS[m - BUILDING_BASE] : null;
      // 지상 건물은 둘레 칸을 윤곽선 색으로(1m = 1px라 벽 · 테두리가 없어 녹색 옥상이 잔디에 묻힘)
      const edge = b && !b.underground && [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([di, dj]) => cellMat(i + di, j + dj) !== m);
      const c = edge ? C.outline : b ? (b.underground ? C.window : ROOF[b.roof]) : flat[m] ?? C.lawn;
      const o = (j * GRID_W + i) * 4;
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
    }
  }
  return out;
}
