import test from "node:test";
import assert from "node:assert/strict";

import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync
} from "node:fs";

import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function fixture(t) {
  const dir = mkdtempSync(
    join(tmpdir(), "hufs-calendar-test-")
  );

  t.after(() => {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  for (const folder of [
    "scripts/lib", "data", "shared"
  ]) {
    mkdirSync(join(dir, folder), {
      recursive: true
    });
  }

  for (const file of [
    "scripts/generate-calendar.mjs",
    "scripts/lib/calendarPage.mjs",
    "data/chunks.json"
  ]) {
    copyFileSync(
      new URL("../../" + file, import.meta.url),
      join(dir, file)
    );
  }

  const source = join(dir, "data/chunks.json");

  const target = join(
    dir, "shared/academicCalendar.js"
  );

  const blocker = join(dir, "block-network.mjs");

  writeFileSync(
    blocker,
    'globalThis.fetch = () => { throw new Error("Network blocked"); };'
  );

  function run(...args) {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        pathToFileURL(blocker).href,
        "scripts/generate-calendar.mjs",
        ...args
      ],
      {
        cwd: dir,
        env: {},
        encoding: "utf8",
        timeout: 5000
      }
    );

    assert.ifError(result.error);

    return result;
  }

  return { source, target, run };
}

function success(result) {
  assert.equal(
    result.status,
    0,
    result.stdout + result.stderr
  );
}

function failure(result) {
  assert.notEqual(result.status, 0);
}

test("학사일정 최초 생성 성공", t => {
  const f = fixture(t);

  success(f.run());

  assert.ok(existsSync(f.target));

  assert.match(
    readFileSync(f.target, "utf8"),
    /export const ACADEMIC_CALENDAR/
  );
});

test("기본 재실행은 기존 파일을 덮어쓰지 않음", t => {
  const f = fixture(t);

  success(f.run());

  const before = readFileSync(f.target, "utf8");

  failure(f.run());

  assert.equal(
    readFileSync(f.target, "utf8"),
    before
  );
});

test("원문 일치 검사 성공", t => {
  const f = fixture(t);

  success(f.run());
  success(f.run("--check"));
});

test("생성 데이터 불일치 검출", t => {
  const f = fixture(t);

  success(f.run());

  writeFileSync(f.target, "// changed");

  failure(f.run("--check"));

  assert.equal(
    readFileSync(f.target, "utf8"),
    "// changed"
  );
});

test("명시적 갱신으로 정상 데이터 복원", t => {
  const f = fixture(t);

  success(f.run());

  const expected = readFileSync(f.target, "utf8");

  writeFileSync(f.target, "// changed");

  success(f.run("--update"));

  assert.equal(
    readFileSync(f.target, "utf8"),
    expected
  );
});

test("생성 파일 없이 check 실행 시 실패", t => {
  const f = fixture(t);

  failure(f.run("--check"));

  assert.equal(existsSync(f.target), false);
});

test("생성 파일 없이 update 실행 시 실패", t => {
  const f = fixture(t);

  failure(f.run("--update"));

  assert.equal(existsSync(f.target), false);
});

test("잘못된 옵션 및 중복 옵션 차단", t => {
  const f = fixture(t);

  failure(f.run("--invalid"));
  failure(f.run("--check", "--update"));

  assert.equal(existsSync(f.target), false);
});

test("잘못된 원문으로 갱신 시 기존 파일 보존", t => {
  const f = fixture(t);

  success(f.run());

  const before = readFileSync(f.target, "utf8");

  writeFileSync(f.source, "[]");

  failure(f.run("--update"));

  assert.equal(
    readFileSync(f.target, "utf8"),
    before
  );
});

test("동일한 원문으로 반복 갱신 시 결과 동일", t => {
  const f = fixture(t);

  success(f.run());

  const before = readFileSync(f.target, "utf8");

  success(f.run("--update"));
  success(f.run("--check"));

  assert.equal(
    readFileSync(f.target, "utf8"),
    before
  );
});

test("생성 및 갱신 과정에서 원본 데이터 보존", t => {
  const f = fixture(t);

  const before = readFileSync(f.source, "utf8");

  success(f.run());
  success(f.run("--check"));
  success(f.run("--update"));

  assert.equal(
    readFileSync(f.source, "utf8"),
    before
  );
});
