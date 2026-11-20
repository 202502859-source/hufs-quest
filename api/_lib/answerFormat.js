/*
 * 검색창 답변 다듬기 (api/ask.js에서 씀). 네트워크를 부르지 않는 순수 함수만 둡니다.
 *
 * - stripListNumbers(text): 줄 맨 앞의 목록 번호("1. ", "2) ", "① ")를 지웁니다. 답변 규칙은 번호 없이 문장으로 쓰라고 하지만,
 *   모델이 지키지 않을 때를 대비해 서버에서 한 번 더 지웁니다(11/20 eval: 조기졸업 질문에서 "1. 2." 사용).
 * - dropInvalidCitations(text, docCount): 실제로 넘긴 자료 수(docCount)를 넘거나 0 이하인 인용 번호([4] 등)를 지웁니다.
 *   (11/20 eval: 자료 3개만 넘겼는데 [4][5][6] 인용)
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
