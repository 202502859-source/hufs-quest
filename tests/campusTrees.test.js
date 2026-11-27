// 가로수 정리(src/data/campusV2.js cleanedTrees, 11/27 오후): 길 위 나무 삭제 · 크게 겹친 나무 합치기. 나무는 그림만이라 걷기 · 충돌은 그대로. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAT, PX_PER_M, TREES, TREE_MERGE_RATIO, TREE_PATH_MATS, WORLD_H, WORLD_W, cleanedTrees, matAt, reachable, toWorld, walkGrid } from "../src/data/campusV2.js";
import { PALETTE, paintRegion } from "../src/gfx/campusV2Paint.js";

const center = (t) => toWorld([t[0], t[1]]);
const { kept, onPath, merged } = cleanedTrees();

test("길 위 나무 0그루: 남은 나무의 밑동(줄기 가운데)은 차도 · 보도 · 건널목 · 주차장 · 계단 칸 위가 아님", () => {
  assert.deepEqual([...TREE_PATH_MATS].sort(), [MAT.road, MAT.pave, MAT.crosswalk, MAT.parking, MAT.steps, MAT.outerRoad].sort());
  const path = new Set(TREE_PATH_MATS);
  const bad = kept.filter((t) => path.has(matAt(...center(t))));
  assert.equal(bad.length, 0, `길 위에 남은 나무 ${bad.length}그루`);
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

test("지운 · 합친 나무 수: 원본 100그루 → 길 위 50그루 삭제 · 겹침 1그루 합침 → 49그루. 원본 데이터 · 맵 범위는 그대로", () => {
  assert.equal(TREES.length, 100);
  assert.deepEqual([onPath.length, merged.length, kept.length], [50, 1, 49]);
  assert.equal(onPath.length + merged.length + kept.length, TREES.length);
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
  assert.ok(checked >= 40, `확인한 자리 ${checked}곳`);
  for (const t of kept) assert.ok(leaf.has(colorAt(...center(t))), `남은 나무가 안 그려짐 (${center(t).map(Math.round)})`);
});
