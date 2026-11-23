import { activeQuests, getLang, isGuest, t } from "../state.js";
import { createHudOverlay, el } from "./hudOverlay.js";

/*
 * 퀘스트 창. 진행 중인 퀘스트가 있을 때만 HUD 버튼(Q)이 보이고, 누르면 이 창이 열립니다.
 * 줄을 누르면 창을 닫고 onClose({ questId })로 알려 퀘스트 안내 창을 엽니다. 0개면 빈 화면 문구.
 */
export function createQuestOverlay(game, onClose) {
  let overlay;
  const render = ({ title, asOf, body, footer }) => {
    title.textContent = t("quests");
    asOf.textContent = "";
    footer.textContent = "";
    const quests = activeQuests();
    if (!quests.length) {
      body.append(el("p", "ho-empty", t("questEmpty")));
      return;
    }
    const list = el("ul", "ho-quests");
    quests.forEach((quest) => {
      const locked = isGuest() && quest.studentOnly;
      const item = el("li");
      const button = el("button", `ho-quest${locked ? " locked" : ""}`);
      button.type = "button";
      button.append(el("span", "ho-check"), el("span", "", quest.name[getLang()]));
      if (locked) button.append(el("span", "ho-muted", t("studentOnly")));
      button.addEventListener("click", () => overlay.hide({ questId: quest.id }));
      item.append(button);
      list.append(item);
    });
    body.append(list);
  };
  overlay = createHudOverlay(game, { closeKey: "deadlineClose", render }, onClose);
  return overlay;
}
