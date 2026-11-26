/*
 * 새 공지 알림(작업지시서 11/26 작업 1) — 목록 페이지 HTML에서 새 글 후보를 고르는 순수 함수 모음.
 * 네트워크 · 파일 · GitHub 호출은 scripts/notice-watch.mjs가 하고, 이 파일은 테스트하기 쉬운 계산만 합니다.
 *
 * 지키는 것 (docs/OPERATIONS.md 7장, 11/25 · 11/26 학교 답신):
 *  - 읽는 주소는 아래 BOARDS에 고정된 "목록 페이지"(/…/숫자/subview.do, ?enc= 없음)뿐입니다. robots.txt 허용 범위.
 *  - 공지 본문(/bbs/…)은 열지 않습니다. 목록에서 제목 · 게시일 · 글 번호만 뽑습니다.
 *  - 작성자 칸은 읽지 않습니다(사람 이름이 들어갈 수 있어서). 이슈에도 남기지 않습니다.
 */

// 감시할 게시판 (11/26 robots.txt 확인 표, 단톡 공유). 새 게시판은 robots.txt를 다시 보고 PR로만 추가합니다.
export const BOARDS = [
  { key: "hufs-11281", name: "공지(일반)", url: "https://www.hufs.ac.kr/hufs/11281/subview.do" },
  { key: "hufs-11282", name: "학사", url: "https://www.hufs.ac.kr/hufs/11282/subview.do" },
  { key: "hufs-11283", name: "장학", url: "https://www.hufs.ac.kr/hufs/11283/subview.do" },
  { key: "student-12767", name: "학생지원·장학팀 장학(공지)", url: "https://student.hufs.ac.kr/student/12767/subview.do" },
];

const ALLOWED_HOSTS = new Set(["www.hufs.ac.kr", "student.hufs.ac.kr"]);

// 고정 목록에 있는 주소인지, 그리고 robots.txt 금지 모양(/bbs/, ?enc=)이 아닌지 한 번 더 확인합니다.
export function isAllowedListUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || !ALLOWED_HOSTS.has(u.hostname)) return false;
  if (u.search || u.pathname.startsWith("/bbs/")) return false;
  if (!/^\/[a-z]+\/\d+\/subview\.do$/.test(u.pathname)) return false;
  return BOARDS.some((b) => b.url === url);
}

// 마감 후보 · 행사 후보 키워드 (작업지시서 11/26 작업 1 · 작업 2)
export const DEADLINE_KEYWORDS = ["신청", "모집", "접수", "마감", "기한", "제출", "선발"];
export const EVENT_KEYWORDS = ["특강", "설명회", "축제", "행사", "공연"];

const decode = (s) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/**
 * 목록 HTML → [{ id, site, boardNo, postId, title, date, pinned }]
 * id는 "사이트/게시판번호/글번호"(예: "hufs/2181/272350")라 게시판끼리 겹치지 않습니다.
 * 같은 글이 고정 공지 · 일반 목록에 두 번 나오면 한 번만 남깁니다.
 */
export function parseNoticeList(html) {
  const posts = [];
  const seen = new Set();
  const rows = html.match(/<tr[\s>][\s\S]*?<\/tr>/g) ?? [];
  for (const row of rows) {
    const link = row.match(/href="(?:https:\/\/[a-z.]+)?\/bbs\/([a-z]+)\/(\d+)\/(\d+)\/artclView\.do"/);
    if (!link) continue;
    const [, site, boardNo, postId] = link;
    const subject = row.match(/<td class="td-subject">([\s\S]*?)<\/td>/);
    const date = row.match(/<td class="td-date">\s*(\d{4})\.(\d{2})\.(\d{2})\s*<\/td>/);
    if (!subject || !date) continue;
    const id = `${site}/${boardNo}/${postId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    posts.push({
      id,
      site,
      boardNo,
      postId,
      title: decode(subject[1]),
      date: `${date[1]}-${date[2]}-${date[3]}`,
      pinned: /class="notice\b/.test(row),
    });
  }
  return posts;
}

// 글로벌캠퍼스 전용 글은 뺍니다(이 서비스는 서울캠퍼스 기준, CLAUDE.md).
export function isGlobalOnly(title) {
  return /^\s*\[\s*글로벌\s*\]/.test(title) || /\(글로벌\)/.test(title);
}

export function tagPost(post) {
  return {
    ...post,
    deadlineCandidate: DEADLINE_KEYWORDS.some((k) => post.title.includes(k)),
    eventCandidate: EVENT_KEYWORDS.some((k) => post.title.includes(k)),
  };
}

// 이미 본 글을 빼고, 글로벌 전용을 빼고, 후보 표시를 붙입니다.
export function findNewPosts(posts, seenIds) {
  const seen = new Set(seenIds);
  return posts.filter((p) => !seen.has(p.id) && !isGlobalOnly(p.title)).map(tagPost);
}

// 이슈 본문에 숨겨 두는 표시. 다음 실행 때 이 표시를 모아 "이미 본 글"로 씁니다.
const MARKER = /<!-- notice-seen: ([a-z]+\/\d+\/\d+) -->/g;
export const markerFor = (id) => `<!-- notice-seen: ${id} -->`;

export function seenIdsFromText(text) {
  return [...String(text ?? "").matchAll(MARKER)].map((m) => m[1]);
}

const articleUrl = (p) => {
  const host = p.site === "student" ? "student.hufs.ac.kr" : "www.hufs.ac.kr";
  return `https://${host}/bbs/${p.site}/${p.boardNo}/${p.postId}/artclView.do`;
};

/**
 * 새 글 목록 → GitHub 이슈 { title, body }. 새 글이 하나도 없으면 null.
 * 마감 · 행사 후보만 체크리스트로 보이고, 나머지 새 글은 접어 두되 "이미 본 글" 표시는 모두 남깁니다.
 * newPosts의 각 글에는 boardName · listUrl이 붙어 있어야 합니다(notice-watch.mjs가 붙임).
 */
export function buildIssue(newPosts, today) {
  if (!newPosts.length) return null;
  const candidates = newPosts.filter((p) => p.deadlineCandidate || p.eventCandidate);
  const others = newPosts.filter((p) => !p.deadlineCandidate && !p.eventCandidate);
  const line = (p) => {
    const tags = [p.deadlineCandidate && "마감 후보", p.eventCandidate && "행사 후보"].filter(Boolean).join(" · ");
    return `- [ ] ${p.title} (${p.date}, ${p.boardName}${tags ? `, ${tags}` : ""}) — [목록에서 열기](${p.listUrl}) · 글 ${p.postId} · [원문 주소](${articleUrl(p)})`;
  };
  const body = [
    `새 공지 ${newPosts.length}건을 목록 페이지에서 찾았어요. 마감 · 행사 후보 ${candidates.length}건.`,
    "",
    "**할 일:** 후보를 **목록 페이지에서 클릭해** 열고(주소 직접 입력은 막힐 수 있음), 본문을 `.local/notices/글번호.txt`에 붙여 넣은 뒤",
    "`npm.cmd run notice:draft -- .local/notices/글번호.txt <원문 주소>`. 마감이 아닌 글은 \"해당 없음\"으로 체크해 주세요.",
    "",
    candidates.length ? "### 마감 · 행사 후보" : "### 마감 · 행사 후보 없음",
    ...candidates.map(line),
    "",
    ...(others.length
      ? ["<details><summary>그 밖의 새 글 " + others.length + "건</summary>", "", ...others.map(line), "", "</details>", ""]
      : []),
    "_자동 확인: 목록 페이지만 읽고 공지 본문은 열지 않습니다(docs/NOTICE_FLOW.md). 작성자 칸은 기록하지 않습니다._",
    "",
    ...newPosts.map((p) => markerFor(p.id)),
  ].join("\n");
  return { title: `[공지 알림] ${today} 새 공지 ${newPosts.length}건 (후보 ${candidates.length}건)`, body };
}
