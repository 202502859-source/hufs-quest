// 외부 이미지 없이 캔버스에 직접 그리는 오리지널 도트 그래픽입니다.
export const TILE_SIZE = 16;

export const TILE = {
  GRASS: 0,
  GRASS_FLOWER: 1,
  PATH: 2,
  TREE: 3,
  WALL: 4,
  WINDOW: 5,
  DOOR: 6,
  ROOF_BLUE: 7,
  EAVE_BLUE: 8,
  ROOF_RED: 9,
  EAVE_RED: 10,
  ROOF_GRAY: 11,
  EAVE_GRAY: 12,
  LAWN: 13,
  PLAZA: 14,
  FIELD: 15,
  FIELD_LINE: 16,
  // 2단계(배치) 바닥 · 시설. 색은 docs/GRAPHICS.md 3장 팔레트를 씁니다.
  ROAD: 17,
  DIRT: 18,
  PARKING: 19,
  TRACK: 20,
  OUTER_ROAD: 21,
  OUTSIDE: 22,
  CROSSWALK: 23,
  SKYLIGHT: 24,
  FOUNTAIN: 25,
  FIELD_LINE_V: 26,
  ENTRANCE: 27,
  STAIRS: 28,
};

const TILE_COUNT = Object.keys(TILE).length;
const COLUMNS = 8;

function createTileCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = COLUMNS * TILE_SIZE;
  canvas.height = Math.ceil(TILE_COUNT / COLUMNS) * TILE_SIZE;
  const ctx = canvas.getContext("2d");

  // 같은 무늬가 나오도록 고정 시드 난수를 씁니다.
  let seed = 11;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const tile = (index, draw) => {
    ctx.save();
    ctx.translate((index % COLUMNS) * TILE_SIZE, Math.floor(index / COLUMNS) * TILE_SIZE);
    draw((color, x, y, w = 1, h = 1) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    });
    ctx.restore();
  };
  const speckle = (px, base, spots, count) => {
    px(base, 0, 0, 16, 16);
    for (let i = 0; i < count; i++) {
      px(spots[Math.floor(random() * spots.length)], Math.floor(random() * 16), Math.floor(random() * 16));
    }
  };
  const roof = (px, base, dark, light) => {
    px(base, 0, 0, 16, 16);
    for (let y = 3; y < 16; y += 4) px(dark, 0, y, 16, 1);
    for (let y = 0; y < 16; y += 4) {
      for (let x = y % 8 ? 0 : 4; x < 16; x += 8) px(dark, x, y, 1, 3);
    }
    px(light, 0, 0, 16, 1);
  };
  const eave = (px, base, dark) => {
    px(base, 0, 0, 16, 10);
    px(dark, 0, 10, 16, 3);
    px("#c9bea8", 0, 13, 16, 3);
  };

  tile(TILE.GRASS, (px) => speckle(px, "#6fb35a", ["#62a54f", "#7cc066"], 26));
  tile(TILE.GRASS_FLOWER, (px) => {
    speckle(px, "#6fb35a", ["#62a54f", "#7cc066"], 18);
    px("#fff3a8", 4, 5, 2, 2);
    px("#f7a8b8", 11, 10, 2, 2);
  });
  tile(TILE.PATH, (px) => speckle(px, "#d9c9a3", ["#cdbc94", "#e4d6b4"], 22));
  tile(TILE.TREE, (px) => {
    px("#6fb35a", 0, 0, 16, 16);
    px("#6b4a2f", 6, 11, 4, 5);
    px("#2f7a3f", 2, 1, 12, 11);
    px("#3e9150", 3, 2, 8, 6);
    px("#58ad66", 5, 3, 3, 2);
  });
  tile(TILE.WALL, (px) => {
    px("#e9e0cd", 0, 0, 16, 16);
    px("#d8cdb6", 0, 7, 16, 1);
    px("#d8cdb6", 0, 15, 16, 1);
  });
  tile(TILE.WINDOW, (px) => {
    px("#e9e0cd", 0, 0, 16, 16);
    px("#d8cdb6", 0, 15, 16, 1);
    px("#39506b", 3, 3, 10, 9);
    px("#7fb4d6", 4, 4, 8, 7);
    px("#b8dcf0", 4, 4, 3, 3);
    px("#39506b", 7, 4, 1, 7);
  });
  tile(TILE.DOOR, (px) => {
    px("#e9e0cd", 0, 0, 16, 16);
    px("#5b3a26", 2, 1, 12, 15);
    px("#8a5c3c", 3, 2, 4, 14);
    px("#8a5c3c", 9, 2, 4, 14);
    px("#f2c94c", 7, 9, 2, 2);
  });
  tile(TILE.ROOF_BLUE, (px) => roof(px, "#2f4d7c", "#26406a", "#3d6098"));
  tile(TILE.EAVE_BLUE, (px) => eave(px, "#2f4d7c", "#1d3355"));
  tile(TILE.ROOF_RED, (px) => roof(px, "#a5533f", "#8c4433", "#bb6a55"));
  tile(TILE.EAVE_RED, (px) => eave(px, "#a5533f", "#6f3527"));
  tile(TILE.ROOF_GRAY, (px) => roof(px, "#5d6d7c", "#4e5c69", "#74848f"));
  tile(TILE.EAVE_GRAY, (px) => eave(px, "#5d6d7c", "#3d4954"));
  tile(TILE.LAWN, (px) => speckle(px, "#86cc6c", ["#7abf61", "#95d87b"], 16));
  tile(TILE.PLAZA, (px) => {
    px("#b9a48c", 0, 0, 16, 16);
    px("#a18c75", 0, 7, 16, 1);
    px("#a18c75", 0, 15, 16, 1);
    px("#a18c75", 7, 0, 1, 7);
    px("#a18c75", 15, 8, 1, 7);
  });
  tile(TILE.FIELD, (px) => {
    px("#4f9d52", 0, 0, 16, 16);
    px("#478f4a", 0, 0, 8, 16);
  });
  tile(TILE.FIELD_LINE, (px) => {
    px("#4f9d52", 0, 0, 16, 16);
    px("#f3f6ef", 0, 7, 16, 2);
  });
  tile(TILE.FIELD_LINE_V, (px) => {
    px("#4f9d52", 0, 0, 16, 16);
    px("#478f4a", 0, 0, 8, 16);
    px("#f3f6ef", 7, 0, 2, 16);
  });
  tile(TILE.ROAD, (px) => speckle(px, "#6b7176", ["#646a6f", "#737a7f"], 18));
  tile(TILE.DIRT, (px) => speckle(px, "#b99b6f", ["#a98b60", "#c4a87e", "#997d55"], 24));
  tile(TILE.PARKING, (px) => {
    speckle(px, "#6b7176", ["#646a6f", "#737a7f"], 14);
    px("#eef0e8", 0, 2, 1, 12); // 주차선
  });
  tile(TILE.TRACK, (px) => speckle(px, "#b5573f", ["#a64d37", "#c0634b"], 20));
  tile(TILE.OUTER_ROAD, (px) => {
    speckle(px, "#5d6368", ["#565c61", "#656b70"], 16);
    px("#d9dbd2", 6, 7, 4, 2); // 차선 점선
  });
  tile(TILE.OUTSIDE, (px) => {
    px("#50565b", 0, 0, 16, 16);
    for (let i = -16; i < 16; i += 4) for (let k = 0; k < 16; k++) if (i + k >= 0 && i + k < 16) px("#3f4a45", i + k, 15 - k);
  });
  tile(TILE.CROSSWALK, (px) => {
    px("#6b7176", 0, 0, 16, 16);
    for (let x = 1; x < 16; x += 4) px("#eef0e8", x, 0, 2, 16);
  });
  tile(TILE.SKYLIGHT, (px) => {
    px("#4b6878", 0, 0, 16, 16);
    for (let x = 1; x < 16; x += 3) px("#9fbccb", x, 0, 1, 16);
    px("#6f7b79", 0, 0, 16, 1);
    px("#6f7b79", 0, 15, 16, 1);
  });
  tile(TILE.FOUNTAIN, (px) => {
    px("#d9c9a3", 0, 0, 16, 16);
    px("#b9ad8f", 2, 2, 12, 12);
    px("#6fb3d6", 3, 3, 10, 10);
    px("#b8dcf0", 5, 5, 3, 3);
  });
  tile(TILE.ENTRANCE, (px) => {
    // 남쪽이 아닌 쪽 입구: 위에서 본 차양과 발판
    px("#d9c9a3", 0, 0, 16, 16);
    px("#3d4954", 2, 2, 12, 9);
    px("#5d6d7c", 3, 3, 10, 7);
    px("#8a5c3c", 4, 11, 8, 4);
  });
  tile(TILE.STAIRS, (px) => {
    // 지하 건물로 내려가는 계단
    px("#9ba7a4", 0, 0, 16, 16);
    for (let y = 1; y < 16; y += 3) px("#6f7b79", 1, y, 14, 1);
    px("#50565b", 1, 13, 14, 3);
  });
  return canvas;
}

// 한 줄에 아래, 위, 왼쪽, 오른쪽 순서로 2프레임씩 그립니다.
function createCharacterCanvas({ hair, skin, top, bottom }) {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE * 8;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d");
  const shoe = "#1a1a22";
  const eye = "#2a2230";

  for (let dir = 0; dir < 4; dir++) {
    for (let frame = 0; frame < 2; frame++) {
      const ox = (dir * 2 + frame) * TILE_SIZE;
      const px = (color, x, y, w = 1, h = 1) => {
        ctx.fillStyle = color;
        ctx.fillRect(ox + x, y, w, h);
      };
      const step = frame === 0 ? 0 : 1;
      px(bottom, 5, 12, 2, 3 - step);
      px(bottom, 9, 12, 2, 2 + step);
      px(shoe, 5, 15 - step, 2, 1);
      px(shoe, 9, 14 + step, 2, 1);
      px(top, 4, 8, 8, 4);
      px(skin, 3, 9, 1, 2);
      px(skin, 12, 9, 1, 2);
      px(skin, 4, 2, 8, 6);
      px(hair, 4, 1, 8, 3);
      if (dir === 0) {
        px(hair, 4, 4);
        px(hair, 11, 4);
        px(eye, 6, 5);
        px(eye, 9, 5);
      } else if (dir === 1) {
        px(hair, 4, 4, 8, 4);
      } else if (dir === 2) {
        px(hair, 9, 4, 3, 3);
        px(eye, 5, 5);
      } else {
        px(hair, 4, 4, 3, 3);
        px(eye, 10, 5);
      }
    }
  }
  return canvas;
}

const PLAYER_LOOK = { hair: "#2c2433", skin: "#f4c9a0", top: "#2f6fd0", bottom: "#27323f" };

export const NPC_LOOKS = [
  { hair: "#6b3f22", skin: "#f4c9a0", top: "#e0604f", bottom: "#3a3a3a" },
  { hair: "#1e1e28", skin: "#f1c29a", top: "#58ad66", bottom: "#2f3a46" },
  { hair: "#8d8d94", skin: "#eebf96", top: "#6e5a8d", bottom: "#2f2a3b" },
  { hair: "#d9a441", skin: "#f7d8bd", top: "#d98a2b", bottom: "#33414f" },
  { hair: "#5a2d2d", skin: "#d9a074", top: "#f2c94c", bottom: "#4a3b2a" },
];

// 머리 위에 띄우는 점 세 개짜리 말풍선 (11x11)
function createBubbleCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 11;
  canvas.height = 11;
  const ctx = canvas.getContext("2d");
  const px = (color, x, y, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const line = "#10182a";
  px(line, 1, 0, 9, 1);
  px(line, 0, 1, 11, 6);
  px(line, 1, 7, 9, 1);
  px(line, 3, 8, 4, 1);
  px(line, 3, 9, 3, 1);
  px(line, 3, 10, 2, 1);
  px("#ffffff", 1, 1, 9, 6);
  px("#ffffff", 4, 7, 2, 2);
  px(line, 2, 3, 2, 2);
  px(line, 5, 3, 1, 2);
  px(line, 7, 3, 2, 2);
  return canvas;
}

// 목적지 건물 위에 띄우는 아래쪽 화살표 (13x12)
function createDestinationArrowCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 13;
  canvas.height = 12;
  const ctx = canvas.getContext("2d");
  const rows = [[4, 5], [4, 5], [4, 5], [4, 5], [4, 5], [0, 13], [1, 11], [2, 9], [3, 7], [4, 5], [5, 3], [6, 1]];
  rows.forEach(([x, w], y) => {
    ctx.fillStyle = "#7a1216";
    ctx.fillRect(x, y, w, 1);
    if (w > 2) {
      ctx.fillStyle = "#ff5a5f";
      ctx.fillRect(x + 1, y, w - 2, 1);
    }
  });
  return canvas;
}

// 맵 곳곳의 O/X 퀴즈 상자 (14x14, 캐릭터와 비슷한 크기). 노란 상자에 '?'가 그려져 있습니다.
function createQuizBoxCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 14;
  canvas.height = 14;
  const ctx = canvas.getContext("2d");
  const px = (color, x, y, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const outline = "#5a3a00";
  px(outline, 1, 0, 12, 1);
  px(outline, 0, 1, 14, 12);
  px(outline, 1, 13, 12, 1);
  px("#f2c94c", 1, 1, 12, 12);
  px("#fff0b8", 1, 1, 11, 1);
  px("#fff0b8", 1, 2, 1, 10);
  px("#c99a1a", 2, 12, 11, 1);
  px("#c99a1a", 12, 2, 1, 10);
  // '?' 글자
  const mark = "#5a3a00";
  px(mark, 5, 3, 4, 1);
  px(mark, 4, 4, 1, 2);
  px(mark, 9, 4, 1, 2);
  px(mark, 8, 6, 1, 1);
  px(mark, 7, 7, 1, 2);
  px(mark, 7, 10, 1, 1);
  return canvas;
}

// 마감 임박 공지 아이콘 (16x16, HUD에서 4배로 키워 64x64로 표시). 빨간 상자에 흰 '!'
function createAlertBoxCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  const px = (color, x, y, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const outline = "#10182a"; // 다른 HUD 패널과 같은 어두운 테두리
  px(outline, 1, 0, 14, 1);
  px(outline, 0, 1, 16, 14);
  px(outline, 1, 15, 14, 1);
  px("#d93f3f", 1, 1, 14, 14);
  px("#ff7a7a", 1, 1, 13, 1);
  px("#ff7a7a", 1, 2, 1, 12);
  px("#8f1f1f", 2, 14, 13, 1);
  px("#8f1f1f", 14, 2, 1, 12);
  // '!' 글자
  px("#ffffff", 7, 3, 2, 7);
  px("#ffffff", 7, 11, 2, 2);
  return canvas;
}

function addCharacterTexture(scene, key, look) {
  const texture = scene.textures.addCanvas(key, createCharacterCanvas(look));
  for (let i = 0; i < 8; i++) texture.add(i, 0, i * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
}

export function registerTextures(scene) {
  scene.textures.addCanvas("tiles", createTileCanvas());
  scene.textures.addCanvas("bubble", createBubbleCanvas());
  scene.textures.addCanvas("dest-arrow", createDestinationArrowCanvas());
  scene.textures.addCanvas("quiz-box", createQuizBoxCanvas());
  scene.textures.addCanvas("alert-box", createAlertBoxCanvas());
  addCharacterTexture(scene, "player", PLAYER_LOOK);
  NPC_LOOKS.forEach((look, i) => addCharacterTexture(scene, `npc-${i}`, look));

  ["down", "up", "left", "right"].forEach((dir, d) => {
    scene.anims.create({
      key: `walk-${dir}`,
      frames: [
        { key: "player", frame: d * 2 },
        { key: "player", frame: d * 2 + 1 },
      ],
      frameRate: 7,
      repeat: -1,
    });
  });
}
