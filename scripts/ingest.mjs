// 2단계: data/chunks.json을 CLOVA 임베딩으로 벡터화해 Supabase chunks(또는 --target next면 chunks_next) 테이블에 저장합니다.
// 실행: npm run ingest   (.env에 CLOVA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY 필요)
// 옵션: --dry-run  임베딩·저장 없이 조각 수만 확인
//       --keep     이번에 없는 옛 조각을 지우지 않음
//       --target next  실서비스 chunks 대신 시험용 chunks_next 테이블에 저장 · 옛 조각 삭제 · 개수 확인
//                      (supabase/005_chunks_next.sql). 없으면 지금처럼 chunks. --dry-run과 함께 쓸 수 있음
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const EMBED_URL = "https://clovastudio.stream.ntruss.com/v1/api-tools/embedding/v2";
const EMBED_DELAY_MS = 1100; // 테스트 키 호출 한도를 넘지 않도록
const BATCH = 20;
const DIMENSIONS = 1024;
const TABLES = { live: "chunks", next: "chunks_next" };

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const keepOld = args.includes("--keep");
const targetArg = args.find((a) => a.startsWith("--target="))?.split("=")[1]
  ?? (args.includes("--target") ? args[args.indexOf("--target") + 1] : "live");
const TABLE = TABLES[targetArg];
if (!TABLE) {
  console.error(`--target 값은 next만 쓸 수 있습니다 (받은 값: ${targetArg ?? "없음"}). 빼면 실서비스 chunks에 저장합니다.`);
  process.exit(1);
}

const banner = `대상 테이블: ${TABLE}${TABLE === "chunks" ? "  (실서비스 DB)" : "  (시험용)"}${dryRun ? "  [dry-run: 저장 안 함]" : ""}`;
console.log(`${"=".repeat(60)}\n  ${banner}\n${"=".repeat(60)}`);

loadEnv(new URL(".env", ROOT));
const { CLOVA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
const chunks = JSON.parse(await readFile(new URL("data/chunks.json", ROOT), "utf8"));
console.log(`조각 ${chunks.length}개`);
if (dryRun) process.exit(0);

const missing = Object.entries({ CLOVA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY }).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`.env에 ${missing.join(", ")} 값이 없습니다.`);
  process.exit(1);
}
if (!SUPABASE_SERVICE_KEY.startsWith("sb_secret_")) {
  console.warn("주의: SUPABASE_SERVICE_KEY가 sb_secret_ 로 시작하지 않습니다. Secret key가 맞는지 확인하세요.");
}

const rest = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
const supabaseHeaders = { apikey: SUPABASE_SERVICE_KEY, "Content-Type": "application/json" };

const rows = [];
for (const [i, chunk] of chunks.entries()) {
  rows.push({ ...chunk, embedding: await embed(chunk.text) });
  if (process.stdout.isTTY) process.stdout.write(`\r임베딩 ${i + 1}/${chunks.length}`);
  else if ((i + 1) % 20 === 0 || i === chunks.length - 1) console.log(`임베딩 ${i + 1}/${chunks.length}`);
  if (rows.length === BATCH || i === chunks.length - 1) {
    await upsert(rows.splice(0));
  }
  await sleep(EMBED_DELAY_MS);
}
console.log("\n저장 완료");

if (!keepOld) {
  const ids = chunks.map((c) => `"${c.id}"`).join(",");
  const res = await fetch(`${rest}/${TABLE}?id=not.in.(${encodeURIComponent(ids)})`, {
    method: "DELETE",
    headers: { ...supabaseHeaders, Prefer: "return=representation" },
  });
  if (!res.ok) throw new Error(`옛 조각 삭제 실패: HTTP ${res.status} ${await res.text()}`);
  console.log(`옛 조각 ${(await res.json()).length}개 삭제`);
}

const count = await fetch(`${rest}/${TABLE}?select=id`, { headers: { ...supabaseHeaders, Prefer: "count=exact", Range: "0-0" } });
console.log(`Supabase ${TABLE} 테이블: ${count.headers.get("content-range")?.split("/")[1] ?? "?"}행`);

async function embed(text, attempt = 1) {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${CLOVA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 429 && attempt <= 5) {
    await sleep(5000 * attempt);
    return embed(text, attempt + 1);
  }
  const body = await res.json().catch(() => null);
  const vector = body?.result?.embedding;
  if (!res.ok || !Array.isArray(vector)) {
    throw new Error(`임베딩 실패: HTTP ${res.status} ${body?.status?.message ?? ""}`);
  }
  if (vector.length !== DIMENSIONS) throw new Error(`임베딩 차원이 ${vector.length}입니다 (기대값 ${DIMENSIONS})`);
  return vector;
}

async function upsert(batch) {
  const res = await fetch(`${rest}/${TABLE}?on_conflict=id`, {
    method: "POST",
    headers: { ...supabaseHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(batch),
  });
  if (!res.ok) throw new Error(`Supabase 저장 실패: HTTP ${res.status} ${await res.text()}`);
}

function loadEnv(fileUrl) {
  if (!existsSync(fileUrl)) return;
  for (const line of readFileSync(fileUrl, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
