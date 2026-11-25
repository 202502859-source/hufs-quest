import { BUILDINGS, BUILDING_BASE, CELL_PX, FIXED_DOOR_IDS, doorFrontOf, doorOf, feetOverlap, fits, isReachable, matAt } from "./campusV2.js";

/*
 * 맵 v2에서 "건물 소개 안내원"(정문 옆 NPC)을 세울 자리를 정합니다(브라우저 API 없음 → 테스트 가능).
 * 대상: 정문을 지정한 11개 건물(campusV2Data.js DOOR_OVERRIDES). 사무실 안내가 있는지는 world.js가 봅니다.
 * - 문 앞 칸 옆(문을 바라보고 섰을 때 옆쪽): 아래 · 위쪽 면의 문은 좌우로, 왼쪽 · 오른쪽 면의 문은 위아래로 16 · 24 · 32px.
 *   벽에서 한 칸(8px) 물러선 자리도 후보로 봅니다(꺾인 외벽 · 글자가 지붕에 걸치는 자리).
 * - 걸어서 닿는 칸, 어느 문 앞 칸과도 겹치지 않음, 안내원 칸을 막아도 주변 길이 끊기지 않음.
 * - 그 가운데 안내원 아래 글자가 건물 지붕을 가장 적게 덮는 자리(글자는 되도록 땅 위). 같으면 벽에 붙은 자리 · 문에 가까운 자리.
 * - 건물 이름표는 이 글자 칸을 피해 자리를 잡습니다(buildingLabels.js placeBuildingLabel의 avoid).
 * 맵 다각형 · 충돌 판정은 바꾸지 않고 읽기만 합니다. 안내원 칸은 CampusScene이 이동할 때만 막습니다.
 */
export const GUIDE_TEXT_HALF = 40; // 안내원 아래 글자 칸 가로 반폭(px). "건물 소개 안내원" 8px 글씨 + 여백보다 조금 넓게
export const guideTextRect = (g) => ({ x0: g.x - GUIDE_TEXT_HALF, x1: g.x + GUIDE_TEXT_HALF, y0: g.y + 8, y1: g.y + 20 });
const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

// 안내원 칸을 막았을 때 그 둘레(24px 안)의 갈 수 있는 격자점이 서로 이어져 있는지(가로세로 64px 창 안에서 확인)
function keepsPathsOpen(spot) {
  const inWindow = (x, y) => Math.abs(x - spot.x) <= 64 && Math.abs(y - spot.y) <= 64;
  const open = (x, y) => inWindow(x, y) && fits(x, y) && isReachable(x, y) && !feetOverlap(x, y, spot.x, spot.y);
  const near = [];
  for (let y = spot.y - 24; y <= spot.y + 24; y += CELL_PX) for (let x = spot.x - 24; x <= spot.x + 24; x += CELL_PX) if (open(x, y)) near.push(`${x},${y}`);
  if (!near.length) return true;
  const seen = new Set([near[0]]);
  const queue = [near[0].split(",").map(Number)];
  for (let q = 0; q < queue.length; q++) {
    const [x, y] = queue[q];
    for (const [dx, dy] of [[CELL_PX, 0], [-CELL_PX, 0], [0, CELL_PX], [0, -CELL_PX]]) {
      const k = `${x + dx},${y + dy}`;
      if (seen.has(k) || !open(x + dx, y + dy)) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  return near.every((k) => seen.has(k));
}

// 글자 칸 안의 건물 픽셀 수(2px 간격으로 셈)
function roofUnder(rect) {
  let n = 0;
  for (let y = rect.y0; y < rect.y1; y += 2) for (let x = rect.x0; x < rect.x1; x += 2) if (matAt(x, y) >= BUILDING_BASE) n += 1;
  return n;
}

const spots = new Map();
export function guideSpotOf(building) {
  if (spots.has(building.id)) return spots.get(building.id);
  let best = null;
  const front = FIXED_DOOR_IDS.includes(building.id) ? doorFrontOf(building) : null;
  if (front) {
    const face = doorOf(building).face;
    const along = face === "left" || face === "right" ? [0, 1] : [1, 0];
    const outward = { down: [0, 1], up: [0, -1], right: [1, 0], left: [-1, 0] }[face];
    const fronts = BUILDINGS.map(doorFrontOf).filter(Boolean);
    const offsets = [0, 8].flatMap((out) => [-16, 16, -24, 24, -32, 32].map((off) => [off, out]));
    for (const [off, out] of offsets) {
      const spot = { x: front.x + along[0] * off + outward[0] * out, y: front.y + along[1] * off + outward[1] * out };
      if (!fits(spot.x, spot.y) || !isReachable(spot.x, spot.y)) continue;
      if (fronts.some((f) => feetOverlap(f.x, f.y, spot.x, spot.y) || Math.hypot(f.x - spot.x, f.y - spot.y) < 12)) continue;
      if (!keepsPathsOpen(spot)) continue;
      const roof = roofUnder(guideTextRect(spot));
      if (!best || roof < best.roof) best = { ...spot, roof, out };
    }
  }
  const found = best && { x: best.x, y: best.y };
  spots.set(building.id, found);
  return found;
}

// 모든 안내원 글자 칸(건물 이름표가 피할 자리)
export const guideTextRects = () => FIXED_DOOR_IDS.map((id) => guideSpotOf(BUILDINGS.find((b) => b.id === id))).filter(Boolean).map(guideTextRect);

// 퀴즈 상자(16×16, 가운데 기준) 자리가 안내원 · 안내원 글자와 떨어져 있는지
export const awayFromGuides = (box, guides) =>
  guides.every((g) => Math.hypot(g.x - box.x, g.y - box.y) >= 20 && !overlaps({ x0: box.x - 8, x1: box.x + 8, y0: box.y - 8, y1: box.y + 8 }, guideTextRect(g)));
