// 정문 기둥 · 현수막(맵 v2, src/gfx/campusGate.js · src/data/campusV2.js GATE)을 확인합니다. 기준: docs/GRAPHICS.md 0장. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUILDINGS,
  BUILDING_BASE,
  FEET,
  GATE,
  GRID_W,
  PASSAGES,
  SPAWN,
  WORLD_H,
  WORLD_W,
  cellWalkable,
  doorFrontOf,
  doorOf,
  fits,
  gateRects,
  isReachable,
  matAt,
  moveFeet,
  pathTo,
  quizSpots,
  walkGrid,
} from "../src/data/campusV2.js";
import { BANNER_LINES, CIRCLE_D, LINE_TOP, SLABS, paintBanner, paintPillar, textWidth } from "../src/gfx/campusGate.js";
import { PALETTE } from "../src/gfx/campusV2Paint.js";
import { estimateLabelSize, liftClear, placeBuildingLabel } from "../src/data/buildingLabels.js";
import { guideTextRects } from "../src/data/guides.js";
import { WORLD } from "../src/data/world.js";
// 정문안내실 입구 앞 자리 확인에 씀

const CAMERA_ZOOM = 3; // src/scenes/CampusScene.js
const VIEW = { w: 960 / CAMERA_ZOOM, h: 540 / CAMERA_ZOOM };
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (r, v) => r.x >= v.x && r.y >= v.y && r.x + r.w <= v.x + v.w && r.y + r.h <= v.y + v.h;
const gatehouse = BUILDINGS.find((b) => b.id === "gatehouse");

test("정문 받침: 기둥마다 1m 칸 4×2개만 막히고, 받침 바로 옆 · 사이 칸은 열려 있음", () => {
  assert.equal(GATE.pillars.length, 2);
  for (const p of GATE.pillars) {
    assert.equal(p.cells.length, 8, "받침 칸 수");
    assert.equal(p.base.x1 - p.base.x0, 16, "받침 폭 4m");
    assert.equal(p.base.y1 - p.base.y0, 8, "받침 깊이 2m");
    for (const [i, j] of p.cells) assert.equal(cellWalkable(i, j), false, `(${i},${j}) 열림`);
    // 받침 바로 위(캠퍼스 안쪽) · 아래(이문로 쪽) 칸은 바닥 그대로(받침 때문에 막히지 않음)
    const j0 = p.base.y0 / 4;
    const j1 = p.base.y1 / 4 - 1;
    for (let i = p.base.x0 / 4; i < p.base.x1 / 4; i++) {
      assert.equal(cellWalkable(i, j0 - 1), true, `받침 위 (${i},${j0 - 1}) 막힘`);
      assert.equal(cellWalkable(i, j1 + 1), true, `받침 아래 (${i},${j1 + 1}) 막힘`);
    }
  }
  // 두 받침 사이(진입로 차도 · 양쪽 보도)는 받침 줄에서도 전부 열림
  const [west, east] = GATE.pillars;
  for (let i = west.base.x1 / 4; i < east.base.x0 / 4; i++) {
    for (let j = west.base.y0 / 4; j < west.base.y1 / 4; j++) assert.equal(cellWalkable(i, j), true, `두 기둥 사이 (${i},${j}) 막힘`);
  }
  // 막힌 칸이 정확히 받침 16칸만 늘었는지: 받침 칸을 빼면 재질로만 정한 판정과 같음
  const gateCells = new Set(GATE.pillars.flatMap((p) => p.cells.map(([i, j]) => j * GRID_W + i)));
  const walk = walkGrid();
  let extra = 0;
  for (const k of gateCells) if (!walk[k]) extra++;
  assert.equal(extra, 16);
});

test("정문 자리: 진입로 가운데 선 기준 좌우 대칭, 차도 · 양쪽 보도 통로 밖, 받침 바닥이 한 줄", () => {
  const [west, east] = GATE.pillars;
  const road = PASSAGES.find((p) => p.name === "정문 진입로(차도)").segPx[0][0];
  const westWalk = PASSAGES.find((p) => p.name === "정문 진입로(서쪽 보도)").segPx[0][0];
  const eastWalk = PASSAGES.find((p) => p.name === "정문 진입로(동쪽 보도)").segPx[0][0];
  assert.ok(Math.abs((west.base.x0 + west.base.x1) / 2 + (east.base.x0 + east.base.x1) / 2 - 2 * road) <= 2, "좌우 대칭");
  // 보도 통로 줄에서 발 상자(폭 10px)가 들어갈 만큼 떨어짐
  assert.ok(westWalk + FEET.left >= west.base.x1, "서쪽 보도를 받침이 막음");
  assert.ok(eastWalk + FEET.right <= east.base.x0, "동쪽 보도를 받침이 막음");
  assert.equal(west.base.y1, east.base.y1, "받침 바닥 y가 다름(현수막이 기울어짐)");
  assert.deepEqual([GATE.banner.w, GATE.banner.h], [116, 22]);
  assert.equal(GATE.banner.y, GATE.baseY - 48);
  for (const p of GATE.pillars) assert.deepEqual([p.rect.w, p.rect.h, p.rect.y], [16, 56, GATE.baseY - 54]);
});

test("첫 화면(SPAWN, 카메라 3배)에 기둥 · 현수막 · 정문안내실이 모두 보이고, 캐릭터는 정문 그림에 가리지 않음", () => {
  const cam = {
    x: Math.min(Math.max(SPAWN.x - VIEW.w / 2, 0), WORLD_W - VIEW.w),
    y: Math.min(Math.max(SPAWN.y - VIEW.h / 2, 0), WORLD_H - VIEW.h),
    ...VIEW,
  };
  for (const r of gateRects()) assert.ok(inside(r, cam), `화면 밖: ${JSON.stringify(r)}`);
  const gh = { x: gatehouse.box.x0, y: gatehouse.box.y0, w: gatehouse.box.x1 - gatehouse.box.x0, h: gatehouse.box.y1 - gatehouse.box.y0 };
  assert.ok(inside(gh, cam), "정문안내실이 첫 화면 밖");
  const player = { x: SPAWN.x - 8, y: SPAWN.y - 8, w: 16, h: 16 };
  for (const r of gateRects()) assert.ok(!overlap(player, r), "시작 위치 캐릭터가 정문 그림과 겹침");
});

test("깊이: 캐릭터 · 안내원 · 퀴즈 상자(깊이 = 가운데 y)와 같은 기준 — 받침 바로 아래는 앞, 바로 위는 뒤", () => {
  assert.equal(GATE.depth, GATE.baseY - FEET.bottom);
  const p = GATE.pillars[0];
  const x = (p.base.x0 + p.base.x1) / 2;
  const front = p.base.y1 - FEET.top; // 발 상자 윗변이 받침 바닥에 닿은 자리(바깥)
  const back = p.base.y0 - FEET.bottom; // 발 상자 아랫변이 받침 윗변에 닿은 자리(안쪽)
  assert.ok(fits(x, front) && fits(x, back), "받침 앞뒤에 설 수 있어야 함");
  assert.ok(front > GATE.depth, "받침 앞 캐릭터가 기둥 뒤에 그려짐");
  assert.ok(back < GATE.depth, "받침 뒤 캐릭터가 기둥 앞에 그려짐");
});

const allowed = new Set(
  [
    PALETTE.roof.white,
    PALETTE.roof.gray,
    PALETTE.roofRim.gray,
    PALETTE.eave,
    PALETTE.outline,
    PALETTE.bannerBlue,
    PALETTE.bannerEdge,
    PALETTE.bannerYellow,
    PALETTE.bannerYellowEdge,
    PALETTE.line,
  ].map((h) => h.toLowerCase()),
);
const colorsOf = ({ data }) => {
  const seen = new Map();
  for (let o = 0; o < data.length; o += 4) {
    const h = `#${[0, 1, 2].map((k) => data[o + k].toString(16).padStart(2, "0")).join("")}`;
    const key = `${h}/${data[o + 3]}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return seen;
};

test("기둥 · 현수막 그림: 팔레트(GRAPHICS.md 0-4) 밖 색 없음, 반투명은 바닥 그림자(#2b3135, 35%)뿐", () => {
  for (const [name, img] of [["기둥", paintPillar()], ["현수막", paintBanner()]]) {
    for (const key of colorsOf(img).keys()) {
      const [h, a] = key.split("/");
      if (a === "0") continue; // 비어 있는 칸(기둥 둘레)
      if (a === "255") assert.ok(allowed.has(h), `${name}: 팔레트 밖 색 ${h}`);
      else assert.deepEqual([h, a], [PALETTE.outline, String(Math.round(255 * 0.35))], `${name}: 반투명 ${key}`);
    }
  }
  // 현수막은 투명 · 반투명 픽셀 없이 꽉 참(글씨가 흐려질 일 없음)
  const banner = paintBanner();
  for (let o = 3; o < banner.data.length; o += 4) assert.equal(banner.data[o], 255);
});

test("기둥 모양: 판 5장 3·3·4·3·3px, 높이 38·46·54·46·38(가운데 최고), 왼쪽 면 밝고 오른쪽 면 어두움", () => {
  assert.deepEqual(SLABS, [[3, 38], [3, 46], [4, 54], [3, 46], [3, 38]]);
  const { w, h, data } = paintPillar();
  assert.deepEqual([w, h], [16, 56]);
  const at = (x, y) => `#${[0, 1, 2].map((k) => data[(y * w + x) * 4 + k].toString(16).padStart(2, "0")).join("")}`;
  const alpha = (x, y) => data[(y * w + x) * 4 + 3];
  // 각 판의 맨 위 칸(윤곽) 높이
  let x = 0;
  for (const [sw, sh] of SLABS) {
    const top = [...Array(54).keys()].find((y) => alpha(x + 1, y) === 255);
    assert.equal(54 - top, sh, `x=${x} 판 높이`);
    x += sw;
  }
  // 가운데 판(높이 54) 가운데 줄: 왼쪽 밝은 면, 오른쪽 어두운 면
  assert.equal(at(6, 20), PALETTE.roof.white);
  assert.equal(at(9, 20), PALETTE.roofRim.gray);
  // 받침에 사선 줄무늬(어두운 색)가 있음
  const stripes = [...Array(10).keys()].flatMap((dy) => [...Array(16).keys()].map((dx) => at(dx, 44 + dy))).filter((c) => c === PALETTE.roofRim.gray).length;
  assert.ok(stripes >= 20, `받침 줄무늬 ${stripes}px`);
});

test("현수막 글씨: 두 줄, 글자 사이 1px · 단어 사이 3px, 원 · 테두리와 겹치지 않고 가운데", () => {
  assert.deepEqual(BANNER_LINES, ["Come to HUFS,", "Meet the world"]);
  assert.equal(textWidth("Come to HUFS,"), 65);
  assert.equal(textWidth("Meet the world"), 71);
  const { w, h, data } = paintBanner();
  const text = (x, y) => data[(y * w + x) * 4] === 0xf2 && data[(y * w + x) * 4 + 1] === 0xf0;
  const cols = [];
  const rows = new Set();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (text(x, y)) (cols.push(x), rows.add(y));
  const left = Math.min(...cols);
  const right = Math.max(...cols);
  assert.ok(left >= 2 + CIRCLE_D + 2 && right <= w - 1 - (2 + CIRCLE_D + 2), `글씨가 원과 겹침 ${left}~${right}`);
  assert.ok(Math.abs(left - (w - 1 - right)) <= 1, "글씨가 가운데가 아님");
  assert.ok(Math.min(...rows) >= 1 && Math.max(...rows) <= h - 2, "글씨가 테두리에 닿음");
  assert.deepEqual(LINE_TOP, [3, 12]);
});

// 정문안내실은 안내원 · 시설 소개가 없는 건물(11/25 결정, officeView.js GUIDE_EXCLUDED)이라 상호작용 = 입구 칸에 걸어가 닿는 것.
test("정문안내실: 입구(문 그림 자리 · 아래쪽 면)가 그대로고, 입구 칸이 열려 있으며 SPAWN에서 실제 이동 함수로 걸어가 닿음", () => {
  const door = doorOf(gatehouse);
  const front = doorFrontOf(gatehouse);
  assert.equal(matAt(door.x, door.y), BUILDING_BASE + gatehouse.index);
  assert.equal(door.face, "down");
  assert.ok(fits(front.x, front.y) && isReachable(front.x, front.y), "입구 앞에 못 감");
  // 입구 앞 칸은 받침 칸이 아님
  const feet = { x: front.x + FEET.left, y: front.y + FEET.top, w: FEET.right - FEET.left, h: FEET.bottom - FEET.top };
  for (const p of GATE.pillars) assert.ok(!overlap(feet, { x: p.base.x0, y: p.base.y0, w: 16, h: 8 }), "입구 앞을 받침이 막음");
  // 문 자리 · 입구 앞 자리는 정문을 세우기 전 값(2026-11-27 main)과 같음
  assert.deepEqual([door.x, door.y, front.x, front.y], [1070, 1408, 1070, 1410]);
  assert.equal(WORLD.buildings.find((b) => b.id === "gatehouse").guide, null, "정문안내실에 안내원이 생김");
  // 실제 이동 함수로 SPAWN → 입구 앞
  let pos = { ...SPAWN };
  for (const wp of pathTo(front.x, front.y)) {
    for (let n = 0; n < 200 && Math.hypot(wp.x - pos.x, wp.y - pos.y) > 0.01; n++) {
      const len = Math.hypot(wp.x - pos.x, wp.y - pos.y);
      const s = Math.min(1.5, len);
      pos = moveFeet(pos.x, pos.y, ((wp.x - pos.x) / len) * s, ((wp.y - pos.y) / len) * s);
    }
  }
  assert.ok(Math.hypot(pos.x - front.x, pos.y - front.y) < 0.5, `입구 앞 도착 못 함 (${pos.x},${pos.y})`);
});

test("정문안내실 이름표: 지붕 가운데 대안 자리가 정문 그림에 가리면 위로만 올려 겹치지 않음", () => {
  const gate = gateRects().map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }));
  for (const lang of ["ko", "en"]) {
    const name = lang === "en" ? gatehouse.nameEn : gatehouse.name;
    const two = lang === "en" ? name : gatehouse.mapName ?? name;
    const measure = (scale, lines) => estimateLabelSize(lines === 2 ? two : name, scale, lines);
    const spot = placeBuildingLabel(gatehouse, measure, [...guideTextRects(), ...gate]);
    const { w, h } = measure(spot.scale, spot.lines);
    const y = liftClear(spot.x, spot.y, w, h, gate);
    const tag = { x: spot.x - w / 2, y: y - h / 2, w, h };
    for (const r of gateRects()) assert.ok(!overlap(tag, r), `${lang}: 이름표가 정문 그림에 가림`);
    assert.ok(spot.y - y <= 16, `${lang}: 이름표를 너무 많이 올림 ${spot.y - y}px`);
  }
});

test("퀴즈 상자 후보: 정문 그림과 겹치는 자리는 빠지고(개수 확인), 나머지는 그대로", () => {
  const all = quizSpots({ skipGate: false });
  const kept = quizSpots();
  const removed = all.length - kept.length;
  assert.ok(removed > 0 && removed <= 30, `빠진 후보 ${removed}개`);
  for (const { x, y } of kept) for (const r of gateRects()) assert.ok(!overlap({ x: x - 8, y: y - 10, w: 16, h: 18 }, r), `(${x},${y}) 정문 그림과 겹침`);
});

// 같은 방향 키를 누른 채 n프레임(프레임당 1.5px) 걷기
const hold = (pos, dx, dy, n) => {
  for (let i = 0; i < n; i++) pos = moveFeet(pos.x, pos.y, dx * 1.5, dy * 1.5);
  return pos;
};

test("끼임 방지: SPAWN에서 아래 키만 눌러 이문로 쪽 광장 끝까지 갔다가 위 키로 돌아옴", () => {
  let pos = hold({ ...SPAWN }, 0, 1, 200);
  assert.ok(pos.y > GATE.baseY + 8, `정문 밖으로 못 나감 (y ${Math.round(pos.y)})`);
  pos = hold(pos, 0, -1, 200);
  assert.ok(pos.y <= SPAWN.y, `돌아오다 걸림 (y ${Math.round(pos.y)})`);
});

test("끼임 방지: 기둥 안쪽 옆을 위아래로 지나가고, 기둥 바로 위에서 아래 키만 눌러도 비켜서 빠져나감", () => {
  const [west, east] = GATE.pillars;
  // 기둥 바로 옆(발 상자가 받침에 1px 떨어진 줄)을 똑바로 내려가 발이 받침 바닥 줄을 지나고, 다시 올라옴.
  // (광장 아래 이문로 쪽 띠는 진입로 폭만 열려 있어 기둥 옆 줄은 받침 바닥 바로 아래까지가 끝입니다.)
  for (const x of [west.base.x1 - FEET.left + 1, east.base.x0 - FEET.right - 1]) {
    let pos = { x, y: GATE.baseY - 40 };
    assert.ok(fits(pos.x, pos.y));
    pos = hold(pos, 0, 1, 24);
    assert.ok(pos.y + FEET.bottom > GATE.baseY && Math.abs(pos.x - x) < 0.01, `x ${x}: 기둥 옆을 내려가다 걸림 (${pos.x},${pos.y})`);
    // 위로는 받침 윗줄을 지날 만큼만(동쪽은 더 올라가면 정문안내실 벽)
    pos = hold(pos, 0, -1, 16);
    assert.ok(pos.y + FEET.bottom < west.base.y0 && Math.abs(pos.x - x) < 0.01, `x ${x}: 기둥 옆을 올라가다 걸림 (${pos.x},${pos.y})`);
  }
  // 기둥 바로 위에서 아래 키: 다른 건물 벽처럼 받침 윗줄에서 멈춤(통과하지 않음). 진입로 쪽으로 비킨 뒤 아래 키면 지나감(끼이지 않음).
  for (const [p, side] of [[west, 1], [east, -1]]) {
    let pos = hold({ x: (p.base.x0 + p.base.x1) / 2, y: p.base.y0 - FEET.bottom - 10 }, 0, 1, 40);
    assert.ok(pos.y + FEET.bottom <= p.base.y0 + 0.01, `x ${p.base.x0}: 받침을 뚫고 들어감 (${pos.x},${pos.y})`);
    pos = hold(pos, side, 0, 12);
    pos = hold(pos, 0, 1, 24);
    assert.ok(pos.y + FEET.bottom > GATE.baseY, `x ${p.base.x0}: 비킨 뒤에도 못 내려감 (${Math.round(pos.x)},${Math.round(pos.y)})`);
  }
});
