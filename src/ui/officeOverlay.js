import { BUILDING_INFO, MAP_BASE_DATE, REPORT_FORM_URL, SOURCES, officeSourceKeys, reportFormUrl } from "../data/buildingInfo.js";
import { isTouchDevice } from "../device.js";
import { getLang, t } from "../state.js";
import { createHudOverlay, el } from "./hudOverlay.js";
import { ROOT_VIEW, backView, childLabel, crumbs, displayName, firstTel, floorLabel, groupByFloor, locationText, openChild, openItem, resolveView } from "./officeView.js";

const newTabLink = (href, text, className = "ho-link") => {
  const a = el("a", className, text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
};

const buildingTitle = (info, lang) => (lang === "en" && info.nameEn ? info.nameEn : info.name);

// "2026년 11월 기준 캠퍼스"(전체 지도와 같은 문구)
const baseDateText = () => {
  const [year, month] = MAP_BASE_DATE.split("-");
  return t("mapBaseDate", { year, month: Number(month) });
};

/*
 * 건물 입구에서 여는 사무실 · 시설 안내 창입니다. 행사 · 퀘스트 창과 같은 틀(hudOverlay.js)을 씁니다.
 * - 목록: 건물 이름 · 맵 기준일, 맨 위 건물 전체 안내(top) → 층별 묶음(지하 → 라운지층 → 1층 → … → 건물 밖 → 층 안내 없음), 항목마다 이름 + 위치 한 줄.
 *   여러 층에 걸친 항목은 각 층에 모두 보이고, 편의시설은 이름 뒤에 "(편의시설)"을 붙입니다.
 * - 묶음 항목(children: 동아리방 · 단과대학): 누르면 하위 목록(호실 오름차순, "그림촌(312호)") → 하위 상세.
 *   위쪽에 지금 위치 한 줄("국제학사 및 학생회관 › 3층 › 동아리방"), "뒤로"는 한 단계씩, ESC는 창 전체를 닫음.
 * - 상세: 위치 · 학교 전화 · 운영시간 · 하는 일 · 주요 기능 · 출처 · "실제와 달라요" 신고, 뒤로 가기
 * 모든 글자는 textContent로만 넣습니다. 출처 url이 null(팀 확인)이면 링크 없이 제목만 보여 줍니다.
 */
export function createOfficeOverlay(game, onClose) {
  let overlay;
  let placeId = null;
  let view = ROOT_VIEW; // 지금 보는 화면(officeView.js resolveView)

  const renderList = ({ title, asOf, body, footer }, info, lang) => {
    title.textContent = buildingTitle(info, lang);
    asOf.textContent = baseDateText();
    footer.textContent = t("officeListHint");
    const suffix = t("officeAmenitySuffix");
    groupByFloor(info.offices).forEach(({ top, floor, items }) => {
      // 건물 전체 안내(top)는 묶음 제목 없이 맨 위에 둡니다.
      if (!top) body.append(el("h3", "ho-group", floor ? floorLabel(floor, lang) : t("officeFloorNone")));
      const list = el("ul", "ho-offices");
      items.forEach(({ office, index }) => {
        const item = el("li");
        const button = el("button", "ho-office");
        button.type = "button";
        // 묶음 항목은 위치 대신 "동아리방 13곳"처럼 하위 개수를, 끝에 ›를 붙여 누르면 목록이 열린다는 것을 보여 줍니다.
        const sub = office.children ? (office.does[lang] ?? office.does.ko) : locationText(office, lang) ?? t("officeNoLocation");
        button.append(el("span", "ho-name", `${displayName(office, lang, suffix)}${office.children ? " ›" : ""}`), el("span", "ho-sub", sub));
        button.addEventListener("click", () => {
          view = openItem(info.offices, index);
          overlay.redraw();
        });
        item.append(button);
        list.append(item);
      });
      body.append(list);
    });
  };

  const backButton = (body, label) => {
    const back = el("button", "ho-mapbtn ho-back", label);
    back.type = "button";
    back.addEventListener("click", () => {
      view = backView(view);
      overlay.redraw();
    });
    body.append(back);
  };

  // 하위 목록(동아리 · 학과): 호실 오름차순, "그림촌(312호)" + 활동내용 또는 전화
  const renderGroup = ({ title, asOf, body, footer }, info, parent, children, lang) => {
    title.textContent = displayName(parent, lang, t("officeAmenitySuffix"));
    asOf.textContent = crumbs(buildingTitle(info, lang), info.offices, view, lang);
    footer.textContent = t("officeListHint");
    backButton(body, t("officeBack"));
    const list = el("ul", "ho-offices");
    children.forEach((child, index) => {
      const item = el("li");
      const button = el("button", "ho-office");
      button.type = "button";
      const sub = child.phone?.[0] ?? child.does[lang] ?? child.does.ko;
      button.append(el("span", "ho-name", childLabel(child, lang)), el("span", "ho-sub", sub));
      button.addEventListener("click", () => {
        view = openChild(view, index);
        overlay.redraw();
      });
      item.append(button);
      list.append(item);
    });
    body.append(list);
  };

  const row = (list, labelKey, value) => {
    list.append(el("dt", "", t(labelKey)));
    const dd = el("dd");
    if (value instanceof Node) dd.append(value);
    else dd.textContent = value;
    list.append(dd);
    return dd;
  };

  const renderDetail = ({ title, asOf, body, footer }, info, office, parent, lang) => {
    title.textContent = displayName(office, lang, t("officeAmenitySuffix"));
    asOf.textContent = crumbs(buildingTitle(info, lang), info.offices, view, lang);
    footer.textContent = t("officeHoursNote");
    // 하위 상세에서는 한 단계 위(동아리방 · 단과대학 목록)로, 그 밖에는 층별 목록으로
    backButton(body, parent ? `← ${displayName(parent, lang, t("officeAmenitySuffix"))}` : t("officeBack"));

    const list = el("dl", "ho-detail");
    row(list, "officeLocation", locationText(office, lang) ?? t("officeNoLocation"));

    // 휴대폰에서는 첫 번호로 전화를 걸 수 있게 tel: 링크, 표시는 근거에 적힌 그대로
    const phones = el("span");
    if (office.phone?.length) {
      office.phone.forEach((number, i) => {
        if (i) phones.append(el("br"));
        const tel = isTouchDevice() ? firstTel(number) : null;
        if (tel) {
          const a = el("a", "ho-link", number);
          a.href = tel;
          phones.append(a);
        } else {
          phones.append(document.createTextNode(number));
        }
      });
    } else {
      phones.textContent = t("officeNone");
    }
    // 학교 번호(02-2173- · 02-6235-)만이면 "학교 전화", 가게 번호(88p 직통 · 0507)가 섞이면 "전화"
    const schoolOnly = office.phone?.length && office.phone.every((number) => /^02-(2173|6235)-/.test(number));
    row(list, schoolOnly || !office.phone?.length ? "officePhone" : "officePhoneOther", phones);
    row(list, "officeHours", office.hours?.[lang] ?? office.hours?.ko ?? t("officeNone"));
    row(list, "officeDoes", office.does[lang] ?? office.does.ko);

    const lines = office.details?.[lang] ?? office.details?.ko;
    if (lines?.length) {
      const ul = el("ul", "ho-lines");
      lines.forEach((line) => ul.append(el("li", "", line)));
      row(list, "officeDetails", ul);
    }

    const sources = el("span");
    officeSourceKeys(office)
      .map((key) => SOURCES[key])
      .filter(Boolean)
      .forEach((source, i) => {
        if (i) sources.append(el("br"));
        sources.append(source.url ? newTabLink(source.url, `${source.title} ↗`) : el("span", "ho-muted", source.title));
      });
    row(list, "officeSource", sources);
    body.append(list);

    if (REPORT_FORM_URL) body.append(newTabLink(reportFormUrl(placeId), t("mapReport"), "ho-mapbtn ho-report"));
  };

  const render = (parts) => {
    const info = BUILDING_INFO[placeId];
    const lang = getLang();
    if (!info) return;
    const resolved = resolveView(info.offices, view);
    if (resolved.kind === "detail") renderDetail(parts, info, resolved.office, resolved.parent, lang);
    else if (resolved.kind === "group") renderGroup(parts, info, resolved.parent, resolved.children, lang);
    else renderList(parts, info, lang);
    parts.body.scrollTop = 0;
  };

  overlay = createHudOverlay(game, { closeKey: "deadlineClose", render }, onClose);
  return {
    isOpen: overlay.isOpen,
    hide: overlay.hide,
    // 건물 id를 받아 목록 화면부터 엽니다.
    show(id) {
      placeId = id;
      view = ROOT_VIEW;
      return overlay.show();
    },
  };
}
