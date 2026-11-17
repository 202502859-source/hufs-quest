// PROGRESS_API.md 기준, 서버도 이 파일을 가져다 씀.
// 보상 값이나 하루 상한을 바꾸려면 docs/PROGRESS_API.md를 먼저 PR로 고친 뒤 이 파일을 고칩니다.
// 서버(api/*)와 화면(src/*)이 같은 값을 쓰도록, 이 파일에는 브라우저 전용 코드를 넣지 않습니다.

export const EXP_PER_LEVEL = 100;

// 퀴즈: 처음 맞힌 문제마다 경험치 10, 한국 시간 하루 50까지.
export const QUIZ_REWARD_EXP = 10;
export const QUIZ_DAILY_CAP = 50;

// 퀘스트 완료: 퀘스트마다 한 번, 경험치 10 · 포인트 10.
export const QUEST_REWARD = { exp: 10, points: 10 };

// 출석(하루 첫 접속): 한국 시간 하루 한 번 포인트 5.
export const CHECKIN_POINTS = 5;

// 완료 보상을 주는 퀘스트. mockReg(모의 수강신청)는 범위 밖이라 넣지 않습니다.
export const REWARD_QUESTS = ["doubleMajor", "stampRally"];

// 누적 경험치(total_exp)로 레벨을 계산합니다. level = floor(total / 100) + 1, exp = total % 100
export function levelFromTotalExp(totalExp) {
  return {
    level: Math.floor(totalExp / EXP_PER_LEVEL) + 1,
    exp: totalExp % EXP_PER_LEVEL,
    expMax: EXP_PER_LEVEL,
  };
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // 한국은 서머타임이 없어 항상 UTC+9입니다.

// 한국 시간(Asia/Seoul) 기준 날짜를 "YYYY-MM-DD"로 돌려줍니다. 하루의 기준은 한국 시간 자정입니다.
export function kstToday(now = new Date()) {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
