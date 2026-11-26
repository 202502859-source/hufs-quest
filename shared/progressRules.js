// PROGRESS_API.md 기준, 서버도 이 파일을 가져다 씀.
// 보상 값이나 하루 상한을 바꾸려면 docs/PROGRESS_API.md를 먼저 PR로 고친 뒤 이 파일을 고칩니다.
// 서버(api/*)와 화면(src/*)이 같은 값을 쓰도록, 이 파일에는 브라우저 전용 코드를 넣지 않습니다.

// 레벨 n에서 다음 레벨까지 필요한 경험치 = 10 × n (Lv.1 → 10, Lv.2 → 20, Lv.3 → 30 …). 2026-11-24 변경(이전: 레벨마다 100).
export const EXP_STEP = 10;
export const expToNextLevel = (level) => EXP_STEP * level;
// Lv.L에 처음 닿는 누적 경험치 = 10 × (1 + 2 + … + (L − 1)) = 5 · L · (L − 1)
export const totalExpForLevel = (level) => (EXP_STEP * level * (level - 1)) / 2;

// 퀴즈: 처음 맞힌 문제마다 경험치 10, 한국 시간 하루 100까지(하루 10문제 × 10). 2026-11-27 변경(이전: 50).
export const QUIZ_REWARD_EXP = 10;
export const QUIZ_DAILY_CAP = 100;

// 일일 퀴즈(일일 퀘스트): 오늘(한국 날짜) 경험치를 받은 정답이 DAILY_QUIZ_GOAL개가 되면 하루 한 번 보너스 경험치.
export const DAILY_QUIZ_GOAL = 10;
export const DAILY_QUIZ_BONUS_EXP = 50;

// 캠퍼스 스탬프 랠리(일일 퀘스트): 오늘 부스 4곳(shared/stampRally.js) 스탬프를 다 모으면 하루 한 번 완주 보상.
// 스탬프 자체는 경험치가 없습니다(reward_log source 'stamp', exp 0).
export const STAMP_RALLY_REWARD = { exp: 50, points: 10 };

// 퀘스트 완료: 퀘스트마다 한 번, 경험치 10 · 포인트 10.
export const QUEST_REWARD = { exp: 10, points: 10 };

// 출석(하루 첫 접속): 한국 시간 하루 한 번 포인트 5.
export const CHECKIN_POINTS = 5;

// 행사 제보가 팀 확인(confirmed)되면 그 행사가 공개되기 전에 제보한 학생마다 1번(행사마다, 하루 상한 없음).
// 지급은 DB 트리거(supabase/009_event_report_rewards.sql)가 하므로 값을 바꾸면 그 파일의 v_exp도 같이 바꿉니다(tests/eventReward.test.js가 확인).
export const EVENT_REPORT_REWARD_EXP = 20;

// 지도 신고("실제와 달라요")가 반영(accepted)되면 신고마다 1번(서로 다른 신고는 제한 없음).
// 지급은 DB 트리거(supabase/010_map_reports.sql)가 하므로 값을 바꾸면 그 파일의 v_exp도 같이 바꿉니다(tests/mapReport.test.js가 확인).
export const MAP_REPORT_REWARD_EXP = 20;

// 한 번만 완료하는(영구) 보상 퀘스트. mockReg(모의 수강신청)는 범위 밖이라 넣지 않습니다.
// 11/27: stampRally는 일일 퀘스트(DAILY_QUESTS)로 옮겼습니다. 11/24 이전에 저장된 날짜 없는 "stampRally" 완료 기록은
// DB에 그대로 두고, 서버 응답 completedQuests에서는 뺍니다(api/_lib/progressServer.js).
export const REWARD_QUESTS = ["doubleMajor"];

// 일일 퀘스트: 완료 기록 id에 한국 날짜를 붙여(예: "stampRally:2026-11-27") 하루 한 번, 다음 날 다시 받습니다.
// 조건(스탬프 4곳 · 정답 10개)은 서버가 직접 확인합니다(api/quest-complete.js).
export const DAILY_QUESTS = ["stampRally", "dailyQuiz"];
export const dailyQuestKey = (questId, kstDate) => `${questId}:${kstDate}`;
// 일일 퀘스트의 완료 기록인지(날짜가 붙은 것 + 11/24 이전의 날짜 없는 옛 기록)
export const isDailyQuestRecord = (recordId) => DAILY_QUESTS.includes(String(recordId).split(":")[0]);
export const dailyQuestReward = (questId) =>
  questId === "stampRally" ? { ...STAMP_RALLY_REWARD } : questId === "dailyQuiz" ? { exp: DAILY_QUIZ_BONUS_EXP, points: 0 } : null;

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
