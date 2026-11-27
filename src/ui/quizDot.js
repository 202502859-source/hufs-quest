/*
 * 지도 위 퀴즈 상자 표시(미니맵 · 전체 지도 공통, 11/27 오후): 작은 샛노란 원 + 1px 어두운 테두리. 깜빡이지 않습니다.
 * 내 위치(흰색 깜빡이는 네모) · 다음 부스 강조(노란 네모 테두리, 깜빡임) · 부스(파란 네모)와는 모양(원)과 정지 표시로 구분합니다.
 * 크기는 지도마다 다른 점 배율 k에 곱합니다(미니맵 k = MINIMAP dot, 전체 지도 k = QUIZ_DOT.fullMapK).
 * 반지름 1.2 × k = 예전 주황 네모(한 변 4 × k)의 약 60% 지름.
 */
export const QUIZ_DOT_RADIUS = 1.2;
export const QUIZ_DOT = { color: 0xffe600, edge: 0x10182a, edgePx: 1, blink: false, squareBefore: 4, fullMapK: 2.5 };

// 지도 위 내 위치 표시 색(미니맵 · 전체 지도 공통, 11/27 저녁 PM 결정: 노랑 0xffe14d → 흰색). 어두운 그림자 네모 · 깜빡임은 그대로.
export const HERE_COLOR = 0xffffff;
export const HERE_COLOR_BEFORE = 0xffe14d;

// graphics에 퀴즈 점 하나를 그립니다. (x, y): 지도 위 가운데, k: 점 배율
export function drawQuizDot(graphics, x, y, k) {
  const r = QUIZ_DOT_RADIUS * k;
  graphics.fillStyle(QUIZ_DOT.edge, 1).fillCircle(x, y, r + QUIZ_DOT.edgePx);
  graphics.fillStyle(QUIZ_DOT.color, 1).fillCircle(x, y, r);
  return graphics;
}
