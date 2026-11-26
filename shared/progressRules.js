// PROGRESS_API.md 기준, 서버도 이 파일을 가져다 씀.
// 보상 값이나 하루 상한을 바꾸려면 docs/PROGRESS_API.md를 먼저 PR로 고친 뒤 이 파일을 고칩니다.
// 서버(api/*)와 화면(src/*)이 같은 값을 쓰도록, 이 파일에는 브라우저 전용 코드를 넣지 않습니다.

// 레벨 n에서 다음 레벨까지 필요한 경험치 = 10 × n (Lv.1 → 10, Lv.2 → 20, Lv.3 → 30 …). 2026-11-24 변경(이전: 레벨마다 100).
export const EXP_STEP = 10;
export const expToNextLevel = (level) => EXP_STEP * level;
// Lv.L에 처음 닿는 누적 경험치 = 10 × (1 + 2 + … + (L − 1)) = 5 · L · (L − 1)
export const totalExpForLevel = (level) => (EXP_STEP * level * (level - 1)) / 2;

// 퀴즈: 처음 맞힌 문제마다 경험치 10, 한국 시간 하루 50까지.
export const QUIZ_REWARD_EXP = 10;
export const QUIZ_DAILY_CAP = 50;

// 퀘스트 완료: 퀘스트마다 한 번, 경험치 10 · 포인트 10.
export const QUEST_REWARD = { exp: 10, points: 10 };

// 출석(하루 첫 접속): 한국 시간 하루 한 번 포인트 5.
export const CHECKIN_POINTS = 5;

// 행사 제보가 팀 확인(confirmed)되면 그 행사가 공개되기 전에 제보한 학생마다 1번(행사마다, 하루 상한 없음).
// 지급은 DB 트리거(supabase/009_event_report_rewards.sql)가 하므로 값을 바꾸면 그 파일의 v_exp도 같이 바꿉니다(tests/eventReward.test.js가 확인).
export const EVENT_REPORT_REWARD_EXP = 20;

// 완료 보상을 주는 퀘스트. mockReg(모의 수강신청)는 범위 밖이라 넣지 않습니다.
export const REWARD_QUESTS = ["doubleMajor", "stampRally"];

// 누적 경험치(total_exp)로 레벨을 계산합니다. 필요량에 "도달하면" 레벨업하고 남은 경험치는 이월합니다.
// level = 5·L·(L − 1) ≤ total인 가장 큰 L, exp = total − 5·L·(L − 1), expMax = 10·L
// 서버(api/*) · 가짜 진행 저장 · 게스트 모두 이 함수를 씁니다. DB에는 total_exp만 있어 규칙을 바꿔도 저장 데이터는 그대로입니다.
export function levelFromTotalExp(totalExp) {
  const total = Math.max(0, Math.floor(Number(totalExp) || 0));
  // 근의 공식으로 어림한 뒤 정수 계산으로 경계(예: 정확히 10, 30, 60)를 바로잡습니다.
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * total) / EXP_STEP)) / 2));
  while (totalExpForLevel(level + 1) <= total) level += 1;
  while (level > 1 && totalExpForLevel(level) > total) level -= 1;
  return { level, exp: total - totalExpForLevel(level), expMax: expToNextLevel(level) };
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // 한국은 서머타임이 없어 항상 UTC+9입니다.

// 한국 시간(Asia/Seoul) 기준 날짜를 "YYYY-MM-DD"로 돌려줍니다. 하루의 기준은 한국 시간 자정입니다.
export function kstToday(now = new Date()) {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
