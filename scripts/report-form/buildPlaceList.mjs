// src/data/buildingInfo.js의 BUILDING_INFO 이름을 읽어 createReportForm.gs의 PLACES 배열을 다시 씁니다.
// 건물 이름을 .gs에 손으로 복사하지 않기 위한 작은 생성 스크립트입니다.
//
// 실행: node scripts/report-form/buildPlaceList.mjs          → .gs의 PLACES 부분을 고쳐 씀
//       node scripts/report-form/buildPlaceList.mjs --check  → 고치지 않고 최신인지만 확인(다르면 종료 코드 1)
//
// .gs 안의 "// <<PLACES:BEGIN>>" 과 "// <<PLACES:END>>" 사이만 바꿉니다. 나머지 코드는 건드리지 않습니다.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUILDING_INFO } from "../../src/data/buildingInfo.js";

export const NOT_LISTED = "목록에 없음(설명에 적어 주세요)";
const GS_PATH = fileURLToPath(new URL("./createReportForm.gs", import.meta.url));
const BEGIN = "// <<PLACES:BEGIN>>";
const END = "// <<PLACES:END>>";

// BUILDING_INFO의 name을 정의된 순서대로 꺼내고, 마지막에 "목록에 없음"을 붙입니다.
export function placeNames(info = BUILDING_INFO) {
  const names = Object.values(info).map((b) => b.name);
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) throw new Error(`건물 이름이 겹칩니다: ${dup} (구글 폼 선택지는 서로 달라야 함)`);
  if (names.some((n) => typeof n !== "string" || !n.trim())) throw new Error("빈 건물 이름이 있습니다");
  return [...names, NOT_LISTED];
}

// PLACES 배열 코드 블록을 만듭니다. JSON.stringify로 따옴표·특수문자를 안전하게 감쌉니다.
export function placesBlock(names) {
  const lines = names.map((n) => `  ${JSON.stringify(n)},`);
  return [
    BEGIN,
    "// 아래 배열은 scripts/report-form/buildPlaceList.mjs가 src/data/buildingInfo.js에서 만듭니다. 손으로 고치지 마세요.",
    "var PLACES = [",
    ...lines,
    "];",
    END,
  ].join("\n");
}

export function replaceBlock(source, block) {
  const start = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  if (start < 0 || end < start) throw new Error(`${BEGIN} … ${END} 표시를 .gs에서 찾지 못했습니다`);
  return source.slice(0, start) + block + source.slice(end + END.length);
}

async function main() {
  const check = process.argv.includes("--check");
  const source = await readFile(GS_PATH, "utf8");
  const next = replaceBlock(source, placesBlock(placeNames()));
  if (check) {
    if (next !== source) {
      console.error("createReportForm.gs의 PLACES가 buildingInfo.js와 다릅니다. buildPlaceList.mjs를 실행하세요.");
      process.exit(1);
    }
    console.log("PLACES 최신 상태");
    return;
  }
  if (next === source) {
    console.log("바뀐 것 없음");
    return;
  }
  await writeFile(GS_PATH, next, "utf8");
  console.log(`PLACES ${placeNames().length}개로 다시 씀: ${GS_PATH}`);
}

// 다른 파일에서 import할 때는 실행하지 않습니다(Windows 드라이브 글자 대소문자 차이는 무시).
const isMain = process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) main();
