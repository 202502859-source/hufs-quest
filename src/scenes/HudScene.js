import Phaser from "phaser";
import { applyProgress, getLang, isGuest, onLangChange, session, t } from "../state.js";
import { SHOW_OUT_OF_SCOPE } from "../data/features.js";
import { WORLD } from "../data/world.js";
import { overviewInfo, overviewTexture, placeName, trackedDestination } from "../ui/campusMap.js";
import { isTouchDevice, onTouchDetected } from "../device.js";
import { onDeadlinesChange, urgentCount } from "../data/deadlinesApi.js";
import { eventBadgeCount, onEventsChange } from "../data/eventsApi.js";
import { COLOR, addButton, addLabel, addLangButtons, drawPanel } from "../ui/widgets.js";
import { NOTICE_SHOW_MS, demoNoticeKind, mergeNotices, rewardNoticeText, startRewardNoticeWatch } from "../data/rewardNotices.js";
import { PROGRESS_MODE, getProgress } from "../data/progressApi.js";
import { addNoticeToast } from "../ui/noticeToast.js";
import { DAILY_QUIZ_BONUS_EXP, EVENT_REPORT_REWARD_EXP, STAMP_RALLY_REWARD } from "../../shared/progressRules.js";
import { STAMP_RALLY_STOPS } from "../../shared/stampRally.js";
import { STAMP_TOTAL, dailyState, nextStop, refreshDailyIfNewDay, retryRallyComplete } from "../dailyQuests.js";
import { buildingInfo } from "../data/buildingInfo.js";
import { DAILY_BODY_ALPHA, DAILY_FONT, DAILY_TAB_ALPHA, DAILY_TEXT_ALPHA, DAILY_TEXT_STROKE, HUD_BUTTON, MARGIN, MINIMAP_BUTTON_FONT, MINIMAP_PAD, hudSideLayout, loadDailyCollapsed, saveDailyCollapsed } from "../ui/hudLayout.js";
import { padLayout, touchSize } from "../ui/firstScreen.js";
import { addConfetti, addStampMark, addStampSlot } from "../ui/stampMark.js";
import { drawQuizDot } from "../ui/quizDot.js";

// 미니맵 · 일일 퀘스트 창 자리는 src/ui/hudLayout.js hudSideLayout(11/27: 오른쪽 위, 미니맵 PC 232px · 휴대폰 194px).
// 휴대폰 방향키 자리는 src/ui/firstScreen.js padLayout(첫 화면의 사이버관 안내원 화면 x에 맞춤).
// 미니맵 건물명: 스탬프 랠리 4곳과 시연 동선 건물을 먼저 놓고, 나머지는 넓은 건물 순. 다른 이름표와 겹치면 숨깁니다.
const MINIMAP_LABEL_FIRST = ["library", "union", "main", "humanities", "gatehouse", "cyber", "flc", "club"];
const DAILY_ANIM_MS = 200; // 일일 퀘스트 창 접기 · 펴기
const DAILY_CHECK_MS = 30_000; // 한국 시간 자정을 넘겼는지 확인하는 간격(1분 안에 도장 · 카운트가 0으로)
const BOOTH_BLINK_MS = 2500; // 다음 부스 위치 깜빡임
const BOOTH_DOT_COLOR = 0x2f6fd0; // 부스 지붕과 같은 파란색
const DAILY_TOAST = { stamp: 14, complete: 16 }; // 스탬프 획득 · 완주 알림 글자(보상 알림 20px보다 작게)
const PAD_ALPHA = 0.55;
const REWARD_TOAST_MS = 2500;
const PLANNER_LINE_GAP = 4;
// 오른쪽 아래 아이콘 버튼 줄(퀘스트 · 행사 · 마감 공지). PC는 아이콘 아래에 단축키를 쓰므로 바닥 여백이 더 큽니다.

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
    // 행사 제보 보상 알림(팀 확인 → 경험치): 재학생이면 캠퍼스에 들어오자마자 한 번(접속 안 했을 때 확인된 것),
    // 그 뒤에는 접속 중 주기적으로 확인합니다(src/data/rewardNotices.js). 로그아웃하면 멈춥니다.
    this.notice = null;
    if (session.mode === "student") {
      const stopNotices = startRewardNoticeWatch((notice) => this.queueEventNotice(notice));
      this.events.once("shutdown", stopNotices);
    }
    // 화면 확인용 예시 알림(?demoNotice=1 행사 · ?demoNotice=map 지도, 서버 안 부름)
    const demoKind = demoNoticeKind();
    if (demoKind) {
      const kinds = { event: demoKind === "event" ? 1 : 0, map: demoKind === "map" ? 1 : 0 };
      this.time.delayedCall(1200, () => this.queueEventNotice({ count: 1, exp: EVENT_REPORT_REWARD_EXP, kinds }, { demo: true }));
    }
    // 화면이 회전하거나 크기가 바뀌면 터치 버튼 크기를 다시 계산합니다.
    this.scale.on("resize", () => {
      this.dirty = true;
    });
    // 일일 퀘스트 창: 접힘 상태를 기억합니다(첫 방문은 펼침).
    this.dailyCollapsed = loadDailyCollapsed();
    this.dailyOpening = false;
    this.dailySignature = "";
    this.stampAnim = null;
    this.boothBlinkUntil = 0;
    // 게임을 켜 둔 채 한국 시간 자정을 넘기면 도장 · 일일 퀴즈 카운트를 0으로(재학생은 진행 상태를 다시 불러옴).
    this.time.addEvent({
      delay: DAILY_CHECK_MS,
      loop: true,
      callback: () =>
        refreshDailyIfNewDay()
          // 스탬프 4곳을 다 모았는데 완주 저장이 실패했던 경우(네트워크 오류 등) 여기서 다시 요청합니다.
          .then((changed) => retryRallyComplete().then((retried) => changed || retried))
          .then((changed) => {
            if (changed) this.dirty = true;
          }),
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
    if (this.dailySignature !== this.dailySignatureNow()) this.dirty = true;
    if (this.dirty) this.render();
    this.moveMinimapMarker();
    this.updateBoothBlink();
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
    // 화면 가운데가 아니라 플레이어가 화면에 그려진 자리 기준(첫 화면 카메라 오프셋으로 플레이어가 가운데가 아닐 수 있음)
    const px = (campus.player.x - camera.worldView.x) * camera.zoom;
    const py = (campus.player.y - camera.worldView.y) * camera.zoom;
    const x = px + Math.cos(angle) * 120;
    const y = py + Math.sin(angle) * 95;
    this.pointer.setPosition(x, y).setRotation(angle);
    this.pointerLabel.setPosition(x, y + (Math.sin(angle) > 0 ? -30 : 30)).setText(placeName(destination.building));
  }

  // 게임 화면을 실제 화면에 줄여 보여 주는 배율(css 폭 / 게임 폭)
  displayScale() {
    return this.game.canvas.getBoundingClientRect().width / this.scale.width || 1;
  }

  // 게임 화면이 확대·축소되어도 실제 크기가 최소 터치 크기 이상이 되는 게임 안 크기를 구합니다(src/ui/firstScreen.js).
  touchSize(minimum) {
    return touchSize(minimum, this.displayScale());
  }

  // 터치 기기에서만 방향 패드를 보여 줍니다. (건물 NPC를 없애 대화하기 버튼과 안내 문구는 쓰지 않습니다.)
  renderTalkControls() {
    this.pad = null;
    if (isTouchDevice()) this.renderPad();
  }

  // 터치 기기에서 캐릭터를 움직이는 방향 패드입니다.
  // 자리는 src/ui/firstScreen.js padLayout: 정중앙 x = 첫 화면에서 사이버관 안내원의 화면 x(고정, 플레이어를 따라가지 않음),
  // 세로는 아래에서 MARGIN + PAD_LIFT 위. 누르는 범위도 패드 가운데 기준이고, 첫 화면의 안내원 · 정문 · HUD를 피해 잘라 냅니다.
  renderPad() {
    // 보이는 패드는 작고 반투명하게 그리되, 누르는 범위는 넓게 둡니다. 작아져도 손가락으로 조작하기 쉽게 하기 위해서입니다.
    const layout = padLayout({ W: this.scale.width, H: this.scale.height, touch: true, displayScale: this.displayScale() });
    const { cell } = layout;
    const left = layout.pad.x;
    const top = layout.pad.y;
    this.padRect = layout.pad;
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

    this.padCenter = { x: layout.center.x, y: layout.center.y, deadZone: cell * 0.3 };
    const zone = this.add.zone(layout.zone.x, layout.zone.y, layout.zone.w, layout.zone.h).setOrigin(0).setInteractive();
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
      // 일일 퀘스트 알림(일일 퀴즈 보너스 · 랠리 완주)은 조금 작게 띄웁니다.
      const daily = reward.label === "dailyQuizBonus" || reward.label === "rallyComplete";
      this.showToast(reward.label ? t(reward.label, reward) : parts.join(", "), daily ? { y, size: DAILY_TOAST.complete } : { y });
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

  // 행사 제보 보상 알림을 받습니다. 이미 떠 있는 알림이 있으면 건수 · 경험치를 합쳐 다시 2초 띄웁니다.
  // 진짜 진행 저장이면 서버의 새 경험치를 받아 상태창을 고칩니다(레벨이 오르면 기존 "레벨 업!" 알림도 뜸).
  queueEventNotice(notice, { demo = false } = {}) {
    const active = this.notice && this.notice.until > this.time.now ? this.notice : null;
    this.notice = { ...mergeNotices(active, notice), until: this.time.now + NOTICE_SHOW_MS };
    this.drawEventNotice();
    if (!demo && session.mode === "student" && PROGRESS_MODE === "real") {
      getProgress()
        .then(({ progress }) => {
          applyProgress(progress);
          this.dirty = true;
        })
        .catch(() => {});
    }
  }

  // 화면 아래 가운데에 작은 알림("+20 EXP" 칩 + 문구, 시설 소개 말풍선과 같은 모양)을 그립니다. render 뒤에도 남은 시간만큼 다시 그립니다.
  drawEventNotice() {
    this.noticeToast?.destroy();
    this.noticeToast = null;
    if (!this.notice || this.notice.until <= this.time.now) return;
    const { key, vars, chip } = rewardNoticeText(this.notice);
    const toast = addNoticeToast(this, this.scale.width / 2, this.scale.height - 16, chip, t(key, vars)).setDepth(50);
    // 왼쪽 아래 방향키(휴대폰) · 오른쪽 아래 버튼 줄과 겹치지 않게, 너무 길면 가운데 폭 안으로 줄입니다.
    const W = this.scale.width;
    const leftLimit = this.pad && this.padRect ? this.padRect.x + this.padRect.w + MARGIN : MARGIN;
    const rightLimit = (this.hudButtonsLeft ?? W) - MARGIN;
    const maxWidth = 2 * Math.min(W / 2 - leftLimit, rightLimit - W / 2);
    if (toast.width > maxWidth) toast.setScale(maxWidth / toast.width);
    this.noticeToast = toast;
    this.tweens.add({
      targets: toast,
      alpha: 0,
      delay: Math.max(0, this.notice.until - this.time.now),
      duration: 400,
      onComplete: () => {
        toast.destroy();
        if (this.noticeToast === toast) this.noticeToast = null;
      },
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

  // 오른쪽 위(미니맵 + 일일 퀘스트 창) 자리 계산(src/ui/hudLayout.js hudSideLayout). 접힌 탭 너비는 제목 글자 너비로 정합니다.
  sideLayout() {
    const info = overviewInfo();
    const probe = addLabel(this, 0, 0, `◀ ${t("dailyTitle")}`, { size: DAILY_FONT.title });
    const tabWidth = Math.ceil(probe.width) + 20;
    probe.destroy();
    return hudSideLayout({
      W: this.scale.width,
      H: this.scale.height,
      touch: isTouchDevice(),
      guest: isGuest(),
      collapsed: this.dailyCollapsed,
      displayScale: this.displayScale(),
      mapAspect: info.height / info.width,
      tabWidth,
    });
  }

  dailySignatureNow() {
    const d = session.daily;
    return `${d.date}|${d.stamps.join(",")}|${d.quizCorrect}|${d.rallyDone}|${d.quizBonusDone}|${session.mode}`;
  }

  /*
   * 일일 퀘스트 창(미니맵 바로 아래, 오른쪽 선을 미니맵과 맞춤). 제목 줄을 누르면 접히거나 펴집니다.
   * 접힘: 오른쪽 끝에 붙은 탭 "◀ 일일 퀘스트". 펼침: 오른쪽 선은 그대로, 왼쪽으로 열림(0.2초), 제목 "▶ 일일 퀘스트"(누르면 오른쪽으로 접힘).
   * 내용: (1) 스탬프 랠리 — 도장 4칸 + "다음: 본관"(완주하면 "완주! +50 EXP") (2) 일일 퀴즈 — "맞춘 정답: 0/10개"(10개면 "완료! 보너스 +50 EXP")
   * 줄을 누르면 상세 창(4곳 체크 목록)이 열리고, 닫으면 미니맵에서 다음 부스가 깜빡입니다.
   */
  renderDailyPanel(layout) {
    const { x, y, w, h, tabH, rows, right } = layout;
    const lang = getLang();
    const daily = dailyState();
    this.dailySignature = this.dailySignatureNow();
    const collapsed = this.dailyCollapsed;

    if (collapsed) {
      // 접힘: 미니맵 아래 오른쪽 끝에 붙은 제목 탭만
      const tab = this.add.graphics();
      const title = addLabel(this, right - 10, y + tabH / 2, `◀ ${t("dailyTitle")}`, { size: DAILY_FONT.title, color: "#f2c94c" }).setOrigin(1, 0.5);
      const tabW = Math.ceil(title.width) + 20;
      drawPanel(tab, right - tabW, y, tabW, tabH, { border: COLOR.line });
      this.children.bringToTop(title);
      const tabZone = this.add.zone(right - tabW, y, tabW, tabH).setOrigin(0).setInteractive({ useHandCursor: true });
      tabZone.on("pointerdown", () => this.toggleDailyPanel());
      this.dailyBody = null;
      return;
    }

    // 펼친 창: 오른쪽 선을 기준점으로 왼쪽으로 열리도록, 컨테이너를 오른쪽 끝에 두고 안쪽 그림을 왼쪽(−w)에 그립니다(scaleX).
    // 제목 탭은 불투명, 그 아래 본문 바탕만 반투명(DAILY_BODY_ALPHA) — 뒤의 맵이 비쳐 보입니다. 글자 · 도장은 불투명 그대로.
    const body = this.add.container(right, y);
    const g = this.add.graphics();
    const bodyH = h - tabH;
    g.fillStyle(COLOR.shadow, DAILY_BODY_ALPHA).fillRect(-w + 4, tabH + 4, w, bodyH);
    g.fillStyle(COLOR.line, DAILY_BODY_ALPHA).fillRect(-w, tabH, w, bodyH - 4).fillRect(-w + 4, tabH, w - 8, bodyH);
    g.fillStyle(COLOR.fill, DAILY_BODY_ALPHA).fillRect(-w + 4, tabH, w - 8, bodyH - 4);
    drawPanel(g, -w, 0, w, tabH, { border: COLOR.line, alpha: DAILY_TAB_ALPHA });
    body.add(g);
    // 맵 위에서도 읽히게 본문 글자에 1px 어두운 테두리(Phaser strokeThickness는 안팎 합이라 2배)
    const stroke = { stroke: DAILY_TEXT_STROKE.color, strokeThickness: DAILY_TEXT_STROKE.px * 2 };
    const put = (px, py, text, style) => {
      const label = addLabel(this, px - w, py, text, { ...stroke, ...style }).setAlpha(DAILY_TEXT_ALPHA);
      body.add(label);
      return label;
    };
    put(10, tabH / 2, `▶ ${t("dailyTitle")}`, { size: DAILY_FONT.title, color: "#f2c94c", strokeThickness: 0 }).setOrigin(0, 0.5);
    const tabZone = this.add.zone(x, y, w, tabH).setOrigin(0).setInteractive({ useHandCursor: true });
    tabZone.on("pointerdown", () => this.toggleDailyPanel());
    const guest = isGuest();
    const done = daily.rallyDone || daily.stamps.length >= STAMP_TOTAL;

    put(rows.rallyLabel.x, rows.rallyLabel.y, t("dailyRally"), { size: DAILY_FONT.row, color: "#ffffff" });
    const next = nextStop();
    const nextInfo = next ? buildingInfo(next) : null;
    const nextText = done
      ? guest
        ? t("dailyRallyDoneGuest")
        : t("dailyRallyDone", { exp: STAMP_RALLY_REWARD.exp })
      : t("dailyRallyNext", { place: rows.shortNext ? STAMP_RALLY_STOPS.find((s) => s.buildingId === next).label[lang] : (lang === "en" ? nextInfo.nameEn : null) ?? nextInfo.name });
    put(rows.next.x, rows.next.y, nextText, { size: DAILY_FONT.small, color: done ? "#9df0ae" : "#a9b6cf" });

    // 도장 4칸: 빈 칸은 점선 원, 받은 곳은 빨간 도장(방금 받은 곳은 찍히는 연출)
    const { radius, gap } = rows.stamps;
    STAMP_RALLY_STOPS.forEach((stop, i) => {
      const cx = rows.stamps.x + i * (radius * 2 + gap);
      const cy = rows.stamps.y;
      body.add(addStampSlot(this, cx - w, cy, radius));
      if (!daily.stamps.includes(stop.buildingId)) return;
      const animate = this.stampAnim?.id === stop.buildingId && this.stampAnim.until > this.time.now;
      body.add(addStampMark(this, cx - w, cy, radius, stop.label[lang], { animate, seed: stop.buildingId }));
    });
    this.stampAnim = null;

    put(rows.quizLabel.x, rows.quizLabel.y, t("dailyQuiz"), { size: DAILY_FONT.row, color: "#ffffff" });
    const quizDone = daily.quizBonusDone || daily.quizCorrect >= daily.quizGoal;
    const quizText = quizDone
      ? guest
        ? t("dailyQuizDoneGuest")
        : t("dailyQuizDone", { exp: DAILY_QUIZ_BONUS_EXP })
      : t("dailyQuizCount", { n: daily.quizCorrect, goal: daily.quizGoal });
    const count = put(rows.quizCount.x, rows.quizCount.y, quizText, { size: DAILY_FONT.small, color: quizDone ? "#9df0ae" : "#a9b6cf" });
    if (rows.quizCount.alignRight) count.setOrigin(1, 0);
    if (rows.note) put(rows.note.x, rows.note.y, t("dailyGuestNote"), { size: DAILY_FONT.note, color: "#7f8ca6" });

    // 줄을 누르면 상세 창(스탬프 랠리 4곳 체크 목록 · 일일 퀴즈)
    [rows.rallyZone, rows.quizZone].forEach((zoneRow) => {
      const zone = this.add.zone(x, y + zoneRow.y, w, zoneRow.h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => {
        this.blinkNextBooth();
        this.scene.get("Campus").openQuests();
      });
    });

    this.dailyBody = body;
    if (this.dailyOpening) {
      // 오른쪽 기준점(컨테이너 자리 = 오른쪽 선)에서 왼쪽으로 펼쳐집니다.
      this.dailyOpening = false;
      body.setScale(0.12, 1).setAlpha(0.3);
      this.tweens.add({ targets: body, scaleX: 1, alpha: 1, duration: DAILY_ANIM_MS, ease: "Quad.easeOut" });
    }
  }

  // 제목 줄을 누르면 접거나 폅니다. 접을 때는 0.2초 동안 오른쪽으로 닫힌 뒤 탭만 남깁니다.
  toggleDailyPanel() {
    if (this.dailyToggling) return;
    if (this.dailyCollapsed) {
      this.dailyCollapsed = false;
      this.dailyOpening = true;
      saveDailyCollapsed(false);
      this.dirty = true;
      return;
    }
    this.dailyToggling = true;
    saveDailyCollapsed(true);
    const finish = () => {
      this.dailyToggling = false;
      this.dailyCollapsed = true;
      this.dirty = true;
    };
    if (!this.dailyBody) return finish();
    this.tweens.add({ targets: this.dailyBody, scaleX: 0.12, alpha: 0.3, duration: DAILY_ANIM_MS, ease: "Quad.easeIn", onComplete: finish });
    // 접히는 중에 HUD가 다시 그려져 트윈이 사라져도 접힘은 끝나게 합니다.
    this.time.delayedCall(DAILY_ANIM_MS + 60, () => this.dailyToggling && finish());
  }

  // 부스 문제 창이 닫혔을 때(CampusScene.openBooth): 스탬프 획득 알림 · 도장 찍히는 연출 · 완주 알림
  onBoothClosed(outcome) {
    this.dirty = true;
    if (!outcome?.stamped) return;
    this.stampAnim = { id: outcome.buildingId, until: this.time.now + 1500 };
    const y = isTouchDevice() ? 110 : 74;
    this.showToast(t("stampCollected", { n: outcome.count, total: STAMP_TOTAL }), { y, size: DAILY_TOAST.stamp });
    if (outcome.completedNow) {
      const text = isGuest() ? t("rallyCompleteGuest") : t("rallyComplete", { exp: outcome.gained?.exp || STAMP_RALLY_REWARD.exp });
      this.showToast(text, { y: y + 42, size: DAILY_TOAST.complete });
      this.pendingConfetti = true;
    }
  }

  // 미니맵에서 다음 부스 위치를 2.5초 깜빡입니다(일일 퀘스트 창의 줄을 누르거나 상세 창을 닫았을 때).
  blinkNextBooth() {
    this.boothBlinkUntil = this.time.now + BOOTH_BLINK_MS;
  }

  nextBoothSpot() {
    const next = nextStop();
    return next ? WORLD.buildings.find((b) => b.id === next)?.booth ?? null : null;
  }

  updateBoothBlink() {
    if (!this.boothBlink) return;
    const spot = this.time.now < this.boothBlinkUntil ? this.nextBoothSpot() : null;
    const on = Boolean(spot) && Math.floor(this.time.now / 220) % 2 === 0;
    this.boothBlink.setVisible(on);
    if (on) {
      const { x, y } = this.toMini(spot.x, spot.y);
      this.boothBlink.setPosition(x, y);
    }
  }

  // 미니맵입니다. PC · 휴대폰 모두 오른쪽 위(검색창 · KO/EN 버튼 아래). 클릭하면 전체 지도가 열립니다.
  renderMinimap(layout) {
    const size = { width: layout.mapW, dot: layout.dot };
    const info = overviewInfo();
    const scale = size.width / info.width;
    const mapW = layout.mapW;
    const mapH = layout.mapH;
    const panelH = layout.panelH;
    const x = layout.x;
    const y = layout.y;
    const g = this.add.graphics();
    drawPanel(g, x, y, layout.panelW, panelH, { border: COLOR.line });
    this.minimap = { x: x + MINIMAP_PAD, y: y + MINIMAP_PAD, w: mapW, h: mapH, dot: size.dot, label: layout.label };
    // 월드 px → 미니맵 안 px
    this.toMini = (wx, wy) => ({ x: this.minimap.x + wx * info.perWorld * scale, y: this.minimap.y + wy * info.perWorld * scale });
    this.add.image(this.minimap.x, this.minimap.y, overviewTexture(this)).setOrigin(0).setScale(scale);
    this.renderMinimapLabels();
    addLabel(this, x + MINIMAP_PAD + mapW / 2, y + mapH + 13, t("mapButton"), { size: MINIMAP_BUTTON_FONT, color: "#f2c94c" }).setOrigin(0.5, 0);

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

    // 스탬프 랠리 부스 위치(파란 점, 오늘 아직 안 받은 곳만)와 다음 부스 깜빡임 표시
    const boothDots = this.add.graphics();
    WORLD.buildings
      .filter((b) => b.booth && !session.daily.stamps.includes(b.id))
      .forEach((b) => {
        const p = this.toMini(b.booth.x, b.booth.y);
        boothDots.fillStyle(0xffffff, 1).fillRect(p.x - 3 * k, p.y - 3 * k, 6 * k, 6 * k);
        boothDots.fillStyle(BOOTH_DOT_COLOR, 1).fillRect(p.x - 2 * k, p.y - 2 * k, 4 * k, 4 * k);
      });
    this.boothBlink = this.add.rectangle(0, 0, 12 * k, 12 * k).setStrokeStyle(2, 0xffe14d).setVisible(false);

    // 퀴즈 상자 위치(샛노란 작은 원, 깜빡이지 않음). 상자가 풀리고 다시 생길 때마다 매 프레임 다시 그립니다.
    this.quizDots = this.add.graphics();
    this.drawQuizDots();

    this.markerShadow = this.add.rectangle(0, 0, 8 * k, 8 * k, 0x10182a);
    this.marker = this.add.rectangle(0, 0, 4 * k, 4 * k, 0xffe14d);
    this.tweens.add({ targets: this.marker, alpha: 0.25, duration: 400, yoyo: true, repeat: -1 });
    this.moveMinimapMarker();

    const zone = this.add.zone(x, y, layout.panelW, panelH).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => this.scene.get("Campus").openMap());
  }

  // 미니맵 건물명(한 줄: buildingInfo.js의 name, 영어는 nameEn → 없으면 한국어). 미니맵 끝에 걸리면 안쪽으로 당기고,
  // 그래도 이미 놓인 이름표와 겹치면 덜 중요한 것을 숨깁니다.
  renderMinimapLabels() {
    const lang = getLang();
    const rank = (b) => {
      const i = MINIMAP_LABEL_FIRST.indexOf(b.id);
      return i >= 0 ? i : MINIMAP_LABEL_FIRST.length;
    };
    const areaOf = (b) => (b.box ? (b.box.x1 - b.box.x0) * (b.box.y1 - b.box.y0) : b.w * b.h);
    const order = [...WORLD.buildings].sort((a, b) => rank(a) - rank(b) || areaOf(b) - areaOf(a));
    const placed = [];
    const m = this.minimap;
    order.forEach((b) => {
      const name = (lang === "en" ? b.nameEn : null) ?? b.name;
      const { x, y } = this.toMini(b.mapLabel[0], b.mapLabel[1]);
      const label = addLabel(this, x, y, name, {
        size: m.label,
        fontFamily: "Galmuri9, sans-serif",
        backgroundColor: "rgba(16, 24, 42, 0.78)",
        padding: { x: 2, y: 1 },
      }).setOrigin(0.5);
      // 미니맵 가장자리 건물(외국어연수평가원 등)은 지우지 않고 안쪽으로 당깁니다.
      // 이미 놓인 이름표와 겹치면 위 · 아래 · 옆으로 한 칸씩 비켜 보고, 그래도 겹치면 숨깁니다.
      const { width: w, height: h } = label;
      const clampX = (v) => Phaser.Math.Clamp(v, m.x + w / 2 + 1, m.x + m.w - w / 2 - 1);
      const clampY = (v) => Phaser.Math.Clamp(v, m.y + h / 2 + 1, m.y + m.h - h / 2 - 1);
      const overlaps = (r) => placed.some((o) => r.x < o.x + o.w + 1 && o.x < r.x + r.w + 1 && r.y < o.y + o.h + 1 && o.y < r.y + r.h + 1);
      const spot = [[0, 0], [0, -h - 1], [0, h + 1], [-w / 2, 0], [w / 2, 0]]
        .map(([dx, dy]) => ({ x: clampX(x + dx) - w / 2, y: clampY(y + dy) - h / 2, w, h }))
        .find((r) => !overlaps(r));
      if (!spot) {
        label.destroy();
        return;
      }
      label.setPosition(spot.x + w / 2, spot.y + h / 2);
      placed.push(spot);
    });
  }

  drawQuizDots() {
    const boxes = this.scene.get("Campus").quizBoxes?.boxes;
    if (!this.quizDots || !boxes) return;
    const k = this.minimap.dot;
    this.quizDots.clear();
    boxes.forEach((box) => {
      const { x, y } = this.toMini(box.x, box.y);
      drawQuizDot(this.quizDots, x, y, k); // 작은 샛노란 원(정지 표시, src/ui/quizDot.js)
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
    const side = this.sideLayout();
    this.renderMinimap(side.minimap);
    this.renderDailyPanel(side.daily);
    addLangButtons(this, this.scale.width - MARGIN, MARGIN);
    this.renderDestinationPointer();
    this.renderTalkControls();
    this.renderHudButtons();
    this.renderPlannerButton();
    this.restoreToasts();
    this.showRewardToast();
    this.drawEventNotice();
    if (this.pendingConfetti) {
      // 랠리 완주 축하: 화면 위쪽 가운데에서 작은 색종이
      this.pendingConfetti = false;
      addConfetti(this, this.scale.width / 2, isTouchDevice() ? 130 : 96, { spread: 260 });
    }
  }

  // 오른쪽 아래 아이콘 버튼 줄: [행사 V] [마감 공지 N]. 배지: 행사 = 오늘 · 진행 중 수, 마감 공지 = D-3 이하 수.
  // 11/27: 퀘스트 버튼은 일일 퀘스트 창(오른쪽 위 미니맵 아래)으로 대체했습니다. Q 키는 일일 퀘스트 상세 창을 엽니다.
  hudButtons() {
    const campus = this.scene.get("Campus");
    return [
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
