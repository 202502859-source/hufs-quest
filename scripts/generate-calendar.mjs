// 수집된 학사일정 원문에서 공유 일정 데이터를 생성합니다.
// 외부 API 및 DB를 사용하지 않습니다.

import {
  readFile,
  writeFile
} from "node:fs/promises";

import { existsSync } from "node:fs";
import { createHash } from "node:crypto";

import {
  structureCalendar,
  CALENDAR_CHUNK_ID
} from "./lib/calendarPage.mjs";

const args = process.argv.slice(2);

if (
  args.length > 1 ||
  args.some(arg => !["--check", "--update"].includes(arg))
) {
  throw new Error("지원하지 않는 calendar 실행 옵션입니다.");
}

const checkOnly = args.includes("--check");
const update = args.includes("--update");

const source = new URL(
  "../data/chunks.json",
  import.meta.url
);

const target = new URL(
  "../shared/academicCalendar.js",
  import.meta.url
);

const original = await readFile(source, "utf8");

const chunks = JSON.parse(original);

const result = structureCalendar(chunks);

const sourceChunks = chunks
  .filter(c => CALENDAR_CHUNK_ID.test(c.id)) // 11/27~ 다른 학년도 화면 조각(11360-YYYY-NN)도 포함
  .sort((a, b) => a.id.localeCompare(b.id));

const sourceHash = createHash("sha256")
  .update(JSON.stringify(sourceChunks))
  .digest("hex");

const data = {
  academicYear: result.academicYear,
  academicYears: result.academicYears,
  sourceHash,
  items: result.items
};

const content = [
  "// 자동 생성 파일: 직접 수정하지 마세요.",
  "// 생성: npm run calendar",
  "// 검증: npm run calendar -- --check",
  "// 갱신: npm run calendar -- --update",
  "",
  "export const ACADEMIC_CALENDAR = " +
    JSON.stringify(data, null, 2) + ";",
  ""
].join("\n");

console.log("학년도:", data.academicYears.join(", "));
console.log("원문 학사일정 조각:", sourceChunks.length);
console.log("구조화 일정 행:", data.items.length);
console.log("학사일정 원문 SHA-256:", sourceHash);

if (checkOnly) {
  if (!existsSync(target)) {
    throw new Error("구조화 학사일정 파일이 없습니다.");
  }

  const existing = await readFile(target, "utf8");

  if (existing !== content) {
    throw new Error("구조화 학사일정과 원문이 일치하지 않습니다.");
  }

  console.log("원문과 구조화 데이터 일치 확인");

} else {

  if (update && !existsSync(target)) {
    throw new Error("갱신할 학사일정 파일이 없습니다.");
  }

  await writeFile(target, content, {
    encoding: "utf8",
    flag: update ? "w" : "wx"
  });

  console.log(
    update
      ? "학사일정 갱신 완료"
      : "학사일정 최초 생성 완료"
  );
}

console.log("대상: shared/academicCalendar.js");
