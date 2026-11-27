import { test } from "node:test";
import assert from "node:assert/strict";
import { CORE_1126 } from "./evalCore1126.mjs";
import { checkCoreAnswer } from "./evalCoreGrade.mjs";

function passes(id, answer) {
  const c = CORE_1126.find(x => x.id === id);
  assert.ok(c, `${id} 문항 없음`);

  return (
    (c.must || []).every(w => answer.includes(w)) &&
    (!c.any || c.any.some(w => answer.includes(w))) &&
    (c.mustGroups || []).every(
      group => group.some(w => answer.includes(w))
    ) &&
    (c.anyOf || []).every(
      group => group.some(w => answer.includes(w))
    ) &&
    !(c.mustNot || []).some(w => answer.includes(w)) &&
    checkCoreAnswer(c, answer)
  );
}

const cases = [
  ["C11", "조기졸업 대상자는 신청 제한이 없습니다.", false],
  ["C11", "조기졸업 대상자는 신청이 가능합니다.", false],
  ["C11", "신청할 수 있습니다.", false],
  ["C11", "관련 정보가 없습니다.", false],
  ["C11", "조기졸업 대상자는 신청할 수 없습니다.", true],
  ["C11", "조기졸업대상자는 신청 불가입니다.", true],
  ["C11", "조기졸업 대상자는 신청이 불가능합니다.", true],

  ["C15", "수강신청은 별도 신청 없이 자동 완료됩니다.", false],
  ["C15", "수강신청은 별도의 수강신청이 필요 없습니다.", false],
  ["C15", "별도 신청 없이 수강신청이 자동 완료됩니다.", false],
  ["C15", "반드시 실제 수강신청을 해야 합니다.", true],
  ["C15", "수강신청 기간에 반드시 수강신청으로 처리하여야 합니다.", true],
  ["C15", "수강신청이 자동으로 완료되는 것은 아닙니다. 반드시 직접 신청해야 합니다.", true]
];

for (const [id, answer, expected] of cases) {
  test(`${id}: ${answer}`, () => {
    assert.equal(passes(id, answer), expected);
  });
}

// 11/26: C20 마지막 묶음에 "허용되지 않" 추가(PM 승인: 이종헌). 시험용 DB eval 답(뜻은 맞음)이 통과
test("C20: \"허용되지 않습니다\"로 답해도 통과", () => {
  assert.equal(passes("C20", "4학년은 전체 과목을 취소하는 것은 허용되지 않습니다. 다만, 12학점 미만으로 수강 취소가 가능한 점은 예외입니다. [1]"), true);
  assert.equal(passes("C20", "4학년은 12학점 미만으로도 수강 취소가 가능하지만, 전체 과목을 취소할 수는 없습니다. [1]"), true);
  // 전체 과목 취소 여부를 말하지 않으면 여전히 실패
  assert.equal(passes("C20", "4학년은 12학점 미만으로도 수강 취소가 가능합니다. [1]"), false);
});
