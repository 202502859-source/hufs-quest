/*
 * 검색창 답변 다듬기 (api/ask.js에서 씀). 네트워크를 부르지 않는 순수 함수만 둡니다.
 *
 * - stripListNumbers(text): 줄 맨 앞의 목록 번호("1. ", "2) ", "① ")를 지웁니다. 답변 규칙은 번호 없이 문장으로 쓰라고 하지만,
 *   모델이 지키지 않을 때를 대비해 서버에서 한 번 더 지웁니다(11/20 eval: 조기졸업 질문에서 "1. 2." 사용).
 * - dropInvalidCitations(text, docCount): 실제로 넘긴 자료 수(docCount)를 넘거나 0 이하인 인용 번호([4] 등)를 지웁니다.
 *   (11/20 eval: 자료 3개만 넘겼는데 [4][5][6] 인용)
 * - trimTruncated(text): 출력 토큰 상한에 걸려 끊긴 답을 마지막으로 끝난 문장(뒤에 붙은 인용 [n] 포함)까지만 남깁니다.
 *   끝난 문장이 하나도 없으면 sentences 0을 돌려주고, ask.js는 원문 보여 주기(evidence)로 바꿉니다.
 * - isRefusalAnswer(answer): 근거 번호 [n]이 하나도 없이 "찾지 못 · 공개되어 있지 않 …"처럼 거절만 하는 답인지.
 *   ask.js는 이런 답을 그대로 내보내지 않고 근거가 없을 때와 같은 "찾지 못함"(mode none)으로 바꿉니다.
 *   (11/26 eval: 셔틀버스 질문에 "정보는 공개되어 있지 않습니다. 담당 부서인 교무팀에 문의하시거나 'HUFS Dormitory' 앱에서
 *    확인하시기 바랍니다."라고 근거에 없는 부서 · 앱 이름을 지어냄)
 *
 * 테스트: tests/answerFormat.test.js (npm test)
 */

// 1~2자리 번호 + 뒤에 공백일 때만 번호로 봅니다. 줄 맨 앞의 "2026.03.02"나 "2025. " 같은 날짜 · 연도는 남깁니다.
const LIST_NUMBER = /^[ \t]*(?:\d{1,2}[.)]|[①-⑳])[ \t]+/gm;

export function stripListNumbers(text) {
  return String(text ?? "").replace(LIST_NUMBER, "");
}

// 지운 뒤 남는 "입니다 ." · 겹친 공백을 정리합니다. 지운 개수(dropped)는 로그용입니다.
export function dropInvalidCitations(text, docCount) {
  let dropped = 0;
  const cleaned = String(text ?? "")
    .replace(/[ \t]*\[(\d+)\]/g, (match, n) => {
      const index = Number(n);
      if (index >= 1 && index <= docCount) return match;
      dropped += 1;
      return "";
    })
    .replace(/[ \t]+([.,!?。])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "");
  return { text: cleaned, dropped };
}

// 문장 끝: 마침표 · 물음표 · 느낌표(뒤에 인용 [n]이 붙어도 됨) 다음에 공백이나 글 끝.
// 숫자 바로 뒤의 마침표("평점 4." · "2026.")는 숫자가 끊긴 것일 수 있어 문장 끝으로 보지 않습니다.
const SENTENCE_END = /(?:(?<!\d)\.|[!?。])(?:[ \t]*\[\d+\])*(?=\s|$)/g;

export function trimTruncated(text) {
  const source = String(text ?? "");
  let end = 0;
  let sentences = 0;
  for (const match of source.matchAll(SENTENCE_END)) {
    end = match.index + match[0].length;
    sentences += 1;
  }
  return { text: source.slice(0, end).trim(), sentences };
}

// 거절 표현(한국어 · 영어). 근거 번호가 없는 답에서만 봅니다.
// 11/27 "제공해 드릴 수 없" · "제공해 드리기 어렵" 추가(PM 승인: 이종헌. 11/26 셔틀 재확인 · 11/27 맛집 점검에서 근거 번호 없이 거절했는데 mode ai로 남음)
const REFUSAL = /찾지 못|찾을 수 없|공개되어 있지 않|공개되지 않|나와 있지 않|정보가 없|확인되지 않|제공해\s*드릴\s*수\s*없|제공해\s*드리기\s*어렵|couldn't find|could not find|not available|no information/i;
const CITATION = /\[\d+\]/;

// 근거 번호 [숫자]가 하나도 없고 거절 표현이 있으면 true. 근거를 인용한 답(일부만 "찾지 못했어요")은 false입니다.
export function isRefusalAnswer(answer) {
  const text = String(answer ?? "");
  return !CITATION.test(text) && REFUSAL.test(text);
}
