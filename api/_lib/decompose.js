/*
 * 검색창 질문 쪼개기 도우미 (api/ask.js에서 씀). 네트워크를 부르지 않는 순수 함수만 둡니다.
 *
 * - parseQueries(text): 검색어 정리 모델의 출력 {"queries": [...]}를 읽어 하위 질문(검색어) 배열로 바꿉니다.
 * - fallbackQuery(text): JSON이 아닐 때 모델 출력이 한 줄 검색어면 그 한 줄을 씁니다(예전 방식).
 * - mergeDocs(lists, opts): 하위 질문별 검색 결과를 중복 없이 하나의 근거 목록으로 합칩니다.
 *   형제 조각(id 끝이 "-a" · "-b"처럼 "-소문자 한 글자", 예: 11384-11-a · 11384-11-b)은 한 자리로 셉니다.
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

// 형제 조각: 시험용 DB(chunks_next)는 긴 조각을 "11384-11-a" · "11384-11-b"처럼 나눠 둡니다.
// id 끝이 "-소문자 한 글자"면 그걸 뗀 값이 형제 키입니다(11384-11-a → 11384-11). 아니면 null(형제 없음).
// sugang2026-2-02 · 11384-06처럼 끝이 숫자인 id는 형제가 아닙니다.
const SIBLING_SUFFIX = /-[a-z]$/;
export const MAX_SIBLINGS = 3; // 한 묶음에서 뽑힌 조각 뒤에 같이 넣는 형제 수 상한
export function siblingKey(doc) {
  const id = doc?.id;
  return typeof id === "string" && SIBLING_SUFFIX.test(id) ? id.replace(SIBLING_SUFFIX, "") : null;
}
// 자리를 세는 키: 형제 조각은 형제 키, 아니면 예전과 같은 url + text
const slotKey = (doc) => {
  const sibling = siblingKey(doc);
  return sibling === null ? docKey(doc) : `sibling\n${sibling}`;
};

// 하위 질문별 검색 결과(각 배열은 비슷한 순서로 정렬돼 있다고 봄)를 하나로 합칩니다.
// 1) url + text가 같은 조각은 한 번만 넣습니다(처음 나온 하위 질문 쪽으로 셈).
// 2) 하위 질문마다 상위 perQuery개를 먼저 넣고, 남는 자리는 나머지 조각을 유사도 높은 순으로 채워 max개까지.
// 3) 결과는 하위 질문 순서(같은 질문 안에서는 원래 순위)대로 정렬합니다.
// 하위 질문이 1개면 max는 4입니다(예전 근거 수와 같음).
//
// 형제 조각은 한 자리로 셉니다(limit · perQuery 보장 · pageCap 모두 "형제 키" 기준). 형제 중 하나가 뽑히면 나머지 형제를
// 그 바로 뒤에 최대 MAX_SIBLINGS개까지 같이 넣습니다(자리는 1개). 형제 id가 없는 실서비스 DB에서는 예전과 결과가 같습니다.
// (11/26 재현: 시험용 DB에서 C10 "후기 이중전공 9학기" 질문의 상위가 11384-09 · 11384-11-a · 11388-07 · 11384-11-b라
//  같은 조각의 형제 두 개가 4자리 중 2자리를 차지해, 정답 근거 11384-06(5위 이하)이 잘리고 "9학기 안 다녀도 된다"로 오답.)
//
// 하위 질문이 둘 이상이면 2)의 몫(perQuery개)을 고를 때 같은 페이지(url) 조각은 pageCap개까지만 먼저 넣고,
// 몫이 남으면 그때 순위대로 같은 페이지 조각으로 채웁니다. 한 페이지의 비슷한 조각들이 몫을 다 차지해
// 그 하위 질문에 정작 필요한 다른 페이지 조각이 잘리는 것을 막습니다.
// (11/21 재현: "졸업 요건 평점" 하위 질문에서 수료(11391) 조각 5개가 1~5위, 졸업 요건 11390-01 "2.00 이상"이 6위라 잘려
//  "졸업 평점도 4.00"으로 오답. 하위 질문이 1개일 때는 순위를 그대로 씁니다.)
export function mergeDocs(lists, { perQuery = 3, max = 6, pageCap = 2 } = {}) {
  const safeLists = (Array.isArray(lists) ? lists : []).map((list) => (Array.isArray(list) ? list : []));
  const limit = safeLists.length <= 1 ? Math.min(max, 4) : max;
  if (limit <= 0) return [];

  // 자리(slotKey)마다 처음 나온 조각과 위치(하위 질문 번호, 순위)를 기억합니다. 형제는 같은 자리에 모아 둡니다.
  const candidates = new Map();
  const siblings = new Map(); // 형제 자리 → 그 자리의 조각들(처음 나온 순서, url + text 중복 없이)
  safeLists.forEach((list, queryIndex) => {
    list.forEach((doc, rank) => {
      if (!doc) return;
      const key = slotKey(doc);
      if (!candidates.has(key)) candidates.set(key, { doc, queryIndex, rank });
      if (siblingKey(doc) === null) return;
      if (!siblings.has(key)) siblings.set(key, []);
      const group = siblings.get(key);
      if (!group.some((d) => docKey(d) === docKey(doc))) group.push(doc);
    });
  });

  const picked = new Map();
  // 하위 질문마다 perQuery개 보장(이미 다른 하위 질문이 넣은 같은 조각도 그 하위 질문의 몫 하나로 셈)
  safeLists.forEach((list) => {
    const share = shareOf(list, safeLists.length > 1 ? pageCap : Infinity, perQuery);
    share.forEach((doc) => {
      if (picked.size >= limit) return;
      const key = slotKey(doc);
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

  // 자리 순서대로 펼칩니다. 형제 자리는 처음 나온 조각 뒤에 나머지 형제를 최대 MAX_SIBLINGS개 붙입니다.
  return [...picked.entries()]
    .sort(([, a], [, b]) => a.queryIndex - b.queryIndex || a.rank - b.rank)
    .flatMap(([key, entry]) => {
      const group = siblings.get(key);
      if (!group) return [entry.doc];
      const rest = group.filter((d) => docKey(d) !== docKey(entry.doc)).slice(0, MAX_SIBLINGS);
      return [entry.doc, ...rest];
    });
}

// 한 하위 질문의 몫 count개를 순위대로 고르되, 같은 페이지(url)는 pageCap개까지만 먼저 고르고
// 모자라면 건너뛴 조각을 순위대로 채웁니다. 결과는 원래 순위 순서입니다.
// 형제 조각은 그 하위 질문에서 처음 나온 하나만 남겨 한 자리로 셉니다(형제가 없으면 예전과 같음).
function shareOf(list, pageCap, count) {
  const seenSiblings = new Set();
  const docs = list.filter(Boolean).filter((doc) => {
    const sibling = siblingKey(doc);
    if (sibling === null) return true;
    if (seenSiblings.has(sibling)) return false;
    seenSiblings.add(sibling);
    return true;
  });
  const chosen = new Set();
  const perPage = new Map();
  for (const doc of docs) {
    if (chosen.size >= count) break;
    const page = doc.url ?? "";
    if ((perPage.get(page) ?? 0) >= pageCap) continue;
    perPage.set(page, (perPage.get(page) ?? 0) + 1);
    chosen.add(doc);
  }
  for (const doc of docs) {
    if (chosen.size >= count) break;
    chosen.add(doc);
  }
  return docs.filter((doc) => chosen.has(doc));
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
