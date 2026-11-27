import { AREAS, BUILDINGS_M, DOOR_OVERRIDES, GATE_PILLARS_M, OPEN_SPACES_M, PASSAGES_M, ROTATION_DEG, SPAWN_M, TREES } from "./campusV2Data.js";
import { buildingInfo } from "./buildingInfo.js";

/*
 * 캠퍼스 맵 v2(기본). 미터 좌표 다각형(campusV2Data.js)을 ROTATION_DEG만큼 돌려
 * 1m = 4px 픽셀 격자에 직접 채웁니다(안티앨리어싱 없음 → 곧은 픽셀 선).
 * - 그림: 재질 격자(mat)를 src/gfx/campusV2Texture.js가 색으로 칠해 2×2 조각 텍스처로 만듭니다.
 * - 걷기: 같은 재질 격자에서 1m 칸마다 가운데 점을 읽어 판정 격자(walk)를 만듭니다.
 * - 이동: 캐릭터 발 상자(10×7px)가 막힌 칸에 닿지 않게 moveFeet로 움직입니다(벽을 따라 미끄러짐).
 * 브라우저 API를 쓰지 않아 테스트(node)에서도 그대로 돌립니다.
 */
export { ROTATION_DEG };
export const PX_PER_M = 4;
export const CELL_PX = 4; // 판정 격자 한 칸(1m)

const ANGLE = ((90 - ROTATION_DEG) * Math.PI) / 180;
const SIN = Math.sin(ANGLE);
const COS = Math.cos(ANGLE);
// 미터(E, N) → 화면 미터(오른쪽 +, 아래 +)
export const toScreenM = ([E, N]) => [E * SIN + N * COS, E * COS - N * SIN];

// 그릴 범위: 모든 다각형을 감싸는 사각형 + 여유 4m
const allPts = [...AREAS.flatMap(([, p]) => p), ...BUILDINGS_M.flatMap((b) => b.polys.flat()), ...TREES.map(([E, N]) => [E, N])].map(toScreenM);
const PAD = 4;
const MIN_X = Math.min(...allPts.map((p) => p[0])) - PAD;
const MIN_Y = Math.min(...allPts.map((p) => p[1])) - PAD;
export const WORLD_W = Math.ceil((Math.max(...allPts.map((p) => p[0])) + PAD - MIN_X) * PX_PER_M / CELL_PX) * CELL_PX;
export const WORLD_H = Math.ceil((Math.max(...allPts.map((p) => p[1])) + PAD - MIN_Y) * PX_PER_M / CELL_PX) * CELL_PX;
export const GRID_W = WORLD_W / CELL_PX;
export const GRID_H = WORLD_H / CELL_PX;

// 미터(E, N) → 월드 픽셀(텍스처 좌표)
export function toWorld(p) {
  const [sx, sy] = toScreenM(p);
  return [(sx - MIN_X) * PX_PER_M, (sy - MIN_Y) * PX_PER_M];
}

export const MAT = {
  outside: 0, outerRoad: 1, road: 2, pave: 3, dirt: 4, lawn: 5, grove: 6, forest: 7, parking: 8,
  field: 9, track: 10, line: 11, court: 12, water: 13, skylight: 14, steps: 15, crosswalk: 16,
};
export const BUILDING_BASE = 32;
// 기본은 걸을 수 있음. 캠퍼스 밖 · 바깥 도로 · 빽빽한 숲 · 물 · 건물만 막습니다.
const BLOCKED = new Set([MAT.outside, MAT.outerRoad, MAT.forest, MAT.water, MAT.skylight]);
export const isBlockedMat = (m) => m >= BUILDING_BASE || BLOCKED.has(m);

// 다각형 채우기(픽셀 가운데가 안에 있으면 칠함). pts는 월드 픽셀.
export function fillPolygon(buf, W, H, pts, value) {
  const ys = pts.map((p) => p[1]);
  const j0 = Math.max(0, Math.ceil(Math.min(...ys) - 0.5));
  const j1 = Math.min(H - 1, Math.floor(Math.max(...ys) - 0.5));
  const xs = [];
  for (let j = j0; j <= j1; j++) {
    const yc = j + 0.5;
    xs.length = 0;
    for (let k = 0; k < pts.length; k++) {
      const [x0, y0] = pts[k];
      const [x1, y1] = pts[(k + 1) % pts.length];
      if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil(xs[k] - 0.5));
      const i1 = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
      buf.fill(value, j * W + i0, j * W + i1 + 1);
    }
  }
}

export function pointInPolygon([x, y], pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToPolygon(p, pts) {
  if (pointInPolygon(p, pts)) return 0;
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * (bx - ax) + (p[1] - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1)));
    best = Math.min(best, Math.hypot(p[0] - (ax + t * (bx - ax)), p[1] - (ay + t * (by - ay))));
  }
  return best;
}

const bboxOf = (polys) => {
  const pts = polys.flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};
const polyArea = (pts) => Math.abs(pts.reduce((s, [x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return s + x * y2 - x2 * y; }, 0)) / 2;
const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

// 전체 지도 이름표가 이웃과 겹치는 곳만 mapLabelOffset(월드 px)으로 옮깁니다.
const offset = ([x, y], o) => (o ? [x + o[0], y + o[1]] : [x, y]);
const named = (id) => {
  const { name, mapName, nameEn } = buildingInfo(id);
  return { name, mapName, nameEn };
};

export const BUILDINGS = BUILDINGS_M.map((b, index) => {
  const polysPx = b.polys.map((p) => p.map(toWorld));
  const areaPolys = (b.footprint ? [b.footprint] : b.polys).map((p) => p.map(toWorld));
  const box = bboxOf(polysPx);
  const largest = areaPolys.reduce((p, q) => (polyArea(q) > polyArea(p) ? q : p));
  return {
    ...b, ...named(b.id), index, kind: "building", polysPx, areaPolys, box,
    tag: { x: (box.x0 + box.x1) / 2, y: box.y0 + 10 },
    mapLabel: offset(centroid(largest), b.mapLabelOffset),
  };
});
export const OPEN_SPACES = OPEN_SPACES_M.map((s) => {
  const poly = s.poly.map(toWorld);
  const c = centroid(poly);
  // tagM(미터)이 있으면 맵 위 이름표를 그 자리에, 없으면 공간 가운데(정문 광장: 현수막 · 시작 캐릭터 · 정문안내실 간판을 피한 자리)
  const tag = s.tagM ? toWorld(s.tagM) : c;
  return { ...s, ...named(s.id), kind: "open", areaPolys: [poly], tag: { x: tag[0], y: tag[1] }, mapLabel: offset(c, s.mapLabelOffset) };
});

// ── 재질 격자(텍스처 해상도) ──────────────────────────────
let raster = null;
export function rasterize() {
  if (raster) return raster;
  const mat = new Uint8Array(WORLD_W * WORLD_H); // 0 = 캠퍼스 밖
  for (const [kind, poly] of AREAS) fillPolygon(mat, WORLD_W, WORLD_H, poly.map(toWorld), MAT[kind]);
  BUILDINGS.forEach((b) => b.polysPx.forEach((p) => fillPolygon(mat, WORLD_W, WORLD_H, p, BUILDING_BASE + b.index)));
  raster = { W: WORLD_W, H: WORLD_H, mat };
  return raster;
}
export const matAt = (x, y) => {
  const { mat } = rasterize();
  const i = Math.floor(x);
  const j = Math.floor(y);
  return i < 0 || j < 0 || i >= WORLD_W || j >= WORLD_H ? MAT.outside : mat[j * WORLD_W + i];
};

// ── 1m 판정 격자 ─────────────────────────────────────
let grid = null;
export function walkGrid() {
  if (grid) return grid;
  const { mat } = rasterize();
  const walk = new Uint8Array(GRID_W * GRID_H);
  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      const m = mat[(j * CELL_PX + 2) * WORLD_W + i * CELL_PX + 2];
      walk[j * GRID_W + i] = isBlockedMat(m) ? 0 : 1;
    }
  }
  // 정문 기둥 받침(그림은 텍스처 밖에 따로 세우므로 재질 격자는 그대로, 판정 격자에서만 막음)
  for (const p of GATE.pillars) for (const [i, j] of p.cells) walk[j * GRID_W + i] = 0;
  grid = walk;
  return grid;
}
export const cellWalkable = (i, j) => i >= 0 && j >= 0 && i < GRID_W && j < GRID_H && walkGrid()[j * GRID_W + i] === 1;

// 캐릭터 발 상자(스프라이트 가운데 기준 px). CampusScene의 물리 몸통(10×7, 아래쪽)과 같은 크기입니다.
export const FEET = { left: -5, right: 5, top: 1, bottom: 8 };
export function fits(x, y) {
  const i0 = Math.floor((x + FEET.left) / CELL_PX);
  const i1 = Math.floor((x + FEET.right - 0.001) / CELL_PX);
  const j0 = Math.floor((y + FEET.top) / CELL_PX);
  const j1 = Math.floor((y + FEET.bottom - 0.001) / CELL_PX);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!cellWalkable(i, j)) return false;
  return true;
}

// 한 번 이동. 막히면 x · y 따로, 그래도 막히면 비스듬한 벽을 따라 미끄러지게 방향을 ±35° · ±65° 틀어 봅니다.
// blocked(x, y): 판정 격자 밖의 장애물(예: 건물 소개 안내원). 이미 겹쳐 있으면(순간 이동 직후 등) 빠져나갈 수 있게 무시합니다.
const SLIDE = [35, -35, 65, -65].map((d) => (d * Math.PI) / 180);
export function moveFeet(x, y, dx, dy, blocked = null) {
  if (!dx && !dy) return { x, y };
  const free = blocked && !blocked(x, y) ? blocked : null;
  const ok = (px, py) => fits(px, py) && !(free && free(px, py));
  if (ok(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  const axis = Math.abs(dx) >= Math.abs(dy) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
  for (const [ax, ay] of axis) if ((ax || ay) && ok(x + ax, y + ay)) return { x: x + ax, y: y + ay };
  for (const t of SLIDE) {
    const c = Math.cos(t);
    const s = Math.sin(t);
    const nx = (dx * c - dy * s) * c;
    const ny = (dx * s + dy * c) * c;
    if (ok(x + nx, y + ny)) return { x: x + nx, y: y + ny };
  }
  return { x, y };
}

// 서 있는 캐릭터(안내원)와 발 상자가 겹치는지. 두 발 상자(FEET)가 같은 크기라 가운데 거리로 봅니다.
export const feetOverlap = (x, y, ox, oy) => Math.abs(x - ox) < FEET.right - FEET.left && Math.abs(y - oy) < FEET.bottom - FEET.top;

// ── 정문 기둥 · 현수막(그림은 src/gfx/campusGate.js) ─────────────
// 받침: 판정 칸(1m) 가운데 점이 받침 다각형 안이면 막습니다(4×2칸). 그림 사각형은 그 칸들의 바깥 테두리에 맞춥니다.
// 크기(11/27 승인 · 같은 날 기둥 폭 16 → 24px): 기둥 24×54px(+바닥 그림자 2px), 현수막은 두 기둥 안쪽 면 사이(108×22px)
// — 받침 바닥에서 26~48px 위, 양 끝 2px는 기둥 안쪽(가장 높은 판) 면에 물림.
// 깊이: 캐릭터 · 안내원 · 퀴즈 상자는 깊이 = 스프라이트 가운데 y이고 발바닥은 가운데 + 8px(FEET.bottom)입니다.
//       같은 기준으로 비교하도록 정문 깊이 = 받침 바닥 y − 8. 받침 바로 아래(바깥)에 선 캐릭터는 앞에, 안쪽은 뒤에 그려집니다.
export const GATE_ART = { pillarW: 24, pillarH: 54, shadow: 2, bannerTop: 48, bannerH: 22, bannerOverlap: 2 };
export const GATE = (() => {
  const pillars = GATE_PILLARS_M.map((poly) => {
    const px = poly.map(toWorld);
    const box = bboxOf([px]);
    const cells = [];
    for (let j = Math.floor(box.y0 / CELL_PX); j <= Math.floor(box.y1 / CELL_PX); j++) {
      for (let i = Math.floor(box.x0 / CELL_PX); i <= Math.floor(box.x1 / CELL_PX); i++) {
        if (pointInPolygon([i * CELL_PX + CELL_PX / 2, j * CELL_PX + CELL_PX / 2], px)) cells.push([i, j]);
      }
    }
    const x0 = Math.min(...cells.map(([i]) => i)) * CELL_PX;
    const x1 = (Math.max(...cells.map(([i]) => i)) + 1) * CELL_PX;
    const y0 = Math.min(...cells.map(([, j]) => j)) * CELL_PX;
    const y1 = (Math.max(...cells.map(([, j]) => j)) + 1) * CELL_PX;
    return { cells, base: { x0, x1, y0, y1 } };
  }).sort((a, b) => a.base.x0 - b.base.x0);
  const baseY = Math.max(...pillars.map((p) => p.base.y1));
  const { pillarW, pillarH, shadow, bannerTop, bannerH, bannerOverlap } = GATE_ART;
  pillars.forEach((p) => {
    p.rect = { x: p.base.x0 + (p.base.x1 - p.base.x0 - pillarW) / 2, y: baseY - pillarH, w: pillarW, h: pillarH + shadow };
  });
  const [west, east] = pillars;
  const bx0 = west.rect.x + pillarW - bannerOverlap;
  const banner = { x: bx0, y: baseY - bannerTop, w: east.rect.x + bannerOverlap - bx0, h: bannerH };
  return { pillars, banner, baseY, depth: baseY - FEET.bottom };
})();
// 정문 그림(기둥 · 그림자 · 현수막)이 덮는 사각형들
export const gateRects = () => [...GATE.pillars.map((p) => p.rect), GATE.banner];
export const QUIZ_BOX_HALF = 8; // 퀴즈 상자 16×16px
export const QUIZ_BOX_BOB = 2; // 위로 2px 흔들림(src/quizBoxes.js 트윈)
export const QUIZ_LABEL_CLEAR = 4; // 이름표 · 안내원 글자 · 팻말 · 부스와 둘 여유(11/27)
// 퀴즈 상자(가운데 x, y)가 흔들리며 덮는 사각형, margin만큼 넓혀서(x0, y0, x1, y1)
export const quizBoxRect = (x, y, margin = 0) => ({
  x0: x - QUIZ_BOX_HALF - margin,
  x1: x + QUIZ_BOX_HALF + margin,
  y0: y - QUIZ_BOX_HALF - QUIZ_BOX_BOB - margin,
  y1: y + QUIZ_BOX_HALF + margin,
});
const overlapsGate = (x, y) => {
  const q = quizBoxRect(x, y);
  return gateRects().some((r) => q.x0 < r.x + r.w && r.x < q.x1 && q.y0 < r.y + r.h && r.y < q.y1);
};

// ── 시작 위치 · 도달 가능 칸(4px 격자점 BFS) ─────────────────
const snap = (v) => Math.floor(v / CELL_PX) * CELL_PX + CELL_PX / 2;
const stateKey = (x, y) => ((y - 2) / CELL_PX) * GRID_W + (x - 2) / CELL_PX;
export const SPAWN = (() => {
  const [x, y] = toWorld(SPAWN_M);
  return { x: snap(x), y: snap(y) };
})();

let reach = null;
// SPAWN에서 발 상자를 4px씩 상하좌우로 옮겨 닿는 격자점. prev는 경로 되짚기용.
export function reachable() {
  if (reach) return reach;
  const prev = new Int32Array(GRID_W * GRID_H).fill(-2);
  const queue = [];
  if (fits(SPAWN.x, SPAWN.y)) {
    prev[stateKey(SPAWN.x, SPAWN.y)] = -1;
    queue.push(stateKey(SPAWN.x, SPAWN.y));
  }
  for (let q = 0; q < queue.length; q++) {
    const k = queue[q];
    const x = (k % GRID_W) * CELL_PX + 2;
    const y = Math.floor(k / GRID_W) * CELL_PX + 2;
    for (const [dx, dy] of [[CELL_PX, 0], [-CELL_PX, 0], [0, CELL_PX], [0, -CELL_PX]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WORLD_W || ny >= WORLD_H) continue;
      const nk = stateKey(nx, ny);
      if (prev[nk] !== -2 || !fits(nx, ny)) continue;
      prev[nk] = k;
      queue.push(nk);
    }
  }
  reach = { prev, list: queue.map((k) => ({ x: (k % GRID_W) * CELL_PX + 2, y: Math.floor(k / GRID_W) * CELL_PX + 2 })) };
  return reach;
}
export const isReachable = (x, y) => reachable().prev[stateKey(snap(x), snap(y))] !== -2;

// SPAWN → (x, y) 격자점 경로(없으면 null)
export function pathTo(x, y) {
  const { prev } = reachable();
  let k = stateKey(snap(x), snap(y));
  if (prev[k] === -2) return null;
  const path = [];
  while (k !== -1) {
    path.push({ x: (k % GRID_W) * CELL_PX + 2, y: Math.floor(k / GRID_W) * CELL_PX + 2 });
    k = prev[k];
  }
  return path.reverse();
}

// ── 입구 · 안내원 자리 ─────────────────────────────────
// 입구는 건물 아래쪽 벽(화면 기준, 벽 · 문이 보이는 면) 가운데에서 가장 가까운, 걸어서 닿는 칸에 둡니다.
// 아래쪽 벽에 닿는 칸이 없으면(예: 교수연구동은 건널목이 화면 위쪽) 옆면 · 위쪽 면 순서로 찾습니다.
// 단 campusV2Data.js DOOR_OVERRIDES에 있는 건물(11곳)은 정해 둔 문 앞 자리(front)와 외벽 면(face)을 씁니다.
const SIDES = [
  { face: "down", probe: (x, y) => [0, 1, 2, 3, 4].map((k) => [x, y - k]) },
  { face: "left", probe: (x, y) => [6, 7, 8, 9, 10].map((k) => [x + k, y + 4]) },
  { face: "right", probe: (x, y) => [6, 7, 8, 9, 10].map((k) => [x - k, y + 4]) },
  { face: "up", probe: (x, y) => [9, 10, 11, 12, 13].map((k) => [x, y + k]) },
];
let doors = null;
function computeDoors() {
  if (doors) return doors;
  doors = new Map();
  const { list } = reachable();
  for (const b of BUILDINGS) {
    const target = [(b.box.x0 + b.box.x1) / 2, b.box.y1];
    for (const side of SIDES) {
      let best = null;
      for (const s of list) {
        const hit = side.probe(s.x, s.y).find(([px, py]) => matAt(px, py) === BUILDING_BASE + b.index);
        if (!hit) continue;
        const d = Math.hypot(s.x - target[0], s.y - target[1]);
        if (!best || d < best.d) best = { d, door: { x: hit[0], y: hit[1], face: side.face }, front: { x: s.x, y: s.y } };
      }
      if (best) {
        doors.set(b.id, best);
        break;
      }
    }
  }
  for (const b of BUILDINGS) {
    const fixed = fixedDoor(b);
    if (fixed) doors.set(b.id, fixed);
  }
  return doors;
}

// 고정 입구: 문 앞 자리(미터)를 4px 격자점에 맞추고, 발 가운데에서 face 쪽 외벽으로 곧게 가다 처음 만나는 건물 픽셀을 문 자리로 씁니다.
const TOWARD_WALL = { down: [0, -1], up: [0, 1], right: [-1, 0], left: [1, 0] };
export const FIXED_DOOR_IDS = Object.keys(DOOR_OVERRIDES);
function fixedDoor(b) {
  const o = DOOR_OVERRIDES[b.id];
  if (!o) return null;
  const [wx, wy] = toWorld(o.front);
  const front = { x: snap(wx), y: snap(wy) };
  const [dx, dy] = TOWARD_WALL[o.face];
  for (let t = 0; t <= 40; t++) {
    const x = front.x + dx * t;
    const y = front.y + 4 + dy * t;
    if (matAt(x, y) === BUILDING_BASE + b.index) return { d: 0, door: { x: Math.floor(x), y: Math.floor(y), face: o.face, fixed: true }, front };
  }
  return null;
}
export const doorOf = (building) => computeDoors().get(building.id)?.door ?? null;

// ── 문 그림 칸(그리기는 src/gfx/campusV2Paint.js) ─────────────────
// 문 자리(doorOf) 기준 px. 아래쪽 면은 7×8, 위쪽 면은 아래로, 옆면은 건물 안쪽으로 6×8. 자동 계산 입구는 아래쪽 면 모양.
// DOOR_ART_SCALE: 그림만 키우는 배율(문 앞 칸 · 충돌 · 맵 다각형은 그대로). 문 자리에서 바깥쪽으로 같은 비율로 늘립니다.
export const DOOR_ART_BASE = {
  down: { x0: -3, x1: 3, y0: -7, y1: 0 },
  up: { x0: -3, x1: 3, y0: 0, y1: 7 },
  right: { x0: -5, x1: 0, y0: -5, y1: 2 },
  left: { x0: 0, x1: 5, y0: -5, y1: 2 },
};
export const DOOR_ART_SCALE = 1.5; // 11/27 오후: 출입문 그림을 1.5배로(7×8 → 11×12, 옆면 6×8 → 9×12)
const scaleOut = (v) => Math.sign(v) * Math.round(Math.abs(v) * DOOR_ART_SCALE);
// 문 그림 범위(문 자리 기준, 양 끝 포함)
export const doorArtOffsets = (face, fixed = true) => {
  const base = DOOR_ART_BASE[fixed ? face : "down"];
  return { x0: scaleOut(base.x0), x1: scaleOut(base.x1), y0: scaleOut(base.y0), y1: scaleOut(base.y1) };
};
// 문 그림이 덮는 월드 사각형(x0 · y0 · x1 · y1, 끝 픽셀 다음까지). 팻말 · 부스 자리가 피합니다.
export function doorArtRect(building) {
  const d = doorOf(building);
  if (!d) return null;
  const o = doorArtOffsets(d.face, Boolean(d.fixed));
  return { x0: d.x + o.x0, x1: d.x + o.x1 + 1, y0: d.y + o.y0, y1: d.y + o.y1 + 1 };
}
export const doorFrontOf = (building) => computeDoors().get(building.id)?.front ?? null;

// 안내원 자리: 문 앞 칸의 옆(문을 바라보고 섰을 때 옆쪽). 아래 · 위쪽 면의 문은 좌우로, 왼쪽 · 오른쪽 면의 문은 위아래로 비켜 섭니다.
// 걸어서 닿는 칸이고 어느 건물의 문 앞 칸과도 12px 넘게 떨어진 곳 가운데 가까운 쪽부터 고릅니다.
export function npcSpotOf(building) {
  const front = doorFrontOf(building);
  if (!front) return null;
  const face = doorOf(building)?.face;
  const along = face === "left" || face === "right" ? [0, 1] : [1, 0];
  const fronts = BUILDINGS.map(doorFrontOf).filter(Boolean);
  for (const off of [-16, 16, -24, 24]) {
    const x = front.x + along[0] * off;
    const y = front.y + along[1] * off;
    if (isReachable(x, y) && fronts.every((f) => Math.hypot(f.x - x, f.y - y) >= 12)) return { x, y };
  }
  return { ...front };
}

// ── 퀴즈 상자 자리 ────────────────────────────────────
const QUIZ_MATS = new Set([MAT.pave, MAT.lawn, MAT.dirt, MAT.steps, MAT.grove]);
// skipGate: 정문 그림과 겹치는 후보를 빼지 않은 목록(빠진 개수 확인용, 테스트)
export function quizSpots({ skipGate = true } = {}) {
  const keep = [SPAWN, ...BUILDINGS.map(doorFrontOf), ...BUILDINGS.map(npcSpotOf)].filter(Boolean);
  return reachable().list.filter(
    ({ x, y }) =>
      (x - 2) % 16 === 0 &&
      (y - 2) % 16 === 0 &&
      QUIZ_MATS.has(matAt(x, y + 4)) &&
      keep.every((k) => Math.hypot(k.x - x, k.y - y) >= 20) &&
      !(skipGate && overlapsGate(x, y)),
  );
}

// ── 장소 찾기 ───────────────────────────────────────
export function nearestPlace(x, y) {
  let best = null;
  let bestD = Infinity;
  [...BUILDINGS, ...OPEN_SPACES].forEach((p) => {
    const d = Math.min(...p.areaPolys.map((poly) => distToPolygon([x, y], poly)));
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  });
  return best;
}

export const PASSAGES = PASSAGES_M.map(([name, seg]) => ({ name, seg, segPx: seg.map(toWorld) }));
// ── 가로수 정리(그림만, 걷기 · 충돌과 무관) ─────────────────
// 11/27 오후(PM 결정: 이종헌): campusV2Data.js TREES(원본, 맵 범위 계산에도 쓰임)는 그대로 두고 그릴 나무만 고릅니다.
// - 길 위 나무 삭제: 밑동(줄기 가운데)이 차도 · 보도 · 건널목 · 주차장 · 계단 칸 위면 그리지 않습니다(보도 가장자리 가로수 줄은 예외, 아래 TREE_ROW).
//   잔디 · 수풀 · 흙에 서 있고 잎만 길로 튀어나온 나무는 그대로 둡니다.
// - 겹친 나무 합치기: 두 나무 가운데 거리가 나무 지름(둘 중 큰 쪽)의 TREE_MERGE_RATIO 미만이면 먼저 나온 하나만 남깁니다.
export const TREE_PATH_MATS = [MAT.road, MAT.pave, MAT.crosswalk, MAT.parking, MAT.steps, MAT.outerRoad];
export const TREE_MERGE_RATIO = 0.6;
/*
 * 가로수 줄 되살리기(11/27 저녁, PM 결정: 이종헌): 길 위 나무라도 "보도 가장자리를 따라 일정한 간격으로 줄지어 선 가로수"는 그립니다.
 * 줄 판정(TREE_ROW): 아래를 모두 만족하는 나무가 한 직선 위에 같은 간격으로 minCount그루 이상
 * - mats: 밑동이 보도 칸 위(차도 · 주차장 · 건널목 · 계단 위 나무는 줄이어도 지움)
 * - edgePx: 밑동에서 보도가 아닌 칸까지 이 거리 이하(= 보도 가장자리. 걷는 길 한가운데 나무는 지움)
 * - maxGapPx: 이웃 나무와의 간격이 이 값 이하, tolerancePx: 같은 간격 · 같은 직선에서 벗어나도 되는 정도
 */
export const TREE_ROW = { mats: [MAT.pave], edgePx: 12, minCount: 3, maxGapPx: 40, tolerancePx: 3 };
// 밑동에서 가장 가까운 "보도가 아닌 칸"까지의 거리(px). limit보다 멀면 Infinity
export function treeEdgeDistance(x, y, limit = TREE_ROW.edgePx) {
  const mats = new Set(TREE_ROW.mats);
  let best = Infinity;
  for (let dy = -limit; dy <= limit; dy++) {
    for (let dx = -limit; dx <= limit; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= limit && d < best && !mats.has(matAt(x + dx, y + dy))) best = d;
    }
  }
  return best;
}
// 길 위 나무 가운데 가로수 줄에 든 나무(Set)
export function treeRows(trees = TREES) {
  const { mats, minCount, maxGapPx, tolerancePx } = TREE_ROW;
  const rowMats = new Set(mats);
  const points = trees
    .map((tree) => ({ tree, p: toWorld([tree[0], tree[1]]) }))
    .filter(({ p }) => rowMats.has(matAt(p[0], p[1])) && treeEdgeDistance(p[0], p[1]) <= TREE_ROW.edgePx);
  const at = (x, y) => points.find((q) => Math.hypot(q.p[0] - x, q.p[1] - y) <= tolerancePx);
  const inRow = new Set();
  for (const a of points) {
    for (const b of points) {
      const dx = b.p[0] - a.p[0];
      const dy = b.p[1] - a.p[1];
      const gap = Math.hypot(dx, dy);
      if (a === b || gap > maxGapPx || gap <= tolerancePx) continue;
      // a에서 b 방향으로 같은 간격만큼씩 나아가며 이어지는 나무를 모읍니다(a가 줄의 시작일 때만 minCount를 채움).
      const run = [a, b];
      for (let next = at(b.p[0] + dx, b.p[1] + dy); next && !run.includes(next); next = at(next.p[0] + dx, next.p[1] + dy)) run.push(next);
      if (run.length >= minCount) run.forEach((q) => inRow.add(q.tree));
    }
  }
  return inRow;
}
let treeResult = null;
// { kept: [[E, N, r], …](그릴 나무), rows: 길 위지만 가로수 줄이라 되살린 나무(kept에 들어 있음), onPath: 길 위라 지운 나무, merged: 겹쳐서 합친(지운) 나무 }
export function cleanedTrees() {
  if (treeResult) return treeResult;
  const pathMats = new Set(TREE_PATH_MATS);
  const rowTrees = treeRows();
  const kept = [];
  const rows = [];
  const onPath = [];
  const merged = [];
  for (const tree of TREES) {
    const [x, y] = toWorld([tree[0], tree[1]]);
    if (pathMats.has(matAt(x, y))) {
      if (!rowTrees.has(tree)) {
        onPath.push(tree);
        continue;
      }
      rows.push(tree);
    }
    const tooClose = kept.some((k) => {
      const [kx, ky] = toWorld([k[0], k[1]]);
      return Math.hypot(kx - x, ky - y) < Math.max(k[2], tree[2]) * 2 * PX_PER_M * TREE_MERGE_RATIO;
    });
    if (tooClose) {
      merged.push(tree);
      if (rows.at(-1) === tree) rows.pop();
    } else kept.push(tree);
  }
  treeResult = { kept, rows, onPath, merged };
  return treeResult;
}
export { TREES };
