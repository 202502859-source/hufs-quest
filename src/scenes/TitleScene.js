import Phaser from "phaser";
import { registerTextures } from "../gfx/textures.js";
import { onLangChange, session, t } from "../state.js";
import { COLOR, addButton, addLabel, addLangButtons, centerLayout } from "../ui/widgets.js";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create() {
    registerTextures(this);
    centerLayout(this);
    this.dirty = true;
    const off = onLangChange(() => {
      this.dirty = true;
    });
    this.events.once("shutdown", off);
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
    addLabel(this, cx, 346, t("demoNote"), { size: 14, color: "#a9b6cf" }).setOrigin(0.5);

    const hero = this.add.sprite(cx, 468, "player", 0).setScale(4);
    hero.anims.play("walk-down");

    addLangButtons(this, 948, 12);
  }

  begin(mode) {
    session.mode = mode;
    this.scene.start("Campus");
  }
}
