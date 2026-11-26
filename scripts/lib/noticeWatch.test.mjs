import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BOARDS,
  isAllowedListUrl,
  parseNoticeList,
  isGlobalOnly,
  findNewPosts,
  buildIssue,
  seenIdsFromText,
  markerFor,
} from "./noticeWatch.mjs";

// 11/26 저장한 목록 페이지의 표 부분(본문 아님)
const hufsList = readFileSync(new URL("./fixtures/notice-list-hufs-11282.html", import.meta.url), "utf8");
const studentList = readFileSync(new URL("./fixtures/notice-list-student-12767.html", import.meta.url), "utf8");

test("고정 목록 4곳만 허용: /bbs/ · ?enc= · 목록 밖 주소 · http는 거부", () => {
  for (const b of BOARDS) assert.ok(isAllowedListUrl(b.url), b.url);
  assert.equal(BOARDS.length, 4);
  assert.equal(isAllowedListUrl("https://www.hufs.ac.kr/bbs/hufs/2181/272350/artclView.do"), false);
  assert.equal(isAllowedListUrl("https://www.hufs.ac.kr/hufs/11282/subview.do?enc=abc"), false);
  assert.equal(isAllowedListUrl("https://www.hufs.ac.kr/hufs/11284/subview.do"), false); // 채용: 목록에 없음
  assert.equal(isAllowedListUrl("http://www.hufs.ac.kr/hufs/11282/subview.do"), false);
  assert.equal(isAllowedListUrl("https://evil.example/hufs/11282/subview.do"), false);
});

test("목록 파싱: 제목 · 게시일 · 글 번호만, 중복 없이", () => {
  const posts = parseNoticeList(hufsList);
  assert.ok(posts.length >= 10, `학사 목록 ${posts.length}건`);
  const first = posts[0];
  assert.equal(first.id, "hufs/2181/272350");
  assert.equal(first.postId, "272350");
  assert.match(first.title, /학생예비군/);
  assert.equal(first.date, "2026-11-23");
  assert.equal(new Set(posts.map((p) => p.id)).size, posts.length);
  for (const p of posts) {
    assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(p.title.length > 0);
    assert.equal(p.dept, undefined); // 작성자 칸은 읽지 않음
  }
  const student = parseNoticeList(studentList);
  assert.ok(student.length >= 10);
  assert.ok(student.every((p) => p.site === "student" && p.boardNo === "2431"));
});

test("글로벌캠퍼스 전용 제목은 뺌", () => {
  assert.equal(isGlobalOnly("[글로벌] 2026학년도 2학기 면학장학금 신청 안내"), true);
  assert.equal(isGlobalOnly("학과 신청 공고-글로벌자유전공(글로벌)/글로벌스"), true);
  assert.equal(isGlobalOnly("글로벌홀 기숙사 입사 안내"), false);
  assert.equal(isGlobalOnly("2026학년도 동계방학 HUFS Dorm 사생 모집"), false);
});

test("새 글 비교 · 마감/행사 후보 표시", () => {
  const posts = parseNoticeList(studentList);
  const seen = posts.slice(1).map((p) => p.id);
  const fresh = findNewPosts(posts, seen);
  assert.ok(fresh.every((p) => !seen.includes(p.id)));
  assert.ok(fresh.every((p) => !isGlobalOnly(p.title)));
  assert.deepEqual(findNewPosts(posts, posts.map((p) => p.id)), []);

  const tagged = findNewPosts(
    [
      { id: "hufs/2182/1", title: "2027학년도 장학생 선발 신청 안내", date: "2026-11-26" },
      { id: "hufs/2180/2", title: "진로 특강 안내", date: "2026-11-26" },
      { id: "hufs/2180/3", title: "보안 업데이트 권고", date: "2026-11-26" },
    ],
    [],
  );
  assert.deepEqual(tagged.map((p) => [p.deadlineCandidate, p.eventCandidate]), [[true, false], [false, true], [false, false]]);
});

test("이슈: 새 글 없으면 null, 있으면 후보 체크리스트 + 모든 새 글의 '이미 본 글' 표시", () => {
  assert.equal(buildIssue([], "2026-11-26"), null);
  const fresh = findNewPosts(
    [
      { id: "hufs/2182/1", site: "hufs", boardNo: "2182", postId: "1", title: "장학생 모집", date: "2026-11-26" },
      { id: "hufs/2180/2", site: "hufs", boardNo: "2180", postId: "2", title: "보안 업데이트 권고", date: "2026-11-26" },
    ],
    [],
  ).map((p) => ({ ...p, boardName: "장학", listUrl: BOARDS[2].url }));
  const issue = buildIssue(fresh, "2026-11-26");
  assert.match(issue.title, /^\[공지 알림\] 2026-11-26 새 공지 2건 \(후보 1건\)$/);
  assert.match(issue.body, /- \[ \] 장학생 모집 \(2026-11-26, 장학, 마감 후보\)/);
  assert.match(issue.body, /<details>/);
  assert.deepEqual(seenIdsFromText(issue.body).sort(), ["hufs/2180/2", "hufs/2182/1"]);
  assert.equal(seenIdsFromText(markerFor("student/2431/5")).at(0), "student/2431/5");
  assert.doesNotMatch(issue.body, /\d{2,4}-\d{3,4}-\d{4}/); // 전화번호 없음
});
