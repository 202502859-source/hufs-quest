import { TILE } from "../gfx/textures.js";

export const MAP_WIDTH = 80;
export const MAP_HEIGHT = 72;
// 정문 광장. 시작 화면에서 정문안내실 간판이 상단 UI에 가리거나 잘리지 않는 위치입니다.
export const SPAWN = { x: 57, y: 57 };

/*
 * 사용자가 제공한 서울캠퍼스 조감도의 번호와 범례를 따른 배치입니다.
 * 조감도를 위에서 본 형태로 옮겨 위치 관계만 맞췄으므로 크기와 모양은 근사치입니다.
 * no는 조감도와 대조하기 위한 지도 번호로 화면에는 표시하지 않습니다. mapName은 전체 지도에서 줄바꿈할 이름입니다. x, y, w, h는 타일 단위입니다. notch는 왼쪽 위를 잘라 ㄱ자 건물을 만듭니다.
 */
export const BUILDINGS = [
  { id: "main", no: "0", name: "본관", nameEn: "Main Hall", x: 24, y: 10, w: 13, h: 15, roof: "BLUE" },
  { id: "humanities", no: "1", name: "인문과학관", mapName: "인문 과학관", nameEn: "Humanities Hall", x: 37, y: 5, w: 7, h: 7, roof: "RED" },
  { id: "tlc", no: "2", name: "교수학습개발원", mapName: "교수학습 개발원", nameEn: "Teaching Center", x: 45, y: 4, w: 9, h: 7, roof: "RED" },
  { id: "social", no: "3", name: "사회과학관", mapName: "사회과학관", nameEn: "Social Sciences Hall", x: 6, y: 32, w: 12, h: 8, roof: "GRAY" },
  { id: "union", no: "4", name: "학생회관 및 기숙사", mapName: "학생회관 및 기숙사", nameEn: "Student Union & Dorm", x: 4, y: 17, w: 13, h: 11, roof: "GRAY" },
  { id: "law", no: "5", name: "법학관", nameEn: "Law Hall", x: 18, y: 15, w: 6, h: 11, roof: "GRAY" },
  { id: "grad", no: "6", name: "대학원", nameEn: "Graduate School", x: 66, y: 28, w: 9, h: 13, roof: "GRAY" },
  { id: "flc", no: "7", name: "외국어연수평가원", mapName: "외국어 연수평가원", nameEn: "Language Center", x: 54, y: 11, w: 8, h: 6, roof: "GRAY" },
  { id: "intl", no: "8", name: "국제관", nameEn: "International Hall", x: 62, y: 18, w: 8, h: 7, roof: "GRAY" },
  { id: "library", no: "9", name: "도서관", nameEn: "Library", x: 12, y: 46, w: 14, h: 10, roof: "BLUE" },
  { id: "faculty", no: "10", name: "교수연구동", nameEn: "Faculty Research", x: 15, y: 61, w: 8, h: 6, roof: "RED" },
  { id: "club", no: "11", name: "교수회관", nameEn: "Faculty Club", x: 24, y: 58, w: 13, h: 9, roof: "GRAY" },
  { id: "press", no: "12", name: "출판부", nameEn: "Univ. Press", x: 66, y: 46, w: 7, h: 5, roof: "RED" },
  { id: "gatehouse", no: "13", name: "정문안내실", mapName: "정문 안내실", nameEn: "Gate Office", x: 53, y: 52, w: 5, h: 4, roof: "BLUE" },
  { id: "history", no: "14", name: "역사관", nameEn: "History Hall", x: 38, y: 20, w: 6, h: 5, roof: "RED" },
  { id: "minerva", no: "B", name: "Minerva Complex", nameEn: "Minerva Complex", x: 45, y: 21, w: 7, h: 5, roof: "BLUE" },
  { id: "cyber", no: "C", name: "사이버관", nameEn: "Cyber Hall", x: 39, y: 48, w: 12, h: 11, roof: "GRAY", notch: { w: 4, h: 4 } },
];

export const OPEN_SPACES = [
  { id: "square", no: "16", name: "Minerva Square", nameEn: "Minerva Square", x: 29, y: 30, w: 13, h: 8, tile: "PLAZA" },
  { id: "field", no: "17", name: "대운동장", nameEn: "Main Field", x: 47, y: 31, w: 17, h: 15, tile: "FIELD" },
  { id: "rest", no: "18", name: "휴게공간 오디", mapName: "휴게공간 오디", nameEn: "Odi Lounge", x: 6, y: 58, w: 6, h: 5, tile: "PLAZA" },
];

const GATE_PLAZA = { x: 51, y: 47, w: 13, h: 14 };
const LAWN = { x: 20, y: 31, w: 9, h: 12 };
const FOREST_ZONES = [
  { x: 26, y: 46, w: 11, h: 11 },
  { x: 38, y: 12, w: 23, h: 8 },
  { x: 46, y: 29, w: 18, h: 2 },
];

// { x, y, w, h } 길 사각형 목록. 길 모양은 시연용으로 단순화했습니다.
const PATHS = [
  { x: 17, y: 27, w: 49, h: 2 }, // 본관 앞 큰길
  { x: 4, y: 43, w: 43, h: 2 }, // 서쪽 큰길
  { x: 44, y: 28, w: 2, h: 20 }, // 운동장 서쪽 길
  { x: 44, y: 46, w: 9, h: 2 }, // 정문 광장 연결
  { x: 64, y: 25, w: 2, h: 28 }, // 운동장 동쪽 길
  { x: 64, y: 25, w: 4, h: 2 }, // 국제관 입구
  { x: 64, y: 41, w: 8, h: 2 }, // 대학원 입구
  { x: 62, y: 51, w: 9, h: 2 }, // 출판부 입구
  { x: 18, y: 27, w: 2, h: 18 }, // 법학관 남쪽 길
  { x: 4, y: 29, w: 16, h: 2 }, // 학생회관 앞 길
  { x: 10, y: 28, w: 2, h: 2 }, // 학생회관 입구
  { x: 12, y: 40, w: 2, h: 4 }, // 사회과학관 입구
  { x: 21, y: 26, w: 2, h: 2 }, // 법학관 입구
  { x: 30, y: 25, w: 2, h: 5 }, // 본관 입구
  { x: 41, y: 25, w: 2, h: 3 }, // 역사관 입구
  { x: 48, y: 26, w: 2, h: 2 }, // Minerva Complex 입구
  { x: 9, y: 44, w: 2, h: 14 }, // 도서관 서쪽 길
  { x: 9, y: 56, w: 30, h: 2 }, // 도서관 앞 길
  { x: 13, y: 58, w: 2, h: 11 }, // 교수연구동 서쪽 길
  { x: 13, y: 67, w: 26, h: 2 }, // 교수회관 앞 길
  { x: 37, y: 44, w: 2, h: 25 }, // 사이버관 서쪽 길
  { x: 37, y: 59, w: 15, h: 2 }, // 사이버관 입구
  { x: 40, y: 12, w: 2, h: 3 }, // 인문과학관 입구
  { x: 40, y: 13, w: 11, h: 2 }, // 인문과학관 앞 길
  { x: 49, y: 11, w: 2, h: 9 }, // 교수학습개발원 입구
  { x: 49, y: 18, w: 11, h: 2 }, // 북쪽 연결길
  { x: 58, y: 17, w: 2, h: 11 }, // 외국어연수평가원 입구
  { x: 57, y: 61, w: 2, h: 10 }, // 정문 진입로
];

const EMPTY = -1;

export function doorTile(building) {
  return { x: building.x + Math.floor(building.w / 2), y: building.y + building.h - 1 };
}

export function buildCampusLayers() {
  const ground = Array.from({ length: MAP_HEIGHT }, () => new Array(MAP_WIDTH).fill(TILE.GRASS));
  const solid = Array.from({ length: MAP_HEIGHT }, () => new Array(MAP_WIDTH).fill(EMPTY));

  let seed = 2026;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const paint = (rect, tile) => {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) ground[y][x] = tile;
    }
  };
  const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (random() < 0.04) ground[y][x] = TILE.GRASS_FLOWER;
    }
  }

  paint(LAWN, TILE.LAWN);
  PATHS.forEach((p) => paint(p, TILE.PATH));
  paint(GATE_PLAZA, TILE.PLAZA);

  OPEN_SPACES.forEach((s) => {
    paint(s, TILE[s.tile]);
    if (s.tile === "FIELD") paint({ x: s.x, y: s.y + Math.floor(s.h / 2), w: s.w, h: 1 }, TILE.FIELD_LINE);
  });

  BUILDINGS.forEach((b) => {
    for (let row = 0; row < b.h; row++) {
      for (let col = 0; col < b.w; col++) {
        if (b.notch && col < b.notch.w && row < b.notch.h) continue;
        let tile = TILE[`ROOF_${b.roof}`];
        if (row === b.h - 3 || (b.notch && col < b.notch.w && row === b.notch.h)) tile = TILE[`EAVE_${b.roof}`];
        if (row >= b.h - 2) tile = col % 2 === 1 ? TILE.WINDOW : TILE.WALL;
        solid[b.y + row][b.x + col] = tile;
      }
    }
    const door = doorTile(b);
    solid[door.y][door.x] = TILE.DOOR;
  });

  // 맵 가장자리는 나무 울타리입니다.
  for (let x = 0; x < MAP_WIDTH; x++) {
    solid[0][x] = TILE.TREE;
    solid[MAP_HEIGHT - 1][x] = TILE.TREE;
  }
  for (let y = 0; y < MAP_HEIGHT; y++) {
    solid[y][0] = TILE.TREE;
    solid[y][MAP_WIDTH - 1] = TILE.TREE;
  }

  // 나무는 잔디에만, 다른 나무나 건물과 붙지 않게 심어 통로가 막히지 않게 합니다.
  const isGrass = (t) => t === TILE.GRASS || t === TILE.GRASS_FLOWER;
  const isClear = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (solid[y + dy][x + dx] !== EMPTY || !isGrass(ground[y + dy][x + dx])) return false;
      }
    }
    return true;
  };
  for (let y = 2; y < MAP_HEIGHT - 2; y++) {
    for (let x = 2; x < MAP_WIDTH - 2; x++) {
      const density = FOREST_ZONES.some((z) => inRect(x, y, z)) ? 0.5 : 0.07;
      if (random() < density && isClear(x, y)) solid[y][x] = TILE.TREE;
    }
  }

  return { ground, solid };
}
