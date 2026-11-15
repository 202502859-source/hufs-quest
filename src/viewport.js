import { isTouchDevice, onTouchDetected } from "./device.js";
import { onLangChange, t } from "./state.js";

const BASE_WIDTH = 960;
const BASE_HEIGHT = 540;
const MAX_ASPECT = 21 / 9;

const isPortrait = () => window.innerHeight > window.innerWidth;

// PC는 960x540을 유지합니다. 터치 기기의 가로 화면은 왜곡 없이 꽉 차도록 게임 크기를 화면 비율에 맞춥니다.
export function viewportSize() {
  if (!isTouchDevice() || isPortrait()) return { width: BASE_WIDTH, height: BASE_HEIGHT };
  const aspect = Math.min(window.innerWidth / window.innerHeight, MAX_ASPECT);
  if (aspect >= BASE_WIDTH / BASE_HEIGHT) return { width: Math.round(BASE_HEIGHT * aspect), height: BASE_HEIGHT };
  return { width: BASE_WIDTH, height: Math.round(BASE_WIDTH / aspect) };
}

// 휴대폰의 주소창을 숨기기 위해 첫 터치 때 전체 화면을 요청합니다. 지원하지 않는 브라우저에서는 그냥 넘어갑니다.
function requestFullscreenOnce() {
  const request = () => {
    const root = document.documentElement;
    if (!root.requestFullscreen || document.fullscreenElement) return;
    root
      .requestFullscreen({ navigationUI: "hide" })
      .then(() => window.screen.orientation?.lock?.("landscape"))
      .catch(() => {});
  };
  window.addEventListener("pointerup", request, { once: true });
}

export function setupViewport(game) {
  const notice = document.getElementById("rotate-notice");
  const noticeText = document.getElementById("rotate-text");

  const apply = () => {
    const portrait = isTouchDevice() && isPortrait();
    notice.hidden = !portrait;
    // 세로 안내가 떠 있는 동안 미니게임 타이머 등이 흐르지 않게 멈춥니다.
    if (portrait && !game.isPaused) game.pause();
    if (!portrait && game.isPaused) game.resume();
    // 휴대폰 키보드가 올라와 화면이 줄어든 경우에는 게임 크기를 바꾸지 않습니다.
    if (portrait || document.activeElement?.tagName === "INPUT") return;
    const { width, height } = viewportSize();
    if (width !== game.scale.width || height !== game.scale.height) game.scale.setGameSize(width, height);
    game.scale.refresh();
  };

  const updateText = () => {
    noticeText.textContent = t("rotateNotice");
  };

  updateText();
  onLangChange(updateText);
  apply();
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);
  document.addEventListener("fullscreenchange", apply);
  onTouchDetected(apply);
  if (isTouchDevice()) requestFullscreenOnce();
}
