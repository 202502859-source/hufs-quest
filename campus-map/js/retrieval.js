/*
 * 지식 베이스 검색 (브라우저와 서버가 함께 사용)
 * 임베딩을 붙이기 전 단계의 키워드 + 글자 2-gram 검색입니다.
 * 키워드가 하나도 맞지 않으면 빈 결과를 돌려주어, 근거 없는 답을 만들지 않습니다.
 */
(function (root) {
  const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, " ").trim();

  const compact = (s) => norm(s).replace(/ /g, "");

  const WEAK = new Set(["신청", "언제", "시기", "기간", "방법", "일정", "학년", "등록", "변경", "최대", "담당", "부서", "문의", "전화", "연락처", "본인", "성적", "비율", "우선", "제한", "when", "apply", "start", "schedule", "year", "change", "add", "call", "phone", "office", "contact", "grade", "maximum", "credits", "selection", "priority", "restriction", "quota"]);

  function bigrams(s) {
    const text = compact(s);
    const set = new Set();
    for (let i = 0; i < text.length - 1; i++) set.add(text.slice(i, i + 2));
    return set;
  }

  function retrieve(question, kb, lang, topK) {
    const q = norm(question);
    if (!q) return [];
    const qCompact = compact(q);
    const qGrams = bigrams(q);
    const scored = [];
    for (const doc of kb) {
      const hits = doc.keywords.filter((k) => qCompact.includes(compact(k)));
      // "신청", "언제"처럼 어느 주제에나 쓰이는 말만 맞으면 근거로 인정하지 않습니다.
      if (!hits.some((k) => !WEAK.has(compact(k)))) continue;
      const keywordScore = hits.reduce((sum, k) => sum + compact(k).length, 0);
      const docGrams = bigrams(doc.title[lang] + " " + doc.text[lang]);
      let overlap = 0;
      qGrams.forEach((g) => { if (docGrams.has(g)) overlap++; });
      scored.push({ doc, score: keywordScore * 2 + overlap });
    }
    scored.sort((a, b) => b.score - a.score);
    if (!scored.length) return [];
    // 1위와 점수 차가 크게 나는 문서는 버려 답변을 짧게 유지합니다.
    const best = scored[0].score;
    return scored.filter((s) => s.score >= best * 0.7).slice(0, topK || 2).map((s) => s.doc);
  }

  const api = { retrieve };
  root.Retrieval = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
