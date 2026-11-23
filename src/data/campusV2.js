import { AREAS, BUILDINGS_M, OPEN_SPACES_M, PASSAGES_M, ROTATION_DEG, SPAWN_M, TREES } from "./campusV2Data.js";
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
  // tagAt: "bottom"이면 맵 위 이름표를 공간 아래쪽에 둡니다(정문 광장: 시작 위치 캐릭터 · 정문안내실 간판을 가리지 않게)
  const tagY = s.tagAt === "bottom" ? Math.max(...poly.map((p) => p[1])) - 12 : c[1];
  return { ...s, ...named(s.id), kind: "open", areaPolys: [poly], tag: { x: c[0], y: tagY }, mapLabel: offset(c, s.mapLabelOffset) };
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
const SLIDE = [35, -35, 65, -65].map((d) => (d * Math.PI) / 180);
export function moveFeet(x, y, dx, dy) {
  if (!dx && !dy) return { x, y };
  if (fits(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  const axis = Math.abs(dx) >= Math.abs(dy) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
  for (const [ax, ay] of axis) if ((ax || ay) && fits(x + ax, y + ay)) return { x: x + ax, y: y + ay };
  for (const t of SLIDE) {
    const c = Math.cos(t);
    const s = Math.sin(t);
    const nx = (dx * c - dy * s) * c;
    const ny = (dx * s + dy * c) * c;
    if (fits(x + nx, y + ny)) return { x: x + nx, y: y + ny };
  }
  return { x, y };
}

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
  return doors;
}
export const doorOf = (building) => computeDoors().get(building.id)?.door ?? null;
export const doorFrontOf = (building) => computeDoors().get(building.id)?.front ?? null;

export function npcSpotOf(building) {
  const front = doorFrontOf(building);
  if (!front) return null;
  const fronts = BUILDINGS.map(doorFrontOf).filter(Boolean);
  for (const off of [-16, 16, -24, 24]) {
    const x = front.x + off;
    if (isReachable(x, front.y) && fronts.every((f) => Math.hypot(f.x - x, f.y - front.y) >= 12)) return { x, y: front.y };
  }
  return { ...front };
}

// ── 퀴즈 상자 자리 ────────────────────────────────────
const QUIZ_MATS = new Set([MAT.pave, MAT.lawn, MAT.dirt, MAT.steps, MAT.grove]);
export function quizSpots() {
  const keep = [SPAWN, ...BUILDINGS.map(doorFrontOf), ...BUILDINGS.map(npcSpotOf)].filter(Boolean);
  return reachable().list.filter(
    ({ x, y }) => (x - 2) % 16 === 0 && (y - 2) % 16 === 0 && QUIZ_MATS.has(matAt(x, y + 4)) && keep.every((k) => Math.hypot(k.x - x, k.y - y) >= 20),
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
export { TREES };
