import Phaser from "phaser";
import { TILE_SIZE } from "../gfx/textures.js";
import { buildCampusLayers } from "../data/campus.js";
import { WORLD, findPlace } from "../data/world.js";
import { addCampusV2Ground, stats as campusStats } from "../gfx/campusV2Texture.js";
import { placeBuildingLabel, splitTwoLines } from "../data/buildingLabels.js";
import { isTouchDevice } from "../device.js";
import { QuizBoxes } from "../quizBoxes.js";
import { nextQuestion } from "../quizProgress.js";
import { signOut } from "../data/auth.js";
import { resetProgressCache } from "../data/progressApi.js";
import { getLang, onLangChange, resetSession, t } from "../state.js";
import { placeName, trackedDestination } from "../ui/campusMap.js";
import { createPlannerOverlay } from "../ui/plannerOverlay.js";
import { SHOW_OUT_OF_SCOPE } from "../data/features.js";
import { createDeadlineOverlay } from "../ui/deadlineOverlay.js";
import { startDeadlineRefresh } from "../data/deadlinesApi.js";
import { createSearchBar } from "../ui/searchBar.js";

const CAMERA_ZOOM = 3;
const PLAYER_SPEED = 90;
const IDLE_FRAME = { down: 0, up: 2, left: 4, right: 6 };
// 이름표는 땅(-10) 바로 위: 캐릭터 · NPC · 퀴즈 상자(깊이 = y 좌표)보다 아래에 그려 가리지 않습니다.
const DEPTH = { NAME_TAG: -5, DEST_ARROW: 5002, QUIZ_PROMPT: 5003 };
const NAME_TAG_FONT = 10;
const ARROW_ABOVE_DOOR = 26;
const PLANNER_RANGE = 6 * TILE_SIZE;

export class CampusScene extends Phaser.Scene {
  constructor() {
    super("Campus");
  }

  create() {
    // 맵: 기본은 v2(미터 다각형 → 텍스처 + 1m 판정 격자), 주소에 ?map=v1이면 옛 타일맵(src/data/world.js)
    let solidLayer = null;
    if (WORLD.version === "v1") {
      const { ground, solid } = buildCampusLayers();
      this.createLayer(ground);
      solidLayer = this.createLayer(solid);
      solidLayer.setCollisionByExclusion([-1]);
    } else {
      addCampusV2Ground(this);
    }
    const worldWidth = WORLD.width;
    const worldHeight = WORLD.height;

    this.nameTags = [...WORLD.buildings, ...WORLD.openSpaces].map((place) => this.addNameTag(place));
    // 로그아웃으로 이 장면이 멈추면 언어 변경 알림도 해제합니다(지워진 글자를 고치려다 오류가 나지 않게).
    // 언어를 바꾸면 이름 길이가 달라지므로 자리도 다시 계산합니다.
    const offLang = onLangChange(() => this.nameTags.forEach(({ place, tag }) => this.layoutNameTag(place, tag)));
    this.events.once("shutdown", offLang);
    this.loggingOut = false;

    this.player = this.physics.add.sprite(WORLD.spawn.x, WORLD.spawn.y, "player", IDLE_FRAME.down);
    // 발 부분만 부딪히게 해 건물과 나무 사이를 자연스럽게 지나갑니다.
    this.player.body.setSize(10, 7).setOffset(3, 9);
    this.player.setCollideWorldBounds(true);
    this.facing = "down";

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    // v1은 타일 충돌, v2는 movePlayer에서 판정 격자(WORLD.moveFeet)로 직접 움직입니다.
    if (solidLayer) this.physics.add.collider(this.player, solidLayer);

    this.destArrow = this.add.image(0, 0, "dest-arrow").setDepth(DEPTH.DEST_ARROW).setVisible(false);

    // O/X 퀴즈 상자 15개와, 가까이 갔을 때 상자 위에 뜨는 안내 문구입니다.
    this.quizBoxes = new QuizBoxes(this, (box) => this.openQuiz(box));
    this.quizPrompt = this.add
      .text(0, 0, "", {
        fontFamily: "Galmuri9, sans-serif",
        fontSize: "10px",
        color: "#231a00",
        backgroundColor: "#f2c94c",
        padding: { x: 4, y: 2 },
        resolution: CAMERA_ZOOM,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.QUIZ_PROMPT)
      .setVisible(false);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, worldWidth, worldHeight);
    camera.setZoom(CAMERA_ZOOM);
    camera.startFollow(this.player, true, 0.15, 0.15);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.mapKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.openKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.noticeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.N);
    // 마감 임박 공지를 불러오고 5분마다 다시 계산합니다(HUD 아이콘의 배지·깜빡임에 씀).
    startDeadlineRefresh();
    this.touchMove = { x: 0, y: 0 };

    this.scene.launch("Hud");
    this.scene.launch("Dialog");
    this.dialog = this.scene.get("Dialog");

    // 건물 NPC 대신, 화면 맨 위 검색창으로 언제든 AI 학사 안내원에게 물어볼 수 있습니다.
    this.searchBar ??= createSearchBar(this.game, (question) => this.askQuestion(question));
    this.searchBar.setVisible(true);
    this.events.on("wake", () => {
      this.input.keyboard.resetKeys();
      this.searchBar.setVisible(true);
    });
  }

  askQuestion(question) {
    this.stopPlayer();
    this.dialog.openAnswer(question, () => this.input.keyboard.resetKeys());
  }

  openMap() {
    if (this.dialog.isOpen) return;
    this.stopPlayer();
    this.searchBar.setVisible(false);
    this.scene.launch("Map");
    this.scene.pause();
  }

  openQuestInfo(id) {
    if (this.dialog.isOpen) return;
    this.stopPlayer();
    this.searchBar.setVisible(false);
    this.scene.launch("QuestInfo", { id });
    this.scene.pause();
  }

  // 퀴즈 상자를 엽니다. 지도·퀘스트 창과 같은 방식으로, 열려 있는 동안 캐릭터와 검색창을 멈춥니다.
  openQuiz(box) {
    if (this.dialog.isOpen || this.scene.isActive("Quiz")) return;
    this.stopPlayer();
    this.quizPrompt.setVisible(false);
    // 한 번 연 상자는 같은 문제를 유지합니다(풀지 않고 닫았다가 다시 열어도 같은 문제).
    box.question ??= nextQuestion(this.quizBoxes.assignedIds(box));
    this.searchBar.setVisible(false);
    this.scene.launch("Quiz", {
      question: box.question,
      onClose: (answered) => {
        this.closeOverlay();
        if (answered) this.quizBoxes.solve(box);
        this.scene.get("Hud").dirty = true; // 받은 경험치를 바로 보여 줍니다.
      },
    });
    this.scene.pause();
  }

  // 가까운 상자 위에 "Space로 열기"(터치 화면은 "상자를 터치해 열기")를 띄웁니다.
  updateQuizPrompt() {
    const box = this.quizBoxes.nearest();
    this.quizPrompt.setVisible(Boolean(box));
    if (box) {
      this.quizPrompt.setText(t(isTouchDevice() ? "quizOpenTouch" : "quizOpenKey")).setPosition(box.x, box.y - 12);
    }
    return box;
  }

  // HUD의 빨간 '!' 아이콘이나 N 키로 마감 임박 공지 창을 엽니다. 수강신청 추천 서비스 창과 같은 방식입니다.
  openDeadlines() {
    if (this.dialog.isOpen || this.deadlineOverlay?.isOpen() || this.plannerOverlay?.isOpen()) return;
    this.stopPlayer();
    this.quizPrompt.setVisible(false);
    this.searchBar.setVisible(false);
    this.input.keyboard.enabled = false;
    this.deadlineOverlay ??= createDeadlineOverlay(this.game, () => this.closeOverlay());
    this.deadlineOverlay.show();
    this.scene.pause();
  }

  // 본관 근처에서 HUD의 "수강 설계" 버튼으로 엽니다. 지도·퀘스트 창과 같은 방식이고, 창 자체는 HTML입니다.
  openPlanner() {
    if (!SHOW_OUT_OF_SCOPE) return; // 본선 범위 밖(src/data/features.js)
    if (this.dialog.isOpen || this.plannerOverlay?.isOpen()) return;
    this.stopPlayer();
    this.searchBar.setVisible(false);
    this.input.keyboard.enabled = false;
    this.plannerOverlay ??= createPlannerOverlay(this.game, () => this.closeOverlay());
    this.plannerOverlay.show();
    this.scene.pause();
  }

  // 본관 입구에서 이 거리 안이면 수강 설계 버튼을 보여 줍니다.
  isNearMainHall() {
    const door = findPlace("main")?.door;
    if (!door) return false;
    const { x } = door;
    const y = door.y + TILE_SIZE / 2;
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) < PLANNER_RANGE;
  }

  // 전체 지도, 퀘스트 창, 수강 설계 창이 닫힐 때 부릅니다.
  closeOverlay() {
    this.input.keyboard.enabled = true;
    this.input.keyboard.resetKeys();
    this.searchBar.setVisible(true);
    this.scene.resume();
  }

  // HUD의 로그아웃 버튼. 열린 창과 장면을 모두 닫고, 로그인과 진행 상태를 지운 뒤 타이틀로 돌아갑니다.
  async logout() {
    if (this.loggingOut) return;
    this.loggingOut = true;
    this.stopPlayer();
    if (this.dialog?.isOpen) this.dialog.close();
    if (this.deadlineOverlay?.isOpen()) this.deadlineOverlay.hide();
    if (this.plannerOverlay?.isOpen()) this.plannerOverlay.hide();
    this.searchBar.setVisible(false);
    this.searchBar.clear();
    ["Quiz", "QuestInfo", "Map", "Hud", "Dialog"].forEach((key) => this.scene.stop(key));
    await signOut();
    resetProgressCache();
    resetSession();
    this.scene.start("Title");
  }

  openMockReg() {
    if (!SHOW_OUT_OF_SCOPE) return; // 본선 범위 밖(src/data/features.js)
    if (this.dialog.isOpen) return;
    this.stopPlayer();
    this.searchBar.setVisible(false);
    this.scene.launch("MockReg");
    this.scene.sleep("Hud");
    this.scene.sleep("Dialog");
    this.scene.sleep();
  }

  createLayer(data) {
    const map = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage("tiles", "tiles", TILE_SIZE, TILE_SIZE, 0, 0);
    return map.createLayer(0, tileset, 0, 0);
  }

  addNameTag(place) {
    const tag = this.add
      .text(0, 0, "", {
        fontFamily: "Galmuri9, sans-serif",
        fontSize: `${NAME_TAG_FONT}px`,
        color: "#fff7cc",
        backgroundColor: "#10182a",
        padding: { x: 4, y: 2 },
        align: "center",
        resolution: CAMERA_ZOOM,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.NAME_TAG);
    this.layoutNameTag(place, tag);
    return { place, tag };
  }

  // 맵 v2의 건물: 입구에 가까운 지붕 위, 이름표가 통째로 지붕 안에 들어가는 자리(src/data/buildingLabels.js).
  // 안 들어가면 글자를 줄이고 → 두 줄 → 지붕 가운데. 열린 공간과 옛 맵(?map=v1)은 지금처럼 place.tag 자리.
  layoutNameTag(place, tag) {
    const name = placeName(place);
    if (WORLD.version !== "v2" || place.kind !== "building") {
      tag.setText(name).setFontSize(NAME_TAG_FONT).setPosition(place.tag.x, place.tag.y);
      return;
    }
    const measure = (scale, lines) => {
      // 두 줄은 buildingInfo.js의 mapName(띄어 쓴 이름, 예: "정문 안내실")에서 나눕니다. 영어는 이름 그대로.
      const twoLine = splitTwoLines(getLang() === "en" ? name : place.mapName ?? name);
      tag.setFontSize(Math.round(NAME_TAG_FONT * scale)).setText(lines === 2 ? twoLine : name);
      return { w: tag.width, h: tag.height };
    };
    const spot = placeBuildingLabel(place, measure);
    measure(spot.scale, spot.lines);
    tag.setPosition(spot.x, spot.y);
  }

  stopPlayer() {
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.player.setFrame(IDLE_FRAME[this.facing]);
  }

  // 목적지 건물 입구 위에 위아래로 움직이는 화살표를 띄웁니다.
  updateDestinationArrow(time) {
    const destination = trackedDestination();
    this.destArrow.setVisible(Boolean(destination));
    if (destination) {
      this.destArrow.setPosition(destination.worldX, destination.worldY - ARROW_ABOVE_DOOR + Math.sin(time / 180) * 2);
    }
  }

  update(time, delta) {
    this.updateDestinationArrow(time);
    // 성능 확인용: 휴대폰 원격 디버깅 콘솔에서 __campusStats.fps로 봅니다(docs/GRAPHICS.md 2장).
    campusStats.fps = Math.round(this.game.loop.actualFps);

    // 답변 패널이 열려 있는 동안에는 캐릭터를 세워 둡니다.
    if (this.dialog.isOpen) {
      this.stopPlayer();
      this.quizPrompt.setVisible(false);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.mapKey)) {
      this.openMap();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.noticeKey)) {
      this.openDeadlines();
      return;
    }

    const box = this.updateQuizPrompt();
    if (box && Phaser.Input.Keyboard.JustDown(this.openKey)) {
      this.openQuiz(box);
      return;
    }

    this.movePlayer(delta);
    this.player.setDepth(this.player.y);
  }

  movePlayer(delta = 16) {
    const { left, right, up, down } = this.cursors;
    const dx = Phaser.Math.Clamp((right.isDown ? 1 : 0) - (left.isDown ? 1 : 0) + this.touchMove.x, -1, 1);
    const dy = Phaser.Math.Clamp((down.isDown ? 1 : 0) - (up.isDown ? 1 : 0) + this.touchMove.y, -1, 1);
    if (!dx && !dy) {
      this.stopPlayer();
      return;
    }

    const length = Math.hypot(dx, dy);
    if (WORLD.moveFeet) {
      // v2: 발 상자가 막힌 칸에 닿지 않게 직접 옮깁니다(비스듬한 벽은 따라 미끄러짐). 긴 프레임도 한 번에 너무 멀리 가지 않게 나눕니다.
      const step = (PLAYER_SPEED * Math.min(delta, 50)) / 1000;
      let { x, y } = this.player;
      for (let moved = 0; moved < step; moved += 2) {
        const s = Math.min(2, step - moved);
        ({ x, y } = WORLD.moveFeet(x, y, (dx / length) * s, (dy / length) * s));
      }
      this.player.body.reset(x, y);
    } else {
      this.player.setVelocity((dx / length) * PLAYER_SPEED, (dy / length) * PLAYER_SPEED);
    }

    if (dx && dy) {
      // 대각선일 때는 지금 보는 방향이 눌려 있으면 유지해 걷기 동작이 떨리지 않게 합니다.
      const held = { left: dx < 0, right: dx > 0, up: dy < 0, down: dy > 0 };
      if (!held[this.facing]) this.facing = dx > 0 ? "right" : "left";
    } else if (dx) {
      this.facing = dx > 0 ? "right" : "left";
    } else {
      this.facing = dy > 0 ? "down" : "up";
    }
    this.player.anims.play(`walk-${this.facing}`, true);
  }
}
