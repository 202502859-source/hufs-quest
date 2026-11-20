// 표 정리 조각을 원문 표의 행과 나란히 비교하는 검수 파일(data/table-check.md)을 만듭니다.
// 사람이 숫자를 직접 확인한 뒤에만 npm run ingest를 실행합니다.

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");

export function renderTableCheck(pages, { collectedAt }) {
  const out = [];
  const totalChunks = pages.reduce((n, p) => n + p.chunks.length, 0);
  const totalSentences = pages.reduce((n, p) => n + p.review.reduce((m, r) => m + r.sentences.length, 0), 0);
  const totalAmbiguous = pages.reduce((n, p) => n + p.ambiguous.length, 0);

  out.push("# 표 정리 조각 검수표", "");
  out.push(`> \`npm run collect\`가 만든 파일입니다 (${collectedAt}). 문장 속 숫자를 학교 원문 표와 하나씩 대조한 뒤에만 \`npm run ingest\`를 실행합니다.`);
  out.push("> - **원문 행**: 그 `<tr>`에 실제로 적혀 있는 칸 (rowspan/colspan으로 위에서 내려온 칸은 없음)");
  out.push("> - **펼친 격자**: 합쳐진 칸을 풀어 붙인 값. `↑`는 위 행에서 합쳐져 내려온 값");
  out.push("> - **생성 문장**: 조각에 들어가는 문장. 숫자는 펼친 격자에서만 가져옴", "");

  out.push("## 요약", "");
  const excludedOf = (p) => p.excluded ?? [];
  out.push("| 페이지 | 조각 | 문장 | 보류한 행 | 건너뛴 표 | 글로벌 전용 제외 조각 |", "| --- | --- | --- | --- | --- | --- |");
  for (const p of pages) {
    const sentences = p.review.reduce((m, r) => m + r.sentences.length, 0);
    out.push(`| [${esc(p.title)} (${p.pageId})](${p.url}) | ${p.chunks.length} | ${sentences} | ${p.ambiguous.length} | ${p.skipped.length} | ${excludedOf(p).length} |`);
  }
  out.push(`| **합계** | **${totalChunks}** | **${totalSentences}** | **${totalAmbiguous}** | **${pages.reduce((n, p) => n + p.skipped.length, 0)}** | **${pages.reduce((n, p) => n + excludedOf(p).length, 0)}** |`, "");
  out.push("> 조각 수는 저장한 조각만 셉니다. 문장 수에는 제외한 조각의 문장도 들어 있습니다(검수용).", "");

  out.push("## 글로벌캠퍼스 전용으로 제외한 표 조각 (저장 안 함)", "");
  out.push("> 서울캠퍼스 서비스라 표 제목에 '글로벌캠퍼스'만 있는 문장은 뺍니다(11/20 eval 2025학번 졸업학점 오답 원인).", "");
  out.push("| 조각 | 구분 | 문장 |", "| --- | --- | --- |");
  for (const p of pages) for (const e of excludedOf(p)) out.push(`| ${e.id} | ${esc(e.section)} | ${e.sentences} |`);
  if (!pages.some((p) => excludedOf(p).length)) out.push("| (없음) | - | - |");
  out.push("");

  out.push("## 문장을 만들지 않은 곳 (해석 확인 필요)", "");
  out.push("| 페이지 | 표 | 행 | 구분 | 원문 행 | 이유 |", "| --- | --- | --- | --- | --- | --- |");
  for (const p of pages) {
    for (const a of p.ambiguous) {
      out.push(`| ${p.pageId} | ${esc(a.heading)} | ${a.row} | ${esc(a.labels.join(" / "))} | ${esc(a.rawCells.join(" ¦ "))} | ${esc(a.reason)} |`);
    }
    for (const s of p.skipped) out.push(`| ${p.pageId} | ${esc(s.heading)} (표 ${s.tableIndex + 1}) | 전체 | - | - | ${esc(s.reason)} |`);
  }
  out.push("");

  for (const p of pages) {
    out.push(`## ${p.title} (${p.pageId})`, "", `원문: ${p.url}`, "");
    for (const note of p.reviewNotes ?? []) out.push(`> ※ 검수 메모: ${note.note}`, "");
    for (const r of p.review) {
      const chunk = p.chunks.find((c) => c.id === r.id) ?? excludedOf(p).find((c) => c.id === r.id);
      out.push(`### ${r.id} · ${esc(chunk.section)}${r.excluded ? ` — **제외: ${esc(r.excluded)}**` : ""}`, "");
      if (r.lead) out.push(`표 위 안내: ${r.lead}`, "");
      out.push("| 행 | 원문 행 | 펼친 격자 | 생성 문장 |", "| --- | --- | --- | --- |");
      for (const s of r.sentences) {
        const grid = [
          `구분: ${s.labels.join(" / ")}`,
          ...s.cells.map((c) => `${c.header.join(" > ")}: ${c.text ?? "(빈 칸)"}${c.merged ? " ↑" : ""}`),
        ].join("<br>");
        const flag = (p.reviewNotes ?? []).some((n) => s.labels.some((l) => l.includes(n.match))) ? "※ " : "";
        const body = s.text.replace(/^\[[^\]]*\]\s*/, "");
        const cut = s.excluded ? "(제외: 글로벌캠퍼스 전용) " : "";
        out.push(`| ${s.row}${s.focus ? `<br>${esc(s.focus)}` : ""} | ${esc(s.rawCells.join(" ¦ "))} | ${esc(grid)} | ${cut}${flag}${esc(body)} |`);
      }
      out.push("");
    }
  }
  return `${out.join("\n")}\n`;
}
