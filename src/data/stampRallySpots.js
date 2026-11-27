import { BUILDINGS, BUILDING_BASE, CELL_PX, FEET, MAT, PASSAGES, doorArtRect, doorFrontOf, doorOf, fits, gateRects, isReachable, matAt } from "./campusV2.js";
import { GUIDE_NEAR_LABEL, guideSpotOf } from "./guides.js";
import { STAMP_RALLY_IDS } from "../../shared/stampRally.js";

/*
 * "시설 안내문" 팻말과 스탬프 랠리 부스를 놓을 자리(맵 v2, 월드 px)를 정합니다. 브라우저 API 없음 → 테스트 가능.
 * 11/27 오후(PM 결정: 이종헌):
 * - 팻말: 시설 소개가 있는 모든 건물(예전 "건물 소개 안내원" 13곳)에 안내원 대신 팻말. [Enter] 시설 소개는 팻말에서 엽니다.
 *   문과 같은 외벽에 바짝 붙입니다(기둥 밑동이 외벽 바로 앞, 그림은 건물과 일부 겹침). 문에서 16~48px 옆,
 *   쪽은 예전 안내원이 서던 쪽 먼저. 조건: 팻말 앞에 말을 걸 칸이 있고, 문 앞 칸을 막지 않고, 주변 길을 끊지 않고,
 *   문 그림 칸(2px 여유) · 정문 그림과 겹치지 않음. Minerva Complex는 예전 안내원 자리(이름표 옆)에 그대로 세웁니다.
 * - 부스: 스탬프 랠리 4곳(shared/stampRally.js)만. 문을 사이에 두고 팻말 반대쪽, 팻말 가운데 ↔ 부스 가운데 거리가
 *   예전(RALLY_SPOTS_BEFORE)의 1.5배(BOOTH_SIGN_DISTANCE_RATIO)에 가장 가까운 자리.
 *   조건: 바닥 전체가 걸을 수 있는 칸이고 차도 · 건널목 · 주차장이 아님, 문 앞 칸 · 팻말을 덮지 않음,
 *   부스 앞에서 말을 걸 자리가 있음, 길을 끊지 않음, 요구된 통로(PASSAGES) 선 밖.
 * - 그림 크기는 예전의 80%(SIGN_SCALE · BOOTH_SCALE). 충돌 칸 · 그림 칸도 같은 배율.
 * 맵 다각형 · 충돌 판정 격자는 바꾸지 않습니다. 부스 · 팻말은 CampusScene이 이동할 때만 막습니다.
 */
const FACE = {
  down: { along: [1, 0], out: [0, 1] },
  up: { along: [1, 0], out: [0, -1] },
  right: { along: [0, 1], out: [1, 0] },
  left: { along: [0, 1], out: [-1, 0] },
};

export const SIGN_SCALE = 0.8;
export const BOOTH_SCALE = 0.8;
// 80%로 줄이기 전 크기(자리 기준 px)
export const SIGN_FULL = { halfW: 28, top: 24, foot: 8, blockHalfW: FEET.right, blockTop: FEET.top, blockBottom: FEET.bottom };
export const BOOTH_FULL = { base: { left: -20, right: 20, top: -8, bottom: 5 }, artHalfW: 34, artTop: 52, artBottom: 8, talkDy: 14 };
const sc = (v, k) => v * k;

// 팻말 기둥 밑동은 팻말 자리(y)에서 이만큼 아래
export const SIGN_FOOT = sc(SIGN_FULL.foot, SIGN_SCALE);
// 부스 바닥(충돌) 사각형: 부스 자리(x, y) 기준. 테이블과 다리 4개가 놓인 범위입니다.
export const BOOTH_BASE = Object.fromEntries(Object.entries(BOOTH_FULL.base).map(([k, v]) => [k, sc(v, BOOTH_SCALE)]));
export const boothRect = (s) => ({ x0: s.x + BOOTH_BASE.left, x1: s.x + BOOTH_BASE.right, y0: s.y + BOOTH_BASE.top, y1: s.y + BOOTH_BASE.bottom });
// 부스 앞에서 말을 거는 기준점(부스 아래쪽 바로 앞)과 거리
export const BOOTH_TALK = { dy: Math.round(sc(BOOTH_FULL.talkDy, BOOTH_SCALE)), range: 30 };
export const boothTalkPoint = (s) => ({ x: s.x, y: s.y + BOOTH_TALK.dy });

// 그림이 덮는 칸(월드 px, x0 · y0 · x1 · y1): 건물 이름표 · 퀴즈 상자가 피합니다(CampusScene · world.js).
// 팻말 칸: 판 · 기둥. 부스 그림 칸: 캐노피 · 테이블 · "[스탬프 랠리 부스]" 이름표까지.
export const signArtRect = (s) => ({ x0: s.x - sc(SIGN_FULL.halfW, SIGN_SCALE), x1: s.x + sc(SIGN_FULL.halfW, SIGN_SCALE), y0: s.y - sc(SIGN_FULL.top, SIGN_SCALE), y1: s.y + SIGN_FOOT });
export const boothArtRect = (s) => ({
  x0: s.x - sc(BOOTH_FULL.artHalfW, BOOTH_SCALE),
  x1: s.x + sc(BOOTH_FULL.artHalfW, BOOTH_SCALE),
  y0: s.y - sc(BOOTH_FULL.artTop, BOOTH_SCALE),
  y1: s.y + sc(BOOTH_FULL.artBottom, BOOTH_SCALE),
});
// 팻말 충돌 칸: 기둥 둘레(예전 안내원 발 상자 크기의 80%)
export const signBlockRect = (s) => ({
  x0: s.x - sc(SIGN_FULL.blockHalfW, SIGN_SCALE),
  x1: s.x + sc(SIGN_FULL.blockHalfW, SIGN_SCALE),
  y0: s.y + sc(SIGN_FULL.blockTop, SIGN_SCALE),
  y1: s.y + sc(SIGN_FULL.blockBottom, SIGN_SCALE),
});

const feetHit = (x, y, r) => x + FEET.left < r.x1 && x + FEET.right > r.x0 && y + FEET.top < r.y1 && y + FEET.bottom > r.y0;
// 캐릭터 발 상자(가운데 x, y)가 부스 바닥 · 팻말 기둥 칸과 겹치는지
export const feetHitBooth = (x, y, booth) => feetHit(x, y, boothRect(booth));
export const feetHitSign = (x, y, sign) => feetHit(x, y, signBlockRect(sign));
const overlap = (a, b, pad = 0) => a.x0 < b.x1 + pad && b.x0 - pad < a.x1 && a.y0 < b.y1 + pad && b.y0 - pad < a.y1;

const NO_BOOTH_MATS = new Set([MAT.road, MAT.crosswalk, MAT.parking, MAT.outerRoad]);
export const DOOR_ART_CLEAR = 2; // 문 그림과 팻말 · 부스 그림 사이 여유(px)

// 장애물(blocked)을 놓아도 그 둘레의 갈 수 있는 격자점이 서로 이어져 있는지(가로세로 창 안에서 확인)
function keepsPathsOpen(center, blocked, reach = 44, window = 96) {
  const snap = (v) => Math.floor(v / CELL_PX) * CELL_PX + CELL_PX / 2;
  const cx = snap(center.x);
  const cy = snap(center.y);
  const inWindow = (x, y) => Math.abs(x - cx) <= window && Math.abs(y - cy) <= window;
  const open = (x, y) => inWindow(x, y) && fits(x, y) && isReachable(x, y) && !blocked(x, y);
  const near = [];
  for (let y = cy - reach; y <= cy + reach; y += CELL_PX) for (let x = cx - reach; x <= cx + reach; x += CELL_PX) if (open(x, y)) near.push([x, y]);
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
const doorArts = () => BUILDINGS.map(doorArtRect).filter(Boolean);

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

// 팻말 앞에서 말을 거는 칸: 팻말 자리에서 바깥으로 이 거리 안에 설 수 있는 칸이 있어야 합니다.
export const SIGN_TALK = { from: 6, to: 16 };
export function signTalkPoint(sign) {
  const { out } = FACE[sign.face];
  for (let k = SIGN_TALK.from; k <= SIGN_TALK.to; k += 1) {
    const p = { x: sign.x + out[0] * k, y: sign.y + out[1] * k };
    if (fits(p.x, p.y) && isReachable(p.x, p.y) && !feetHitSign(p.x, p.y, sign)) return p;
  }
  return null;
}
function signUsable(sign) {
  if (!signTalkPoint(sign)) return false;
  if (fronts().some((f) => feetHitSign(f.x, f.y, sign) || Math.hypot(f.x - sign.x, f.y - sign.y) < 12)) return false;
  const art = signArtRect(sign);
  if (doorArts().some((d) => overlap(art, d, DOOR_ART_CLEAR))) return false;
  if (gateRects().some((r) => overlap(art, { x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }))) return false;
  return keepsPathsOpen(sign, (x, y) => feetHitSign(x, y, sign), 24, 64);
}

// 외벽에 붙이기: 문 앞 줄의 점 p에서 외벽 쪽으로 곧게 가서, 기둥 밑동이 외벽 바로 앞(WALL_GAP px)에 오게 한 팻말 자리.
export const WALL_GAP = 2;
const WALL_SEARCH = 48;
function attachToWall(building, p, face) {
  const own = BUILDING_BASE + building.index;
  const { out } = FACE[face];
  const isWall = (x, y) => matAt(x, y) === own;
  let x = Math.round(p.x);
  let y = Math.round(p.y);
  let moved = 0;
  // 건물 안에서 시작했으면 바깥으로, 밖이면 외벽을 만날 때까지 안쪽으로
  while (isWall(x, y) && moved < WALL_SEARCH) {
    x += out[0];
    y += out[1];
    moved += 1;
  }
  moved = 0;
  while (!isWall(x - out[0], y - out[1]) && moved < WALL_SEARCH) {
    x -= out[0];
    y -= out[1];
    moved += 1;
  }
  if (!isWall(x - out[0], y - out[1])) return null; // 이 줄에는 외벽이 없음
  // (x, y) = 외벽 바로 앞 첫 픽셀. 기둥 밑동을 그보다 WALL_GAP 앞에 둡니다.
  if (face === "down") return { x, y: y + WALL_GAP - SIGN_FOOT };
  if (face === "up") return { x, y: y - WALL_GAP - SIGN_FOOT };
  return { x: x + out[0] * (WALL_GAP + 1), y: y - SIGN_FOOT / 2 };
}

// 팻말 기둥 밑동에서 외벽까지 거리(px). 테스트 · 보고용
export function signWallDistance(building, sign) {
  const own = BUILDING_BASE + building.index;
  const { out } = FACE[sign.face];
  const vertical = sign.face === "down" || sign.face === "up";
  const foot = { x: Math.round(sign.x), y: Math.round(sign.y + (vertical ? SIGN_FOOT : SIGN_FOOT / 2)) };
  for (let k = 0; k <= WALL_SEARCH; k++) if (matAt(foot.x - out[0] * k, foot.y - out[1] * k) === own) return k;
  return Infinity;
}

export const SIGN_ALONG = [32, 28, 36, 24, 40, 20, 44, 16, 48]; // 문 앞 칸에서 옆으로(px), 앞에서부터 시도
const signCache = new Map();
// 팻말 자리 { x, y, face, side, along, attached } 또는 null. guideSpotOf(예전 안내원 자리)가 없는 건물은 팻말도 없습니다.
export function signSpotOf(building) {
  if (signCache.has(building.id)) return signCache.get(building.id);
  const guide = guideSpotOf(building);
  let found = null;
  if (guide) {
    const front = doorFrontOf(building);
    const face = doorOf(building)?.face;
    if (front && face && !Object.hasOwn(GUIDE_NEAR_LABEL, building.id)) {
      const { along } = FACE[face];
      // 예전 안내원이 서던 쪽(+1 = 오른쪽 · 아래쪽, -1 = 왼쪽 · 위쪽) 먼저
      const first = Math.sign((guide.x - front.x) * along[0] + (guide.y - front.y) * along[1]) || 1;
      search: for (const side of [first, -first]) {
        for (const off of SIGN_ALONG) {
          const p = { x: front.x + along[0] * side * off, y: front.y + along[1] * side * off };
          const at = attachToWall(building, p, face);
          if (!at) continue;
          const sign = { x: at.x, y: at.y, face, side, along: off, attached: true };
          if (!signUsable(sign)) continue;
          found = sign;
          break search;
        }
      }
    }
    // 외벽에 붙일 자리가 없거나 정문이 아닌 예외 자리(Minerva Complex 이름표 옆): 예전 안내원 자리에 세웁니다.
    if (!found) found = { x: guide.x, y: guide.y, face: "down", side: 1, along: 0, attached: false };
  }
  signCache.set(building.id, found);
  return found;
}

// 80%로 줄이고 옮기기 전(11/27 오전)의 팻말 · 부스 자리. 부스 ↔ 팻말 거리 1.5배의 기준입니다.
export const RALLY_SPOTS_BEFORE = {
  library: { sign: [626, 966], booth: [662, 1034] },
  union: { sign: [602, 594], booth: [542, 626] },
  main: { sign: [1078, 534], booth: [1010, 578] },
  humanities: { sign: [1254, 254], booth: [1186, 298] },
};
export const BOOTH_SIGN_DISTANCE_RATIO = 1.5;
export const BOOTH_SIGN_DISTANCE_TOLERANCE = 4; // 후보가 4px 격자라 이 안이면 1.5배로 봅니다
export const distanceBefore = (id) => {
  const b = RALLY_SPOTS_BEFORE[id];
  return Math.hypot(b.sign[0] - b.booth[0], b.sign[1] - b.booth[1]);
};

function boothUsable(spot, sign) {
  const r = boothRect(spot);
  for (let y = r.y0; y <= r.y1; y += 2) {
    for (let x = r.x0; x <= r.x1; x += 2) {
      const m = matAt(x, y);
      if (m >= BUILDING_BASE || NO_BOOTH_MATS.has(m) || !fits(x, y - 4)) return false;
    }
  }
  // 부스가 건물 벽에 바짝 붙지 않게: 바닥 사각형 위 12px 안에 건물이 없어야 함(지붕 천막이 벽을 조금 가리는 것은 괜찮음)
  for (let y = r.y0 - 12; y < r.y0; y += 4) for (let x = r.x0; x <= r.x1; x += 4) if (matAt(x, y) >= BUILDING_BASE) return false;
  const talk = boothTalkPoint(spot);
  if (!fits(talk.x, talk.y) || !isReachable(talk.x, talk.y) || feetHitSign(talk.x, talk.y, sign)) return false;
  if (fronts().some((f) => feetHitBooth(f.x, f.y, spot) || Math.hypot(f.x - spot.x, f.y - spot.y) < 28)) return false;
  const art = boothArtRect(spot);
  if (overlap(art, signArtRect(sign)) || doorArts().some((d) => overlap(art, d, DOOR_ART_CLEAR))) return false;
  if (passageLine().some((p) => feetHitBooth(p.x, p.y, spot))) return false;
  return keepsPathsOpen(spot, (x, y) => feetHitBooth(x, y, spot) || feetHitSign(x, y, sign));
}

// 부스 자리: 문을 사이에 두고 팻말 반대쪽에서, 팻말과의 거리가 target에 가장 가까운 곳(같으면 문에 가까운 쪽)
function boothSpot(front, face, sign, target) {
  const { along, out } = FACE[face];
  let best = null;
  for (let a = 20; a <= 160; a += 4) {
    for (let o = 8; o <= 120; o += 4) {
      const spot = { x: front.x - along[0] * sign.side * a + out[0] * o, y: front.y - along[1] * sign.side * a + out[1] * o };
      const d = Math.hypot(spot.x - sign.x, spot.y - sign.y);
      const cost = Math.abs(d - target) + (a + o) / 1000;
      if (best && cost >= best.cost) continue;
      if (!boothUsable(spot, sign)) continue;
      best = { ...spot, along: a, out: o, cost, distance: d };
    }
  }
  return best;
}

const cache = new Map();
// 스탬프 랠리 건물의 { sign, booth: {x, y, side, along, out, distance, target} } 또는 null(대상이 아니거나 자리를 못 찾음)
export function rallySpotsOf(building) {
  if (!STAMP_RALLY_IDS.includes(building.id)) return null;
  if (cache.has(building.id)) return cache.get(building.id);
  const front = doorFrontOf(building);
  const face = doorOf(building)?.face;
  const sign = signSpotOf(building);
  let found = null;
  if (front && face && sign) {
    const target = distanceBefore(building.id) * BOOTH_SIGN_DISTANCE_RATIO;
    const booth = boothSpot(front, face, sign, target);
    if (booth) found = { sign, booth: { x: booth.x, y: booth.y, side: -sign.side, along: booth.along, out: booth.out, distance: booth.distance, target } };
  }
  cache.set(building.id, found);
  return found;
}

export const rallyStops = () =>
  STAMP_RALLY_IDS.map((id) => {
    const building = BUILDINGS.find((b) => b.id === id);
    return { id, building, ...(rallySpotsOf(building) ?? { sign: null, booth: null }) };
  });

// 1.5배를 못 맞춘 건물(가장 가까운 자리로 둠). 보고 · 테스트용
export const boothDistanceExceptions = () =>
  rallyStops()
    .filter((s) => s.booth && Math.abs(s.booth.distance - s.booth.target) > BOOTH_SIGN_DISTANCE_TOLERANCE)
    .map((s) => s.id);

// 퀴즈 상자(16×16, 가운데 기준) 자리가 부스 그림 · 팻말과 떨어져 있는지. stops: [{ sign, booth }]
export function awayFromRally(box, stops = rallyStops()) {
  const q = { x0: box.x - 8, x1: box.x + 8, y0: box.y - 10, y1: box.y + 8 };
  return stops.every(({ sign, booth }) => {
    if (sign && overlap(q, signArtRect(sign), 4)) return false;
    return !(booth && overlap(q, boothArtRect(booth), 4));
  });
}
