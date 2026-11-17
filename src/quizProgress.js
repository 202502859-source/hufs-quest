// 퀴즈 출제 순서와 답 기록입니다.
// 재학생: 답을 서버(progressApi.answerQuiz)에 보내고, 정답 확인 · 경험치 · 하루 상한은 서버가 정합니다.
// 게스트: 서버를 부르지 않고 이번 접속 동안 메모리에만 기억합니다(경험치 없음).
import { QUIZ } from "./data/quiz.js";
import { answerQuiz } from "./data/progressApi.js";
import { applyProgress, isGuest, notifyReward, session } from "./state.js";

// 예전 버전이 브라우저에 남긴 기록 때문에 경험치가 계속 막히지 않도록 한 번 지웁니다.
try {
  localStorage.removeItem("hufs-quest-quiz-v1");
} catch {
  // 저장소를 쓸 수 없는 환경이면 지울 것도 없습니다.
}

// guestAnswered는 게스트가 푼 문제(처음 푼 순서), cycle은 모두 푼 뒤 다시 낼 차례입니다. 둘 다 저장하지 않습니다.
const local = { guestAnswered: [], cycle: 0 };

// 이미 푼 문제(처음 푼 순서). 재학생은 서버 기록(progress.quiz.answered)을 씁니다.
const answeredIds = () => (isGuest() ? local.guestAnswered : session.quiz?.answered ?? []);

// 다음 상자에 넣을 문제를 고릅니다. 아직 안 푼 문제를 무작위로 먼저 내고,
// 모두 푼 뒤에는 처음 푼 순서대로 다시 냅니다. exclude는 다른 상자에 이미 들어 있는 문제입니다.
export function nextQuestion(exclude = new Set()) {
  const answeredList = answeredIds();
  const answered = new Set(answeredList);
  const fresh = QUIZ.filter((q) => !answered.has(q.id) && !exclude.has(q.id));
  if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];

  const order = answeredList.filter((id) => QUIZ.some((q) => q.id === id));
  for (let i = 0; i < order.length; i++) {
    const id = order[local.cycle % order.length];
    local.cycle += 1;
    if (!exclude.has(id)) return QUIZ.find((q) => q.id === id);
  }
  return QUIZ[Math.floor(Math.random() * QUIZ.length)];
}

// 사용자가 고른 답(O = true, X = false)을 기록합니다.
// 결과: "ok" | "wrong" | "guest" | "already" | "cap" | "error"(서버에 저장하지 못함)
export async function recordAnswer(question, choice) {
  if (isGuest()) {
    if (!local.guestAnswered.includes(question.id)) local.guestAnswered.push(question.id);
    return choice === question.answer ? "guest" : "wrong";
  }
  try {
    const response = await answerQuiz(question.id, choice);
    applyProgress(response.progress);
    if (response.result === "ok") notifyReward(response.gained); // 퀴즈 창을 닫으면 HUD가 "+10 EXP"를 알립니다.
    return response.result;
  } catch (error) {
    // 경험치를 화면에서 임시로 주지 않고 "저장하지 못했어요"로 안내합니다(PROGRESS_API.md 결정 4).
    console.warn("[quiz] 답을 저장하지 못했습니다", error);
    return "error";
  }
}
