// 스탬프 랠리 부스와 "시설 안내문" 팻말 그림입니다. textures.js처럼 외부 이미지 없이 캔버스에 직접 그립니다.
import { NPC_LOOKS, createCharacterCanvas } from "./textures.js";

export const BOOTH_TEXTURE = "rally-booth";
// 부스 그림 크기와 바닥 기준점(부스 자리 = 테이블 · 다리가 놓인 바닥 가운데). 화면에는 BOOTH_SCALE(0.8)로 줄여 놓습니다(캐릭터 16px의 약 2.3배).
export const BOOTH_SIZE = { w: 46, h: 46, originX: 23, originY: 39 };
const BOOTH_NPC_LOOK = 3; // 부스 안 사람(기존 NPC와 같은 그림 · 크기)

/*
 * 행사용 접이식 캐노피 텐트(약간 위에서 내려다본 3/4 시점).
 * - 지붕: 파란색 · 흰색이 번갈아 나뉜 사각 캐노피, 가장자리에 짧은 파란 천 테두리
 * - 다리 4개: 앞다리 2개는 길게 바닥 끝까지, 뒷다리 2개는 짧고 안쪽으로(원근)
 * - 안쪽: 짙은 남색 천을 덮은 긴 테이블, 테이블 뒤에 사람 1명, 바닥 그림자
 */
function createBoothCanvas() {
  const { w, h } = BOOTH_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const px = (color, x, y, pw = 1, ph = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, pw, ph);
  };
  const BLUE = "#2f6fd0";
  const BLUE_DARK = "#1f4f9c";
  const WHITE = "#f4f7fb";
  const WHITE_SHADE = "#cfd9e8";
  const POLE = "#e3e8ef";
  const POLE_SHADE = "#8f99a8";

  // 바닥 그림자(살짝)
  px("rgba(16, 24, 42, 0.22)", 6, 35, 34, 2);
  px("rgba(16, 24, 42, 0.22)", 3, 37, 40, 7);
  px("rgba(16, 24, 42, 0.22)", 6, 44, 34, 1);

  // 뒷다리(짧고 안쪽)
  [11, 33].forEach((x) => {
    px(POLE_SHADE, x, 17, 2, 18);
    px("#6f7a8a", x, 34, 2, 1);
  });

  // 사람(테이블 뒤, 아래를 봄)
  const npc = createCharacterCanvas(NPC_LOOKS[BOOTH_NPC_LOOK]);
  ctx.drawImage(npc, 0, 0, 16, 16, 15, 16, 16, 16);

  // 테이블: 윗면 + 앞으로 늘어진 짙은 남색 천
  px("#3d5290", 7, 29, 32, 1);
  px("#2f4070", 7, 30, 32, 3);
  px("#1b2647", 7, 33, 32, 9);
  for (let x = 12; x < 39; x += 6) px("#141c36", x, 34, 1, 8);
  px("#101830", 7, 41, 32, 1);
  // 테이블 위: 도장 찍을 종이와 인주 도장
  px("#f4f7fb", 11, 30, 5, 2);
  px("#cfd9e8", 11, 31, 5, 1);
  px("#8a5c3c", 30, 27, 2, 2);
  px("#d93f3f", 29, 29, 4, 2);

  // 앞다리(길게, 바닥까지)
  [3, 41].forEach((x) => {
    px(POLE, x, 18, 1, 26);
    px(POLE_SHADE, x + 1, 18, 1, 26);
    px("#4a5566", x, 44, 2, 1);
  });

  // 지붕: 위쪽이 좁은 사다리꼴(위에서 내려다본 사각 캐노피의 앞면), 파랑 · 하양 6줄
  const top = { y: 3, x0: 10, x1: 36 };
  const bottom = { y: 14, x0: 1, x1: 45 };
  for (let y = top.y; y < bottom.y; y++) {
    const k = (y - top.y) / (bottom.y - 1 - top.y);
    const x0 = Math.round(top.x0 + (bottom.x0 - top.x0) * k);
    const x1 = Math.round(top.x1 + (bottom.x1 - top.x1) * k);
    for (let x = x0; x < x1; x++) {
      const stripe = Math.min(5, Math.floor(((x - x0) / (x1 - x0)) * 6));
      const blue = stripe % 2 === 0;
      px(blue ? BLUE : WHITE, x, y);
    }
    px(BLUE_DARK, x0, y);
    px(BLUE_DARK, x1 - 1, y);
  }
  px(BLUE_DARK, top.x0, top.y - 1, top.x1 - top.x0, 1);
  // 꼭대기(가운데 솟은 부분)
  px(WHITE, 21, 0, 4, 2);
  px(BLUE_DARK, 21, 0, 4, 1);
  // 가장자리 천 테두리(짧은 파란 띠 + 아래 물결)
  px(WHITE_SHADE, 1, 14, 44, 1);
  px(BLUE, 1, 15, 44, 3);
  for (let x = 1; x < 45; x += 4) {
    px(BLUE, x, 18, 3, 1);
    px(BLUE_DARK, x + 3, 17, 1, 1);
  }
  px(BLUE_DARK, 1, 15, 1, 3);
  px(BLUE_DARK, 44, 15, 1, 3);
  return canvas;
}

export function registerRallyTextures(scene) {
  if (!scene.textures.exists(BOOTH_TEXTURE)) scene.textures.addCanvas(BOOTH_TEXTURE, createBoothCanvas());
}

/*
 * 나무 팻말(기둥 + 판, 판에 글자). 글자가 또렷하도록 3배 해상도로 그리고 화면에는 1/3로 줄여 놓습니다.
 * - angled: 문이 옆(왼쪽 · 오른쪽)을 보는 건물용. 판을 비스듬히(3/4 각도) 돌려 글자가 읽히게 합니다.
 *   mirror가 true면 반대쪽(왼쪽)을 보는 모양.
 * 반환: { key, scale, originX, originY } — 기준점은 기둥 밑동(팻말 자리의 발밑).
 */
export const SIGN_RES = 3; // 그림 해상도 배율(크기 배율 SIGN_SCALE은 src/data/stampRallySpots.js)
export const SIGN_FONT_PX = 6; // 판 글자 크기(월드 px). 안내원 발밑 이름표(6px)와 같게
export function signTexture(scene, text, { angled = false, mirror = false } = {}) {
  const key = `rally-sign:${angled ? (mirror ? "L" : "R") : "F"}:${text}`;
  const S = SIGN_RES;
  const font = `${SIGN_FONT_PX * S}px Galmuri9, sans-serif`;
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = font;
  const textW = Math.ceil(probe.measureText(text).width / S);
  const boardW = textW + 6;
  const boardH = 11;
  const postH = 13;
  const skew = angled ? 0.24 : 0; // 판 오른쪽이 이만큼 올라감(1px당)
  const squeeze = angled ? 0.84 : 1; // 비스듬히 본 판은 가로가 조금 짧아 보임
  const drawnW = Math.ceil(boardW * squeeze);
  const rise = Math.ceil(drawnW * skew);
  const W = drawnW + 2;
  const H = boardH + rise + postH;
  const info = { key, scale: 1 / S, originX: 0.5, originY: 1, width: W, height: H };
  if (scene.textures.exists(key)) return info;

  const canvas = document.createElement("canvas");
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const px = (color, x, y, pw = 1, ph = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * S), Math.round(y * S), Math.round(pw * S), Math.round(ph * S));
  };
  // 기둥(판 뒤 가운데 아래)
  const postX = Math.floor(W / 2) - 1;
  const boardBottom = rise / 2 + boardH;
  px("#6b4a2f", postX, boardBottom - 2, 3, H - boardBottom + 2);
  px("#8a5c3c", postX, boardBottom - 2, 1, H - boardBottom + 2);
  px("#4a321f", postX, H - 1, 3, 1);

  // 판 + 글자를 따로 그린 뒤, 비스듬한 팻말이면 기울여 붙입니다.
  const board = document.createElement("canvas");
  board.width = boardW * S;
  board.height = boardH * S;
  const b = board.getContext("2d");
  const bpx = (color, x, y, pw, ph) => {
    b.fillStyle = color;
    b.fillRect(x * S, y * S, pw * S, ph * S);
  };
  bpx("#5b3a26", 0, 0, boardW, boardH);
  bpx("#c9a36b", 1, 1, boardW - 2, boardH - 2);
  bpx("#dcb980", 1, 1, boardW - 2, 1);
  bpx("#b8925a", 1, boardH - 3, boardW - 2, 1);
  b.font = font;
  b.textBaseline = "middle";
  b.textAlign = "center";
  b.fillStyle = "#2a1a0c";
  b.fillText(text, (boardW * S) / 2, (boardH * S) / 2 + S * 0.5);

  ctx.save();
  if (mirror) {
    ctx.translate(W * S, 0);
    ctx.scale(-1, 1);
  }
  // x가 늘수록 y가 줄어드는 기울임(오른쪽이 위로). 거울 모양이면 글자가 뒤집히지 않게 판만 다시 뒤집습니다.
  ctx.transform(squeeze, -skew * squeeze, 0, 1, S, rise * S);
  if (mirror) {
    ctx.translate(boardW * S, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(board, 0, 0);
  ctx.restore();
  if (angled) {
    // 판 옆면(두께): 가까운 쪽 끝에 어두운 세로 줄
    const edgeX = mirror ? 0 : W - 1;
    const edgeY = mirror ? rise : 0;
    px("#4a321f", edgeX, edgeY, 1, boardH);
  }
  scene.textures.addCanvas(key, canvas);
  return info;
}
