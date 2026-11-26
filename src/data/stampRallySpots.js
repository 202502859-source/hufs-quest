import { BUILDINGS, BUILDING_BASE, CELL_PX, FEET, MAT, PASSAGES, doorFrontOf, doorOf, feetOverlap, fits, isReachable, matAt } from "./campusV2.js";
import { guideSpotOf } from "./guides.js";
import { STAMP_RALLY_IDS } from "../../shared/stampRally.js";

/*
 * 스탬프 랠리 부스와 "시설 안내문" 팻말을 놓을 자리(맵 v2, 월드 px)를 정합니다. 브라우저 API 없음 → 테스트 가능.
 * 대상은 shared/stampRally.js의 4곳(도서관 · 국제학사 및 학생회관 · 본관 · 인문과학관)뿐입니다.
 * - 출입구(campusV2Data.js DOOR_OVERRIDES의 주 출입구 1곳)를 가운데에 두고 한쪽에 팻말, 반대쪽에 부스.
 * - 팻말: 문과 같은 외벽 앞, 문 앞 칸에서 2칸(32px) 옆. 안 되면 1칸(16px, 예전 안내원 자리). 쪽은 예전 안내원이 서던 쪽
 *   (guides.js가 걸을 수 있고 길을 끊지 않는 쪽으로 이미 고른 쪽). 팻말이 바라보는 방향 = 문이 바라보는 방향(face).
 * - 부스: 반대쪽으로 28~56px, 문에서 바깥(도로 쪽)으로 12~44px 떨어진 자리 가운데 기준(40px 옆 · 22px 바깥)에 가장 가까운 곳.
 *   부스 바닥 사각형이 모두 걸을 수 있는 칸이고 차도 · 건널목 · 주차장이 아니며, 문 앞 칸과 팻말을 덮지 않고,
 *   부스 앞(아래)에서 말을 걸 자리가 있고, 부스를 막아도 주변 길이 끊기지 않으며, 요구된 통로(PASSAGES)의 선 위가 아닌 곳.
 * 맵 다각형 · 충돌 판정 격자는 바꾸지 않습니다. 부스 · 팻말은 CampusScene이 이동할 때만 막습니다(안내원과 같은 방식).
 */
const FACE = {
  down: { along: [1, 0], out: [0, 1] },
  up: { along: [1, 0], out: [0, -1] },
  right: { along: [0, 1], out: [1, 0] },
  left: { along: [0, 1], out: [-1, 0] },
};

// 부스 바닥(충돌) 사각형: 부스 자리(x, y) 기준. 테이블과 다리 4개가 놓인 범위입니다.
export const BOOTH_BASE = { left: -20, right: 20, top: -8, bottom: 5 };
export const boothRect = (s) => ({ x0: s.x + BOOTH_BASE.left, x1: s.x + BOOTH_BASE.right, y0: s.y + BOOTH_BASE.top, y1: s.y + BOOTH_BASE.bottom });
// 부스 앞에서 말을 거는 기준점(부스 아래쪽 바로 앞)과 거리
export const BOOTH_TALK = { dy: 14, range: 30 };
export const boothTalkPoint = (s) => ({ x: s.x, y: s.y + BOOTH_TALK.dy });
// 팻말에서 이 거리 안이면 "[Enter] 시설 소개"(예전 안내원과 같은 거리, officeView.js GUIDE_RANGE)

// 캐릭터 발 상자(가운데 x, y)가 부스 바닥 사각형과 겹치는지
export function feetHitBooth(x, y, booth) {
  const r = boothRect(booth);
  return x + FEET.left < r.x1 && x + FEET.right > r.x0 && y + FEET.top < r.y1 && y + FEET.bottom > r.y0;
}
// 팻말 기둥 칸은 안내원과 같은 크기로 막습니다.
export const feetHitSign = (x, y, sign) => feetOverlap(x, y, sign.x, sign.y);

const NO_BOOTH_MATS = new Set([MAT.road, MAT.crosswalk, MAT.parking, MAT.outerRoad]);

// 장애물(blocked)을 놓아도 그 둘레의 갈 수 있는 격자점이 서로 이어져 있는지(가로세로 창 안에서 확인)
function keepsPathsOpen(center, blocked, reach = 44, window = 96) {
  const inWindow = (x, y) => Math.abs(x - center.x) <= window && Math.abs(y - center.y) <= window;
  const open = (x, y) => inWindow(x, y) && fits(x, y) && isReachable(x, y) && !blocked(x, y);
  const near = [];
  for (let y = center.y - reach; y <= center.y + reach; y += CELL_PX) for (let x = center.x - reach; x <= center.x + reach; x += CELL_PX) if (open(x, y)) near.push([x, y]);
  if (!near.length) return true;
  const key = (x, y) => `${x},${y}`;
  const seen = new Set([key(...near[0])]);
  const queue = [near[0]];
  for (let q = 0; q < queue.length; q++) {
    const [x, y] = queue[q];
    for (const [dx, dy] of [[CELL_PX, 0], [-CELL_PX, 0], [0, CELL_PX], [0, -CELL_PX]]) {
      const k = key(x + dx, y + dy);
      if (seen.has(k) || !open(x + dx, y + dy)) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  return near.every(([x, y]) => seen.has(key(x, y)));
}

const fronts = () => BUILDINGS.map(doorFrontOf).filter(Boolean);

// 반드시 지나갈 수 있어야 하는 통로(campusV2Data.js PASSAGES_M)의 선을 4px 간격으로 찍은 점들. 부스는 이 선 위에 두지 않습니다.
let passagePoints = null;
function passageLine() {
  if (passagePoints) return passagePoints;
  passagePoints = [];
  for (const { segPx } of PASSAGES) {
    const [[x0, y0], [x1, y1]] = segPx;
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
    for (let i = 0; i <= steps; i++) passagePoints.push({ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps });
  }
  return passagePoints;
}

function signSpot(front, face, side) {
  const { along } = FACE[face];
  for (const off of [32, 16]) {
    const spot = { x: front.x + along[0] * side * off, y: front.y + along[1] * side * off };
    if (!fits(spot.x, spot.y) || !isReachable(spot.x, spot.y)) continue;
    if (fronts().some((f) => feetOverlap(f.x, f.y, spot.x, spot.y) || Math.hypot(f.x - spot.x, f.y - spot.y) < 12)) continue;
    if (!keepsPathsOpen(spot, (x, y) => feetOverlap(x, y, spot.x, spot.y), 24, 64)) continue;
    return { ...spot, cells: off / 16 };
  }
  return null;
}

function boothSpot(front, face, side, sign) {
  const { along, out } = FACE[face];
  const candidates = [];
  for (let a = 28; a <= 56; a += 4) for (let o = 12; o <= 44; o += 4) candidates.push({ a, o, cost: Math.abs(a - 40) + Math.abs(o - 22) });
  candidates.sort((p, q) => p.cost - q.cost);
  for (const { a, o } of candidates) {
    const spot = { x: front.x - along[0] * side * a + out[0] * o, y: front.y - along[1] * side * a + out[1] * o };
    const r = boothRect(spot);
    let clear = true;
    for (let y = r.y0; y <= r.y1 && clear; y += 2) {
      for (let x = r.x0; x <= r.x1 && clear; x += 2) {
        const m = matAt(x, y);
        if (m >= BUILDING_BASE || NO_BOOTH_MATS.has(m) || !fits(x, y - 4)) clear = false;
      }
    }
    if (!clear) continue;
    // 부스가 건물 벽에 바짝 붙지 않게: 바닥 사각형 위 12px 안에 건물이 없어야 함(지붕 천막이 벽을 조금 가리는 것은 괜찮음)
    let underRoof = false;
    for (let y = r.y0 - 12; y < r.y0 && !underRoof; y += 4) for (let x = r.x0; x <= r.x1; x += 4) if (matAt(x, y) >= BUILDING_BASE) underRoof = true;
    if (underRoof) continue;
    const talk = boothTalkPoint(spot);
    if (!fits(talk.x, talk.y) || !isReachable(talk.x, talk.y)) continue;
    if (fronts().some((f) => feetHitBooth(f.x, f.y, spot) || Math.hypot(f.x - spot.x, f.y - spot.y) < 28)) continue;
    if (sign && (feetHitBooth(sign.x, sign.y, spot) || Math.hypot(sign.x - spot.x, sign.y - spot.y) < 36)) continue;
    if (passageLine().some((p) => feetHitBooth(p.x, p.y, spot))) continue;
    const blocked = (x, y) => feetHitBooth(x, y, spot) || (sign ? feetHitSign(x, y, sign) : false);
    if (!keepsPathsOpen(spot, blocked)) continue;
    return { ...spot, along: a, out: o };
  }
  return null;
}

const cache = new Map();
// { sign: {x, y, face, side, cells}, booth: {x, y, side, along, out} } 또는 null(대상이 아니거나 자리를 못 찾음)
export function rallySpotsOf(building) {
  if (!STAMP_RALLY_IDS.includes(building.id)) return null;
  if (cache.has(building.id)) return cache.get(building.id);
  const front = doorFrontOf(building);
  const face = doorOf(building)?.face;
  const guide = guideSpotOf(building);
  let found = null;
  if (front && face && guide) {
    const { along } = FACE[face];
    // 예전 안내원이 서던 쪽(+1 = 오른쪽 · 아래쪽, -1 = 왼쪽 · 위쪽)
    const side = Math.sign((guide.x - front.x) * along[0] + (guide.y - front.y) * along[1]) || 1;
    const sign = signSpot(front, face, side);
    const booth = sign ? boothSpot(front, face, side, sign) : null;
    if (sign && booth) found = { sign: { x: sign.x, y: sign.y, face, side, cells: sign.cells }, booth: { x: booth.x, y: booth.y, side: -side, along: booth.along, out: booth.out } };
  }
  cache.set(building.id, found);
  return found;
}

export const rallyStops = () =>
  STAMP_RALLY_IDS.map((id) => {
    const building = BUILDINGS.find((b) => b.id === id);
    return { id, building, ...(rallySpotsOf(building) ?? { sign: null, booth: null }) };
  });

// 퀴즈 상자(16×16, 가운데 기준) 자리가 부스 · 팻말과 떨어져 있는지
export function awayFromRally(box, stops = rallyStops()) {
  return stops.every(({ sign, booth }) => {
    if (sign && Math.hypot(sign.x - box.x, sign.y - box.y) < 28) return false;
    if (!booth) return true;
    const r = boothRect(booth);
    return box.x + 8 < r.x0 - 12 || box.x - 8 > r.x1 + 12 || box.y + 8 < booth.y - 44 || box.y - 8 > r.y1 + 22;
  });
}
