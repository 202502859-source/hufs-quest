import Phaser from "phaser";

/*
 * 건물 소개 안내원 머리 위 "[Enter] 시설 소개" 말풍선(11/26 #75 검토).
 * - 어두운 남색 반투명 작은 말풍선(모서리 살짝 둥글게, 얇은 밝은 테두리, 아래로 짧은 꼬리) + 흰 글자
 * - "Enter"(터치 화면은 "터치" · "Tap")는 밝은 바탕의 짧은 키 모양으로 따로
 * - 글꼴은 게임 글자와 같은 Galmuri9, 색은 HUD 색(남색 #10182a · 하늘색 #9fd0ff · 크림 #fff7cc)
 * 위치 (x, y)는 말풍선 꼬리 끝(아래 가운데)입니다. 말풍선을 누르면(터치 포함) "tap" 이벤트를 보냅니다.
 */
const COLOR = { bubble: 0x10182a, border: 0x9fd0ff, key: 0xfff7cc, keyText: "#10182a", text: "#ffffff" };
const FONT_PX = 8; // 예전 문구(10px)의 80%
const PAD = { x: 3, y: 2 };
const GAP = 3; // 키 모양과 글자 사이
const TAIL = 3; // 아래 꼬리 높이

export class GuidePrompt extends Phaser.GameObjects.Container {
  constructor(scene, resolution) {
    super(scene, 0, 0);
    const style = (color) => ({ fontFamily: "Galmuri9, sans-serif", fontSize: `${FONT_PX}px`, color, resolution });
    this.bg = scene.add.graphics();
    this.keyText = scene.add.text(0, 0, "", style(COLOR.keyText)).setOrigin(0, 0.5);
    this.label = scene.add.text(0, 0, "", style(COLOR.text)).setOrigin(0, 0.5);
    // 누르는 영역(말풍선 전체). 컨테이너 자식 Zone이라 카메라 확대와 상관없이 맞게 눌립니다.
    this.hit = scene.add.zone(0, 0, 1, 1).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });
    this.hit.on("pointerdown", () => this.emit("tap"));
    this.add([this.bg, this.keyText, this.label, this.hit]);
    scene.add.existing(this);
  }

  // hint: 키 이름("Enter" · "터치" · "Tap"), text: "시설 소개" · "Facility guide"
  setContent(hint, text) {
    if (this.hint === hint && this.text === text) return this;
    this.hint = hint;
    this.text = text;
    this.keyText.setText(hint);
    this.label.setText(text);
    const keyW = this.keyText.width + 4;
    const keyH = this.keyText.height + 1;
    const w = PAD.x + keyW + GAP + this.label.width + PAD.x;
    const h = Math.max(keyH, this.label.height) + PAD.y * 2;
    const top = -TAIL - h;
    const left = -w / 2;
    const midY = top + h / 2;
    const g = this.bg.clear();
    g.fillStyle(COLOR.bubble, 0.88);
    g.fillRoundedRect(left, top, w, h, 2.5);
    g.fillTriangle(-2.5, -TAIL - 0.5, 2.5, -TAIL - 0.5, 0, 0);
    g.lineStyle(0.6, COLOR.border, 0.9);
    g.strokeRoundedRect(left, top, w, h, 2.5);
    // 키 모양: 크림색 짧은 사각형 + 아래쪽 그림자 한 줄
    const keyX = left + PAD.x;
    g.fillStyle(COLOR.border, 0.55);
    g.fillRoundedRect(keyX, midY - keyH / 2 + 0.7, keyW, keyH, 1.2);
    g.fillStyle(COLOR.key, 1);
    g.fillRoundedRect(keyX, midY - keyH / 2, keyW, keyH, 1.2);
    this.keyText.setPosition(keyX + 2, midY);
    this.label.setPosition(keyX + keyW + GAP, midY);
    this.hit.setSize(w, h + TAIL).setPosition(0, 0);
    if (this.hit.input) this.hit.input.hitArea.setSize(w, h + TAIL);
    return this;
  }
}
