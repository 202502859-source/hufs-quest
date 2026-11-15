import Phaser from "phaser";
import { TILE_SIZE } from "../gfx/textures.js";
import { BUILDINGS, OPEN_SPACES, SPAWN, buildCampusLayers, doorTile } from "../data/campus.js";
import { isTouchDevice } from "../device.js";
import { QuizBoxes } from "../quizBoxes.js";
import { nextQuestion } from "../quizProgress.js";
import { onLangChange, t } from "../state.js";
import { placeName, trackedDestination } from "../ui/campusMap.js";
import { createPlannerOverlay } from "../ui/plannerOverlay.js";
import { createDeadlineOverlay } from "../ui/deadlineOverlay.js";
import { startDeadlineRefresh } from "../data/deadlinesApi.js";
import { createSearchBar } from "../ui/searchBar.js";

const CAMERA_ZOOM = 3;
const PLAYER_SPEED = 90;
const IDLE_FRAME = { down: 0, up: 2, left: 4, right: 6 };
const DEPTH = { NAME_TAG: 5000, DEST_ARROW: 5002, QUIZ_PROMPT: 5003 };
const ARROW_ABOVE_DOOR = 26;
const PLANNER_RANGE = 6 * TILE_SIZE;

export class CampusScene extends Phaser.Scene {
  constructor() {
    super("Campus");
  }

  create() {
    const { ground, solid } = buildCampusLayers();
    const groundLayer = this.createLayer(ground);
    const solidLayer = this.createLayer(solid);
    solidLayer.setCollisionByExclusion([-1]);
    const worldWidth = groundLayer.width;
    const worldHeight = groundLayer.height;

    this.nameTags = [...BUILDINGS, ...OPEN_SPACES].map((place) => this.addNameTag(place));
    onLangChange(() => this.nameTags.forEach(({ place, tag }) => tag.setText(placeName(place))));

    this.player = this.physics.add.sprite(
      SPAWN.x * TILE_SIZE + TILE_SIZE / 2,
      SPAWN.y * TILE_SIZE + TILE_SIZE / 2,
      "player",
      IDLE_FRAME.down,
    );
    // 발 부분만 부딪히게 해 건물과 나무 사이를 자연스럽게 지나갑니다.
    this.player.body.setSize(10, 7).setOffset(3, 9);
    this.player.setCollideWorldBounds(true);
    this.facing = "down";

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.physics.add.collider(this.player, solidLayer);

    this.destArrow = this.add.image(0, 0, "dest-arrow").setDepth(DEPTH.DEST_ARROW).setVisible(false);

    // O/X 퀴즈 상자 15개와, 가까이 갔을 때 상자 위에 뜨는 안내 문구입니다.
    this.quizBoxes = new QuizBoxes(this, ground, solid, (box) => this.openQuiz(box));
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
    const door = doorTile(BUILDINGS.find((b) => b.id === "main"));
    const x = door.x * TILE_SIZE + TILE_SIZE / 2;
    const y = (door.y + 1) * TILE_SIZE;
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) < PLANNER_RANGE;
  }

  // 전체 지도, 퀘스트 창, 수강 설계 창이 닫힐 때 부릅니다.
  closeOverlay() {
    this.input.keyboard.enabled = true;
    this.input.keyboard.resetKeys();
    this.searchBar.setVisible(true);
    this.scene.resume();
  }

  openMockReg() {
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
    const x = (place.x + place.w / 2) * TILE_SIZE;
    const y = place.y * TILE_SIZE + TILE_SIZE;
    const tag = this.add
      .text(x, y, placeName(place), {
        fontFamily: "Galmuri9, sans-serif",
        fontSize: "10px",
        color: "#fff7cc",
        backgroundColor: "#10182a",
        padding: { x: 4, y: 2 },
        resolution: CAMERA_ZOOM,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.NAME_TAG);
    return { place, tag };
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

  update(time) {
    this.updateDestinationArrow(time);

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

    this.movePlayer();
    this.player.setDepth(this.player.y);
  }

  movePlayer() {
    const { left, right, up, down } = this.cursors;
    const dx = Phaser.Math.Clamp((right.isDown ? 1 : 0) - (left.isDown ? 1 : 0) + this.touchMove.x, -1, 1);
    const dy = Phaser.Math.Clamp((down.isDown ? 1 : 0) - (up.isDown ? 1 : 0) + this.touchMove.y, -1, 1);
    if (!dx && !dy) {
      this.stopPlayer();
      return;
    }

    const length = Math.hypot(dx, dy);
    this.player.setVelocity((dx / length) * PLAYER_SPEED, (dy / length) * PLAYER_SPEED);

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
