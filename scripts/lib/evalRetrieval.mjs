// eval 검색 근거 적중률 계산
// 실제 답변의 정확도와 검색 근거 확보 여부를 따로 측정합니다.

// 최종 검색 조각의 검색 방식을 구분합니다.
export function retrievalMethod(retrieved) {
  if (!Array.isArray(retrieved)) return "unavailable";
  if (!retrieved.length) return "empty";

  const methods = new Set(retrieved.slice(0, 6).map(doc => {
    if (doc?.method === "keyword") return "keyword";
    if (doc?.method === "vector") return "vector";

    // 이전 debug 형식과의 호환성.
    if (String(doc?.id || "").startsWith("kb:")) {
      return "keyword";
    }

    if (Number.isFinite(doc?.score)) return "vector";

    return "unknown";
  }));

  if (methods.has("unknown")) return "unknown";
  if (methods.size > 1) return "mixed";

  return [...methods][0];
}

export function gradeRetrieval(expectedIds, retrieved) {
  const expected = [...new Set(expectedIds || [])];

  // debug가 없는 구버전 서버 응답은 검색 실패로 채점하지 않음.
  if (!expected.length || !Array.isArray(retrieved)) {
    return null;
  }

  const method = retrievalMethod(retrieved);

  // KB와 원문 조각의 ID 체계가 다르므로
  // 대응 관계가 확인되기 전에는 전체 적중률을 측정하지 않음.
  if (["keyword", "mixed", "unknown"].includes(method)) {
    return null;
  }

  const top6 = retrieved.slice(0, 6);

  const retrievedIds = new Set(
    top6.map(doc => doc?.id)
  );

  const matchedIds = expected.filter(
    id => retrievedIds.has(id)
  );

  const missingIds = expected.filter(
    id => !retrievedIds.has(id)
  );

  return {
    hitAt6: matchedIds.length > 0,
    recallAt6: matchedIds.length / expected.length,
    allHitAt6: missingIds.length === 0,
    matchedIds,
    missingIds,
    retrievedCount: top6.length
  };
}
