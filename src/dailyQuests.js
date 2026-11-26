// 일일 퀘스트(캠퍼스 스탬프 랠리 · 일일 퀴즈)의 화면 쪽 로직입니다. 그림은 없고 상태만 다룹니다(테스트: tests/dailyQuests.test.js).
// 재학생: 부스 답 · 완주 · 보너스를 서버(progressApi)에 보내고, 응답(progress.daily)으로 session.daily를 덮어씁니다.
// 게스트: 서버를 부르지 않고 이번 접속 동안 메모리(session.daily)에만 기억합니다. 경험치는 없습니다.
// 하루의 기준은 한국 시간 자정입니다(shared/progressRules.js kstToday).
import { DAILY_QUIZ_BONUS_EXP, STAMP_RALLY_REWARD, kstToday } from "../shared/progressRules.js";
import { STAMP_RALLY_IDS, boothQuestionFor, gradeBooth, nextRallyStop, rallyComplete } from "../shared/stampRally.js";
import { answerBooth, completeQuest, getProgress } from "./data/progressApi.js";
import { applyProgress, emptyDaily, isGuest, notifyReward, session } from "./state.js";

export { STAMP_RALLY_REWARD, DAILY_QUIZ_BONUS_EXP };

// 서버 통로. 테스트에서는 가짜를 넣어 호출 여부를 확인합니다.
const realApi = { answerBooth, completeQuest, getProgress };

// 게스트가 오늘 맞힌 문제(같은 문제는 한 번만 셈). 날짜가 바뀌면 비웁니다.
const guest = { date: null, correct: new Set() };

// 오늘의 상태. 게스트는 한국 날짜가 바뀌었으면 여기서 0으로 되돌립니다.
export function dailyState(now = new Date()) {
  const today = kstToday(now);
  if (isGuest() && session.daily.date !== today) {
    session.daily = emptyDaily(today);
    guest.date = today;
    guest.correct.clear();
  }
  return session.daily;
}

// 오늘 이 부스에서 낼 문제(없으면 null = 준비 중). 화면 날짜는 서버가 준 날짜(session.daily.date)를 따릅니다.
export const todayBoothQuestion = (buildingId, now = new Date()) => boothQuestionFor(buildingId, dailyState(now).date);
export const hasStamp = (buildingId) => session.daily.stamps.includes(buildingId);
export const nextStop = () => nextRallyStop(session.daily.stamps);
export const stampCount = () => session.daily.stamps.length;
export const STAMP_TOTAL = STAMP_RALLY_IDS.length;

/*
 * 부스에서 보기를 골랐을 때.
 * 결과: { result: "ok" | "already" | "wrong" | "error", count, completedNow, gained }
 * - ok: 스탬프를 새로 받음. 4번째면 바로 완주를 요청해 completedNow: true(재학생은 gained에 완주 보상).
 * - 오답은 벌점이 없고 몇 번이든 다시 풀 수 있습니다.
 */
export async function submitBoothAnswer(buildingId, choiceIndex, { now = new Date(), api = realApi } = {}) {
  const none = { exp: 0, points: 0 };
  if (isGuest()) {
    const daily = dailyState(now);
    const correct = gradeBooth(buildingId, daily.date, choiceIndex);
    if (correct === null) return { result: "error", count: daily.stamps.length, completedNow: false, gained: none };
    if (!correct) return { result: "wrong", count: daily.stamps.length, completedNow: false, gained: none };
    if (daily.stamps.includes(buildingId)) return { result: "already", count: daily.stamps.length, completedNow: false, gained: none };
    daily.stamps = STAMP_RALLY_IDS.filter((id) => id === buildingId || daily.stamps.includes(id));
    const completedNow = rallyComplete(daily.stamps) && !daily.rallyDone;
    if (completedNow) daily.rallyDone = true;
    return { result: "ok", count: daily.stamps.length, completedNow, gained: none };
  }
  try {
    const response = await api.answerBooth(buildingId, choiceIndex);
    applyProgress(response.progress);
    let completedNow = false;
    let gained = none;
    // 4번째 스탬프 직후 자동으로 완주를 요청합니다. 조건은 서버가 다시 확인합니다.
    if (response.result === "ok" && rallyComplete(session.daily.stamps) && !session.daily.rallyDone) {
      try {
        const done = await api.completeQuest("stampRally");
        applyProgress(done.progress);
        completedNow = done.result === "ok";
        if (completedNow) gained = done.gained;
      } catch (error) {
        console.warn("[daily] 랠리 완주를 저장하지 못했습니다", error);
      }
    }
    return { result: response.result, count: session.daily.stamps.length, completedNow, gained };
  } catch (error) {
    console.warn("[daily] 부스 답을 저장하지 못했습니다", error);
    return { result: "error", count: session.daily.stamps.length, completedNow: false, gained: none };
  }
}

// 스탬프를 다 모았는데 완주 기록이 없으면(완주 요청이 실패했던 경우) 다시 요청합니다. 재학생만.
export async function retryRallyComplete({ api = realApi } = {}) {
  if (isGuest() || !rallyComplete(session.daily.stamps) || session.daily.rallyDone) return false;
  try {
    const done = await api.completeQuest("stampRally");
    applyProgress(done.progress);
    if (done.result === "ok") notifyReward(done.gained, "rallyComplete");
    return done.result === "ok";
  } catch {
    return false;
  }
}

/*
 * O/X 퀴즈 답을 기록한 직후(src/quizProgress.js)에 부릅니다. result는 recordAnswer의 결과입니다.
 * - 게스트: 처음 맞힌 문제면 오늘 정답 수를 1 올립니다(메모리).
 * - 재학생: 정답 수는 서버 응답으로 이미 반영돼 있습니다. 10번째 정답 직후면 보너스를 자동으로 요청합니다.
 * 보너스를 새로 받았으면 true.
 */
export async function afterQuizAnswer(questionId, result, { now = new Date(), api = realApi } = {}) {
  if (isGuest()) {
    const daily = dailyState(now);
    if (result === "guest" && !guest.correct.has(questionId)) {
      guest.correct.add(questionId);
      daily.quizCorrect = Math.min(guest.correct.size, daily.quizGoal);
      if (daily.quizCorrect >= daily.quizGoal) daily.quizBonusDone = true;
    }
    return false;
  }
  const daily = session.daily;
  if (daily.quizCorrect < daily.quizGoal || daily.quizBonusDone) return false;
  try {
    const done = await api.completeQuest("dailyQuiz");
    applyProgress(done.progress);
    if (done.result === "ok") notifyReward(done.gained, "dailyQuizBonus"); // HUD가 "일일 퀴즈 완료! 보너스 +50 EXP"로 알립니다.
    return done.result === "ok";
  } catch (error) {
    console.warn("[daily] 일일 퀴즈 보너스를 저장하지 못했습니다", error);
    return false;
  }
}

/*
 * 게임을 켜 둔 채 한국 시간 자정을 넘겼는지 확인합니다(HUD가 30초마다 부름 → 1분 안에 0으로 바뀜).
 * 날짜가 바뀌었으면 게스트는 메모리를 비우고, 재학생은 진행 상태를 다시 불러옵니다. 바뀌었으면 true.
 */
export async function refreshDailyIfNewDay({ now = new Date(), api = realApi } = {}) {
  const today = kstToday(now);
  if (session.daily.date === today) return false;
  if (isGuest()) {
    dailyState(now);
    return true;
  }
  try {
    const { progress } = await api.getProgress();
    applyProgress(progress);
    return true;
  } catch {
    return false; // 다음 확인 때 다시 시도합니다.
  }
}

// 테스트용: 게스트 메모리를 비웁니다.
export function resetGuestDaily() {
  guest.date = null;
  guest.correct.clear();
}
