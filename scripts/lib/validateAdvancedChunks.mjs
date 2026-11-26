// Advanced RAG 시험용 데이터 사전 검증
// 외부 API 호출 및 DB 연결 전에 실행합니다.

const REQUIRED_FIELDS = [
  "id", "title", "url", "section",
  "text", "collected_at", "parent_id",
  "topic", "subtopic", "campus",
  "cohort_min", "cohort_max"
];

const ALLOWED_FIELDS = new Set([
  ...REQUIRED_FIELDS,
  "split_label"
]);

export function validateAdvancedChunks(
  chunks,
  expectedCount
) {
  if (!Array.isArray(chunks)) {
    throw new Error("데이터는 배열이어야 합니다.");
  }

  if (
    !Number.isInteger(expectedCount) ||
    expectedCount <= 0 ||
    chunks.length !== expectedCount
  ) {
    throw new Error("예상 조각 수 불일치");
  }

  const ids = new Set();

  for (const c of chunks) {
    if (!c || typeof c !== "object" || Array.isArray(c)) {
      throw new Error("잘못된 조각 형식");
    }

    const fail = reason => {
      throw new Error(`${c.id ?? "unknown"}: ${reason}`);
    };

    if (!REQUIRED_FIELDS.every(k => Object.hasOwn(c, k))) {
      fail("필수 필드 누락");
    }

    if (Object.keys(c).some(k => !ALLOWED_FIELDS.has(k))) {
      fail("허용되지 않은 필드");
    }

    for (const key of [
      "id", "title", "text", "parent_id", "topic"
    ]) {
      if (typeof c[key] !== "string" || !c[key].trim()) {
        fail(`${key} 값 오류`);
      }
    }

    if (typeof c.url !== "string") {
      fail("url 형식 오류");
    }

    for (const key of ["section", "subtopic", "split_label"]) {
      const value = c[key] ?? null;

      if (value !== null && typeof value !== "string") {
        fail(`${key} 형식 오류`);
      }
    }

    if (![null, "seoul", "global"].includes(c.campus)) {
      fail("campus 값 오류");
    }

    for (const key of ["cohort_min", "cohort_max"]) {
      if (c[key] !== null && !Number.isInteger(c[key])) {
        fail(`${key} 형식 오류`);
      }
    }

    if (
      c.cohort_min !== null &&
      c.cohort_max !== null &&
      c.cohort_min > c.cohort_max
    ) {
      fail("학번 범위 오류");
    }

    if (
      typeof c.collected_at !== "string" ||
      !Number.isFinite(Date.parse(c.collected_at))
    ) {
      fail("수집일 형식 오류");
    }

    if (ids.has(c.id)) {
      fail("ID 중복");
    }

    ids.add(c.id);
  }

  return chunks.map(c => ({
    ...c,
    split_label: c.split_label ?? null
  }));
}
