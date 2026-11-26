// 학교 행사(shared/events.js · shared/eventCalc.js · api/events.js)의 형식 · 출처 · 날짜 규칙을 확인합니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { EVENTS } from "../shared/events.js";
import { EVENT_WINDOW_DAYS, activeEventCount, eventProblems, eventStatus, upcomingEvents } from "../shared/eventCalc.js";
import handler, { eventsResponse } from "../api/events.js";
import { demoEvents, demoEventsEnabled } from "../src/data/eventsApi.js";
import { BUILDING_INFO } from "../src/data/buildingInfo.js";

// 2026-11-24(화) 12:00 한국 시간
const NOW = Date.parse("2026-11-24T12:00:00+09:00");

const valid = (over = {}) => ({
  id: "evt-test",
  title: { ko: "테스트 행사", en: "Test event" },
  host: { ko: "총학생회", en: "Student council" },
  summary: { ko: "행사 내용", en: "What happens" },
  startsAt: "2026-11-26T10:00:00+09:00",
  endsAt: "2026-11-26T18:00:00+09:00",
  place: { ko: "도서관", en: "Library" },
  buildingId: "library",
  category: "festival",
  sourceType: "school",
  url: "https://www.hufs.ac.kr/hufs/11281/subview.do",
  checked: { on: "2026-11-24", by: "테스트" },
  ...over,
});

test("실제 데이터(shared/events.js): 모든 항목이 형식 · 출처 규칙을 지킴, id는 겹치지 않음, buildingId는 실제 건물", () => {
  const ids = new Set();
  for (const e of EVENTS) {
    assert.deepEqual(eventProblems(e), [], `${e.id}`);
    assert.ok(!ids.has(e.id), `${e.id}: id 중복`);
    ids.add(e.id);
    if (e.buildingId) assert.ok(BUILDING_INFO[e.buildingId], `${e.id}: buildingId ${e.buildingId}가 buildingInfo.js에 없음`);
    assert.ok(!e.demo, `${e.id}: 실제 데이터에 demo 표시`);
    assert.doesNotMatch(e.title.ko, /\[예시\]/, `${e.id}: 실제 데이터에 [예시]`);
  }
});

test("형식 규칙: 올바른 school 항목은 통과", () => {
  assert.deepEqual(eventProblems(valid()), []);
});

test("형식 규칙: 시각은 +09:00, 한국어 · 영어, category, checked", () => {
  assert.ok(eventProblems(valid({ startsAt: "2026-11-26T10:00:00Z" })).some((p) => p.startsWith("startsAt")));
  assert.ok(eventProblems(valid({ endsAt: "2026-11-25T10:00:00+09:00" })).some((p) => p.includes("빠름")));
  assert.ok(eventProblems(valid({ title: { ko: "행사" } })).some((p) => p.startsWith("title")));
  assert.ok(eventProblems(valid({ category: "party" })).some((p) => p.startsWith("category")));
  assert.ok(eventProblems(valid({ checked: { on: "11/24" } })).some((p) => p.startsWith("checked")));
  assert.ok(eventProblems(valid({ note: { ko: "비고만" } })).some((p) => p.startsWith("note")));
});

test("출처 종류: sourceType 값, school · sns는 url 필수, host는 hostConsent 필수", () => {
  assert.ok(eventProblems(valid({ sourceType: "blog" })).some((p) => p.startsWith("sourceType")));
  assert.ok(eventProblems(valid({ url: undefined })).some((p) => p.startsWith("school")));
  assert.ok(eventProblems(valid({ url: "https://example.com/post" })).some((p) => p.startsWith("school")), "school은 *.hufs.ac.kr만");
  assert.deepEqual(eventProblems(valid({ url: "https://builder.hufs.ac.kr/user/indexSub.action?x=1" })), [], "학과 홈페이지(하위 도메인) 허용");
  assert.deepEqual(eventProblems(valid({ sourceType: "sns", url: "https://www.instagram.com/p/abc123/" })), []);
  assert.ok(eventProblems(valid({ sourceType: "sns", url: undefined })).some((p) => p.startsWith("sns")));
  assert.ok(eventProblems(valid({ sourceType: "sns", url: "https://example.com/p/1" })).some((p) => p.startsWith("sns")));
  assert.deepEqual(eventProblems(valid({ sourceType: "host", url: undefined, hostConsent: { on: "2026-11-23" } })), [], "host는 url 없이 가능");
  assert.ok(eventProblems(valid({ sourceType: "host", url: undefined })).some((p) => p.startsWith("host")), "host는 허락 날짜 필수");
});

test("개인정보 · 카톡: 전화번호 · 이메일 · 카카오/오픈채팅 링크 금지", () => {
  assert.ok(eventProblems(valid({ summary: { ko: "문의 010-1234-5678", en: "Call 010-1234-5678" } })).some((p) => p.includes("전화")));
  assert.ok(eventProblems(valid({ signup: { ko: "a.b@hufs.ac.kr로 신청", en: "Email a.b@hufs.ac.kr" } })).some((p) => p.includes("이메일")));
  assert.ok(eventProblems(valid({ sourceType: "sns", url: "https://open.kakao.com/o/abcdef" })).some((p) => p.includes("카카오")));
  assert.ok(eventProblems(valid({ note: { ko: "pf.kakao.com/_x 참고", en: "see pf.kakao.com/_x" } })).some((p) => p.includes("카카오")));
});

test("보여 주는 기준: 진행 중 · 오늘 · 14일 안만, 끝난 행사와 15일 뒤 행사는 숨김, 시작 순", () => {
  const at = (iso) => ({ ...valid(), id: `e${iso}`, startsAt: iso, endsAt: iso });
  const ended = { ...valid(), id: "ended", startsAt: "2026-11-23T10:00:00+09:00", endsAt: "2026-11-24T11:59:00+09:00" };
  const ongoing = { ...valid(), id: "ongoing", startsAt: "2026-11-24T09:00:00+09:00", endsAt: "2026-11-24T18:00:00+09:00" };
  const today = at("2026-11-24T23:00:00+09:00");
  const day14 = at("2026-12-08T23:59:00+09:00");
  const day15 = at("2026-12-09T00:00:00+09:00");
  assert.equal(eventStatus(ended, NOW), "ended");
  assert.equal(eventStatus(ongoing, NOW), "ongoing");
  assert.equal(eventStatus(today, NOW), "today");
  assert.equal(eventStatus(day14, NOW), "upcoming", `${EVENT_WINDOW_DAYS}일째는 보임`);
  assert.equal(eventStatus(day15, NOW), "later", "15일째는 숨김");
  const shown = upcomingEvents([day14, ended, today, day15, ongoing], NOW);
  assert.deepEqual(shown.map((e) => e.id), ["ongoing", today.id, day14.id]);
  assert.equal(activeEventCount(shown), 2, "배지 = 진행 중 + 오늘");
  // 진행 중 경계: 끝나는 시각과 같으면 아직 진행 중
  assert.equal(eventStatus({ ...ongoing, endsAt: "2026-11-24T12:00:00+09:00" }, NOW), "ongoing");
});

test("응답에서 확인한 사람(checked.by) · 주최 측 허락 기록은 빠지고 확인 날짜만 남음", () => {
  const [item] = upcomingEvents([valid({ sourceType: "host", url: undefined, hostConsent: { on: "2026-11-23" } })], NOW);
  assert.equal(item.checked, undefined);
  assert.equal(item.hostConsent, undefined);
  assert.equal(item.checkedOn, "2026-11-24");
  assert.ok(!JSON.stringify(item).includes("테스트\""), "checked.by 값이 응답에 없음");
});

test("빈 데이터: 서버 응답은 빈 목록(화면은 학교 공지 안내)", () => {
  assert.deepEqual(eventsResponse([], NOW).items, []);
});

test("예시 분리: [예시]는 ?demoEvents=1일 때 화면에서만, 서버 응답에는 절대 없음", () => {
  assert.equal(demoEventsEnabled(""), false);
  assert.equal(demoEventsEnabled("?demoEvents=0"), false);
  assert.equal(demoEventsEnabled("?demoEvents=1"), true);
  const demos = upcomingEvents(demoEvents(NOW), NOW);
  assert.ok(demos.length >= 2 && demos.every((e) => e.demo && e.title.ko.startsWith("[예시]")));
  demoEvents(NOW).forEach((e) => assert.deepEqual(eventProblems(e), [], `${e.id}: 예시도 형식 규칙을 지킴`));

  let body = null;
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(b) { body = b; return this; } };
  handler({ method: "GET", url: "/api/events?demoEvents=1", query: { demoEvents: "1" } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.ok(body.items.every((e) => !e.demo), "서버 응답에 예시 없음");
});

test("출처 배지: school · sns · host는 문구 키(한/영 문구 있음), 모르는 값이면 배지 없음", async () => {
  const { sourceBadgeKey } = await import("../src/ui/eventView.js");
  const { setLang, t } = await import("../src/state.js");
  assert.equal(sourceBadgeKey("school"), "eventSourceSchool");
  assert.equal(sourceBadgeKey("sns"), "eventSourceSns");
  assert.equal(sourceBadgeKey("host"), "eventSourceHost");
  for (const unknown of ["blog", "", undefined, null, "toString", "constructor"]) assert.equal(sourceBadgeKey(unknown), null, String(unknown));
  setLang("ko");
  assert.deepEqual(["school", "sns", "host"].map((s) => t(sourceBadgeKey(s))), ["학교 공지", "학생회·동아리 SNS", "주최 측 제공"]);
  setLang("en");
  assert.deepEqual(["school", "sns", "host"].map((s) => t(sourceBadgeKey(s))), ["School notice", "Student org SNS", "Provided by host"]);
  setLang("ko");
});

test("행사 제보하기 링크: 주소가 https://로 시작할 때만, 빈 값이면 만들지 않음(지금 EVENT_REPORT_URL은 비어 있음)", async () => {
  const { reportLinkUrl } = await import("../src/ui/eventView.js");
  const { EVENT_REPORT_URL } = await import("../src/data/eventsApi.js");
  assert.equal(reportLinkUrl(""), null);
  assert.equal(reportLinkUrl(undefined), null);
  assert.equal(reportLinkUrl("http://forms.gle/abc"), null, "http는 안 됨");
  assert.equal(reportLinkUrl("javascript:alert(1)"), null);
  assert.equal(reportLinkUrl("https://forms.gle/abc"), "https://forms.gle/abc");
  assert.equal(EVENT_REPORT_URL, "");
  assert.equal(reportLinkUrl(EVENT_REPORT_URL), null);
});

test("예시(?demoEvents=1)에 sns 예시 1개: 제목 [예시] 학생회 SNS 행사, 실제 계정 주소 아님", () => {
  const sns = demoEvents(NOW).filter((e) => e.sourceType === "sns");
  assert.equal(sns.length, 1);
  assert.equal(sns[0].title.ko, "[예시] 학생회 SNS 행사");
  assert.equal(sns[0].url, "https://www.instagram.com/");
  assert.ok(sns[0].demo);
});
