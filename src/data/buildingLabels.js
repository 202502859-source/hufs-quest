import { BUILDINGS, BUILDING_BASE, doorOf, matAt } from "./campusV2.js";

/*
 * 맵 v2에서 건물 이름표를 놓을 자리를 정합니다(브라우저 API 없음 → 테스트 가능).
 * - 이름표 사각형(가로 w × 세로 h, 월드 px)이 통째로 그 건물 지붕 안에 들어가는 자리 가운데, 입구에 가장 가까운 곳.
 *   화면 아래쪽 벽(창문 줄)은 가리지 않도록 이름표 아래로 벽 높이만큼 더 지붕이어야 합니다.
 * - 안 들어가면 글자를 줄이고(0.8배) → 두 줄로 → 그래도 안 되면 지붕 가운데(가장 큰 사각형 중심).
 * - 맵이 돌아가 있어도 글자는 늘 수평입니다(사각형도 화면 축 기준).
 * 맵 다각형 · 충돌 판정은 바꾸지 않고 읽기만 합니다.
 */
const WALL_PX = { none: 0, low: 6, mid: 10, high: 14 };
const STEP = 4; // 후보 자리 간격(px)
const SAMPLE = 4; // 사각형 안 검사 간격(px)

const isOwn = (b, x, y) => matAt(Math.floor(x), Math.floor(y)) === BUILDING_BASE + b.index;

// 이름표 사각형이 지붕 안에 있는지(가장자리 · 안쪽을 SAMPLE 간격으로 확인)
function fitsRoof(b, cx, cy, w, h) {
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const below = WALL_PX[b.height] ?? 10;
  for (let y = y0; y <= y0 + h; y += Math.min(SAMPLE, h)) {
    for (let x = x0; x <= x0 + w; x += Math.min(SAMPLE, w)) if (!isOwn(b, x, y)) return false;
    if (!isOwn(b, x0 + w, y)) return false;
  }
  // 아래쪽 벽(창문 줄)을 가리지 않게: 이름표 바닥 아래 벽 높이만큼도 같은 건물(지붕)이어야 함
  for (let x = x0; x <= x0 + w; x += SAMPLE) if (!isOwn(b, x, y0 + h + below)) return false;
  return isOwn(b, x0 + w, y0 + h) && isOwn(b, x0 + w, y0 + h + below);
}

// 입구 바로 위(벽 위 지붕)에서 가까운 순서로 후보를 시험합니다.
function nearestFit(b, w, h) {
  const door = doorOf(b) ?? { x: (b.box.x0 + b.box.x1) / 2, y: b.box.y1 };
  const anchor = { x: door.x, y: door.y - (WALL_PX[b.height] ?? 10) - h / 2 - 2 };
  const candidates = [];
  for (let y = Math.ceil(b.box.y0); y <= b.box.y1; y += STEP) {
    for (let x = Math.ceil(b.box.x0); x <= b.box.x1; x += STEP) {
      if (isOwn(b, x, y)) candidates.push({ x, y, d: Math.hypot(x - anchor.x, y - anchor.y) });
    }
  }
  candidates.sort((p, q) => p.d - q.d);
  return candidates.find((c) => fitsRoof(b, c.x, c.y, w, h)) ?? null;
}

// 가장 큰 사각형(다각형)의 가운데 — 마지막 대안. 전체 지도용 mapLabel(이웃과 겹치지 않게 비켜 둔 값)은 쓰지 않습니다.
function roofCenter(b) {
  const area = (pts) => Math.abs(pts.reduce((s, [x, y], i) => s + x * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * y, 0)) / 2;
  const largest = b.polysPx.reduce((p, q) => (area(q) > area(p) ? q : p));
  return { x: largest.reduce((s, q) => s + q[0], 0) / largest.length, y: largest.reduce((s, q) => s + q[1], 0) / largest.length };
}

/*
 * 이름표 자리를 돌려줍니다. measure(scale, lines)는 그 글자 크기 · 줄 수일 때 이름표 크기 { w, h }(월드 px)입니다.
 * 결과: { x, y, scale, lines, fit } — fit이 "roof"면 지붕 안에 통째로 들어감, "center"면 대안(지붕 가운데).
 */
export function placeBuildingLabel(b, measure) {
  for (const [scale, lines] of [[1, 1], [0.8, 1], [1, 2], [0.8, 2]]) {
    const { w, h } = measure(scale, lines);
    const spot = nearestFit(b, w, h);
    if (spot) return { x: spot.x, y: spot.y, scale, lines, fit: "roof" };
  }
  const c = roofCenter(b);
  return { x: c.x, y: c.y, scale: 0.8, lines: 2, fit: "center" };
}

// 이름을 두 줄로 나눕니다(가운데에 가까운 띄어쓰기, 없으면 글자 수 절반).
export function splitTwoLines(name) {
  const text = name.replace(/\n/g, " ");
  const spaces = [...text.matchAll(/ /g)].map((m) => m.index);
  if (spaces.length) {
    const mid = text.length / 2;
    const at = spaces.reduce((p, q) => (Math.abs(q - mid) < Math.abs(p - mid) ? q : p));
    return `${text.slice(0, at)}\n${text.slice(at + 1)}`;
  }
  const half = Math.ceil(text.length / 2);
  return `${text.slice(0, half)}\n${text.slice(half)}`;
}

// 테스트용 크기 어림(게임에서는 실제 글자 크기를 잽니다): 한글 10px, 그 밖 6px, 좌우 여백 8px, 한 줄 16px
export function estimateLabelSize(name, scale, lines) {
  const text = lines === 2 ? splitTwoLines(name) : name.replace(/\n/g, " ");
  const longest = Math.max(...text.split("\n").map((line) => [...line].reduce((s, ch) => s + (/[가-힣]/.test(ch) ? 10 : 6), 0)));
  return { w: longest * scale + 8, h: (lines === 2 ? 28 : 16) * scale };
}

export { BUILDINGS };
