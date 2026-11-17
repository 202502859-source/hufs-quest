// 표 정리 조각을 만들 학사 페이지 목록입니다. collect.mjs가 이 페이지들에 대해
// 기존 조각과 함께 '조건이 모두 들어간 문장' 조각(id: <페이지>-t01 …)을 추가로 만듭니다.
//
// kind   : tableSentences.mjs의 문장 틀 이름
// tables : 문장으로 만들 표 순서(0부터). "all"이면 페이지의 모든 표
// skip   : 만들지 않을 표와 그 이유 (검수 파일과 collect 로그에 표시)
// fixes  : 칸 안 줄바꿈 때문에 어색해진 띄어쓰기를 고치는 규칙 [원문(문자열 또는 정규식), 바꿀 말].
//          띄어쓰기만 고치고 숫자·조건 낱말은 바꾸지 않습니다.
// 새 페이지를 추가하면 npm.cmd test, npm.cmd run collect를 다시 실행하고 data/table-check.md를 검수하세요.

const WORD_FIXES = [
  ["사범 대학", "사범대학"],
  ["이중 전공", "이중전공"],
  ["구 분", "구분"],
  ["합 계", "합계"],
  ["모든대학", "모든 대학"],
  [/ +\(/g, "("], // "모든 대학 (사범대학 제외)" → "모든 대학(사범대학 제외)"
];

export const TABLE_PAGES = {
  11373: {
    kind: "graduation",
    tables: "all",
    fixes: WORD_FIXES,
    reviewNotes: [
      {
        match: "사범대학",
        note: "사범대학 행의 교양 값(16·18·20·22)은 다른 행(32)과 다르지만 원문과 같습니다. 2026-11-17 브라우저에서 원본 페이지를 그려 각 칸이 '교양' 머리글 아래에 있음을 확인했습니다.",
      },
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
