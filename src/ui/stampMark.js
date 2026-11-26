/*
 * 스탬프 랠리 도장 그림(Phaser). 일일 퀘스트 창의 도장 칸(작게)과 부스 문제 창(크게)이 같이 씁니다.
 * - 빈 도장: 옅은 회색 점선 원(테두리만)
 * - 찍힌 도장: 빨간 인주 원 + 안쪽 건물 약칭, 약간 기울어진 각도, 가장자리에 인주가 번진 작은 점 몇 개
 * - 찍힐 때(animate): 위에서 살짝 크게(1.3배) 내려와 꾹 눌리고(0.25초) 아주 짧게 흔들립니다.
 */
import { FONT } from "./widgets.js";

const INK = 0xd93f3f;
const INK_TEXT = "#d93f3f";
const EMPTY = 0x8793a8;
export const STAMP_PRESS_MS = 250;

// 빈 도장 칸: 점선 원
export function addStampSlot(scene, x, y, radius) {
  const g = scene.add.graphics();
  const dashes = Math.max(10, Math.round(radius * 1.1));
  g.lineStyle(Math.max(1, radius / 9), EMPTY, 0.75);
  for (let i = 0; i < dashes; i++) {
    const a0 = (i / dashes) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / dashes / 2;
    g.beginPath();
    g.arc(x, y, radius, a0, a1);
    g.strokePath();
  }
  return g;
}

// 도장 안 글자. 작은 도장(반지름 15 미만, 휴대폰 일일 퀘스트 창)은 약칭이 읽히지 않아 첫 글자만 크게,
// 그 밖에는 약칭 전체(한글 4자 이상은 두 줄: "학생\n회관"). 반환: { text, size }
export function stampText(label, radius) {
  if (radius < 15) return { text: [...label][0], size: Math.round(radius * 1.05) };
  const chars = [...label];
  const hangul = chars.every((ch) => /[가-힣]/.test(ch));
  const lines = hangul && chars.length >= 4 ? [chars.slice(0, Math.ceil(chars.length / 2)).join(""), chars.slice(Math.ceil(chars.length / 2)).join("")] : [label];
  const widest = Math.max(...lines.map((line) => [...line].reduce((n, ch) => n + (/[가-힣]/.test(ch) ? 1 : 0.58), 0)));
  const byWidth = (radius * 1.62) / Math.max(2, widest);
  const byHeight = (radius * (lines.length > 1 ? 1.2 : 1.5)) / lines.length;
  return { text: lines.join("\n"), size: Math.max(8, Math.floor(Math.min(byWidth, byHeight))) };
}

// 건물마다 늘 같은 기울기(-8°~8°)와 번진 점 자리가 나오게 하는 작은 난수
function seeded(seed) {
  let s = [...String(seed)].reduce((n, ch) => (n * 31 + ch.codePointAt(0)) % 2147483647, 7) || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// 찍힌 도장. angle을 주지 않으면 건물 id(seed)로 정한 고정 각도, animate면 새로 찍히는 연출(각도는 -8°~8° 무작위).
export function addStampMark(scene, x, y, radius, label, { animate = false, seed = label, onDone = null } = {}) {
  const random = seeded(seed);
  const angle = (animate ? Math.random() : random()) * 16 - 8;
  const container = scene.add.container(x, y);
  const g = scene.add.graphics();
  const thick = Math.max(1.5, radius / 6);
  g.lineStyle(thick, INK, 0.95).strokeCircle(0, 0, radius);
  // 큰 도장만 안쪽에 얇은 원을 하나 더(작은 도장은 글자 자리가 모자라 한 줄만)
  if (radius >= 30) g.lineStyle(Math.max(1, thick / 2.5), INK, 0.8).strokeCircle(0, 0, radius - thick * 1.4);
  // 가장자리에 인주가 번진 작은 점
  g.fillStyle(INK, 0.85);
  for (let i = 0; i < 5; i++) {
    const a = random() * Math.PI * 2;
    const d = radius + thick * (0.6 + random() * 1.2);
    const dot = Math.max(1, radius / 10) * (0.7 + random() * 0.8);
    g.fillRect(Math.cos(a) * d - dot / 2, Math.sin(a) * d - dot / 2, dot, dot);
  }
  const mark = stampText(label, radius);
  const text = scene.add
    .text(0, 0, mark.text, { fontFamily: FONT, fontSize: `${mark.size}px`, color: INK_TEXT, align: "center", lineSpacing: -1 })
    .setOrigin(0.5);
  container.add([g, text]);
  container.setAngle(angle);
  if (animate) {
    container.setScale(1.3).setAlpha(0.2).setY(y - radius * 0.5);
    scene.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      y,
      duration: STAMP_PRESS_MS,
      ease: "Quad.easeIn",
      onComplete: () => {
        // 꾹 눌린 뒤 아주 짧은 흔들림
        scene.tweens.add({ targets: container, x: x + Math.max(1, radius / 12), duration: 35, yoyo: true, repeat: 2, onComplete: () => onDone?.() });
      },
    });
  }
  return container;
}

// 작은 색종이(완주 축하). (x, y) 둘레에서 흩날리다 사라집니다.
export function addConfetti(scene, x, y, { count = 26, spread = 150, depth = 60 } = {}) {
  const colors = [0xf2c94c, 0x2f6fd0, 0xd93f3f, 0x58ad66, 0xffffff, 0xff9f1c];
  for (let i = 0; i < count; i++) {
    const piece = scene.add.rectangle(x + (Math.random() - 0.5) * spread, y - Math.random() * 30, 5, 5, colors[i % colors.length]).setDepth(depth);
    piece.setAngle(Math.random() * 90);
    scene.tweens.add({
      targets: piece,
      x: piece.x + (Math.random() - 0.5) * 80,
      y: piece.y + 90 + Math.random() * 90,
      angle: piece.angle + 180 + Math.random() * 180,
      alpha: 0,
      delay: Math.random() * 250,
      duration: 1100 + Math.random() * 500,
      ease: "Quad.easeIn",
      onComplete: () => piece.destroy(),
    });
  }
}
