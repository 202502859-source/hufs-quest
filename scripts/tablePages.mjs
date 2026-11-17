// 표 정리 조각을 만들 학사 페이지 목록입니다. collect.mjs가 이 페이지들에 대해
// 기존 조각과 함께 '조건이 모두 들어간 문장' 조각(id: <페이지>-t01 …)을 추가로 만듭니다.
//
// kind   : tableSentences.mjs의 문장 틀 이름
// tables : 문장으로 만들 표 순서(0부터). "all"이면 페이지의 모든 표
// skip   : 만들지 않을 표와 그 이유 (검수 파일과 collect 로그에 표시)
// fixes  : 칸 안 줄바꿈 때문에 끊긴 낱말을 붙이는 규칙 [원문, 바꿀 말]. 숫자·조건은 바꾸지 않습니다.
// 새 페이지를 추가하면 npm.cmd test, npm.cmd run collect를 다시 실행하고 data/table-check.md를 검수하세요.

const WORD_FIXES = [
  ["사범 대학", "사범대학"],
  ["이중 전공", "이중전공"],
  ["구 분", "구분"],
  ["합 계", "합계"],
];

export const TABLE_PAGES = {
  11373: {
    kind: "graduation",
    tables: "all",
    fixes: WORD_FIXES,
    reviewNotes: [
      { match: "사범대학", note: "사범대학 행의 교양 값(16·18·20·22)이 다른 행(32)과 다릅니다. 원문 표의 칸 위치 그대로 읽은 값이니 원문과 꼭 대조해 주세요." },
    ],
  },
  11388: { kind: "transfer", tables: [0], fixes: WORD_FIXES },
  11391: { kind: "completion", tables: [0], fixes: WORD_FIXES },
  11386: {
    kind: "linked",
    tables: [0],
    fixes: WORD_FIXES,
    skip: { 1: "머리글이 '2006학번 이전 / 2007학번 이전'으로 두 열 모두 '이전'이라 원문 확인이 필요함" },
  },
};
