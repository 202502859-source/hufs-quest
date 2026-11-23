import Phaser from "phaser";
import { QUEST_LIST, getLang, isGuest, onLangChange, session, t } from "../state.js";
import { SHOW_OUT_OF_SCOPE } from "../data/features.js";
import { overviewInfo, overviewTexture, placeName, trackedDestination } from "../ui/campusMap.js";
import { isTouchDevice, onTouchDetected } from "../device.js";
import { onDeadlinesChange, urgentCount } from "../data/deadlinesApi.js";
import { COLOR, addButton, addLabel, addLangButtons, drawPanel } from "../ui/widgets.js";

const MINIMAP_W = 176; // 미니맵 가로(px). 세로는 맵 비율대로
const MIN_TOUCH_PX = 52; // 실제 화면에서 최소 48px 이상이 되도록 약간 여유를 둡니다.
const PAD_ALPHA = 0.55;
const REWARD_TOAST_MS = 2500;
const MARGIN = 12;
const BANNER_Y = MARGIN + 44; // 맨 위 줄(검색창, KO/EN) 아래
const QUEST_WIDTH = 272;
const PLANNER_LINE_GAP = 4;
const QUIZ_DOT_COLOR = 0xff9f1c; // 내 위치(노란 점)와 구분되는 주황색
const ALERT_ICON = { size: 64, inset: 16, gap: 12 };

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

  // 왼쪽의 미니맵입니다. 클릭하면 전체 지도가 열립니다.
  renderMinimap() {
    const x = MARGIN;
    const y = MARGIN + (isGuest() ? 70 : 96);
    const info = overviewInfo();
    const scale = MINIMAP_W / info.width;
    const mapW = MINIMAP_W;
    const mapH = Math.round(info.height * scale);
    const g = this.add.graphics();
    drawPanel(g, x, y, mapW + 16, mapH + 40, { border: COLOR.line });
    this.minimap = { x: x + 8, y: y + 8 };
    // 월드 px → 미니맵 안 px
    this.toMini = (wx, wy) => ({ x: this.minimap.x + wx * info.perWorld * scale, y: this.minimap.y + wy * info.perWorld * scale });
    this.minimapBottom = y + mapH + 44;
    this.add.image(this.minimap.x, this.minimap.y, overviewTexture(this)).setOrigin(0).setScale(scale);
    addLabel(this, x + 8 + mapW / 2, y + mapH + 14, t("mapButton"), { size: 13, color: "#f2c94c" }).setOrigin(0.5, 0);

    const destination = trackedDestination();
    if (destination) {
      const { x: dx, y: dy } = this.toMini(destination.worldX, destination.worldY);
      this.add.rectangle(dx, dy, 10, 10, 0xffffff);
      const dot = this.add.rectangle(dx, dy, 6, 6, 0xe5484d);
      this.tweens.add({ targets: dot, alpha: 0.25, duration: 400, yoyo: true, repeat: -1 });
      this.minimapDestination = { x: dx, y: dy };
    } else {
      this.minimapDestination = null;
    }

    // 퀴즈 상자 위치(주황 점). 상자가 풀리고 다시 생길 때마다 매 프레임 다시 그립니다.
    this.quizDots = this.add.graphics();
    this.drawQuizDots();

    this.markerShadow = this.add.rectangle(0, 0, 8, 8, 0x10182a);
    this.marker = this.add.rectangle(0, 0, 4, 4, 0xffe14d);
    this.tweens.add({ targets: this.marker, alpha: 0.25, duration: 400, yoyo: true, repeat: -1 });
    this.moveMinimapMarker();

    const zone = this.add.zone(x, y, mapW + 16, mapH + 40).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => this.scene.get("Campus").openMap());
  }

  drawQuizDots() {
    const boxes = this.scene.get("Campus").quizBoxes?.boxes;
    if (!this.quizDots || !boxes) return;
    this.quizDots.clear();
    boxes.forEach((box) => {
      const { x, y } = this.toMini(box.x, box.y);
      this.quizDots.fillStyle(0x10182a, 1).fillRect(x - 2, y - 2, 6, 6);
      this.quizDots.fillStyle(QUIZ_DOT_COLOR, 1).fillRect(x - 1, y - 1, 4, 4);
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
    this.renderBanner();
    this.renderQuests();
    addLangButtons(this, this.scale.width - MARGIN, MARGIN);
    this.renderDestinationPointer();
    this.renderTalkControls();
    this.renderAlertIcon();
    this.renderPlannerButton();
    this.restoreToasts();
    this.showRewardToast();
  }

  // 본관 근처에서만 보이는 "수강신청 추천 서비스" 버튼입니다. 오른쪽 아래에 두 줄로 둡니다.
  // 마감 임박 공지 아이콘의 위치입니다. 오른쪽 아래, 가장자리에서 16px 안쪽의 64x64 정사각형입니다.
  alertIconRect() {
    return {
      x: this.scale.width - ALERT_ICON.inset - ALERT_ICON.size,
      y: this.scale.height - ALERT_ICON.inset - ALERT_ICON.size,
      size: ALERT_ICON.size,
    };
  }

  // 빨간 '!' 상자 아이콘. D-3 이하 항목이 있으면 천천히 깜빡이고 오른쪽 위에 개수 배지를 붙입니다.
  renderAlertIcon() {
    const { x, y, size } = this.alertIconRect();
    const icon = this.add.image(x, y, "alert-box").setOrigin(0).setScale(size / 16);
    const urgent = urgentCount();
    if (urgent > 0) {
      this.tweens.add({ targets: icon, alpha: 0.45, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      const badge = this.add.graphics();
      const bx = x + size - 10;
      const by = y - 10;
      badge.fillStyle(0x10182a, 1).fillRect(bx - 2, by - 2, 24, 24);
      badge.fillStyle(0xffffff, 1).fillRect(bx, by, 20, 20);
      addLabel(this, bx + 10, by + 10, String(urgent), { size: 13, color: "#d93f3f" }).setOrigin(0.5);
    }

    // 마우스를 올리면 짧은 안내를 아이콘 위에 보여 줍니다.
    const tip = addLabel(this, x + size, y - 18, t("deadlineTooltip"), {
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
      this.scene.get("Campus").openDeadlines();
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
      // 오른쪽 아래 모서리는 마감 임박 공지 아이콘 자리라, 그 왼쪽에 바닥을 맞춰 둡니다.
      this.alertIconRect().x - ALERT_ICON.gap - w,
      this.scale.height - ALERT_ICON.inset - h,
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

  // 오늘의 행사 배너입니다. 맨 위 줄은 검색창이 쓰므로 퀘스트 목록 바로 위에 둡니다.
  renderBanner() {
    const rightEdge = this.scale.width - MARGIN;
    const text = addLabel(this, 0, BANNER_Y + 7, t("todayEvent"), { size: 16, color: "#231a00" });
    const w = Math.max(QUEST_WIDTH, text.width + 44);
    const x = rightEdge - w;
    const g = this.add.graphics();
    drawPanel(g, x, BANNER_Y, w, 32, { fill: COLOR.gold, border: 0xfff0b8 });
    text.setX(x + 30);
    text.setDepth(1);
    const dot = this.add.rectangle(x + 16, BANNER_Y + 16, 8, 8, 0xd93f3f).setDepth(1);
    this.tweens.add({ targets: dot, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
  }

  // 퀘스트 줄을 누르면 설명 창이 열립니다.
  addQuestLink(x, rowY, rowHeight, id) {
    addLabel(this, x + QUEST_WIDTH - 24, rowY + 2, "▶", { size: 12, color: "#f2c94c" });
    const hover = this.add.rectangle(x + 10, rowY - 4, QUEST_WIDTH - 20, rowHeight - 4, 0xffffff, 0.12).setOrigin(0).setVisible(false);
    const zone = this.add.zone(x + 10, rowY - 4, QUEST_WIDTH - 20, rowHeight - 4).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on("pointerover", () => hover.setVisible(true));
    zone.on("pointerout", () => hover.setVisible(false));
    zone.on("pointerdown", () => {
      hover.setVisible(false);
      this.scene.get("Campus").openQuestInfo(id);
    });
  }

  renderQuests() {
    const x = this.scale.width - MARGIN - QUEST_WIDTH;
    const y = BANNER_Y + 40;
    const rowHeight = isGuest() ? 44 : 30;
    const destination = trackedDestination();
    const h = 44 + QUEST_LIST.length * rowHeight + (destination ? 26 : 0);
    const g = this.add.graphics();
    drawPanel(g, x, y, QUEST_WIDTH, h, { alpha: 0.94 });
    addLabel(this, x + 16, y + 12, t("quests"), { size: 16, color: "#f2c94c" });

    QUEST_LIST.forEach((quest, i) => {
      const rowY = y + 40 + i * rowHeight;
      const locked = isGuest() && quest.studentOnly;
      g.lineStyle(2, locked ? COLOR.line : COLOR.border, 1).strokeRect(x + 17, rowY + 3, 10, 10);
      if (session.completed.has(quest.id)) g.fillStyle(COLOR.border, 1).fillRect(x + 20, rowY + 6, 4, 4);
      const tracked = session.trackedQuest === quest.id;
      addLabel(this, x + 36, rowY, quest.name[getLang()], { size: 14, color: locked ? "#7f8ca6" : tracked ? "#ff8f92" : "#ffffff" });
      this.addQuestLink(x, rowY, rowHeight, quest.id);
      if (isGuest()) {
        addLabel(this, x + 36, rowY + 19, locked ? t("studentOnly") : "", { size: 12, color: "#7f8ca6" });
      }
    });

    if (destination) {
      addLabel(this, x + 17, y + 40 + QUEST_LIST.length * rowHeight, `${t("destination")}: ${placeName(destination.building)}`, { size: 13, color: "#ff8f92" });
    }
  }
}
