import Phaser from "phaser";
import { registerTextures } from "../gfx/textures.js";
import { AUTH_MODE, restoreSession, signOut } from "../data/auth.js";
import { checkIn, getProgress } from "../data/progressApi.js";
import { applyProgress, notifyReward, onLangChange, session, t } from "../state.js";
import { createLoginOverlay } from "../ui/loginOverlay.js";
import { COLOR, addButton, addLabel, addLangButtons, centerLayout } from "../ui/widgets.js";

// 로그인 창은 게임 전체에서 하나만 만들어 다시 씁니다(로그아웃 후 타이틀로 돌아와도 같은 창).
let loginOverlay = null;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create() {
    // 로그아웃하고 타이틀로 돌아오면 이미 만든 그림을 다시 만들지 않습니다.
    if (!this.textures.exists("tiles")) registerTextures(this);
    centerLayout(this);
    this.starting = false;
    this.statusKey = null; // 진행 기록을 불러오는 중이거나 실패했을 때 보여 줄 문구
    this.dirty = true;
    const off = onLangChange(() => {
      this.dirty = true;
    });
    this.events.once("shutdown", off);

    loginOverlay ??= createLoginOverlay(this.game, {
      onSuccess: () => this.scene.get("Title").startStudent(),
      onClose: () => {},
    });

    // 새로고침해도 로그인이 남아 있으면 로그인 창 없이 바로 진행 기록을 불러옵니다.
    // (create가 끝나기 전에 답이 올 수 있어 isActive 대신 이 장면이 아직 떠 있는지를 직접 기록해 확인합니다.)
    this.alive = true;
    this.events.once("shutdown", () => {
      this.alive = false;
    });
    this.starting = true;
    restoreSession().then((loggedIn) => {
      if (!this.alive) return;
      this.starting = false;
      if (loggedIn) this.startStudent();
    });
  }

  // 버튼을 누르는 중에 지우지 않도록 언어 변경은 다음 프레임에 다시 그립니다.
  update() {
    if (this.dirty) this.render();
  }

  render() {
    this.dirty = false;
    this.children.removeAll(true);
    const cx = 480;

    // 잔디 위에 건물과 주인공이 있는 단순한 배경입니다. 화면이 넓어져도 끝까지 이어지게 그립니다.
    const g = this.add.graphics();
    g.fillStyle(0x6fb35a, 1).fillRect(-600, 440, 2160, 500);
    g.fillStyle(0xd9c9a3, 1).fillRect(-600, 488, 2160, 24);
    [[60, 340, 150, 100, 0x2f4d7c], [230, 370, 110, 70, 0xa5533f], [620, 360, 130, 80, 0x5d6d7c], [770, 330, 140, 110, 0x2f4d7c]].forEach(([x, y, w, h, roof]) => {
      g.fillStyle(0xe9e0cd, 1).fillRect(x, y, w, h);
      g.fillStyle(roof, 1).fillRect(x, y, w, h * 0.45);
      g.fillStyle(0x39506b, 1);
      for (let wx = x + 12; wx < x + w - 16; wx += 28) g.fillRect(wx, y + h * 0.6, 14, 14);
    });

    addLabel(this, cx, 96, t("title"), { size: 64, color: "#f2c94c" }).setOrigin(0.5).setFontFamily("Galmuri9, sans-serif");
    addLabel(this, cx, 156, t("subtitle"), { size: 20 }).setOrigin(0.5);

    addButton(this, cx - 150, 196, 300, 56, t("studentLogin"), () => this.begin("student"), { size: 22, color: "#f2c94c" });
    addButton(this, cx - 150, 264, 300, 56, t("guestBrowse"), () => this.begin("guest"), { size: 22, border: COLOR.line });
    const note = AUTH_MODE === "mock" ? `${t("demoNote")} · ${t("demoNoteMockLogin")}` : t("demoNote");
    addLabel(this, cx, 346, note, { size: 14, color: "#a9b6cf" }).setOrigin(0.5);
    if (this.statusKey) {
      const failed = this.statusKey !== "progressLoading";
      addLabel(this, cx, 376, t(this.statusKey), { size: 16, color: failed ? "#ff9a9a" : "#f2c94c" }).setOrigin(0.5);
    }

    const hero = this.add.sprite(cx, 468, "player", 0).setScale(4);
    hero.anims.play("walk-down");

    addLangButtons(this, 948, 12);
  }

  begin(mode) {
    if (this.starting || loginOverlay.isOpen()) return;
    if (mode === "guest") {
      session.mode = "guest";
      this.scene.start("Campus");
      return;
    }
    // 재학생: 학교 이메일 인증 코드 로그인 창을 엽니다. 로그인하면 startStudent로 이어집니다.
    this.statusKey = null;
    this.dirty = true;
    loginOverlay.show();
  }

  // 로그인된 재학생: 진행 기록 불러오기 → 출석 보상 → 캠퍼스 입장
  async startStudent() {
    if (this.starting) return;
    this.starting = true;
    this.statusKey = "progressLoading";
    this.dirty = true;
    try {
      const { progress } = await getProgress();
      applyProgress(progress);
    } catch (error) {
      console.warn("[progress] 진행 기록을 불러오지 못했습니다", { status: error?.status ?? null });
      this.starting = false;
      this.dirty = true;
      // 로그인이 만료됐으면(401) 로그인을 지우고 로그인 창을 다시 엽니다.
      if (error?.status === 401) {
        await signOut();
        this.statusKey = "loginSessionExpired";
        loginOverlay.show();
      } else {
        this.statusKey = "progressLoadFailed";
      }
      return;
    }
    try {
      const response = await checkIn();
      applyProgress(response.progress);
      // 출석 보상은 "ok"일 때만 알립니다. 캠퍼스에 들어가면 HUD가 띄웁니다.
      if (response.result === "ok") notifyReward(response.gained, "checkInReward");
    } catch (error) {
      // 출석 저장에 실패해도 게임은 시작합니다. 다음 접속 때 다시 받습니다.
      console.warn("[progress] 출석 보상을 저장하지 못했습니다", { status: error?.status ?? null });
    }
    session.mode = "student";
    this.scene.start("Campus");
  }
}
