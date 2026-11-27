// HUD 배치(src/ui/hudLayout.js): 오른쪽 위 미니맵 + 일일 퀘스트 창(11/27 PM 결정: 이종헌). 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_FONT,
  DAILY_GAP,
  DAILY_STAMP,
  DAILY_STAMP_COUNT,
  HUD_TOP_GAP,
  MARGIN,
  MINIMAP,
  PANEL_SHADOW,
  dailyPanelSize,
  hudButtonRowRect,
  hudSideLayout,
  langButtonsRect,
  loadDailyCollapsed,
  saveDailyCollapsed,
  statusRect,
} from "../src/ui/hudLayout.js";
import { SEARCH_BAR, searchBarBottom } from "../src/ui/searchBarLayout.js";
import { rectGap } from "../src/ui/firstScreen.js";
import { WORLD_H, WORLD_W } from "../src/data/campusV2.js";
import { STAMP_RALLY_STOPS } from "../shared/stampRally.js";
import { stampText } from "../src/ui/stampMark.js";

const mapAspect = WORLD_H / WORLD_W;
// PC 960×540, 지금 미리보기 700×657(PC 모드: 게임 960×540을 0.73배로 보임), 휴대폰 가로 844×390(게임 1169×540)
const SCREENS = [
  { name: "PC 960×540", W: 960, H: 540, touch: false, displayScale: 1 },
  { name: "미리보기 700×657", W: 960, H: 540, touch: false, displayScale: 700 / 960 },
  { name: "휴대폰 가로 844×390", W: 1169, H: 540, touch: true, displayScale: 844 / 1169 },
];
const CASES = [
  { guest: false, collapsed: false },
  { guest: false, collapsed: true },
  { guest: true, collapsed: false },
  { guest: true, collapsed: true },
];
const layout = (sc, c) => hudSideLayout({ ...sc, ...c, mapAspect, tabWidth: 110 });
const withShadow = (r) => ({ ...r, w: r.w + PANEL_SHADOW, h: r.h + PANEL_SHADOW });
const panels = (L) => [
  { name: "미니맵", ...withShadow({ x: L.minimap.x, y: L.minimap.y, w: L.minimap.panelW, h: L.minimap.panelH }) },
  { name: "일일 퀘스트 창", ...withShadow({ x: L.daily.x, y: L.daily.y, w: L.daily.w, h: L.daily.h }) },
];
const searchRect = (sc) => {
  const w = Math.max(160, sc.W - SEARCH_BAR.left - SEARCH_BAR.rightGap);
  return { x: SEARCH_BAR.left, y: SEARCH_BAR.top, w, h: searchBarBottom(sc) - SEARCH_BAR.top };
};

test("미니맵 10% 키움: PC 211 → 232px, 휴대폰 176 → 194px, 점 · 이름표는 그대로, 세로는 맵 비율대로", () => {
  assert.deepEqual([MINIMAP.pc.width, MINIMAP.touch.width], [232, 194]);
  assert.equal(MINIMAP.pc.width, Math.round(211 * 1.1));
  assert.equal(MINIMAP.touch.width, Math.round(176 * 1.1));
  assert.deepEqual([MINIMAP.pc.dot, MINIMAP.touch.dot, MINIMAP.pc.label, MINIMAP.touch.label], [1.2, 1, 8, 8]);
  for (const sc of SCREENS) assert.equal(layout(sc, CASES[0]).minimap.mapH, Math.round((sc.touch ? 194 : 232) * mapAspect));
});

test("오른쪽 위: 미니맵 오른쪽 선 = 화면 폭 − MARGIN, 위쪽 = 검색창 · KO/EN 아래 끝 + 8px, 일일 퀘스트 창은 미니맵 바로 아래(DAILY_GAP) · 오른쪽 선 같음", () => {
  for (const sc of SCREENS) {
    for (const c of CASES) {
      const L = layout(sc, c);
      const lang = langButtonsRect(sc.W);
      const bottom = Math.max(searchBarBottom(sc), lang.y + lang.h + PANEL_SHADOW);
      assert.equal(L.minimap.x + L.minimap.panelW, sc.W - MARGIN, sc.name);
      assert.equal(L.minimap.y, bottom + HUD_TOP_GAP, sc.name);
      assert.equal(L.daily.y, L.minimap.y + L.minimap.panelH + DAILY_GAP, sc.name);
      assert.equal(L.daily.x + L.daily.w, sc.W - MARGIN, `${sc.name}: 일일 퀘스트 창 오른쪽 선`);
    }
  }
  // 휴대폰은 검색창이 실제 화면 44px 이상이라 게임 좌표로 더 높음 → 미니맵도 그만큼 아래
  assert.ok(searchBarBottom(SCREENS[2]) > searchBarBottom(SCREENS[0]));
  assert.equal(searchBarBottom(SCREENS[2]), SEARCH_BAR.top + SEARCH_BAR.minTouchPx / (844 / 1169));
});

test("오른쪽 HUD가 질문창 · KO/EN 버튼 · 상태창과 안 겹침", () => {
  for (const sc of SCREENS) {
    for (const c of CASES) {
      for (const p of panels(layout(sc, c))) {
        for (const o of [{ name: "질문창", ...searchRect(sc) }, { name: "KO/EN", ...withShadow(langButtonsRect(sc.W)) }, { name: "상태창", ...statusRect(c.guest) }]) {
          assert.ok(rectGap(p, o) >= 0 && !(p.x < o.x + o.w && o.x < p.x + p.w && p.y < o.y + o.h && o.y < p.y + p.h), `${sc.name}: ${p.name}이(가) ${o.name}과(와) 겹침`);
        }
      }
    }
  }
});

test("펼친 · 접힌 일일 퀘스트 창이 오른쪽 아래 V · N 버튼 줄과 안 겹침(학생 · 게스트, 8px 여유)", () => {
  for (const sc of SCREENS) {
    const row = hudButtonRowRect(sc);
    for (const c of CASES) {
      for (const p of panels(layout(sc, c))) assert.ok(rectGap(p, row) >= 8, `${sc.name} ${c.guest ? "게스트" : "학생"} ${c.collapsed ? "접힘" : "펼침"}: ${p.name}과 버튼 줄 ${rectGap(p, row)}px`);
    }
  }
});

test("일일 퀘스트 창: PC · 휴대폰 모두 낮고 넓은 모양(도장 4칸이 글자 오른쪽 한 줄), 도장 크기는 PC 17 · 휴대폰 13, 접히면 오른쪽 끝에 탭만", () => {
  for (const touch of [false, true]) {
    for (const guest of [false, true]) {
      const minimapPanelWidth = (touch ? 194 : 232) + 16;
      const d = dailyPanelSize({ touch, guest, collapsed: false, minimapPanelWidth, tabWidth: 110 });
      const { x, y, radius, gap } = d.rows.stamps;
      assert.equal(radius, touch ? DAILY_STAMP.touch.radius : DAILY_STAMP.pc.radius);
      assert.equal(radius, touch ? 13 : 17);
      const last = x + (DAILY_STAMP_COUNT - 1) * (radius * 2 + gap);
      assert.ok(x - radius > d.rows.rallyLabel.x + 90, "도장이 글자 오른쪽에 있음");
      assert.ok(last + radius <= d.w - 6, `도장 칸이 창(${d.w}px) 밖으로 나감`);
      assert.ok(y - radius >= d.tabH && y + radius < d.rows.quizLabel.y, "도장 줄 아래에 일일 퀴즈 줄");
      assert.ok(d.w >= minimapPanelWidth, "창 폭이 미니맵 이상(넓으면 왼쪽으로 더 나감)");
      assert.equal(Boolean(d.rows.note), guest);
      assert.ok(!guest || d.rows.note.y + DAILY_FONT.note <= d.h);
    }
  }
  const L = layout(SCREENS[0], { guest: false, collapsed: true });
  assert.equal(L.daily.rows, null);
  assert.deepEqual([L.daily.w, L.daily.x + L.daily.w], [110, 960 - MARGIN], "접힌 탭은 오른쪽 선에 붙음");
});

test("글자 크기: 새 HUD 글자는 기존 HUD 작은 글자(12~13px) 이하", () => {
  assert.ok(DAILY_FONT.title <= 13 && DAILY_FONT.row <= 12 && DAILY_FONT.small <= 12 && DAILY_FONT.note >= 10);
});

test("도장 글자: PC 크기(반지름 17)는 약칭 전체(4자는 두 줄), 휴대폰 크기(반지름 13)는 첫 글자", () => {
  assert.deepEqual(stampText("도서관", 17).text, "도서관");
  assert.deepEqual(stampText("학생회관", 17).text, "학생\n회관");
  assert.deepEqual(stampText("본관", 17).text, "본관");
  assert.deepEqual(STAMP_RALLY_STOPS.map((s) => stampText(s.label.ko, 13).text), ["도", "학", "본", "인"]);
  for (const s of STAMP_RALLY_STOPS) assert.ok(stampText(s.label.ko, 17).size >= 8, s.label.ko);
});

test("접힘 상태 기억: 첫 방문은 펼침, 저장소가 고장 나도 오류 없이 동작", () => {
  const memory = new Map();
  const storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
  assert.equal(loadDailyCollapsed(storage), false);
  saveDailyCollapsed(true, storage);
  assert.equal(loadDailyCollapsed(storage), true);
  saveDailyCollapsed(false, storage);
  assert.equal(loadDailyCollapsed(storage), false);
  const broken = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(loadDailyCollapsed(broken), false);
  assert.doesNotThrow(() => saveDailyCollapsed(true, broken));
  assert.equal(loadDailyCollapsed(undefined), false);
});
