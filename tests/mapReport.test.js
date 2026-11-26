// 게임 안 지도 신고("실제와 달라요")를 확인합니다. 실행: npm test
// shared/mapReport.js(입력 검사) · api/map-report.js(서버, Supabase는 가짜) · supabase/010_map_reports.sql(규칙이 파일에 있는지)
// · src/data/mapReportApi.js(응답 문구) · src/data/rewardNotices.js(알림 종류별 문구)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { MAP_REPORT_KINDS, validateMapReport } from "../shared/mapReport.js";
import { MAP_REPORT_REWARD_EXP } from "../shared/progressRules.js";
import { resetProgressRateLimit } from "../api/_lib/progressServer.js";
import { MAP_REPORT_DAILY_LIMIT, createMapReportHandler } from "../api/map-report.js";
import { createRewardNoticesHandler } from "../api/reward-notices.js";
import { buildMapReportPayload, mapProblemMessageKey, mapReportResultMessage, sendMapReport } from "../src/data/mapReportApi.js";
import { reportMode } from "../src/data/eventReportApi.js";
import { demoNoticeKind, mergeNotices, rewardNoticeText } from "../src/data/rewardNotices.js";
import { reportEntryKind } from "../src/ui/eventView.js";
import { setLang, t } from "../src/state.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const withLang = (lang, fn) => {
  setLang(lang);
  try {
    return fn();
  } finally {
    setLang("ko");
  }
};
const ok = (over = {}) => ({ buildingId: "main", kind: "hours", description: "1층 안내실 운영시간이 바뀌었어요", ...over });

// ───────── 입력 검사 ─────────

test("입력 검사: 건물 · 분류(6가지) · 설명(필수, 200자) · 근거 주소(선택, https만)", () => {
  const ids = ["main", "library"];
  assert.deepEqual(MAP_REPORT_KINDS, ["location", "name", "hours", "phone", "does", "other"]);
  const good = validateMapReport(ok({ description: "  안내실이 2층으로 옮겼어요 ", url: "" }), { buildingIds: ids });
  assert.deepEqual(good, { ok: true, value: { buildingId: "main", kind: "hours", description: "안내실이 2층으로 옮겼어요", url: null } });
  const codes = (over) => validateMapReport(ok(over), { buildingIds: ids }).problems ?? [];
  assert.equal(validateMapReport(ok({ description: "가".repeat(200) }), { buildingIds: ids }).ok, true, "200자는 통과");
  assert.deepEqual(codes({ description: "가".repeat(201) }), [{ field: "description", code: "too_long" }]);
  assert.deepEqual(codes({ description: "  " }), [{ field: "description", code: "required" }]);
  assert.deepEqual(codes({ kind: "rumor" }), [{ field: "kind", code: "unknown" }]);
  assert.deepEqual(codes({ kind: undefined }), [{ field: "kind", code: "required" }]);
  assert.deepEqual(codes({ buildingId: "nowhere" }), [{ field: "buildingId", code: "unknown" }]);
  assert.deepEqual(codes({ buildingId: "" }), [{ field: "buildingId", code: "required" }]);
  assert.deepEqual(codes({ url: "http://www.hufs.ac.kr/" }), [{ field: "url", code: "https_only" }]);
  assert.deepEqual(codes({ url: "https://open.kakao.com/o/abc" }), [{ field: "url", code: "kakao" }]);
  assert.equal(validateMapReport(ok({ url: "https://www.hufs.ac.kr/hufs/11281/subview.do" }), { buildingIds: ids }).ok, true);
  assert.deepEqual(validateMapReport(null).problems, [{ field: "body", code: "type" }]);
});

test("입력 검사: 설명에 전화번호(부서 번호 포함) · 이메일 · 카카오 링크가 있으면 거절(shared/eventReport.js contactProblem 재사용)", () => {
  const codes = (description) => validateMapReport(ok({ kind: "phone", description })).problems ?? [];
  for (const phone of ["02-2173-2114", "02 2173 2114", "0221732114", "010.1234.5678", "+82 2-2173-2114"]) {
    assert.deepEqual(codes(`대표번호가 ${phone}로 바뀌었어요`), [{ field: "description", code: "phone" }], phone);
  }
  assert.deepEqual(codes("담당 메일 abc@hufs.ac.kr"), [{ field: "description", code: "email" }]);
  assert.deepEqual(codes("pf.kakao.com/_x 로 문의"), [{ field: "description", code: "kakao" }]);
  assert.equal(validateMapReport(ok({ kind: "phone", description: "안내실 대표번호가 공식 페이지와 달라요" })).ok, true, "번호 없이 분류만이면 통과");
  assert.equal(mapProblemMessageKey("phone"), "mapFormErrContact");
  assert.equal(t("mapFormErrContact"), "전화번호·이메일은 넣을 수 없어요. 전화번호가 다르면 분류만 '전화번호'로 골라 주세요");
});

// ───────── POST /api/map-report ─────────

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

// 010의 submit_map_report를 흉내: 계정당 하루 p_user_limit, env 전체 p_global_limit
function fakeSupabase({ fail = false, notices = [] } = {}) {
  const reports = [];
  const usage = new Map();
  const calls = [];
  return {
    reports,
    calls,
    auth: {
      async getUser(token) {
        const users = { a: { id: "user-uuid-a", email: "a@hufs.ac.kr" }, gmail: { id: "u-g", email: "g@gmail.com" } };
        return users[token] ? { data: { user: users[token] }, error: null } : { data: { user: null }, error: { message: "bad" } };
      },
    },
    async rpc(fn, p) {
      calls.push({ fn, params: p });
      if (fail) return { data: null, error: { code: "42883" } };
      if (fn === "take_event_reward_notices") return { data: notices.splice(0), error: null };
      const key = `${p.p_env}:${p.p_user_id}`;
      const mine = usage.get(key) ?? 0;
      const all = [...usage.entries()].filter(([k]) => k.startsWith(`${p.p_env}:`)).reduce((s, [, v]) => s + v, 0);
      if (all >= p.p_global_limit) return { data: [{ result: "limited", reason: "global" }], error: null };
      if (mine >= p.p_user_limit) return { data: [{ result: "limited", reason: "day" }], error: null };
      usage.set(key, mine + 1);
      reports.push({ user_id: p.p_user_id, env: p.p_env, building_id: p.p_building_id, kind: p.p_kind, description: p.p_description, source_url: p.p_source_url, status: "open" });
      return { data: [{ result: "ok", reason: null }], error: null };
    },
  };
}

async function post(handler, token, body, method = "POST") {
  const res = createMockRes();
  await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res);
  return res;
}

const quietly = async (fn) => {
  const lines = [];
  const orig = { log: console.log, error: console.error };
  console.log = (...a) => lines.push(a.join(" "));
  console.error = (...a) => lines.push(a.join(" "));
  try {
    await fn();
  } finally {
    Object.assign(console, orig);
  }
  return lines;
};

test("신고 API: 로그인 필수 · 학교 메일만 · POST만, 입력 거절은 400(칸 · 코드만, 저장 안 함)", async () => {
  resetProgressRateLimit();
  const supabase = fakeSupabase();
  const handler = createMapReportHandler({ supabase });
  assert.equal((await post(handler, null, ok())).statusCode, 401);
  assert.equal((await post(handler, "gmail", ok())).statusCode, 403);
  assert.equal((await post(handler, "a", ok(), "GET")).statusCode, 405);
  let res;
  const logs = await quietly(async () => {
    res = await post(handler, "a", ok({ description: "번호 02-2173-2114" }));
  });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "invalid_report", problems: [{ field: "description", code: "phone" }] });
  assert.equal(supabase.calls.length, 0);
  assert.ok(logs.every((l) => !l.includes("2173")));
});

test("신고 API: 접수 → { result: 'received' }, 하루 5건까지(6번째 429), 응답 · 로그에 user_id · 내용 없음", async () => {
  resetProgressRateLimit();
  const supabase = fakeSupabase();
  const handler = createMapReportHandler({ supabase, vercelEnv: "production" });
  const results = [];
  const logs = await quietly(async () => {
    for (let i = 0; i < MAP_REPORT_DAILY_LIMIT + 1; i++) results.push(await post(handler, "a", ok({ description: `운영시간이 달라요 ${i}`, url: i === 0 ? "https://www.hufs.ac.kr/" : undefined })));
  });
  assert.equal(MAP_REPORT_DAILY_LIMIT, 5);
  assert.deepEqual(results.slice(0, 5).map((r) => [r.statusCode, r.body.result]), Array(5).fill([200, "received"]));
  assert.equal(results[5].statusCode, 429);
  assert.deepEqual(results[5].body, { error: "report_limited", reason: "day", limit: 5 });
  assert.equal(supabase.reports.length, 5);
  assert.deepEqual(supabase.reports[0], { user_id: "user-uuid-a", env: "production", building_id: "main", kind: "hours", description: "운영시간이 달라요 0", source_url: "https://www.hufs.ac.kr/", status: "open" });
  assert.equal(supabase.calls[0].params.p_user_limit, 5);
  assert.equal(supabase.calls[0].params.p_global_limit, 300);
  for (const r of results) assert.ok(!JSON.stringify(r.body).includes("user-uuid"));
  const parsed = logs.map((l) => JSON.parse(l));
  assert.ok(parsed.every((l) => Object.keys(l).sort().join() === "api,ms,result"), "로그는 api · result · ms만");
  assert.ok(logs.every((l) => !l.includes("운영시간") && !l.includes("user-uuid")));
});

test("신고 API: DB 오류면 500", async () => {
  resetProgressRateLimit();
  let res;
  await quietly(async () => {
    res = await post(createMapReportHandler({ supabase: fakeSupabase({ fail: true }) }), "a", ok());
  });
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: "report_save_failed" });
});

// ───────── SQL 010 ─────────

test("SQL 010: 테이블 · 한도 · RLS, accepted로 바뀔 때만 신고마다 경험치 20 · 알림, 009 알림 표를 깨지 않고 넓힘", () => {
  const code = read("../supabase/010_map_reports.sql").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.equal(Number(code.match(/v_exp constant integer := (\d+)/)?.[1]), MAP_REPORT_REWARD_EXP);
  assert.equal(MAP_REPORT_REWARD_EXP, 20);
  assert.match(code, /status text NOT NULL DEFAULT 'open' CHECK \(status IN \('open', 'accepted', 'rejected'\)\)/);
  assert.match(code, /kind text NOT NULL CHECK \(kind IN \('location', 'name', 'hours', 'phone', 'does', 'other'\)\)/);
  assert.match(code, /char_length\(description\) BETWEEN 1 AND 200/);
  assert.doesNotMatch(code, /email text/i, "이메일 칼럼 없음");
  assert.match(code, /WHEN \(NEW\.status = 'accepted' AND OLD\.status IS DISTINCT FROM 'accepted'\)/);
  assert.match(code, /VALUES \(NEW\.user_id, 'map-report', NEW\.id::text, v_exp, 0\)\s+ON CONFLICT \(user_id, source, ref_id\) DO NOTHING/, "신고마다 1번");
  assert.match(code, /IF v_inserted > 0 THEN[\s\S]*total_exp = total_exp \+ v_exp[\s\S]*VALUES \(NEW\.user_id, 'map', NEW\.id, v_exp\)/);
  // 009 넓히기: 기존 행은 kind 'event'로, cluster_id는 nullable, 대상은 하나만
  assert.match(code, /ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'event'/);
  assert.match(code, /ALTER COLUMN cluster_id DROP NOT NULL/);
  assert.match(code, /\(kind = 'event' AND cluster_id IS NOT NULL AND map_report_id IS NULL\)\s+OR \(kind = 'map' AND map_report_id IS NOT NULL AND cluster_id IS NULL\)/);
  assert.match(code, /RETURNS TABLE \(exp integer, kind text\)/);
  assert.match(code, /RETURNING n\.exp, n\.kind/);
  // 보안
  for (const tbl of ["map_reports", "map_report_usage"]) {
    assert.match(code, new RegExp(`ALTER TABLE public\\.${tbl} ENABLE ROW LEVEL SECURITY`));
    assert.match(code, new RegExp(`REVOKE ALL ON TABLE public\\.${tbl} FROM anon, authenticated`));
  }
  assert.doesNotMatch(code, /CREATE POLICY/);
  assert.match(code, /GRANT EXECUTE ON FUNCTION public\.submit_map_report\(uuid, text, text, text, text, text, integer, integer\) TO service_role/);
  assert.match(code, /GRANT EXECUTE ON FUNCTION public\.take_event_reward_notices\(uuid\) TO service_role/);
  // 팀 처리 방법이 파일 위에 있음
  assert.match(read("../supabase/010_map_reports.sql"), /팀이 하는 일[\s\S]*고치는 PR을 merge한 뒤에\*\* accepted/);
});

// ───────── 화면 쪽 ─────────

test("로그인 분기: 게스트 · mock이면 로그인 버튼, 진짜 로그인이면 신고 폼", () => {
  assert.equal(reportEntryKind(reportMode({ authMode: "real", token: null })), "login");
  assert.equal(reportEntryKind(reportMode({ authMode: "mock", token: "mock-access-token" })), "login");
  assert.equal(reportEntryKind(reportMode({ authMode: "real", token: "jwt" })), "form");
});

test("응답 문구: 접수 · 하루 5건 · 로그인 · 다시 시도, 폼 위 안내(ko · en)", () => {
  const text = (status, body) => t(mapReportResultMessage(status, body).key);
  assert.equal(text(200, { result: "received" }), "신고가 접수됐어요. 팀이 확인할게요.");
  assert.equal(mapReportResultMessage(200, { result: "received" }).ok, true);
  assert.equal(text(429, { error: "report_limited" }), "신고는 하루 5건까지 할 수 있어요.");
  assert.equal(text(401, null), "로그인이 필요해요. 다시 로그인한 뒤 신고해 주세요.");
  assert.equal(text(500, null), "잠시 후 다시 시도해 주세요.");
  assert.equal(text(0, null), "잠시 후 다시 시도해 주세요.");
  assert.deepEqual(mapReportResultMessage(400, { problems: [{ field: "description", code: "phone" }] }).problems, [{ field: "description", code: "phone" }]);
  assert.equal(t("mapFormNotice"), "전화번호·이메일·카카오 링크는 넣을 수 없어요. 팀이 확인해 지도를 고치면 경험치 +20을 드려요.");
  withLang("en", () => {
    assert.equal(text(200, { result: "received" }), "Report received. The team will check it.");
    assert.equal(text(429, null), "You can send up to 5 map reports a day.");
  });
});

test("보내기: 빈 근거 주소는 빼고 Bearer 토큰으로 POST, 토큰 없으면 부르지 않음", async () => {
  assert.deepEqual(buildMapReportPayload({ buildingId: "main", kind: "name", description: " 이름이 바뀌었어요 ", url: " " }), { buildingId: "main", kind: "name", description: "이름이 바뀌었어요" });
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    return { status: 200, headers: { get: () => "application/json" }, json: async () => ({ result: "received" }) };
  };
  assert.deepEqual(await sendMapReport({ buildingId: "main" }, { fetchImpl, token: "jwt" }), { status: 200, body: { result: "received" } });
  assert.equal(seen[0].url, "/api/map-report");
  assert.equal(seen[0].init.headers.Authorization, "Bearer jwt");
  assert.deepEqual(await sendMapReport({}, { fetchImpl, token: null }), { status: 401, body: null });
  assert.equal(seen.length, 1);
});

test("알림 종류별 문구: 지도 신고 · 행사 제보 · 둘 다(ko · en), 알림 API가 종류별 건수를 돌려줌", async () => {
  const map = rewardNoticeText({ count: 1, exp: 20, kinds: { event: 0, map: 1 } });
  assert.deepEqual(map, { key: "mapRewardNotice", vars: { count: 1 }, chip: "+20 EXP" });
  assert.equal(t(map.key, map.vars), "신고한 지도 정보가 고쳐져서 경험치가 올랐어요");
  const maps = rewardNoticeText({ count: 2, exp: 40, kinds: { event: 0, map: 2 } });
  assert.equal(t(maps.key, maps.vars), "신고한 지도 정보 2건이 고쳐져서 경험치가 올랐어요");
  const event = rewardNoticeText({ count: 1, exp: 20, kinds: { event: 1, map: 0 } });
  assert.equal(t(event.key, event.vars), "제보한 행사가 확인되어 경험치가 올랐어요");
  const mixed = rewardNoticeText(mergeNotices({ count: 1, exp: 20, kinds: { event: 1, map: 0 } }, { count: 1, exp: 20, kinds: { event: 0, map: 1 } }));
  assert.deepEqual(mixed, { key: "rewardNoticeMixed", vars: { count: 2 }, chip: "+40 EXP" });
  assert.equal(t(mixed.key, mixed.vars), "제보·신고 2건이 반영되어 경험치가 올랐어요");
  withLang("en", () => {
    assert.equal(t(map.key, map.vars), "Your map report was fixed!");
    assert.equal(t(mixed.key, mixed.vars), "2 of your reports were accepted!");
  });
  assert.equal(demoNoticeKind("?demoNotice=map"), "map");
  assert.equal(demoNoticeKind("?demoNotice=1"), "event");
  assert.equal(demoNoticeKind(""), null);

  resetProgressRateLimit();
  const supabase = fakeSupabase({ notices: [{ exp: 20, kind: "event" }, { exp: 20, kind: "map" }, { exp: 20, kind: "map" }] });
  const res = createMockRes();
  await quietly(() => createRewardNoticesHandler({ supabase })({ method: "POST", headers: { authorization: "Bearer a" } }, res));
  assert.deepEqual(res.body, { count: 3, exp: 60, kinds: { event: 1, map: 2 } });
});

test("구글 폼은 화면에서 안 씀(상수 · 함수 · 테스트는 주석과 함께 남김), 서버 함수 수는 Hobby 한도 12 안", () => {
  const strip = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  for (const file of ["../src/ui/officeOverlay.js", "../src/scenes/MapScene.js"]) {
    assert.doesNotMatch(strip(read(file)), /REPORT_FORM_URL|reportFormUrl/, file);
  }
  const info = read("../src/data/buildingInfo.js");
  assert.match(info, /11\/26 게임 안 신고로 교체[^\n]*\nexport const REPORT_FORM_URL =/);
  assert.match(info, /11\/26 게임 안 신고로 교체[^\n]*\nexport function reportFormUrl\(/);
  assert.match(read("../src/ui/officeOverlay.js"), /overlay\.hide\(\{ report: placeId \}\)/);
  assert.match(read("../src/scenes/CampusScene.js"), /if \(result\?\.report\) this\.openMapReport\(result\.report\);/);
  const functions = readdirSync(new URL("../api/", import.meta.url)).filter((f) => f.endsWith(".js"));
  assert.ok(functions.includes("map-report.js"));
  assert.ok(functions.length <= 12, `서버 함수 ${functions.length}개`);
});
