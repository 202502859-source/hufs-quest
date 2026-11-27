/*
 * HUD 배치(11/27 PM 결정: 이종헌)의 크기와 자리를 계산합니다. 그림 없이 숫자만 다뤄 테스트할 수 있습니다(tests/hudLayout.test.js).
 * - 왼쪽 위: 상태창(레벨 · 포인트 / 게스트 안내). 그대로.
 * - 오른쪽 위: 미니맵(오른쪽 선 = 화면 폭 − MARGIN, 위쪽 = 검색창 · KO/EN 버튼 아래 끝 + 8px),
 *   그 바로 아래(사이 DAILY_GAP) 일일 퀘스트 창(오른쪽 선을 미니맵과 맞춤, 펼치면 오른쪽 선은 그대로 두고 왼쪽으로 열림).
 *   PC · 휴대폰 모두 일일 퀘스트 창은 낮고 넓은 모양(도장 4칸을 글자 옆에) — 오른쪽 아래 버튼 줄(V · N)과 겹치지 않게.
 * - 오른쪽 아래: 버튼 줄(행사 V · 마감 공지 N). 휴대폰의 방향키 자리는 src/ui/firstScreen.js(첫 화면 기준)가 정합니다.
 * 검색창 숫자는 src/ui/searchBarLayout.js, 첫 화면 카메라 오프셋 · 방향키는 src/ui/firstScreen.js.
 */
import { searchBarBottom } from "./searchBarLayout.js";

export const MARGIN = 12;
export const PANEL_SHADOW = 4; // drawPanel 그림자(오른쪽 · 아래로 4px)

// 오른쪽 아래 아이콘 버튼 줄(행사 V · 마감 공지 N, HudScene.hudButtons). PC는 아이콘 아래 단축키 글자 때문에 바닥 여백이 더 큽니다.
// keys는 HudScene.hudButtons의 버튼 순서와 같아야 합니다(tests/campusGate.test.js가 이 값으로 버튼 줄 자리를 계산).
// 11/27: 퀘스트 버튼(Q)은 일일 퀘스트 창으로 대체해 빠졌습니다. badge: 배지가 아이콘 위로 나오는 높이.
export const HUD_BUTTON = { size: 64, inset: 16, insetWithKey: 30, gap: 12, keys: ["V", "N"], badge: 12 };
// 상태창(그림자 4px 별도): 재학생 248×84, 게스트 248×58
export const STATUS_PANEL = { w: 248, student: 84, guest: 58, shadow: 4 };
// KO/EN 버튼(src/ui/widgets.js addLangButtons): 44×32 두 개, 사이 4px, 오른쪽 위 MARGIN
export const LANG_BUTTONS = { w: 44, h: 32, gap: 4 };
// 터치 버튼이 실제 화면에서 최소 이 크기(css px)가 되도록 게임 안 크기를 키웁니다(48px + 여유).
export const MIN_TOUCH_PX = 52;

// 미니맵 가로(px, 세로는 맵 비율대로). 11/27: 20% 축소(PC 264 → 211, 휴대폰 220 → 176) 뒤 10% 키움(211 → 232, 176 → 194).
// dot: 점 · 위치 표시 배율, label: 건물 이름표 글자(8px, 읽히는 최소 크기).
export const MINIMAP = { pc: { width: 232, dot: 1.2, label: 8 }, touch: { width: 194, dot: 1, label: 8 } };
export const MINIMAP_PAD = 8; // 지도 둘레 여백
export const MINIMAP_FOOT = 36; // 지도 + 아래 "전체 지도 (M)" 줄까지의 덧높이(예전 40)
export const MINIMAP_BUTTON_FONT = 12; // "전체 지도 (M)" (예전 13)
export const HUD_TOP_GAP = 8; // 검색창 · KO/EN 버튼 아래 끝과 미니맵 사이

export const DAILY_GAP = 5; // 미니맵과 일일 퀘스트 창 사이
// 글자 크기(px). HUD의 작은 글자(12~13px: EXP · 게스트 안내 · 전체 지도 · 버튼 단축키)에 맞췄습니다.
export const DAILY_FONT = { title: 13, row: 12, small: 11, note: 10 };
// 도장 칸: PC는 약칭이 읽히는 크기(반지름 17), 휴대폰은 작게(반지름 13, 도장 안에는 약칭 첫 글자)
export const DAILY_STAMP = { pc: { radius: 17, gap: 10 }, touch: { radius: 13, gap: 5 } };
export const DAILY_STAMP_COUNT = 4;
const DAILY_TEXT_COL = 96; // 도장 왼쪽 글자 칸("스탬프 랠리" · "다음: 학생회관") 폭
const TAB_H = { pc: 22, touch: 20 };

// KO/EN 버튼 사각형(그림자 제외)
export const langButtonsRect = (W) => {
  const w = LANG_BUTTONS.w * 2 + LANG_BUTTONS.gap;
  return { x: W - MARGIN - w, y: MARGIN, w, h: LANG_BUTTONS.h };
};

// 오른쪽 아래 버튼 줄 사각형(배지 포함)
export function hudButtonRowRect({ W, H, touch }) {
  const { size, gap, inset, insetWithKey, keys, badge } = HUD_BUTTON;
  const x = W - inset - size * keys.length - gap * (keys.length - 1);
  const y = H - (touch ? inset : insetWithKey) - size - badge;
  return { x, y, w: W - x, h: H - y };
}

// 상태창 사각형(그림자 포함)
export const statusRect = (guest) => ({ x: 0, y: 0, w: MARGIN + STATUS_PANEL.w + STATUS_PANEL.shadow, h: MARGIN + (guest ? STATUS_PANEL.guest : STATUS_PANEL.student) + STATUS_PANEL.shadow });

/*
 * 일일 퀘스트 창의 크기와 안쪽 자리(창 왼쪽 위 기준). PC · 휴대폰 모두 낮고 넓은 모양:
 * [스탬프 랠리 / 다음: …] 옆에 도장 4칸, 아래 한 줄에 [일일 퀴즈 · 맞춘 정답]. 도장 크기만 기기별(DAILY_STAMP).
 * collapsed면 제목 탭만(가로 = tabWidth). guest면 맨 아래에 안내 한 줄이 더 붙습니다.
 */
export function dailyPanelSize({ touch, guest, collapsed, minimapPanelWidth, tabWidth }) {
  const tabH = touch ? TAB_H.touch : TAB_H.pc;
  if (collapsed) return { w: tabWidth, h: tabH, tabH, rows: null };
  const stamp = touch ? DAILY_STAMP.touch : DAILY_STAMP.pc;
  const stampsW = DAILY_STAMP_COUNT * stamp.radius * 2 + (DAILY_STAMP_COUNT - 1) * stamp.gap;
  // 글자 한 줄의 실제 높이(Galmuri11은 글자 크기보다 줄이 조금 높음)
  const LH = { row: DAILY_FONT.row + 4, small: DAILY_FONT.small + 3, note: DAILY_FONT.note + 3 };
  const noteH = guest ? LH.note + 3 : 0;
  // 미니맵보다 넓어야 하면 왼쪽으로 더 나갑니다(오른쪽 선은 미니맵과 같음).
  const w = Math.max(minimapPanelWidth, 8 + DAILY_TEXT_COL + 12 + stampsW + 10);
  const y0 = tabH + 4;
  const rallyH = Math.max(LH.row + LH.small, stamp.radius * 2 + 2);
  const quizY = y0 + rallyH + 3;
  const rows = {
    rallyLabel: { x: 8, y: y0 },
    next: { x: 8, y: y0 + LH.row },
    stamps: { x: w - 10 - stampsW + stamp.radius, y: y0 + rallyH / 2, ...stamp },
    rallyZone: { y: tabH, h: quizY - 1 - tabH },
    quizLabel: { x: 8, y: quizY },
    quizCount: { x: w - 8, y: quizY + 1, alignRight: true },
    quizZone: { y: quizY - 1, h: LH.row + 2 },
    note: guest ? { x: 8, y: quizY + LH.row + 2 } : null,
    shortNext: true, // "다음: 학생회관"처럼 약칭으로(도장 옆 칸이 좁음)
  };
  return { w, h: quizY + LH.row + 5 + noteH, tabH, rows };
}

/*
 * 오른쪽 위 HUD(미니맵 + 일일 퀘스트 창) 자리. 11/27 hudLeftLayout(왼쪽 줄)에서 바꿈.
 * W · H: 게임 화면 크기, displayScale: 화면 css 폭 / 게임 폭(휴대폰 검색창 최소 높이 계산), mapAspect = 맵 세로 / 가로.
 * 반환: { top, minimap: {x, y, mapW, mapH, panelW, panelH, dot, label}, daily: {x, y, w, h, tabH, rows, right} }
 */
export function hudSideLayout({ W, H, touch, guest, collapsed, displayScale = 1, mapAspect, tabWidth }) {
  const size = touch ? MINIMAP.touch : MINIMAP.pc;
  const mapW = size.width;
  const mapH = Math.round(mapW * mapAspect);
  const panelW = mapW + MINIMAP_PAD * 2;
  const panelH = mapH + MINIMAP_FOOT;
  const lang = langButtonsRect(W);
  const top = Math.max(searchBarBottom({ touch, displayScale }), lang.y + lang.h + PANEL_SHADOW) + HUD_TOP_GAP;
  const right = W - MARGIN;
  const daily = dailyPanelSize({ touch, guest, collapsed, minimapPanelWidth: panelW, tabWidth });
  return {
    top,
    screen: { W, H },
    minimap: { x: right - panelW, y: top, mapW, mapH, panelW, panelH, dot: size.dot, label: size.label },
    daily: { x: right - daily.w, y: top + panelH + DAILY_GAP, right, ...daily },
  };
}

// 접힘 상태 기억(localStorage). 저장소를 못 쓰는 환경이어도 동작합니다(첫 방문은 펼침).
const COLLAPSE_KEY = "hufs-quest-daily-collapsed";
export function loadDailyCollapsed(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}
export function saveDailyCollapsed(collapsed, storage = globalThis.localStorage) {
  try {
    storage?.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
    // 저장하지 못해도 이번 접속 동안은 그대로 동작합니다.
  }
}
