// 정문 기둥 · 현수막(맵 v2, src/gfx/campusGate.js · src/data/campusV2.js GATE)을 확인합니다. 기준: docs/GRAPHICS.md 0장 · 10장. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUILDINGS,
  BUILDING_BASE,
  CELL_PX,
  FEET,
  GATE,
  GRID_H,
  GRID_W,
  OPEN_SPACES,
  PASSAGES,
  SPAWN,
  WORLD_H,
  WORLD_W,
  cellWalkable,
  doorFrontOf,
  doorOf,
  fits,
  gateRects,
  isBlockedMat,
  isReachable,
  matAt,
  moveFeet,
  pathTo,
  pointInPolygon,
  quizSpots,
  walkGrid,
} from "../src/data/campusV2.js";
import { BANNER_LINES, CIRCLE_D, LINE_TOP, SLABS, SLAB_FROM, paintBanner, paintPillar, textWidth } from "../src/gfx/campusGate.js";
import { PALETTE } from "../src/gfx/campusV2Paint.js";
import { estimateLabelSize, liftClear, placeBuildingLabel } from "../src/data/buildingLabels.js";
import { guideTextRects } from "../src/data/guides.js";
import { WORLD } from "../src/data/world.js";
import { MARGIN, hudButtonRowRect, langButtonsRect, statusRect } from "../src/ui/hudLayout.js";
import { CAMERA_OFFSET_MAX, PAD_LIFT, cameraOffsetX, firstCamera, gateThings, padLayout, signThings, rectGap, sideHudRects, toScreen } from "../src/ui/firstScreen.js";

import { CAMERA_ZOOM } from "../src/ui/firstScreen.js"; // src/scenes/CampusScene.js와 같은 값
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (r, v) => r.x >= v.x && r.y >= v.y && r.x + r.w <= v.x + v.w && r.y + r.h <= v.y + v.h;
const gap = (a, b) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));
const gatehouse = BUILDINGS.find((b) => b.id === "gatehouse");
const plaza = OPEN_SPACES.find((s) => s.id === "gate");

test("정문 받침: 기둥마다 1m 칸 6×2개, 판정 격자에서 받침 칸만 더 막힘", () => {
  assert.equal(GATE.pillars.length, 2);
  for (const p of GATE.pillars) {
    assert.equal(p.cells.length, 12, "받침 칸 수");
    assert.equal(p.base.x1 - p.base.x0, 24, "받침 폭 6m");
    assert.equal(p.base.y1 - p.base.y0, 8, "받침 깊이 2m");
    for (const [i, j] of p.cells) assert.equal(cellWalkable(i, j), false, `(${i},${j}) 열림`);
  }
  // 판정 격자 = 재질로 정한 판정 + 받침 칸. 다른 칸은 하나도 바뀌지 않음
  const gateCells = new Set(GATE.pillars.flatMap((p) => p.cells.map(([i, j]) => j * GRID_W + i)));
  const walk = walkGrid();
  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      const byMat = !isBlockedMat(matAt(i * CELL_PX + 2, j * CELL_PX + 2));
      const k = j * GRID_W + i;
      if (!gateCells.has(k)) assert.equal(walk[k] === 1, byMat, `(${i},${j}) 받침이 아닌데 바뀜`);
    }
  }
  // 두 받침 사이(진입로 차도 · 양쪽 보도)는 받침 줄에서도 전부 열림
  const [west, east] = GATE.pillars;
  for (let i = west.base.x1 / 4; i < east.base.x0 / 4; i++) {
    for (let j = west.base.y0 / 4; j < west.base.y1 / 4; j++) assert.equal(cellWalkable(i, j), true, `두 기둥 사이 (${i},${j}) 막힘`);
  }
});

test("정문 자리: 진입로 가운데 선 기준 거울 대칭, 차도 · 양쪽 보도 통로 밖, 받침 바닥이 한 줄", () => {
  const [west, east] = GATE.pillars;
  const road = PASSAGES.find((p) => p.name === "정문 진입로(차도)").segPx[0][0];
  const westWalk = PASSAGES.find((p) => p.name === "정문 진입로(서쪽 보도)").segPx[0][0];
  const eastWalk = PASSAGES.find((p) => p.name === "정문 진입로(동쪽 보도)").segPx[0][0];
  assert.ok(Math.abs(west.base.x0 + east.base.x1 - 2 * road) <= 2 && Math.abs(west.base.x1 + east.base.x0 - 2 * road) <= 2, "거울 대칭");
  // 보도 통로 줄에서 발 상자(폭 10px)가 들어갈 만큼 떨어짐
  assert.ok(westWalk + FEET.left >= west.base.x1, "서쪽 보도를 받침이 막음");
  assert.ok(eastWalk + FEET.right <= east.base.x0, "동쪽 보도를 받침이 막음");
  assert.equal(west.base.y1, east.base.y1, "받침 바닥 y가 다름(현수막이 기울어짐)");
  for (const p of GATE.pillars) assert.deepEqual([p.rect.w, p.rect.h, p.rect.y], [24, 56, GATE.baseY - 54]);
  // 현수막은 두 기둥 안쪽 면 사이 + 양 끝 2px 물림, 받침 바닥에서 26~48px 위
  assert.equal(GATE.banner.x, west.rect.x + west.rect.w - 2);
  assert.equal(GATE.banner.x + GATE.banner.w, east.rect.x + 2);
  assert.deepEqual([GATE.banner.w, GATE.banner.h, GATE.banner.y], [108, 22, GATE.baseY - 48]);
});

// HUD가 덮는 화면 사각형(게임 화면 px). 11/27 PM 결정(이종헌): 미니맵(PC 232 · 휴대폰 194px) + 일일 퀘스트 창을 오른쪽 위로,
// 첫 화면에서 정문이 가리면 카메라를 가로로 옮김(src/ui/firstScreen.js cameraOffsetX), 휴대폰 방향키는 사이버관 팻말 화면 x에.
// 모든 자리는 실제 HUD가 쓰는 함수(hudLayout.js · firstScreen.js)로 계산하므로, 크기 · 자리를 바꿔 가리게 되면 이 테스트가 실패합니다.
// 학생 · 게스트 × 펼침 · 접힘 네 경우를 모두 봅니다. displayScale = 실제 화면 css 폭 / 게임 폭(휴대폰 검색창 · 터치 버튼 크기 계산).
const HUD_CASES = [
  { guest: false, collapsed: false },
  { guest: false, collapsed: true },
  { guest: true, collapsed: false },
  { guest: true, collapsed: true },
];
const SCREENS = [
  { name: "PC 960×540", W: 960, H: 540, touch: false, displayScale: 1 },
  { name: "미리보기 700×657(PC, 게임 960×540을 줄여 보임)", W: 960, H: 540, touch: false, displayScale: 700 / 960 },
  { name: "휴대폰 가로 844×390(게임 1169×540)", W: Math.round(540 * (844 / 390)), H: 540, touch: true, displayScale: 844 / 1169 },
  { name: "휴대폰 16:9", W: 960, H: 540, touch: true, displayScale: 0.75 },
  { name: "휴대폰 21:9", W: Math.round(540 * (21 / 9)), H: 540, touch: true, displayScale: 0.65 },
];
const offsetOf = (sc) => cameraOffsetX(sc);
const firstCam = (sc = SCREENS[0]) => firstCamera({ W: sc.W, H: sc.H, offset: offsetOf(sc) });
function hudRects(sc, { guest, collapsed }) {
  const rects = [
    { name: "상태창", ...statusRect(guest) },
    { name: "언어 버튼", ...langButtonsRect(sc.W) },
    { name: "오른쪽 아래 버튼 줄", ...hudButtonRowRect(sc) },
    ...sideHudRects({ ...sc, guest, collapsed }),
  ];
  const pad = padLayout(sc);
  if (pad) rects.push({ name: "방향키", ...pad.pad }, { name: "방향키 누르는 범위", ...pad.zone });
  return rects;
}
const gateScreenThings = (sc) => {
  const gh = { x: gatehouse.box.x0, y: gatehouse.box.y0, w: gatehouse.box.x1 - gatehouse.box.x0, h: gatehouse.box.y1 - gatehouse.box.y0, name: "정문안내실" };
  return [...gateThings(), gh];
};

test("첫 화면(SPAWN, 카메라 3배 + 가로 오프셋): 두 기둥 · 현수막 · 정문안내실 · '정문 안내실' · '정문 & 진입광장' 이름표가 화면 안이고 어떤 HUD(상태창 · 오른쪽 위 미니맵 · 일일 퀘스트 창 · 버튼 · 방향키)에도 안 가림(8px 여유)", () => {
  for (const sc of SCREENS) {
    const cam = firstCam(sc);
    for (const t of gateScreenThings(sc)) {
      assert.ok(inside(t, cam), `${sc.name}: ${t.name}이(가) 첫 화면 밖`);
      const s = toScreen(t, cam);
      for (const c of HUD_CASES) {
        const who = `${sc.name} ${c.guest ? "게스트" : "학생"} ${c.collapsed ? "접힘" : "펼침"}`;
        for (const h of hudRects(sc, c)) assert.ok(rectGap(s, h) >= 8, `${who}: ${t.name}이(가) ${h.name}에 가림 또는 8px 안으로 붙음 (${rectGap(s, h).toFixed(1)}px)`);
      }
    }
  }
  const player = { x: SPAWN.x - 8, y: SPAWN.y - 8, w: 16, h: 16 };
  for (const r of gateRects()) assert.ok(!overlap(player, r), "시작 위치 캐릭터가 정문 그림과 겹침");
});

test("첫 화면: 사이버관 '시설 안내문' 팻말(11/27 오후: 안내원 NPC 대신)이 화면 안이고 어떤 HUD(상태창 · 오른쪽 위 HUD · 방향키)에도 안 가림(8px 여유)", () => {
  const { art } = signThings();
  for (const sc of SCREENS) {
    const cam = firstCam(sc);
    assert.ok(inside(art, cam), `${sc.name}: ${art.name}이(가) 첫 화면 밖`);
    const s = toScreen(art, cam);
    for (const c of HUD_CASES) {
      const who = `${sc.name} ${c.guest ? "게스트" : "학생"} ${c.collapsed ? "접힘" : "펼침"}`;
      for (const h of hudRects(sc, c)) assert.ok(rectGap(s, h) >= 8, `${who}: ${art.name}이(가) ${h.name}에 가림 또는 8px 안으로 붙음 (${rectGap(s, h).toFixed(1)}px)`);
    }
  }
});

test("카메라 가로 오프셋: '가리는 만큼 + 8px'(1px 덜 옮기면 가림), 120px 이하, 안 가리는 화면(휴대폰 844×390 · 21:9)은 0", () => {
  const byName = Object.fromEntries(SCREENS.map((sc) => [sc.name, offsetOf(sc)]));
  for (const sc of SCREENS) {
    const off = offsetOf(sc);
    assert.ok(Number.isInteger(off) && off >= 0 && off <= CAMERA_OFFSET_MAX, `${sc.name}: 오프셋 ${off}px`);
    if (off === 0) continue;
    // 한 칸(1px) 덜 옮기면 정문 쪽 무엇인가가 펼친 일일 퀘스트 창 · 미니맵과 8px 안으로 붙어야 함(필요한 만큼만 옮김)
    const less = firstCamera({ W: sc.W, H: sc.H, offset: off - 1 });
    const huds = sideHudRects({ ...sc, guest: true, collapsed: false });
    const tight = gateThings().some((t) => huds.some((h) => rectGap(toScreen(t, less), h) < 8));
    assert.ok(tight, `${sc.name}: 오프셋 ${off}px가 필요보다 큼`);
  }
  assert.ok(byName["PC 960×540"] > 0, "PC는 오른쪽 위 HUD가 정문 동쪽을 가려 오프셋이 필요");
  assert.equal(byName["휴대폰 가로 844×390(게임 1169×540)"], 0);
  assert.equal(byName["휴대폰 21:9"], 0);
});

test("방향키: 휴대폰(터치)만 있고 PC에는 없음, 첫 화면에서 정중앙 x = 사이버관 팻말 화면 x(±1px), 아래에서 MARGIN + PAD_LIFT 위", () => {
  const { spot, art } = signThings();
  assert.deepEqual([spot.x, spot.y], [WORLD.buildings.find((b) => b.id === "cyber").sign.x, WORLD.buildings.find((b) => b.id === "cyber").sign.y], "게임에 그려지는 사이버관 팻말 자리와 같음");
  for (const sc of SCREENS) {
    const pad = padLayout(sc);
    if (!sc.touch) {
      assert.equal(pad, null, `${sc.name}: PC에 방향키가 생김`);
      continue;
    }
    const cam = firstCam(sc);
    const signX = (spot.x - cam.x) * CAMERA_ZOOM;
    // 팻말 x에 맞춘 자리가 정문 기둥을 가리는 화면만, 가리는 만큼 + 8px 왼쪽으로 비킴(shift). 그 밖에는 0
    assert.ok(Math.abs(pad.center.x - (signX - pad.shift)) <= 1, `${sc.name}: 방향키 중앙 ${pad.center.x} · 팻말 ${signX} · 비킴 ${pad.shift}`);
    const unshifted = { x: signX - pad.pad.w / 2, y: pad.pad.y, w: pad.pad.w, h: pad.pad.h };
    const westPillar = toScreen(gateRects()[0], cam);
    if (rectGap(unshifted, westPillar) >= 8) assert.equal(pad.shift, 0, `${sc.name}: 안 가리는데 비킴`);
    else assert.ok(Math.abs(rectGap({ ...pad.pad }, westPillar) - 8) < 0.01, `${sc.name}: 비킨 뒤 기둥과 ${rectGap(pad.pad, westPillar)}px(8px이어야 함)`);
    assert.equal(pad.pad.y + pad.pad.h, sc.H - MARGIN - PAD_LIFT);
    assert.equal(PAD_LIFT, 16);
    assert.ok(pad.pad.x >= MARGIN && pad.pad.x + pad.pad.w <= sc.W - MARGIN, `${sc.name}: 방향키가 화면 밖`);
    // 누르는 범위는 패드를 품고, 패드 가운데 기준(예전처럼 x = 0부터가 아님)
    const z = pad.zone;
    assert.ok(z.x <= pad.pad.x && z.x + z.w >= pad.pad.x + pad.pad.w && z.y <= pad.pad.y && z.y + z.h >= pad.pad.y + pad.pad.h, `${sc.name}: 누르는 범위가 패드를 다 품지 않음`);
    assert.ok(z.x > 0, `${sc.name}: 누르는 범위가 화면 왼쪽 끝(0)부터 시작함`);
    // 방향키 · 누르는 범위가 사이버관 팻말 · 정문 왼쪽 기둥 · 버튼 줄 · 일일 퀘스트 창과 8px 안 겹침
    const avoid = [
      { name: "사이버관 팻말", ...toScreen(art, cam) },
      { name: "정문 서쪽 기둥", ...toScreen(gateRects()[0], cam) },
      { name: "버튼 줄", ...hudButtonRowRect(sc) },
      ...HUD_CASES.flatMap((c) => sideHudRects({ ...sc, ...c })),
    ];
    for (const r of [{ name: "방향키", ...pad.pad }, { name: "누르는 범위", ...z }]) {
      for (const o of avoid) assert.ok(rectGap(r, o) >= 8, `${sc.name}: ${r.name}이(가) ${o.name}과(와) 8px 안으로 붙음 (${rectGap(r, o).toFixed(1)}px)`);
    }
  }
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
const hexAt = ({ w, data }, x, y) => `#${[0, 1, 2].map((k) => data[(y * w + x) * 4 + k].toString(16).padStart(2, "0")).join("")}`;
const alphaAt = ({ w, data }, x, y) => data[(y * w + x) * 4 + 3];

test("기둥 · 현수막 그림: 팔레트(GRAPHICS.md 0-4) 밖 색 없음, 반투명은 바닥 그림자(#2b3135, 35%)뿐", () => {
  for (const [name, img] of [["서쪽 기둥", paintPillar("west")], ["동쪽 기둥", paintPillar("east")], ["현수막", paintBanner()]]) {
    for (let y = 0; y < img.h; y++) {
      for (let x = 0; x < img.w; x++) {
        const a = alphaAt(img, x, y);
        const h = hexAt(img, x, y);
        if (a === 0) continue; // 비어 있는 칸(기둥 둘레)
        if (a === 255) assert.ok(allowed.has(h), `${name}: 팔레트 밖 색 ${h}`);
        else assert.deepEqual([h, a], [PALETTE.outline, Math.round(255 * 0.35)], `${name}: 반투명 (${x},${y})`);
      }
    }
  }
  // 현수막은 투명 · 반투명 픽셀 없이 꽉 참(글씨가 흐려질 일 없음)
  const banner = paintBanner();
  for (let o = 3; o < banner.data.length; o += 4) assert.equal(banner.data[o], 255);
});

test("기둥 모양: 진입로 쪽이 가장 높고 넓은 판, 바깥으로 낮아짐, 바깥으로 내려가는 경사 받침, 동 · 서 거울 대칭", () => {
  const west = paintPillar("west");
  const east = paintPillar("east");
  assert.deepEqual([west.w, west.h], [24, 56]);
  // 판 높이: 바깥 → 안쪽으로 커지고, 안쪽 판이 가장 넓음
  const heights = SLABS.map(([, h]) => h);
  const widths = SLABS.map(([w]) => w);
  assert.deepEqual([...heights].sort((a, b) => a - b), heights, "바깥 → 안쪽으로 높아져야 함");
  assert.equal(heights.at(-1), 54);
  assert.equal(Math.max(...widths), widths.at(-1), "안쪽 판이 가장 넓어야 함");
  // 그림에서 각 열의 맨 위(윤곽) 높이: 서쪽 기둥은 오른쪽(진입로 쪽)이 54, 바깥 끝은 받침만(낮음)
  const colTop = (img, x) => 54 - [...Array(54).keys()].find((y) => alphaAt(img, x, y) === 255);
  let x = SLAB_FROM;
  for (const [w, h] of SLABS) {
    assert.equal(colTop(west, x + 1), h, `서쪽 x=${x} 판 높이`);
    x += w;
  }
  assert.ok(colTop(west, 0) <= 4 && colTop(west, 23) === 54, "서쪽: 바깥 끝은 낮은 받침, 진입로 쪽이 가장 높음");
  // 거울: 동쪽 기둥 모양(불투명 칸)은 서쪽을 좌우로 뒤집은 것
  for (let y = 0; y < 56; y++) for (let x2 = 0; x2 < 24; x2++) assert.equal(alphaAt(east, x2, y) > 0, alphaAt(west, 23 - x2, y) > 0, `거울 (${x2},${y})`);
  // 빛은 뒤집지 않음: 두 기둥 모두 가장 높은 판 가운데 줄에서 왼쪽 면 밝고 오른쪽 면 어두움
  for (const [img, x0, x1] of [[west, 18, 22], [east, 1, 5]]) {
    assert.equal(hexAt(img, x0, 20), PALETTE.roof.white);
    assert.equal(hexAt(img, x1, 20), PALETTE.roofRim.gray);
  }
  // 경사 받침에 사선 줄무늬(어두운 색)가 길게 있음
  const stripes = [...Array(14).keys()].flatMap((dy) => [...Array(24).keys()].map((dx) => hexAt(west, dx, 40 + dy))).filter((c) => c === PALETTE.roofRim.gray).length;
  assert.ok(stripes >= 30, `받침 줄무늬 ${stripes}px`);
});

test("현수막 글씨: 두 줄, 글자 사이 1px · 단어 사이 3px, 원 · 테두리와 겹치지 않고 가운데", () => {
  assert.deepEqual(BANNER_LINES, ["Come to HUFS,", "Meet the world"]);
  assert.equal(textWidth("Come to HUFS,"), 65);
  assert.equal(textWidth("Meet the world"), 71);
  const img = paintBanner();
  const cols = [];
  const rows = new Set();
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (hexAt(img, x, y) === PALETTE.line) (cols.push(x), rows.add(y));
  const left = Math.min(...cols);
  const right = Math.max(...cols);
  assert.ok(left >= 2 + CIRCLE_D + 2 && right <= img.w - 1 - (2 + CIRCLE_D + 2), `글씨가 원과 겹침 ${left}~${right}`);
  assert.ok(Math.abs(left - (img.w - 1 - right)) <= 1, "글씨가 가운데가 아님");
  assert.ok(Math.min(...rows) >= 1 && Math.max(...rows) <= img.h - 2, "글씨가 테두리에 닿음");
  assert.deepEqual(LINE_TOP, [3, 12]);
});

// 정문안내실은 안내원 · 시설 소개가 없는 건물(11/25 결정, officeView.js GUIDE_EXCLUDED)이라 상호작용 = 입구 칸에 걸어가 닿는 것.
test("정문안내실: 입구(문 그림 자리 · 아래쪽 면)가 그대로고, 입구 칸이 열려 있으며 SPAWN에서 실제 이동 함수로 걸어가 닿음", () => {
  const door = doorOf(gatehouse);
  const front = doorFrontOf(gatehouse);
  assert.equal(matAt(door.x, door.y), BUILDING_BASE + gatehouse.index);
  assert.equal(door.face, "down");
  assert.ok(fits(front.x, front.y) && isReachable(front.x, front.y), "입구 앞에 못 감");
  const feet = { x: front.x + FEET.left, y: front.y + FEET.top, w: FEET.right - FEET.left, h: FEET.bottom - FEET.top };
  for (const p of GATE.pillars) assert.ok(!overlap(feet, { x: p.base.x0, y: p.base.y0, w: 24, h: 8 }), "입구 앞을 받침이 막음");
  // 문 자리 · 입구 앞 자리는 정문을 세우기 전 값(2026-11-27 main)과 같음
  assert.deepEqual([door.x, door.y, front.x, front.y], [1070, 1408, 1070, 1410]);
  assert.equal(WORLD.buildings.find((b) => b.id === "gatehouse").guide, null, "정문안내실에 안내원이 생김");
  assert.equal(WORLD.buildings.find((b) => b.id === "gatehouse").sign, null, "정문안내실에 팻말이 생김");
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

// 화면과 같은 방식으로 건물 이름표 크기를 어림(CampusScene.layoutNameTag)
const gateBoxes = () => gateRects().map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }));
function gatehouseTag(lang) {
  const name = lang === "en" ? gatehouse.nameEn : gatehouse.name;
  const two = lang === "en" ? name : gatehouse.mapName ?? name;
  const measure = (scale, lines) => estimateLabelSize(lines === 2 ? two : name, scale, lines);
  const spot = placeBuildingLabel(gatehouse, measure, [...guideTextRects(), ...gateBoxes()]);
  const { w, h } = measure(spot.scale, spot.lines);
  const y = liftClear(spot.x, spot.y, w, h, gateBoxes());
  return { x: spot.x - w / 2, y: y - h / 2, w, h, lift: spot.y - y };
}

test("정문안내실 이름표: 지붕 가운데 대안 자리가 정문 그림에 가리면 위로만 올려 겹치지 않음", () => {
  for (const lang of ["ko", "en"]) {
    const tag = gatehouseTag(lang);
    for (const r of gateRects()) assert.ok(!overlap(tag, r), `${lang}: 이름표가 정문 그림에 가림`);
    assert.ok(tag.lift <= 16, `${lang}: 이름표를 너무 많이 올림 ${tag.lift}px`);
  }
});

test("'정문 & 진입광장' 이름표: 광장 안, 현수막에서 16px 넘게 · 기둥과 안 겹침, 시작 캐릭터 · 정문안내실 이름표와 안 겹침", () => {
  const { w, h } = estimateLabelSize(plaza.name, 1, 1);
  const tag = { x: plaza.tag.x - w / 2, y: plaza.tag.y - h / 2, w, h };
  const [westR, eastR, banner] = gateRects();
  assert.ok(gap(tag, banner) >= 16, `현수막과 ${gap(tag, banner)}px`);
  assert.ok(gap(tag, westR) >= 8 && gap(tag, eastR) >= 8, "기둥에 붙음");
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    assert.ok(pointInPolygon([tag.x + dx * tag.w, tag.y + dy * tag.h], plaza.areaPolys[0]), "이름표가 광장 밖으로 나감");
  }
  assert.ok(!overlap(tag, { x: SPAWN.x - 8, y: SPAWN.y - 8, w: 16, h: 16 }), "시작 캐릭터를 가림");
  for (const lang of ["ko", "en"]) assert.ok(!overlap(tag, gatehouseTag(lang)), `${lang}: 정문안내실 이름표와 겹침`);
  assert.ok(inside(tag, firstCam()), "첫 화면 밖");
});

test("퀴즈 상자 후보: 정문 그림과 겹치는 자리는 빠지고(개수 확인), 나머지는 그대로", () => {
  const all = quizSpots({ skipGate: false });
  const kept = quizSpots();
  const removed = all.length - kept.length;
  assert.ok(removed > 0 && removed <= 40, `빠진 후보 ${removed}개`);
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
    pos = hold(pos, side, 0, 16);
    pos = hold(pos, 0, 1, 24);
    assert.ok(pos.y + FEET.bottom > GATE.baseY, `x ${p.base.x0}: 비킨 뒤에도 못 내려감 (${Math.round(pos.x)},${Math.round(pos.y)})`);
  }
});
