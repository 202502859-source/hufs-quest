import * as v1 from "./campus.js";
import * as v2 from "./campusV2.js";
import { TILE_SIZE } from "../gfx/textures.js";
import { hasOfficeInfo } from "../ui/officeView.js";
import { awayFromGuides, guideSpotOf } from "./guides.js";

/*
 * 화면 코드가 쓰는 캠퍼스 맵 하나를 고릅니다.
 * - 기본: v2(정문 진입로 기준 회전, 미터 다각형 → 텍스처, 1m 판정 격자) — src/data/campusV2.js
 * - 되돌리기: 주소에 ?map=v1 → 옛 타일맵(북쪽 위 88×90) — src/data/campus.js. 12/2 기능 동결 뒤 이상 없으면 지웁니다.
 * 두 맵 모두 월드 픽셀 좌표로 같은 모양의 값을 돌려줍니다.
 * guide: 정문 옆 "건물 소개 안내원" 자리(사무실 안내가 있는 건물만 — 정문 지정 11곳 + 법학관, 정문안내실 제외. 나머지는 null).
 */
// 옛 맵(v1)은 옛 안내원 자리(npc), v2는 src/data/guides.js가 정한 자리.
const guideOf = (p, spot) => (p.kind === "building" && hasOfficeInfo(p.id) && spot ? spot : null);
export const MAP_VERSION =
  typeof location !== "undefined" && new URLSearchParams(location.search).get("map") === "v1" ? "v1" : "v2";

const T = TILE_SIZE;
const tileCenter = (t) => ({ x: t.x * T + T / 2, y: t.y * T + T / 2 });

function makeV1() {
  const places = [...v1.BUILDINGS, ...v1.OPEN_SPACES].map((p) => ({
    ...p,
    kind: v1.BUILDINGS.includes(p) ? "building" : "open",
    tag: { x: p.label.tagX * T, y: p.label.tagY * T },
    mapLabel: [p.label.x * T, p.label.y * T],
    labelWidth: p.w * T,
    door: p.door ? tileCenter(v1.doorTile(p)) : null,
    npc: p.door ? tileCenter(v1.npcTile(p)) : null,
  }));
  places.forEach((p) => (p.guide = guideOf(p, p.npc)));
  return {
    version: "v1",
    width: v1.MAP_WIDTH * T,
    height: v1.MAP_HEIGHT * T,
    northDeg: 0,
    spawn: tileCenter(v1.SPAWN),
    buildings: places.filter((p) => p.kind === "building"),
    openSpaces: places.filter((p) => p.kind === "open"),
    quizSpots() {
      const { ground, solid } = v1.buildCampusLayers();
      return v1.quizBoxTiles(ground, solid).map(tileCenter);
    },
    nearestPlace(x, y) {
      const tx = x / T;
      const ty = y / T;
      let best = null;
      let bestD = Infinity;
      places.forEach((p) =>
        p.parts.forEach(([px, py, pw, ph]) => {
          const d = Math.hypot(Math.max(px - tx, 0, tx - (px + pw)), Math.max(py - ty, 0, ty - (py + ph)));
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }),
      );
      return best;
    },
  };
}

function makeV2() {
  const wrap = (p) => {
    const box = p.box ?? (() => {
      const xs = p.areaPolys[0].map((q) => q[0]);
      return { x0: Math.min(...xs), x1: Math.max(...xs) };
    })();
    const door = p.kind === "building" ? v2.doorOf(p) : null;
    const npc = p.kind === "building" ? v2.npcSpotOf(p) : null;
    return { ...p, labelWidth: box.x1 - box.x0, door, npc, guide: guideOf(p, p.kind === "building" ? guideSpotOf(p) : null) };
  };
  const byId = new Map();
  const buildings = v2.BUILDINGS.map((b) => byId.set(b.id, wrap(b)).get(b.id));
  const openSpaces = v2.OPEN_SPACES.map((s) => byId.set(s.id, wrap(s)).get(s.id));
  return {
    version: "v2",
    width: v2.WORLD_W,
    height: v2.WORLD_H,
    northDeg: v2.ROTATION_DEG,
    spawn: { ...v2.SPAWN },
    buildings,
    openSpaces,
    // 퀴즈 상자는 건물 소개 안내원 · 안내원 아래 글자와 겹치지 않는 자리만
    quizSpots: () => v2.quizSpots().filter((s) => awayFromGuides(s, buildings.filter((b) => b.guide).map((b) => b.guide))),
    nearestPlace: (x, y) => byId.get(v2.nearestPlace(x, y).id),
    moveFeet: v2.moveFeet,
  };
}

export const WORLD = MAP_VERSION === "v1" ? makeV1() : makeV2();
export const findPlace = (id) => [...WORLD.buildings, ...WORLD.openSpaces].find((p) => p.id === id);
