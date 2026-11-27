// "시설 안내문" 팻말(13곳)과 스탬프 랠리 부스(4곳) 자리 · 크기(src/data/stampRallySpots.js)를 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BUILDINGS,
  BUILDING_BASE,
  CELL_PX,
  GRID_W,
  MAT,
  PASSAGES,
  QUIZ_LABEL_CLEAR,
  SPAWN,
  WORLD_H,
  WORLD_W,
  doorArtRect,
  doorFrontOf,
  doorOf,
  fits,
  gateRects,
  isReachable,
  matAt,
  moveFeet,
  quizBoxRect,
  quizSpots,
  reachable,
} from "../src/data/campusV2.js";
import { WORLD } from "../src/data/world.js";
import {
  BOOTH_BASE,
  BOOTH_FULL,
  BOOTH_SCALE,
  BOOTH_SIGN_DISTANCE_RATIO,
  BOOTH_SIGN_DISTANCE_TOLERANCE,
  BOOTH_TALK,
  DOOR_ART_CLEAR,
  RALLY_SPOTS_BEFORE,
  SIGN_ALONG,
  SIGN_FOOT,
  SIGN_FULL,
  SIGN_SCALE,
  WALL_GAP,
  boothArtRect,
  boothDistanceExceptions,
  boothRect,
  boothTalkPoint,
  distanceBefore,
  feetHitBooth,
  feetHitSign,
  rallySpotsOf,
  rallyStops,
  signArtRect,
  signBlockRect,
  signSpotOf,
  signTalkPoint,
  signWallDistance,
} from "../src/data/stampRallySpots.js";
import { buildingTagRect, estimateLabelSize } from "../src/data/buildingLabels.js";
import { GUIDE_RANGE, nearestOfficePlace, officeSpot } from "../src/ui/officeView.js";
import { STAMP_RALLY_IDS } from "../shared/stampRally.js";

const stops = rallyStops();
const signed = WORLD.buildings.filter((b) => b.sign);
const byId = (id) => BUILDINGS.find((b) => b.id === id);
const NOT_TARGETS = ["cyber", "gatehouse", "flc"];
const hit = (a, b, pad = 0) => a.x0 < b.x1 + pad && b.x0 - pad < a.x1 && a.y0 < b.y1 + pad && b.y0 - pad < a.y1;
const blockedByAll = (x, y) => signed.some((b) => feetHitSign(x, y, b.sign) || (b.booth && feetHitBooth(x, y, b.booth)));
// 1.5배를 못 맞춘 건물(가장 가까운 자리로 둠, PR에 보고): 인문과학관 — 문 왼쪽 아래가 수풀 · 차도로 막혀 109px(목표 121.5px)
const DISTANCE_EXCEPTIONS = ["humanities"];

test("부스는 스탬프 랠리 4곳에만, 팻말은 시설 소개가 있는 13곳에(사이버관 · 외국어연수평가원은 팻말만, 정문안내실 · 열린 공간에는 없음)", () => {
  assert.deepEqual(WORLD.buildings.filter((b) => b.booth).map((b) => b.id).sort(), [...STAMP_RALLY_IDS].sort());
  assert.equal(signed.length, 13);
  for (const id of ["cyber", "flc"]) {
    const b = WORLD.buildings.find((x) => x.id === id);
    assert.equal(b.booth, null, id);
    assert.ok(b.sign, `${id}: 팻말`);
    assert.equal(rallySpotsOf(byId(id)), null, id);
  }
  const gatehouse = WORLD.buildings.find((x) => x.id === "gatehouse");
  assert.deepEqual([gatehouse.sign, gatehouse.booth, signSpotOf(byId("gatehouse"))], [null, null, null]);
  assert.ok(WORLD.openSpaces.every((s) => !s.booth && !s.sign), "정문 & 진입광장 등 열린 공간");
  assert.ok(NOT_TARGETS.every((id) => !STAMP_RALLY_IDS.includes(id)));
});

test("[Enter] 시설 소개는 모든 건물에서 팻말에서 열림(예전 안내원과 같은 거리 GUIDE_RANGE), 정문안내실은 안 열림", () => {
  for (const b of signed) {
    assert.equal(b.guide, null, `${b.id}: 안내원 NPC 없음`);
    assert.deepEqual(officeSpot(b), b.sign);
    const talk = signTalkPoint(b.sign);
    assert.equal(nearestOfficePlace(WORLD.buildings, talk.x, talk.y)?.id, b.id, `${b.id}: 팻말 앞에서 열림`);
    assert.equal(nearestOfficePlace([b], b.sign.x + GUIDE_RANGE + 4, b.sign.y), null);
  }
  const front = doorFrontOf(byId("gatehouse"));
  assert.notEqual(nearestOfficePlace(WORLD.buildings, front.x, front.y)?.id, "gatehouse");
});

test("팻말 · 부스 그림은 예전의 80%: 그림 칸 · 충돌 칸도 같은 배율, 화면에도 SIGN_SCALE · BOOTH_SCALE로 그림", () => {
  assert.deepEqual([SIGN_SCALE, BOOTH_SCALE], [0.8, 0.8]);
  const at = { x: 100, y: 100 };
  const round = (v) => Math.round(v * 100) / 100;
  const size = (r) => [r.x1 - r.x0, r.y1 - r.y0].map(round);
  // 80%로 줄이기 전: 부스 바닥 40×13, 부스 그림 칸 68×60, 팻말 그림 칸 56×32, 팻말 충돌 칸 10×7
  assert.deepEqual(size(boothRect(at)), [40 * 0.8, 13 * 0.8].map(round));
  assert.deepEqual(size(boothArtRect(at)), [68 * 0.8, 60 * 0.8].map(round));
  assert.deepEqual(size(signArtRect(at)), [56 * 0.8, 32 * 0.8].map(round));
  assert.deepEqual(size(signBlockRect(at)), [10 * 0.8, 7 * 0.8].map(round));
  assert.deepEqual(BOOTH_BASE, { left: -16, right: 16, top: -6.4, bottom: 4 });
  assert.deepEqual([BOOTH_FULL.base.left, BOOTH_FULL.artHalfW, SIGN_FULL.halfW, SIGN_FULL.foot], [-20, 34, 28, 8]);
  assert.equal(SIGN_FOOT, 8 * 0.8);
  assert.equal(BOOTH_TALK.dy, Math.round(14 * 0.8));
  const scene = readFileSync(new URL("../src/scenes/CampusScene.js", import.meta.url), "utf8");
  assert.match(scene, /\.setScale\(texture\.scale \* SIGN_SCALE\)/, "팻말 그림 배율");
  assert.match(scene, /BOOTH_SIZE\.h\)\s*\.setScale\(BOOTH_SCALE\)/, "부스 그림 배율");
});

test("팻말은 문과 같은 외벽에 바짝 붙음(기둥 밑동이 외벽에서 4px 안), 문과 같은 방향, 문에서 16~48px 옆. Minerva Complex만 예외 자리", () => {
  const fronts = BUILDINGS.map(doorFrontOf).filter(Boolean);
  assert.deepEqual(signed.filter((b) => !b.sign.attached).map((b) => b.id), ["minerva"]);
  assert.equal(WALL_GAP, 2, "기둥 밑동과 외벽 사이");
  for (const b of signed.filter((x) => x.sign.attached)) {
    const raw = byId(b.id);
    const { sign } = b;
    const front = doorFrontOf(raw);
    assert.equal(sign.face, doorOf(raw).face, `${b.id}: 팻말 방향 = 문 방향`);
    const wall = signWallDistance(raw, sign);
    assert.ok(wall >= 1 && wall <= WALL_GAP + 2, `${b.id}: 기둥 밑동이 외벽에서 ${wall}px`);
    const vertical = sign.face === "left" || sign.face === "right";
    const along = Math.abs(vertical ? sign.y - (front.y - SIGN_FOOT / 2 + 0) : sign.x - front.x);
    assert.ok(SIGN_ALONG.includes(sign.along) && sign.along >= 16 && sign.along <= 48, `${b.id}: 문에서 ${sign.along}px 옆`);
    assert.ok(Math.abs(along - sign.along) <= 8, `${b.id}: 문 앞 줄에서 ${along}px`);
    // 그림(판)이 건물과 일부 겹침 = 외벽에 붙었다는 뜻
    const art = signArtRect(sign);
    let onBuilding = 0;
    for (let y = art.y0; y < art.y1; y += 2) for (let x = art.x0; x < art.x1; x += 2) if (matAt(Math.floor(x), Math.floor(y)) === BUILDING_BASE + raw.index) onBuilding += 1;
    // 위쪽 면 문(교수회관)은 팻말이 건물 위 끝 바로 앞에 서므로 그림이 건물과 겹치지 않음(기둥 밑동 거리로만 확인)
    if (sign.face !== "up") assert.ok(onBuilding > 0, `${b.id}: 팻말 그림이 건물에서 떨어져 있음`);
    // 팻말 앞에 말을 걸 칸이 있고, 문 앞 칸을 막지 않음
    const talk = signTalkPoint(sign);
    assert.ok(talk && fits(talk.x, talk.y) && isReachable(talk.x, talk.y) && !feetHitSign(talk.x, talk.y, sign), `${b.id}: 팻말 앞에 설 칸이 없음`);
    for (const f of fronts) assert.ok(!feetHitSign(f.x, f.y, sign), `${b.id}: 팻말이 문 앞 칸을 막음`);
  }
});

test("부스: 문을 사이에 두고 팻말 반대쪽, 바닥 전체가 걸을 수 있는 칸이고 차도 · 건널목 · 주차장이 아님, 문 앞 · 팻말을 덮지 않고 앞에 설 자리가 있음", () => {
  const fronts = BUILDINGS.map(doorFrontOf).filter(Boolean);
  for (const { id, building, sign, booth } of stops) {
    const front = doorFrontOf(building);
    const vertical = sign.face === "left" || sign.face === "right";
    const side = (p) => Math.sign(vertical ? p.y - front.y : p.x - front.x);
    assert.equal(side(booth), -sign.side, `${id}: 팻말과 부스가 문의 같은 쪽`);
    assert.equal(booth.side, -sign.side);
    const r = boothRect(booth);
    for (let y = r.y0; y <= r.y1; y += 2) {
      for (let x = r.x0; x <= r.x1; x += 2) {
        const m = matAt(x, y);
        assert.ok(m < BUILDING_BASE && ![MAT.road, MAT.crosswalk, MAT.parking, MAT.outerRoad, MAT.outside, MAT.forest, MAT.water].includes(m), `${id}: 부스 바닥 (${x}, ${y}) 재질 ${m}`);
      }
    }
    for (const f of fronts) assert.ok(!feetHitBooth(f.x, f.y, booth), `${id}: 부스가 문 앞 칸을 덮음`);
    assert.ok(!hit(boothArtRect(booth), signArtRect(sign)), `${id}: 부스 그림이 팻말 그림과 겹침`);
    const talk = boothTalkPoint(booth);
    assert.ok(fits(talk.x, talk.y) && isReachable(talk.x, talk.y) && !blockedByAll(talk.x, talk.y), `${id}: 부스 앞에 설 자리가 없음`);
  }
});

test("부스 ↔ 팻말 거리: 예전(RALLY_SPOTS_BEFORE)의 1.5배(±4px). 예외 건물은 목록에 있고 예전보다는 멀어짐", () => {
  assert.equal(BOOTH_SIGN_DISTANCE_RATIO, 1.5);
  assert.deepEqual(Object.keys(RALLY_SPOTS_BEFORE).sort(), [...STAMP_RALLY_IDS].sort());
  assert.deepEqual(boothDistanceExceptions(), DISTANCE_EXCEPTIONS);
  for (const { id, sign, booth } of stops) {
    const before = distanceBefore(id);
    const now = Math.hypot(sign.x - booth.x, sign.y - booth.y);
    assert.ok(Math.abs(now - booth.distance) < 0.01);
    if (DISTANCE_EXCEPTIONS.includes(id)) {
      assert.ok(now > before * 1.2 && now < before * 1.5, `${id}(예외): ${before.toFixed(1)} → ${now.toFixed(1)}px`);
    } else {
      assert.ok(Math.abs(now - before * 1.5) <= BOOTH_SIGN_DISTANCE_TOLERANCE, `${id}: ${before.toFixed(1)} → ${now.toFixed(1)}px (목표 ${(before * 1.5).toFixed(1)})`);
    }
  }
});

test("팻말 · 부스를 막아도 캠퍼스에서 끊기는 곳이 없음(모든 문 앞 · 요구된 통로가 그대로 이어짐)", () => {
  const key = (x, y) => ((y - 2) / CELL_PX) * GRID_W + (x - 2) / CELL_PX;
  const seen = new Uint8Array(GRID_W * (WORLD_H / CELL_PX));
  const queue = [[SPAWN.x, SPAWN.y]];
  seen[key(SPAWN.x, SPAWN.y)] = 1;
  for (let q = 0; q < queue.length; q++) {
    const [x, y] = queue[q];
    for (const [dx, dy] of [[CELL_PX, 0], [-CELL_PX, 0], [0, CELL_PX], [0, -CELL_PX]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WORLD_W || ny >= WORLD_H || seen[key(nx, ny)] || !fits(nx, ny) || blockedByAll(nx, ny)) continue;
      seen[key(nx, ny)] = 1;
      queue.push([nx, ny]);
    }
  }
  const lost = reachable().list.filter(({ x, y }) => !seen[key(x, y)] && !blockedByAll(x, y));
  assert.equal(lost.length, 0, `끊긴 칸 ${lost.length}개, 예: ${JSON.stringify(lost.slice(0, 3))}`);
  for (const b of BUILDINGS) {
    const f = doorFrontOf(b);
    if (f) assert.ok(seen[key(f.x, f.y)], `${b.id}: 문 앞에 못 감`);
  }
  const snap = (v) => Math.floor(v / CELL_PX) * CELL_PX + CELL_PX / 2;
  for (const { name, segPx } of PASSAGES) {
    const [[x0, y0], [x1, y1]] = segPx;
    for (let i = 0; i <= 20; i++) {
      const x = snap(x0 + ((x1 - x0) * i) / 20);
      const y = snap(y0 + ((y1 - y0) * i) / 20);
      assert.ok(!stops.some((s) => feetHitBooth(x, y, s.booth)), `${name}: (${x}, ${y})가 부스에 막힘`);
    }
  }
});

test("팻말 · 부스는 통과할 수 없음(이동 판정)", () => {
  for (const { id, booth } of stops) {
    const r = boothRect(booth);
    let p = boothTalkPoint(booth);
    for (let i = 0; i < 30; i++) p = moveFeet(p.x, p.y, 0, -2, blockedByAll);
    assert.ok(!feetHitBooth(p.x, p.y, booth) && p.y > r.y1 - 8, `${id}: 부스를 뚫고 지나감 (${p.x}, ${p.y})`);
  }
  for (const b of signed) {
    const out = { down: [0, 1], up: [0, -1], right: [1, 0], left: [-1, 0] }[b.sign.face];
    let q = signTalkPoint(b.sign);
    for (let i = 0; i < 20; i++) q = moveFeet(q.x, q.y, -out[0] * 2, -out[1] * 2, blockedByAll);
    assert.ok(!feetHitSign(q.x, q.y, b.sign), `${b.id}: 팻말을 뚫고 지나감`);
  }
});

test("정문 기둥 · 현수막(#114)과 겹치지 않음: 팻말 · 부스 그림이 정문 그림에서 떨어져 있음", () => {
  const gate = gateRects().map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }));
  for (const b of signed) {
    for (const r of gate) {
      assert.ok(!hit(signArtRect(b.sign), r), `${b.id}: 팻말이 정문 그림과 겹침`);
      if (b.booth) assert.ok(!hit(boothArtRect(b.booth), r), `${b.id}: 부스가 정문 그림과 겹침`);
    }
  }
});

test("문 그림을 팻말 · 부스가 덮지 않음(2px 여유)", () => {
  assert.equal(DOOR_ART_CLEAR, 2);
  const doors = BUILDINGS.map((b) => ({ id: b.id, rect: doorArtRect(b) })).filter((d) => d.rect);
  assert.ok(doors.length >= 13);
  for (const b of signed) {
    for (const d of doors) {
      assert.ok(!hit(signArtRect(b.sign), d.rect, DOOR_ART_CLEAR), `${b.id} 팻말이 ${d.id} 문 그림을 덮음`);
      if (b.booth) assert.ok(!hit(boothArtRect(b.booth), d.rect, DOOR_ART_CLEAR), `${b.id} 부스가 ${d.id} 문 그림을 덮음`);
    }
  }
});

test("퀴즈 상자 후보: 상자 16×16 + 흔들림 2px + 여유 4px가 건물 · 열린 공간 이름표, 팻말, 부스 칸과 안 겹침(정문 제외도 함께)", () => {
  const gate = gateRects().map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }));
  // 화면(CampusScene.layoutNameTag)과 같은 피하기 목록으로 이름표 자리를 따로 다시 계산
  const avoid = [...gate, ...signed.map((b) => signArtRect(b.sign)), ...signed.filter((b) => b.booth).map((b) => boothArtRect(b.booth))];
  const blocks = [
    ...WORLD.buildings.flatMap((b) => ["ko", "en"].map((lang) => ({ name: `${b.id} 이름표(${lang})`, ...buildingTagRect(b, lang, avoid, gate) }))),
    ...WORLD.openSpaces.flatMap((s) =>
      ["ko", "en"].map((lang) => {
        const { w, h } = estimateLabelSize((lang === "en" ? s.nameEn : null) ?? s.name, 1, 1);
        return { name: `${s.id} 이름표(${lang})`, x0: s.tag.x - w / 2, x1: s.tag.x + w / 2, y0: s.tag.y - h / 2, y1: s.tag.y + h / 2 };
      }),
    ),
    ...signed.map((b) => ({ name: `${b.id} 팻말`, ...signArtRect(b.sign) })),
    ...signed.filter((b) => b.booth).map((b) => ({ name: `${b.id} 부스`, ...boothRect(b.booth) })),
  ];
  assert.equal(QUIZ_LABEL_CLEAR, 4);
  assert.deepEqual(quizBoxRect(0, 0, QUIZ_LABEL_CLEAR), { x0: -12, x1: 12, y0: -14, y1: 12 });
  const spots = WORLD.quizSpots();
  const v2Spots = new Set(quizSpots().map((p) => `${p.x},${p.y}`));
  assert.ok(spots.length > 100);
  for (const s of spots) {
    assert.ok(v2Spots.has(`${s.x},${s.y}`), `(${s.x}, ${s.y})는 정문 제외 목록에 없는 후보`);
    const q = quizBoxRect(s.x, s.y, QUIZ_LABEL_CLEAR);
    for (const r of blocks) assert.ok(q.x1 <= r.x0 || r.x1 <= q.x0 || q.y1 <= r.y0 || r.y1 <= q.y0, `(${s.x}, ${s.y}) 퀴즈 상자가 ${r.name}과(와) 겹침`);
  }
  const before = WORLD.quizSpots({ skipLabels: true }).length;
  assert.ok(before - spots.length > 0 && before - spots.length < 200, `빠진 후보 ${before - spots.length}개 (${before} → ${spots.length})`);
});

test("건물 이름표(한/영)가 팻말 · 부스 그림과 겹치지 않음(이름표가 팻말 칸을 피해 자리를 잡음)", () => {
  const gate = gateRects().map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }));
  const arts = [...signed.map((b) => ({ id: `${b.id} 팻말`, ...signArtRect(b.sign) })), ...signed.filter((b) => b.booth).map((b) => ({ id: `${b.id} 부스`, ...boothArtRect(b.booth) }))];
  for (const b of WORLD.buildings) {
    for (const lang of ["ko", "en"]) {
      const tag = buildingTagRect(b, lang, [...gate, ...arts], gate);
      for (const a of arts) assert.ok(!hit(tag, a), `${b.id} 이름표(${lang})가 ${a.id}과(와) 겹침`);
    }
  }
});
