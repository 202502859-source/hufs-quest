import { kstParts } from "../../shared/deadlineCalc.js";
import { deadlineState, refreshDeadlines } from "../data/deadlinesApi.js";
import { getLang, onLangChange, t } from "../state.js";

const BASE = { width: 960, height: 540 };
const MARGIN = 24; // 960x540 화면 가장자리와 창 사이 여백(게임 좌표)
const BASE_FONT = 14; // 게임 좌표 기준 글자 크기. 화면 크기에 맞춰 함께 줄어들고 늘어납니다.

const CATEGORY = {
  academic: { key: "catAcademic", className: "academic" },
  scholarship: { key: "catScholarship", className: "scholarship" },
  campus: { key: "catCampus", className: "campus" },
  external: { key: "catExternal", className: "external" },
};

const WEEKDAYS = { ko: ["일", "월", "화", "수", "목", "금", "토"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");

// "기준: 2026.11.10 (화) 12:50 한국 시간" 형식
function asOfText(data) {
  const lang = getLang();
  const p = kstParts(Date.parse(data.serverTime));
  const time = `${pad(p.hh)}:${pad(p.mm)}`;
  const text =
    lang === "en"
      ? `${t("deadlineAsOf")} ${WEEKDAYS.en[p.weekday]}, ${MONTHS[p.m]} ${p.d}, ${p.y} ${time} ${t("deadlineKst")}`
      : `${t("deadlineAsOf")}: ${p.y}.${pad(p.m + 1)}.${pad(p.d)} (${WEEKDAYS.ko[p.weekday]}) ${time} ${t("deadlineKst")}`;
  return data.source === "device" ? `${text} ${t("deadlineDevice")}` : text;
}

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/*
 * 마감 임박 공지 창(표 형식)입니다. 표 본문 스크롤, 두 줄 말줄임, 새 탭 링크가 필요해 HTML로 게임 위에 띄웁니다.
 * 960x540 게임 화면 안에 맞추고, 화면 전체를 어두운 막으로 덮어 뒤쪽 게임 조작을 막습니다.
 */
export function createDeadlineOverlay(game, onClose) {
  const backdrop = el("div", "dl-overlay");
  backdrop.hidden = true;
  const box = el("div", "dl-box");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");

  const header = el("div", "dl-header");
  const titleWrap = el("div", "dl-titles");
  const title = el("h2");
  const asOf = el("p", "dl-asof");
  titleWrap.append(title, asOf);
  const close = el("button", "dl-close");
  close.type = "button";
  header.append(titleWrap, close);

  const body = el("div", "dl-body");
  const footer = el("p", "dl-footer");
  box.append(header, body, footer);
  backdrop.append(box);
  document.body.append(backdrop);

  let open = false;

  const renderTable = () => {
    const data = deadlineState.data;
    title.textContent = t("deadlineTitle");
    box.setAttribute("aria-label", t("deadlineTitle"));
    close.textContent = t("deadlineClose");
    footer.textContent = t("deadlineFooter");
    asOf.textContent = data ? asOfText(data) : t("deadlineLoading");
    body.replaceChildren();
    if (!data) return;
    if (!data.items.length) {
      body.append(el("p", "dl-empty", t("deadlineEmpty")));
      return;
    }

    const lang = getLang();
    const table = el("table", "dl-table");
    const colgroup = el("colgroup");
    ["dday", "dept", "title", "note", "link"].forEach((name) => colgroup.append(el("col", `col-${name}`)));
    const head = el("thead");
    const headRow = el("tr");
    ["deadlineColDday", "deadlineColDept", "deadlineColTitle", "deadlineColNote", "deadlineColLink"].forEach((key) => {
      const th = el("th", "", t(key));
      th.scope = "col";
      headRow.append(th);
    });
    head.append(headRow);

    const rows = el("tbody");
    data.items.forEach((item) => {
      const tr = el("tr");
      const urgency = item.dday <= 1 ? "red" : item.dday <= 3 ? "orange" : "";
      tr.append(el("td", `dl-dday ${urgency}`, item.dday === 0 ? "D-DAY" : `D-${item.dday}`));
      tr.append(el("td", "dl-dept", item.dept?.[lang] ?? ""));
      const content = el("td");
      const clamp = el("div", "dl-clamp", item.title?.[lang] ?? "");
      clamp.title = item.title?.[lang] ?? "";
      content.append(clamp);
      tr.append(content);
      const note = el("td");
      const category = CATEGORY[item.category];
      if (category) note.append(el("span", `dl-tag ${category.className}`, t(category.key)));
      tr.append(note);
      const linkCell = el("td");
      const link = el("a", "dl-link", t("deadlineLink"));
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      linkCell.append(link);
      tr.append(linkCell);
      rows.append(tr);
    });
    table.append(colgroup, head, rows);
    body.append(table);
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

  const hide = () => {
    if (!open) return;
    open = false;
    backdrop.hidden = true;
    onClose();
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
  close.addEventListener("click", hide);
  onLangChange(() => open && renderTable());
  game.scale.on("resize", place);
  window.addEventListener("resize", place);

  return {
    isOpen: () => open,
    async show() {
      if (open) return;
      open = true;
      backdrop.hidden = false;
      place();
      renderTable();
      close.focus();
      // 창을 열 때마다 최신 시간 기준으로 다시 계산합니다.
      await refreshDeadlines();
      if (open) renderTable();
    },
    hide,
  };
}
