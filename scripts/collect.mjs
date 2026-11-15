// 1단계: 학교 공개 학사 페이지를 모아 data/chunks.json으로 저장합니다.
// 실행: npm run collect   (네트워크만 필요, API 키는 필요 없음)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extractPage, toChunks } from "./lib/hufsPage.mjs";

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

for (const [i, url] of urls.entries()) {
  const pageId = url.match(/\/(\d+)\/subview\.do/)?.[1] ?? `p${i + 1}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { title, lines } = extractPage(await res.text());
    if (!lines.length) throw new Error("본문 없음");
    const chunks = toChunks({ pageId, title, url, lines }).map((c) => ({ ...c, collected_at: collectedAt }));
    all.push(...chunks);
    console.log(`✓ ${title} (${chunks.length}조각)`);
  } catch (err) {
    failed.push(url);
    console.warn(`✗ ${url}: ${err.message}`);
  }
  if (i < urls.length - 1) await new Promise((r) => setTimeout(r, DELAY_MS));
}

await mkdir(new URL("data/", ROOT), { recursive: true });
await writeFile(new URL("data/chunks.json", ROOT), `${JSON.stringify(all, null, 2)}\n`);
console.log(`\n${all.length}개 조각 저장 → data/chunks.json (실패 ${failed.length}페이지)`);
if (failed.length) process.exitCode = 1;
