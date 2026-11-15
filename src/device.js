// 손가락이 주 입력인 기기(휴대폰·태블릿)를 찾습니다. 터치스크린 노트북은 처음 화면을 터치할 때 터치 모드로 바뀝니다.
const listeners = new Set();
let touch = window.matchMedia("(pointer: coarse)").matches;

export const isTouchDevice = () => touch;

export function onTouchDetected(fn) {
  listeners.add(fn);
}

if (!touch) {
  window.addEventListener(
    "touchstart",
    () => {
      touch = true;
      listeners.forEach((fn) => fn());
    },
    { once: true, passive: true },
  );
}
