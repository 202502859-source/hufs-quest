import { GRID_H, GRID_W, WORLD_H, WORLD_W } from "../data/campusV2.js";
import { paintOverview, paintRegion } from "./campusV2Paint.js";

// 모바일 WebGL 최대 텍스처(보통 4096px)보다 충분히 작게 2×2 조각으로 나눕니다.
const COLS = 2;
const ROWS = 2;
export const stats = { map: "v2", paintMs: 0, chunks: [], textureBytes: 0, fps: 0 };
if (typeof window !== "undefined") window.__campusStats = stats;

function canvasFrom(rgba, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.putImageData(new ImageData(rgba, w, h), 0, 0);
  return canvas;
}

// 맵 텍스처 조각을 만들고(처음 한 번) 장면에 이미지로 깝니다.
export function addCampusV2Ground(scene) {
  const cw = Math.ceil(WORLD_W / COLS);
  const ch = Math.ceil(WORLD_H / ROWS);
  if (!scene.textures.exists("campus-v2-0-0")) {
    const t0 = performance.now();
    stats.chunks = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const w = Math.min(cw, WORLD_W - c * cw);
        const h = Math.min(ch, WORLD_H - r * ch);
        scene.textures.addCanvas(`campus-v2-${r}-${c}`, canvasFrom(paintRegion(c * cw, r * ch, w, h), w, h));
        stats.chunks.push([w, h]);
      }
    }
    stats.paintMs = Math.round(performance.now() - t0);
    stats.textureBytes = WORLD_W * WORLD_H * 4;
    // 성능 실측용(개발 서버 · Preview 콘솔에서 확인)
    console.info(`[campus v2] 맵 그리기 ${stats.paintMs}ms, 텍스처 ${WORLD_W}×${WORLD_H}px(${COLS}×${ROWS}조각), 약 ${(stats.textureBytes / 1048576).toFixed(1)}MB`);
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) scene.add.image(c * cw, r * ch, `campus-v2-${r}-${c}`).setOrigin(0).setDepth(-10);
  }
}

// 전체 지도 · 미니맵용 축소 그림(1m = 1px)
export function campusV2OverviewCanvas() {
  return canvasFrom(paintOverview(), GRID_W, GRID_H);
}
