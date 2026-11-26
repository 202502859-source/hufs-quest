/*
 * 새 공지 알림 (GitHub Actions .github/workflows/notice-watch.yml이 하루 3회 실행)
 *
 * 1. scripts/lib/noticeWatch.mjs의 BOARDS에 고정된 목록 페이지만 1.5초 간격으로 읽습니다(본문 /bbs/는 열지 않음).
 * 2. "이미 본 글" = data/notice-seen.json(처음 기준) + 이 스크립트가 만든 이슈들에 숨겨 둔 표시.
 *    이렇게 하면 Actions에 저장소 쓰기 권한(contents: write) 없이 이슈 권한만으로 상태를 이어 갈 수 있습니다.
 * 3. 새 글이 있으면 이슈 1개를 만들고 담당자(NOTICE_ASSIGNEE)를 지정합니다.
 *
 * NCP 키 · 다른 비밀 값을 쓰지 않습니다. GitHub가 자동으로 주는 GITHUB_TOKEN만 씁니다.
 *
 * 실행
 *   node scripts/notice-watch.mjs --dry-run                 목록을 읽어 이슈 내용만 출력(이슈 안 만듦)
 *   node scripts/notice-watch.mjs --dry-run --from-dir DIR  DIR/<게시판 key>.html을 읽음(학교 사이트 접속 없음)
 *   node scripts/notice-watch.mjs --write-seen [--from-dir DIR]  지금 목록의 글을 모두 data/notice-seen.json에 기준으로 저장
 *   (Actions) GITHUB_TOKEN · GITHUB_REPOSITORY · NOTICE_ASSIGNEE 환경 변수와 함께 옵션 없이 실행
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BOARDS, isAllowedListUrl, parseNoticeList, findNewPosts, buildIssue, seenIdsFromText } from "./lib/noticeWatch.mjs";

const SEEN_FILE = "data/notice-seen.json";
const DELAY_MS = 1500; // 학교 서버 부담을 줄이려는 간격(scripts/collect.mjs와 같음)
const ISSUE_PREFIX = "[공지 알림]";
const USER_AGENT = "HUFS-Quest-notice-watch (student contest project; list pages only)";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const writeSeen = args.includes("--write-seen");
const fromDirIdx = args.indexOf("--from-dir");
const fromDir = fromDirIdx >= 0 ? args[fromDirIdx + 1] : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function kstToday() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function loadBoardHtml(board, index) {
  if (fromDir) return readFile(path.join(fromDir, `${board.key}.html`), "utf8");
  if (!isAllowedListUrl(board.url)) throw new Error(`허용 목록 밖 주소: ${board.url}`);
  if (index > 0) await sleep(DELAY_MS);
  const res = await fetch(board.url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "error", // 다른 주소로 넘어가면 따라가지 않음
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`${board.name} 목록 HTTP ${res.status}`);
  return res.text();
}

async function readSeenFile() {
  try {
    const data = JSON.parse(await readFile(SEEN_FILE, "utf8"));
    return Array.isArray(data.ids) ? data.ids : [];
  } catch {
    return [];
  }
}

async function github(pathname, init = {}) {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) throw new Error("GITHUB_REPOSITORY · GITHUB_TOKEN이 없습니다(Actions에서만 이슈를 만듭니다). 로컬은 --dry-run");
  const res = await fetch(`https://api.github.com/repos/${repo}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${pathname} HTTP ${res.status}`);
  return res.json();
}

// 이 스크립트가 만든 이슈(열림 · 닫힘 모두)에 숨겨 둔 "이미 본 글" 표시를 모읍니다.
async function seenIdsFromIssues() {
  const ids = [];
  for (let page = 1; page <= 10; page++) {
    const issues = await github(`/issues?state=all&creator=${encodeURIComponent("github-actions[bot]")}&per_page=100&page=${page}`);
    for (const issue of issues) {
      if (issue.title?.startsWith(ISSUE_PREFIX)) ids.push(...seenIdsFromText(issue.body));
    }
    if (issues.length < 100) break;
  }
  return ids;
}

async function main() {
  const all = [];
  for (const [i, board] of BOARDS.entries()) {
    const html = await loadBoardHtml(board, i);
    const posts = parseNoticeList(html).map((p) => ({ ...p, boardName: board.name, listUrl: board.url }));
    if (!posts.length) console.warn(`경고: ${board.name} 목록에서 글을 찾지 못함(페이지 모양이 바뀌었을 수 있음)`);
    console.log(`${board.name}: 글 ${posts.length}건`);
    all.push(...posts);
  }

  if (writeSeen) {
    const ids = [...new Set([...(await readSeenFile()), ...all.map((p) => p.id)])].sort();
    await writeFile(SEEN_FILE, JSON.stringify({ note: "notice-watch 처음 기준: 여기 있는 글은 알림을 보내지 않음. 이후 상태는 이슈의 notice-seen 표시로 이어감", updatedOn: kstToday(), ids }, null, 2) + "\n");
    console.log(`${SEEN_FILE}에 ${ids.length}건 저장`);
    return;
  }

  const seen = [...(await readSeenFile()), ...(dryRun ? [] : await seenIdsFromIssues())];
  const fresh = findNewPosts(all, seen);
  const issue = buildIssue(fresh, kstToday());
  if (!issue) {
    console.log("새 글 없음");
    return;
  }
  if (dryRun) {
    console.log(`\n=== 이슈 미리보기 (만들지 않음) ===\n${issue.title}\n\n${issue.body}`);
    return;
  }
  const assignee = process.env.NOTICE_ASSIGNEE;
  const created = await github("/issues", {
    method: "POST",
    body: JSON.stringify({ title: issue.title, body: issue.body, assignees: assignee ? [assignee] : [] }),
  });
  console.log(`이슈 생성: ${created.html_url}`);
}

main().catch((error) => {
  console.error("공지 알림 실패:", error.message);
  process.exitCode = 1;
});
