import { getLang, setLang } from "../state.js";

export const COLOR = { fill: 0x18233a, hover: 0x2d3f63, border: 0xf2c94c, line: 0x4a5f88, shadow: 0x0a1020, gold: 0xf2c94c, disabled: 0x232a3a, disabledLine: 0x3d4557 };
export const FONT = "Galmuri11, sans-serif";

// 모서리를 계단처럼 깎은 도트풍 패널입니다.
export function drawPanel(g, x, y, w, h, { fill = COLOR.fill, border = COLOR.border, alpha = 1 } = {}) {
  g.fillStyle(COLOR.shadow, alpha).fillRect(x + 4, y + 4, w, h);
  g.fillStyle(border, 1).fillRect(x + 4, y, w - 8, h).fillRect(x, y + 4, w, h - 8);
  g.fillStyle(fill, alpha).fillRect(x + 8, y + 4, w - 16, h - 8).fillRect(x + 4, y + 8, w - 8, h - 16);
}

export function addLabel(scene, x, y, text, { size = 16, color = "#ffffff", ...rest } = {}) {
  return scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, ...rest });
}

export function addButton(scene, x, y, w, h, label, onClick, { size = 16, border = COLOR.border, color = "#ffffff" } = {}) {
  const g = scene.add.graphics();
  const draw = (fill, lineColor = border) => {
    g.clear();
    drawPanel(g, x, y, w, h, { fill, border: lineColor });
  };
  draw(COLOR.fill);
  const text = addLabel(scene, x + w / 2, y + h / 2, label, { size, color }).setOrigin(0.5);
  const zone = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  let enabled = true;
  zone.on("pointerover", () => enabled && draw(COLOR.hover));
  zone.on("pointerout", () => enabled && draw(COLOR.fill));
  zone.on("pointerdown", () => enabled && onClick());
  // 눌러도 반응하지 않는 회색 모양으로 바꾸거나 되돌립니다.
  const setEnabled = (next) => {
    enabled = next;
    draw(next ? COLOR.fill : COLOR.disabled, next ? border : COLOR.disabledLine);
    text.setColor(next ? color : "#6b7690");
    if (next) zone.setInteractive({ useHandCursor: true });
    else zone.disableInteractive();
  };
  return { g, text, zone, setEnabled };
}

// 960x540 기준으로 그린 화면을 게임 크기가 달라져도 가운데에 오게 합니다.
export function centerLayout(scene) {
  const apply = () => {
    scene.cameras.main.setScroll(-(scene.scale.width - 960) / 2, -(scene.scale.height - 540) / 2);
  };
  apply();
  scene.scale.on("resize", apply);
  scene.events.once("shutdown", () => scene.scale.off("resize", apply));
}

// 게임 크기가 달라져도 화면 전체를 덮는 어두운 막입니다.
export function addShade(scene, alpha) {
  return scene.add.rectangle(-600, -400, 2160, 1340, 0x060a14, alpha).setOrigin(0).setInteractive();
}

// KO/EN 전환 버튼 한 쌍입니다. 지금 쓰는 언어를 금색으로 표시합니다.
export function addLangButtons(scene, rightX, y) {
  const w = 44;
  const h = 32;
  [["ko", "KO"], ["en", "EN"]].forEach(([code, label], i) => {
    const active = getLang() === code;
    addButton(scene, rightX - (2 - i) * (w + 4) + 4, y, w, h, label, () => setLang(code), {
      size: 14,
      border: active ? COLOR.border : COLOR.line,
      color: active ? "#f2c94c" : "#a9b6cf",
    });
  });
}
