import { BUILDINGS, MAP_HEIGHT, MAP_WIDTH, OPEN_SPACES, buildCampusLayers, doorTile } from "../data/campus.js";
import { TILE, TILE_SIZE } from "../gfx/textures.js";
import { QUEST_LIST, getLang, session } from "../state.js";

const TEXTURE_KEY = "campus-overview";
const ROOF_COLOR = { BLUE: "#2f4d7c", RED: "#a5533f", GRAY: "#5d6d7c" };
const UNDERGROUND_COLOR = "#4b6878"; // 지하 건물(유리 천창)
const GROUND_COLOR = {
  [TILE.PATH]: "#d9c9a3",
  [TILE.PLAZA]: "#b9a48c",
  [TILE.FIELD]: "#4f9d52",
  [TILE.FIELD_LINE]: "#f3f6ef",
  [TILE.FIELD_LINE_V]: "#f3f6ef",
  [TILE.LAWN]: "#86cc6c",
  [TILE.ROAD]: "#6b7176",
  [TILE.CROSSWALK]: "#eef0e8",
  [TILE.DIRT]: "#b99b6f",
  [TILE.PARKING]: "#7d8388",
  [TILE.TRACK]: "#b5573f",
};
// 걸을 수 없는 칸(solid 레이어)의 지도 색입니다. 건물은 아래에서 지붕 색으로 다시 칠합니다.
const SOLID_COLOR = {
  [TILE.TREE]: "#3e8a4c",
  [TILE.OUTER_ROAD]: "#5d6368",
  [TILE.OUTSIDE]: "#3a4045",
  [TILE.SKYLIGHT]: UNDERGROUND_COLOR,
  [TILE.FOUNTAIN]: "#6fb3d6",
};

// 실제 맵 데이터로 한 타일이 1픽셀인 지도 이미지를 만듭니다. 맵을 고치면 지도도 함께 바뀝니다.
export function overviewTexture(scene) {
  if (scene.textures.exists(TEXTURE_KEY)) return TEXTURE_KEY;
  const canvas = document.createElement("canvas");
  canvas.width = MAP_WIDTH;
  canvas.height = MAP_HEIGHT;
  const ctx = canvas.getContext("2d");
  const { ground, solid } = buildCampusLayers();
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      ctx.fillStyle = SOLID_COLOR[solid[y][x]] ?? GROUND_COLOR[ground[y][x]] ?? "#6fb35a";
      ctx.fillRect(x, y, 1, 1);
    }
  }
  BUILDINGS.forEach((b) => {
    ctx.fillStyle = b.underground ? UNDERGROUND_COLOR : ROOF_COLOR[b.roof];
    b.parts.forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
  });
  scene.textures.addCanvas(TEXTURE_KEY, canvas);
  return TEXTURE_KEY;
}

// 영어 공식 이름을 아직 확인하지 못한 곳(nameEn: null)은 한국어 이름으로 보여 줍니다.
export const placeName = (place) => (getLang() === "en" ? place.nameEn ?? place.name : place.name);

// 안내 중인 퀘스트의 목적지 건물과 입구 앞 위치입니다. 없으면 null입니다.
export function trackedDestination() {
  const quest = QUEST_LIST.find((q) => q.id === session.trackedQuest);
  if (!quest?.destination) return null;
  const building = BUILDINGS.find((b) => b.id === quest.destination);
  const door = doorTile(building);
  return {
    building,
    worldX: door.x * TILE_SIZE + TILE_SIZE / 2,
    worldY: door.y * TILE_SIZE + TILE_SIZE / 2,
  };
}

// 지금 위치에서 가장 가까운 건물이나 공간을 돌려줍니다.
export function nearestPlace(worldX, worldY) {
  const tileX = worldX / TILE_SIZE;
  const tileY = worldY / TILE_SIZE;
  let best = null;
  let bestDistance = Infinity;
  [...BUILDINGS, ...OPEN_SPACES].forEach((p) => {
    // ㄱ자 · 계단식 건물도 맞게 재도록 사각형(parts)마다 거리를 재서 가장 가까운 값을 씁니다.
    p.parts.forEach(([x, y, w, h]) => {
      const dx = Math.max(x - tileX, 0, tileX - (x + w));
      const dy = Math.max(y - tileY, 0, tileY - (y + h));
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = p;
      }
    });
  });
  return best;
}
