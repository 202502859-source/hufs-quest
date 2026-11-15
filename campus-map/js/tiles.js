/*
 * 그래픽과 맵 생성
 * - 타일과 캐릭터를 캔버스로 직접 그려 외부 저작물 없이 동작합니다. PixelLab 에셋이 준비되면 이 파일만 교체하면 됩니다.
 * - 맵은 Tiled JSON 형식으로 만듭니다. "Tiled 맵 내보내기"로 받은 파일을 Tiled에서 수정한 뒤
 *   assets/campus.tmj로 저장하면 게임이 그 파일을 우선해서 읽습니다.
 */
const TILE = {
  grass: 1, grass2: 2, path: 3, plaza: 4, field: 5, fieldLine: 6, wall: 7, window: 8,
  roofA: 9, roofB: 10, roofC: 11, eaveA: 12, eaveB: 13, eaveC: 14, door: 15, tree: 16, hedge: 17,
  lawn: 18, wood: 19, tileFloor: 20, innerWall: 21, desk: 22, board: 23, shelf: 24, mat: 25, pc: 26, plant: 27, counter: 28,
};
const TILE_SIZE = 16;
const SHEET_COLS = 8;
const TILE_COUNT = 28;

function createTileCanvas() {
  const c = document.createElement("canvas");
  c.width = SHEET_COLS * TILE_SIZE;
  c.height = Math.ceil(TILE_COUNT / SHEET_COLS) * TILE_SIZE;
  const g = c.getContext("2d");
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const at = (gid, draw) => {
    const i = gid - 1;
    g.save();
    g.translate((i % SHEET_COLS) * TILE_SIZE, Math.floor(i / SHEET_COLS) * TILE_SIZE);
    draw((col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); });
    g.restore();
  };
  const speckle = (p, base, spots, n) => {
    p(base, 0, 0, 16, 16);
    for (let i = 0; i < n; i++) p(spots[Math.floor(rnd() * spots.length)], Math.floor(rnd() * 16), Math.floor(rnd() * 16));
  };
  const roof = (p, base, dark, light) => {
    p(base, 0, 0, 16, 16);
    for (let y = 3; y < 16; y += 4) p(dark, 0, y, 16, 1);
    for (let y = 0; y < 16; y += 4) for (let x = (y % 8 ? 0 : 4); x < 16; x += 8) p(dark, x, y, 1, 3);
    p(light, 0, 0, 16, 1);
  };
  const eave = (p, base, dark) => { p(base, 0, 0, 16, 10); p(dark, 0, 10, 16, 3); p("#00000044", 0, 13, 16, 3); p("#d8cfbd", 0, 13, 16, 3); p("#00000030", 0, 13, 16, 1); };

  at(TILE.grass, (p) => speckle(p, "#6fb35a", ["#62a54f", "#7cc066"], 26));
  at(TILE.grass2, (p) => { speckle(p, "#6fb35a", ["#62a54f", "#7cc066"], 20); p("#fff3a8", 4, 5, 2, 2); p("#f7a8b8", 11, 10, 2, 2); p("#e0604f", 12, 3); });
  at(TILE.path, (p) => speckle(p, "#d9c9a3", ["#cdbc94", "#e4d6b4"], 22));
  at(TILE.plaza, (p) => { p("#b9a48c", 0, 0, 16, 16); p("#a18c75", 0, 7, 16, 1); p("#a18c75", 0, 15, 16, 1); p("#a18c75", 7, 0, 1, 7); p("#a18c75", 15, 8, 1, 7); });
  at(TILE.field, (p) => { p("#4f9d52", 0, 0, 16, 16); p("#478f4a", 0, 0, 8, 16); });
  at(TILE.fieldLine, (p) => { p("#4f9d52", 0, 0, 16, 16); p("#f3f6ef", 0, 7, 16, 2); });
  at(TILE.wall, (p) => { p("#e9e0cd", 0, 0, 16, 16); p("#d8cdb6", 0, 15, 16, 1); p("#d8cdb6", 0, 7, 16, 1); });
  at(TILE.window, (p) => { p("#e9e0cd", 0, 0, 16, 16); p("#d8cdb6", 0, 15, 16, 1); p("#39506b", 3, 3, 10, 9); p("#7fb4d6", 4, 4, 8, 7); p("#b8dcf0", 4, 4, 3, 3); p("#39506b", 7, 4, 1, 7); });
  at(TILE.roofA, (p) => roof(p, "#2f4d7c", "#26406a", "#3d6098"));
  at(TILE.roofB, (p) => roof(p, "#a5533f", "#8c4433", "#bb6a55"));
  at(TILE.roofC, (p) => roof(p, "#5d6d7c", "#4e5c69", "#74848f"));
  at(TILE.eaveA, (p) => eave(p, "#2f4d7c", "#1d3355"));
  at(TILE.eaveB, (p) => eave(p, "#a5533f", "#6f3527"));
  at(TILE.eaveC, (p) => eave(p, "#5d6d7c", "#3d4954"));
  at(TILE.door, (p) => { p("#e9e0cd", 0, 0, 16, 16); p("#5b3a26", 2, 1, 12, 15); p("#8a5c3c", 3, 2, 4, 14); p("#8a5c3c", 9, 2, 4, 14); p("#f2c94c", 7, 9, 2, 2); });
  at(TILE.tree, (p) => { p("#6fb35a", 0, 0, 16, 16); p("#6b4a2f", 6, 11, 4, 5); p("#2f7a3f", 2, 1, 12, 11); p("#3e9150", 3, 2, 8, 6); p("#58ad66", 5, 3, 3, 2); });
  at(TILE.hedge, (p) => { p("#2f7a3f", 0, 0, 16, 16); p("#3e9150", 1, 1, 6, 5); p("#3e9150", 9, 8, 6, 5); p("#25633a", 0, 14, 16, 2); });
  at(TILE.lawn, (p) => speckle(p, "#86cc6c", ["#7abf61", "#95d87b"], 16));
  at(TILE.wood, (p) => { p("#c79a68", 0, 0, 16, 16); p("#b5875a", 0, 7, 16, 1); p("#b5875a", 0, 15, 16, 1); p("#b5875a", 5, 0, 1, 7); p("#b5875a", 12, 8, 1, 7); });
  at(TILE.tileFloor, (p) => { p("#d6dde3", 0, 0, 16, 16); p("#bcc6cf", 0, 15, 16, 1); p("#bcc6cf", 15, 0, 1, 16); });
  at(TILE.innerWall, (p) => { p("#7b8794", 0, 0, 16, 16); p("#93a0ad", 0, 0, 16, 4); p("#606b77", 0, 14, 16, 2); });
  at(TILE.desk, (p) => { p("#c79a68", 0, 0, 16, 16); p("#8a5c3c", 1, 3, 14, 9); p("#a8744d", 2, 4, 12, 3); p("#5b3a26", 2, 12, 2, 3); p("#5b3a26", 12, 12, 2, 3); });
  at(TILE.board, (p) => { p("#7b8794", 0, 0, 16, 16); p("#8a5c3c", 0, 2, 16, 11); p("#2c5a4a", 0, 3, 16, 9); p("#d9efe5", 3, 6, 7, 1); p("#d9efe5", 3, 9, 4, 1); });
  at(TILE.shelf, (p) => { p("#5b3a26", 0, 0, 16, 16); ["#c0504d", "#4f81bd", "#9bbb59", "#f2c94c", "#8064a2"].forEach((col, i) => { p(col, 1 + i * 3, 2, 2, 5); p(col, 13 - i * 3, 9, 2, 5); }); p("#3e2819", 0, 7, 16, 2); });
  at(TILE.mat, (p) => { p("#a5533f", 0, 0, 16, 16); p("#f2c94c", 2, 2, 12, 12); p("#a5533f", 3, 3, 10, 10); });
  at(TILE.pc, (p) => { p("#d6dde3", 0, 0, 16, 16); p("#8a5c3c", 0, 9, 16, 5); p("#2f3a46", 3, 1, 10, 7); p("#7fd1e8", 4, 2, 8, 5); p("#2f3a46", 7, 8, 2, 1); });
  at(TILE.plant, (p) => { p("#d6dde3", 0, 0, 16, 16); p("#a5533f", 5, 10, 6, 5); p("#2f7a3f", 3, 2, 10, 8); p("#58ad66", 5, 3, 3, 3); });
  at(TILE.counter, (p) => { p("#d6dde3", 0, 0, 16, 16); p("#2f4d7c", 0, 4, 16, 10); p("#3d6098", 0, 4, 16, 3); });
  return c;
}

/* 캐릭터: 방향별(아래, 위, 왼쪽, 오른쪽) 2프레임 스프라이트시트 */
const PALETTES = {
  hero: { hair: "#2c2433", skin: "#f4c9a0", top: "#2f6fd0", bottom: "#27323f" },
  guide: { hair: "#6b3f22", skin: "#f4c9a0", top: "#e0604f", bottom: "#3a3a3a" },
  student: { hair: "#1e1e28", skin: "#f1c29a", top: "#58ad66", bottom: "#2f3a46" },
  staff: { hair: "#3b2a1f", skin: "#f4c9a0", top: "#2f4d7c", bottom: "#1d2733" },
  prof: { hair: "#8d8d94", skin: "#eebf96", top: "#6e5a8d", bottom: "#2f2a3b" },
  intl: { hair: "#d9a441", skin: "#f7d8bd", top: "#d98a2b", bottom: "#33414f" },
  keeper: { hair: "#5a2d2d", skin: "#d9a074", top: "#f2c94c", bottom: "#4a3b2a" },
};

function createCharCanvas(pal) {
  const c = document.createElement("canvas");
  c.width = 16 * 8;
  c.height = 16;
  const g = c.getContext("2d");
  for (let dir = 0; dir < 4; dir++) {
    for (let f = 0; f < 2; f++) {
      const ox = (dir * 2 + f) * 16;
      const p = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(ox + x, y, w, h); };
      const legShift = f === 0 ? 0 : 1;
      p(pal.bottom, 5, 12, 2, 3 - legShift); p(pal.bottom, 9, 12, 2, 2 + legShift);
      p("#1a1a22", 5, 15 - legShift, 2, 1); p("#1a1a22", 9, 14 + legShift, 2, 1);
      p(pal.top, 4, 8, 8, 4);
      p(pal.skin, 3, 9, 1, 2); p(pal.skin, 12, 9, 1, 2);
      p(pal.skin, 4, 2, 8, 6);
      p(pal.hair, 4, 1, 8, 3);
      if (dir === 0) { p(pal.hair, 4, 4, 1, 1); p(pal.hair, 11, 4, 1, 1); p("#2a2230", 6, 5, 1, 1); p("#2a2230", 9, 5, 1, 1); }
      if (dir === 1) { p(pal.hair, 4, 4, 8, 4); }
      if (dir === 2) { p(pal.hair, 9, 4, 3, 3); p("#2a2230", 5, 5, 1, 1); }
      if (dir === 3) { p(pal.hair, 4, 4, 3, 3); p("#2a2230", 10, 5, 1, 1); }
    }
  }
  return c;
}

function registerTextures(scene) {
  if (scene.textures.exists("campus_tiles")) return;
  scene.textures.addCanvas("campus_tiles", createTileCanvas());
  Object.entries(PALETTES).forEach(([key, pal]) => {
    const tex = scene.textures.addCanvas("char_" + key, createCharCanvas(pal));
    for (let i = 0; i < 8; i++) tex.add(i, 0, i * 16, 0, 16, 16);
    ["down", "up", "left", "right"].forEach((dir, d) => {
      scene.anims.create({
        key: `${key}_${dir}`,
        frames: [{ key: "char_" + key, frame: d * 2 }, { key: "char_" + key, frame: d * 2 + 1 }],
        frameRate: 7,
        repeat: -1,
      });
    });
  });
}

/* 건물과 열린 공간 데이터로 Tiled JSON을 만듭니다. */
function buildTiledCampus() {
  const W = MAP_W, H = MAP_H;
  const ground = new Array(W * H).fill(TILE.grass);
  const solid = new Array(W * H).fill(0);
  const idx = (x, y) => y * W + x;
  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  let seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < ground.length; i++) if (rnd() < 0.03) ground[i] = TILE.grass2;

  const paint = (x0, y0, w, h, t) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inMap(x, y)) ground[idx(x, y)] = t; };
  const road = (x0, y0, x1, y1) => paint(Math.min(x0, x1) - 1, Math.min(y0, y1) - 1, Math.abs(x1 - x0) + 2, Math.abs(y1 - y0) + 2, TILE.path);

  // 주요 보행로 (시연용 단순화)
  road(6, 72, 96, 72); road(32, 18, 32, 116); road(60, 28, 60, 116); road(12, 46, 88, 46);
  road(14, 18, 60, 18); road(32, 92, 72, 92); road(84, 46, 84, 88); road(14, 18, 14, 86); road(46, 116, 60, 116);

  const objects = [];
  let nextId = 1;
  const prop = (name, value) => ({ name, type: "string", value });

  OPEN_SPACES.forEach((s) => {
    const c = geoToTile(s.lat, s.lng);
    const x0 = c.x - Math.floor(s.w / 2), y0 = c.y - Math.floor(s.h / 2);
    if (s.tile === "field") {
      paint(x0 - 1, y0 - 1, s.w + 2, s.h + 2, TILE.path);
      paint(x0, y0, s.w, s.h, TILE.field);
      paint(x0, y0 + Math.floor(s.h / 2), s.w, 1, TILE.fieldLine);
    } else {
      paint(x0, y0, s.w, s.h, s.tile === "lawn" ? TILE.lawn : TILE.plaza);
    }
    objects.push({ id: nextId++, name: s.id, type: "space", x: x0 * TILE_SIZE, y: y0 * TILE_SIZE, width: s.w * TILE_SIZE, height: s.h * TILE_SIZE, rotation: 0, visible: true, properties: [prop("label", s.name.ko)] });
  });

  const nearestRoad = (x, y) => {
    for (let r = 1; r < 50; r++) {
      const cands = [[x, y + r], [x - r, y], [x + r, y], [x, y - r]];
      for (const [cx, cy] of cands) if (inMap(cx, cy) && ground[idx(cx, cy)] === TILE.path) return [cx, cy];
    }
    return [x, y];
  };

  const roofs = [[TILE.roofA, TILE.eaveA], [TILE.roofB, TILE.eaveB], [TILE.roofC, TILE.eaveC]];
  const placed = [];
  BUILDINGS.forEach((b) => {
    const c = geoToTile(b.lat, b.lng);
    const x0 = c.x - Math.floor(b.w / 2) + (b.dx || 0);
    const y0 = c.y - Math.floor(b.h / 2);
    placed.push({ b, x0, y0 });
    const doorX = x0 + Math.floor(b.w / 2), doorY = y0 + b.h;
    const [rx, ry] = nearestRoad(doorX, doorY + 1);
    paint(Math.min(doorX, rx), doorY, Math.abs(rx - doorX) + 1, 1 + Math.max(0, ry - doorY), TILE.path);
    paint(rx, Math.min(doorY, ry), 1, Math.abs(ry - doorY) + 1, TILE.path);
    objects.push({ id: nextId++, name: b.id, type: "building", x: x0 * TILE_SIZE, y: y0 * TILE_SIZE, width: b.w * TILE_SIZE, height: b.h * TILE_SIZE, rotation: 0, visible: true, properties: [prop("label", b.name.ko)] });
  });

  // 건물은 보행로를 그린 뒤 얹습니다.
  placed.forEach(({ b, x0, y0 }) => {
    const [roof, eave] = roofs[b.roof];
    const wallRows = 2;
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const px = x0 + x, py = y0 + y;
        if (!inMap(px, py)) continue;
        let t = roof;
        if (y === b.h - wallRows - 1) t = eave;
        if (y >= b.h - wallRows) t = x % 2 === 1 ? TILE.window : TILE.wall;
        if (y === b.h - 1 && x === Math.floor(b.w / 2)) t = TILE.door;
        solid[idx(px, py)] = t;
      }
    }
  });

  // 가장자리 울타리와 나무. 보행로, 광장, 운동장, 건물, NPC 자리는 피합니다.
  const walkable = new Set([TILE.path, TILE.plaza, TILE.lawn, TILE.field, TILE.fieldLine]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { solid[idx(x, y)] = TILE.hedge; continue; }
    if (solid[idx(x, y)] || walkable.has(ground[idx(x, y)])) continue;
    let nearBlocked = false;
    for (let dy = -1; dy <= 1 && !nearBlocked; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (inMap(nx, ny) && (solid[idx(nx, ny)] === TILE.tree || walkable.has(ground[idx(nx, ny)]) || (solid[idx(nx, ny)] && solid[idx(nx, ny)] !== TILE.hedge))) { nearBlocked = true; break; }
    }
    if (!nearBlocked && rnd() < 0.3) solid[idx(x, y)] = TILE.tree;
  }

  // 정문은 울타리가 아니라 맵 안쪽 광장에 있으므로 스폰 위치를 객체로 남깁니다.
  const gate = geoToTile(OPEN_SPACES[0].lat, OPEN_SPACES[0].lng);
  objects.push({ id: nextId++, name: "spawn", type: "spawn", x: gate.x * TILE_SIZE, y: (gate.y + 1) * TILE_SIZE, width: 0, height: 0, point: true, rotation: 0, visible: true });

  return {
    compressionlevel: -1, height: H, width: W, infinite: false, nextlayerid: 4, nextobjectid: nextId,
    orientation: "orthogonal", renderorder: "right-down", tiledversion: "1.10.2", tilewidth: TILE_SIZE, tileheight: TILE_SIZE, type: "map", version: "1.10",
    tilesets: [{ columns: SHEET_COLS, firstgid: 1, image: "campus_tiles.png", imagewidth: SHEET_COLS * TILE_SIZE, imageheight: Math.ceil(TILE_COUNT / SHEET_COLS) * TILE_SIZE, margin: 0, name: "campus", spacing: 0, tilecount: TILE_COUNT, tilewidth: TILE_SIZE, tileheight: TILE_SIZE }],
    layers: [
      { id: 1, name: "ground", type: "tilelayer", data: ground, width: W, height: H, opacity: 1, visible: true, x: 0, y: 0 },
      { id: 2, name: "solid", type: "tilelayer", data: solid, width: W, height: H, opacity: 1, visible: true, x: 0, y: 0 },
      { id: 3, name: "places", type: "objectgroup", draworder: "topdown", objects, opacity: 1, visible: true, x: 0, y: 0 },
    ],
  };
}

/* 건물 내부 방. kind별로 가구만 달라지는 데이터 기반 방입니다. */
function buildInterior(kind) {
  const W = 20, H = 12;
  const floor = kind === "library" || kind === "classroom" ? TILE.wood : TILE.tileFloor;
  const layer = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) row.push(x === 0 || y === 0 || x === W - 1 || y === H - 1 || y === 1 ? TILE.innerWall : floor);
    layer.push(row);
  }
  const put = (x, y, t) => { layer[y][x] = t; };
  if (kind === "classroom") {
    put(4, 1, TILE.board); put(5, 1, TILE.board); put(6, 1, TILE.board); put(7, 1, TILE.board);
    for (let y = 5; y <= 9; y += 2) for (let x = 2; x <= 9; x += 2) put(x, y, TILE.desk);
    for (let x = 12; x <= 12; x++) for (let y = 2; y < 8; y++) put(x, y, TILE.innerWall);
    put(14, 5, TILE.counter); put(15, 5, TILE.counter); put(16, 5, TILE.counter);
  } else if (kind === "library") {
    for (let x = 2; x <= 17; x += 3) for (let y = 6; y <= 9; y++) if (!(x >= 8 && x <= 11)) put(x, y, TILE.shelf);
    for (let x = 8; x <= 12; x++) put(x, 4, TILE.counter);
  } else if (kind === "pc") {
    for (let y = 3; y <= 9; y += 2) for (let x = 9; x <= 17; x += 2) put(x, y, TILE.pc);
    put(2, 3, TILE.plant);
  } else if (kind === "union") {
    for (let x = 7; x <= 13; x++) put(x, 5, TILE.counter);
    put(2, 3, TILE.plant); put(17, 3, TILE.plant);
    for (let x = 3; x <= 6; x++) put(x, 9, TILE.desk);
    for (let x = 13; x <= 16; x++) put(x, 9, TILE.desk);
  } else if (kind === "hall") {
    for (let y = 7; y <= 9; y++) for (let x = 3; x <= 16; x += 2) if (x < 8 || x > 11) put(x, y, TILE.desk);
    put(8, 1, TILE.board); put(9, 1, TILE.board); put(10, 1, TILE.board); put(11, 1, TILE.board);
  } else {
    for (let x = 6; x <= 13; x++) put(x, 5, TILE.counter);
    put(2, 3, TILE.plant); put(17, 3, TILE.plant); put(3, 8, TILE.desk); put(16, 8, TILE.desk);
  }
  put(9, H - 1, TILE.mat); put(10, H - 1, TILE.mat);
  return { layer, exit: { x: 9.5, y: H - 1 }, spawn: { x: 10, y: H - 2 }, W, H };
}

/* 건물 겹침 검사(개발용). 콘솔에 경고를 남깁니다. */
function checkBuildingOverlap() {
  const rects = BUILDINGS.map((b) => { const c = geoToTile(b.lat, b.lng); return { id: b.id, x: c.x - Math.floor(b.w / 2) + (b.dx || 0), y: c.y - Math.floor(b.h / 2), w: b.w, h: b.h }; });
  const out = [];
  rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => {
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push(a.id + "/" + b.id);
  }));
  if (out.length) console.warn("건물 겹침:", out.join(", "));
  return out;
}
