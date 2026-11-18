// 기능 켜고 끄기. 본선(11/16~12/9) 범위 밖 기능은 화면에서 숨깁니다(docs/PRD.md 3장 "하지 않을 것").
//
// SHOW_OUT_OF_SCOPE = false → 숨김:
//   - HUD의 "수강신청 추천 서비스" 버튼(본관 근처에서 보이던 것)과 그 창(src/ui/plannerOverlay.js, public/planner/)
//   - "모의 수강신청 도전" 퀘스트(src/state.js의 id "mockReg")와 미니게임(src/scenes/MockRegScene.js) 진입
// true로 바꾸면 예전처럼 다시 보입니다. 숨김 대상 파일 자체는 고치지 않고 그대로 둡니다.
export const SHOW_OUT_OF_SCOPE = false;
