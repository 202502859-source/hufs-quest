// eval 채점 도우미(scripts/eval.mjs에서 씀). 네트워크를 부르지 않는 순수 함수만 둡니다.
// 테스트: scripts/lib/evalGrade.test.mjs (npm test)

// 원래부터 거절로 본 표현. 답에 숫자가 있어도 거절로 봅니다(예: "2027학년도 일정은 찾지 못했어요").
const CORE_REFUSAL = /찾지 못|찾을 수 없|couldn't find|could not find/i;

// 11/21 eval: 셔틀버스 질문에 "…정보는 공개되지 않았습니다. …담당 부서에 문의하시기 바랍니다."라고 거절했는데
// "지어냄"으로 채점됨. 이런 표현도 거절로 보되, 지어낸 숫자를 함께 말하는 답은 거절로 치지 않도록
// 이 표현들은 답에 숫자(인용 번호 [1] 제외)가 없을 때만 인정합니다.
const EXTRA_REFUSAL = /공개되지 않|확인할 수 없|확인되지 않|안내되어 있지 않|정보가 없|not publicly available|unable to find|cannot confirm|could not confirm/i;

// 범위 밖 질문의 답이 "거절"인지. mode none(서버가 AI를 부르지 않음)이면 거절입니다.
export function isRefusal(answer, mode) {
  if (mode === "none") return true;
  const text = String(answer ?? "");
  if (CORE_REFUSAL.test(text)) return true;
  const hasNumber = /\d/.test(text.replace(/\[\d+\]/g, ""));
  return EXTRA_REFUSAL.test(text) && !hasNumber;
}
