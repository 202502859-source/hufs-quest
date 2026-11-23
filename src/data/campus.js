import { TILE } from "../gfx/textures.js";
import { buildingInfo } from "./buildingInfo.js";

/*
 * 서울캠퍼스 맵 배치입니다. 기준은 docs/GRAPHICS.md(1단계 확정, 2026-11-22)입니다.
 * - 북쪽이 위, 1타일 = 4m, 88 × 90타일(352m × 360m).
 * - 건물 위치는 HUFS MAP 공식 좌표, 모양 · 크기는 위성 사진을 따라 그렸습니다(사진은 저장소에 넣지 않음).
 * - 이 파일에는 건물 ID와 위치만 둡니다. 이름 · 용도 · 층별 사무실 · 출처는 buildingInfo.js에 있습니다.
 * - 바닥은 아래 GROUND 격자(한 글자 = 한 타일)로, 건물은 BUILDING_LAYOUT의 parts(사각형 1~4개)로 그립니다.
 *   GROUND 안의 건물 글자는 보기용이며, tests/campusLayout.test.js가 parts와 같은 자리인지 확인합니다.
 *   건물을 옮기면 parts · door와 GROUND 글자를 함께 고칩니다.
 */
export const MAP_WIDTH = 88;
export const MAP_HEIGHT = 90;
// 정문 & 진입광장. 시작 화면에서 정문안내실 간판이 상단 검색창 · 오른쪽 퀘스트 패널에 가리지 않는 자리입니다.
export const SPAWN = { x: 77, y: 57 };

// HUFS MAP 공식 좌표(기준점 37.5975, 127.0585에서 잰 미터, E=동쪽+, N=북쪽+)를 타일로 바꿉니다.
export const officialToTile = (E, N) => ({ x: Math.floor((E + 152) / 4), y: Math.floor((128 - N) / 4) });

/*
 * 건물: parts는 [x, y, w, h] 타일 사각형, door는 입구 칸과 바라보는 방향(S · N · E · W).
 * official은 HUFS MAP 공식 좌표 [E, N]입니다(정문안내실은 자체 좌표가 없어 null).
 * height는 위성 사진 그림자로 추정한 3단계(low · mid · high)로, 남쪽 벽 줄 수를 정합니다(층수 숫자 아님).
 * underground는 지하 건물: 지상에는 유리 천창 줄과 입구 계단 한 칸만 그립니다.
 * roof는 2단계까지 지금 지붕 그림을 그대로 씁니다. 실제 옥상 색은 3단계에서 GRAPHICS.md 팔레트로 바꿉니다.
 */
const BUILDING_LAYOUT = [
  { id: "main", official: [-58, 2], parts: [[9, 27, 18, 5], [21, 32, 7, 8], [10, 42, 18, 5]], door: { x: 24, y: 39, face: "S" }, roof: "BLUE", height: "high" },
  { id: "humanities", official: [-96, 54], parts: [[3, 13, 6, 11], [9, 11, 7, 14]], door: { x: 12, y: 24, face: "S" }, roof: "RED", height: "mid" },
  { id: "tlc", official: [-50, 96], parts: [[18, 5, 14, 5]], door: { x: 25, y: 9, face: "S" }, roof: "RED", height: "mid" },
  { id: "flc", official: [7, 99], parts: [[34, 6, 11, 5]], door: { x: 38, y: 10, face: "S" }, roof: "GRAY", height: "mid" },
  { id: "history", official: [-22, 16], parts: [[30, 25, 7, 8]], door: { x: 33, y: 32, face: "S" }, roof: "RED", height: "mid" },
  { id: "minerva", official: [-1, -25], parts: [[36, 36, 3, 11]], door: { x: 36, y: 40, face: "W" }, roof: "GRAY", height: "low", underground: true, mapLabelAt: [37.5, 45] },
  { id: "law", official: [-94, -84], parts: [[12, 50, 6, 7]], door: { x: 14, y: 56, face: "S" }, roof: "GRAY", height: "mid" },
  { id: "union", official: [-119, -95], parts: [[3, 48, 6, 12], [6, 60, 13, 6], [6, 66, 6, 8]], door: { x: 15, y: 65, face: "S" }, roof: "GRAY", height: "mid" },
  { id: "social", official: [-72, -155], parts: [[14, 69, 14, 5]], door: { x: 20, y: 69, face: "N" }, roof: "GRAY", height: "mid" },
  { id: "library", official: [18, -180], parts: [[35, 72, 17, 9]], door: { x: 43, y: 72, face: "N" }, roof: "BLUE", height: "high" },
  { id: "intl", official: [77, 54], parts: [[51, 12, 6, 6], [57, 14, 5, 5], [60, 18, 5, 4]], door: { x: 62, y: 21, face: "S" }, roof: "GRAY", height: "mid" },
  { id: "grad", official: [143, 6], parts: [[64, 24, 6, 4], [68, 27, 8, 4], [74, 30, 8, 3]], door: { x: 71, y: 30, face: "S" }, roof: "GRAY", height: "mid" },
  { id: "press", official: [189, -16], parts: [[84, 34, 4, 4]], door: { x: 84, y: 34, face: "W" }, roof: "RED", height: "low" },
  { id: "cyber", official: [106, -127], parts: [[62, 57, 10, 6], [56, 63, 14, 5], [64, 68, 7, 4]], door: { x: 60, y: 67, face: "S" }, roof: "GRAY", height: "high" },
  { id: "club", official: [82, -190], parts: [[56, 70, 6, 4], [54, 74, 10, 6], [55, 80, 7, 4]], door: { x: 54, y: 79, face: "S" }, roof: "GRAY", height: "mid" },
  // 교수연구동은 공식 좌표가 이문로25길 남쪽(길 건너)이라 건널목(x)으로 이어 줍니다.
  { id: "faculty", official: [44, -220], parts: [[44, 85, 9, 5]], door: { x: 47, y: 85, face: "N" }, roof: "RED", height: "mid" },
  // 정문안내실: 자체 좌표 없음. 캠퍼스 밖에서 정문을 바라볼 때 오른쪽(정문 광장 북동쪽 모서리)에 둡니다.
  { id: "gatehouse", official: null, parts: [[77, 53, 2, 3]], door: { x: 77, y: 55, face: "S" }, roof: "BLUE", height: "low" },
];

// 이름이 붙은 열린 공간(건물이 아님). 휴게공간 오디(rest)는 좌표가 없어 이번 맵에서 뺐습니다(buildingInfo.js onMap: false).
const OPEN_SPACE_LAYOUT = [
  { id: "field", official: [102, -35], x: 53, y: 35, w: 23, h: 12 },
  { id: "square", official: [-7, -48], x: 29, y: 33, w: 7, h: 14, mapLabelAt: [32, 36] },
  { id: "lawn", official: [-9, -106], x: 30, y: 48, w: 9, h: 16 },
  { id: "gate", official: [145, -113], x: 72, y: 56, w: 7, h: 6 },
];

/*
 * 바닥 격자(GRAPHICS.md 9장). 글자 뜻:
 *   "  잔디        .  보행로 · 광장(포장)   :  흙 광장      =  차도(아스팔트)   P  주차장
 *   F  운동장(트랙 포함)   T  숲(걸을 수 없음)   -  바깥 도로(걸을 수 없음)   #  캠퍼스 밖(그리지 않음)
 *   x  건널목     %  유리 천창(걸을 수 없음)   o  분수(걸을 수 없음)
 *   대문자 · 그 밖의 글자: 건물 자리(BUILDING_CHAR). 바닥은 포장으로 칠하고 그 위에 건물을 그립니다.
 */
export const GROUND = [
  "########################################################################################",
  "###############--------------------------###############################################",
  "###############--------------------------###############################################",
  "##############-----------------------------#############################################",
  "############----..\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"----###########################################",
  "#########-----T\"..DDDDDDDDDDDDDD\"\"\"\"\"\"\"\"\"\"\"----#########################################",
  "######------TTT\"..DDDDDDDDDDDDDD\"\"EEEEEEEEEEE----#######################################",
  "####-----TTTTTT\"..DDDDDDDDDDDDDD\"\"EEEEEEEEEEE\"\"----#####################################",
  "##----TTTTTTTTT\"..DDDDDDDDDDDDDD\"\"EEEEEEEEEEE\"\"\"\"----###################################",
  "----TTTTTTTTTTT\"..DDDDDDDDDDDDDD\"\"EEEEEEEEEEE\"\"\"\"\"\"----#################################",
  "---TTTTTTTTTTTT\"..\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"EEEEEEEEEEE======\"\"----###############################",
  "---TTTTTTHHHHHHH..TTTTTTT.\"\"\"\"\"\"\"\"\"\"\"\"\"====PPPPPPPP\"\"\"\"----#############################",
  "---TTTTTTHHHHHHH..TTTTTTT.\"\"\"\"\"\"\"\"\"\"\"\"\"====PPPPPPPPIIIIII----###########################",
  "---HHHHHHHHHHHHH..TT....T.\"\"\"\"\"\"\"\"\"\"\"\"\"====PPPPPPPPIIIIIITT---##########################",
  "---HHHHHHHHHHHHH..TT....T.\"\"\"\"\"\"\"\"\"\"\"\"\"====PPPPPPPPIIIIIIIIIII--########################",
  "---HHHHHHHHHHHHH..TT.oo...\"\"\"\"\"\"\"\"\"\"\"\"\"====PPPPPPPPIIIIIIIIIII----######################",
  "---HHHHHHHHHHHHH..TT......\"\"\"\"\"\"\"\"\"\"\"\"\"====PPPPPPPPIIIIIIIIIII\"\"---#####################",
  "---HHHHHHHHHHHHH..TT....T.\"\"\"\"\"\"\"\"\"\"\"\"\"====PPPPPPPPIIIIIIIIIII\"\"\"\"---###################",
  "---HHHHHHHHHHHHH..TTTTTTT.\"\"\"\"\"\"\"\"\"\"\"\"\"====PPPPPPPPPPPPPPIIIIIIII\"\"----#################",
  "---HHHHHHHHHHHHH..TTTTTTT.\"\"\"\"\"\"\"\"\"\"\"\"\"====\"\"\"PPPPPPPPPPP\"\"\"IIIII\"\"\"\"---################",
  "---HHHHHHHHHHHHH..TTTTTTT.\"\"\"\"\"\"\"\"\"\"\"\"\"====\"\"\"PPPPPPPPPPP\"\"\"IIIII\"\"\"\"\"\"----#############",
  "---HHHHHHHHHHHHH..============================PPPPPPPPPPP\"\"\"IIIII\"\"\"\"\"\"\"-----###########",
  "---HHHHHHHHHHHHH=================================\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"---##########",
  "---HHHHHHHHHHHHH===========================TT=======T\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"---########",
  "---\"\"\"\"\"\"HHHHHHH\"\"\"\"\"\"\"\"\"\"\"\"..\"\"\"\"\"\"\"..====TTTTT=======\"\"\"\"\"\"\"\"\"GGGGGG\"\"\"\"\"\"\"\"----######",
  "---===============\"\"\"\"\"\"\"\"\"\"..BBBBBBB..====TTTTTTTT======TTTTTTTGGGGGG\"\"\"\"\"\"\"\"\"\"----####",
  "---===============\"\"\"\"\"\"\"\"\"\"..BBBBBBB..====TTTTTTTTTTT======TTTTGGGGGG\"\"\"\"\"\"\"\"\"\"\"\"----##",
  "---TTTTT\"MMMMMMMMMMMMMMMMMM\"..BBBBBBB..====TTTTTTTTTTTTT======TTGGGGGGGGGGGG\"\"\"\"\"\"\"\"----",
  "---TTTTT\"MMMMMMMMMMMMMMMMMM\"..BBBBBBB..====TTTTTTTTTTTTTTTT=====T\"\"\"GGGGGGGG\"\"\"\"\"\"\"\"\"\"--",
  "---TTTTT\"MMMMMMMMMMMMMMMMMM\"..BBBBBBB..====TTTTTTTTTTTTTTTTTT====\"\"\"GGGGGGGG\"\"\"\"\"\"TTTTTT",
  "---TTTTT\"MMMMMMMMMMMMMMMMMM\"..BBBBBBB..====TTTTTTTTTTTTTTTTTTTT====\"GGGGGGGGGGGGGGTTTTTT",
  "---TTTTT\"MMMMMMMMMMMMMMMMMM\"..BBBBBBB..====TTTTTTTTTTTTTTTTTTTTT====\"\"\"\"\"\"GGGGGGGGTTTTTT",
  "---TTTTT\"\"...........MMMMMMM..BBBBBBB..====TTTTTTTTTTTTTTTTTTTTTT\"====\"\"\"\"GGGGGGGGTTTTTT",
  "---TTTTT\"\"...........MMMMMMM........\"\"\"====TTTTTTTTTTTTTTTTTTTTTT\"\"\"\"===============TTTT",
  "---TTTTT\"\"...........MMMMMMM..\".....\"\"\"====TTTTTTTTTT\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"============ZZZZ",
  "---TTTTT\"\"...........MMMMMMM...\"....\"\"\"====TTTTTTTTTTFFFFFFFFFFFFFFFFFFFFFFFTTTTTTTTZZZZ",
  "---TTTTT\"\"...........MMMMMMM....\"...OOO====TTTTTTTTTTFFFFFFFFFFFFFFFFFFFFFFFTTTTTTTTZZZZ",
  "---TTTTT\"\"...........MMMMMMM.....\"..OOO====TTTTTTTTTTFFFFFFFFFFFFFFFFFFFFFFFTTTTTTTTZZZZ",
  "---TTTTT\"\"...........MMMMMMM......\".OOO====TTTTTTTTTTFFFFFFFFFFFFFFFFFFFFFFFTTTTTTTTTTTT",
  "---TTTTT\"\"...........MMMMMMM.......\"OOO====TTTTTTTTTTFFFFFFFFFFFFFFFFFFFFFFFTTTTTTTTTTTT",
  "---TTTTT\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"........OOO====TTTTTTTTTTFFFFFFFFFFFFFFFFFFFFFFFTTTTTTTTTTTT",
  "---.....\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"........OOO====TTTTTTTTTTFFFFFFFFFFFFFFFFFFFFFFFTTTTTTTTTTTT",
  "---.....\"\"MMMMMMMMMMMMMMMMMM........OOO====TTTTTTTTTTFFFFFFFFFFFFFFFFFFFFFFFTTTTTTTTTTTT",
  "---.....\"\"MMMMMMMMMMMMMMMMMM........OOO=======\"\"\"\"\"\"\"FFFFFFFFFFFFFFFFFFFFFFFTTTTTTTTTTTT",
  "---.....\"\"MMMMMMMMMMMMMMMMMM........OOO=========\"\"\"\"\"FFFFFFFFFFFFFFFFFFFFFFFTTTTTTTTTTTT",
  "---.....\"\"MMMMMMMMMMMMMMMMMM........OOO===========\"\"\"FFFFFFFFFFFFFFFFFFFFFFFTTTTTTTTTTTT",
  "---\"\"\"\"\"\"\"MMMMMMMMMMMMMMMMMM........OOO====\"\"=======\"FFFFFFFFFFFFFFFFFFFFFFFTTTTTTTT\"\"\"-",
  "---\"\"\"\"\"\".....................\"\"\"\"\"\"%%%====\"\"\"\"========\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"TTTTTTTT\"\"\"-",
  "---UUUUUU.....................\"\"\"\"\"\"\"\"\"====TTTTTT=========\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"--",
  "---UUUUUU\"\"\"\"\"\"\"\"\"..:.::::.:...\"\"\"\"\"\"\".====TTTTTTTT==========\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"--",
  "---UUUUUU\"\"\"LLLLLL..:.::::.:..\".\"\"\"\"\".\"====TTTTTTTTTTT==========\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"---",
  "---UUUUUU\"\"\"LLLLLL..::.::.::..\"\".\"\"\".\"\"====TTTTTTTTTTTTT\"=========\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"---",
  "---UUUUUU\"\"\"LLLLLL..::.::.::..\"\"\".\".\"\"\"====TTTTTTTTTTTTT\"\"\"\"========\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"---#",
  "---UUUUUU\"\"\"LLLLLL..:::..:::..\"\"\"\".\"\"\"\"====TTTTTTTTTTTTT\"\"\"\"\"\"\"=======\"\"\"\"\"\"\"QQ\"\"\"\"\"---#",
  "---UUUUUU\"\"\"LLLLLL..:::..:::..\"\"\".\".\"\"\"====TTTTTTTTTTTTT\"\"\"\"\"\"\"\"\"=======\"\"\"\"\"QQ\"\"\"\"---##",
  "---UUUUUU\"\"\"LLLLLL..:::..:::..\"\".\"\"\".\"\"====TTTTTTTTTTTTT\"\"\"\"\"\"\"\"\"\"\"=========\"QQ\"\"\"\"---##",
  "---UUUUUU\"\"\"LLLLLL..:::..:::..\".\"\"\"\"\".\"====TTTTTTTTTTTTT\"\"\"\"\"\"\"\"\"\"\"\"\"=========.\"\"\"---###",
  "---UUUUUU...\"\"\"\"\"\"..::.::.::...\"\"\"\"\"\"\".====TTTTTTTTTTTTT\"\"\"\"\"\"CCCCCCCCCC=======\"\"---####",
  "---UUUUUU...\"\"\"\"\"\"..::.::.::...........====TTTTTTTTTTTTT\"\"\"\"\"\"CCCCCCCCCC...====\"\"---####",
  "---UUUUUU...\"\"\"\"\"\"..:.::::.:..\"\"\"\"\"\"\"\"\"====TTTTTTTTTTTTT\"\"\"\"\"\"CCCCCCCCCC.....==\"---#####",
  "---TTTUUUUUUUUUUUUU.:.::::.:..\"\"\"\"\"\"\"\"\"====TTTTTTTTTTTTT\"\"\"\"\"\"CCCCCCCCCC.......\"---#####",
  "---TTTUUUUUUUUUUUUU..::::::............====TTTTTTTTTTTTT\"\"\"\"\"\"CCCCCCCCCC.......---######",
  "---TTTUUUUUUUUUUUUU.TTTTTTTT..\"\"\"\"\"\"\"\"\"====TTTTTTTTTTTTT\"\"\"\"\"\"CCCCCCCCCC\"\"\"\"\"\"\"---######",
  "---TTTUUUUUUUUUUUUU.TTTTTTTT..\"\"\"\"\"\"\"\"\"====TTTTTTTTTTTTTCCCCCCCCCCCCCC\"\"\"\"\"\"\"\"---#######",
  "---TTTUUUUUUUUUUUUU.TTTTTTTT..TTTTTTTT\"====TTTTTTTTTTTTTCCCCCCCCCCCCCC\"\"\"\"\"\"\"\"---#######",
  "---TTTUUUUUUUUUUUUU.TTTTTTTT..TTTTTTTT\"=================CCCCCCCCCCCCCC\"\"\"\"\"\"\"---########",
  "---TTTUUUUUU...........................=================CCCCCCCCCCCCCC\"\"\"\"\"\"\"---########",
  "---TTTUUUUUU............................................CCCCCCCCCCCCCC\"\"\"\"\"\"---#########",
  "---TTTUUUUUU\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"..........................\"\"\"\"\"\"\"\"CCCCCCC\"\"\"\"\"---#########",
  "---TTTUUUUUU\"\"SSSSSSSSSSSSSS\"\"..........................\"\"\"\"\"\"\"\"CCCCCCC\"\"\"\"---##########",
  "---TTTUUUUUU\"\"SSSSSSSSSSSSSS\"\"..........................KKKKKK\"\"CCCCCCC\"\"\"\"---##########",
  "---TTTUUUUUU\"\"SSSSSSSSSSSSSS\"\"..........................KKKKKK\"\"CCCCCCC\"\"\"---###########",
  "---TTTUUUUUU\"\"SSSSSSSSSSSSSS\"\".....YYYYYYYYYYYYYYYYY..\"\"KKKKKK\"\"\"\"\"\"\"\"\"\"\"\"---###########",
  "---TTTUUUUUU\"\"SSSSSSSSSSSSSS\"\".....YYYYYYYYYYYYYYYYY..\"\"KKKKKK\"\"\"\"\"\"\"\"\"\"----############",
  "---############################....YYYYYYYYYYYYYYYYY..KKKKKKKKKK\"\"\"\"\"\"\"----#############",
  "---############################....YYYYYYYYYYYYYYYYY..KKKKKKKKKK\"\"\"\"\"\"\"----#############",
  "---############################....YYYYYYYYYYYYYYYYY..KKKKKKKKKK\"\"\"\"\"\"----##############",
  "---############################....YYYYYYYYYYYYYYYYY..KKKKKKKKKK\"\"\"\"\"\"----##############",
  "---############################....YYYYYYYYYYYYYYYYY..KKKKKKKKKK\"\"\"\"\"---################",
  "---############################....YYYYYYYYYYYYYYYYY..KKKKKKKKKK\"\"\"\"---#################",
  "---############################....YYYYYYYYYYYYYYYYY..\"KKKKKKK\"\"\"\"\"\"---#################",
  "---############################....\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"..\"KKKKKKK\"\"\"\"\"---##################",
  "---############################....\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"..\"KKKKKKK\"\"\"\"\"---##################",
  "---############################\"---------------xx----\"\"KKKKKKK\"\"\"\"---###################",
  "---############################\"---------------xx-----\"\"\"\"\"\"\"\"\"\"\"\"---###################",
  "--------------------------------############RRRRRRRRR---\"\"\"\"\"\"\"\"\"---####################",
  "--------------------------------############RRRRRRRRR#---\"\"\"\"\"\"\"\"---####################",
  "############################################RRRRRRRRR###--\"\"\"\"\"\"---#####################",
  "############################################RRRRRRRRR####---\"\"\"\"---#####################",
  "############################################RRRRRRRRR#####---\"\"---######################",
];

export const BUILDING_CHAR = {
  main: "M", humanities: "H", tlc: "D", flc: "E", history: "B", minerva: "O", law: "L", union: "U", social: "S",
  library: "Y", intl: "I", grad: "G", press: "Z", cyber: "C", club: "K", faculty: "R", gatehouse: "Q",
};

// 걸어 다닐 수 있는 바닥 글자입니다.
export const WALKABLE_GROUND = new Set(['"', ".", ":", "=", "P", "F", "x"]);
const BLOCKED_GROUND = { T: "TREE", "-": "OUTER_ROAD", "#": "OUTSIDE", "%": "SKYLIGHT", o: "FOUNTAIN" };
const GROUND_TILE = { '"': "GRASS", ".": "PATH", ":": "DIRT", "=": "ROAD", P: "PARKING", F: "FIELD", x: "CROSSWALK", T: "GRASS", "-": "OUTER_ROAD", "#": "OUTSIDE", "%": "PATH", o: "PATH" };

const FACING = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
const key = (x, y) => `${x},${y}`;
const area = ([, , w, h]) => w * h;

// 배치에 buildingInfo.js의 이름(name · mapName · nameEn)을 붙이고, 화면 코드가 쓰는 x · y · w · h(전체를 감싸는 사각형)와 이름표 자리를 더합니다.
const withNames = (place) => {
  const { name, mapName, nameEn } = buildingInfo(place.id);
  const parts = place.parts ?? [[place.x, place.y, place.w, place.h]];
  const x = Math.min(...parts.map((p) => p[0]));
  const y = Math.min(...parts.map((p) => p[1]));
  const w = Math.max(...parts.map((p) => p[0] + p[2])) - x;
  const h = Math.max(...parts.map((p) => p[1] + p[3])) - y;
  const [lx, ly, lw, lh] = parts.reduce((a, b) => (area(b) > area(a) ? b : a));
  // 맵 위 이름표 높이: 건물은 가장 큰 사각형의 위쪽 한 칸 아래(북쪽 입구면 입구를 가리지 않게 더 아래),
  // 열린 공간은 가운데(시작 위치 캐릭터를 가리지 않게)
  const tagY = place.parts ? ly + (place.door?.face === "N" ? 2.5 : 1) : ly + lh / 2;
  // 전체 지도 이름표는 가장 큰 사각형 가운데. 이웃 이름표와 겹치는 곳만 mapLabelAt으로 자리를 정합니다.
  const [mx, my] = place.mapLabelAt ?? [lx + lw / 2, ly + lh / 2];
  return { ...place, parts, x, y, w, h, label: { x: mx, y: my, tagX: lx + lw / 2, tagY }, name, mapName, nameEn };
};
export const BUILDINGS = BUILDING_LAYOUT.map(withNames);
export const OPEN_SPACES = OPEN_SPACE_LAYOUT.map(withNames);

// 건물이 차지하는 칸 → 건물 ID
export const BUILDING_AT = new Map();
BUILDINGS.forEach((b) => b.parts.forEach(([px, py, pw, ph]) => {
  for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) BUILDING_AT.set(key(x, y), b.id);
}));

export const doorTile = (building) => ({ x: building.door.x, y: building.door.y });

// 입구 바로 앞 칸(사람이 서는 칸)입니다.
export function doorFront(building) {
  const [dx, dy] = FACING[building.door.face];
  return { x: building.door.x + dx, y: building.door.y + dy };
}

const insideMap = (x, y) => x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT;
const DOOR_FRONTS = new Set(BUILDINGS.map((b) => key(doorFront(b).x, doorFront(b).y)));
const freeGround = (x, y) => insideMap(x, y) && WALKABLE_GROUND.has(GROUND[y][x]) && !BUILDING_AT.has(key(x, y));

// 안내원(NPC)은 입구 앞 칸의 옆에 세워 입구 앞을 막지 않습니다. 왼쪽이 막혀 있으면 오른쪽에 섭니다.
export function npcTile(building) {
  const front = doorFront(building);
  const [dx, dy] = FACING[building.door.face];
  const sides = dy ? [[-1, 0], [1, 0]] : [[0, 1], [0, -1]];
  for (const [sx, sy] of sides) {
    const x = front.x + sx;
    const y = front.y + sy;
    if (freeGround(x, y) && !DOOR_FRONTS.has(key(x, y))) return { x, y };
  }
  return { x: front.x + sides[0][0] + dx, y: front.y + sides[0][1] + dy };
}

const EMPTY = -1;
const WALL_ROWS = { low: 1, mid: 2, high: 3 };

export function buildCampusLayers() {
  const ground = Array.from({ length: MAP_HEIGHT }, () => new Array(MAP_WIDTH).fill(TILE.GRASS));
  const solid = Array.from({ length: MAP_HEIGHT }, () => new Array(MAP_WIDTH).fill(EMPTY));

  let seed = 2026;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const c = GROUND[y][x];
      ground[y][x] = TILE[GROUND_TILE[c] ?? "PATH"];
      if (c === '"' && random() < 0.04) ground[y][x] = TILE.GRASS_FLOWER;
      if (BLOCKED_GROUND[c]) solid[y][x] = TILE[BLOCKED_GROUND[c]];
    }
  }

  // 운동장: 둘레 한 줄은 붉은 트랙, 가운데 세로 중앙선
  const field = OPEN_SPACES.find((s) => s.id === "field");
  for (let y = field.y; y < field.y + field.h; y++) {
    for (let x = field.x; x < field.x + field.w; x++) {
      const edge = x === field.x || y === field.y || x === field.x + field.w - 1 || y === field.y + field.h - 1;
      if (edge) ground[y][x] = TILE.TRACK;
      else if (x === field.x + Math.floor(field.w / 2)) ground[y][x] = TILE.FIELD_LINE_V;
    }
  }

  // 건물: 각 칸 아래로 같은 건물이 몇 칸 더 있는지(k)로 남쪽 벽 · 처마 · 옥상을 정합니다.
  BUILDINGS.forEach((b) => {
    const wallRows = WALL_ROWS[b.height] ?? 2;
    b.parts.forEach(([px, py, pw, ph]) => {
      for (let y = py; y < py + ph; y++) {
        for (let x = px; x < px + pw; x++) {
          let tile;
          if (b.underground) {
            tile = TILE.SKYLIGHT;
          } else {
            let k = 0;
            while (BUILDING_AT.get(key(x, y + k + 1)) === b.id) k++;
            if (k < wallRows) tile = x % 2 === 1 ? TILE.WINDOW : TILE.WALL;
            else if (k === wallRows) tile = TILE[`EAVE_${b.roof}`];
            else tile = TILE[`ROOF_${b.roof}`];
          }
          ground[y][x] = TILE.PATH;
          solid[y][x] = tile;
        }
      }
    });
    const door = doorTile(b);
    solid[door.y][door.x] = b.underground ? TILE.STAIRS : b.door.face === "S" ? TILE.DOOR : TILE.ENTRANCE;
  });

  // 잔디 위 드문드문한 나무. 다른 나무 · 건물과 붙지 않게 하고, 입구 앞 · 안내원 자리 · 시작 위치는 비워 둡니다.
  const reserved = new Set([key(SPAWN.x, SPAWN.y), ...DOOR_FRONTS, ...BUILDINGS.map((b) => key(npcTile(b).x, npcTile(b).y))]);
  const isGrass = (t) => t === TILE.GRASS || t === TILE.GRASS_FLOWER;
  const isClear = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (solid[y + dy][x + dx] !== EMPTY || !isGrass(ground[y + dy][x + dx]) || reserved.has(key(x + dx, y + dy))) return false;
      }
    }
    return true;
  };
  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      if (GROUND[y][x] === '"' && random() < 0.04 && isClear(x, y)) solid[y][x] = TILE.TREE;
    }
  }

  return { ground, solid };
}

// 퀴즈 상자를 놓을 수 있는 바닥(보행로 · 잔디 · 흙 광장). 차도 · 주차장 · 운동장 · 건널목에는 놓지 않습니다.
export const QUIZ_PLACEABLE = new Set([TILE.PATH, TILE.GRASS, TILE.GRASS_FLOWER, TILE.DIRT]);

// 시작 위치에서 걸어서 닿는 칸 목록(상하좌우 이동, solid가 비어 있는 칸만)입니다.
export function reachableTiles(solid, start = SPAWN) {
  const seen = new Set([key(start.x, start.y)]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    for (const [dx, dy] of Object.values(FACING)) {
      const nx = x + dx;
      const ny = y + dy;
      if (!insideMap(nx, ny) || seen.has(key(nx, ny)) || solid[ny][nx] !== EMPTY) continue;
      seen.add(key(nx, ny));
      queue.push({ x: nx, y: ny });
    }
  }
  return queue;
}

// 퀴즈 상자를 놓을 칸: 걸어서 닿고, 놓을 수 있는 바닥이며, 입구 앞 · 안내원 자리가 아닌 칸입니다.
export function quizBoxTiles(ground, solid) {
  const npcSpots = new Set(BUILDINGS.map((b) => key(npcTile(b).x, npcTile(b).y)));
  return reachableTiles(solid).filter(
    ({ x, y }) => QUIZ_PLACEABLE.has(ground[y][x]) && !DOOR_FRONTS.has(key(x, y)) && !npcSpots.has(key(x, y)),
  );
}
