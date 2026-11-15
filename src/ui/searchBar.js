import { isTouchDevice } from "../device.js";
import { getLang, onLangChange, t } from "../state.js";

// HUD 기준(게임 좌표) 검색창 위치입니다. 왼쪽 상태창(12~260)과 오른쪽 KO/EN 버튼 사이를 채웁니다.
const LEFT = 272;
const TOP = 12;
const HEIGHT = 36;
const RIGHT_GAP = 116;
const MIN_TOUCH_PX = 44;

/*
 * 화면 맨 위에 항상 떠 있는 학사 정보 검색창입니다.
 * 한글 입력(IME)이 깨지지 않도록 Phaser 글자가 아니라 HTML 입력칸을 게임 화면 위에 얹습니다.
 */
export function createSearchBar(game, onSubmit) {
  const form = document.createElement("form");
  form.className = "ask-form search-bar";
  form.setAttribute("role", "search");
  const input = document.createElement("input");
  input.type = "search";
  input.maxLength = 200;
  input.autocomplete = "off";
  input.enterKeyHint = "search";
  const button = document.createElement("button");
  button.type = "submit";
  form.append(input, button);

  const applyText = () => {
    input.placeholder = t("searchPlaceholder");
    input.setAttribute("aria-label", t("searchPlaceholder"));
    button.textContent = t("searchButton");
    form.lang = getLang();
  };
  applyText();
  onLangChange(applyText);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    input.blur();
    onSubmit(question);
  });
  // 입력 중인 키(방향키, 스페이스, M 등)가 게임 조작으로 넘어가지 않게 막습니다.
  ["keydown", "keyup", "keypress"].forEach((type) => form.addEventListener(type, (event) => event.stopPropagation()));

  document.body.append(form);

  const place = () => {
    const rect = game.canvas.getBoundingClientRect();
    const scale = rect.width / game.scale.width;
    const width = Math.max(160, game.scale.width - LEFT - RIGHT_GAP);
    const height = Math.max(HEIGHT * scale, isTouchDevice() ? MIN_TOUCH_PX : 0);
    Object.assign(form.style, {
      left: `${rect.left + LEFT * scale}px`,
      top: `${rect.top + TOP * scale}px`,
      width: `${width * scale}px`,
      height: `${height}px`,
      // 16px보다 작으면 일부 휴대폰이 입력할 때 화면을 확대합니다.
      fontSize: `${Math.max(isTouchDevice() ? 16 : 13, 15 * scale)}px`,
    });
  };
  place();
  game.scale.on("resize", place);
  window.addEventListener("resize", place);

  return {
    setVisible(visible) {
      form.hidden = !visible;
      if (visible) place();
      else input.blur();
    },
    clear() {
      input.value = "";
    },
  };
}
