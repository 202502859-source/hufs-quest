// 퀴즈 기록은 경험치와 같이 이번 접속 동안만 기억합니다. 로그인과 서버 저장이 생기면 함께 옮길 것.
import { QUIZ } from "./data/quiz.js";
import { grantReward, isGuest } from "./state.js";

export const QUIZ_REWARD = 10;
export const QUIZ_DAILY_CAP = 50;

const today = () => new Date().toLocaleDateString("sv");

// 예전 버전이 브라우저에 남긴 기록 때문에 경험치가 계속 막히지 않도록 한 번 지웁니다.
try {
  localStorage.removeItem("hufs-quest-quiz-v1");
} catch {
  // 저장소를 쓸 수 없는 환경이면 지울 것도 없습니다.
}

// answered·cycle은 출제 순서용, rewarded·day·dayExp는 경험치 지급용입니다. 모두 메모리에만 둡니다.
const progress = { answered: [], cycle: 0, rewarded: [], day: today(), dayExp: 0 };

// 다음 상자에 넣을 문제를 고릅니다. 아직 안 푼 문제를 무작위로 먼저 내고,
// 모두 푼 뒤에는 처음 푼 순서대로 다시 냅니다. exclude는 다른 상자에 이미 들어 있는 문제입니다.
export function nextQuestion(exclude = new Set()) {
  const answered = new Set(progress.answered);
  const fresh = QUIZ.filter((q) => !answered.has(q.id) && !exclude.has(q.id));
  if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];

  const order = progress.answered.filter((id) => QUIZ.some((q) => q.id === id));
  for (let i = 0; i < order.length; i++) {
    const id = order[progress.cycle % order.length];
    progress.cycle += 1;
    if (!exclude.has(id)) return QUIZ.find((q) => q.id === id);
  }
  return QUIZ[Math.floor(Math.random() * QUIZ.length)];
}

// 답을 기록하고 경험치를 줍니다. 결과: "ok" | "wrong" | "guest" | "already" | "cap"
export function recordAnswer(question, correct) {
  if (!progress.answered.includes(question.id)) progress.answered.push(question.id);
  if (progress.day !== today()) {
    progress.day = today();
    progress.dayExp = 0;
  }

  if (!correct) return "wrong";
  if (isGuest()) return "guest";
  if (progress.rewarded.includes(question.id)) return "already";
  if (progress.dayExp + QUIZ_REWARD > QUIZ_DAILY_CAP) return "cap";
  grantReward(QUIZ_REWARD, 0);
  progress.rewarded.push(question.id);
  progress.dayExp += QUIZ_REWARD;
  return "ok";
}
