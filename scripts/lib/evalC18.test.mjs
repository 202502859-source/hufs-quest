import test from "node:test";
import assert from "node:assert/strict";

import {
  checkCoreAnswer
} from "./evalCoreGrade.mjs";

const question = {
  id: "C18",
  set: "core-1126"
};

const cases = [
  ["학번과 단과대학에 따라 다릅니다.", true],
  ["학번별로 상이합니다.", true],
  ["학번에 따라 다른 기준이 적용됩니다.", true],
  ["단과대학별로 최대 수강학점이 다름.", true],
  ["입학 연도에 따라 다릅니다.", true],
  ["단과대학별로 수강학점이 달라집니다.", true],
  ["소속 대학에 따라 차이가 있습니다.", true],
  ["입학 연도에 따라 동일하지 않습니다.", true],
  ["학점이월 제도에 따른 예외가 있습니다.", true],
  ["초과학점 신청 허가자는 추가 신청이 가능합니다.", true],
  ["모든 학생이 20학점으로 같습니다.", false],
  ["최대 수강학점은 모두 동일합니다.", false],
  ["학번과 단과대학은 관계없이 모든 학생이 동일합니다.", false],
  ["수강편람을 참고하세요.", false],
  ["학생마다 다릅니다.", false],
  ["학번과 단과대학을 확인하세요.", false],
  ["학점이월은 불가능합니다.", false],
  ["초과학점 신청은 허용되지 않습니다.", false],
  ["학번별로 다르지 않습니다.", false],
  ["단과대학별로 차이가 없습니다.", false],
  ["학점이월은 적용되지 않습니다.", false],
  ["초과 신청은 가능하지 않습니다.", false],
  ["학번별로 상이하지 않습니다.", false],
  ["", false]
];

for (const [answer, expected] of cases) {
  test(
    `C18 ${expected ? "정답" : "오답"}: ${answer}`,
    () => {
      assert.equal(
        checkCoreAnswer(question, answer),
        expected
      );
    }
  );
}

test("legacy 문항에는 C18 추가 규칙을 적용하지 않음", () => {
  assert.equal(
    checkCoreAnswer(
      { id: "C18", set: "legacy" },
      ""
    ),
    true
  );
});


test("실제 C18 문항과 내용 채점 조건 결합", async () => {
  const { CORE_1126 } = await import(
    "./evalCore1126.mjs"
  );

  const c = {
    ...CORE_1126.find(item => item.id === "C18"),
    set: "core-1126"
  };

  assert.equal(c.id, "C18");

  for (const [answer, expected] of cases) {
    const contentOk =
      (c.must || []).every(
        w => answer.includes(w)
      ) &&
      (!c.any || c.any.some(
        w => answer.includes(w)
      )) &&
      (c.mustGroups || []).every(
        group => group.some(
          w => answer.includes(w)
        )
      ) &&
      (c.anyOf || []).every(
        group => group.some(
          w => answer.includes(w)
        )
      ) &&
      !(c.mustNot || []).some(
        w => answer.includes(w)
      );

    const passed =
      contentOk && checkCoreAnswer(c, answer);

    assert.equal(
      passed,
      expected,
      answer
    );
  }
});
