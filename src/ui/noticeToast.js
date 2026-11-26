/*
 * HUD 아래 가운데에 잠깐 띄우는 작은 알림(행사 제보 보상 등).
 * 모양은 건물 소개 안내원의 "[Enter] 시설 소개" 말풍선(src/ui/guidePrompt.js)과 같습니다:
 * 어두운 남색 반투명 바탕 · 얇은 하늘색 테두리 · 살짝 둥근 모서리, 앞쪽에 크림색 키 모양 칩("+20 EXP"), 흰 글자.
 * HUD는 캠퍼스 카메라 확대(3배)를 받지 않으므로, 말풍선 크기(8px 글자)를 HUD 좌표에 맞게 키워 그립니다.
 * (x, y)는 알림 아래 가운데입니다.
 */
import { addLabel } from "./widgets.js";

const COLOR = { bubble: 0x10182a, border: 0x9fd0ff, key: 0xfff7cc, keyText: "#10182a", text: "#ffffff" };
const SIZE = 13;
const PAD = { x: 9, y: 6 };
const GAP = 8;
const RADIUS = 6;

export function addNoticeToast(scene, x, y, chipText, text) {
  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();
  const chip = addLabel(scene, 0, 0, chipText, { size: SIZE - 1, color: COLOR.keyText }).setOrigin(0, 0.5);
  const label = addLabel(scene, 0, 0, text, { size: SIZE, color: COLOR.text }).setOrigin(0, 0.5);
  const chipW = chip.width + 10;
  const chipH = chip.height + 3;
  const w = PAD.x + chipW + GAP + label.width + PAD.x;
  const h = Math.max(chipH, label.height) + PAD.y * 2;
  const left = -w / 2;
  const top = -h;
  const midY = top + h / 2;
  bg.fillStyle(COLOR.bubble, 0.88).fillRoundedRect(left, top, w, h, RADIUS);
  bg.lineStyle(1.5, COLOR.border, 0.9).strokeRoundedRect(left, top, w, h, RADIUS);
  // 키 모양 칩: 크림색 사각형 + 아래쪽 하늘색 그림자 한 줄
  const chipX = left + PAD.x;
  bg.fillStyle(COLOR.border, 0.55).fillRoundedRect(chipX, midY - chipH / 2 + 2, chipW, chipH, 3);
  bg.fillStyle(COLOR.key, 1).fillRoundedRect(chipX, midY - chipH / 2, chipW, chipH, 3);
  chip.setPosition(chipX + 5, midY);
  label.setPosition(chipX + chipW + GAP, midY);
  container.add([bg, chip, label]);
  container.setSize(w, h);
  return container;
}
