/*
 * 게임 안 지도 신고 창("실제와 달라요 (신고)") — 건물 상세(officeOverlay.js)와 전체 지도(MapScene)에서 엽니다.
 * 11/26 PM 결정(이종헌): 구글 폼(REPORT_FORM_URL) 대신 게임 안 창으로 받습니다.
 *   - 진짜 로그인(AUTH_MODE real) + 토큰: 신고 폼(건물 · 무엇이 다른지 · 설명 · 근거 주소) → POST /api/map-report
 *   - 게스트 · 가짜 로그인: "로그인하고 제보하기" → 창을 닫고 onClose({ login: true })(CampusScene이 타이틀 로그인 창을 엶)
 * 행사 제보 폼(eventOverlay.js)과 같은 틀 · 스타일(src/ui/hudOverlay.js · hudOverlay.css)을 씁니다. 모든 글자는 textContent로만 넣습니다.
 * options.getReportMode · options.send는 화면 확인용으로 바꿔 끼울 수 있게 둔 것입니다(기본은 진짜 로그인 확인 · 서버 호출).
 */
import { MAP_REPORT_KINDS, MAP_REPORT_LIMITS, validateMapReport } from "../../shared/mapReport.js";
import { BUILDING_INFO, MAP_BASE_DATE } from "../data/buildingInfo.js";
import { currentReportMode } from "../data/eventReportApi.js";
import { buildMapReportPayload, mapProblemMessageKey, mapReportResultMessage, sendMapReport } from "../data/mapReportApi.js";
import { getLang, t } from "../state.js";
import { createHudOverlay, el } from "./hudOverlay.js";
import { reportEntryKind } from "./eventView.js";

const BUILDING_IDS = Object.keys(BUILDING_INFO);
const KIND_KEY = { location: "mapKindLocation", name: "mapKindName", hours: "mapKindHours", phone: "mapKindPhone", does: "mapKindDoes", other: "mapKindOther" };
const buildingName = (info, lang) => (lang === "en" && info.nameEn ? info.nameEn : info.name);

export function createMapReportOverlay(game, onClose, { getReportMode = currentReportMode, send = sendMapReport } = {}) {
  let overlay;
  let mode = null; // null(확인 중) · "app" · "link"
  let form = { buildingId: "", kind: "other", description: "", url: "" };
  let errors = {};
  let message = null;
  let sending = false;
  const redraw = () => overlay?.redraw();

  function field(labelKey, control, { required = false, errorField, wide = false, hint = null } = {}) {
    const error = errors[errorField];
    const wrap = el("label", `ho-field${wide ? " wide" : ""}${error ? " invalid" : ""}`);
    const label = el("span", "ho-field-label", `${t(labelKey)} `);
    label.append(el("span", "ho-field-mark", t(required ? "eventFormRequired" : "eventFormOptional")));
    wrap.append(label, control);
    if (hint) wrap.append(hint);
    if (error) {
      wrap.append(el("span", "ho-field-err", t(error)));
      control.setAttribute("aria-invalid", "true");
    }
    return wrap;
  }

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
    const payload = buildMapReportPayload(form);
    const checked = validateMapReport(payload, { buildingIds: BUILDING_IDS });
    if (!checked.ok) {
      errors = Object.fromEntries(checked.problems.map(({ field: f, code }) => [f, mapProblemMessageKey(code)]).reverse());
      message = { key: "eventReportFix", ok: false };
      redraw();
      return;
    }
    errors = {};
    message = null;
    sending = true;
    redraw();
    const { status, body } = await send(payload);
    sending = false;
    const result = mapReportResultMessage(status, body);
    message = result;
    errors = result.problems ? Object.fromEntries(result.problems.map(({ field: f, code }) => [f, mapProblemMessageKey(code)]).reverse()) : {};
    if (result.ok) form = { ...form, kind: "other", description: "", url: "" }; // 건물은 그대로 두고 비움
    if (status === 401) mode = await getReportMode().catch(() => "link");
    redraw();
  }

  function renderLogin(body) {
    const wrap = el("div", "ho-form-wrap");
    wrap.append(el("p", "ho-form-notice", t("mapReportLoginNeeded")));
    const button = el("button", "ho-mapbtn ho-report-open", t("eventReportLoginButton"));
    button.type = "button";
    button.addEventListener("click", () => overlay.hide({ login: true }));
    wrap.append(button);
    body.append(wrap);
  }

  function renderForm(body) {
    const lang = getLang();
    const wrap = el("div", "ho-form-wrap");
    wrap.append(el("p", "ho-form-notice", t("mapFormNotice")));
    const formEl = el("form", "ho-form");
    formEl.noValidate = true;
    formEl.addEventListener("submit", (event) => {
      event.preventDefault();
      submit();
    });

    const buildings = BUILDING_IDS.map((id) => [id, buildingName(BUILDING_INFO[id], lang)]);
    const kinds = MAP_REPORT_KINDS.map((k) => [k, t(KIND_KEY[k])]);
    const kindSelect = select("kind", kinds);
    // 전화번호가 다르다는 신고: 분류만 고르고 번호는 쓰지 않게 안내(번호를 쓰면 검사에서 거절)
    const phoneHint = el("span", "ho-field-hint", t("mapKindPhoneHint"));
    phoneHint.hidden = form.kind !== "phone";
    kindSelect.addEventListener("change", () => {
      phoneHint.hidden = kindSelect.value !== "phone";
    });

    const description = el("textarea", "ho-input");
    description.name = "description";
    description.rows = 3;
    description.maxLength = MAP_REPORT_LIMITS.description;
    description.placeholder = t("mapFormDescriptionHint");
    description.value = form.description;
    description.disabled = sending;
    description.addEventListener("input", () => {
      form.description = description.value;
    });

    const url = el("input", "ho-input");
    url.type = "url";
    url.name = "url";
    url.maxLength = MAP_REPORT_LIMITS.url;
    url.placeholder = "https://";
    url.value = form.url;
    url.disabled = sending;
    url.addEventListener("input", () => {
      form.url = url.value;
    });

    formEl.append(
      field("mapFormBuilding", select("buildingId", buildings), { required: true, errorField: "buildingId" }),
      field("mapFormKind", kindSelect, { required: true, errorField: "kind", hint: phoneHint }),
      field("mapFormDescription", description, { required: true, errorField: "description", wide: true }),
      field("mapFormUrl", url, { errorField: "url", wide: true }),
    );

    const actions = el("div", "ho-form-actions");
    const sendButton = el("button", "ho-submit", t(sending ? "eventFormSending" : "mapFormSubmit"));
    sendButton.type = "submit";
    sendButton.disabled = sending;
    actions.append(sendButton);
    if (message) {
      const msg = el("p", `ho-form-msg${message.ok ? " ok" : ""}`, t(message.key));
      msg.setAttribute("role", "status");
      actions.append(msg);
    }
    formEl.append(actions);
    wrap.append(formEl);
    body.append(wrap);
  }

  const render = ({ title, asOf, body, footer }) => {
    const [year, month] = MAP_BASE_DATE.split("-");
    title.textContent = t("mapReportTitle");
    asOf.textContent = t("mapBaseDate", { year, month: Number(month) });
    footer.textContent = t("mapReportFooter");
    if (mode === null) return;
    if (reportEntryKind(mode) === "form") renderForm(body);
    else renderLogin(body);
  };

  overlay = createHudOverlay(
    game,
    {
      closeKey: "deadlineClose",
      render,
      onShow: async () => {
        mode = await getReportMode().catch(() => "link");
      },
    },
    onClose,
  );

  return {
    isOpen: () => overlay.isOpen(),
    hide: (result) => overlay.hide(result),
    // placeId: 지금 보고 있는 건물(건물 상세) · 플레이어 근처 건물(전체 지도). 목록에 없으면 첫 건물.
    show(placeId) {
      form = { ...form, buildingId: BUILDING_INFO[placeId] ? placeId : (form.buildingId || BUILDING_IDS[0]) };
      if (placeId && BUILDING_INFO[placeId]) form.buildingId = placeId;
      errors = {};
      message = null;
      mode = null;
      return overlay.show();
    },
  };
}
