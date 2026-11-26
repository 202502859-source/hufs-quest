// 앱 안 행사 제보 2단계(화면) 순수 함수를 확인합니다. 실행: npm test
// src/data/eventReportApi.js(로그인 분기 · 시각 문자열 · 응답 문구) · src/ui/eventView.js(학생 제보 배지) · src/state.js 문구
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_THRESHOLD,
  buildReportPayload,
  kstDateOf,
  kstTimestamp,
  problemMessageKey,
  reportMode,
  reportResultMessage,
  reportThreshold,
  sendEventReport,
} from "../src/data/eventReportApi.js";
import { validateEventReport } from "../shared/eventReport.js";
import { footerKey, reportEntryKind, showOriginalNote, sourceBadgeKey, sourceBadgeText } from "../src/ui/eventView.js";
import { readFileSync } from "node:fs";
import { setLang, t } from "../src/state.js";

// 2026-11-26(목) 12:00 한국 시간
const NOW = Date.parse("2026-11-26T12:00:00+09:00");

const form = (over = {}) => ({
  title: "외대 겨울 축제",
  host: "",
  date: "2026-12-01",
  startTime: "17:00",
  endDate: "",
  endTime: "21:00",
  place: "학생회관 앞",
  buildingId: "",
  category: "festival",
  summary: "푸드트럭과 공연",
  url: "",
  ...over,
});

const withLang = (lang, fn) => {
  setLang(lang);
  try {
    return fn();
  } finally {
    setLang("ko");
  }
};

test("로그인 분기: 진짜 로그인 + 토큰이면 앱 제보 폼, 아니면 구글 폼 링크", () => {
  assert.equal(reportMode({ authMode: "real", token: "jwt" }), "app");
  assert.equal(reportMode({ authMode: "real", token: null }), "link", "로그인 안 함");
  assert.equal(reportMode({ authMode: "real", token: "" }), "link");
  assert.equal(reportMode({ authMode: "mock", token: "mock-access-token" }), "link", "가짜 로그인은 진짜 토큰이 없음");
  assert.equal(reportMode({ authMode: undefined, token: "jwt" }), "link");
});

test("시각 문자열: 입력한 날짜 · 시각에 +09:00을 그대로 붙임(브라우저 시간대 무관), 형식이 틀리면 빈 글", () => {
  assert.equal(kstTimestamp("2026-12-01", "17:00"), "2026-12-01T17:00:00+09:00");
  assert.equal(kstTimestamp("2026-12-01", "00:00"), "2026-12-01T00:00:00+09:00", "자정");
  assert.equal(kstTimestamp("2026-12-31", "23:59"), "2026-12-31T23:59:00+09:00");
  for (const [d, h] of [["2026-02-30", "10:00"], ["2026-13-01", "10:00"], ["2026-12-01", "24:00"], ["2026-12-01", "9:00"], ["2026-12-01", "10:00:00"], ["", "10:00"], ["2026-12-01", ""], [undefined, undefined]]) {
    assert.equal(kstTimestamp(d, h), "", `${d} ${h}`);
  }
  // 만든 문자열은 서버 형식 규칙(+09:00)과 같은 순간을 가리킴
  assert.equal(Date.parse(kstTimestamp("2026-12-01", "00:30")), Date.parse("2026-11-30T15:30:00Z"));
});

test("날짜 기본값: 한국 날짜 기준(UTC로는 전날이어도 한국 자정이 지나면 다음 날)", () => {
  assert.equal(kstDateOf(Date.parse("2026-11-26T14:59:00Z")), "2026-11-26", "한국 23:59");
  assert.equal(kstDateOf(Date.parse("2026-11-26T15:00:00Z")), "2026-11-27", "한국 자정");
  assert.equal(kstDateOf(Date.parse("2026-12-31T15:30:00Z")), "2027-01-01", "해 넘김");
});

test("폼 → 보낼 제보: 끝 날짜는 기본 같은 날, 바꾸면 그날(자정 넘김), 빈 선택 칸은 빼고, 서버 규칙 통과", () => {
  const same = buildReportPayload(form());
  assert.deepEqual(same, {
    title: "외대 겨울 축제",
    place: "학생회관 앞",
    summary: "푸드트럭과 공연",
    category: "festival",
    startsAt: "2026-12-01T17:00:00+09:00",
    endsAt: "2026-12-01T21:00:00+09:00",
  });
  assert.equal(validateEventReport(same, { nowMs: NOW }).ok, true);

  const overnight = buildReportPayload(form({ startTime: "23:00", endDate: "2026-12-02", endTime: "01:00", host: " 총학생회 ", buildingId: "union", url: "https://www.hufs.ac.kr/" }));
  assert.equal(overnight.endsAt, "2026-12-02T01:00:00+09:00", "자정을 넘겨 다음 날 끝남");
  assert.equal(overnight.host, "총학생회");
  assert.equal(overnight.buildingId, "union");
  assert.equal(overnight.url, "https://www.hufs.ac.kr/");
  assert.equal(validateEventReport(overnight, { nowMs: NOW, buildingIds: ["union"] }).ok, true);

  // 끝 날짜를 안 바꾸고 끝 시각이 시작보다 빠르면 서버 규칙이 거절(endsAt range)
  const backwards = validateEventReport(buildReportPayload(form({ startTime: "23:00", endTime: "01:00" })), { nowMs: NOW });
  assert.deepEqual(backwards.problems, [{ field: "endsAt", code: "range" }]);
  // 시각을 안 넣으면 required
  assert.deepEqual(validateEventReport(buildReportPayload(form({ startTime: "" })), { nowMs: NOW }).problems, [{ field: "startsAt", code: "required" }]);
});

test("칸 오류 문구: 연락처 · 카카오는 하나로, range는 시작 · 끝을 나눠서", () => {
  for (const code of ["phone", "email", "kakao"]) assert.equal(problemMessageKey("summary", code), "eventFormErrContact");
  assert.equal(problemMessageKey("startsAt", "range"), "eventFormErrStartRange");
  assert.equal(problemMessageKey("endsAt", "range"), "eventFormErrEndRange");
  assert.equal(problemMessageKey("title", "required"), "eventFormErrRequired");
  assert.equal(problemMessageKey("title", "too_long"), "eventFormErrTooLong");
  assert.equal(problemMessageKey("url", "https_only"), "eventFormErrHttps");
  assert.equal(problemMessageKey("x", "???"), "eventFormErrFormat");
  assert.equal(t("eventFormErrContact"), "연락처·카카오 링크는 넣을 수 없어요");
  assert.equal(t("eventFormErrStartRange"), "오늘부터 14일 안 행사만 제보할 수 있어요");
});

test("응답 → 문구: new · joined(R명 / 0명) · published · duplicate · 429 · 401 · 그 밖", () => {
  const text = (status, body) => {
    const m = reportResultMessage(status, body);
    return t(m.key, m.vars);
  };
  assert.equal(text(200, { result: "new", reporters: 1, threshold: 5 }), "접수됐어요. 같은 행사 제보 1명 / 기준 5명");
  assert.equal(text(200, { result: "joined", reporters: 3, threshold: 5 }), "접수됐어요. 같은 행사 제보 3명 / 기준 5명");
  assert.equal(text(200, { result: "joined", reporters: 0, threshold: 5 }), "접수됐어요.", "숨긴 묶음(reporters 0)은 숫자 없이");
  assert.equal(text(200, { result: "published", reporters: 5, threshold: 5 }), "기준 인원이 모여 행사창에 올라갔어요!");
  assert.equal(text(200, { result: "duplicate", reporters: 4, threshold: 5 }), "이미 이 행사를 제보했어요.");
  assert.equal(text(429, { error: "report_limited" }), "제보는 하루 3건까지 할 수 있어요.");
  assert.equal(text(401, { error: "unauthorized" }), "로그인이 필요해요. 다시 로그인한 뒤 제보해 주세요.");
  assert.equal(text(500, { error: "report_save_failed" }), "잠시 후 다시 시도해 주세요.");
  assert.equal(text(0, null), "잠시 후 다시 시도해 주세요.", "네트워크 오류");
  assert.equal(text(200, { result: "weird" }), "잠시 후 다시 시도해 주세요.");
  assert.equal(text(200, { result: "new", reporters: 1, threshold: 2 }), "접수됐어요. 같은 행사 제보 1명 / 기준 2명", "기준은 서버 응답 값");

  // 성공이면 폼 비움(ok), published면 목록 새로고침, duplicate는 성공 아님
  assert.deepEqual(["new", "joined", "published", "duplicate"].map((r) => reportResultMessage(200, { result: r, reporters: 1 }).ok), [true, true, true, false]);
  assert.equal(reportResultMessage(200, { result: "published" }).published, true);
  assert.equal(reportResultMessage(200, { result: "joined", reporters: 2 }).published, false);
  const fix = reportResultMessage(400, { error: "invalid_report", problems: [{ field: "summary", code: "phone" }] });
  assert.deepEqual([fix.key, fix.problems], ["eventReportFix", [{ field: "summary", code: "phone" }]]);

  withLang("en", () => {
    assert.equal(text(200, { result: "joined", reporters: 2, threshold: 5 }), "Received. Reports for this event: 2 / 5 needed");
    assert.equal(text(200, { result: "joined", reporters: 0, threshold: 5 }), "Received.");
  });
});

test("학생 제보 배지: 미확인 · 팀 확인(ko · en), 기존 배지는 그대로, 영어 화면 원문 안내", () => {
  assert.equal(sourceBadgeKey("crowd"), "eventSourceCrowd");
  assert.equal(sourceBadgeKey("crowd", true), "eventSourceCrowdChecked");
  assert.equal(sourceBadgeKey("school", true), "eventSourceSchool", "confirmed는 crowd에만");
  assert.equal(sourceBadgeKey("unknown"), null);
  const unverified = { sourceType: "crowd", reporters: 5, confirmed: false };
  const checked = { sourceType: "crowd", reporters: 7, confirmed: true };
  assert.equal(sourceBadgeText(unverified, t), "학생 제보 5명 · 미확인");
  assert.equal(sourceBadgeText(checked, t), "학생 제보 7명 · 팀 확인");
  assert.equal(sourceBadgeText({ sourceType: "school" }, t), "학교 공지");
  assert.equal(sourceBadgeText({ sourceType: "blog" }, t), null);
  withLang("en", () => {
    assert.equal(sourceBadgeText(unverified, t), "Student reports: 5 · Unverified");
    assert.equal(sourceBadgeText(checked, t), "Student reports: 7 · Team checked");
    assert.equal(t("eventCrowdOriginal"), "Original text (Korean)");
  });
  assert.equal(showOriginalNote(unverified, "en"), true);
  assert.equal(showOriginalNote(unverified, "ko"), false);
  assert.equal(showOriginalNote({ sourceType: "school" }, "en"), false);
});

test("창 아래 안내문: 학생 제보(crowd)가 하나라도 있으면 미확인 안내 문구, 없으면 기존 문구 그대로(ko · en)", () => {
  const school = { sourceType: "school" };
  const crowd = { sourceType: "crowd", reporters: 5, confirmed: false };
  assert.equal(footerKey([school]), "eventFooter");
  assert.equal(footerKey([]), "eventFooter");
  assert.equal(footerKey(undefined), "eventFooter", "목록을 아직 못 받았을 때");
  assert.equal(footerKey([school, crowd]), "eventFooterCrowd");
  assert.equal(footerKey([{ ...crowd, confirmed: true }]), "eventFooterCrowd", "팀 확인된 학생 제보만 있어도 같은 문구");
  assert.equal(
    t("eventFooterCrowd"),
    "팀 확인 행사는 원문을 직접 확인해 옮긴 것이고, '미확인' 학생 제보는 아직 팀이 확인하기 전이에요. 일시·장소·신청 방법은 원문이나 주최 측에서 다시 확인하세요.",
  );
  assert.equal(t("eventFooter"), "팀이 원문을 직접 확인해 옮긴 행사예요. 일시 · 장소 · 신청 방법은 원문에서 다시 확인하세요.", "기존 문구는 그대로");
  withLang("en", () => {
    assert.equal(
      t("eventFooterCrowd"),
      "Team-checked events were copied from the original source; 'Unverified' student reports have not been checked by the team yet. Please confirm the time, place and sign-up with the original source or the host.",
    );
    assert.equal(t("eventFooter"), "Events copied by our team after checking the original posts. Please confirm details in the source.");
  });
});

test("폼 위 안내 문구: N은 서버가 알려 준 기준(모르면 5), 비로그인 안내는 기존 문구 + 로그인 안내", () => {
  assert.equal(DEFAULT_THRESHOLD, 5);
  assert.equal(
    t("eventFormNotice", { threshold: 5 }),
    "전화번호·이메일·카카오 링크는 넣을 수 없어요. 로그인한 학생 5명이 같은 행사를 제보하면 '미확인' 표시와 함께 올라가요.",
  );
  assert.equal(t("eventReportNote"), "제보는 팀이 출처를 확인한 뒤 올라가요");
  assert.equal(t("eventReportLoginHint"), "로그인하면 앱에서 바로 제보할 수 있어요");
});

test("보내기: Authorization Bearer 헤더 · JSON 본문, 토큰 없으면 보내지 않고 401, 네트워크 오류는 0, 기준 인원 기억", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    return { status: 200, headers: { get: () => "application/json" }, json: async () => ({ result: "new", reporters: 1, threshold: 2 }) };
  };
  const payload = buildReportPayload(form());
  const res = await sendEventReport(payload, { fetchImpl, token: "jwt-token" });
  assert.deepEqual(res, { status: 200, body: { result: "new", reporters: 1, threshold: 2 } });
  assert.equal(seen[0].url, "/api/event-report");
  assert.equal(seen[0].init.method, "POST");
  assert.equal(seen[0].init.headers.Authorization, "Bearer jwt-token");
  assert.deepEqual(JSON.parse(seen[0].init.body), payload);
  assert.equal(reportThreshold(), 2, "다음 폼 안내의 N");

  assert.deepEqual(await sendEventReport(payload, { fetchImpl, token: null }), { status: 401, body: null });
  assert.equal(seen.length, 1, "토큰이 없으면 서버를 부르지 않음");
  assert.deepEqual(await sendEventReport(payload, { fetchImpl: async () => { throw new Error("offline"); }, token: "jwt" }), { status: 0, body: null });
});

test("새 문구 키는 모두 한국어 · 영어가 있음", () => {
  const keys = [
    "eventSourceCrowd", "eventSourceCrowdChecked", "eventCrowdOriginal", "eventReportLoginHint", "eventReportOpen", "eventFormTitle", "eventFormBack",
    "eventFormNotice", "eventFormName", "eventFormHost", "eventFormHostHint", "eventFormDate", "eventFormStart", "eventFormEndDate", "eventFormEnd",
    "eventFormPlace", "eventFormBuilding", "eventFormBuildingNone", "eventFormCategory", "eventFormSummary", "eventFormUrl", "eventFormRequired",
    "eventFormOptional", "eventFormSubmit", "eventFormSending", "eventFormErrRequired", "eventFormErrTooLong", "eventFormErrContact", "eventFormErrFormat",
    "eventFormErrHttps", "eventFormErrStartRange", "eventFormErrEndRange", "eventReportCount", "eventReportReceived", "eventReportPublished",
    "eventReportDuplicate", "eventReportLimit", "eventReportLogin", "eventReportRetry", "eventReportFix",
  ];
  for (const lang of ["ko", "en"]) {
    withLang(lang, () => {
      for (const key of keys) assert.ok(t(key, { count: 1, threshold: 5 }).trim(), `${lang}: ${key}`);
    });
  }
});

test("게스트 제보 닫음(11/26): 게스트 · mock 로그인이면 '로그인하고 제보하기', 진짜 로그인이면 제보 폼", () => {
  assert.equal(reportEntryKind(reportMode({ authMode: "real", token: null })), "login", "게스트(로그인 안 함)");
  assert.equal(reportEntryKind(reportMode({ authMode: "mock", token: "mock-access-token" })), "login", "가짜 로그인");
  assert.equal(reportEntryKind(reportMode({ authMode: "real", token: "jwt" })), "form", "진짜 로그인");
  assert.equal(t("eventReportLoginButton"), "로그인하고 제보하기");
  withLang("en", () => assert.equal(t("eventReportLoginButton"), "Log in to report"));
});

test("게스트 제보 닫음(11/26): 행사창은 구글 폼 링크를 쓰지 않음, 상수는 주석과 함께 남김, 로그인 버튼은 타이틀 로그인 창으로", () => {
  const overlay = readFileSync(new URL("../src/ui/eventOverlay.js", import.meta.url), "utf8");
  const code = overlay.split("\n").filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n"); // 주석 줄 제외
  assert.doesNotMatch(code, /EVENT_REPORT_URL|reportLinkUrl|eventReportNote|eventReportLoginHint|"eventReportLink"/, "화면에서 구글 폼 링크 · 기존 안내를 쓰지 않음");
  assert.match(overlay, /overlay\.hide\(\{ login: true \}\)/);
  const eventsApi = readFileSync(new URL("../src/data/eventsApi.js", import.meta.url), "utf8");
  assert.match(eventsApi, /11\/26 게스트 제보 닫음으로 화면에서 사용 안 함[^\n]*\n\/\/[^\n]*\nexport const EVENT_REPORT_URL = "https:\/\//, "상수 위 주석");
  const campus = readFileSync(new URL("../src/scenes/CampusScene.js", import.meta.url), "utf8");
  assert.match(campus, /if \(result\?\.login\) this\.goToLogin\(\);/);
  assert.match(campus, /this\.scene\.start\("Title", \{ openLogin: true \}\)/);
  const title = readFileSync(new URL("../src/scenes/TitleScene.js", import.meta.url), "utf8");
  assert.match(title, /else if \(data\?\.openLogin\) this\.begin\("student"\);/, "타이틀의 재학생 로그인과 같은 방식으로 로그인 창");
});

test("행사창 제보 버튼 문구(11/26): '제보하고 경험치 쌓기'", () => {
  assert.equal(t("eventReportOpen"), "제보하고 경험치 쌓기");
  withLang("en", () => assert.equal(t("eventReportOpen"), "Report & earn EXP"));
});
