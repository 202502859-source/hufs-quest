import test from "node:test";
import assert from "node:assert/strict";

import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  rmSync
} from "node:fs";

import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = mkdtempSync(
  join(tmpdir(), "hufs-ingest-test-")
);

mkdirSync(join(root, "scripts", "lib"), {
  recursive: true
});

mkdirSync(join(root, "data"));

const files = [
  "scripts/ingest.mjs",
  "scripts/lib/retry.mjs",
  "scripts/lib/validateAdvancedChunks.mjs"
];

for (const file of files) {
  copyFileSync(
    new URL("../../" + file, import.meta.url),
    join(root, file)
  );
}

// 외부 API 호출을 차단하는 테스트 전용 파일
writeFileSync(
  join(root, "block-network.mjs"),
  `globalThis.fetch = () => {
    throw new Error("External network blocked");
  };`
);

// 실제 데이터 대신 테스트용 조각 사용
const originals = Array.from(
  { length: 510 },
  (_, i) => ({
    id: `test-${i}`,
    title: "테스트",
    url: "",
    section: null,
    text: "테스트 본문",
    collected_at: "2026-11-26T00:00:00Z"
  })
);

const advanced = Array.from(
  { length: 536 },
  (_, i) => ({
    id: `advanced-${i}`,
    title: "테스트",
    url: "",
    section: null,
    text: "테스트 본문",
    collected_at: "2026-11-26T00:00:00Z",
    parent_id: `advanced-${i}`,
    topic: "registration",
    subtopic: null,
    campus: "seoul",
    cohort_min: null,
    cohort_max: null
  })
);

writeFileSync(
  join(root, "data", "chunks.json"),
  JSON.stringify(originals)
);

writeFileSync(
  join(root, "data", "chunks-next-full.json"),
  JSON.stringify(advanced)
);

function run(args) {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      // 윈도우에서는 "C:\…" 경로를 --import에 그대로 넘기면 주소로 읽지 못해 file:// 주소로 넘깁니다(#92와 같은 수정)
      pathToFileURL(join(root, "block-network.mjs")).href,
      join(root, "scripts", "ingest.mjs"),
      ...args
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 5000,
      env: {}
    }
  );

  assert.ifError(result.error);

  return {
    status: result.status,
    output: result.stdout + result.stderr
  };
}

test("기존 실서비스 dry-run 유지", () => {
  const r = run(["--dry-run"]);

  assert.equal(r.status, 0);
  assert.ok(r.output.includes("대상 테이블: chunks "));
  assert.ok(r.output.includes("조각 510개"));
});

test("기존 시험용 dry-run 유지", () => {
  const r = run([
    "--target", "next", "--dry-run"
  ]);

  assert.equal(r.status, 0);
  assert.ok(r.output.includes("대상 테이블: chunks_next"));
  assert.ok(r.output.includes("조각 510개"));
});

test("개선 데이터 시험용 dry-run", () => {
  const r = run([
    "--target", "next", "--advanced", "--dry-run"
  ]);

  assert.equal(r.status, 0);
  assert.ok(r.output.includes("chunks-next-full.json"));
  assert.ok(r.output.includes("조각 536개"));
});

test("개선 데이터 실서비스 사용 차단", () => {
  const r = run([
    "--advanced", "--dry-run"
  ]);

  assert.equal(r.status, 1);
  assert.ok(r.output.includes("--target next"));
});

test("미확인 개선 데이터 저장 차단", () => {
  const r = run([
    "--target", "next", "--advanced"
  ]);

  assert.equal(r.status, 1);
  assert.ok(r.output.includes("--confirm-advanced"));
});

test("등호 형식의 시험용 대상 옵션 지원", () => {
  const r = run([
    "--target=next", "--advanced", "--dry-run"
  ]);

  assert.equal(r.status, 0);
  assert.ok(r.output.includes("조각 536개"));
});

test("확인 옵션이 있어도 실서비스 저장 차단", () => {
  const r = run([
    "--advanced", "--confirm-advanced"
  ]);

  assert.equal(r.status, 1);
  assert.ok(r.output.includes("--target next"));
});

test.after(() => {
  rmSync(root, {
    recursive: true,
    force: true
  });
});
