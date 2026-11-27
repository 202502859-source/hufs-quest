import Phaser from "phaser";
import { TILE_SIZE } from "../gfx/textures.js";
import { buildCampusLayers } from "../data/campus.js";
import { WORLD, findPlace } from "../data/world.js";
import { gateRects } from "../data/campusV2.js";
import { addCampusGate } from "../gfx/campusGate.js";
import { GuidePrompt } from "../ui/guidePrompt.js";
import { addCampusV2Ground, stats as campusStats } from "../gfx/campusV2Texture.js";
import { liftClear, placeBuildingLabel, splitTwoLines } from "../data/buildingLabels.js";
import { isTouchDevice, onTouchDetected } from "../device.js";
import { CAMERA_ZOOM, cameraOffsetX } from "../ui/firstScreen.js";
import { QuizBoxes } from "../quizBoxes.js";
import { nextQuestion } from "../quizProgress.js";
import { signOut } from "../data/auth.js";
import { resetProgressCache } from "../data/progressApi.js";
import { getLang, onLangChange, resetSession, t } from "../state.js";
import { BOOTH_SIZE, BOOTH_TEXTURE, registerRallyTextures, signTexture } from "../gfx/rallyTextures.js";
import { BOOTH_SCALE, BOOTH_TALK, SIGN_FOOT, SIGN_SCALE, boothArtRect, boothTalkPoint, feetHitBooth, feetHitSign, signArtRect } from "../data/stampRallySpots.js";
import { placeName, trackedDestination } from "../ui/campusMap.js";
import { createPlannerOverlay } from "../ui/plannerOverlay.js";
import { SHOW_OUT_OF_SCOPE } from "../data/features.js";
import { createDeadlineOverlay } from "../ui/deadlineOverlay.js";
import { startDeadlineRefresh } from "../data/deadlinesApi.js";
import { startEventRefresh } from "../data/eventsApi.js";
import { createEventOverlay } from "../ui/eventOverlay.js";
import { createQuestOverlay } from "../ui/questOverlay.js";
import { createSearchBar } from "../ui/searchBar.js";
import { createOfficeOverlay } from "../ui/officeOverlay.js";
import { createMapReportOverlay } from "../ui/mapReportOverlay.js";
import { nearestOfficePlace, officeSpot } from "../ui/officeView.js";

const PLAYER_SPEED = 90;
const IDLE_FRAME = { down: 0, up: 2, left: 4, right: 6 };
// 이름표는 땅(-10) 바로 위: 캐릭터 · NPC · 퀴즈 상자(깊이 = y 좌표)보다 아래에 그려 가리지 않습니다.
// "건물 소개 안내원" 글자도 땅 위 글자라 이름표 바로 위(-4), 캐릭터가 지나가면 캐릭터가 위에 그려집니다.
const DEPTH = { NAME_TAG: -5, DEST_ARROW: 5002, QUIZ_PROMPT: 5003, OFFICE_PROMPT: 5004 };
const BOOTH_LABEL_FONT = 6; // "[스탬프 랠리 부스]" 이름표(건물 이름표 10px와 같은 글꼴 · 색 · 배경, 크기는 안내원 이름표 · 팻말 글자와 같은 6px)
const SIGN_PROMPT_ABOVE = 18 * SIGN_SCALE; // 팻말 판 바로 위에 [Enter] 시설 소개 말풍선 꼬리 끝(그림을 그리기 전 기본값)
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
      // 정문 기둥 한 쌍 · 현수막(v2 전용, 맵 텍스처 밖에 따로 세운 그림). 깊이는 받침 바닥 기준이라 캐릭터 · 안내원 · 퀴즈 상자와 앞뒤로 겹칩니다.
      addCampusGate(this);
    }
    const worldWidth = WORLD.width;
    const worldHeight = WORLD.height;

    this.nameTags = [...WORLD.buildings, ...WORLD.openSpaces].map((place) => this.addNameTag(place));
    // 로그아웃으로 이 장면이 멈추면 언어 변경 알림도 해제합니다(지워진 글자를 고치려다 오류가 나지 않게).
    // 언어를 바꾸면 이름 길이가 달라지므로 자리도 다시 계산합니다.
    const offLang = onLangChange(() => {
      this.nameTags.forEach(({ place, tag }) => this.layoutNameTag(place, tag));
      this.rally.forEach((stop) => this.drawRallyTexts(stop));
    });
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

    // "시설 안내문" 팻말(11/27 오후: 예전 건물 소개 안내원 NPC 대신): 시설 소개가 있는 건물의 출입구 옆 외벽에 붙어 있고,
    // 가까이 가면 판 위에 "[Enter] 시설 소개"가 뜹니다. 스탬프 랠리 대상 4곳은 문 반대쪽에 부스도 있습니다
    // (src/data/stampRallySpots.js). 팻말 · 부스 칸은 지나갈 수 없습니다(v2는 movePlayer의 blocked, v1은 고정 물리 몸통).
    registerRallyTextures(this);
    this.rally = WORLD.buildings.filter((place) => place.sign).map((place) => this.addRallyStop(place, solidLayer));

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

    // 건물 소개 안내원에게 가까이 가면 머리 위에 뜨는 "[Enter] 시설 소개" 말풍선(src/ui/guidePrompt.js)입니다. 터치 화면은 말풍선을 누르면 열립니다.
    this.officePlace = null;
    this.officePrompt = new GuidePrompt(this, CAMERA_ZOOM).setDepth(DEPTH.OFFICE_PROMPT).setVisible(false);
    this.officePrompt.on("tap", () => {
      if (this.officePlace) this.openOffice(this.officePlace.id);
    });
    // 스탬프 랠리 부스 앞에 서면 뜨는 "[Enter] 스탬프 랠리" 말풍선(같은 모양). 터치 화면은 말풍선이나 부스를 누르면 열립니다.
    this.boothPlace = null;
    this.boothPrompt = new GuidePrompt(this, CAMERA_ZOOM).setDepth(DEPTH.OFFICE_PROMPT).setVisible(false);
    this.boothPrompt.on("tap", () => {
      if (this.boothPlace) this.openBooth(this.boothPlace);
    });

    const camera = this.cameras.main;
    camera.setBounds(0, 0, worldWidth, worldHeight);
    camera.setZoom(CAMERA_ZOOM);
    camera.startFollow(this.player, true, 0.15, 0.15);
    // 첫 화면에서 오른쪽 위 HUD(미니맵 + 펼친 일일 퀘스트 창)가 정문을 가리지 않도록 카메라를 가로로 옮깁니다
    // (src/ui/firstScreen.js cameraOffsetX: 가리는 만큼 + 8px, 안 가리면 0). 화면 크기 · 터치 여부가 바뀌면 다시 계산합니다.
    this.applyCameraOffset();
    const reapply = () => this.applyCameraOffset();
    this.scale.on("resize", reapply);
    this.events.once("shutdown", () => this.scale.off("resize", reapply));
    onTouchDetected(reapply);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.mapKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.openKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.noticeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.N);
    // 퀘스트 Q · 학교 행사 V (E는 다른 게임에서 상호작용 키라 헷갈려 쓰지 않음). 퀘스트가 없으면 Q는 아무것도 하지 않습니다.
    this.questKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.eventKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.V);
    // 안내원 가까이에서 Enter로 사무실 · 시설 안내 창을 엽니다. 검색창 입력 중 Enter는 searchBar가 막아 여기로 오지 않습니다.
    // 매 프레임 JustDown으로 보면 아주 짧게 누른 Enter(한 프레임 안에 눌렀다 뗌)를 놓쳐서 키 이벤트로 받습니다.
    // addKey로 등록하지 않아 다른 HTML 입력칸의 Enter를 가로채지(preventDefault) 않습니다. 장면이 멈추거나 키 입력이 꺼지면 오지 않습니다.
    this.input.keyboard.on("keydown-ENTER", (event) => {
      // 부스와 팻말이 둘 다 가까우면 더 가까운 쪽 말풍선 하나만 떠 있습니다(updateBoothPrompt).
      if (this.boothPlace && this.boothPrompt.visible) {
        event.preventDefault();
        this.openBooth(this.boothPlace);
        return;
      }
      if (!this.officePlace || !this.officePrompt.visible) return;
      // 창이 열리면 "닫기" 버튼에 포커스가 가는데, 같은 Enter의 keypress가 그 버튼을 눌러 바로 닫히지 않게 막습니다.
      event.preventDefault();
      this.openOffice(this.officePlace.id);
    });
    // 마감 임박 공지를 불러오고 5분마다 다시 계산합니다(HUD 아이콘의 배지·깜빡임에 씀).
    startDeadlineRefresh();
    startEventRefresh();
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

  applyCameraOffset() {
    if (!this.cameras?.main) return;
    const displayScale = this.game.canvas.getBoundingClientRect().width / this.scale.width || 1;
    const offset = WORLD.version === "v2" ? cameraOffsetX({ W: this.scale.width, H: this.scale.height, touch: isTouchDevice(), displayScale }) : 0;
    this.cameraOffset = offset;
    // Phaser 카메라는 (플레이어 x − followOffset.x)를 가운데에 둡니다. 음수면 가운데가 플레이어보다 오른쪽 → 화면 속 물체가 왼쪽으로.
    this.cameras.main.setFollowOffset(-offset / CAMERA_ZOOM, 0);
  }

  askQuestion(question) {
    this.stopPlayer();
    this.dialog.openAnswer(question, () => this.input.keyboard.resetKeys());
  }

  // highlight: 행사 창의 "지도에서 보기"로 열면 그 건물 id를 강조합니다.
  openMap(highlight = null) {
    // HTML 창이 열려 있으면 열지 않습니다(창 안을 누른 클릭이 뒤쪽 HUD 미니맵으로 새어 들어와도 무시).
    if (this.anyOverlayOpen()) return;
    this.stopPlayer();
    this.searchBar.setVisible(false);
    this.scene.launch("Map", { highlight });
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
    if (this.dialog.isOpen || this.scene.isActive("Quiz") || this.scene.isActive("Booth")) return;
    this.stopPlayer();
    this.quizPrompt.setVisible(false);
    this.officePrompt.setVisible(false);
    this.boothPrompt.setVisible(false);
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

  // 스탬프 랠리 부스의 문제 창(BoothScene)을 엽니다. 퀴즈 창과 같은 방식으로 캐릭터와 검색창을 멈춥니다.
  // 닫히면 HUD에 알립니다(스탬프 획득 알림 · 도장 찍히는 연출 · 완주 알림).
  openBooth(place) {
    if (this.anyOverlayOpen() || this.scene.isActive("Quiz") || this.scene.isActive("Booth")) return;
    this.stopPlayer();
    this.quizPrompt.setVisible(false);
    this.officePrompt.setVisible(false);
    this.boothPrompt.setVisible(false);
    this.searchBar.setVisible(false);
    this.scene.launch("Booth", {
      buildingId: place.id,
      onClose: (outcome) => {
        this.closeOverlay();
        this.scene.get("Hud").onBoothClosed?.(outcome);
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
    if (this.anyOverlayOpen()) return;
    this.stopPlayer();
    this.quizPrompt.setVisible(false);
    this.officePrompt.setVisible(false);
    this.searchBar.setVisible(false);
    this.input.keyboard.enabled = false;
    this.setHudInput(false);
    this.deadlineOverlay ??= createDeadlineOverlay(this.game, () => this.closeOverlay());
    this.deadlineOverlay.show();
    this.scene.pause();
  }

  // HUD 일일 퀘스트 창의 줄을 누르거나 Q 키로 일일 퀘스트 상세 창(스탬프 랠리 4곳 체크 목록 · 일일 퀴즈)을 엽니다.
  // 닫으면 미니맵에서 다음 부스 위치가 잠깐 깜빡입니다.
  openQuests() {
    if (this.anyOverlayOpen()) return;
    this.pauseForOverlay();
    this.questOverlay ??= createQuestOverlay(this.game, () => {
      this.closeOverlay();
      this.scene.get("Hud").blinkNextBooth?.();
    });
    this.questOverlay.show();
  }

  // HUD의 행사 버튼이나 V 키로 학교 행사 창을 엽니다. "지도에서 보기"를 누르면 창을 닫고 전체 지도에서 그 건물을 강조합니다.
  openEvents() {
    if (this.anyOverlayOpen()) return;
    this.pauseForOverlay();
    this.eventOverlay ??= createEventOverlay(this.game, (result) => {
      this.closeOverlay();
      if (result?.showOnMap) this.openMap(result.showOnMap);
      if (result?.login) this.goToLogin();
    });
    this.eventOverlay.show();
  }

  // 안내원의 [Enter] 시설 소개 문구 · 안내원 클릭 · Enter로 사무실 · 시설 안내 창을 엽니다.
  openOffice(placeId) {
    if (this.anyOverlayOpen()) return;
    this.pauseForOverlay();
    this.officeOverlay ??= createOfficeOverlay(this.game, (result) => {
      this.closeOverlay();
      if (result?.report) this.openMapReport(result.report);
    });
    this.officeOverlay.show(placeId);
  }

  // 건물 상세 · 전체 지도의 "실제와 달라요 (신고)": 게임 안 신고 창(진짜 로그인이면 폼, 아니면 로그인 버튼).
  openMapReport(placeId) {
    if (this.anyOverlayOpen()) return;
    this.pauseForOverlay();
    this.mapReportOverlay ??= createMapReportOverlay(this.game, (result) => {
      this.closeOverlay();
      if (result?.login) this.goToLogin();
    });
    this.mapReportOverlay.show(placeId);
  }

  // 가장 가까운 건물 소개 안내원(스탬프 랠리 4곳은 "시설 안내문" 팻말) 위에 문구를 띄웁니다. 정문 쪽 문구는 없습니다.
  // 퀴즈 상자 문구와 겹치면 그 위로 올립니다.
  updateOfficePrompt() {
    const place = nearestOfficePlace(WORLD.buildings, this.player.x, this.player.y);
    this.officePlace = place;
    this.officePrompt.setVisible(Boolean(place));
    if (!place) return null;
    // 키 이름은 괄호 없이 키 모양 안에: "[Enter]" → Enter, "[터치]" → 터치
    const hint = t(isTouchDevice() ? "officeKeyHintTouch" : "officeKeyHint").replace(/[[\]]/g, "");
    const spot = officeSpot(place);
    const above = place.signTop ?? SIGN_PROMPT_ABOVE;
    this.officePrompt.setContent(hint, t("officePrompt")).setPosition(spot.x, spot.y - above);
    if (this.quizPrompt.visible) {
      const a = this.officePrompt.getBounds();
      const b = this.quizPrompt.getBounds();
      if (Phaser.Geom.Rectangle.Overlaps(a, b)) this.officePrompt.setY(b.top - 2);
    }
    return place;
  }

  // 부스 앞(아래쪽)에 서면 지붕 위에 "[Enter] 스탬프 랠리"를 띄웁니다. 팻말 문구와 둘 다 뜰 거리면 더 가까운 쪽 하나만 남깁니다.
  updateBoothPrompt() {
    let best = null;
    let bestDistance = BOOTH_TALK.range;
    for (const stop of this.rally) {
      if (!stop.place.booth) continue;
      const talk = boothTalkPoint(stop.place.booth);
      const distance = Math.hypot(talk.x - this.player.x, talk.y - this.player.y);
      if (distance < bestDistance) {
        best = stop;
        bestDistance = distance;
      }
    }
    if (best && this.officePlace && this.officePrompt.visible) {
      const spot = officeSpot(this.officePlace);
      if (Math.hypot(spot.x - this.player.x, spot.y - this.player.y) < bestDistance) best = null;
      else this.officePrompt.setVisible(false);
    }
    this.boothPlace = best?.place ?? null;
    this.boothPrompt.setVisible(Boolean(best));
    if (!best) return;
    const hint = t(isTouchDevice() ? "officeKeyHintTouch" : "officeKeyHint").replace(/[[\]]/g, "");
    const { booth } = best.place;
    this.boothPrompt.setContent(hint, t("boothPrompt")).setPosition(booth.x, best.label.getBounds().top - 1);
  }

  anyOverlayOpen() {
    return Boolean(
      this.dialog.isOpen ||
        this.deadlineOverlay?.isOpen() ||
        this.plannerOverlay?.isOpen() ||
        this.eventOverlay?.isOpen() ||
        this.questOverlay?.isOpen() ||
        this.officeOverlay?.isOpen() ||
        this.mapReportOverlay?.isOpen(),
    );
  }

  // HTML 창(마감 공지 · 행사 · 퀘스트 · 사무실 안내)이 열려 있는 동안 캐릭터 · 검색창 · 키 입력을 멈춥니다.
  pauseForOverlay() {
    this.stopPlayer();
    this.quizPrompt.setVisible(false);
    this.officePrompt.setVisible(false);
    this.boothPrompt.setVisible(false);
    this.searchBar.setVisible(false);
    this.input.keyboard.enabled = false;
    this.setHudInput(false);
    this.scene.pause();
  }

  // Phaser는 게임 위 HTML 창을 누른 클릭도 같은 좌표의 게임 버튼으로 처리합니다.
  // HTML 창이 열려 있는 동안 HUD(미니맵 · 로그아웃 · 아이콘) 입력을 꺼서 뒤쪽 버튼이 눌리지 않게 합니다.
  setHudInput(enabled) {
    const hud = this.scene.get("Hud");
    if (hud?.input) hud.input.enabled = enabled;
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
    this.setHudInput(true);
    this.input.keyboard.enabled = true;
    this.input.keyboard.resetKeys();
    this.searchBar.setVisible(true);
    this.scene.resume();
  }

  // 게스트 · 가짜 로그인이 행사창에서 "로그인하고 제보하기"를 누르면: 열린 창과 장면을 닫고 타이틀로 가서
  // 타이틀의 "재학생 로그인"과 같은 로그인 창을 엽니다(TitleScene begin("student")). 로그인하면 캠퍼스로 다시 들어옵니다.
  goToLogin() {
    if (this.loggingOut) return;
    this.loggingOut = true;
    this.stopPlayer();
    if (this.dialog?.isOpen) this.dialog.close();
    this.searchBar.setVisible(false);
    this.searchBar.clear();
    ["Quiz", "Booth", "QuestInfo", "Map", "Hud", "Dialog"].forEach((key) => this.scene.stop(key));
    resetSession();
    this.scene.start("Title", { openLogin: true });
  }

  // HUD의 로그아웃 버튼. 열린 창과 장면을 모두 닫고, 로그인과 진행 상태를 지운 뒤 타이틀로 돌아갑니다.
  async logout() {
    if (this.loggingOut) return;
    this.loggingOut = true;
    this.stopPlayer();
    if (this.dialog?.isOpen) this.dialog.close();
    if (this.deadlineOverlay?.isOpen()) this.deadlineOverlay.hide();
    if (this.eventOverlay?.isOpen()) this.eventOverlay.hide();
    if (this.questOverlay?.isOpen()) this.questOverlay.hide();
    if (this.plannerOverlay?.isOpen()) this.plannerOverlay.hide();
    if (this.officeOverlay?.isOpen()) this.officeOverlay.hide();
    if (this.mapReportOverlay?.isOpen()) this.mapReportOverlay.hide();
    this.searchBar.setVisible(false);
    this.searchBar.clear();
    ["Quiz", "Booth", "QuestInfo", "Map", "Hud", "Dialog"].forEach((key) => this.scene.stop(key));
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

  // v2 이동에서 팻말 · 부스 칸을 막습니다(판정 격자에는 넣지 않음).
  blockedByGuide = (x, y) => this.rally.some(({ place }) => feetHitSign(x, y, place.sign) || (place.booth && feetHitBooth(x, y, place.booth)));

  // 건물 한 곳의 "시설 안내문" 팻말(출입구 옆 외벽에 붙음)과, 스탬프 랠리 대상이면 문 반대쪽 부스(지붕 위 "[스탬프 랠리 부스]" 이름표).
  // 팻말을 누르면(문구가 떠 있을 때) 시설 소개 창, 부스를 누르면(앞에 서 있을 때) 문제 창을 엽니다. 그림은 예전의 80%(SIGN_SCALE · BOOTH_SCALE).
  addRallyStop(place, solidLayer) {
    const { sign, booth } = place;
    const signImage = this.add.image(sign.x, sign.y + SIGN_FOOT, "__DEFAULT").setDepth(sign.y).setInteractive({ useHandCursor: true });
    signImage.on("pointerdown", () => {
      if (this.officePlace === place && this.officePrompt.visible) this.openOffice(place.id);
    });
    if (solidLayer) {
      // 옛 타일맵(?map=v1): 팻말 기둥을 고정 물리 몸통으로 막습니다.
      const post = this.add.zone(sign.x, sign.y + SIGN_FOOT / 2, 8, 6);
      this.physics.add.existing(post, true);
      this.physics.add.collider(this.player, post);
    }
    let boothImage = null;
    let label = null;
    if (booth) {
      boothImage = this.add
        .image(booth.x, booth.y, BOOTH_TEXTURE)
        .setOrigin(BOOTH_SIZE.originX / BOOTH_SIZE.w, BOOTH_SIZE.originY / BOOTH_SIZE.h)
        .setScale(BOOTH_SCALE)
        .setDepth(booth.y)
        .setInteractive({ useHandCursor: true });
      boothImage.on("pointerdown", () => {
        if (this.boothPlace === place) this.openBooth(place);
      });
      // 부스 이름표: 건물 이름표(addNameTag)와 같은 글꼴 · 색 · 배경, 지붕 바로 위
      label = this.add
        .text(booth.x, booth.y - BOOTH_SIZE.originY * BOOTH_SCALE - 1, "", {
          fontFamily: "Galmuri9, sans-serif",
          fontSize: `${BOOTH_LABEL_FONT}px`,
          color: "#fff7cc",
          backgroundColor: "#10182a",
          padding: { x: 2.5, y: 1 },
          align: "center",
          resolution: CAMERA_ZOOM,
        })
        .setOrigin(0.5, 1)
        .setScale(BOOTH_SCALE)
        .setDepth(booth.y + 1);
    }
    const stop = { place, signImage, boothImage, label };
    this.drawRallyTexts(stop);
    return stop;
  }

  // 언어에 맞는 팻말 글자("[시설 안내문]") · 부스 이름표를 그립니다. 문이 옆을 보는 건물(도서관 등)은 팻말을 비스듬히(3/4 각도) 그립니다.
  drawRallyTexts({ place, signImage, label }) {
    const face = place.sign.face;
    const texture = signTexture(this, t("signLabel"), { angled: face === "left" || face === "right", mirror: face === "left" });
    signImage.setTexture(texture.key).setOrigin(texture.originX, texture.originY).setScale(texture.scale * SIGN_SCALE);
    signImage.input?.hitArea.setTo(0, 0, signImage.width, signImage.height);
    place.signTop = texture.height * SIGN_SCALE - SIGN_FOOT + 2; // 팻말 자리에서 판 위 끝까지(말풍선 꼬리 끝)
    label?.setText(t("boothLabel"));
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

  // 맵 v2의 건물: 입구에 가까운 지붕 위, 이름표가 통째로 지붕 안에 들어가는 자리(src/data/buildingLabels.js). 안내원 글자 칸은 피함.
  // 안 들어가면 글자를 줄이고 → 두 줄 → 지붕 가운데. 열린 공간과 옛 맵(?map=v1)은 지금처럼 place.tag 자리.
  layoutNameTag(place, tag) {
    const name = placeName(place);
    if (WORLD.version !== "v2" || place.kind !== "building") {
      tag.setText(name).setFontSize(NAME_TAG_FONT).setPosition(place.tag.x, place.tag.y);
      return;
    }
    const measure = (scale, lines) => {
      // 두 줄은 buildingInfo.js의 mapName(줄바꿈을 넣은 이름, 예: "정문\n안내실")을 씁니다. 영어는 띄어쓰기에서 나눔.
      const twoLine = splitTwoLines(getLang() === "en" ? name : place.mapName ?? name);
      tag.setFontSize(Math.round(NAME_TAG_FONT * scale)).setText(lines === 2 ? twoLine : name);
      return { w: tag.width, h: tag.height };
    };
    // 정문 기둥 · 현수막 그림(이름표는 땅 높이라 정문 그림에 가려짐 — 정문안내실),
    // 시설 안내문 팻말(판)과 스탬프 랠리 부스(지붕 · 이름표) 칸을 피합니다.
    const gate = gateRects().map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }));
    const avoid = [
      ...gate,
      ...WORLD.buildings.filter((b) => b.sign).map((b) => signArtRect(b.sign)),
      ...WORLD.buildings.filter((b) => b.booth).map((b) => boothArtRect(b.booth)),
    ];
    const spot = placeBuildingLabel(place, measure, avoid);
    const { w, h } = measure(spot.scale, spot.lines);
    // 지붕 가운데 대안 자리가 정문 그림에 가리면(정문안내실) 이름표만 위로 올립니다.
    tag.setPosition(spot.x, liftClear(spot.x, spot.y, w, h, gate));
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
      this.officePrompt.setVisible(false);
      this.boothPrompt.setVisible(false);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.mapKey)) {
      this.openMap();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.questKey)) {
      this.openQuests();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.eventKey)) {
      this.openEvents();
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

    this.updateOfficePrompt();
    this.updateBoothPrompt();

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
        ({ x, y } = WORLD.moveFeet(x, y, (dx / length) * s, (dy / length) * s, this.blockedByGuide));
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
