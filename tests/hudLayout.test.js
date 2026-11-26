// HUD 왼쪽 줄(일일 퀘스트 창 · 미니맵) 자리 계산(src/ui/hudLayout.js). 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { DAILY_FONT, DAILY_GAP, DAILY_STAMP_COUNT, MARGIN, MINIMAP, dailyPanelSize, hudLeftLayout, loadDailyCollapsed, saveDailyCollapsed } from "../src/ui/hudLayout.js";
import { WORLD_H, WORLD_W } from "../src/data/campusV2.js";
import { STAMP_RALLY_STOPS } from "../shared/stampRally.js";
import { stampText } from "../src/ui/stampMark.js";

const mapAspect = WORLD_H / WORLD_W;
const layout = (opts) => hudLeftLayout({ touch: false, guest: false, collapsed: false, screenH: 540, mapAspect, tabWidth: 110, ...opts });

test("미니맵 20% 축소: PC 264 → 211px, 휴대폰 220 → 176px, 세로는 맵 비율대로, 점 · 이름표도 줄임", () => {
  assert.equal(MINIMAP.pc.width, 211);
  assert.equal(MINIMAP.touch.width, 176);
  assert.equal(MINIMAP.pc.width, Math.round(264 * 0.8));
  assert.equal(MINIMAP.touch.width, Math.round(220 * 0.8));
  assert.equal(layout().minimap.mapH, Math.round(211 * mapAspect));
  assert.equal(layout({ touch: true }).minimap.mapH, Math.round(176 * mapAspect));
  assert.deepEqual([MINIMAP.pc.dot, MINIMAP.touch.dot], [1.2, 1], "점 · 위치 표시 1.5 → 1.2, 1.25 → 1.0");
  assert.ok(MINIMAP.pc.label >= 8 && MINIMAP.pc.label < 9 && MINIMAP.touch.label >= 8, "이름표는 읽히는 최소 크기(8px) 이상");
});

test("PC: 미니맵은 왼쪽 아래, 일일 퀘스트 창은 미니맵 바로 위에 같은 왼쪽 선 · 같은 폭 · 사이 4~6px, 상태창과 겹치지 않음", () => {
  for (const guest of [false, true]) {
    const { minimap, daily } = layout({ guest });
    assert.equal(minimap.y + minimap.panelH, 540 - MARGIN);
    assert.equal(daily.x, minimap.x);
    assert.equal(daily.w, minimap.panelW);
    const gap = minimap.y - (daily.y + daily.h);
    assert.ok(gap >= 4 && gap <= 6 && gap === DAILY_GAP, `사이 간격 ${gap}`);
    assert.ok(daily.y >= MARGIN + 84 + 4, `상태창(아래 끝 ${MARGIN + 84})과 겹침: ${daily.y}`);
  }
});

test("휴대폰: 상태창 → 일일 퀘스트 창 → 미니맵 순서(창은 미니맵 바로 위), 왼쪽 아래 이동 패드 위쪽에서 끝남", () => {
  for (const guest of [false, true]) {
    const { minimap, daily } = layout({ touch: true, guest });
    assert.equal(daily.x, minimap.x);
    assert.equal(minimap.y - (daily.y + daily.h), DAILY_GAP);
    assert.ok(daily.y >= MARGIN + (guest ? 58 : 84) + 4, "상태창 아래");
    // 이동 패드(가장 큰 경우: 화면 배율 0.6 → 칸 44px × 3)의 위 끝 540 − 12 − 132 = 396보다 위에서 미니맵이 끝남
    assert.ok(minimap.y + minimap.panelH <= 396, `미니맵 아래 끝 ${minimap.y + minimap.panelH}`);
    assert.ok(daily.w >= minimap.panelW, "오른쪽으로 펼쳐짐");
  }
});

test("접기 · 펴기: 접으면 제목 탭만 남고(왼쪽 선 그대로), 휴대폰은 미니맵이 그만큼 올라옴", () => {
  const open = layout();
  const closed = layout({ collapsed: true });
  assert.equal(closed.daily.rows, null);
  assert.equal(closed.daily.w, 110, "탭 너비 = 제목 글자 너비");
  assert.equal(closed.daily.h, closed.daily.tabH);
  assert.equal(closed.daily.x, open.daily.x);
  assert.equal(closed.daily.y + closed.daily.h + DAILY_GAP, closed.minimap.y, "접혀도 미니맵 바로 위");
  assert.ok(open.daily.h > closed.daily.h);
  const touchOpen = layout({ touch: true });
  const touchClosed = layout({ touch: true, collapsed: true });
  assert.ok(touchClosed.minimap.y < touchOpen.minimap.y);
});

test("도장 칸 4개가 창 안에 한 줄로 들어가고, 게스트는 맨 아래 안내 한 줄이 더 붙음", () => {
  assert.equal(DAILY_STAMP_COUNT, 4);
  assert.equal(STAMP_RALLY_STOPS.length, DAILY_STAMP_COUNT);
  for (const touch of [false, true]) {
    const student = dailyPanelSize({ touch, guest: false, collapsed: false, minimapPanelWidth: (touch ? 176 : 211) + 16, tabWidth: 110 });
    const guest = dailyPanelSize({ touch, guest: true, collapsed: false, minimapPanelWidth: (touch ? 176 : 211) + 16, tabWidth: 110 });
    const { x, y, radius, gap } = student.rows.stamps;
    const last = x + (DAILY_STAMP_COUNT - 1) * (radius * 2 + gap);
    assert.ok(x - radius >= 6 && last + radius <= student.w - 6, `도장 칸이 창(${student.w}px) 밖으로 나감`);
    assert.ok(y - radius >= student.tabH && y + radius < student.h);
    assert.equal(student.rows.note, null);
    assert.ok(guest.rows.note && guest.h > student.h);
    assert.ok(guest.rows.note.y + DAILY_FONT.note <= guest.h);
  }
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
