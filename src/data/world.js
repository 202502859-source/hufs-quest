import * as v1 from "./campus.js";
import * as v2 from "./campusV2.js";
import { TILE_SIZE } from "../gfx/textures.js";
import { hasOfficeInfo } from "../ui/officeView.js";
import { awayFromRally, boothArtRect, boothRect, rallySpotsOf, signArtRect, signSpotOf } from "./stampRallySpots.js";
import { buildingTagRect, estimateLabelSize } from "./buildingLabels.js";

/*
 * 화면 코드가 쓰는 캠퍼스 맵 하나를 고릅니다.
 * - 기본: v2(정문 진입로 기준 회전, 미터 다각형 → 텍스처, 1m 판정 격자) — src/data/campusV2.js
 * - 되돌리기: 주소에 ?map=v1 → 옛 타일맵(북쪽 위 88×90) — src/data/campus.js. 12/2 기능 동결 뒤 이상 없으면 지웁니다.
 * 두 맵 모두 월드 픽셀 좌표로 같은 모양의 값을 돌려줍니다.
 * sign(11/27 오후): 시설 소개가 있는 건물(정문 지정 11곳 + 법학관 + Minerva Complex, 정문안내실 제외)의 "시설 안내문" 팻말 자리.
 *   예전 "건물 소개 안내원" NPC는 없앴습니다(guide는 늘 null). [Enter] 시설 소개는 팻말에서 엽니다.
 * booth(v2만): 스탬프 랠리 대상 4곳(도서관 · 국제학사 및 학생회관 · 본관 · 인문과학관)은 문을 사이에 두고 팻말 반대쪽에
 *   부스를 둡니다(src/data/stampRallySpots.js). 옛 맵(?map=v1)은 예전 안내원 자리에 팻말만 있고 부스는 없습니다.
 */
// 팻말을 세울 건물인지(시설 소개가 있는 건물). 옛 맵(v1)은 옛 안내원 자리(npc)에, v2는 src/data/stampRallySpots.js가 정한 자리에.
const signOf = (p, spot) => (p.kind === "building" && hasOfficeInfo(p.id) && spot ? spot : null);
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
  places.forEach((p) => {
    const spot = signOf(p, p.npc);
    Object.assign(p, { guide: null, sign: spot ? { x: spot.x, y: spot.y, face: "down", side: 1, along: 0, attached: false } : null, booth: null });
  });
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
    const sign = signOf(p, p.kind === "building" ? signSpotOf(p) : null);
    const rally = sign ? rallySpotsOf(p) : null;
    return { ...p, labelWidth: box.x1 - box.x0, door, npc, guide: null, sign, booth: rally?.booth ?? null };
  };
  const byId = new Map();
  const buildings = v2.BUILDINGS.map((b) => byId.set(b.id, wrap(b)).get(b.id));
  const openSpaces = v2.OPEN_SPACES.map((s) => byId.set(s.id, wrap(s)).get(s.id));
  // 퀴즈 상자가 피할 칸(11/27): 건물 · 열린 공간 이름표(한/영), 시설 안내문 팻말, 스탬프 랠리 부스 바닥.
  // 이름표 자리는 CampusScene.layoutNameTag와 같은 피하기 목록(정문 그림 · 팻말 · 부스 그림)으로 어림합니다.
  let labelRects = null;
  const quizBlockRects = () => {
    if (labelRects) return labelRects;
    const gate = v2.gateRects().map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }));
    const signs = buildings.filter((b) => b.sign).map((b) => signArtRect(b.sign));
    const booths = buildings.filter((b) => b.booth).map((b) => boothRect(b.booth));
    const avoid = [...gate, ...signs, ...buildings.filter((b) => b.booth).map((b) => boothArtRect(b.booth))];
    const tags = buildings.flatMap((b) => ["ko", "en"].map((lang) => ({ name: `${b.id} 이름표(${lang})`, ...buildingTagRect(b, lang, avoid, gate) })));
    const openTags = openSpaces.flatMap((s) =>
      ["ko", "en"].map((lang) => {
        const { w, h } = estimateLabelSize((lang === "en" ? s.nameEn : null) ?? s.name, 1, 1);
        return { name: `${s.id} 이름표(${lang})`, x0: s.tag.x - w / 2, x1: s.tag.x + w / 2, y0: s.tag.y - h / 2, y1: s.tag.y + h / 2 };
      }),
    );
    labelRects = [
      ...tags,
      ...openTags,
      ...signs.map((r) => ({ name: "팻말", ...r })),
      ...booths.map((r) => ({ name: "부스", ...r })),
    ];
    return labelRects;
  };
  const clearOfBlocks = (s) => {
    const q = v2.quizBoxRect(s.x, s.y, v2.QUIZ_LABEL_CLEAR);
    return quizBlockRects().every((r) => q.x1 <= r.x0 || r.x1 <= q.x0 || q.y1 <= r.y0 || r.y1 <= q.y0);
  };
  return {
    version: "v2",
    width: v2.WORLD_W,
    height: v2.WORLD_H,
    northDeg: v2.ROTATION_DEG,
    spawn: { ...v2.SPAWN },
    buildings,
    openSpaces,
    // 퀴즈 상자는 시설 안내문 팻말 · 스탬프 랠리 부스와 겹치지 않는 자리만.
    // 11/27: 건물 · 열린 공간 이름표 칸도(상자 16×16 + 흔들림 2px, 여유 4px). skipLabels: 빠진 개수 확인용(테스트)
    quizSpots: ({ skipLabels = false } = {}) => {
      const stops = buildings.filter((b) => b.sign);
      return v2.quizSpots().filter((s) => awayFromRally(s, stops) && (skipLabels || clearOfBlocks(s)));
    },
    quizBlockRects,
    nearestPlace: (x, y) => byId.get(v2.nearestPlace(x, y).id),
    moveFeet: v2.moveFeet,
  };
}

export const WORLD = MAP_VERSION === "v1" ? makeV1() : makeV2();
export const findPlace = (id) => [...WORLD.buildings, ...WORLD.openSpaces].find((p) => p.id === id);
