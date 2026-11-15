/*
 * AI NPC 목업입니다. 실제 AI를 호출하지 않고 미리 정해 둔 답변만 보여 줍니다.
 * 답변 내용의 출처: 학교 공식 페이지 "학사정보 > 학적 > 이중전공"
 * https://envi.hufs.ac.kr/hufs/11384/subview.do (2026-11-08 원문 확인)
 *
 * "학칙 제○조"는 실제 조항을 확인하지 못해 비워 둔 예시 표기입니다. 조 번호를 지어내지 말고,
 * 학칙 원문을 확인한 뒤 실제 번호로 바꾸세요.
 */
const DOUBLE_MAJOR_ANSWER = {
  answer: {
    ko: "이중전공은 2학년부터 시작하며, 1학년 과정이 끝나기 전에 학교 홈페이지 종합정보시스템에서 신청합니다.\n1학년 과정을 마치고 34학점 이상 취득한 학생을 우선 선발합니다(25학번 이후는 32학점 이상). 배정은 학과별 기준을 따릅니다.\n비사범대학 학생은 사범대학 각 학과의 전공을 이중전공으로 이수할 수 없습니다.",
    en: "A double major starts from the second year. Apply through the university's integrated information system before the first-year program ends.\nStudents with 34 or more credits after the first-year program get priority (32 or more from the 2025 entering class). Each department sets its own assignment criteria.\nStudents outside the College of Education cannot take its majors as a double major.",
  },
  evidence: {
    ko: "근거: 학칙 제○조 (예시) · 출처: 학사정보 > 학적 > 이중전공",
    en: "Evidence: University Regulations Art. ○ (example) · Source: Academics > Records > Double Major",
  },
};

export const EXAMPLE_QUESTION = { ko: "이중전공 신청 요건이 뭐야?", en: "What are the double major requirements?" };

export const AI_TEXT = {
  greeting: {
    ko: `궁금한 학사 제도를 물어보세요.\n시연판에는 예시 답변만 준비되어 있어요. 예: ${EXAMPLE_QUESTION.ko}`,
    en: `Ask me about academic rules.\nThis demo only has a sample answer. e.g. ${EXAMPLE_QUESTION.en}`,
  },
  thinking: { ko: "규정을 찾아보는 중…", en: "Looking up the rules…" },
  noAnswer: {
    ko: `시연판에는 이 질문의 답변이 준비되어 있지 않아요. 추측해서 답하지 않을게요.\n예시 질문: ${EXAMPLE_QUESTION.ko}`,
    en: `This demo has no answer for that question, and I won't guess.\nTry: ${EXAMPLE_QUESTION.en}`,
  },
  notice: {
    ko: "※ AI 답변은 참고용이며 최종 확인은 학교 공식 안내를 따르세요",
    en: "※ AI answers are for reference only. Always confirm with official university notices.",
  },
  placeholder: { ko: "질문을 입력하세요", en: "Type your question" },
  send: { ko: "보내기", en: "Send" },
  close: { ko: "닫기", en: "Close" },
};

// 이중전공 신청·요건을 묻는 질문에만 답합니다. 나머지는 답하지 않습니다.
export function findMockAnswer(question) {
  const q = question.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const isKorean = q.includes("이중전공") && /신청|요건|자격|조건/.test(q);
  const isEnglish = q.includes("doublemajor") && /apply|application|requirement|eligib|qualif/.test(q);
  return isKorean || isEnglish ? DOUBLE_MAJOR_ANSWER : null;
}
