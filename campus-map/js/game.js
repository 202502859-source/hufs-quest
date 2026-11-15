/* Phaser 장면: 캠퍼스 맵과 건물 내부 */
const Input = { keys: {}, touch: { x: 0, y: 0 }, action: false };
const MOVE_KEYS = { ArrowUp: "u", KeyW: "u", ArrowDown: "d", KeyS: "d", ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r" };

const Game = {
  phaser: null, tmj: null, places: {}, waypoint: null, scene: null,
  buildingName(id) {
    const b = BUILDINGS.find((x) => x.id === id) || OPEN_SPACES.find((x) => x.id === id);
    return b ? L(b.name) : id;
  },
  /* 지금 안내할 목적지. 직접 고른 길 안내가 퀘스트보다 우선합니다. */
  target() { return this.waypoint || Quests.targetBuilding(); },
  goto(id) {
    if (!this.places[id]) return;
    this.scene.scene.start("Campus", { at: id });
  },
  refreshWorld() { if (this.scene && this.scene.refreshWorld) this.scene.refreshWorld(); },
};

window.addEventListener("keydown", (e) => {
  const tag = e.target && e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    if (e.code === "Escape") UI.closeModal();
    return;
  }
  if (e.code === "Escape") { UI.closeModal(); return; }
  if (UI.modalOpen || !Store.data.mode) return;
  if (MOVE_KEYS[e.code]) { Input.keys[MOVE_KEYS[e.code]] = true; e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === "KeyE" || e.code === "Space" || e.code === "Enter") { Input.action = true; e.preventDefault(); }
  if (e.code === "KeyQ") UI.openQuests();
  if (e.code === "KeyM") UI.openMap();
  if (e.code === "KeyV") UI.openEvents();
  if (e.code === "KeyT") UI.openStamps();
});
window.addEventListener("keyup", (e) => { if (MOVE_KEYS[e.code]) Input.keys[MOVE_KEYS[e.code]] = false; });
window.addEventListener("blur", () => { Input.keys = {}; });

function labelStyle(size, color) {
  return { fontFamily: "Galmuri11, sans-serif", fontSize: size + "px", color: color || "#ffffff", stroke: "#10182a", strokeThickness: 3, resolution: 4, align: "center" };
}

function createPinTextures(scene) {
  if (scene.textures.exists("pin_gold")) return;
  [["pin_gold", "#f2c94c", "#7a5a00"], ["pin_event", "#ff6b6b", "#7a1f1f"]].forEach(([key, fill, line]) => {
    const c = document.createElement("canvas"); c.width = 11; c.height = 13;
    const g = c.getContext("2d");
    g.fillStyle = line; g.fillRect(2, 0, 7, 1); g.fillRect(1, 1, 9, 6); g.fillRect(2, 7, 7, 2); g.fillRect(3, 9, 5, 2); g.fillRect(4, 11, 3, 1); g.fillRect(5, 12, 1, 1);
    g.fillStyle = fill; g.fillRect(2, 1, 7, 6); g.fillRect(3, 7, 5, 2); g.fillRect(4, 9, 3, 2);
    g.fillStyle = "#ffffff"; g.fillRect(4, 3, 3, 2);
    scene.textures.addCanvas(key, c);
  });
}

/* 두 장면이 공유하는 플레이어 이동과 상호작용 처리 */
class WorldScene extends Phaser.Scene {
  addPlayer(x, y, facing) {
    const p = this.physics.add.sprite(x, y, "char_hero", 0);
    p.body.setSize(10, 7).setOffset(3, 9);
    p.setCollideWorldBounds(true);
    p.facing = facing || "down";
    p.setFrame({ down: 0, up: 2, left: 4, right: 6 }[p.facing]);
    this.player = p;
    return p;
  }
  addNpc(x, y, spriteKey, nameObj, data) {
    const s = this.physics.add.staticSprite(x, y, "char_" + spriteKey, 0);
    s.setDepth(y);
    s.body.setSize(12, 10).setOffset(2, 6);
    const label = this.add.text(x, y - 11, L(nameObj), labelStyle(7, "#ffe9a8")).setOrigin(0.5, 1).setDepth(5000);
    const mark = this.add.text(x, y - 20, "!", labelStyle(10, "#f2c94c")).setOrigin(0.5, 1).setDepth(5001).setVisible(false);
    this.tweens.add({ targets: mark, y: y - 23, duration: 400, yoyo: true, repeat: -1 });
    const npc = Object.assign({ sprite: s, label, mark, nameObj }, data);
    this.npcs.push(npc);
    this.physics.add.collider(this.player, s);
    return npc;
  }
  movePlayer() {
    const p = this.player;
    let dx = 0, dy = 0;
    if (!UI.modalOpen) {
      dx = (Input.keys.r ? 1 : 0) - (Input.keys.l ? 1 : 0) + Input.touch.x;
      dy = (Input.keys.d ? 1 : 0) - (Input.keys.u ? 1 : 0) + Input.touch.y;
    }
    const speed = 125;
    const len = Math.hypot(dx, dy) || 1;
    p.setVelocity((dx / len) * speed, (dy / len) * speed);
    if (dx || dy) {
      p.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      p.anims.play("hero_" + p.facing, true);
    } else {
      p.anims.stop();
      p.setFrame({ down: 0, up: 2, left: 4, right: 6 }[p.facing]);
    }
    p.setDepth(p.y);
    return { dx, dy };
  }
  nearestNpc(range) {
    let best = null, bestD = range;
    this.npcs.forEach((n) => {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, n.sprite.x, n.sprite.y);
      if (d < bestD) { best = n; bestD = d; }
    });
    return best;
  }
  takeAction() {
    const a = Input.action;
    Input.action = false;
    return a && !UI.modalOpen;
  }
  refreshNpcMarks() {
    this.npcs.forEach((n) => {
      n.label.setText(n.booth ? L(n.nameObj) : L(n.nameObj));
      const has = n.id && (Quests.pendingFor(n.id).length > 0 || (NPCS[n.id] || OUTDOOR_NPCS[n.id] || {}).offers?.some((q) => Quests.status(q) === "available" && Quests.canTake(q)));
      const boothOpen = n.booth && !Store.data.stamps.includes(n.booth);
      n.mark.setVisible(Boolean(has || boothOpen));
    });
  }
}

class CampusScene extends WorldScene {
  constructor() { super("Campus"); }
  create(data) {
    Game.scene = this;
    registerTextures(this);
    createPinTextures(this);
    this.npcs = [];
    if (!this.cache.tilemap.exists("campus")) {
      this.cache.tilemap.add("campus", { format: Phaser.Tilemaps.Formats.TILED_JSON, data: Game.tmj });
    }
    const map = this.make.tilemap({ key: "campus" });
    const ts = map.addTilesetImage("campus", "campus_tiles", TILE_SIZE, TILE_SIZE, 0, 0);
    map.createLayer("ground", ts, 0, 0);
    const solid = map.createLayer("solid", ts, 0, 0);
    solid.setCollisionByExclusion([-1, 0]);
    this.map = map;
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    Game.places = {};
    this.labels = [];
    map.getObjectLayer("places").objects.forEach((o) => {
      if (o.type === "building") {
        const b = BUILDINGS.find((x) => x.id === o.name);
        if (!b) return;
        const tilesW = Math.round(o.width / TILE_SIZE);
        const door = { x: o.x + Math.floor(tilesW / 2) * TILE_SIZE + 8, y: o.y + o.height + 7 };
        Game.places[o.name] = { id: o.name, x: o.x, y: o.y, w: o.width, h: o.height, door, kind: "building" };
        this.labels.push({ id: o.name, text: this.add.text(o.x + o.width / 2, o.y + o.height / 2 - 12, b.name[Store.data.lang], labelStyle(8)).setOrigin(0.5).setDepth(4000) });
      } else if (o.type === "space") {
        const s = OPEN_SPACES.find((x) => x.id === o.name);
        if (!s) return;
        Game.places[o.name] = { id: o.name, x: o.x, y: o.y, w: o.width, h: o.height, door: { x: o.x + o.width / 2, y: o.y + o.height / 2 }, kind: "space" };
        this.labels.push({ id: o.name, text: this.add.text(o.x + o.width / 2, o.y + 8, s.name[Store.data.lang], labelStyle(8, "#fff7cc")).setOrigin(0.5).setDepth(4000) });
      } else if (o.type === "spawn") {
        this.spawn = { x: o.x, y: o.y };
      }
    });

    const start = (data && data.at && Game.places[data.at]) ? Game.places[data.at].door : this.spawn;
    const offset = data && data.at && Game.places[data.at].kind === "building" ? 4 : 0;
    this.addPlayer(start.x, start.y + offset);
    this.physics.add.collider(this.player, solid);

    Object.entries(OUTDOOR_NPCS).forEach(([id, n]) => {
      this.addNpc(n.x * TILE_SIZE + 8, n.y * TILE_SIZE + 8, n.sprite, n.name, { id });
    });
    const lawn = Game.places.lawn;
    if (lawn) {
      const cx = lawn.x + lawn.w / 2, cy = lawn.y + lawn.h / 2;
      LANGUAGES.forEach((lang) => {
        this.addNpc(cx + lang.dx * TILE_SIZE, cy + lang.dy * TILE_SIZE, "intl", lang.name, { booth: lang.id });
      });
    }

    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.setZoom(this.scale.width < 700 ? 2 : 2.25);
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.roundPixels = true;
    cam.fadeIn(180, 16, 24, 42);

    this.targetPin = this.add.image(0, 0, "pin_gold").setDepth(4500).setVisible(false);
    this.pinBob = 0;
    this.eventPins = [];
    this.refreshWorld();
    UI.setInterior(null);
    UI.renderMinimapBase();
  }
  refreshWorld() {
    const lang = Store.data.lang;
    this.labels.forEach((l) => {
      const def = BUILDINGS.find((b) => b.id === l.id) || OPEN_SPACES.find((s) => s.id === l.id);
      l.text.setText(def.name[lang]);
    });
    this.refreshNpcMarks();
    this.eventPins.forEach((p) => { p.pin.destroy(); p.tween.remove(); });
    this.eventPins = [];
    const seen = new Set();
    Events.list().forEach((e) => {
      const place = Game.places[e.place];
      if (!place || seen.has(e.place)) return;
      seen.add(e.place);
      const y = place.y - 6;
      const pin = this.add.image(place.x + place.w - 8, y, "pin_event").setDepth(4600).setAlpha(Events.isLive(e) ? 1 : 0.55);
      const tween = this.tweens.add({ targets: pin, y: y - 3, duration: 500, yoyo: true, repeat: -1 });
      this.eventPins.push({ pin, tween });
    });
    UI.drawMinimap();
  }
  update() {
    const move = this.movePlayer();
    const p = this.player;
    this.pinBob += 0.08;

    const targetId = Game.target();
    const target = targetId && Game.places[targetId];
    if (target) {
      this.targetPin.setVisible(true).setPosition(target.door.x, target.door.y - 18 + Math.sin(this.pinBob) * 2);
      UI.setArrow(Math.atan2(target.door.y - p.y, target.door.x - p.x), Phaser.Math.Distance.Between(p.x, p.y, target.door.x, target.door.y));
      if (Game.waypoint === targetId && Phaser.Math.Distance.Between(p.x, p.y, target.door.x, target.door.y) < 28) {
        Game.waypoint = null;
        UI.toast(T("arrived"));
        UI.renderTracker();
      }
    } else {
      this.targetPin.setVisible(false);
      UI.setArrow(null);
    }
    UI.movePlayerDot(p.x, p.y);

    let door = null, doorD = 20;
    Object.values(Game.places).forEach((pl) => {
      if (pl.kind !== "building") return;
      const d = Phaser.Math.Distance.Between(p.x, p.y, pl.door.x, pl.door.y);
      if (d < doorD) { door = pl; doorD = d; }
    });
    const npc = this.nearestNpc(24);
    const acted = this.takeAction();
    if (npc) {
      UI.setPrompt(`${L(npc.nameObj)} · ${T("talk")}`);
      if (acted) npc.booth ? UI.openBooth(npc.booth) : UI.openNpc(npc.id, OUTDOOR_NPCS[npc.id]);
    } else if (door) {
      UI.setPrompt(`${Game.buildingName(door.id)} · ${T("enter")}`);
      if (acted || (move.dy < 0 && p.body.blocked.up)) this.enter(door.id);
    } else {
      UI.setPrompt(null);
    }
  }
  enter(id) {
    Input.action = false;
    this.scene.start("Interior", { id });
  }
}

class InteriorScene extends WorldScene {
  constructor() { super("Interior"); }
  create(data) {
    Game.scene = this;
    this.npcs = [];
    this.buildingId = data.id;
    const b = BUILDINGS.find((x) => x.id === data.id);
    const room = buildInterior(b.kind);
    this.room = room;
    const map = this.make.tilemap({ data: room.layer, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const ts = map.addTilesetImage("campus_tiles", "campus_tiles", TILE_SIZE, TILE_SIZE, 0, 0, 1);
    const layer = map.createLayer(0, ts, 0, 0);
    layer.setCollision([TILE.innerWall, TILE.desk, TILE.board, TILE.shelf, TILE.pc, TILE.plant, TILE.counter]);
    const wPx = map.widthInPixels, hPx = map.heightInPixels;
    this.physics.world.setBounds(0, 0, wPx, hPx);

    this.addPlayer(room.spawn.x * TILE_SIZE, room.spawn.y * TILE_SIZE + 4, "up");
    this.physics.add.collider(this.player, layer);

    const isVisitor = Store.data.mode === "visitor";
    Object.entries(NPCS).forEach(([id, n]) => {
      if (n.building !== data.id || (isVisitor && n.studentOnly)) return;
      this.addNpc(n.x * TILE_SIZE + 8, n.y * TILE_SIZE + 8, n.sprite, n.name, { id });
    });
    this.refreshNpcMarks();

    const cam = this.cameras.main;
    const fit = Math.min(this.scale.width / wPx, this.scale.height / hPx);
    cam.setZoom(Math.max(1.5, Math.min(fit * 0.92, 4)));
    cam.centerOn(wPx / 2, hPx / 2);
    if (wPx * cam.zoom > this.scale.width || hPx * cam.zoom > this.scale.height) cam.startFollow(this.player, true, 0.15, 0.15);
    cam.roundPixels = true;
    cam.fadeIn(180, 16, 24, 42);

    UI.setInterior(data.id, this.npcs.length > 0);
    UI.setArrow(null);
    UI.onEnterBuilding(data.id);
  }
  refreshWorld() { this.refreshNpcMarks(); UI.setInterior(this.buildingId, this.npcs.length > 0); }
  update() {
    this.movePlayer();
    const npc = this.nearestNpc(38);
    const acted = this.takeAction();
    if (npc) {
      UI.setPrompt(`${L(npc.nameObj)} · ${T("talk")}`);
      if (acted) UI.openNpc(npc.id, NPCS[npc.id]);
    } else {
      UI.setPrompt(null);
    }
    if (this.player.y > (this.room.H - 1) * TILE_SIZE - 4) {
      this.scene.start("Campus", { at: this.buildingId });
    }
  }
}

function startPhaser() {
  checkBuildingOverlap();
  Game.phaser = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#10182a",
    render: { pixelArt: true, antialias: false },
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    physics: { default: "arcade", arcade: { gravity: { y: 0 } } },
    input: { keyboard: false },
    scene: [CampusScene, InteriorScene],
  });
}

/* assets/campus.tmj가 있으면 Tiled에서 수정한 맵을, 없으면 코드로 만든 맵을 씁니다. */
async function loadCampusMap() {
  if (location.protocol.startsWith("http")) {
    try {
      const r = await fetch("assets/campus.tmj", { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch (e) { /* 파일이 없으면 기본 맵을 씁니다. */ }
  }
  return buildTiledCampus();
}

function exportTiled() {
  const save = (name, url) => { const a = document.createElement("a"); a.href = url; a.download = name; a.click(); };
  const blob = new Blob([JSON.stringify(buildTiledCampus())], { type: "application/json" });
  save("campus.tmj", URL.createObjectURL(blob));
  save("campus_tiles.png", createTileCanvas().toDataURL("image/png"));
}
