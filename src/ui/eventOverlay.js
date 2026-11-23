import { kstParts } from "../../shared/deadlineCalc.js";
import { EVENT_WINDOW_DAYS } from "../../shared/eventCalc.js";
import { SCHOOL_NOTICE_URL, eventState, refreshEvents } from "../data/eventsApi.js";
import { getLang, t } from "../state.js";
import { createHudOverlay, el } from "./hudOverlay.js";

const WEEKDAYS = { ko: ["일", "월", "화", "수", "목", "금", "토"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");
const CATEGORY_KEY = { festival: "eventCatFestival", briefing: "eventCatBriefing", lecture: "eventCatLecture", recruit: "eventCatRecruit", other: "eventCatOther" };
const STATUS_KEY = { ongoing: "eventStatusOngoing", today: "eventStatusToday", upcoming: "eventStatusUpcoming" };

const day = (p, lang) => (lang === "en" ? `${WEEKDAYS.en[p.weekday]} ${MONTHS[p.m]} ${p.d}` : `${p.m + 1}.${pad(p.d)} (${WEEKDAYS.ko[p.weekday]})`);
const clock = (p) => `${pad(p.hh)}:${pad(p.mm)}`;

// "11.28 (금) 10:00~18:00" 또는 "11.28 (금) 10:00 ~ 11.29 (토) 18:00"
function whenText(item, lang) {
  const s = kstParts(Date.parse(item.startsAt));
  const e = kstParts(Date.parse(item.endsAt));
  const sameDay = s.y === e.y && s.m === e.m && s.d === e.d;
  return sameDay ? `${day(s, lang)} ${clock(s)}~${clock(e)}` : `${day(s, lang)} ${clock(s)} ~ ${day(e, lang)} ${clock(e)}`;
}

// "확인 11.20"
const checkedText = (on) => (on ? t("eventChecked", { date: `${on.slice(5, 7)}.${on.slice(8, 10)}` }) : "");

function asOfText(data) {
  const lang = getLang();
  const p = kstParts(Date.parse(data.serverTime));
  const time = clock(p);
  const text =
    lang === "en"
      ? `${t("deadlineAsOf")} ${WEEKDAYS.en[p.weekday]}, ${MONTHS[p.m]} ${p.d}, ${p.y} ${time} ${t("deadlineKst")}`
      : `${t("deadlineAsOf")}: ${p.y}.${pad(p.m + 1)}.${pad(p.d)} (${WEEKDAYS.ko[p.weekday]}) ${time} ${t("deadlineKst")}`;
  return data.source === "device" ? `${text} ${t("deadlineDevice")}` : text;
}

const link = (href, text) => {
  const a = el("a", "ho-link", text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
};

/*
 * 학교 행사 창(표 형식). 오늘부터 14일 안에 시작하거나 진행 중인 행사만, 시작 순으로 보여 줍니다(shared/eventCalc.js).
 * "지도에서 보기"를 누르면 창을 닫고 onClose({ showOnMap: buildingId })로 알립니다.
 */
export function createEventOverlay(game, onClose) {
  let overlay;
  const render = ({ title, asOf, body, footer }) => {
    const data = eventState.data;
    const lang = getLang();
    title.textContent = t("eventTitle", { days: EVENT_WINDOW_DAYS });
    footer.textContent = t("eventFooter");
    asOf.textContent = data ? asOfText(data) : t("deadlineLoading");
    if (!data) return;
    if (!data.items.length) {
      const empty = el("p", "ho-empty", `${t("eventEmpty")} `);
      empty.append(link(SCHOOL_NOTICE_URL, t("eventNoticeLink")));
      body.append(empty);
      return;
    }
    const table = el("table", "ho-table");
    const colgroup = el("colgroup");
    ["status", "title", "host", "time", "place", "source", "note"].forEach((name) => colgroup.append(el("col", `col-${name}`)));
    const headRow = el("tr");
    ["eventColStatus", "eventColTitle", "eventColHost", "eventColTime", "eventColPlace", "eventColSource", "eventColNote"].forEach((key) => {
      const th = el("th", "", t(key));
      th.scope = "col";
      headRow.append(th);
    });
    const head = el("thead");
    head.append(headRow);
    const rows = el("tbody");
    data.items.forEach((item) => {
      const tr = el("tr");
      tr.append(el("td", `ho-status ${item.status}`, t(STATUS_KEY[item.status])));

      const titleCell = el("td");
      titleCell.append(el("span", "ho-name", item.title[lang]));
      const summary = el("span", "ho-sub ho-clamp", item.summary[lang]);
      summary.title = item.summary[lang];
      titleCell.append(summary);
      if (item.target) titleCell.append(el("span", "ho-sub", `${t("eventTarget")}: ${item.target[lang]}`));
      if (item.signup) titleCell.append(el("span", "ho-sub", `${t("eventSignup")}: ${item.signup[lang]}`));
      tr.append(titleCell);

      tr.append(el("td", "ho-muted", item.host[lang]));
      tr.append(el("td", "", whenText(item, lang)));

      const placeCell = el("td", "", item.place[lang]);
      if (item.buildingId) {
        const button = el("button", "ho-mapbtn", t("eventShowOnMap"));
        button.type = "button";
        button.addEventListener("click", () => overlay.hide({ showOnMap: item.buildingId }));
        placeCell.append(el("br"), button);
      }
      tr.append(placeCell);

      const source = el("td");
      if (item.sourceType === "host") {
        source.append(el("span", "ho-muted", `${t("eventSourceHost")} · ${checkedText(item.checkedOn)}`));
        if (item.url) source.append(el("br"), link(item.url, t("eventSourceLink")));
      } else {
        source.append(link(item.url, t("eventSourceLink")), el("span", "ho-sub", checkedText(item.checkedOn)));
      }
      tr.append(source);

      const note = el("td");
      if (item.note) note.append(el("span", "ho-sub", item.note[lang]));
      note.append(el("span", `ho-tag${item.demo ? " demo" : ""}`, item.demo ? t("eventDemoTag") : t(CATEGORY_KEY[item.category] ?? "eventCatOther")));
      tr.append(note);
      rows.append(tr);
    });
    table.append(colgroup, head, rows);
    body.append(table);
  };
  // 창을 열 때마다 최신 시간 기준으로 다시 계산합니다.
  overlay = createHudOverlay(game, { closeKey: "deadlineClose", render, onShow: refreshEvents }, onClose);
  return overlay;
}
