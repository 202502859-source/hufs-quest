import { BUILDINGS, MAP_HEIGHT, MAP_WIDTH, OPEN_SPACES, buildCampusLayers, doorTile } from "../data/campus.js";
import { TILE, TILE_SIZE } from "../gfx/textures.js";
import { QUEST_LIST, getLang, session } from "../state.js";

const TEXTURE_KEY = "campus-overview";
const ROOF_COLOR = { BLUE: "#2f4d7c", RED: "#a5533f", GRAY: "#5d6d7c" };
const GROUND_COLOR = {
  [TILE.PATH]: "#d9c9a3",
  [TILE.PLAZA]: "#b9a48c",
  [TILE.FIELD]: "#4f9d52",
  [TILE.FIELD_LINE]: "#f3f6ef",
  [TILE.LAWN]: "#86cc6c",
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
      ctx.fillStyle = solid[y][x] === TILE.TREE ? "#3e8a4c" : GROUND_COLOR[ground[y][x]] ?? "#6fb35a";
      ctx.fillRect(x, y, 1, 1);
    }
  }
  BUILDINGS.forEach((b) => {
    ctx.fillStyle = ROOF_COLOR[b.roof];
    for (let row = 0; row < b.h; row++) {
      for (let col = 0; col < b.w; col++) {
        if (b.notch && col < b.notch.w && row < b.notch.h) continue;
        ctx.fillRect(b.x + col, b.y + row, 1, 1);
      }
    }
  });
  scene.textures.addCanvas(TEXTURE_KEY, canvas);
  return TEXTURE_KEY;
}

export const placeName = (place) => (getLang() === "en" ? place.nameEn : place.name);

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
    const dx = Math.max(p.x - tileX, 0, tileX - (p.x + p.w));
    const dy = Math.max(p.y - tileY, 0, tileY - (p.y + p.h));
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = p;
    }
  });
  return best;
}
