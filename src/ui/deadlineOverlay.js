import { filterDeadlinesByCategory, kstParts, splitDeadlineGroups } from "../../shared/deadlineCalc.js";
import { deadlineState, refreshDeadlines } from "../data/deadlinesApi.js";
import { getLang, onLangChange, t } from "../state.js";

const BASE = { width: 960, height: 540 };
const MARGIN = 24; // 960x540 화면 가장자리와 창 사이 여백(게임 좌표)
const BASE_FONT = 14; // 게임 좌표 기준 글자 크기. 화면 크기에 맞춰 함께 줄어들고 늘어납니다.
const HUFS_NOTICE_BOARD_URL = "https://www.hufs.ac.kr/hufs/11282/subview.do";

const FILTERS = [
  { id: "all", key: "catAll" },
  { id: "academic", key: "catAcademic" },
  { id: "scholarship", key: "catScholarship" },
  { id: "campus", key: "catCampus" },
  { id: "external", key: "catExternal" },
];

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

function startsAtTitle(startsAt, lang) {
  if (!startsAt) return "";
  const ms = Date.parse(startsAt);
  if (!Number.isFinite(ms)) return "";
  const p = kstParts(ms);
  const time = `${pad(p.hh)}:${pad(p.mm)}`;
  return lang === "en" ? `Opens ${MONTHS[p.m]} ${p.d} ${time} KST` : `${p.m + 1}/${p.d} ${time} 접수 시작`;
}

function checkedLabel(checkedOn, lang) {
  if (!checkedOn) return "";
  const shortDate = checkedOn.slice(5).replace("-", ".");
  return lang === "en" ? `${t("deadlineCheckedOn")} ${checkedOn.slice(5)}` : `${t("deadlineCheckedOn")} ${shortDate}`;
}

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/*
- 마감 임박 공지 창(표 형식)입니다. 긴 본문 스크롤, 두 줄 말줄임, 외부 링크가 필요해 HTML로 게임 위에 띄웁니다.
- 960x540 게임 화면 안에 맞추고, 화면 전체를 어두운 막으로 덮어 뒤쪽 게임 조작을 막습니다.
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

  const filterBar = el("div", "dl-filters");
  filterBar.setAttribute("role", "group");

  const body = el("div", "dl-body");
  const footer = el("p", "dl-footer");
  box.append(header, filterBar, body, footer);
  backdrop.append(box);
  document.body.append(backdrop);

  let open = false;
  let selectedCategory = "all";

  const renderFilters = () => {
    filterBar.setAttribute("aria-label", t("deadlineFilterLabel"));
    filterBar.replaceChildren();
    FILTERS.forEach(({ id, key }) => {
      const active = selectedCategory === id;
      const btn = el("button", `dl-filter-btn${active ? " active" : ""}`, t(key));
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(active));
      btn.addEventListener("click", () => {
        if (selectedCategory === id) return;
        selectedCategory = id;
        renderTable();
      });
      filterBar.append(btn);
    });
  };

  const renderRow = (item, lang, muted) => {
    const tr = el("tr", muted ? "dl-row-upcoming" : "");
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
    if (item.status === "upcoming") {
      const badge = el("span", "dl-tag upcoming", t("deadlineUpcoming"));
      const tip = startsAtTitle(item.startsAt, lang);
      if (tip) badge.title = tip;
      note.append(badge);
    }
    tr.append(note);

    const linkCell = el("td");
    const link = el("a", "dl-link", t("deadlineLink"));
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    linkCell.append(link);
    const checked = checkedLabel(item.checkedOn, lang);
    if (checked) {
      const meta = el("span", "dl-checked", checked);
      meta.title = item.checkedOn;
      linkCell.append(meta);
    }
    tr.append(linkCell);
    return tr;
  };

  const renderGroupSection = (rows, items, groupLabel, lang, muted) => {
    if (!items.length) return;
    const groupRow = el("tr", `dl-group-row${muted ? " upcoming" : ""}`);
    const th = el("th", "", groupLabel);
    th.colSpan = 5;
    th.scope = "colgroup";
    groupRow.append(th);
    rows.append(groupRow);
    items.forEach((item) => rows.append(renderRow(item, lang, muted)));
  };

  const renderTable = () => {
    const data = deadlineState.data;
    title.textContent = t("deadlineTitle");
    box.setAttribute("aria-label", t("deadlineTitle"));
    close.textContent = t("deadlineClose");
    footer.textContent = t("deadlineFooter");
    asOf.textContent = data ? asOfText(data) : t("deadlineLoading");
    renderFilters();
    body.replaceChildren();
    if (!data) return;

    if (!data.items.length) {
      const emptyBox = el("div", "dl-empty");
      emptyBox.append(el("p", "", t("deadlineEmpty")));
      const boardLink = el("a", "dl-empty-link", t("deadlineBoardLink"));
      boardLink.href = HUFS_NOTICE_BOARD_URL;
      boardLink.target = "_blank";
      boardLink.rel = "noopener noreferrer";
      emptyBox.append(boardLink);
      body.append(emptyBox);
      return;
    }

    const filtered = filterDeadlinesByCategory(data.items, selectedCategory);
    if (!filtered.length) {
      const emptyBox = el("div", "dl-empty");
      emptyBox.append(el("p", "", t("deadlineCategoryEmpty")));
      body.append(emptyBox);
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
    const { thisWeek, upcoming } = splitDeadlineGroups(filtered);
    renderGroupSection(rows, thisWeek, t("deadlineGroupThisWeek"), lang, false);
    renderGroupSection(rows, upcoming, t("deadlineGroupUpcoming"), lang, true);

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
    selectedCategory = "all";
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
      selectedCategory = "all";
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