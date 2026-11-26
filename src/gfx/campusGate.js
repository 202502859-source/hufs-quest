import { GATE, GATE_ART } from "../data/campusV2.js";
import { PALETTE } from "./campusV2Paint.js";

/*
 * 정문 기둥 한 쌍 · 현수막(맵 v2 전용). 맵 텍스처에 칠하지 않고 따로 세우는 그림이라
 * 캐릭터가 지나가면 깊이(GATE.depth, 받침 바닥 기준)로 앞뒤가 정해집니다.
 * 픽셀은 코드로 직접 찍습니다(참고 사진은 보고 따라 그리기만, 학교 로고 · 엠블럼 · 실제 현수막 문구 없음).
 * 빛: 기존 맵 그림(가로수 밝은 면 = 왼쪽 위, 그림자 = 아래 2px)과 같게 — 윗면 · 왼쪽 면이 밝고 오른쪽 면이 어둡고 바닥 그림자는 아래로 2px.
 * 브라우저 API 없이 RGBA 배열만 만들어 테스트(node)에서도 확인합니다.
 */
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const STONE = {
  light: hex(PALETTE.roof.white), // 밝은 면(윗면 · 왼쪽 1px)
  mid: hex(PALETTE.roof.gray), // 기본 면
  dark: hex(PALETTE.roofRim.gray), // 어두운 면(오른쪽 1px) · 받침 줄무늬
  groove: hex(PALETTE.eave), // 판 아래 · 받침 오른쪽 그늘
  outline: hex(PALETTE.outline),
};
// 바닥 그림자: 윤곽색을 반투명으로 겹침(바닥 색이 비침)
export const GATE_SHADOW = { color: PALETTE.outline, alpha: 0.35 };
const SHADOW = [...hex(PALETTE.outline).slice(0, 3), Math.round(255 * GATE_SHADOW.alpha)];
const BANNER = {
  blue: hex(PALETTE.bannerBlue),
  edge: hex(PALETTE.bannerEdge),
  yellow: hex(PALETTE.bannerYellow),
  yellowEdge: hex(PALETTE.bannerYellowEdge),
  text: hex(PALETTE.line), // 흰 선 #f2f0e6
};

// 기둥 세로 석재 판 5장: [폭, 높이(바닥부터 px)] — 가운데가 가장 높음
export const SLABS = [[3, 38], [3, 46], [4, 54], [3, 46], [3, 38]];
export const BASE_H = 10; // 경사 받침 높이

function canvasData(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    data.set(c, (y * w + x) * 4);
  };
  return { data, put };
}

// 기둥 한 개: 폭 16 × (높이 54 + 그림자 2)
export function paintPillar() {
  const { pillarW: W, pillarH: H, shadow } = GATE_ART;
  const { data, put } = canvasData(W, H + shadow);
  // 실루엣: 판 5장 + 받침(아래 10줄, 위 5줄은 양옆 1px씩 들어간 경사)
  const slabAt = [];
  let sx = 0;
  SLABS.forEach(([w, h], k) => {
    for (let i = 0; i < w; i++) slabAt[sx + i] = { k, left: sx, right: sx + w - 1, top: H - h };
    sx += w;
  });
  const baseTop = H - BASE_H;
  const inBase = (x, y) => y >= baseTop && y < H && (y >= baseTop + BASE_H / 2 ? x >= 0 && x < W : x >= 1 && x < W - 1);
  const inSlab = (x, y) => x >= 0 && x < W && y >= slabAt[x].top && y < baseTop;
  const solid = (x, y) => inBase(x, y) || inSlab(x, y);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!solid(x, y)) continue;
      // 바깥 둘레 1px는 윤곽(건물과 같은 #2b3135)
      if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) {
        put(x, y, STONE.outline);
        continue;
      }
      if (inBase(x, y)) {
        // 경사 받침: 맨 윗줄은 빛 받는 모서리, 왼쪽 밝게 · 오른쪽 그늘, 안쪽은 2px 간격 사선(/) 줄무늬
        if (y === baseTop || !solid(x - 2, y) || (y === baseTop + BASE_H / 2 && !inBase(x, y - 1))) put(x, y, STONE.light);
        else if (!solid(x + 2, y)) put(x, y, STONE.groove);
        else put(x, y, (x + y) % 3 === 0 ? STONE.dark : STONE.mid);
        continue;
      }
      const s = slabAt[x];
      if (y === s.top + 1) put(x, y, STONE.light); // 윗면
      else if (y === baseTop - 1) put(x, y, STONE.groove); // 판이 받침에 묻히는 그늘 줄
      else if (x === s.left || (s.left === 0 && x === 1)) put(x, y, STONE.light); // 왼쪽 면
      else if (x === s.right || (s.right === W - 1 && x === W - 2)) put(x, y, STONE.dark); // 오른쪽 면
      else put(x, y, STONE.mid);
    }
  }
  // 바닥 그림자: 받침을 아래로 2px 민 자리(가로수 그림자와 같은 방향)
  for (let y = H; y < H + shadow; y++) for (let x = 0; x < W; x++) put(x, y, SHADOW);
  return { w: W, h: H + shadow, data };
}

// ── 5×7 도트 글꼴(직접 찍음, 굵기 하나로 통일). '#'= 글자 픽셀. 쉼표만 아래로 내려옵니다. ──
const GLYPHS = {
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."],
  t: [".#..", ".#..", "###.", ".#..", ".#..", ".#..", "..##"],
  h: ["#....", "#....", "#.##.", "##..#", "#...#", "#...#", "#...#"],
  w: [".....", ".....", "#...#", "#...#", "#.#.#", "#.#.#", ".#.#."],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  l: ["##.", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  d: ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
  ",": ["..", "..", "..", "..", "..", ".#", ".#", "#."],
};
export const LETTER_GAP = 1;
export const WORD_GAP = 3;
export const BANNER_LINES = ["Come to HUFS,", "Meet the world"];

export function textWidth(line) {
  return line.split(" ").map((word) => [...word].reduce((s, ch) => s + GLYPHS[ch][0].length, 0) + LETTER_GAP * (word.length - 1)).reduce((s, w) => s + w, 0) + WORD_GAP * (line.split(" ").length - 1);
}

function drawText(put, line, x0, y0, color) {
  let x = x0;
  line.split(" ").forEach((word, wi) => {
    if (wi) x += WORD_GAP;
    [...word].forEach((ch, ci) => {
      if (ci) x += LETTER_GAP;
      const g = GLYPHS[ch];
      g.forEach((row, dy) => [...row].forEach((p, dx) => p === "#" && put(x + dx, y0 + dy, color)));
      x += g[0].length;
    });
  });
}

// 현수막: 파란 바탕 · 진파랑 테두리 1px · 양 끝 무늬 없는 노란 원(지름 12) · 흰 글씨 두 줄
export const CIRCLE_D = 12;
export const LINE_TOP = [3, 12];
export function paintBanner() {
  const { w: W, h: H } = GATE.banner;
  const { data, put } = canvasData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, x === 0 || y === 0 || x === W - 1 || y === H - 1 ? BANNER.edge : BANNER.blue);
  const cy = (H - CIRCLE_D) / 2;
  for (const cx of [2, W - 2 - CIRCLE_D]) {
    for (let y = 0; y < CIRCLE_D; y++) {
      for (let x = 0; x < CIRCLE_D; x++) {
        const d = Math.hypot(x + 0.5 - CIRCLE_D / 2, y + 0.5 - CIRCLE_D / 2);
        if (d <= CIRCLE_D / 2) put(cx + x, cy + y, d > CIRCLE_D / 2 - 1.2 ? BANNER.yellowEdge : BANNER.yellow);
      }
    }
  }
  const textLeft = 2 + CIRCLE_D + 2;
  const textArea = W - 2 * textLeft;
  BANNER_LINES.forEach((line, i) => drawText(put, line, textLeft + Math.floor((textArea - textWidth(line)) / 2), LINE_TOP[i], BANNER.text));
  return { w: W, h: H, data };
}

// 장면에 정문을 세웁니다(맵 v2에서만 부름). 텍스처는 처음 한 번만 만듭니다.
export function addCampusGate(scene) {
  const add = (key, paint) => {
    if (scene.textures.exists(key)) return;
    const { w, h, data } = paint();
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").putImageData(new ImageData(data, w, h), 0, 0);
    scene.textures.addCanvas(key, canvas);
  };
  add("gate-pillar", paintPillar);
  add("gate-banner", paintBanner);
  // 정수 좌표 · 왼쪽 위 기준이라 카메라 3배에서 픽셀이 흐려지지 않습니다. 현수막은 기둥보다 살짝 뒤(양 끝이 기둥 안쪽 면에 물림).
  const { banner } = GATE;
  const images = GATE.pillars.map((p) => scene.add.image(p.rect.x, p.rect.y, "gate-pillar").setOrigin(0).setDepth(GATE.depth));
  images.push(scene.add.image(banner.x, banner.y, "gate-banner").setOrigin(0).setDepth(GATE.depth - 0.5));
  return images;
}
