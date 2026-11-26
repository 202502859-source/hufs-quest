/*
 * HUD 왼쪽 줄(상태창 · 일일 퀘스트 창 · 미니맵)의 크기와 자리를 계산합니다. 그림 없이 숫자만 다뤄 테스트할 수 있습니다(tests/hudLayout.test.js).
 * - PC: 미니맵은 왼쪽 아래, 일일 퀘스트 창은 미니맵 바로 위(같은 왼쪽 선, 사이 5px).
 * - 휴대폰: 이동 패드가 왼쪽 아래라 위에서부터 상태창 → 일일 퀘스트 창 → 미니맵 순서(창은 미니맵 바로 위, 같은 왼쪽 선).
 *   세로 공간이 좁아 일일 퀘스트 창은 낮고 넓은 모양(오른쪽으로 펼침)입니다.
 */
export const MARGIN = 12;

// 미니맵 가로(px, 세로는 맵 비율대로). 11/27: 20% 축소(PC 264 → 211, 휴대폰 220 → 176).
// dot: 점 · 위치 표시 배율(1.5 → 1.2, 1.25 → 1.0), label: 건물 이름표 글자(9px → 8px, 읽히는 최소 크기).
export const MINIMAP = { pc: { width: 211, dot: 1.2, label: 8 }, touch: { width: 176, dot: 1, label: 8 } };
export const MINIMAP_PAD = 8; // 지도 둘레 여백
export const MINIMAP_FOOT = 36; // 지도 + 아래 "전체 지도 (M)" 줄까지의 덧높이(예전 40)
export const MINIMAP_BUTTON_FONT = 12; // "전체 지도 (M)" (예전 13)
const STATUS_BOTTOM = { student: 96, guest: 70 }; // 휴대폰에서 상태창 아래 다음 요소가 시작하는 간격

export const DAILY_GAP = 5; // 일일 퀘스트 창과 미니맵 사이
// 글자 크기(px). HUD의 작은 글자(12~13px: EXP · 게스트 안내 · 전체 지도 · 버튼 단축키)에 맞췄습니다.
export const DAILY_FONT = { title: 13, row: 12, small: 11, note: 10 };
// 도장 칸: PC는 약칭이 읽히는 크기(반지름 17), 휴대폰은 세로 공간이 좁아 작게(반지름 13, 도장 안에는 약칭 첫 글자)
export const DAILY_STAMP = { pc: { radius: 17, gap: 10 }, touch: { radius: 13, gap: 5 } };
export const DAILY_STAMP_COUNT = 4;
const TAB_H = { pc: 22, touch: 20 };

/*
 * 일일 퀘스트 창의 크기와 안쪽 자리(창 왼쪽 위 기준).
 * collapsed면 제목 탭만(가로 = tabWidth). guest면 맨 아래에 안내 한 줄이 더 붙습니다.
 */
export function dailyPanelSize({ touch, guest, collapsed, minimapPanelWidth, tabWidth }) {
  const tabH = touch ? TAB_H.touch : TAB_H.pc;
  if (collapsed) return { w: tabWidth, h: tabH, tabH, rows: null };
  const stamp = touch ? DAILY_STAMP.touch : DAILY_STAMP.pc;
  const stampsW = DAILY_STAMP_COUNT * stamp.radius * 2 + (DAILY_STAMP_COUNT - 1) * stamp.gap;
  const noteH = guest ? DAILY_FONT.note + 4 : 0;
  if (touch) {
    // 낮고 넓게: [스탬프 랠리 / 다음: …] 옆에 도장 4칸, 아래 한 줄에 [일일 퀴즈 · 맞춘 정답]
    const w = Math.max(minimapPanelWidth, 228);
    const rows = {
      rallyLabel: { x: 8, y: tabH + 5 },
      next: { x: 8, y: tabH + 5 + DAILY_FONT.row + 3 },
      stamps: { x: w - 10 - stampsW + stamp.radius, y: tabH + 5 + 14, ...stamp },
      rallyZone: { y: tabH, h: 5 + 28 + 2 },
      quizLabel: { x: 8, y: tabH + 5 + 28 + 4 },
      quizCount: { x: w - 8, y: tabH + 5 + 28 + 4 + 1, alignRight: true },
      quizZone: { y: tabH + 5 + 28 + 2, h: 4 + 13 + 3 },
      note: guest ? { x: 8, y: tabH + 5 + 28 + 4 + 13 + 4 } : null,
      shortNext: true, // "다음: 학생회관"처럼 약칭으로(도장 옆 칸이 좁음)
    };
    return { w, h: tabH + 5 + 28 + 4 + 13 + 6 + noteH, tabH, rows };
  }
  // PC: 미니맵과 같은 폭, 위에서 아래로 [스탬프 랠리 → 도장 4칸 → 다음: …] [일일 퀴즈 → 맞춘 정답]
  const w = minimapPanelWidth;
  const y0 = tabH + 6;
  const stampsY = y0 + 14 + 3 + stamp.radius;
  const nextY = stampsY + stamp.radius + 4;
  const quizY = nextY + 13 + 7;
  const countY = quizY + 14 + 1;
  const rows = {
    rallyLabel: { x: 10, y: y0 },
    stamps: { x: Math.round((w - stampsW) / 2) + stamp.radius, y: stampsY, ...stamp },
    next: { x: 10, y: nextY },
    rallyZone: { y: tabH, h: quizY - 4 - tabH },
    quizLabel: { x: 10, y: quizY },
    quizCount: { x: 10, y: countY, alignRight: false },
    quizZone: { y: quizY - 4, h: 4 + 14 + 1 + 13 + 4 },
    note: guest ? { x: 10, y: countY + 13 + 4 } : null,
    shortNext: false,
  };
  return { w, h: countY + 13 + 7 + noteH, tabH, rows };
}

/*
 * 왼쪽 줄 전체 자리. mapAspect = 맵 세로 / 가로. 반환: { minimap: {x, y, mapW, mapH, panelW, panelH, dot, label}, daily: {x, y, w, h, tabH, rows} }
 */
export function hudLeftLayout({ touch, guest, collapsed, screenH, mapAspect, tabWidth }) {
  const size = touch ? MINIMAP.touch : MINIMAP.pc;
  const mapW = size.width;
  const mapH = Math.round(mapW * mapAspect);
  const panelW = mapW + MINIMAP_PAD * 2;
  const panelH = mapH + MINIMAP_FOOT;
  const daily = dailyPanelSize({ touch, guest, collapsed, minimapPanelWidth: panelW, tabWidth });
  let minimapY;
  let dailyY;
  if (touch) {
    dailyY = MARGIN + (guest ? STATUS_BOTTOM.guest : STATUS_BOTTOM.student);
    minimapY = dailyY + daily.h + DAILY_GAP;
  } else {
    minimapY = screenH - MARGIN - panelH;
    dailyY = minimapY - DAILY_GAP - daily.h;
  }
  return {
    minimap: { x: MARGIN, y: minimapY, mapW, mapH, panelW, panelH, dot: size.dot, label: size.label },
    daily: { x: MARGIN, y: dailyY, ...daily },
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
