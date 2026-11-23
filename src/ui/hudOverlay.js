import "./hudOverlay.css";
import { onLangChange, t } from "../state.js";

const BASE = { width: 960, height: 540 };
const MARGIN = 24; // 960x540 화면 가장자리와 창 사이 여백(게임 좌표)
const BASE_FONT = 14; // 게임 좌표 기준 글자 크기. 화면 크기에 맞춰 함께 줄어들고 늘어납니다.

export const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/*
 * 게임 위에 띄우는 HTML 창(행사 · 퀘스트)의 공통 틀입니다. 마감 임박 공지 창(deadlineOverlay.js)과 같은 방식:
 * 960x540 게임 화면 안에 맞추고, 화면 전체를 어두운 막으로 덮어 뒤쪽 게임 조작을 막고, ESC · 닫기로 닫습니다.
 * 내용은 render({ title, asOf, body, footer })가 채웁니다. 모든 글자는 textContent로만 넣습니다.
 */
export function createHudOverlay(game, { closeKey, render, onShow }, onClose) {
  const backdrop = el("div", "ho-overlay");
  backdrop.hidden = true;
  const box = el("div", "ho-box");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  const header = el("div", "ho-header");
  const titleWrap = el("div");
  const title = el("h2");
  const asOf = el("p", "ho-asof");
  titleWrap.append(title, asOf);
  const close = el("button", "ho-close");
  close.type = "button";
  header.append(titleWrap, close);
  const body = el("div", "ho-body");
  const footer = el("p", "ho-footer");
  box.append(header, body, footer);
  backdrop.append(box);
  document.body.append(backdrop);

  let open = false;
  const draw = () => {
    close.textContent = t(closeKey);
    body.replaceChildren();
    render({ title, asOf, body, footer });
    box.setAttribute("aria-label", title.textContent);
  };

  // 게임 화면이 960x540보다 넓으면 가운데 960x540 영역에 맞춥니다.
  const place = () => {
    const rect = game.canvas.getBoundingClientRect();
    const scale = rect.width / game.scale.width;
    const offsetX = (game.scale.width - BASE.width) / 2;
    const offsetY = (game.scale.height - BASE.height) / 2;
    Object.assign(box.style, {
      left: `${rect.left + (offsetX + MARGIN) * scale}px`,
      top: `${rect.top + (offsetY + MARGIN) * scale}px`,
      width: `${(BASE.width - MARGIN * 2) * scale}px`,
      height: `${(BASE.height - MARGIN * 2) * scale}px`,
      fontSize: `${BASE_FONT * scale}px`,
    });
  };

  const hide = (result) => {
    if (!open) return;
    open = false;
    backdrop.hidden = true;
    onClose(result);
  };

  // 열려 있는 동안 키 입력이 게임으로 넘어가지 않게 막고, ESC로 닫습니다.
  window.addEventListener(
    "keydown",
    (event) => {
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        hide();
      }
      event.stopPropagation();
    },
    true,
  );
  window.addEventListener("keyup", (event) => open && event.stopPropagation(), true);
  close.addEventListener("click", () => hide());
  onLangChange(() => open && draw());
  game.scale.on("resize", place);
  window.addEventListener("resize", place);

  return {
    isOpen: () => open,
    redraw: () => open && draw(),
    async show() {
      if (open) return;
      open = true;
      backdrop.hidden = false;
      place();
      draw();
      close.focus();
      if (onShow) {
        await onShow();
        if (open) draw();
      }
    },
    hide,
  };
}
