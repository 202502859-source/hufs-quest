/*
 * 검색창 질문 쪼개기 도우미 (api/ask.js에서 씀). 네트워크를 부르지 않는 순수 함수만 둡니다.
 *
 * - parseQueries(text): 검색어 정리 모델의 출력 {"queries": [...]}를 읽어 하위 질문(검색어) 배열로 바꿉니다.
 * - fallbackQuery(text): JSON이 아닐 때 모델 출력이 한 줄 검색어면 그 한 줄을 씁니다(예전 방식).
 * - mergeDocs(lists, opts): 하위 질문별 검색 결과를 중복 없이 하나의 근거 목록으로 합칩니다.
 * - evidenceDocs(lists, merged): AI 호출 실패 시 보여 줄 근거 원문을 고릅니다(하위 질문마다 1등 하나씩).
 *
 * 테스트: tests/decompose.test.js (npm test)
 */

export const MAX_SUB_QUERIES = 2;
export const MAX_SUB_QUERY_LENGTH = 80;

// 모델 출력에서 {"queries": [...]}를 읽습니다. ```json ... ``` 코드블록으로 감싸져 있어도 읽습니다.
// 하위 질문은 빈 값 · 중복을 빼고 각 80자까지 자른 뒤 최대 2개만 씁니다. 읽을 수 없거나 비면 null입니다.
export function parseQueries(text) {
  if (typeof text !== "string") return null;
  const unfenced = text.replace(/```[a-zA-Z]*\s*/g, "").replace(/```/g, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed;
  try {
    parsed = JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || !Array.isArray(parsed.queries)) return null;
  const seen = new Set();
  const queries = [];
  for (const item of parsed.queries) {
    if (typeof item !== "string") continue;
    const query = item.replace(/["'`\n\r]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_SUB_QUERY_LENGTH).trim();
    if (!query || seen.has(query)) continue;
    seen.add(query);
    queries.push(query);
    if (queries.length >= MAX_SUB_QUERIES) break;
  }
  return queries.length ? queries : null;
}

const docKey = (doc) => `${doc?.url ?? ""}\n${doc?.text ?? ""}`;
const similarityOf = (doc) => (typeof doc?.similarity === "number" ? doc.similarity : 0);

// 하위 질문별 검색 결과(각 배열은 비슷한 순서로 정렬돼 있다고 봄)를 하나로 합칩니다.
// 1) url + text가 같은 조각은 한 번만 넣습니다(처음 나온 하위 질문 쪽으로 셈).
// 2) 하위 질문마다 상위 perQuery개를 먼저 넣고, 남는 자리는 나머지 조각을 유사도 높은 순으로 채워 max개까지.
// 3) 결과는 하위 질문 순서(같은 질문 안에서는 원래 순위)대로 정렬합니다.
// 하위 질문이 1개면 max는 4입니다(예전 근거 수와 같음).
export function mergeDocs(lists, { perQuery = 3, max = 6 } = {}) {
  const safeLists = (Array.isArray(lists) ? lists : []).map((list) => (Array.isArray(list) ? list : []));
  const limit = safeLists.length <= 1 ? Math.min(max, 4) : max;
  if (limit <= 0) return [];

  // 조각마다 처음 나온 위치(하위 질문 번호, 순위)를 기억합니다.
  const candidates = new Map();
  safeLists.forEach((list, queryIndex) => {
    list.forEach((doc, rank) => {
      if (!doc) return;
      const key = docKey(doc);
      if (!candidates.has(key)) candidates.set(key, { doc, queryIndex, rank });
    });
  });

  const picked = new Map();
  // 하위 질문마다 상위 perQuery개 보장
  safeLists.forEach((list) => {
    list.slice(0, perQuery).forEach((doc) => {
      if (!doc || picked.size >= limit) return;
      const key = docKey(doc);
      if (!picked.has(key)) picked.set(key, candidates.get(key));
    });
  });
  // 남는 자리는 유사도 순(같으면 하위 질문 · 순위 순)
  const rest = [...candidates.entries()]
    .filter(([key]) => !picked.has(key))
    .sort(([, a], [, b]) => similarityOf(b.doc) - similarityOf(a.doc) || a.queryIndex - b.queryIndex || a.rank - b.rank);
  for (const [key, entry] of rest) {
    if (picked.size >= limit) break;
    picked.set(key, entry);
  }

  return [...picked.values()]
    .sort((a, b) => a.queryIndex - b.queryIndex || a.rank - b.rank)
    .map((entry) => entry.doc);
}

// JSON을 읽지 못했을 때의 예비 검색어(예전 방식): 모델 출력이 한 줄 검색어면 그 한 줄을 씁니다.
// 따옴표 · 줄바꿈을 정리한 뒤 1~80자이고 { 나 }가 없어야 합니다(깨진 JSON을 검색어로 쓰지 않게). 아니면 null입니다.
export function fallbackQuery(text) {
  if (typeof text !== "string") return null;
  const query = text.replace(/["'`\n\r]/g, " ").replace(/\s+/g, " ").trim();
  if (!query || query.length > MAX_SUB_QUERY_LENGTH || /[{}]/.test(query)) return null;
  return query;
}

// AI 호출이 실패했을 때 보여 줄 근거 원문을 고릅니다(최대 n개).
// 하위 질문이 둘 이상이면 각 하위 질문의 1등 근거를 하나씩, 모자라면 합친 근거(merged) 앞쪽으로 채웁니다.
// 하위 질문이 하나면 합친 근거의 앞 n개입니다.
export function evidenceDocs(lists, merged, n = 2) {
  const safeMerged = Array.isArray(merged) ? merged : [];
  const safeLists = Array.isArray(lists) ? lists : [];
  if (safeLists.length <= 1) return safeMerged.slice(0, n);
  const picked = new Map();
  for (const list of safeLists) {
    const first = Array.isArray(list) ? list[0] : null;
    if (first && picked.size < n && !picked.has(docKey(first))) picked.set(docKey(first), first);
  }
  for (const doc of safeMerged) {
    if (picked.size >= n) break;
    if (!picked.has(docKey(doc))) picked.set(docKey(doc), doc);
  }
  return [...picked.values()];
}
