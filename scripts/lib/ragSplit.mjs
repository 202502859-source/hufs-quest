// 원문 조각을 의미 단위로 분리합니다(이중전공 · 수강신청지침).
// 원문 문장을 재작성하거나 삭제하지 않습니다.
// 규칙마다 기대하는 원문 제목(title)과 부분별 줄 수(parts)를 둡니다. 제목 · 머리글 · 줄 수가 다르면
// 원문이 바뀐 것이므로 나누지 않고 오류를 냅니다(사람이 확인한 뒤 규칙을 고침).

const SPLIT_RULES = {
  "11384-02": {
    title: "이중전공",
    parts: [
      { name: "시작 학년", lines: 1 },
      { name: "사범대학 제한", lines: 1 },
      { name: "LD/LT 이수요건", lines: 1 }
    ]
  },

  "11384-03": {
    title: "이중전공",
    parts: [
      { name: "배정원칙", lines: 1 },
      { name: "배정기준", lines: 1 },
      { name: "배정비율", lines: 1 }
    ]
  },

  "11384-04": {
    title: "이중전공",
    parts: [
      { name: "수강영역", lines: 3 },
      { name: "캠퍼스 간 제한", lines: 3 }
    ]
  },

  "11384-05": {
    title: "이중전공",
    parts: [
      { name: "소속 캠퍼스 이수", lines: 1 },
      { name: "외국인전형 신청자격", lines: 1 }
    ]
  },

  "11384-11": {
    title: "이중전공",
    parts: [
      { name: "취소 및 포기", lines: 1 },
      { name: "졸업시기", lines: 1 }
    ]
  },

  // 11/26 C17: 일정 표(9줄)와 "본인 신청 · 미신청 성적 불인정"(1줄)이 한 조각이라
  // "수강신청 안 하고 수업 들으면 성적 인정?" 질문에서 일정 표에 묻혀 검색 순위가 밀림
  "11377-02": {
    title: "수강신청지침",
    parts: [
      { name: "수강신청 일정", lines: 9 },
      { name: "본인 신청·미신청 성적 불인정", lines: 1 }
    ]
  }
};

export function splitRagChunk(chunk) {
  if (!Object.hasOwn(SPLIT_RULES, chunk.id)) {
    return [{
      ...chunk,
      parent_id: chunk.id
    }];
  }

  const rule = SPLIT_RULES[chunk.id];

  if (chunk.title !== rule.title) {
    throw new Error(
      `예상하지 못한 원문 제목: ${chunk.id}`
    );
  }

  const [header, ...body] = chunk.text.split("\n");

  if (header !== `[${chunk.title} > ${chunk.section}]`) {
    throw new Error(
      `원문 머리글 변경 확인 필요: ${chunk.id}`
    );
  }

  const expectedLines = rule.parts.reduce(
    (sum, part) => sum + part.lines,
    0
  );

  if (body.length !== expectedLines) {
    throw new Error(
      `원문 구조 변경 확인 필요: ${chunk.id}`
    );
  }

  let offset = 0;

  return rule.parts.map((part, index) => {
    const lines = body.slice(
      offset,
      offset + part.lines
    );

    offset += part.lines;

    const suffix = String.fromCharCode(97 + index);

    return {
      ...chunk,
      id: `${chunk.id}-${suffix}`,
      parent_id: chunk.id,
      text: [header, ...lines].join("\n"),
      split_label: part.name
    };
  });
}

// 예전 이름(이중전공만 나누던 때). 같은 함수입니다.
export const splitDoubleMajor = splitRagChunk;
