import Phaser from "phaser";
import { askQuestion } from "../data/askApi.js";
import { completeQuest, getLang, isGuest, onLangChange, t } from "../state.js";
import { COLOR, FONT, addButton, centerLayout, drawPanel } from "../ui/widgets.js";

const BOX = { x: 24, y: 392, w: 912, h: 124 };
const NAME_TAB = { x: 48, y: 348, h: 40 };
const TYPE_DELAY_MS = 28;

// 상단 검색창 답변 패널의 배치입니다(960x540 기준).
const ANSWER_BOX = { x: 24, y: 168, w: 912, h: 348 };
const ANSWER_TAB = { x: 48, y: 124, h: 40 };
const PORTRAIT = { x: 72, y: 236, scale: 4 };
const TEXT_LEFT = 120;
const TEXT_WIDTH = ANSWER_BOX.x + ANSWER_BOX.w - 28 - TEXT_LEFT;
const NOTICE_Y = ANSWER_BOX.y + ANSWER_BOX.h - 34;
const CLOSE_BUTTON = { w: 110, h: 40 };
const MAX_SOURCES = 3;
const MAX_TITLE = 38;
const AI_LOOK = "npc-4";

// 게임 화면과 따로 그려서 카메라 확대의 영향을 받지 않는 대화창과 AI 답변 패널입니다.
export class DialogScene extends Phaser.Scene {
  constructor() {
    super("Dialog");
  }

  create() {
    centerLayout(this);
    this.isOpen = false;
    this.requestId = 0;

    // 일반 대화창(대사를 한 줄씩 넘기는 창)입니다. 지금은 건물 NPC를 없애 쓰지 않지만, 이후 이벤트 대사용으로 남겨 둡니다.
    this.nameTabGraphics = this.add.graphics();
    this.boxGraphics = this.add.graphics();
    drawPanel(this.boxGraphics, BOX.x, BOX.y, BOX.w, BOX.h);
    this.nameText = this.add.text(NAME_TAB.x + 16, NAME_TAB.y + 8, "", { fontFamily: FONT, fontSize: "20px", color: "#f2c94c" });
    this.bodyText = this.add.text(BOX.x + 28, BOX.y + 22, "", { fontFamily: FONT, fontSize: "24px", color: "#ffffff", lineSpacing: 10 });
    this.nextMark = this.add
      .triangle(BOX.x + BOX.w - 32, BOX.y + BOX.h - 24, 0, 0, 16, 0, 8, 10, COLOR.border)
      .setOrigin(0.5);
    this.tweens.add({ targets: this.nextMark, alpha: 0, duration: 350, yoyo: true, repeat: -1 });
    this.dialogObjects = [this.nameTabGraphics, this.boxGraphics, this.nameText, this.bodyText, this.nextMark];

    this.answerObjects = [];
    this.setDialogVisible(false);

    this.input.on("pointerdown", () => {
      if (this.isOpen && this.mode === "dialog") this.advance();
    });
    this.input.keyboard.on("keydown-SPACE", () => {
      if (this.isOpen && this.mode === "dialog") this.advance();
    });
    this.input.keyboard.on("keydown-ESC", () => {
      if (this.isOpen) this.close();
    });

    // 언어를 바꾸면 열린 창을 닫습니다. 다시 물어보면 새 언어로 답합니다.
    onLangChange(() => {
      if (this.isOpen) this.close();
    });
  }

  setDialogVisible(visible) {
    this.dialogObjects.forEach((o) => o.setVisible(visible));
    this.nextMark.setVisible(false);
  }

  // ───────────── 일반 대화창 ─────────────

  open(name, lines, onClose) {
    this.clearAnswer();
    this.mode = "dialog";
    this.lines = lines;
    this.lineIndex = 0;
    this.onClose = onClose;
    this.isOpen = true;
    this.setDialogVisible(true);
    this.nameText.setText(name).setY(NAME_TAB.y + 8);
    this.nameTabGraphics.clear();
    drawPanel(this.nameTabGraphics, NAME_TAB.x, NAME_TAB.y, this.nameText.width + 32, NAME_TAB.h);
    this.startLine();
  }

  startLine() {
    this.fullText = this.lines[this.lineIndex];
    this.shownChars = 0;
    this.bodyText.setText("");
    this.nextMark.setVisible(false);
    this.typing = this.time.addEvent({
      delay: TYPE_DELAY_MS,
      loop: true,
      callback: () => {
        this.shownChars++;
        this.bodyText.setText(this.fullText.slice(0, this.shownChars));
        if (this.shownChars >= this.fullText.length) this.finishLine();
      },
    });
  }

  finishLine() {
    if (this.typing) {
      this.typing.remove();
      this.typing = null;
    }
    this.bodyText.setText(this.fullText);
    this.nextMark.setVisible(true);
  }

  advance() {
    if (this.mode !== "dialog") return;
    if (this.typing) {
      this.finishLine();
    } else if (this.lineIndex + 1 < this.lines.length) {
      this.lineIndex++;
      this.startLine();
    } else {
      this.close();
    }
  }

  // ───────────── 상단 검색창 → AI 학사 안내원 답변 패널 ─────────────

  // 검색창에서 질문하면 부릅니다. 답을 기다리는 동안 다른 질문이 오면 마지막 질문의 답만 보여 줍니다.
  async openAnswer(question, onClose) {
    if (this.isOpen && this.mode === "dialog") this.close();
    this.mode = "answer";
    this.onClose = onClose;
    this.isOpen = true;
    const lang = getLang();
    const id = ++this.requestId;

    this.drawAnswerPanel(question);
    this.showLoading(lang);
    const result = await askQuestion(question, lang);
    if (id !== this.requestId || !this.isOpen || this.mode !== "answer") return;
    this.showResult(question, result, lang);
  }

  drawAnswerPanel(question) {
    this.clearAnswer();
    const add = (o) => {
      this.answerObjects.push(o);
      return o;
    };
    const panel = add(this.add.graphics());
    drawPanel(panel, ANSWER_BOX.x, ANSWER_BOX.y, ANSWER_BOX.w, ANSWER_BOX.h);
    const tabText = add(this.add.text(ANSWER_TAB.x + 16, ANSWER_TAB.y + 8, t("aiName"), { fontFamily: FONT, fontSize: "20px", color: "#f2c94c" }));
    const tab = add(this.add.graphics());
    drawPanel(tab, ANSWER_TAB.x, ANSWER_TAB.y, tabText.width + 32, ANSWER_TAB.h);
    this.children.bringToTop(tabText);

    add(this.add.image(PORTRAIT.x, PORTRAIT.y, AI_LOOK, 0).setScale(PORTRAIT.scale));
    this.portraitBubble = add(this.add.image(PORTRAIT.x + 22, PORTRAIT.y - 34, "bubble").setScale(2));
    this.tweens.add({ targets: this.portraitBubble, y: PORTRAIT.y - 38, duration: 450, yoyo: true, repeat: -1 });

    add(this.add.text(TEXT_LEFT, ANSWER_BOX.y + 22, `Q. ${question}`, {
      fontFamily: FONT, fontSize: "15px", color: "#f2c94c", wordWrap: { width: TEXT_WIDTH, useAdvancedWrap: true }, maxLines: 2,
    }));
    this.answerText = add(this.add.text(TEXT_LEFT, ANSWER_BOX.y + 70, "", {
      fontFamily: FONT, fontSize: "16px", color: "#ffffff", lineSpacing: 6, wordWrap: { width: TEXT_WIDTH, useAdvancedWrap: true }, maxLines: 7,
    }));
    add(this.add.text(TEXT_LEFT, NOTICE_Y, t("aiNotice"), { fontFamily: FONT, fontSize: "12px", color: "#a9b6cf" }));
    const closeX = ANSWER_BOX.x + ANSWER_BOX.w - 28 - CLOSE_BUTTON.w;
    const closeY = ANSWER_BOX.y + ANSWER_BOX.h - 22 - CLOSE_BUTTON.h;
    const button = addButton(this, closeX, closeY, CLOSE_BUTTON.w, CLOSE_BUTTON.h, t("aiClose"), () => this.close(), { size: 16, border: COLOR.line });
    [button.g, button.text, button.zone].forEach(add);
  }

  showLoading(lang) {
    let dots = 0;
    this.answerText.setText(t("aiThinking"));
    this.loading = this.time.addEvent({
      delay: 350,
      loop: true,
      callback: () => {
        dots = (dots + 1) % 4;
        this.answerText.setText(t("aiThinking") + ".".repeat(dots));
      },
    });
  }

  stopLoading() {
    if (this.loading) {
      this.loading.remove();
      this.loading = null;
    }
  }

  showResult(question, result, lang) {
    this.stopLoading();
    const messages = {
      none: t("aiNotFound"),
      busy: t("aiBusy"),
    };
    let text = messages[result.mode] || result.answer || t("aiNotFound");
    if (result.mode === "evidence" || result.mode === "local") text = `${t("aiEvidenceOnly")}\n${text}`;
    this.answerText.setText(text);

    const sources = dedupe(result.sources || []).slice(0, MAX_SOURCES);
    if (sources.length) {
      let y = this.answerText.y + this.answerText.height + 14;
      y = Math.min(y, NOTICE_Y - 22 - sources.length * 22);
      this.answerObjects.push(this.add.text(TEXT_LEFT, y, t("aiSources"), { fontFamily: FONT, fontSize: "13px", color: "#a9b6cf" }));
      sources.forEach((source, i) => this.addSourceLink(source, i, y + 20 + i * 22));
    }

    // 이중전공 질문에 답을 받으면 이중전공 퀘스트를 완료합니다(재학생만).
    const answered = result.mode === "ai" || result.mode === "evidence" || result.mode === "local";
    if (answered && !isGuest() && /이중전공|double\s*major/i.test(question)) completeQuest("doubleMajor");
  }

  // 출처를 누르면 학교 홈페이지 원문을 새 탭으로 엽니다.
  addSourceLink(source, index, y) {
    const title = source.title.length > MAX_TITLE ? `${source.title.slice(0, MAX_TITLE)}…` : source.title;
    const link = this.add
      .text(TEXT_LEFT, y, `↗ ${(source.refs || [index + 1]).map((n) => `[${n}]`).join("")} ${title}`, { fontFamily: FONT, fontSize: "14px", color: "#9fd0ff" })
      .setInteractive({ useHandCursor: true });
    link.on("pointerover", () => link.setColor("#ffffff"));
    link.on("pointerout", () => link.setColor("#9fd0ff"));
    link.on("pointerup", () => window.open(source.url, "_blank", "noopener,noreferrer"));
    this.answerObjects.push(link);
  }

  clearAnswer() {
    this.stopLoading();
    this.answerObjects.forEach((o) => o.destroy());
    this.answerObjects = [];
  }

  close() {
    if (this.typing) {
      this.typing.remove();
      this.typing = null;
    }
    this.requestId++;
    this.clearAnswer();
    this.setDialogVisible(false);
    this.isOpen = false;
    this.mode = null;
    const onClose = this.onClose;
    this.onClose = null;
    if (onClose) onClose();
  }
}

function dedupe(sources) {
  const seen = new Set();
  return sources.filter((s) => s && s.url && !seen.has(s.url) && seen.add(s.url));
}
