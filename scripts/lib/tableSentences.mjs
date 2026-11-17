// tableGrid.mjs로 푼 표의 각 행을 '조건이 모두 들어간 한 문장'으로 바꾸고, 묶음별로 조각을 만듭니다.
// 원칙: 숫자와 조건은 표 원문 칸에서만 가져옵니다. 뜻이 애매한 칸이 있는 행은 문장을 만들지 않고
// ambiguous 목록에 이유와 함께 남깁니다(사람이 검수).
import * as cheerio from "cheerio";
import { locateTables, tableRecords } from "./tableGrid.mjs";

const NUMBER = /^\d+$/;
const NONE = "-";
const YEAR_LABEL = /^\d{4}(~\d{4})?$/;
const MODULE_TRACKS = new Set(["공통", "필수모듈", "선택모듈1", "선택모듈2"]);

export function buildTableChunks({ pageId, title, url, html, config }) {
  const $ = cheerio.load(html);
  const root = $("#subContent").first();
  const located = locateTables($, root.length ? root : $.root());
  const chunks = [];
  const review = [];
  const ambiguous = [];
  const skipped = [];

  located.forEach((loc, tableIndex) => {
    if (config.skip?.[tableIndex]) {
      skipped.push({ pageId, tableIndex, heading: loc.heading || loc.caption, reason: config.skip[tableIndex] });
      return;
    }
    if (config.tables !== "all" && !config.tables.includes(tableIndex)) return;
    const table = tableRecords($, loc.table, { fixes: config.fixes });
    const ctx = {
      pageId,
      title,
      heading: loc.heading,
      prefix: `[${[title, loc.heading].filter(Boolean).join(" > ")}]`,
      lead: loc.lead.at(-1) ?? "",
      tableIndex,
    };
    const build = KINDS[config.kind];
    if (!build) throw new Error(`알 수 없는 kind: ${config.kind}`);
    for (const group of build(ctx, table, ambiguous)) {
      if (!group.sentences.length) continue;
      const id = `${pageId}-t${String(chunks.length + 1).padStart(2, "0")}`;
      const section = [loc.heading, group.label].filter(Boolean).join(" > ");
      const lines = [];
      if (ctx.lead) lines.push(`${ctx.prefix} 표 위 안내: ${ctx.lead}`);
      lines.push(...group.sentences.map((s) => s.text));
      chunks.push({ id, title, url, section: `${section} (표 정리)`, text: lines.join("\n") });
      review.push({ id, tableIndex, heading: loc.heading, lead: ctx.lead, columns: table.columns, sentences: group.sentences });
    }
  });
  return { chunks, review, ambiguous, skipped };
}

// ── 문장 틀 ───────────────────────────────────────────────

const KINDS = {
  // 졸업이수학점: 행 = 대학(+학번) × 이수 유형. "…학생의 졸업학점은 N학점이며, 전공 n학점, … 을 이수해야 한다."
  graduation(ctx, table, ambiguous) {
    const totalCol = table.columns.findIndex((c) => c.path.some((p) => p.includes("졸업학점")));
    if (totalCol < 0) throw new Error(`${ctx.prefix} 졸업학점 열을 찾지 못함`);
    const groups = groupBy(table.records, (rec) => {
      const year = rec.labelCells.find((cell) => YEAR_LABEL.test(cell.text));
      return `${rec.labelCells[0].r0}|${year?.r0 ?? ""}`;
    });
    return groups.map((recs) => {
      const [college] = recs[0].labels;
      const year = recs[0].labels.find((l) => YEAR_LABEL.test(l));
      const who = year ? `${college}(${year})` : college;
      const sentences = [];
      const moduleRows = recs.filter((rec) => MODULE_TRACKS.has(trackOf(rec)[0]));
      for (const rec of recs) {
        if (moduleRows.includes(rec)) {
          ambiguous.push(note(ctx, rec, "전공 열에 '공통·필수모듈·선택모듈' 학점이 들어 있어 전공 학점으로 읽을지 원문 확인이 필요함"));
          continue;
        }
        const bad = rec.cells.find((cell) => cell.text !== NONE && !NUMBER.test(cell.text ?? ""));
        if (bad) {
          ambiguous.push(note(ctx, rec, `'${bad.header.at(-1)}' 칸 값 "${bad.raw}"의 괄호 뜻이 페이지에 설명되어 있지 않음`));
          continue;
        }
        const track = trackOf(rec);
        const trackText = track.length > 1 ? `${track[0]}(${track.slice(1).join(", ")})` : track[0];
        const total = rec.cells[totalCol].text;
        const areas = areaList(rec.cells, totalCol);
        const text = trackText
          ? `${ctx.prefix} ${who}에서 ${trackText}${josa(trackText, "을", "를")} 하는 학생의 졸업학점은 ${total}학점이며, ${areas}을 이수해야 한다.`
          : `${ctx.prefix} ${who} 학생의 졸업학점은 ${total}학점이며, ${areas}을 이수해야 한다.`;
        sentences.push(sentence(rec, text));
      }
      // 모듈 행만 있는 묶음: 묶음 전체에 합쳐진 칸(교양·졸업학점 등)만으로 한 문장을 만듭니다.
      if (moduleRows.length) {
        const first = moduleRows[0];
        const spansGroup = (cell) => cell.r0 === first.row && cell.rowspan >= recs.length;
        const whole = first.cells.map((cell) => (spansGroup(cell) ? cell : { ...cell, text: NONE }));
        const total = whole[totalCol];
        if (NUMBER.test(total.text ?? "")) {
          const areas = areaList(whole, totalCol);
          const text = `${ctx.prefix} ${who} 학생의 졸업학점은 ${total.text}학점이며, ${areas ? `${areas}을 이수해야 한다` : "영역별 학점은 원문 표를 확인해야 한다"}.`;
          sentences.push(sentence(first, text, "묶음 전체에 합쳐진 칸만 사용"));
        }
      }
      return { label: who, sentences };
    });
  },

  // 전과: 행 = 학번 구분, 열 = 이수 학기. "2025학번 부터, 3학기 이수자는 취득 학점 47학점 이상이어야 전과할 수 있다."
  transfer(ctx, table, ambiguous) {
    return table.records.map((rec) => {
      const [what, who] = rec.labels;
      const sentences = [];
      for (const cell of rec.cells) {
        const term = cell.header.at(-1);
        if (!/^\d+학점$/.test(cell.text ?? "")) {
          ambiguous.push(note(ctx, rec, `'${term}' 칸 값 "${cell.text}"이 학점 형식이 아님`));
          continue;
        }
        sentences.push(sentence(rec, `${ctx.prefix} ${who}, ${term}${josa(term, "은", "는")} ${what} ${cell.text} 이상이어야 전과할 수 있다.`, term));
      }
      return { label: who, sentences };
    });
  },

  // 수료: 행 = 수료 학년, 열 = 졸업학점별 수료학점 + 공통 조건. 묶음은 졸업학점(열) 단위.
  completion(ctx, table, ambiguous) {
    const creditCols = table.columns.map((c, i) => [c, i]).filter(([c]) => c.path[0] === "수료학점");
    const condCols = table.columns.map((c, i) => [c, i]).filter(([c]) => c.path[0] !== "수료학점");
    return creditCols.map(([col, ci]) => {
      const kind = col.path.at(-1);
      const sentences = [];
      for (const rec of table.records) {
        const [grade] = rec.labels;
        const cells = [rec.cells[ci], ...condCols.map(([, i]) => rec.cells[i])];
        if (cells.some((cell) => !cell.text || cell.text === NONE)) {
          ambiguous.push(note(ctx, rec, `'${kind}' 행에 빈 칸이 있음`));
          continue;
        }
        const conds = cells.map((cell) => `${cell.header.at(-1) === kind ? "수료학점" : cell.header.at(-1)} ${cell.text}`);
        sentences.push(sentence(rec, `${ctx.prefix} ${kind}${josa(kind, "이", "가")} ${grade}${josa(grade, "을", "를")} 수료하려면 ${conds.join(", ")}이어야 한다.`, kind));
      }
      return { label: kind, sentences };
    });
  },

  // 학석사연계과정 지원자격: 열 = 졸업학점, 행 = 이수학점 기준.
  linked(ctx, table, ambiguous) {
    const topic = table.labelHeader[0] ?? "";
    const sentences = [];
    for (const rec of table.records) {
      const [what] = rec.labels;
      for (const cell of rec.cells) {
        const col = cell.header.at(-1);
        if (!/^\d+학점$/.test(cell.text ?? "")) {
          ambiguous.push(note(ctx, rec, `'${col}' 칸 값 "${cell.text}"이 학점 형식이 아님`));
          continue;
        }
        sentences.push(sentence(rec, `${ctx.prefix} ${topic} ${col}인 학생은 ${what}${josa(what, "이", "가")} ${cell.text} 이상이어야 한다.`, col));
      }
    }
    return [{ label: "", sentences }];
  },
};

// ── 도우미 ───────────────────────────────────────────────

function trackOf(rec) {
  return rec.labels.slice(1).filter((l) => !YEAR_LABEL.test(l));
}

function areaList(cells, totalCol) {
  return cells
    .filter((cell, i) => i !== totalCol && NUMBER.test(cell.text ?? ""))
    .map((cell) => `${cell.header.at(-1)} ${cell.text}학점`)
    .join(", ");
}

function sentence(rec, text, focus = "") {
  return { row: rec.row, labels: rec.labels, rawCells: rec.rawCells, cells: rec.cells, focus, text };
}

function note(ctx, rec, reason) {
  return { pageId: ctx.pageId, heading: ctx.heading || ctx.title, row: rec.row, labels: rec.labels, rawCells: rec.rawCells, reason };
}

function groupBy(items, keyOf) {
  const map = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return [...map.values()];
}

// 마지막 한글 글자에 받침이 있으면 withFinal, 없으면 withoutFinal
export function josa(word, withFinal, withoutFinal) {
  const ch = [...String(word)].reverse().find((c) => /[가-힣]/.test(c));
  if (!ch) return withFinal;
  return (ch.charCodeAt(0) - 0xac00) % 28 ? withFinal : withoutFinal;
}
