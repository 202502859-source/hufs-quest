/*
 * 검색창 답변 다듬기 (api/ask.js에서 씀). 네트워크를 부르지 않는 순수 함수만 둡니다.
 *
 * - stripListNumbers(text): 줄 맨 앞의 목록 번호("1. ", "2) ", "① ")를 지웁니다. 답변 규칙은 번호 없이 문장으로 쓰라고 하지만,
 *   모델이 지키지 않을 때를 대비해 서버에서 한 번 더 지웁니다(11/20 eval: 조기졸업 질문에서 "1. 2." 사용).
 * - dropInvalidCitations(text, docCount): 실제로 넘긴 자료 수(docCount)를 넘거나 0 이하인 인용 번호([4] 등)를 지웁니다.
 *   (11/20 eval: 자료 3개만 넘겼는데 [4][5][6] 인용)
 * - trimTruncated(text): 출력 토큰 상한에 걸려 끊긴 답을 마지막으로 끝난 문장(뒤에 붙은 인용 [n] 포함)까지만 남깁니다.
 *   끝난 문장이 하나도 없으면 sentences 0을 돌려주고, ask.js는 원문 보여 주기(evidence)로 바꿉니다.
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
