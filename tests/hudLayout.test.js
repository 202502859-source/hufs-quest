// HUD 배치(src/ui/hudLayout.js): 오른쪽 위 미니맵 + 일일 퀘스트 창(11/27 PM 결정: 이종헌). 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DAILY_BEFORE,
  DAILY_BODY_ALPHA,
  DAILY_FONT,
  DAILY_GAP,
  DAILY_SHRINK,
  DAILY_STAMP,
  DAILY_TAB_ALPHA,
  DAILY_TEXT_ALPHA,
  DAILY_TEXT_STROKE,
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

test("미니맵 7% 줄임(11/27 오후): PC 232 → 216px, 휴대폰 194 → 180px, 점 · 이름표는 그대로, 세로는 맵 비율대로", () => {
  assert.deepEqual([MINIMAP.pc.width, MINIMAP.touch.width], [216, 180]);
  assert.equal(MINIMAP.pc.width, Math.round(232 * 0.93));
  assert.equal(MINIMAP.touch.width, Math.round(194 * 0.93));
  assert.deepEqual([MINIMAP.pc.dot, MINIMAP.touch.dot, MINIMAP.pc.label, MINIMAP.touch.label], [1.2, 1, 8, 8]);
  for (const sc of SCREENS) assert.equal(layout(sc, CASES[0]).minimap.mapH, Math.round((sc.touch ? 180 : 216) * mapAspect));
});

test("일일 퀘스트 창 7% 줄임: 폭 · 높이 · 간격 · 도장 반지름(PC 17 → 16, 휴대폰 13 → 12), 글자는 최대 1px만 줄이고 10px 이상", () => {
  assert.equal(DAILY_SHRINK, 0.93);
  assert.deepEqual([DAILY_STAMP.pc.radius, DAILY_STAMP.touch.radius], [16, 12]);
  assert.deepEqual(DAILY_STAMP.pc.gap, Math.round(DAILY_BEFORE.stamp.pc.gap * 0.93));
  assert.equal(DAILY_GAP, Math.round(DAILY_BEFORE.gap * 0.93));
  for (const [key, before] of Object.entries(DAILY_BEFORE.font)) {
    assert.ok(DAILY_FONT[key] >= 10 && before - DAILY_FONT[key] <= 1 && DAILY_FONT[key] <= before, `${key}: ${before} → ${DAILY_FONT[key]}`);
  }
  // 예전 크기(7% 줄이기 전: PC 292×86 · 게스트 102, 휴대폰 245×78 · 게스트 94)의 93% ± 2px
  const BEFORE = { pc: { w: 292, h: 86, hGuest: 102 }, touch: { w: 245, h: 78, hGuest: 94 } };
  for (const touch of [false, true]) {
    const mini = (touch ? MINIMAP.touch.width : MINIMAP.pc.width) + 16;
    const d = dailyPanelSize({ touch, guest: false, collapsed: false, minimapPanelWidth: mini, tabWidth: 110 });
    const g = dailyPanelSize({ touch, guest: true, collapsed: false, minimapPanelWidth: mini, tabWidth: 110 });
    const b = touch ? BEFORE.touch : BEFORE.pc;
    assert.ok(Math.abs(d.w - b.w * 0.93) <= 2, `폭 ${b.w} → ${d.w}`);
    assert.ok(Math.abs(d.h - b.h * 0.93) <= 2 && d.h < b.h, `높이 ${b.h} → ${d.h}`);
    assert.ok(Math.abs(g.h - b.hGuest * 0.93) <= 2 && g.h < b.hGuest, `게스트 높이 ${b.hGuest} → ${g.h}`);
  }
});

test("펼친 창 모양: 제목 탭은 불투명, 본문 바탕만 반투명(0.55), 글자 · 도장은 불투명 + 1px 어두운 테두리. HudScene이 이 상수를 씀", () => {
  assert.equal(DAILY_BODY_ALPHA, 0.55);
  assert.equal(DAILY_TAB_ALPHA, 1);
  assert.equal(DAILY_TEXT_ALPHA, 1);
  assert.deepEqual(DAILY_TEXT_STROKE, { color: "#0a1020", px: 1 });
  const hud = readFileSync(new URL("../src/scenes/HudScene.js", import.meta.url), "utf8");
  assert.match(hud, /fillStyle\(COLOR\.fill, DAILY_BODY_ALPHA\)/, "본문 바탕이 DAILY_BODY_ALPHA로 칠해짐");
  assert.match(hud, /drawPanel\(g, -w, 0, w, tabH, \{ border: COLOR\.line, alpha: DAILY_TAB_ALPHA \}\)/, "제목 탭은 DAILY_TAB_ALPHA");
  assert.match(hud, /strokeThickness: DAILY_TEXT_STROKE\.px \* 2/);
  assert.match(hud, /\.setAlpha\(DAILY_TEXT_ALPHA\)/);
  // 상세 창(본문을 눌렀을 때)은 그대로: questOverlay는 이 상수를 쓰지 않음
  const overlay = readFileSync(new URL("../src/ui/questOverlay.js", import.meta.url), "utf8");
  assert.doesNotMatch(overlay, /DAILY_BODY_ALPHA|opacity/);
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

test("일일 퀘스트 창: PC · 휴대폰 모두 낮고 넓은 모양(도장 4칸이 글자 오른쪽 한 줄), 도장 크기는 PC 16 · 휴대폰 12, 접히면 오른쪽 끝에 탭만", () => {
  for (const touch of [false, true]) {
    for (const guest of [false, true]) {
      const minimapPanelWidth = (touch ? MINIMAP.touch.width : MINIMAP.pc.width) + 16;
      const d = dailyPanelSize({ touch, guest, collapsed: false, minimapPanelWidth, tabWidth: 110 });
      const { x, y, radius, gap } = d.rows.stamps;
      assert.equal(radius, touch ? DAILY_STAMP.touch.radius : DAILY_STAMP.pc.radius);
      assert.equal(radius, touch ? 12 : 16);
      const last = x + (DAILY_STAMP_COUNT - 1) * (radius * 2 + gap);
      assert.ok(x - radius > d.rows.rallyLabel.x + 80, "도장이 글자 오른쪽에 있음");
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

test("도장 글자: PC 크기(반지름 16)는 약칭 전체(4자는 두 줄), 휴대폰 크기(반지름 12)는 첫 글자", () => {
  assert.deepEqual(stampText("도서관", 16).text, "도서관");
  assert.deepEqual(stampText("학생회관", 16).text, "학생\n회관");
  assert.deepEqual(stampText("본관", 16).text, "본관");
  assert.deepEqual(STAMP_RALLY_STOPS.map((s) => stampText(s.label.ko, 12).text), ["도", "학", "본", "인"]);
  for (const s of STAMP_RALLY_STOPS) assert.ok(stampText(s.label.ko, 16).size >= 8, s.label.ko);
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
