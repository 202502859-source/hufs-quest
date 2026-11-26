// 이중전공 원문을 의미 단위로 분리합니다.
// 원문 문장을 재작성하거나 삭제하지 않습니다.

const SPLIT_RULES = {
  "11384-02": [
    { name: "시작 학년", lines: 1 },
    { name: "사범대학 제한", lines: 1 },
    { name: "LD/LT 이수요건", lines: 1 }
  ],

  "11384-03": [
    { name: "배정원칙", lines: 1 },
    { name: "배정기준", lines: 1 },
    { name: "배정비율", lines: 1 }
  ],

  "11384-04": [
    { name: "수강영역", lines: 3 },
    { name: "캠퍼스 간 제한", lines: 3 }
  ],

  "11384-05": [
    { name: "소속 캠퍼스 이수", lines: 1 },
    { name: "외국인전형 신청자격", lines: 1 }
  ],

  "11384-11": [
    { name: "취소 및 포기", lines: 1 },
    { name: "졸업시기", lines: 1 }
  ]
};

export function splitDoubleMajor(chunk) {
  if (!Object.hasOwn(SPLIT_RULES, chunk.id)) {
    return [{
      ...chunk,
      parent_id: chunk.id
    }];
  }

  if (chunk.title !== "이중전공") {
    throw new Error(
      `예상하지 못한 원문 제목: ${chunk.id}`
    );
  }

  const rules = SPLIT_RULES[chunk.id];

  const [header, ...body] = chunk.text.split("\n");

  if (header !== `[${chunk.title} > ${chunk.section}]`) {
    throw new Error(
      `원문 머리글 변경 확인 필요: ${chunk.id}`
    );
  }

  const expectedLines = rules.reduce(
    (sum, rule) => sum + rule.lines,
    0
  );

  if (body.length !== expectedLines) {
    throw new Error(
      `원문 구조 변경 확인 필요: ${chunk.id}`
    );
  }

  let offset = 0;

  return rules.map((rule, index) => {
    const part = body.slice(
      offset,
      offset + rule.lines
    );

    offset += rule.lines;

    const suffix = String.fromCharCode(97 + index);

    return {
      ...chunk,
      id: `${chunk.id}-${suffix}`,
      parent_id: chunk.id,
      text: [header, ...part].join("\n"),
      split_label: rule.name
    };
  });
}
