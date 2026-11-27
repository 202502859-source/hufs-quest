/*
 * 공지 초안 만들기: 붙여 넣은 공지 본문 → AI 초안 → shared/deadlines.js 항목(checked 없이) → Draft PR
 * (작업지시서 11/26 작업 1, 사용법 docs/NOTICE_FLOW.md)
 *
 *   npm.cmd run notice:draft -- .local/notices/272350.txt https://www.hufs.ac.kr/bbs/hufs/2181/272350/artclView.do
 *
 * 옵션
 *   --no-git            파일만 고치고 브랜치 · 커밋 · push · PR은 하지 않음
 *   --dry-run           파일도 고치지 않고 초안 · 비교표만 출력
 *   --from-output FILE  AI를 부르지 않고, 저장해 둔 도우미 출력(FILE)을 씀(시험용)
 *
 * 하는 일
 *  1. 공지 추출 도우미(scripts/extract-notice.mjs)를 실행합니다. .env의 CLOVA_API_KEY는 node가 읽기만 합니다(이 파일은 키를 다루지 않음).
 *     도우미는 원문 근거 검사(noticeEvidence)를 거친 값만 초안에 남깁니다. 중혁 님 HCX-007 도우미로 바뀌면 EXTRACTOR만 바꿉니다.
 *  2. 새 브랜치 data/notice-<글번호>(origin/main 기준)에서 shared/deadlines.js 끝에 항목을 넣습니다. checked는 비워 둡니다.
 *  3. 커밋 · push 후 gh로 Draft PR을 만듭니다(gh가 없으면 PR 만들기 주소를 출력).
 *  4. "원문 근거 문장 ↔ 입력값" 비교표를 출력하고 .local/notice-draft-<글번호>.md에도 저장합니다.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseExtractOutput, parseArticleUrl, buildDeadlineEntry, insertDeadline, comparisonTable } from "./lib/noticeDraft.mjs";

import { validPublishedAt } from "./lib/noticeHcx007Date.mjs";

const EXTRACTOR = "scripts/extract-notice.mjs"; // 지금 도우미(HCX-005). HCX-007 도우미가 Merge되면 여기만 바꿈
const DEADLINES_FILE = "shared/deadlines.js";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const fromOutput = option("--from-output");
const publishedAt = option("--published-at");
const positional = argv.filter((a, i) =>
  !a.startsWith("--") &&
  argv[i - 1] !== "--from-output" &&
  argv[i - 1] !== "--published-at"
);
const [noticeFile, articleUrl] = positional;
const dryRun = flag("--dry-run");
const useGit = !flag("--no-git") && !dryRun;

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

function runExtractor() {
  // 기존 HCX-005 운영 경로는 현규가 직접 전환한다.
  if (publishedAt && EXTRACTOR === "scripts/extract-notice.mjs") {
    throw new Error("게시일 옵션은 HCX-007 연동 이후 사용할 수 있습니다.");
  }

  const extractorArgs = [
    "--env-file=.env",
    EXTRACTOR,
    noticeFile,
    articleUrl,
    ...(publishedAt ? ["--published-at", publishedAt] : []),
  ];

  const r = spawnSync(
    process.execPath,
    extractorArgs,
    { encoding: "utf8" }
  );
  if (r.status !== 0) throw new Error(`공지 추출 도우미 실패:\n${r.stderr || r.stdout}`);
  return r.stdout;
}

function hasGh() {
  return spawnSync("gh", ["--version"], { encoding: "utf8" }).status === 0;
}

async function main() {
  if (
    argv.filter(a => a === "--published-at").length > 1 ||
    (flag("--published-at") && !validPublishedAt(publishedAt))
  ) {
    throw new Error("게시일은 YYYY-MM-DD 형식의 실제 날짜로 입력하세요.");
  }

  if (!noticeFile || !articleUrl) {
    throw new Error("사용법: npm.cmd run notice:draft -- <본문 파일> <원문 주소>");
  }
  const { postId } = parseArticleUrl(articleUrl);
  const branch = `data/notice-${postId}`;

  // 1. AI 초안
  const output = fromOutput ? await readFile(fromOutput, "utf8") : runExtractor();
  const { draft, evidence, reviewNotes } = parseExtractOutput(output);
  const { entry, problems } = buildDeadlineEntry(draft, articleUrl);

  // 기존 확인 목록과 함께 로컬 검수 문서 및 Draft PR에 전달한다.
  problems.push(
    ...reviewNotes.map(note => "마감 검수: " + note)
  );
  const table = comparisonTable(entry, evidence);

  console.log("\n=== 원문 근거 문장 ↔ 입력값 비교표 ===");
  console.log(table);
  console.log("\n=== 확인할 것 ===");
  for (const p of problems) console.log(`- ${p}`);

  await mkdir(".local", { recursive: true });
  const note = `# 공지 초안 ${postId}\n\n원문: ${entry.url}\n\n${table}\n\n## 확인할 것\n${problems.map((p) => `- ${p}`).join("\n")}\n`;
  await writeFile(`.local/notice-draft-${postId}.md`, note);

  if (dryRun) return console.log("\n(--dry-run) 파일을 고치지 않았습니다.");

  // 2. 새 브랜치에서 deadlines.js에 항목 추가
  if (useGit) {
    if (git("status", "--porcelain", "--untracked-files=no")) {
      throw new Error("커밋하지 않은 변경이 있어 브랜치를 바꿀 수 없습니다. 먼저 커밋하거나 정리해 주세요.");
    }
    git("fetch", "origin", "main");
    git("checkout", "-b", branch, "origin/main");
  }
  const source = await readFile(DEADLINES_FILE, "utf8");
  await writeFile(DEADLINES_FILE, insertDeadline(source, entry));
  console.log(`\n${DEADLINES_FILE}에 ${entry.id} 추가(checked 없음).`);
  if (!useGit) return;

  // 3. 커밋 · push · Draft PR
  git("add", DEADLINES_FILE);
  git("commit", "-m", `data(deadlines): 공지 ${postId} AI 초안 추가 (checked 없음, 원문 대조 전)`);
  git("push", "-u", "origin", branch);

  const prBody = [
    "## 무엇을 했나요",
    `공지 ${postId} 마감 초안을 notice:draft(공지 추출 도우미 + 원문 근거 검사)로 넣었습니다. **checked가 비어 있어 테스트가 실패하는 것이 정상**이고, 원문 대조 뒤 채웁니다.`,
    "",
    "## 원문 근거 문장 ↔ 입력값",
    table,
    "",
    "## 확인할 것",
    ...problems.map((p) => `- [ ] ${p}`),
    "",
    "## 작업 기록",
    "- 작업한 사람: 임현규 (AI 초안: 공지 추출 도우미)",
    "- 주 담당이 다른 파일: 없음",
    "",
    "## 체크",
    "- [ ] 원문과 1건씩 대조하고 checked { on, by } 채움",
    "- [ ] 신중혁 교차 검수",
    "- [ ] `.env`나 API 키가 포함되지 않았다",
  ].join("\n");

  if (hasGh()) {
    const url = execFileSync(
      "gh",
      ["pr", "create", "--draft", "--base", "main", "--head", branch, "--title", `data(deadlines): 공지 ${postId} 초안 (원문 대조 전)`, "--body", prBody],
      { encoding: "utf8" },
    ).trim();
    console.log(`\nDraft PR: ${url}`);
  } else {
    const remote = git("remote", "get-url", "origin").replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/");
    await writeFile(`.local/notice-draft-${postId}-pr.md`, prBody + "\n");
    console.log(`\ngh가 없어 PR을 직접 만들어 주세요(본문은 .local/notice-draft-${postId}-pr.md):\n${remote}/compare/main...${branch}?expand=1`);
  }
  console.log(`\n다음: 원문과 대조해 ${DEADLINES_FILE}의 ${entry.id}에 영문 칸과 checked를 채우고 커밋 · push.`);
}

main().catch((error) => {
  console.error("공지 초안 실패:", error.message);
  process.exitCode = 1;
});
