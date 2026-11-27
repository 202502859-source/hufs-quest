import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CORE_1126 } from "./evalCore1126.mjs";

import {
  evidenceGroups,
  gradeEvidenceGroups,
  hasAdvancedSource
} from "./evalAdvancedEvidence.mjs";

import { splitDoubleMajor } from "./ragSplit.mjs";

const find = id => {
  const c = CORE_1126.find(c => c.id === id);
  assert.ok(c);
  return c;
};

const docs = (...ids) => ids.map(id => ({
  id,
  score: 0.8
}));

function grade(id, dataset, ...ids) {
  return gradeEvidenceGroups(
    evidenceGroups(find(id), dataset),
    docs(...ids)
  );
}

test("기존 공개 평가 근거는 모두 그대로 유지", () => {
  for (const c of CORE_1126) {
    assert.deepEqual(
      evidenceGroups(c, "original"),
      c.evidenceIds.map(id => [id])
    );
  }
});

test("C09 기존 데이터에서는 부모 ID 인정", () => {
  assert.equal(
    grade("C09", "original", "11384-03").allHitAt6,
    true
  );
});

test("C09 개선 데이터에서는 정확한 자식 ID 인정", () => {
  assert.equal(
    grade("C09", "advanced", "11384-03-a").allHitAt6,
    true
  );
});

test("C09 관련 없는 자식 조각은 불인정", () => {
  const r = grade(
    "C09", "advanced",
    "11384-03-b", "11384-03-c"
  );

  assert.equal(r.hitAt6, false);
  assert.equal(r.recallAt6, 0);
});

test("C09 개선 데이터에서 이전 부모 ID 불인정", () => {
  assert.equal(
    grade("C09", "advanced", "11384-03").hitAt6,
    false
  );
});

test("대체 근거 하나만 검색해도 전체 근거 확보", () => {
  const pairs = [
    ["C03", "11360-02", "sugang2026-2-05"],
    ["C15", "11377-01", "sugang2026-2-03"],
    ["C16", "11377-02-a", "sugang2026-2-05"],
    ["C19", "11377-04", "sugang2026-2-09"],
    ["C20", "11377-05", "sugang2026-2-11"]
  ];

  for (const [id, oldId, newId] of pairs) {
    assert.equal(
      grade(id, "advanced", oldId).recallAt6,
      1
    );

    assert.equal(
      grade(id, "advanced", newId).recallAt6,
      1
    );
  }
});

test("같은 그룹의 두 근거를 검색해도 중복 가산하지 않음", () => {
  const r = grade(
    "C15", "advanced",
    "11377-01", "sugang2026-2-03"
  );

  assert.equal(r.recallAt6, 1);
  assert.equal(r.matchedGroups.length, 1);
});

test("C15 사전수강신청 조각만 검색하면 불인정", () => {
  assert.equal(
    grade(
      "C15", "advanced",
      "sugang2026-2-04"
    ).hitAt6,
    false
  );
});

test("C18 기존 근거 기준 유지", () => {
  assert.deepEqual(
    evidenceGroups(find("C18"), "advanced"),
    [["11377-03"]]
  );
});

test("복합 질문에 필요한 여러 근거는 각각 계산", () => {
  const r = grade(
    "C08", "advanced",
    "11384-01", "11384-09"
  );

  assert.equal(r.recallAt6, 2 / 3);
  assert.equal(r.allHitAt6, false);
});

test("상위 6개 밖의 근거 제외", () => {
  const r = grade(
    "C09", "advanced",
    "a", "b", "c", "d", "e", "f",
    "11384-03-a"
  );

  assert.equal(r.hitAt6, false);
});

test("debug 없음은 검색 실패가 아닌 측정 불가", () => {
  assert.equal(
    gradeEvidenceGroups([["a"]], null),
    null
  );
});

test("숨긴 평가 문항의 기준은 자동 수정하지 않음", () => {
  const c = {
    ...find("C09"),
    hidden: true
  };

  assert.deepEqual(
    evidenceGroups(c, "advanced"),
    [["11384-03"]]
  );
});

test("잘못된 평가 데이터 옵션 거부", () => {
  assert.throws(
    () => evidenceGroups(find("C09"), "invalid")
  );
});

test("개선 평가 근거 ID가 실제 생성 데이터에 존재", () => {
  const originals = JSON.parse(readFileSync(
    new URL("../../data/chunks.json", import.meta.url),
    "utf8"
  ));

  const manual = JSON.parse(readFileSync(
    new URL(
      "../../data/manual/sugang2026-2-seoul.json",
      import.meta.url
    ),
    "utf8"
  ));

  const next = [...originals, ...manual]
    .flatMap(splitDoubleMajor);

  const ids = new Set(next.map(c => c.id));

  for (const c of CORE_1126) {
    for (const group of evidenceGroups(c, "advanced")) {
      for (const id of group) {
        assert.ok(ids.has(id), `${c.id}: ${id}`);
      }
    }
  }
});

const manualSource =
  "https://e-book.hufs.ac.kr/src/viewer/main.php?host=main&site=20260727_sugang_h1";

test("확인된 공개 문항 5개의 수강편람 출처 인정", () => {
  for (const id of ["C03", "C15", "C16", "C19", "C20"]) {
    assert.equal(
      hasAdvancedSource(
        find(id), [manualSource], "advanced"
      ),
      true
    );
  }
});

test("기존 데이터 평가에서는 신규 출처 불인정", () => {
  assert.equal(
    hasAdvancedSource(
      find("C15"), [manualSource], "original"
    ),
    false
  );
});

test("C18 기존 출처 기준 유지", () => {
  assert.equal(
    hasAdvancedSource(
      find("C18"), [manualSource], "advanced"
    ),
    false
  );
});

test("관련 없는 전공제도 문항의 수강편람 출처 불인정", () => {
  assert.equal(
    hasAdvancedSource(
      find("C09"), [manualSource], "advanced"
    ),
    false
  );
});

test("다른 URL 및 가짜 출처 불인정", () => {
  const urls = [
    "https://example.com",
    manualSource + "-fake",
    "https://example.com/" + manualSource
  ];

  assert.equal(
    hasAdvancedSource(
      find("C15"), urls, "advanced"
    ),
    false
  );
});

test("숨긴 문항 출처 기준 유지", () => {
  const c = {
    ...find("C15"),
    hidden: true
  };

  assert.equal(
    hasAdvancedSource(c, [manualSource], "advanced"),
    false
  );
});

test("기존 legacy 문항 출처 기준 유지", () => {
  const c = {
    ...find("C15"),
    set: "base"
  };

  assert.equal(
    hasAdvancedSource(c, [manualSource], "advanced"),
    false
  );
});

test("출처가 없으면 불인정", () => {
  assert.equal(
    hasAdvancedSource(find("C15"), [], "advanced"),
    false
  );
});

// ── 11/26: 11377-02 → -a · -b ──
test("C17: 개선 데이터에서는 11377-02-b(본인 신청 · 성적 불인정)를 근거로 인정, -a · 이전 부모 id는 불인정", () => {
  assert.deepEqual(evidenceGroups(find("C17"), "advanced"), [["11377-02-b"]]);
  assert.equal(grade("C17", "advanced", "11377-02-b").allHitAt6, true);
  assert.equal(grade("C17", "advanced", "11377-02").hitAt6, false);
  assert.equal(grade("C17", "advanced", "11377-02-a").hitAt6, false);
  // 기존 데이터 평가는 그대로
  assert.deepEqual(evidenceGroups(find("C17"), "original"), [["11377-02"]]);
});

test("C16: 기존 그룹의 11377-02를 11377-02-a(예시 줄 \"5∼6회는 3학년\")로 바꿈", () => {
  assert.deepEqual(evidenceGroups(find("C16"), "advanced"), [["sugang2026-2-05", "11377-02-a"]]);
  assert.equal(grade("C16", "advanced", "11377-02-a").allHitAt6, true);
  assert.equal(grade("C16", "advanced", "11377-02-b").hitAt6, false);
});

test("근거 id가 11377-02인 공개 문항은 모두(C16 · C17) 개선 데이터 대체 근거가 있음", () => {
  const ids = CORE_1126.filter(c => c.evidenceIds.includes("11377-02")).map(c => c.id);
  assert.deepEqual(ids, ["C16", "C17"]);
  for (const id of ids) {
    const flat = evidenceGroups(find(id), "advanced").flat();
    assert.ok(flat.some(x => x.startsWith("11377-02-")), id);
  }
});
