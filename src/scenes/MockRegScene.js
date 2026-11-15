import Phaser from "phaser";
import { completeQuest, getLang, grantReward, session } from "../state.js";
import { COLOR, addButton, addLabel, addShade, centerLayout, drawPanel } from "../ui/widgets.js";

const TIME_LIMIT = 30;
const COUNTDOWN_MS = 700;
const REQUEST_MS = 350;
const POINTS_PER_COURSE = 2;
const ROW = { x: 48, y: 124, w: 864, h: 54, gap: 8 };

// 모든 과목은 가상입니다.
const COURSES = [
  { ko: "가상 세계사의 이해", en: "Intro to Fictional History", credits: 3 },
  { ko: "픽셀 경제학 입문", en: "Pixel Economics 101", credits: 3 },
  { ko: "도트 그래픽 실습", en: "Pixel Art Lab", credits: 2 },
  { ko: "상상 속 국제관계", en: "Imaginary Relations", credits: 3 },
  { ko: "캠퍼스 데이터 분석", en: "Campus Data Analysis", credits: 3 },
];

const TEXT = {
  title: { ko: "모의 수강신청", en: "Mock Course Registration" },
  rules: {
    ko: "30초 안에 과목을 담으세요. 빨리 누를수록 성공 확률이 높아요. (숫자키 1~5도 가능)",
    en: "Add courses within 30 seconds. The faster you click, the better your odds. (Keys 1-5 work too)",
  },
  note: {
    ko: "모든 과목은 가상이며, 이 게임의 규칙은 실제 수강신청과 다릅니다.",
    en: "All courses are fictional, and these rules differ from real registration.",
  },
  start: { ko: "시작", en: "Start" },
  add: { ko: "담기", en: "Add" },
  requesting: { ko: "신청 중…", en: "Sending…" },
  success: { ko: "성공!", en: "Success!" },
  closed: { ko: "마감", en: "Closed" },
  time: { ko: "남은 시간", en: "Time left" },
  sec: { ko: "초", en: "s" },
  chance: { ko: "지금 성공 확률", en: "Current odds" },
  credits: { ko: "학점", en: "cr" },
  result: { ko: "수강신청 결과", en: "Registration Results" },
  courses: { ko: "성공 과목", en: "Courses" },
  score: { ko: "최종 점수", en: "Final Score" },
  exp: { ko: "획득 경험치", en: "EXP Earned" },
  points: { ko: "획득 포인트", en: "Points Earned" },
  pointUnit: { ko: "포인트", en: "pts" },
  levelUp: { ko: "레벨 업!", en: "Level Up!" },
  again: { ko: "다시 도전", en: "Try Again" },
  back: { ko: "캠퍼스로", en: "Back to Campus" },
};
const tr = (key) => TEXT[key][getLang()];

// 시작 직후 95%에서 시간이 다 되면 10%까지 일정하게 떨어집니다.
export function successChance(elapsedSeconds) {
  const progress = Phaser.Math.Clamp(elapsedSeconds / TIME_LIMIT, 0, 1);
  return 0.95 - 0.85 * progress;
}

// 성공한 과목은 기본 100점에 남은 시간 비율만큼 최대 100점을 더합니다.
export function scoreFor(elapsedSeconds) {
  return 100 + Math.round(100 * (1 - Phaser.Math.Clamp(elapsedSeconds / TIME_LIMIT, 0, 1)));
}

export class MockRegScene extends Phaser.Scene {
  constructor() {
    super("MockReg");
  }

  create() {
    this.phase = "ready";
    this.elapsed = 0;
    this.score = 0;

    centerLayout(this);
    const g = this.add.graphics();
    g.fillStyle(0x10182a, 1).fillRect(-600, -400, 2160, 1340);
    // 레트로 분위기의 줄무늬 배경입니다. 화면이 넓어져도 끝까지 이어지게 그립니다.
    g.fillStyle(0x142038, 1);
    for (let y = -400; y < 940; y += 32) g.fillRect(-600, y, 2160, 16);

    addLabel(this, ROW.x, 18, tr("title"), { size: 28, color: "#f2c94c" });
    this.timeText = addLabel(this, ROW.x + ROW.w, 24, `${tr("time")} ${TIME_LIMIT}${tr("sec")}`, { size: 20 }).setOrigin(1, 0);
    this.timeBar = this.add.graphics();
    this.drawTimeBar();
    this.chanceText = addLabel(this, ROW.x, 86, `${tr("chance")} ${Math.round(successChance(0) * 100)}%`, { size: 14, color: "#a9b6cf" });
    addLabel(this, ROW.x, 460, tr("note"), { size: 12, color: "#a9b6cf" });

    this.rows = COURSES.map((course, i) => this.createRow(course, i));

    this.startPanel = this.add.container(0, 0);
    const panel = this.add.graphics();
    drawPanel(panel, 130, 480, 700, 52);
    const rules = addLabel(this, 150, 489, tr("rules"), { size: 13, wordWrap: { width: 530, useAdvancedWrap: true } });
    const start = addButton(this, 700, 486, 116, 40, tr("start"), () => this.beginCountdown(), { size: 18, color: "#f2c94c" });
    this.startPanel.add([panel, rules, start.g, start.text, start.zone]);

    this.countText = addLabel(this, 480, 270, "", { size: 96, color: "#f2c94c" }).setOrigin(0.5).setDepth(10);

    this.input.keyboard.on("keydown", (event) => {
      const n = event.keyCode >= 97 ? event.keyCode - 96 : event.keyCode - 48;
      if (n >= 1 && n <= COURSES.length) this.tryAdd(n - 1);
      if ((event.keyCode === 32 || event.keyCode === 13) && this.phase === "ready") this.beginCountdown();
    });
  }

  createRow(course, i) {
    const y = ROW.y + i * (ROW.h + ROW.gap);
    const container = this.add.container(0, 0);
    const g = this.add.graphics();
    drawPanel(g, ROW.x, y, ROW.w, ROW.h, { border: COLOR.line });
    const label = addLabel(this, ROW.x + 18, y + 15, `${i + 1}. ${course[getLang()]}`, { size: 20 });
    const credits = addLabel(this, ROW.x + ROW.w - 210, y + 19, `${course.credits}${tr("credits")}`, { size: 14, color: "#a9b6cf" });
    const button = addButton(this, ROW.x + ROW.w - 136, y + 8, 120, 38, tr("add"), () => this.tryAdd(i), { size: 18, color: "#f2c94c" });
    // 카운트다운이 끝날 때까지는 누를 수 없는 모양으로 둡니다.
    button.setEnabled(false);
    const stamp = addLabel(this, ROW.x + ROW.w - 76, y + 27, "", { size: 22 }).setOrigin(0.5).setVisible(false);
    container.add([g, label, credits, button.g, button.text, button.zone, stamp]);
    return { i, y, container, g, button, stamp, state: "idle" };
  }

  drawTimeBar() {
    const left = Math.max(0, 1 - this.elapsed / TIME_LIMIT);
    const bar = { x: ROW.x, y: 60, w: ROW.w, h: 16 };
    this.timeBar.clear();
    this.timeBar.fillStyle(COLOR.shadow, 1).fillRect(bar.x, bar.y, bar.w, bar.h);
    this.timeBar.fillStyle(left > 1 / 3 ? COLOR.gold : 0xd93f3f, 1).fillRect(bar.x + 2, bar.y + 2, Math.round((bar.w - 4) * left), bar.h - 4);
  }

  beginCountdown() {
    if (this.phase !== "ready") return;
    this.phase = "count";
    this.startPanel.setVisible(false);
    this.startPanel.destroy();
    let count = 3;
    this.countText.setText(String(count));
    this.time.addEvent({
      delay: COUNTDOWN_MS,
      repeat: 2,
      callback: () => {
        count--;
        if (count > 0) {
          this.countText.setText(String(count));
        } else {
          this.countText.setVisible(false);
          this.phase = "run";
          this.rows.forEach((row) => row.button.setEnabled(true));
        }
      },
    });
  }

  update(_time, delta) {
    if (this.phase !== "run") return;
    this.elapsed += delta / 1000;
    this.timeText.setText(`${tr("time")} ${Math.max(0, Math.ceil(TIME_LIMIT - this.elapsed))}${tr("sec")}`);
    this.chanceText.setText(`${tr("chance")} ${Math.round(successChance(this.elapsed) * 100)}%`);
    this.drawTimeBar();
    if (this.elapsed >= TIME_LIMIT) {
      this.rows.filter((r) => r.state === "idle").forEach((r) => this.settleRow(r, false, 0));
      this.phase = "ending";
      this.checkFinished();
    }
  }

  tryAdd(index) {
    const row = this.rows[index];
    if (this.phase !== "run" || row.state !== "idle") return;
    row.state = "pending";
    const clickedAt = this.elapsed;
    row.button.zone.disableInteractive();
    row.button.text.setText(tr("requesting")).setFontSize(14);
    this.time.delayedCall(REQUEST_MS, () => {
      const success = this.rollSuccess(clickedAt);
      this.settleRow(row, success, success ? scoreFor(clickedAt) : 0);
      this.checkFinished();
    });
  }

  rollSuccess(clickedAt) {
    return Math.random() < successChance(clickedAt);
  }

  settleRow(row, success, points) {
    row.state = success ? "success" : "closed";
    this.score += points;
    [row.button.g, row.button.text, row.button.zone].forEach((o) => o.destroy());
    row.g.clear();
    drawPanel(row.g, ROW.x, row.y, ROW.w, ROW.h, success ? { fill: 0x1f4a33, border: 0x58ad66 } : { fill: 0x3f2230, border: 0xd93f3f });
    row.stamp.setVisible(true).setText(tr(success ? "success" : "closed")).setColor(success ? "#9df0ae" : "#ff9a9a");
    if (success) {
      row.stamp.setScale(1.8);
      this.tweens.add({ targets: row.stamp, scale: 1, duration: 220, ease: "Back.easeOut" });
    } else {
      this.tweens.add({ targets: row.container, x: 6, duration: 50, yoyo: true, repeat: 3 });
    }
  }

  checkFinished() {
    if (this.phase === "result" || this.rows.some((r) => r.state === "idle" || r.state === "pending")) return;
    this.phase = "result";
    this.time.delayedCall(600, () => this.showResult());
  }

  showResult() {
    const successes = this.rows.filter((r) => r.state === "success").length;
    // 성공 과목마다 5, 점수 50점마다 1의 경험치를 줍니다.
    const earned = successes * 5 + Math.floor(this.score / 50);
    const points = successes * POINTS_PER_COURSE;
    const leveledUp = grantReward(earned, points);
    completeQuest("mockReg");
    this.result = { successes, score: this.score, earned, points, leveledUp };

    addShade(this, 0.6); // 결과 창 뒤의 버튼이 눌리지 않게 막습니다.
    const g = this.add.graphics();
    drawPanel(g, 230, 110, 500, 320);
    addLabel(this, 480, 142, tr("result"), { size: 26, color: "#f2c94c" }).setOrigin(0.5);

    const line = (y, name, value, color = "#ffffff") => {
      addLabel(this, 280, y, name, { size: 20, color: "#a9b6cf" });
      addLabel(this, 680, y, value, { size: 24, color }).setOrigin(1, 0);
    };
    line(176, tr("courses"), `${successes} / ${COURSES.length}`);
    line(212, tr("score"), `${this.score}`, "#f2c94c");
    line(248, tr("exp"), `+${earned} EXP`, "#9df0ae");
    line(284, tr("points"), `+${points} ${tr("pointUnit")}`, "#9df0ae");
    if (leveledUp) {
      const up = addLabel(this, 480, 336, `${tr("levelUp")} Lv.${session.level}`, { size: 20, color: "#f2c94c" }).setOrigin(0.5);
      this.tweens.add({ targets: up, alpha: 0.3, duration: 350, yoyo: true, repeat: -1 });
    }
    addButton(this, 262, 362, 210, 48, tr("again"), () => this.scene.restart(), { size: 18, border: COLOR.line });
    addButton(this, 488, 362, 210, 48, tr("back"), () => this.exit(), { size: 18, color: "#f2c94c" });
  }

  exit() {
    this.scene.wake("Campus");
    this.scene.wake("Hud");
    this.scene.wake("Dialog");
    this.scene.stop();
  }
}
