// 서버가 생기기 전까지 쓰는 "가짜 서버"입니다. docs/PROGRESS_API.md 4장의 서버 규칙을 메모리에서 똑같이 흉내 냅니다.
// 정답 확인 · 중복 지급 방지 · 하루 상한 · 한국 시간 자정 기준 · 출석 하루 1회를 모두 여기서 판단합니다.
// 화면 코드는 이 파일을 직접 부르지 않고 progressApi.js를 통해서만 씁니다. (테스트: tests/progressMock.test.js)
import { QUIZ } from "./quiz.js";
import {
  CHECKIN_POINTS,
  QUEST_REWARD,
  QUIZ_DAILY_CAP,
  QUIZ_REWARD_EXP,
  REWARD_QUESTS,
  kstToday,
  levelFromTotalExp,
} from "../../shared/progressRules.js";

// 서버가 HTTP 오류(400, 401, 500 …)로 답한 것과 같은 뜻의 오류입니다. status 0은 네트워크 오류입니다.
export class ProgressApiError extends Error {
  constructor(status, message = `progress api error ${status}`) {
    super(message);
    this.name = "ProgressApiError";
    this.status = status;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/*
 * seed: 강제로 재현할 상황 (주소의 ?mock=값)
 *   없음      새 계정 Lv.1 · 경험치 0 · 포인트 0
 *   "cap"     오늘 이미 퀴즈 5문제를 맞혀 하루 상한(50)에 도달한 계정 → 정답을 골라도 cap
 *   "already" 100문제 모두 예전에 보상을 받았고, 퀘스트 2개 완료, 오늘 출석도 받은 계정 → already
 * 꾸민 응답이 아니라 "그런 상태의 계정"으로 시작하므로 응답끼리 숫자가 항상 맞습니다.
 */
export function createMockServer({ now = () => new Date(), seed = null, questions = QUIZ } = {}) {
  const answers = new Map(questions.map((q) => [q.id, q.answer]));
  const db = {
    totalExp: 0,
    points: 0,
    completedQuests: [],
    answered: [], // 처음 푼 순서
    rewarded: new Map(), // 문제 ID → 보상 받은 날(한국 시간)
    lastCheckIn: null,
  };

  const today = () => kstToday(now());
  const todayExp = () => [...db.rewarded.values()].filter((day) => day === today()).length * QUIZ_REWARD_EXP;

  if (seed === "cap") {
    questions.slice(0, QUIZ_DAILY_CAP / QUIZ_REWARD_EXP).forEach((q) => {
      db.answered.push(q.id);
      db.rewarded.set(q.id, today());
      db.totalExp += QUIZ_REWARD_EXP;
    });
  } else if (seed === "already") {
    const pastDay = kstToday(new Date(now().getTime() - DAY_MS));
    questions.forEach((q) => {
      db.answered.push(q.id);
      db.rewarded.set(q.id, pastDay);
      db.totalExp += QUIZ_REWARD_EXP;
    });
    REWARD_QUESTS.forEach((id) => {
      db.completedQuests.push(id);
      db.totalExp += QUEST_REWARD.exp;
      db.points += QUEST_REWARD.points;
    });
    db.lastCheckIn = today();
    db.points += CHECKIN_POINTS;
  }

  // 공통 응답: 진행 상태 (PROGRESS_API.md 4장 progress)
  function progress() {
    const { level, exp, expMax } = levelFromTotalExp(db.totalExp);
    return {
      level,
      exp,
      expMax,
      points: db.points,
      completedQuests: [...db.completedQuests],
      quiz: {
        rewarded: [...db.rewarded.keys()],
        answered: [...db.answered],
        todayExp: todayExp(),
        dailyCap: QUIZ_DAILY_CAP,
      },
    };
  }

  // 경험치·포인트를 주고 레벨이 올랐는지 돌려줍니다.
  function grant(exp, points) {
    const before = levelFromTotalExp(db.totalExp).level;
    db.totalExp += exp;
    db.points += points;
    return levelFromTotalExp(db.totalExp).level > before;
  }

  const noGain = () => ({ exp: 0, points: 0 });

  return {
    // ① GET /api/progress
    getProgress() {
      return { progress: progress() };
    },

    // ② POST /api/quiz-answer  { questionId, choice }
    answerQuiz({ questionId, choice } = {}) {
      if (!answers.has(questionId) || typeof choice !== "boolean") throw new ProgressApiError(400, "unknown question or bad choice");
      if (!db.answered.includes(questionId)) db.answered.push(questionId);

      // 정답 여부는 화면이 보낸 값을 믿지 않고 quiz.js의 answer와 비교합니다.
      const correct = choice === answers.get(questionId);
      let result;
      if (!correct) result = "wrong";
      else if (db.rewarded.has(questionId)) result = "already";
      else if (todayExp() + QUIZ_REWARD_EXP > QUIZ_DAILY_CAP) result = "cap";
      else result = "ok";

      if (result !== "ok") return { result, correct, gained: noGain(), leveledUp: false, progress: progress() };
      db.rewarded.set(questionId, today());
      const leveledUp = grant(QUIZ_REWARD_EXP, 0);
      return { result, correct, gained: { exp: QUIZ_REWARD_EXP, points: 0 }, leveledUp, progress: progress() };
    },

    // ③ POST /api/quest-complete  { questId }
    completeQuest({ questId } = {}) {
      if (!REWARD_QUESTS.includes(questId)) throw new ProgressApiError(400, "unknown quest");
      if (db.completedQuests.includes(questId)) return { result: "already", gained: noGain(), leveledUp: false, progress: progress() };
      db.completedQuests.push(questId);
      const leveledUp = grant(QUEST_REWARD.exp, QUEST_REWARD.points);
      return { result: "ok", gained: { ...QUEST_REWARD }, leveledUp, progress: progress() };
    },

    // ④ POST /api/check-in  (본문 없음)
    checkIn() {
      if (db.lastCheckIn === today()) return { result: "already", gained: noGain(), progress: progress() };
      db.lastCheckIn = today();
      grant(0, CHECKIN_POINTS);
      return { result: "ok", gained: { exp: 0, points: CHECKIN_POINTS }, progress: progress() };
    },
  };
}
