// eval 검색 근거 적중률 계산
// 실제 답변의 정확도와 검색 근거 확보 여부를 따로 측정합니다.

export function gradeRetrieval(expectedIds, retrieved) {
  const expected = [...new Set(expectedIds || [])];

  // debug가 없는 구버전 서버 응답은 검색 실패로 채점하지 않음.
  if (!expected.length || !Array.isArray(retrieved)) {
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
