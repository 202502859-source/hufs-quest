// 가로수 정리(src/data/campusV2.js cleanedTrees, 11/27 오후 · 저녁): 길 위 나무 삭제(보도 가장자리 가로수 줄은 되살림) · 크게 겹친 나무 합치기. 나무는 그림만이라 걷기 · 충돌은 그대로. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAT, PX_PER_M, TREES, TREE_MERGE_RATIO, TREE_PATH_MATS, TREE_ROW, WORLD_H, WORLD_W, cleanedTrees, matAt, reachable, toWorld, treeEdgeDistance, treeRows, walkGrid } from "../src/data/campusV2.js";
import { PALETTE, paintRegion } from "../src/gfx/campusV2Paint.js";

const center = (t) => toWorld([t[0], t[1]]);
const { kept, rows, onPath, merged } = cleanedTrees();
const matName = Object.fromEntries(Object.entries(MAT).map(([k, v]) => [v, k]));
const matOf = (t) => matName[matAt(...center(t))];

test("길 위 나무: 남은 나무의 밑동(줄기 가운데)은 차도 · 보도 · 건널목 · 주차장 · 계단 칸 위가 아님. 예외는 되살린 가로수 줄(보도)뿐", () => {
  assert.deepEqual([...TREE_PATH_MATS].sort(), [MAT.road, MAT.pave, MAT.crosswalk, MAT.parking, MAT.steps, MAT.outerRoad].sort());
  const path = new Set(TREE_PATH_MATS);
  const bad = kept.filter((t) => path.has(matAt(...center(t))) && !rows.includes(t));
  assert.equal(bad.length, 0, `길 위에 남은 나무 ${bad.length}그루`);
  for (const t of rows) assert.ok(kept.includes(t) && matOf(t) === "pave", "되살린 나무는 보도 위이고 그리는 목록에 있음");
  // 지운 나무는 모두 밑동이 길 위였고, 잔디 · 수풀 · 흙에 선 나무는 지우지 않음
  for (const t of onPath) assert.ok(path.has(matAt(...center(t))), `길이 아닌데 지움 (${center(t).map(Math.round)})`);
});

test("크게 겹친 나무 0쌍: 남은 나무끼리 가운데 거리가 지름의 60% 이상", () => {
  assert.equal(TREE_MERGE_RATIO, 0.6);
  let pairs = 0;
  for (let i = 0; i < kept.length; i++) {
    for (let j = i + 1; j < kept.length; j++) {
      const [ax, ay] = center(kept[i]);
      const [bx, by] = center(kept[j]);
      if (Math.hypot(ax - bx, ay - by) < Math.max(kept[i][2], kept[j][2]) * 2 * PX_PER_M * TREE_MERGE_RATIO) pairs += 1;
    }
  }
  assert.equal(pairs, 0);
  // 합친(지운) 나무는 남은 나무 하나와 실제로 그만큼 가까웠음
  for (const t of merged) {
    const [x, y] = center(t);
    assert.ok(kept.some((k) => Math.hypot(center(k)[0] - x, center(k)[1] - y) < Math.max(k[2], t[2]) * 2 * PX_PER_M * TREE_MERGE_RATIO));
  }
});

test("지운 · 합친 나무 수: 원본 100그루 → 길 위 50그루 중 가로수 줄 32그루 되살림 · 18그루 삭제, 겹침 1그루 합침 → 81그루. 원본 데이터 · 맵 범위는 그대로", () => {
  assert.equal(TREES.length, 100);
  assert.deepEqual([rows.length, onPath.length, merged.length, kept.length], [32, 18, 1, 81]);
  assert.equal(onPath.length + merged.length + kept.length, TREES.length);
  assert.equal(rows.length + onPath.length, 50, "11/27 오후에 길 위라 지웠던 50그루 = 되살린 것 + 계속 지운 것");
  assert.deepEqual([WORLD_W, WORLD_H], [1640, 1532], "원본 나무 좌표로 잡는 맵 범위가 바뀌지 않음");
});

test("걸을 수 있는 칸 · 충돌은 바뀌지 않음(나무는 그림만): 정리 전(11/27 오전)과 같은 걷기 칸 61383개 · 닿는 격자점 54823개", () => {
  let walkable = 0;
  for (const v of walkGrid()) walkable += v;
  assert.equal(walkable, 61383);
  assert.equal(reachable().list.length, 54823);
});

test("그림: 지운 나무 자리에는 잎이 칠해지지 않고(가까운 남은 나무가 없는 자리), 남은 나무 자리에는 칠해짐", () => {
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)].join(",");
  const leaf = new Set([hex(PALETTE.canopy), hex(PALETTE.canopyLight)]);
  const colorAt = (x, y) => {
    const px = paintRegion(Math.round(x), Math.round(y), 1, 1);
    return `${px[0]},${px[1]},${px[2]}`;
  };
  let checked = 0;
  for (const t of [...onPath, ...merged]) {
    const [x, y] = center(t);
    if (kept.some((k) => Math.hypot(center(k)[0] - x, center(k)[1] - y) <= (k[2] + 1) * PX_PER_M)) continue;
    assert.ok(!leaf.has(colorAt(x, y)), `지운 나무 자리에 잎이 남음 (${Math.round(x)}, ${Math.round(y)})`);
    checked += 1;
  }
  assert.ok(checked >= 12, `확인한 자리 ${checked}곳`);
  for (const t of kept) assert.ok(leaf.has(colorAt(...center(t))), `남은 나무가 안 그려짐 (${center(t).map(Math.round)})`);
});

// ── 가로수 줄 되살리기(11/27 저녁) ─────────────────
const RALLY_ROW_X = [978, 1052]; // 정문 위 진입로 양쪽 보도(월드 px)
test("가로수 줄 판정 상수(TREE_ROW): 보도 위 · 가장자리 12px 안 · 한 줄 3그루 이상 · 간격 40px 이하 · 어긋남 3px 이하", () => {
  assert.deepEqual(TREE_ROW, { mats: [MAT.pave], edgePx: 12, minCount: 3, maxGapPx: 40, tolerancePx: 3 });
  assert.deepEqual([...treeRows()].sort(), [...rows].sort(), "줄 판정 결과 = 되살린 나무");
});

test("되살린 가로수: 정문 위 진입로 양쪽 보도에 16그루씩 두 줄, 32px 간격으로 곧게. 모두 보도 가장자리", () => {
  const cols = RALLY_ROW_X.map((x) => rows.filter((t) => Math.abs(center(t)[0] - x) <= TREE_ROW.tolerancePx).sort((a, b) => center(a)[1] - center(b)[1]));
  assert.deepEqual(cols.map((c) => c.length), [16, 16]);
  assert.equal(cols[0].length + cols[1].length, rows.length, "두 줄 밖에 되살린 나무가 있음");
  for (const col of cols) {
    assert.ok(col.length >= TREE_ROW.minCount);
    for (let i = 1; i < col.length; i++) {
      const gap = Math.hypot(center(col[i])[0] - center(col[i - 1])[0], center(col[i])[1] - center(col[i - 1])[1]);
      assert.ok(gap <= TREE_ROW.maxGapPx && Math.abs(gap - 32) <= TREE_ROW.tolerancePx, `간격 ${gap.toFixed(1)}px`);
    }
  }
  for (const t of rows) assert.ok(treeEdgeDistance(...center(t)) <= TREE_ROW.edgePx, `보도 가장자리가 아님 (${center(t).map(Math.round)})`);
});

test("계속 지운 18그루: 차도 6 · 주차장 5 · 보도 7. 보도 7그루는 걷는 길 한가운데이거나 줄을 이루지 못함", () => {
  const count = (m) => onPath.filter((t) => matOf(t) === m).length;
  assert.deepEqual([count("road"), count("parking"), count("pave")], [6, 5, 7]);
  // 차도 · 주차장 위 나무는 줄지어 있어도 되살리지 않음
  for (const t of onPath.filter((x) => matOf(x) !== "pave")) assert.ok(!TREE_ROW.mats.includes(matAt(...center(t))));
  // 정문 위 진입로 흙길 한가운데 나무(두 가로수 줄 사이)는 계속 지움
  const middle = onPath.filter((t) => center(t)[0] > RALLY_ROW_X[0] + 8 && center(t)[0] < RALLY_ROW_X[1] - 8 && center(t)[1] > 820 && center(t)[1] < 1320);
  assert.ok(middle.length >= 2, `진입로 가운데에서 지운 나무 ${middle.length}그루`);
  for (const t of middle) assert.ok(!kept.includes(t));
  // 보도 위인데 지운 나무: 가장자리에서 멀거나(길 한가운데), 가장자리여도 같은 간격으로 이어지는 이웃이 없음(줄 아님)
  const pave = onPath.filter((t) => matOf(t) === "pave");
  const midPath = pave.filter((t) => treeEdgeDistance(...center(t)) > TREE_ROW.edgePx);
  assert.equal(midPath.length, 3, "걷는 길 한가운데 나무(외국어연수평가원 쪽 비스듬한 길)");
  for (const t of pave) assert.ok(!treeRows().has(t));
});

test("줄 판정 함수: 같은 간격 3그루는 줄, 2그루 · 간격이 다른 3그루 · 간격이 넓은 3그루 · 꺾인 3그루는 줄이 아님(실제 가로수 줄에서 골라 확인)", () => {
  const col = (x) => rows.filter((t) => Math.abs(center(t)[0] - x) <= TREE_ROW.tolerancePx).sort((a, b) => center(a)[1] - center(b)[1]);
  const [w, e] = RALLY_ROW_X.map(col);
  const size = (list) => treeRows(list).size;
  assert.equal(size([w[0], w[1], w[2]]), 3, "같은 간격(32px) 3그루");
  assert.equal(size([w[0], w[1]]), 0, "2그루");
  assert.equal(size([w[0], w[1], w[3]]), 0, "간격이 다름(32 · 64px)");
  assert.equal(size([w[0], w[2], w[4]]), 0, "간격이 40px보다 넓음(64px)");
  assert.equal(size([w[0], w[1], e[2]]), 0, "꺾임(세 번째가 건너편 줄)");
});
