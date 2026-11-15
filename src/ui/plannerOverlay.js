import { onLangChange, t } from "../state.js";

const SRC = "/planner/";
const BASE = { width: 960, height: 540 };
const MARGIN = 12; // 960x540 화면 가장자리와 창 사이 여백(게임 좌표)

/*
 * 팀원이 만든 수강신청 추천 서비스 시제품(public/planner/index.html)을 게임 위에 띄우는 HTML 창입니다.
 * 960x540 게임 화면 안에 맞추고, 화면 전체를 어두운 막으로 덮어 뒤쪽 게임 조작을 막습니다.
 * iframe은 처음 열 때 한 번만 만들어, 닫았다 다시 열어도 장바구니 상태가 남습니다.
 */
export function createPlannerOverlay(game, onClose) {
  const backdrop = document.createElement("div");
  backdrop.className = "planner-overlay";
  backdrop.hidden = true;

  const box = document.createElement("div");
  box.className = "planner-box";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");

  const header = document.createElement("div");
  header.className = "planner-header";
  const title = document.createElement("h2");
  const notice = document.createElement("p");
  notice.className = "planner-notice";
  const close = document.createElement("button");
  close.type = "button";
  header.append(title, notice, close);

  const frameWrap = document.createElement("div");
  frameWrap.className = "planner-frame";
  box.append(header, frameWrap);
  backdrop.append(box);
  document.body.append(backdrop);

  let iframe = null;
  let open = false;

  const applyText = () => {
    title.textContent = t("plannerTitle");
    notice.textContent = t("plannerNotice");
    close.textContent = t("plannerClose");
    box.setAttribute("aria-label", t("plannerTitle"));
  };
  applyText();
  onLangChange(applyText);

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
    });
  };

  const hide = () => {
    if (!open) return;
    open = false;
    backdrop.hidden = true;
    onClose();
  };

  // 창 안팎 어디에 초점이 있든 ESC로 닫습니다.
  const onKey = (event) => {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
    }
    // 열려 있는 동안 키 입력이 게임으로 넘어가지 않게 막습니다.
    event.stopPropagation();
  };
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", (event) => open && event.stopPropagation(), true);

  close.addEventListener("click", hide);
  // 바깥 어두운 막을 눌러도 닫히지 않게 합니다. 실수로 눌러 작업 내용이 사라지는 것을 막기 위해서입니다.

  // 같은 사이트의 시제품이 보내는 메시지만 받습니다.
  window.addEventListener("message", (event) => {
    if (!iframe || event.source !== iframe.contentWindow || event.origin !== window.location.origin) return;
    if (event.data?.source !== "HUFS_WORLD_V4_1") return;
    // 지금은 장바구니 이벤트를 받기만 하고 쓰지 않습니다. 나중에 퀘스트 완료 등과 연결할 수 있습니다.
  });

  game.scale.on("resize", place);
  window.addEventListener("resize", place);

  return {
    isOpen: () => open,
    show() {
      if (open) return;
      open = true;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.src = SRC;
        iframe.title = t("plannerTitle");
        // iframe 안에 초점이 있을 때도 ESC를 받을 수 있게 같은 사이트 문서에 키 처리를 붙입니다.
        iframe.addEventListener("load", () => {
          try {
            iframe.contentWindow.addEventListener("keydown", (event) => {
              if (event.key === "Escape") hide();
            });
          } catch {
            // 다른 사이트 문서면 접근할 수 없으므로 닫기 버튼만 씁니다.
          }
        });
        frameWrap.append(iframe);
      }
      backdrop.hidden = false;
      place();
      close.focus();
    },
    hide,
  };
}
