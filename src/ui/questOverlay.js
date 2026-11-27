import { DAILY_QUIZ_BONUS_EXP, DAILY_QUIZ_GOAL, STAMP_RALLY_REWARD } from "../../shared/progressRules.js";
import { STAMP_RALLY_STOPS } from "../../shared/stampRally.js";
import { buildingInfo } from "../data/buildingInfo.js";
import { dailyState } from "../dailyQuests.js";
import { DAILY_QUEST_LIST, getLang, isGuest, t } from "../state.js";
import { createHudOverlay, el } from "./hudOverlay.js";

/*
 * 일일 퀘스트 상세 창(11/27). HUD 일일 퀘스트 창의 줄을 누르거나 Q 키로 엽니다.
 * - 캠퍼스 스탬프 랠리: 4곳 체크 목록(받은 곳은 채운 네모 + "스탬프 받음"), 완주 보상
 * - 일일 퀴즈: 오늘 맞춘 정답 수, 보너스
 * 예전 퀘스트 목록 창과 같은 틀(hudOverlay.js) · 같은 줄 모양(.ho-quest)을 씁니다. 모든 글자는 textContent로만 넣습니다.
 */
export function createQuestOverlay(game, onClose) {
  let overlay;
  const heading = (text) => el("h3", "ho-group", text);
  const line = (text, className = "ho-form-notice") => {
    const p = el("p", className, text);
    p.style.margin = "0.6em 1em";
    return p;
  };
  const render = ({ title, asOf, body, footer }) => {
    const lang = getLang();
    const daily = dailyState();
    const [rally, quiz] = DAILY_QUEST_LIST;
    title.textContent = t("dailyTitle");
    asOf.textContent = daily.date;
    footer.textContent = isGuest() ? t("dailyGuestNote") : "";

    body.append(heading(rally.name[lang]), line(t("rallyDetailIntro")));
    const list = el("ul", "ho-quests");
    STAMP_RALLY_STOPS.forEach((stop) => {
      const done = daily.stamps.includes(stop.buildingId);
      const info = buildingInfo(stop.buildingId);
      const item = el("li", "ho-quest");
      item.style.cursor = "default";
      const check = el("span", "ho-check");
      if (done) check.style.background = "#d93f3f";
      item.append(check, el("span", "", (lang === "en" ? info.nameEn : null) ?? info.name), el("span", "ho-muted", t(done ? "rallyStopDone" : "rallyStopTodo")));
      list.append(item);
    });
    body.append(list, line(t("rallyReward", STAMP_RALLY_REWARD), "ho-muted"));

    body.append(heading(quiz.name[lang]));
    body.append(line(t("dailyQuizCount", { n: Math.min(daily.quizCorrect, daily.quizGoal), goal: daily.quizGoal })));
    body.append(line(t("dailyQuizDetail", { goal: DAILY_QUIZ_GOAL, exp: DAILY_QUIZ_BONUS_EXP }), "ho-muted"));
  };
  overlay = createHudOverlay(game, { closeKey: "deadlineClose", render }, onClose);
  return overlay;
}
