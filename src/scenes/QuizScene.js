import Phaser from "phaser";
import { QUIZ_CATEGORIES } from "../data/quiz.js";
import { QUIZ_REWARD, recordAnswer } from "../quizProgress.js";
import { getLang, t } from "../state.js";
import { COLOR, FONT, addButton, addLabel, addShade, centerLayout, drawPanel } from "../ui/widgets.js";

// 960x540 기준 배치입니다. AI 답변 패널과 같은 이름표+패널 모양을 씁니다.
const PANEL = { x: 150, y: 92, w: 660, h: 404 };
const TAB = { x: 174, y: 48, h: 40 };
const LEFT = PANEL.x + 28;
const WIDTH = PANEL.w - 56;
const CHOICE = { w: 132, h: 96, gap: 32, y: PANEL.y + 178 };
const CLOSE = { w: 130, h: 40 };

// 퀴즈 상자를 열면 뜨는 O/X 문제 창입니다.
export class QuizScene extends Phaser.Scene {
  constructor() {
    super("Quiz");
  }

  create({ question, onClose }) {
    this.question = question;
    this.onClose = onClose;
    this.answered = false;
    const lang = getLang();
    centerLayout(this);
    addShade(this, 0.6);

    const panel = this.add.graphics();
    drawPanel(panel, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    const tabText = addLabel(this, TAB.x + 16, TAB.y + 8, t("quizTitle"), { size: 20, color: "#f2c94c" });
    const tab = this.add.graphics();
    drawPanel(tab, TAB.x, TAB.y, tabText.width + 32, TAB.h);
    this.children.bringToTop(tabText);

    const category = QUIZ_CATEGORIES[question.category]?.[lang] ?? question.category;
    addLabel(this, LEFT, PANEL.y + 22, `#${category}`, {
      size: 13,
      color: "#231a00",
      backgroundColor: "#f2c94c",
      padding: { x: 6, y: 3 },
    });
    addLabel(this, LEFT, PANEL.y + 58, question.question[lang], {
      size: 19,
      lineSpacing: 7,
      wordWrap: { width: WIDTH, useAdvancedWrap: true },
    });

    const center = PANEL.x + PANEL.w / 2;
    this.choiceObjects = [];
    [
      ["O", true, center - CHOICE.w - CHOICE.gap / 2],
      ["X", false, center + CHOICE.gap / 2],
    ].forEach(([label, value, x]) => {
      const button = addButton(this, x, CHOICE.y, CHOICE.w, CHOICE.h, label, () => this.choose(value), { size: 44, color: "#f2c94c" });
      this.choiceObjects.push(button.g, button.text, button.zone);
    });
    this.choiceObjects.push(
      addLabel(this, center, CHOICE.y + CHOICE.h + 18, t("quizKeys"), { size: 12, color: "#a9b6cf" }).setOrigin(0.5, 0),
    );

    addButton(this, PANEL.x + PANEL.w - 28 - CLOSE.w, PANEL.y + PANEL.h - 22 - CLOSE.h, CLOSE.w, CLOSE.h, t("quizClose"), () => this.closeQuiz(), {
      size: 16,
      border: COLOR.line,
    });

    this.input.keyboard.on("keydown-O", () => this.choose(true));
    this.input.keyboard.on("keydown-X", () => this.choose(false));
    this.input.keyboard.on("keydown-ESC", () => this.closeQuiz());
  }

  choose(value) {
    if (this.answered) return;
    this.answered = true;
    const lang = getLang();
    const question = this.question;
    const correct = value === question.answer;
    const result = recordAnswer(question, correct);
    this.choiceObjects.forEach((o) => o.destroy());

    let y = CHOICE.y - 4;
    const verdict = correct ? t("quizCorrect") : `${t("quizWrong")} ${t("quizAnswerIs")}${question.answer ? "O" : "X"}`;
    addLabel(this, LEFT, y, verdict, { size: 20, color: correct ? "#9df0ae" : "#ff9a9a" });
    y += 34;
    const explain = addLabel(this, LEFT, y, question.explain[lang], {
      size: 15,
      lineSpacing: 6,
      wordWrap: { width: WIDTH, useAdvancedWrap: true },
    });
    y += explain.height + 12;

    // 출처를 누르면 원문을 새 탭으로 엽니다.
    const link = addLabel(this, LEFT, y, `${t("quizSource")}: ${question.source.name[lang]} ↗`, {
      size: 14,
      color: "#9fd0ff",
      wordWrap: { width: WIDTH - CLOSE.w - 12, useAdvancedWrap: true },
    }).setInteractive({ useHandCursor: true });
    link.on("pointerover", () => link.setColor("#ffffff"));
    link.on("pointerout", () => link.setColor("#9fd0ff"));
    link.on("pointerup", () => window.open(question.source.url, "_blank", "noopener,noreferrer"));
    y += link.height + 12;

    const rewardText = {
      ok: { text: `+${QUIZ_REWARD} EXP`, color: "#f2c94c" },
      guest: { text: t("quizGuest"), color: "#a9b6cf" },
      already: { text: t("quizAlready"), color: "#a9b6cf" },
      cap: { text: t("quizCap"), color: "#a9b6cf" },
    }[result];
    if (rewardText) addLabel(this, LEFT, y, rewardText.text, { size: 14, color: rewardText.color });
  }

  closeQuiz() {
    const onClose = this.onClose;
    this.onClose = null;
    const answered = this.answered;
    this.scene.stop();
    onClose?.(answered);
  }
}
