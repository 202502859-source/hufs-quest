// 학교 페이지의 표를 rowspan/colspan 없이 '완전한 격자'로 풀고,
// 행마다 머리글 경로, 합쳐진 칸 값, 표 위 소제목·안내 문장을 붙여 돌려줍니다.
// tableSentences.mjs와 테스트가 함께 씁니다. 값은 HTML 원문에서만 가져오며 보충하지 않습니다.

const NOISE = [/^\/WEB-INF\//, /^hufs_sub/, /^fnctId=/, /^RSS 2\.0$/];

export function clean(text) {
  return String(text ?? "").replace(/[\s ]+/g, " ").trim();
}

// 칸 안의 <p>/<br> 줄은 공백으로 잇습니다. raw는 원문 그대로, text는 fixes를 적용한 값입니다.
export function cellText($, cell, fixes = []) {
  const c = $(cell).clone();
  c.find("p, li, div").append("\n");
  c.find("br").replaceWith("\n");
  const raw = c.text().split("\n").map(clean).filter(Boolean).join(" ");
  let text = raw.replace(/\s*~\s*/g, "~");
  for (const [from, to] of fixes) text = text.split(from).join(to);
  return { raw, text };
}

// 표 하나를 격자로 풉니다. grid[r][c]는 그 자리를 덮는 원래 칸(합쳐진 칸이면 같은 객체)입니다.
export function expandTable($, table, { fixes = [] } = {}) {
  const trs = $(table).find("tr").toArray().filter((tr) => $(tr).closest("table")[0] === table);
  const grid = trs.map(() => []);
  trs.forEach((tr, r) => {
    let c = 0;
    for (const cell of $(tr).children("th, td").toArray()) {
      while (grid[r][c]) c += 1;
      const rowspan = Math.max(1, Number.parseInt($(cell).attr("rowspan"), 10) || 1);
      const colspan = Math.max(1, Number.parseInt($(cell).attr("colspan"), 10) || 1);
      const info = { ...cellText($, cell, fixes), header: cell.tagName === "th", r0: r, c0: c, rowspan, colspan };
      for (let dr = 0; dr < rowspan && r + dr < trs.length; dr += 1) {
        for (let dc = 0; dc < colspan; dc += 1) grid[r + dr][c + dc] = info;
      }
      c += colspan;
    }
  });
  const width = Math.max(0, ...grid.map((row) => row.length));
  for (const row of grid) for (let c = 0; c < width; c += 1) row[c] ??= null;
  return { grid, width, trs };
}

// 같은 칸이 여러 번 나오면(합쳐진 칸) 한 번만, 빈 칸은 빼고 텍스트 목록으로 만듭니다.
function distinctTexts(cells) {
  const seen = new Set();
  const out = [];
  for (const cell of cells) {
    if (!cell || seen.has(cell) || !cell.text) continue;
    seen.add(cell);
    out.push(cell.text);
  }
  return out;
}

// 격자를 행 단위 기록으로 바꿉니다.
// - 머리글 행: 맨 위에서부터 모든 칸이 <th>인 행
// - 구분(행 이름) 열: 왼쪽 위 머리글 칸이 차지하는 열 수 (예: '구분' colspan 3 → 3열)
export function tableRecords($, table, { fixes = [], labelCols } = {}) {
  const { grid, width, trs } = expandTable($, table, { fixes });
  let headerRows = 0;
  while (headerRows < grid.length && grid[headerRows].every((cell) => cell?.header)) headerRows += 1;
  const labelWidth = labelCols ?? (headerRows ? grid[0][0]?.colspan ?? 1 : 1);
  const headerOf = (c) => distinctTexts(grid.slice(0, headerRows).map((row) => row[c]));

  const labelHeader = distinctTexts(grid.slice(0, headerRows).flatMap((row) => row.slice(0, labelWidth)));
  const columns = [];
  for (let c = labelWidth; c < width; c += 1) columns.push({ index: c, path: headerOf(c) });

  const records = [];
  for (let r = headerRows; r < grid.length; r += 1) {
    const labelCells = grid[r].slice(0, labelWidth);
    records.push({
      row: r,
      labels: distinctTexts(labelCells),
      labelCells: [...new Set(labelCells.filter(Boolean))],
      cells: columns.map((col) => {
        const cell = grid[r][col.index];
        return {
          header: col.path,
          text: cell?.text ?? null,
          raw: cell?.raw ?? null,
          merged: Boolean(cell && cell.r0 !== r),
          r0: cell?.r0 ?? r,
          rowspan: cell?.rowspan ?? 1,
        };
      }),
      // 원문 <tr>에 실제로 적혀 있던 칸 (검수 파일에서 나란히 보여 주기 위함)
      rawCells: $(trs[r]).children("th, td").toArray().map((cell) => cellText($, cell).raw),
    });
  }
  return { headerRows, labelCols: labelWidth, labelHeader, columns, records, width };
}

// #subContent 안의 표를 문서 순서대로 찾아, 바로 앞의 소제목(h2~h4)과
// 그 소제목 뒤·표 앞에 있는 안내 문장들을 함께 돌려줍니다.
export function locateTables($, root) {
  const found = [];
  let heading = "";
  let texts = [];
  const BLOCK = new Set(["p", "li", "dd", "dt", "h5", "h6"]);
  const walk = (node) => {
    for (const child of $(node).contents().toArray()) {
      if (child.type === "text") {
        const t = clean(child.data);
        if (t && !NOISE.some((re) => re.test(t))) texts.push(t);
        continue;
      }
      if (child.type !== "tag") continue;
      const tag = child.tagName;
      if (["script", "style", "noscript", "caption", "colgroup"].includes(tag)) continue;
      if (/^h[2-4]$/.test(tag)) {
        heading = clean($(child).text());
        texts = [];
      } else if (tag === "table") {
        const caption = clean($(child).children("caption").text());
        found.push({ table: child, heading, caption, lead: [...texts] });
        texts = [];
      } else if (BLOCK.has(tag) && !$(child).find("table, h2, h3, h4").length) {
        const t = clean($(child).text());
        if (t && !NOISE.some((re) => re.test(t))) texts.push(t);
      } else {
        walk(child);
      }
    }
  };
  walk(root);
  return found;
}
