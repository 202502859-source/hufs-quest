/*
 * 화면 맨 위 검색창(src/ui/searchBar.js)의 자리 숫자(HUD 게임 좌표)입니다. 브라우저 코드 없이 숫자만 두어
 * HUD 배치 계산(src/ui/hudLayout.js)과 테스트가 같은 값을 씁니다.
 * 왼쪽 상태창(12~260)과 오른쪽 KO/EN 버튼 사이를 채웁니다.
 */
export const SEARCH_BAR = { left: 272, top: 12, height: 36, rightGap: 116, minTouchPx: 44 };

// 검색창 아래 끝(게임 좌표). 휴대폰은 실제 화면에서 44px(css) 이상이 되도록 높이를 키우므로,
// 게임 화면을 줄여 보여 주는 배율(displayScale = 화면 css 폭 / 게임 폭)로 나눠 게임 좌표로 바꿉니다.
export function searchBarBottom({ touch, displayScale = 1 }) {
  const height = Math.max(SEARCH_BAR.height, touch ? SEARCH_BAR.minTouchPx / (displayScale || 1) : 0);
  return SEARCH_BAR.top + height;
}
