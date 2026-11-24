import { BUILDING_INFO, MAP_BASE_DATE, REPORT_FORM_URL, SOURCES, officeSourceKeys, reportFormUrl } from "../data/buildingInfo.js";
import { isTouchDevice } from "../device.js";
import { getLang, t } from "../state.js";
import { createHudOverlay, el } from "./hudOverlay.js";
import { displayName, firstTel, floorLabel, groupByFloor, locationText } from "./officeView.js";

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
 * - 목록: 건물 이름 · 맵 기준일, 층별 묶음(높은 층 → 1층 → 로비층 → 지하 → 층 안내 없음), 항목마다 이름 + 위치 한 줄.
 *   여러 층에 걸친 항목은 각 층에 모두 보이고, 편의시설은 이름 뒤에 "(편의시설)"을 붙입니다.
 * - 상세: 위치 · 학교 전화 · 운영시간 · 하는 일 · 주요 기능 · 출처 · "실제와 달라요" 신고, 목록으로 돌아가기
 * 모든 글자는 textContent로만 넣습니다. 출처 url이 null(팀 확인)이면 링크 없이 제목만 보여 줍니다.
 */
export function createOfficeOverlay(game, onClose) {
  let overlay;
  let placeId = null;
  let selected = null; // 상세로 보고 있는 offices 번호. null이면 목록

  const renderList = ({ title, asOf, body, footer }, info, lang) => {
    title.textContent = buildingTitle(info, lang);
    asOf.textContent = baseDateText();
    footer.textContent = t("officeListHint");
    const suffix = t("officeAmenitySuffix");
    groupByFloor(info.offices).forEach(({ floor, items }) => {
      body.append(el("h3", "ho-group", floor ? floorLabel(floor, lang) : t("officeFloorNone")));
      const list = el("ul", "ho-offices");
      items.forEach(({ office, index }) => {
        const item = el("li");
        const button = el("button", "ho-office");
        button.type = "button";
        button.append(el("span", "ho-name", displayName(office, lang, suffix)), el("span", "ho-sub", locationText(office, lang) ?? t("officeNoLocation")));
        button.addEventListener("click", () => {
          selected = index;
          overlay.redraw();
        });
        item.append(button);
        list.append(item);
      });
      body.append(list);
    });
  };

  const row = (list, labelKey, value) => {
    list.append(el("dt", "", t(labelKey)));
    const dd = el("dd");
    if (value instanceof Node) dd.append(value);
    else dd.textContent = value;
    list.append(dd);
    return dd;
  };

  const renderDetail = ({ title, asOf, body, footer }, info, office, lang) => {
    title.textContent = displayName(office, lang, t("officeAmenitySuffix"));
    asOf.textContent = buildingTitle(info, lang);
    footer.textContent = t("officeHoursNote");

    const back = el("button", "ho-mapbtn ho-back", t("officeBack"));
    back.type = "button";
    back.addEventListener("click", () => {
      selected = null;
      overlay.redraw();
    });
    body.append(back);

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
    row(list, "officePhone", phones);
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
    const office = selected === null ? null : info.offices[selected];
    if (office) renderDetail(parts, info, office, lang);
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
      selected = null;
      return overlay.show();
    },
  };
}
