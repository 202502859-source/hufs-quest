import { BUILDINGS, BUILDING_BASE, CELL_PX, doorFrontOf, doorOf, feetOverlap, fits, isReachable, matAt } from "./campusV2.js";
import { hasOfficeInfo } from "../ui/officeView.js";
import { estimateLabelSize, placeBuildingLabel, splitTwoLines } from "./buildingLabels.js";

/*
 * 맵 v2에서 "건물 소개 안내원"(정문 옆 NPC)을 세울 자리를 정합니다(브라우저 API 없음 → 테스트 가능).
 * 대상: 사무실 안내가 있는 건물(officeView.js hasOfficeInfo, 제외 목록 GUIDE_EXCLUDED의 정문안내실은 빠짐).
 *       정문을 지정한 11개 건물(DOOR_OVERRIDES)과 법학관(자동 계산 정문) — 11/25 종헌 결정.
 * - 11/26 #75 검토(종헌): 문 그림 바로 옆 칸(문과 같은 외벽 앞, 문 앞 칸에서 한 칸 = 16px 옆). 아래 · 위쪽 면의 문은 좌우로,
 *   왼쪽 · 오른쪽 면의 문은 위아래로. 두 옆 칸이 모두 되면 안내원 글자가 지붕을 덜 덮는 쪽.
 * - 조건: 걸어서 닿는 칸, 어느 문 앞 칸과도 겹치지 않음, 안내원 칸을 막아도 주변 길이 끊기지 않음.
 * - 두 옆 칸이 모두 안 되면 예전 규칙(문 앞 칸에서 16~32px, 벽에서 0~16px 물러선 자리 중 글자가 지붕을 가장 적게 덮는 곳)으로
 *   두고 GUIDE_FALLBACK에 남깁니다(보고용).
 * - 건물 이름표는 이 글자 칸을 피해 자리를 잡습니다(buildingLabels.js placeBuildingLabel의 avoid).
 * - 예외 GUIDE_NEAR_LABEL(Minerva Complex): 정문 대신 맵 위 건물 이름표 바로 옆(걸을 수 있는 칸)에 섭니다.
 * 맵 다각형 · 충돌 판정은 바꾸지 않고 읽기만 합니다. 안내원 칸은 CampusScene이 이동할 때만 막습니다.
 */
export const GUIDE_TEXT_HALF = 30; // 안내원 발밑 이름표 칸 가로 반폭(px). "건물 소개 안내원" 6px 글씨 + 여백보다 조금 넓게
export const guideTextRect = (g) => ({ x0: g.x - GUIDE_TEXT_HALF, x1: g.x + GUIDE_TEXT_HALF, y0: g.y + 7, y1: g.y + 17 });
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

// 정문 대신 이름표 옆에 세우는 건물과 이유
export const GUIDE_NEAR_LABEL = {
  minerva: "11/25 종헌 확정: 지하캠퍼스라 정문 대신 맵 위 \"Minerva Complex\" 이름표 옆",
};

// 건물 이름표 사각형(한/영 어림 크기, 안내원 글자 칸을 피하기 전 자리)
function nameTagRect(b, lang) {
  const name = (lang === "en" ? b.nameEn : b.name) ?? b.name;
  const two = lang === "en" ? name : b.mapName ?? name;
  const spot = placeBuildingLabel(b, (scale, lines) => estimateLabelSize(lines === 2 ? two : name, scale, lines));
  const { w, h } = estimateLabelSize(spot.lines === 2 ? splitTwoLines(two) : name, spot.scale, spot.lines);
  return { x: spot.x, y: spot.y, x0: spot.x - w / 2, x1: spot.x + w / 2, y0: spot.y - h / 2, y1: spot.y + h / 2 };
}

// 이름표 옆: 이름표 좌우 끝에서 8~40px 바깥, 위아래로 -8~16px. 걸을 수 있고 길을 끊지 않으며,
// 안내원 · 글자 칸이 어느 건물 이름표(한/영)와도 겹치지 않는 자리 중 이름표에 가장 가까운 곳
function spotNearLabel(building) {
  const tags = BUILDINGS.flatMap((b) => [nameTagRect(b, "ko"), nameTagRect(b, "en")]);
  const own = [nameTagRect(building, "ko"), nameTagRect(building, "en")];
  const fronts = BUILDINGS.map(doorFrontOf).filter(Boolean);
  const snapPt = (v) => Math.round((v - 2) / CELL_PX) * CELL_PX + 2;
  let best = null;
  for (const side of [-1, 1]) {
    const edge = side < 0 ? Math.min(...own.map((r) => r.x0)) : Math.max(...own.map((r) => r.x1));
    for (let dx = 8; dx <= 40; dx += 4) {
      for (let dy = -8; dy <= 16; dy += 4) {
        const spot = { x: snapPt(edge + side * dx), y: snapPt(own[0].y + dy) };
        if (!fits(spot.x, spot.y) || !isReachable(spot.x, spot.y)) continue;
        if (fronts.some((f) => feetOverlap(f.x, f.y, spot.x, spot.y) || Math.hypot(f.x - spot.x, f.y - spot.y) < 12)) continue;
        const body = { x0: spot.x - 8, x1: spot.x + 8, y0: spot.y - 8, y1: spot.y + 8 };
        if (tags.some((r) => overlaps(r, guideTextRect(spot)) || overlaps(r, body))) continue;
        if (!keepsPathsOpen(spot)) continue;
        const d = Math.hypot(spot.x - own[0].x, spot.y - own[0].y);
        if (!best || d < best.d) best = { ...spot, d };
      }
    }
  }
  return best && { x: best.x, y: best.y };
}

const spots = new Map();
const BESIDE = 16; // 문 앞 칸에서 한 칸 옆
// 문 바로 옆 두 칸이 모두 안 돼 예전 규칙으로 둔 건물(보고용)
export const GUIDE_FALLBACK = new Set();
export function guideSpotOf(building) {
  if (spots.has(building.id)) return spots.get(building.id);
  if (Object.hasOwn(GUIDE_NEAR_LABEL, building.id)) {
    const near = hasOfficeInfo(building.id) ? spotNearLabel(building) : null;
    spots.set(building.id, near);
    return near;
  }
  let best = null;
  const front = hasOfficeInfo(building.id) ? doorFrontOf(building) : null;
  if (front) {
    const face = doorOf(building).face;
    const along = face === "left" || face === "right" ? [0, 1] : [1, 0];
    const outward = { down: [0, 1], up: [0, -1], right: [1, 0], left: [-1, 0] }[face];
    const fronts = BUILDINGS.map(doorFrontOf).filter(Boolean);
    const usable = (spot) =>
      fits(spot.x, spot.y) &&
      isReachable(spot.x, spot.y) &&
      !fronts.some((f) => feetOverlap(f.x, f.y, spot.x, spot.y) || Math.hypot(f.x - spot.x, f.y - spot.y) < 12) &&
      keepsPathsOpen(spot);
    // 1순위: 문 바로 옆 칸(같은 외벽 앞, 한 칸 = 16px 옆)
    for (const off of [-BESIDE, BESIDE]) {
      const spot = { x: front.x + along[0] * off, y: front.y + along[1] * off };
      if (!usable(spot)) continue;
      const roof = roofUnder(guideTextRect(spot));
      if (!best || roof < best.roof) best = { ...spot, roof };
    }
    if (best) {
      const found = { x: best.x, y: best.y };
      spots.set(building.id, found);
      return found;
    }
    GUIDE_FALLBACK.add(building.id);
    const offsets = [0, 8, 16].flatMap((out) => [-16, 16, -24, 24, -32, 32].map((off) => [off, out]));
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
export const guideTextRects = () => BUILDINGS.map(guideSpotOf).filter(Boolean).map(guideTextRect);

// 퀴즈 상자(16×16, 가운데 기준) 자리가 안내원 · 안내원 글자와 떨어져 있는지
export const awayFromGuides = (box, guides) =>
  guides.every((g) => Math.hypot(g.x - box.x, g.y - box.y) >= 20 && !overlaps({ x0: box.x - 8, x1: box.x + 8, y0: box.y - 8, y1: box.y + 8 }, guideTextRect(g)));
