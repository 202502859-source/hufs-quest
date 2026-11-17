// 1단계: 학교 공개 학사 페이지를 모아 data/chunks.json으로 저장합니다.
// 실행: npm run collect   (네트워크만 필요, API 키는 필요 없음)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extractPage, toChunks } from "./lib/hufsPage.mjs";
import { buildTableChunks } from "./lib/tableSentences.mjs";
import { renderTableCheck } from "./lib/tableCheck.mjs";
import { TABLE_PAGES } from "./tablePages.mjs";

const ROOT = new URL("../", import.meta.url);
const DELAY_MS = 1500; // 학교 서버에 부담을 주지 않도록 페이지 사이에 쉼
const USER_AGENT = "HUFS-Quest-collector/1.0 (student contest project; public pages only)";

const urls = (await readFile(new URL("scripts/urls.txt", ROOT), "utf8"))
  .split("\n")
  .map((line) => line.replace(/#.*$/, "").trim())
  .filter(Boolean);

const collectedAt = new Date().toISOString();
const all = [];
const failed = [];
const tablePages = []; // 표 정리 조각을 만든 페이지 (검수 파일용)

for (const [i, url] of urls.entries()) {
  const pageId = url.match(/\/(\d+)\/subview\.do/)?.[1] ?? `p${i + 1}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const { title, lines } = extractPage(html);
    if (!lines.length) throw new Error("본문 없음");
    const chunks = toChunks({ pageId, title, url, lines }).map((c) => ({ ...c, collected_at: collectedAt }));
    all.push(...chunks);
    let extra = "";
    const config = TABLE_PAGES[pageId];
    if (config) {
      // 복잡한 표는 '조건이 모두 들어간 문장' 조각을 추가로 만듭니다 (기존 조각은 그대로 둠).
      const table = buildTableChunks({ pageId, title, url, html, config });
      all.push(...table.chunks.map((c) => ({ ...c, collected_at: collectedAt })));
      tablePages.push({ pageId, title, url, reviewNotes: config.reviewNotes, ...table });
      extra = ` + 표 정리 ${table.chunks.length}조각, 보류 ${table.ambiguous.length}행`;
    }
    console.log(`✓ ${title} (${chunks.length}조각${extra})`);
  } catch (err) {
    failed.push(url);
    console.warn(`✗ ${url}: ${err.message}`);
  }
  if (i < urls.length - 1) await new Promise((r) => setTimeout(r, DELAY_MS));
}

await mkdir(new URL("data/", ROOT), { recursive: true });
await writeFile(new URL("data/chunks.json", ROOT), `${JSON.stringify(all, null, 2)}\n`);
console.log(`\n${all.length}개 조각 저장 → data/chunks.json (실패 ${failed.length}페이지)`);
if (tablePages.length) {
  await writeFile(new URL("data/table-check.md", ROOT), renderTableCheck(tablePages, { collectedAt }));
  const n = tablePages.reduce((sum, p) => sum + p.chunks.length, 0);
  const held = tablePages.reduce((sum, p) => sum + p.ambiguous.length, 0);
  console.log(`표 정리 ${n}조각, 보류 ${held}행 → data/table-check.md 에서 원문과 대조해 검수하세요.`);
}
const missingTables = Object.keys(TABLE_PAGES).filter((id) => !tablePages.some((p) => p.pageId === id));
if (missingTables.length) console.warn(`주의: tablePages.mjs의 ${missingTables.join(", ")} 페이지가 urls.txt에 없거나 수집에 실패했습니다.`);
if (failed.length) process.exitCode = 1;
