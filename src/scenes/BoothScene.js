import Phaser from "phaser";
import { STAMP_RALLY_STOPS } from "../../shared/stampRally.js";
import { STAMP_RALLY_REWARD, STAMP_TOTAL, hasStamp, stampCount, submitBoothAnswer, todayBoothQuestion } from "../dailyQuests.js";
import { getLang, isGuest, t } from "../state.js";
import { COLOR, addButton, addLabel, addShade, centerLayout, drawPanel } from "../ui/widgets.js";
import { addConfetti, addStampMark, addStampSlot } from "../ui/stampMark.js";

// 960x540 기준 배치. O/X 퀴즈 창(QuizScene)보다 작은 창이고, 글자는 HUD 글자(12~16px)에 맞춥니다.
const PANEL = { x: 200, y: 128, w: 560, h: 296 };
const TAB = { x: 220, y: 92, h: 34 };
const LEFT = PANEL.x + 24;
const WIDTH = PANEL.w - 48;
const OPTION = { h: 34, gap: 8, y: PANEL.y + 84 };
const CLOSE = { w: 112, h: 34 };
export const BOOTH_FONT = { title: 15, question: 15, option: 14, hint: 12, result: 15 };
const STAMP_BIG = 44; // 문제 창에 크게 보여 주는 도장 반지름

// 스탬프 랠리 부스에서 Enter를 누르면 뜨는, 부스 사람이 문제를 내는 작은 창입니다.
export class BoothScene extends Phaser.Scene {
  constructor() {
    super("Booth");
  }

  create({ buildingId, onClose }) {
    this.buildingId = buildingId;
    this.onClose = onClose;
    this.busy = false;
    this.outcome = null; // 닫을 때 CampusScene에 알릴 결과
    this.openId = (this.openId ?? 0) + 1;
    const lang = getLang();
    this.stop = STAMP_RALLY_STOPS.find((s) => s.buildingId === buildingId);
    centerLayout(this);
    addShade(this, 0.55);

    const panel = this.add.graphics();
    drawPanel(panel, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    const tabText = addLabel(this, TAB.x + 14, TAB.y + 8, t("boothTitle"), { size: BOOTH_FONT.title, color: "#f2c94c" });
    const tab = this.add.graphics();
    drawPanel(tab, TAB.x, TAB.y, tabText.width + 28, TAB.h);
    this.children.bringToTop(tabText);

    addButton(this, PANEL.x + PANEL.w - 24 - CLOSE.w, PANEL.y + PANEL.h - 18 - CLOSE.h, CLOSE.w, CLOSE.h, t("quizClose"), () => this.closeBooth(), {
      size: 13,
      border: COLOR.line,
    });
    this.input.keyboard.on("keydown-ESC", () => this.closeBooth());

    this.body = [];
    const question = todayBoothQuestion(buildingId);
    if (hasStamp(buildingId)) {
      // 오늘 이미 받은 부스: 문제 없이 도장과 안내만
      this.showStamp(false);
      this.showMessage(t("boothAlready"), "#a9b6cf");
      return;
    }
    if (!question) {
      this.showMessage(t("boothPreparing"), "#a9b6cf", PANEL.y + 110);
      return;
    }
    this.question = question;
    const q = addLabel(this, LEFT, PANEL.y + 22, question.question[lang], {
      size: BOOTH_FONT.question,
      lineSpacing: 5,
      wordWrap: { width: WIDTH, useAdvancedWrap: true },
    });
    this.body.push(q);
    const top = Math.max(OPTION.y, q.y + q.height + 14);
    question.options.forEach((option, i) => {
      const y = top + i * (OPTION.h + OPTION.gap);
      const button = addButton(this, LEFT, y, WIDTH, OPTION.h, `${i + 1}. ${option.text[lang]}`, () => this.choose(i), { size: BOOTH_FONT.option, border: COLOR.line });
      this.body.push(button.g, button.text, button.zone);
    });
    const hintY = top + 3 * (OPTION.h + OPTION.gap) + 2;
    this.body.push(
      addLabel(this, LEFT, hintY, `※ ${t("boothHint")}`, { size: BOOTH_FONT.hint, color: "#9fd0ff", wordWrap: { width: WIDTH - CLOSE.w - 16, useAdvancedWrap: true } }),
    );
    ["ONE", "TWO", "THREE"].forEach((key, i) => this.input.keyboard.on(`keydown-${key}`, () => this.choose(i)));
  }

  showMessage(text, color, y = PANEL.y + PANEL.h - 74) {
    return addLabel(this, PANEL.x + PANEL.w / 2, y, text, { size: BOOTH_FONT.result, color, align: "center", wordWrap: { width: WIDTH, useAdvancedWrap: true } }).setOrigin(0.5, 0);
  }

  // 도장을 크게 한 번 보여 줍니다(animate면 찍히는 연출).
  showStamp(animate, onDone) {
    const x = PANEL.x + PANEL.w / 2;
    const y = PANEL.y + 96;
    addStampSlot(this, x, y, STAMP_BIG);
    addStampMark(this, x, y, STAMP_BIG, this.stop.label[getLang()], { animate, seed: this.buildingId, onDone });
  }

  async choose(index) {
    if (this.busy || !this.question || this.outcome) return;
    this.busy = true;
    const openId = this.openId;
    const result = await submitBoothAnswer(this.buildingId, index);
    if (openId !== this.openId || !this.scene.isActive()) return;
    this.busy = false;

    if (result.result === "wrong") {
      // 벌점 없이 다시 풀 수 있습니다. 보기는 그대로 두고 안내만 띄웁니다(팻말을 다시 보고 와도 됨).
      this.wrongLabel?.destroy();
      this.wrongLabel = this.showMessage(t("boothWrong"), "#ff9a9a", PANEL.y + PANEL.h - 44).setOrigin(0, 0).setX(LEFT);
      this.wrongLabel.setFontSize(BOOTH_FONT.hint + 1);
      this.cameras.main.shake(120, 0.003);
      return;
    }
    if (result.result === "error") {
      this.wrongLabel?.destroy();
      this.wrongLabel = this.showMessage(t("saveFailed"), "#ff9a9a", PANEL.y + PANEL.h - 44).setOrigin(0, 0).setX(LEFT);
      this.wrongLabel.setFontSize(BOOTH_FONT.hint + 1);
      return;
    }

    // 정답(또는 이미 받음): 문제를 지우고 도장을 크게 찍습니다.
    this.body.forEach((o) => o.destroy());
    this.wrongLabel?.destroy();
    this.outcome = { stamped: result.result === "ok", buildingId: this.buildingId, count: result.count, completedNow: result.completedNow, gained: result.gained };
    if (result.result === "already") {
      this.showStamp(false);
      this.showMessage(t("boothAlready"), "#a9b6cf");
      return;
    }
    this.showStamp(true, () => {
      if (!this.scene.isActive() || openId !== this.openId) return;
      this.showMessage(t("stampCollected", { n: result.count, total: STAMP_TOTAL }), "#9df0ae", PANEL.y + PANEL.h - 96);
      if (result.completedNow) {
        const text = isGuest() ? t("rallyCompleteGuest") : t("rallyComplete", { exp: result.gained.exp || STAMP_RALLY_REWARD.exp });
        this.showMessage(text, "#f2c94c", PANEL.y + PANEL.h - 72);
        addConfetti(this, PANEL.x + PANEL.w / 2, PANEL.y + 30, { spread: PANEL.w - 80 });
      }
    });
  }

  closeBooth() {
    const onClose = this.onClose;
    this.onClose = null;
    const outcome = this.outcome ?? { stamped: false, count: stampCount() };
    this.scene.stop();
    onClose?.(outcome);
  }
}
