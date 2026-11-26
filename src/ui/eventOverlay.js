import { kstParts } from "../../shared/deadlineCalc.js";
import { EVENT_CATEGORIES, EVENT_WINDOW_DAYS } from "../../shared/eventCalc.js";
import { REPORT_LIMITS, validateEventReport } from "../../shared/eventReport.js";
import { BUILDING_INFO } from "../data/buildingInfo.js";
import { EVENT_REPORT_URL, SCHOOL_NOTICE_URL, eventState, refreshEvents } from "../data/eventsApi.js";
import {
  buildReportPayload,
  currentReportMode,
  kstDateOf,
  problemMessageKey,
  reportResultMessage,
  reportThreshold,
  sendEventReport,
} from "../data/eventReportApi.js";
import { getLang, t } from "../state.js";
import { createHudOverlay, el } from "./hudOverlay.js";
import { footerKey, reportLinkUrl, showOriginalNote, sourceBadgeText } from "./eventView.js";

const WEEKDAYS = { ko: ["일", "월", "화", "수", "목", "금", "토"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, "0");
const CATEGORY_KEY = { festival: "eventCatFestival", briefing: "eventCatBriefing", lecture: "eventCatLecture", recruit: "eventCatRecruit", other: "eventCatOther" };
const STATUS_KEY = { ongoing: "eventStatusOngoing", today: "eventStatusToday", upcoming: "eventStatusUpcoming" };
const BUILDING_IDS = Object.keys(BUILDING_INFO);

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

const buildingName = (info, lang) => (lang === "en" && info.nameEn ? info.nameEn : info.name);

const emptyForm = () => ({
  title: "",
  host: "",
  date: kstDateOf(Date.now()),
  startTime: "",
  endDate: "", // 비어 있으면 시작 날짜와 같은 날
  endTime: "",
  place: "",
  buildingId: "",
  category: "other",
  summary: "",
  url: "",
});

// 검사 결과(칸 · 코드) → 칸별 문구 키. 시각 오류(startsAt · endsAt)는 날짜 · 시각 칸 아래에 보여 줍니다.
const errorsFrom = (problems = []) => {
  const errors = {};
  for (const { field, code } of problems) if (!errors[field]) errors[field] = problemMessageKey(field, code);
  return errors;
};

/*
 * 학교 행사 창(표 형식). 출처 칸 맨 앞에는 출처 종류 배지(학교 공지 · 학생회·동아리 SNS · 주최 측 제공 · 학생 제보 R명)를 붙입니다.
 * 오늘부터 14일 안에 시작하거나 진행 중인 행사만, 시작 순으로 보여 줍니다(shared/eventCalc.js).
 * "지도에서 보기"를 누르면 창을 닫고 onClose({ showOnMap: buildingId })로 알립니다.
 *
 * "행사 제보하기"
 *   - 진짜 로그인(AUTH_MODE real) + 토큰 있음: 이 창 안에서 제보 폼을 엽니다(src/data/eventReportApi.js → POST /api/event-report).
 *   - 그 밖(로그인 안 함 · 가짜 로그인): "로그인하면 앱에서 바로 제보할 수 있어요" + 구글 폼 링크(EVENT_REPORT_URL).
 * 모든 글자는 textContent로만 넣습니다(제보 내용 · 서버 응답도 마찬가지).
 * options.getReportMode · options.send는 화면 확인용으로 바꿔 끼울 수 있게 둔 것입니다(기본은 진짜 로그인 확인 · 서버 호출).
 */
export function createEventOverlay(game, onClose, { getReportMode = currentReportMode, send: sendReport = sendEventReport } = {}) {
  let overlay;
  let mode = "link"; // "app" | "link" (창을 열 때마다 다시 확인)
  let view = "list"; // "list" | "form"
  let form = emptyForm();
  let errors = {};
  let message = null; // { key, vars, ok }
  let sending = false;

  const redraw = () => overlay?.redraw();

  // "행사 제보하기" 자리. 앱 제보면 폼 여는 버튼, 아니면 구글 폼 링크 + 안내. 링크 주소가 없으면 null.
  function reportEntry() {
    if (mode === "app") {
      const button = el("button", "ho-mapbtn ho-report-open", t("eventReportOpen"));
      button.type = "button";
      button.addEventListener("click", () => {
        view = "form";
        message = null;
        redraw();
      });
      return button;
    }
    const url = reportLinkUrl(EVENT_REPORT_URL);
    if (!url) return null;
    const wrap = el("span", "ho-report-event");
    wrap.append(link(url, t("eventReportLink")), el("span", "ho-report-note", t("eventReportNote")), el("span", "ho-report-note ho-report-hint", t("eventReportLoginHint")));
    return wrap;
  }

  function field(labelKey, control, { required = false, hintKey = null, errorField, wide = false } = {}) {
    const error = errors[errorField];
    const wrap = el("label", `ho-field${wide ? " wide" : ""}${error ? " invalid" : ""}`);
    const label = el("span", "ho-field-label", `${t(labelKey)} `);
    label.append(el("span", "ho-field-mark", t(required ? "eventFormRequired" : "eventFormOptional")));
    wrap.append(label, control);
    if (hintKey) wrap.append(el("span", "ho-field-hint", t(hintKey)));
    if (error) {
      wrap.append(el("span", "ho-field-err", t(error)));
      control.setAttribute("aria-invalid", "true");
    }
    return wrap;
  }

  const input = (name, type, { max, placeholder } = {}) => {
    const node = el("input", "ho-input");
    node.type = type;
    node.name = name;
    node.value = form[name];
    node.disabled = sending;
    if (max) node.maxLength = max;
    if (placeholder) node.placeholder = placeholder;
    node.addEventListener("input", () => {
      form[name] = node.value;
    });
    return node;
  };

  const select = (name, options) => {
    const node = el("select", "ho-input");
    node.name = name;
    node.disabled = sending;
    for (const [value, text] of options) {
      const option = el("option", "", text);
      option.value = value;
      node.append(option);
    }
    node.value = form[name];
    node.addEventListener("change", () => {
      form[name] = node.value;
    });
    return node;
  };

  async function submit() {
    if (sending) return;
    const payload = buildReportPayload(form);
    // 서버와 같은 규칙으로 먼저 검사(shared/eventReport.js)
    const checked = validateEventReport(payload, { nowMs: Date.now(), buildingIds: BUILDING_IDS });
    if (!checked.ok) {
      errors = errorsFrom(checked.problems);
      message = { key: "eventReportFix", vars: {}, ok: false };
      redraw();
      return;
    }
    errors = {};
    message = null;
    sending = true;
    redraw();
    const { status, body } = await sendReport(payload);
    sending = false;
    const result = reportResultMessage(status, body);
    message = result;
    errors = result.problems ? errorsFrom(result.problems) : {};
    if (result.ok) form = emptyForm();
    if (status === 401) mode = await getReportMode().catch(() => "link");
    redraw();
    if (result.published) {
      await refreshEvents();
      redraw();
    }
  }

  function renderForm(body) {
    const lang = getLang();
    const wrap = el("div", "ho-form-wrap");
    const back = el("button", "ho-mapbtn", t("eventFormBack"));
    back.type = "button";
    back.addEventListener("click", () => {
      view = "list";
      message = null;
      redraw();
    });
    wrap.append(back, el("h3", "ho-form-title", t("eventFormTitle")), el("p", "ho-form-notice", t("eventFormNotice", { threshold: reportThreshold() })));

    const formEl = el("form", "ho-form");
    formEl.noValidate = true;
    formEl.addEventListener("submit", (event) => {
      event.preventDefault();
      submit();
    });

    const now = Date.now();
    const dateInput = input("date", "date");
    dateInput.min = kstDateOf(now - DAY_MS);
    dateInput.max = kstDateOf(now + EVENT_WINDOW_DAYS * DAY_MS);
    const endDateInput = el("input", "ho-input");
    endDateInput.type = "date";
    endDateInput.name = "endDate";
    endDateInput.value = form.endDate || form.date;
    endDateInput.min = dateInput.min;
    endDateInput.disabled = sending;
    endDateInput.addEventListener("input", () => {
      form.endDate = endDateInput.value === form.date ? "" : endDateInput.value;
    });
    // 끝 날짜를 따로 바꾸지 않았으면 시작 날짜를 따라갑니다.
    dateInput.addEventListener("input", () => {
      if (!form.endDate) endDateInput.value = dateInput.value;
    });

    const summary = el("textarea", "ho-input");
    summary.name = "summary";
    summary.rows = 2;
    summary.maxLength = REPORT_LIMITS.summary;
    summary.value = form.summary;
    summary.disabled = sending;
    summary.addEventListener("input", () => {
      form.summary = summary.value;
    });

    const buildings = [["", t("eventFormBuildingNone")], ...BUILDING_IDS.map((id) => [id, buildingName(BUILDING_INFO[id], lang)])];
    const categories = EVENT_CATEGORIES.map((c) => [c, t(CATEGORY_KEY[c])]);

    formEl.append(
      field("eventFormName", input("title", "text", { max: REPORT_LIMITS.title }), { required: true, errorField: "title", wide: true }),
      field("eventFormHost", input("host", "text", { max: REPORT_LIMITS.host }), { hintKey: "eventFormHostHint", errorField: "host" }),
      field("eventFormCategory", select("category", categories), { required: true, errorField: "category" }),
      field("eventFormDate", dateInput, { required: true, errorField: "startsAt" }),
      field("eventFormStart", input("startTime", "time"), { required: true, errorField: "startsAt" }),
      field("eventFormEndDate", endDateInput, { required: true, errorField: "endsAt" }),
      field("eventFormEnd", input("endTime", "time"), { required: true, errorField: "endsAt" }),
      field("eventFormPlace", input("place", "text", { max: REPORT_LIMITS.place }), { required: true, errorField: "place" }),
      field("eventFormBuilding", select("buildingId", buildings), { errorField: "buildingId" }),
      field("eventFormSummary", summary, { required: true, errorField: "summary", wide: true }),
      field("eventFormUrl", input("url", "url", { max: REPORT_LIMITS.url, placeholder: "https://" }), { errorField: "url", wide: true }),
    );

    const actions = el("div", "ho-form-actions");
    const send = el("button", "ho-submit", t(sending ? "eventFormSending" : "eventFormSubmit"));
    send.type = "submit";
    send.disabled = sending;
    actions.append(send);
    if (message) {
      const msg = el("p", `ho-form-msg${message.ok ? " ok" : ""}`, t(message.key, message.vars));
      msg.setAttribute("role", "status");
      actions.append(msg);
    }
    formEl.append(actions);
    wrap.append(formEl);
    body.append(wrap);
  }

  const render = ({ title, asOf, body, footer }) => {
    const data = eventState.data;
    const lang = getLang();
    title.textContent = t("eventTitle", { days: EVENT_WINDOW_DAYS });
    footer.textContent = t(footerKey(data?.items));
    asOf.textContent = data ? asOfText(data) : t("deadlineLoading");
    if (view === "form" && mode === "app") {
      renderForm(body);
      return;
    }
    if (!data) return;
    const report = reportEntry();
    if (!data.items.length) {
      const empty = el("p", "ho-empty", `${t("eventEmpty")} `);
      empty.append(link(SCHOOL_NOTICE_URL, t("eventNoticeLink")));
      if (report) empty.append(el("br"), report);
      body.append(empty);
      return;
    }
    // 표 위 안내 줄(기준 시각 옆)
    if (report) asOf.append(" ", report);
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
      // 학생 제보는 원문(한국어) 그대로라 영어 화면에서 알려 줌
      if (showOriginalNote(item, lang)) titleCell.append(el("span", "ho-sub ho-original", t("eventCrowdOriginal")));
      const summary = el("span", "ho-sub ho-clamp", item.summary[lang]);
      summary.title = item.summary[lang];
      titleCell.append(summary);
      if (item.target) titleCell.append(el("span", "ho-sub", `${t("eventTarget")}: ${item.target[lang]}`));
      if (item.signup) titleCell.append(el("span", "ho-sub", `${t("eventSignup")}: ${item.signup[lang]}`));
      tr.append(titleCell);

      tr.append(el("td", "ho-muted", item.host?.[lang] ?? ""));
      tr.append(el("td", "", whenText(item, lang)));

      const placeCell = el("td", "", item.place[lang]);
      if (item.buildingId) {
        const button = el("button", "ho-mapbtn", t("eventShowOnMap"));
        button.type = "button";
        button.addEventListener("click", () => overlay.hide({ showOnMap: item.buildingId }));
        placeCell.append(el("br"), button);
      }
      tr.append(placeCell);

      // 출처: 종류 배지 → 원문 링크(있을 때) → 확인 날짜. 모르는 종류면 배지 없이
      const source = el("td");
      const badge = sourceBadgeText(item, t);
      if (badge) source.append(el("span", `ho-src ${item.sourceType}${item.confirmed ? " confirmed" : ""}`, badge));
      if (item.url) {
        if (badge) source.append(el("br"));
        source.append(link(item.url, t("eventSourceLink")));
      }
      source.append(el("span", "ho-sub", checkedText(item.checkedOn)));
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

  // 창을 열 때마다 최신 시간 기준으로 다시 계산하고, 로그인 상태(앱 제보 · 구글 폼)도 다시 확인합니다. 쓰던 제보 내용은 남겨 둡니다.
  const onShow = async () => {
    view = "list";
    message = null;
    const [, nextMode] = await Promise.all([refreshEvents(), getReportMode().catch(() => "link")]);
    mode = nextMode;
  };
  overlay = createHudOverlay(game, { closeKey: "deadlineClose", render, onShow }, onClose);
  return overlay;
}
