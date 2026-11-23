import Phaser from "phaser";
import { activeQuests, getLang, isGuest, onLangChange, session, t } from "../state.js";
import { SHOW_OUT_OF_SCOPE } from "../data/features.js";
import { WORLD } from "../data/world.js";
import { overviewInfo, overviewTexture, placeName, trackedDestination } from "../ui/campusMap.js";
import { isTouchDevice, onTouchDetected } from "../device.js";
import { onDeadlinesChange, urgentCount } from "../data/deadlinesApi.js";
import { eventBadgeCount, onEventsChange } from "../data/eventsApi.js";
import { COLOR, addButton, addLabel, addLangButtons, drawPanel } from "../ui/widgets.js";

// 미니맵 가로(px, 세로는 맵 비율대로). PC는 왼쪽 아래 1.5배, 휴대폰은 이동 패드를 피해 상태창 아래 1.25배(기존 176px 기준).
const MINIMAP = { pc: { width: 264, dot: 1.5 }, touch: { width: 220, dot: 1.25 } };
// 미니맵 건물명: 시연 동선 건물을 먼저 놓고, 나머지는 넓은 건물 순. 다른 이름표와 겹치면 숨깁니다.
const MINIMAP_LABEL_FIRST = ["gatehouse", "cyber", "main", "library", "flc"];
const MIN_TOUCH_PX = 52; // 실제 화면에서 최소 48px 이상이 되도록 약간 여유를 둡니다.
const PAD_ALPHA = 0.55;
const REWARD_TOAST_MS = 2500;
const MARGIN = 12;
const PLANNER_LINE_GAP = 4;
const QUIZ_DOT_COLOR = 0xff9f1c; // 내 위치(노란 점)와 구분되는 주황색
// 오른쪽 아래 아이콘 버튼 줄(퀘스트 · 행사 · 마감 공지). PC는 아이콘 아래에 단축키를 쓰므로 바닥 여백이 더 큽니다.
const HUD_BUTTON = { size: 64, inset: 16, insetWithKey: 30, gap: 12 };

// 게임 화면 위에 고정으로 그리는 정보 화면입니다. 카메라 확대의 영향을 받지 않습니다.
export class HudScene extends Phaser.Scene {
  constructor() {
    super("Hud");
  }

  create() {
    this.dirty = true;
    // 로그아웃하면 이 장면이 멈추므로, 언어 변경 알림도 함께 해제합니다.
    const offLang = onLangChange(() => {
      this.dirty = true;
    });
    this.events.once("shutdown", offLang);
    // 미니게임에서 돌아오면 바뀐 경험치와 완료 표시를 다시 그립니다.
    this.events.on("wake", () => {
      this.dirty = true;
    });
    onTouchDetected(() => {
      this.dirty = true;
    });
    // 마감 임박 공지가 새로 계산되면 아이콘의 배지와 깜빡임을 다시 그립니다.
    onDeadlinesChange(() => {
      this.dirty = true;
    });
    // 행사 목록이 새로 계산되면 행사 버튼의 배지를 다시 그립니다.
    const offEvents = onEventsChange(() => {
      this.dirty = true;
    });
    this.events.once("shutdown", offEvents);
    // 화면이 회전하거나 크기가 바뀌면 터치 버튼 크기를 다시 계산합니다.
    this.scale.on("resize", () => {
      this.dirty = true;
    });
    this.input.on("pointerup", (pointer) => {
      if (pointer.id === this.padPointerId) this.setPadDirection(0, 0, null);
    });
    this.input.on("pointermove", (pointer) => {
      if (pointer.id === this.padPointerId && this.padCenter) this.updatePadFromPointer(pointer);
    });
  }

  // 버튼을 누르는 중에 지우지 않도록 언어 변경은 다음 프레임에 다시 그립니다.
  update() {
    if (session.trackedQuest !== this.renderedQuest || session.completed.size !== this.renderedDone) this.dirty = true;
    if (this.dirty) this.render();
    this.moveMinimapMarker();
    this.drawQuizDots();
    this.updateTalkControls();
    this.updateDestinationPointer();
    this.updatePlannerButton();
  }

  // 목적지가 화면 밖에 있으면 그쪽을 가리키는 화살표와 건물 이름을 보여 줍니다.
  renderDestinationPointer() {
    this.pointer = this.add.triangle(0, 0, 0, 0, 30, 15, 0, 30, 0xff5a5f).setStrokeStyle(3, 0x7a1216).setVisible(false);
    this.pointerLabel = addLabel(this, 0, 0, "", {
      size: 13,
      backgroundColor: "#7a1216",
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setVisible(false);
  }

  updateDestinationPointer() {
    if (!this.pointer) return;
    const campus = this.scene.get("Campus");
    const destination = trackedDestination();
    const camera = campus.cameras?.main;
    const offscreen = destination && campus.player && !camera.worldView.contains(destination.worldX, destination.worldY);
    const showing = Boolean(offscreen && !campus.dialog?.isOpen);
    this.pointer.setVisible(showing);
    this.pointerLabel.setVisible(showing);
    if (!showing) return;
    const angle = Phaser.Math.Angle.Between(campus.player.x, campus.player.y, destination.worldX, destination.worldY);
    const x = this.scale.width / 2 + Math.cos(angle) * 120;
    const y = this.scale.height / 2 + Math.sin(angle) * 95;
    this.pointer.setPosition(x, y).setRotation(angle);
    this.pointerLabel.setPosition(x, y + (Math.sin(angle) > 0 ? -30 : 30)).setText(placeName(destination.building));
  }

  // 게임 화면이 확대·축소되어도 실제 크기가 MIN_TOUCH_PX 이상이 되는 게임 안 크기를 구합니다.
  touchSize(minimum) {
    const displayScale = this.game.canvas.getBoundingClientRect().width / this.scale.width;
    return Math.ceil(Math.max(minimum, MIN_TOUCH_PX / (displayScale || 1)));
  }

  // 터치 기기에서만 방향 패드를 보여 줍니다. (건물 NPC를 없애 대화하기 버튼과 안내 문구는 쓰지 않습니다.)
  renderTalkControls() {
    this.pad = null;
    if (isTouchDevice()) this.renderPad();
  }

  // 터치 기기에서 캐릭터를 움직이는 방향 패드입니다.
  renderPad() {
    // 보이는 패드는 작고 반투명하게 그리되, 누르는 범위는 넓게 둡니다. 작아져도 손가락으로 조작하기 쉽게 하기 위해서입니다.
    const fullCell = this.touchSize(56);
    const cell = Math.ceil(fullCell / 2);
    const left = MARGIN;
    const top = this.scale.height - MARGIN - cell * 3;
    const graphics = this.add.graphics().setAlpha(PAD_ALPHA);
    const labels = [
      ["▲", 1, 0],
      ["◀", 0, 1],
      ["▶", 2, 1],
      ["▼", 1, 2],
    ].map(([label, col, row]) => {
      drawPanel(graphics, left + col * cell, top + row * cell, cell, cell, { border: COLOR.line });
      return addLabel(this, left + (col + 0.5) * cell, top + (row + 0.5) * cell, label, { size: Math.round(cell * 0.4) })
        .setOrigin(0.5)
        .setAlpha(PAD_ALPHA);
    });

    this.padCenter = { x: left + cell * 1.5, y: top + cell * 1.5, deadZone: cell * 0.3 };
    const reach = fullCell * 3;
    // 누르는 범위도 미니맵까지 올라가지 않게 합니다.
    const zoneTop = Math.max(this.scale.height - reach, this.minimapBottom + 8);
    const zone = this.add
      .zone(0, zoneTop, reach, this.scale.height - zoneTop)
      .setOrigin(0)
      .setInteractive();
    zone.on("pointerdown", (pointer) => {
      this.padPointerId = pointer.id;
      this.updatePadFromPointer(pointer);
    });
    this.pad = [graphics, ...labels, zone];
  }

  // 패드 가운데를 기준으로 손가락이 있는 방향으로 움직입니다. 누른 채 밀어서 방향을 바꿀 수 있습니다.
  updatePadFromPointer(pointer) {
    const dx = pointer.x - this.padCenter.x;
    const dy = pointer.y - this.padCenter.y;
    if (Math.hypot(dx, dy) < this.padCenter.deadZone) {
      this.setPadDirection(0, 0, pointer.id);
    } else if (Math.abs(dx) > Math.abs(dy)) {
      this.setPadDirection(Math.sign(dx), 0, pointer.id);
    } else {
      this.setPadDirection(0, Math.sign(dy), pointer.id);
    }
  }

  // 받은 보상(퀴즈·퀘스트·출석·미니게임)을 캠퍼스 화면에서 잠깐 알립니다.
  // 레벨이 올랐으면 그 아래에 "레벨 업! Lv.N"을 한 번만 띄웁니다(여러 레벨이 한 번에 올라도 마지막 레벨만).
  showRewardToast() {
    const reward = session.pendingReward;
    const levelUp = session.pendingLevelUp;
    session.pendingReward = null;
    session.pendingLevelUp = null;
    // 휴대폰은 위쪽 HTML 검색창이 커서 알림을 조금 아래에 띄웁니다(가려지지 않게).
    const y = isTouchDevice() ? 110 : 74;
    if (reward && (reward.exp || reward.points)) {
      // 퀴즈처럼 포인트 없이 경험치만 받은 경우에는 "+0 포인트"를 빼고 보여 줍니다.
      const parts = [reward.exp && `+${reward.exp} EXP`, reward.points && `+${reward.points} ${t("points")}`].filter(Boolean);
      this.showToast(reward.label ? t(reward.label, reward) : parts.join(", "), { y });
    }
    if (levelUp) this.showToast(t("levelUp", { level: levelUp }), { y: y + 50, size: 24 });
  }

  // 화면 위쪽 가운데에 잠깐 문구를 띄웁니다. error면 빨간색입니다.
  // HUD를 다시 그리면(render) 화면 요소가 모두 지워지므로, 아직 보여 줄 시간이 남은 알림은 기억해 두었다가 다시 띄웁니다.
  showToast(text, { error = false, y = 74, size = 20 } = {}, until = this.time.now + REWARD_TOAST_MS) {
    this.toasts = (this.toasts ?? []).filter((x) => x.until > this.time.now);
    if (!this.toasts.some((x) => x.text === text && x.y === y)) this.toasts.push({ text, error, y, size, until });
    const toast = addLabel(this, this.scale.width / 2, y, text, {
      size,
      color: error ? "#ffffff" : "#231a00",
      backgroundColor: error ? "#b3261e" : "#f2c94c",
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5);
    this.tweens.add({
      targets: toast,
      alpha: 0,
      delay: Math.max(0, until - this.time.now),
      duration: 400,
      onComplete: () => toast.destroy(),
    });
  }

  // render 뒤에 아직 남은 알림을 다시 띄웁니다.
  restoreToasts() {
    const now = this.time.now;
    (this.toasts ?? []).filter((x) => x.until > now).forEach(({ text, error, y, size, until }) => this.showToast(text, { error, y, size }, until));
  }

  setPadDirection(dx, dy, pointerId) {
    this.padPointerId = pointerId;
    this.scene.get("Campus").touchMove = { x: dx, y: dy };
  }

  updateTalkControls() {
    const campus = this.scene.get("Campus");
    if (!campus.dialog || !campus.player) return;
    const dialogOpen = Boolean(campus.dialog.isOpen);
    this.pad?.forEach((o) => o.setVisible(!dialogOpen));
    // 패드를 누른 채 답변 창이 열리면 창이 닫힌 뒤 저절로 걷지 않게 합니다.
    if (dialogOpen && this.padPointerId !== null && this.padPointerId !== undefined) this.setPadDirection(0, 0, null);
  }

  // 미니맵입니다. PC는 왼쪽 아래, 휴대폰은 이동 패드(왼쪽 아래)를 피해 상태창 아래에 둡니다. 클릭하면 전체 지도가 열립니다.
  renderMinimap() {
    const size = isTouchDevice() ? MINIMAP.touch : MINIMAP.pc;
    const info = overviewInfo();
    const scale = size.width / info.width;
    const mapW = size.width;
    const mapH = Math.round(info.height * scale);
    const panelH = mapH + 40;
    const x = MARGIN;
    const y = isTouchDevice() ? MARGIN + (isGuest() ? 70 : 96) : this.scale.height - MARGIN - panelH;
    const g = this.add.graphics();
    drawPanel(g, x, y, mapW + 16, panelH, { border: COLOR.line });
    this.minimap = { x: x + 8, y: y + 8, w: mapW, h: mapH, dot: size.dot };
    // 월드 px → 미니맵 안 px
    this.toMini = (wx, wy) => ({ x: this.minimap.x + wx * info.perWorld * scale, y: this.minimap.y + wy * info.perWorld * scale });
    this.minimapBottom = y + panelH + 4;
    this.add.image(this.minimap.x, this.minimap.y, overviewTexture(this)).setOrigin(0).setScale(scale);
    this.renderMinimapLabels();
    addLabel(this, x + 8 + mapW / 2, y + mapH + 14, t("mapButton"), { size: 13, color: "#f2c94c" }).setOrigin(0.5, 0);

    const k = size.dot;
    const destination = trackedDestination();
    if (destination) {
      const { x: dx, y: dy } = this.toMini(destination.worldX, destination.worldY);
      this.add.rectangle(dx, dy, 10 * k, 10 * k, 0xffffff);
      const dot = this.add.rectangle(dx, dy, 6 * k, 6 * k, 0xe5484d);
      this.tweens.add({ targets: dot, alpha: 0.25, duration: 400, yoyo: true, repeat: -1 });
      this.minimapDestination = { x: dx, y: dy };
    } else {
      this.minimapDestination = null;
    }

    // 퀴즈 상자 위치(주황 점). 상자가 풀리고 다시 생길 때마다 매 프레임 다시 그립니다.
    this.quizDots = this.add.graphics();
    this.drawQuizDots();

    this.markerShadow = this.add.rectangle(0, 0, 8 * k, 8 * k, 0x10182a);
    this.marker = this.add.rectangle(0, 0, 4 * k, 4 * k, 0xffe14d);
    this.tweens.add({ targets: this.marker, alpha: 0.25, duration: 400, yoyo: true, repeat: -1 });
    this.moveMinimapMarker();

    const zone = this.add.zone(x, y, mapW + 16, mapH + 40).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => this.scene.get("Campus").openMap());
  }

  // 미니맵 건물명(buildingInfo.js의 mapName → 없으면 name, 영어는 nameEn → 없으면 한국어). 겹치면 덜 중요한 것을 숨깁니다.
  renderMinimapLabels() {
    const lang = getLang();
    const rank = (b) => {
      const i = MINIMAP_LABEL_FIRST.indexOf(b.id);
      return i >= 0 ? i : MINIMAP_LABEL_FIRST.length;
    };
    const areaOf = (b) => (b.box ? (b.box.x1 - b.box.x0) * (b.box.y1 - b.box.y0) : b.w * b.h);
    const order = [...WORLD.buildings].sort((a, b) => rank(a) - rank(b) || areaOf(b) - areaOf(a));
    const placed = [];
    const inside = (r) => r.x >= this.minimap.x && r.y >= this.minimap.y && r.x + r.w <= this.minimap.x + this.minimap.w && r.y + r.h <= this.minimap.y + this.minimap.h;
    order.forEach((b) => {
      const name = (lang === "en" ? b.nameEn : b.mapName) ?? b.name;
      const { x, y } = this.toMini(b.mapLabel[0], b.mapLabel[1]);
      const label = addLabel(this, x, y, name.replace(/\n/g, " "), {
        size: 9,
        fontFamily: "Galmuri9, sans-serif",
        backgroundColor: "rgba(16, 24, 42, 0.78)",
        padding: { x: 2, y: 1 },
      }).setOrigin(0.5);
      const r = { x: label.x - label.width / 2, y: label.y - label.height / 2, w: label.width, h: label.height };
      const overlaps = placed.some((o) => r.x < o.x + o.w + 1 && o.x < r.x + r.w + 1 && r.y < o.y + o.h + 1 && o.y < r.y + r.h + 1);
      if (overlaps || !inside(r)) {
        label.destroy();
        return;
      }
      placed.push(r);
    });
  }

  drawQuizDots() {
    const boxes = this.scene.get("Campus").quizBoxes?.boxes;
    if (!this.quizDots || !boxes) return;
    const k = this.minimap.dot;
    this.quizDots.clear();
    boxes.forEach((box) => {
      const { x, y } = this.toMini(box.x, box.y);
      this.quizDots.fillStyle(0x10182a, 1).fillRect(x - 2 * k, y - 2 * k, 6 * k, 6 * k);
      this.quizDots.fillStyle(QUIZ_DOT_COLOR, 1).fillRect(x - 1 * k, y - 1 * k, 4 * k, 4 * k);
    });
  }

  moveMinimapMarker() {
    const player = this.scene.get("Campus").player;
    if (!this.marker || !player) return;
    const { x, y } = this.toMini(player.x, player.y);
    this.marker.setPosition(x, y);
    this.markerShadow.setPosition(x, y);
  }

  render() {
    this.dirty = false;
    this.renderedQuest = session.trackedQuest;
    this.renderedDone = session.completed.size;
    this.tweens.killAll();
    this.children.removeAll(true);
    this.setPadDirection(0, 0, null);
    this.renderStatus();
    this.renderMinimap();
    addLangButtons(this, this.scale.width - MARGIN, MARGIN);
    this.renderDestinationPointer();
    this.renderTalkControls();
    this.renderHudButtons();
    this.renderPlannerButton();
    this.restoreToasts();
    this.showRewardToast();
  }

  // 오른쪽 아래 아이콘 버튼 줄: [퀘스트 Q] [행사 V] [마감 공지 N]. 진행 중인 퀘스트가 없으면 퀘스트 버튼은 숨기고
  // 남은 버튼을 오른쪽 끝에 맞춰 줄 세웁니다. 배지: 퀘스트 = 진행 중 수, 행사 = 오늘 · 진행 중 수, 마감 공지 = D-3 이하 수.
  hudButtons() {
    const campus = this.scene.get("Campus");
    const quests = activeQuests().length;
    return [
      quests > 0 && { key: "Q", icon: "quest-icon", tip: "questTooltip", badge: quests, open: () => campus.openQuests() },
      { key: "V", icon: "event-icon", tip: "eventTooltip", badge: eventBadgeCount(), open: () => campus.openEvents() },
      { key: "N", icon: "alert-box", tip: "deadlineTooltip", badge: urgentCount(), blink: true, open: () => campus.openDeadlines() },
    ].filter(Boolean);
  }

  renderHudButtons() {
    const { size, gap } = HUD_BUTTON;
    const showKeys = !isTouchDevice(); // 단축키 글자는 PC에서만
    const y = this.scale.height - (showKeys ? HUD_BUTTON.insetWithKey : HUD_BUTTON.inset) - size;
    const buttons = this.hudButtons();
    let x = this.scale.width - HUD_BUTTON.inset - size;
    // 오른쪽부터 채우므로 거꾸로 놓습니다(마감 공지가 맨 오른쪽).
    [...buttons].reverse().forEach((b) => {
      this.renderHudButton(b, x, y, size, showKeys);
      x -= size + gap;
    });
    this.hudButtonsLeft = x + size + gap;
  }

  renderHudButton(b, x, y, size, showKeys) {
    const icon = this.add.image(x, y, b.icon).setOrigin(0).setScale(size / 16);
    if (b.badge > 0) {
      // 마감 공지는 지금처럼 D-3 이하가 있으면 천천히 깜빡입니다.
      if (b.blink) this.tweens.add({ targets: icon, alpha: 0.45, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      const badge = this.add.graphics();
      const bx = x + size - 10;
      const by = y - 10;
      badge.fillStyle(0x10182a, 1).fillRect(bx - 2, by - 2, 24, 24);
      badge.fillStyle(0xffffff, 1).fillRect(bx, by, 20, 20);
      addLabel(this, bx + 10, by + 10, String(b.badge), { size: 13, color: "#d93f3f" }).setOrigin(0.5);
    }
    if (showKeys) addLabel(this, x + size / 2, y + size + 3, b.key, { size: 12, color: "#c9d4e8" }).setOrigin(0.5, 0);

    // 마우스를 올리면 짧은 안내를 아이콘 위에 보여 줍니다.
    const tip = addLabel(this, x + size, y - 18, showKeys ? `${t(b.tip)} (${b.key})` : t(b.tip), {
      size: 13,
      color: "#ffffff",
      backgroundColor: "#10182a",
      padding: { x: 6, y: 3 },
    })
      .setOrigin(1, 1)
      .setVisible(false);
    const zone = this.add.zone(x, y, size, size).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on("pointerover", () => tip.setVisible(true));
    zone.on("pointerout", () => tip.setVisible(false));
    zone.on("pointerdown", () => {
      tip.setVisible(false);
      b.open();
    });
  }

  renderPlannerButton() {
    // 본선 범위 밖이라 숨깁니다(src/data/features.js). 버튼을 만들지 않으면 updatePlannerButton도 아무것도 하지 않습니다.
    if (!SHOW_OUT_OF_SCOPE) {
      this.plannerButton = null;
      return;
    }
    // 화면에서 너무 작아지지 않게 글자 크기를 정하고, 두 줄 글자 높이에 맞춰 버튼 높이를 정합니다.
    const size = Math.max(14, Math.round(this.touchSize(40) * 0.36));
    const probe = addLabel(this, 0, 0, t("plannerButton"), { size, lineSpacing: PLANNER_LINE_GAP, align: "center" });
    const w = Math.ceil(probe.width) + 32;
    const h = Math.max(this.touchSize(44), Math.ceil(probe.height) + 20);
    probe.destroy();
    const button = addButton(
      this,
      // 오른쪽 아래는 아이콘 버튼 줄 자리라, 그 왼쪽에 바닥을 맞춰 둡니다.
      this.hudButtonsLeft - HUD_BUTTON.gap - w,
      this.scale.height - HUD_BUTTON.inset - h,
      w,
      h,
      t("plannerButton"),
      () => this.scene.get("Campus").openPlanner(),
      { size, color: "#f2c94c" },
    );
    button.text.setAlign("center").setLineSpacing(PLANNER_LINE_GAP);
    this.plannerButton = [button.g, button.text, button.zone];
    this.updatePlannerButton();
  }

  updatePlannerButton() {
    const campus = this.scene.get("Campus");
    if (!this.plannerButton || !campus.player) return;
    const show = !campus.dialog?.isOpen && campus.isNearMainHall();
    this.plannerButton.forEach((o) => o.setVisible(show));
  }

  renderStatus() {
    const g = this.add.graphics();
    if (isGuest()) {
      drawPanel(g, MARGIN, MARGIN, 248, 58, { border: COLOR.line });
      addLabel(this, MARGIN + 16, MARGIN + 10, t("guestBadge"), { size: 16, color: "#f2c94c" });
      addLabel(this, MARGIN + 16, MARGIN + 32, t("guestNote"), { size: 12, color: "#a9b6cf" });
      return;
    }
    const { level, exp, expMax, points } = session;
    drawPanel(g, MARGIN, MARGIN, 248, 84);
    addLabel(this, MARGIN + 16, MARGIN + 10, `Lv.${level}`, { size: 20, color: "#f2c94c" });
    addLabel(this, MARGIN + 232, MARGIN + 14, `EXP ${exp}/${expMax}`, { size: 12, color: "#a9b6cf" }).setOrigin(1, 0);

    const bar = { x: MARGIN + 16, y: MARGIN + 36, w: 216, h: 12 };
    g.fillStyle(COLOR.shadow, 1).fillRect(bar.x, bar.y, bar.w, bar.h);
    g.fillStyle(0x58ad66, 1).fillRect(bar.x + 2, bar.y + 2, Math.round((bar.w - 4) * (exp / expMax)), bar.h - 4);

    addLabel(this, MARGIN + 16, MARGIN + 56, `★ ${points} ${t("points")}`, { size: 16 });

    // 상태창 오른쪽 아래의 로그아웃 버튼. 누르면 타이틀로 돌아갑니다.
    const logout = { w: 84, h: 26 };
    addButton(this, MARGIN + 232 - logout.w, MARGIN + 52, logout.w, logout.h, t("logout"), () => this.scene.get("Campus").logout(), {
      size: 12,
      border: COLOR.line,
      color: "#c9d4e8",
    });
  }
}
