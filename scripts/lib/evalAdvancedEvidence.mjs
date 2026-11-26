// Advanced RAG 개선 데이터 전용 평가 근거 매핑.
// 기존 평가 문항과 정답 조건은 변경하지 않습니다.

const ADVANCED_GROUPS = {
  C03: [
    ["11360-02", "sugang2026-2-05"]
  ],
  C09: [
    ["11384-03-a"]
  ],
  C15: [
    ["11377-01", "sugang2026-2-03"]
  ],
  C16: [
    ["11377-02", "sugang2026-2-05"]
  ],
  C19: [
    ["11377-04", "sugang2026-2-09"]
  ],
  C20: [
    ["11377-05", "sugang2026-2-11"]
  ]
};

export function evidenceGroups(c, dataset = "original") {
  if (!["original", "advanced"].includes(dataset)) {
    throw new Error("지원하지 않는 평가 데이터");
  }

  if (
    dataset === "advanced" &&
    c.set === "core-1126" &&
    c.hidden !== true &&
    Object.hasOwn(ADVANCED_GROUPS, c.id)
  ) {
    return ADVANCED_GROUPS[c.id].map(group => [...group]);
  }

  return [...new Set(c.evidenceIds || [])]
    .map(id => [id]);
}

// 대체 근거는 하나의 그룹으로 계산합니다.
// 서로 다른 필수 근거 그룹은 각각 검색되어야 합니다.
export function gradeEvidenceGroups(groups, retrieved) {
  if (!groups.length || !Array.isArray(retrieved)) {
    return null;
  }

  const top6 = retrieved.slice(0, 6);
  const ids = new Set(top6.map(doc => doc?.id));

  const matchedGroups = groups.filter(
    group => group.some(id => ids.has(id))
  );

  const missingGroups = groups.filter(
    group => !group.some(id => ids.has(id))
  );

  return {
    hitAt6: matchedGroups.length > 0,
    recallAt6: matchedGroups.length / groups.length,
    allHitAt6: missingGroups.length === 0,
    matchedGroups,
    missingGroups,
    retrievedCount: top6.length
  };
}

// 검증된 공개 문항에만 공식 수강편람 출처를 인정합니다.
const SUGANG_SOURCE =
  "https://e-book.hufs.ac.kr/src/viewer/main.php?host=main&site=20260727_sugang_h1";

export function hasAdvancedSource(
  c,
  cited,
  dataset = "original"
) {
  if (
    dataset !== "advanced" ||
    c.set !== "core-1126" ||
    c.hidden === true
  ) {
    return false;
  }

  const groups = evidenceGroups(c, dataset);

  const supportsManual = groups.some(
    group => group.some(
      id => id.startsWith("sugang2026-2-")
    )
  );

  if (!supportsManual) return false;

  return cited.some(url => url === SUGANG_SOURCE);
}
