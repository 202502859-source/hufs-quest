// 앱 안 행사 제보(shared/eventReport.js · api/event-report.js · api/events.js 학생 제보 합치기)를 확인합니다. 실행: npm test
// Supabase · CLOVA는 가짜(mock)입니다. .env 없이 돌아갑니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contactProblem, validateEventReport } from "../shared/eventReport.js";
import { eventProblems } from "../shared/eventCalc.js";
import { resetProgressRateLimit } from "../api/_lib/progressServer.js";
import {
  EVENT_REPORT_DAILY_LIMIT,
  MATCH_URL,
  candidateRange,
  createEventReportHandler,
  reportEnv,
  reportThreshold,
} from "../api/event-report.js";
import { createEventsHandler, crowdItem } from "../api/events.js";

// 2026-11-26(목) 12:00 한국 시간
const NOW = new Date("2026-11-26T12:00:00+09:00");
const now = () => NOW;

const report = (over = {}) => ({
  title: "외대 겨울 축제",
  host: "총학생회",
  place: "학생회관 앞",
  summary: "푸드트럭과 공연이 있는 겨울 축제입니다.",
  startsAt: "2026-12-01T17:00:00+09:00",
  endsAt: "2026-12-01T21:00:00+09:00",
  category: "festival",
  buildingId: "library",
  url: "https://www.instagram.com/p/abc123/",
  ...over,
});

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

// 008_event_reports.sql의 두 함수와 event_clusters 읽기를 메모리로 흉내 냅니다.
function createFakeSupabase({ users = {}, failSelect = false } = {}) {
  const clusters = [];
  const reports = [];
  const usage = new Map(); // `${env}:${userId}` → attempts (한국 날짜 하나만 시험)
  const calls = { rpc: [], selects: [] };
  let nextId = 1;

  const query = (table) => {
    const filters = [];
    let limitN = Infinity;
    const builder = {
      select() {
        return builder;
      },
      eq(col, val) {
        filters.push((r) => r[col] === val);
        return builder;
      },
      neq(col, val) {
        filters.push((r) => r[col] !== val);
        return builder;
      },
      in(col, vals) {
        filters.push((r) => vals.includes(r[col]));
        return builder;
      },
      gte(col, val) {
        filters.push((r) => Date.parse(r[col]) >= Date.parse(val));
        return builder;
      },
      lte(col, val) {
        filters.push((r) => Date.parse(r[col]) <= Date.parse(val));
        return builder;
      },
      lt(col, val) {
        filters.push((r) => Date.parse(r[col]) < Date.parse(val));
        return builder;
      },
      order() {
        return builder;
      },
      limit(n) {
        limitN = n;
        return builder;
      },
      then(resolve, reject) {
        calls.selects.push(table);
        if (failSelect) return Promise.resolve({ data: null, error: { code: "PGRST000" } }).then(resolve, reject);
        const rows = table === "event_clusters" ? clusters : [];
        const data = rows.filter((r) => filters.every((f) => f(r))).slice(0, limitN).map((r) => ({ ...r }));
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return builder;
  };

  return {
    clusters,
    reports,
    calls,
    auth: {
      async getUser(token) {
        const user = users[token];
        if (!user) return { data: { user: null }, error: { message: "invalid token" } };
        return { data: { user }, error: null };
      },
    },
    from: query,
    async rpc(fn, p) {
      calls.rpc.push({ fn, params: p });
      if (fn === "event_report_hit") {
        const key = `${p.p_env}:${p.p_user_id}`;
        const mine = usage.get(key) ?? 0;
        const all = [...usage.entries()].filter(([k]) => k.startsWith(`${p.p_env}:`)).reduce((s, [, v]) => s + v, 0);
        if (all >= p.p_global_limit) return { data: [{ allowed: false, reason: "global", user_hits: mine }], error: null };
        if (mine >= p.p_user_limit) return { data: [{ allowed: false, reason: "day", user_hits: mine }], error: null };
        usage.set(key, mine + 1);
        return { data: [{ allowed: true, reason: null, user_hits: mine + 1 }], error: null };
      }
      if (fn === "submit_event_report") {
        let cluster = p.p_cluster_id === null ? null : clusters.find((c) => c.id === p.p_cluster_id && c.env === p.p_env && c.status !== "hidden");
        let isNew = false;
        if (!cluster) {
          cluster = {
            id: nextId++,
            env: p.p_env,
            status: "collecting",
            title: p.p_title,
            host: p.p_host,
            summary: p.p_summary,
            starts_at: new Date(Date.parse(p.p_starts_at)).toISOString(),
            ends_at: new Date(Date.parse(p.p_ends_at)).toISOString(),
            place: p.p_place,
            building_id: p.p_building_id,
            category: p.p_category,
            source_url: p.p_source_url,
            reporter_count: 0,
            published_at: null,
          };
          clusters.push(cluster);
          isNew = true;
        }
        if (reports.some((r) => r.cluster_id === cluster.id && r.user_id === p.p_user_id)) {
          return { data: [{ result: "duplicate", report_cluster: cluster.id, reporters: cluster.reporter_count, cluster_status: cluster.status }], error: null };
        }
        reports.push({ cluster_id: cluster.id, user_id: p.p_user_id, env: p.p_env, title: p.p_title });
        const prev = cluster.status;
        cluster.reporter_count = new Set(reports.filter((r) => r.cluster_id === cluster.id).map((r) => r.user_id)).size;
        if (cluster.status === "collecting" && cluster.reporter_count >= p.p_threshold) {
          cluster.status = "published";
          cluster.published_at = new Date().toISOString();
        }
        const result = prev === "collecting" && cluster.status === "published" ? "published" : isNew ? "new" : "joined";
        return { data: [{ result, report_cluster: cluster.id, reporters: cluster.reporter_count, cluster_status: cluster.status }], error: null };
      }
      return { data: null, error: { code: "unknown_rpc" } };
    },
  };
}

const students = (n) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`tok-${i + 1}`, { id: `user-uuid-${i + 1}`, email: `s${i + 1}@hufs.ac.kr` }]));

// 가짜 CLOVA: 후보 목록에서 고를 id를 정하는 함수(choose)를 받아 Structured Outputs 응답 모양으로 돌려줌
function fakeClova(choose) {
  const seen = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    seen.push({ url, body, headers: init.headers });
    const payload = JSON.parse(body.messages[1].content);
    const matchId = choose(payload.후보, payload);
    return { ok: true, json: async () => ({ status: { code: "20000" }, result: { message: { role: "assistant", content: JSON.stringify({ matchId }) } } }) };
  };
  return { fetchImpl, seen };
}

async function send(handler, token, body) {
  const res = createMockRes();
  await handler({ method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res);
  return res;
}

function quietLogs() {
  const lines = [];
  const orig = { log: console.log, error: console.error };
  console.log = (...a) => lines.push(a.join(" "));
  console.error = (...a) => lines.push(a.join(" "));
  return { lines, restore: () => Object.assign(console, orig) };
}

// ───────── 입력 검사 ─────────

test("입력 검사: 올바른 제보는 통과, 앞뒤 공백만 지운 원문 · 빈 선택 칸은 null", () => {
  const r = validateEventReport(report({ title: "  외대 겨울 축제 ", host: "", url: "" }), { nowMs: NOW.getTime(), buildingIds: ["library"] });
  assert.equal(r.ok, true);
  assert.equal(r.value.title, "외대 겨울 축제");
  assert.equal(r.value.host, null);
  assert.equal(r.value.url, null);
});

test("입력 검사: 글자 수 · 필수 칸 · 분류 · 건물 id", () => {
  const nowMs = NOW.getTime();
  const codes = (over) => validateEventReport(report(over), { nowMs, buildingIds: ["library"] }).problems ?? [];
  assert.deepEqual(codes({ title: "가".repeat(41) }), [{ field: "title", code: "too_long" }]);
  assert.equal(validateEventReport(report({ title: "가".repeat(40) }), { nowMs }).ok, true, "40자는 통과");
  assert.deepEqual(codes({ host: "가".repeat(31) }), [{ field: "host", code: "too_long" }]);
  assert.deepEqual(codes({ place: "가".repeat(41) }), [{ field: "place", code: "too_long" }]);
  assert.deepEqual(codes({ summary: "가".repeat(151) }), [{ field: "summary", code: "too_long" }]);
  assert.deepEqual(codes({ title: "   " }), [{ field: "title", code: "required" }]);
  assert.deepEqual(codes({ category: "party" }), [{ field: "category", code: "unknown" }]);
  assert.deepEqual(codes({ buildingId: "nowhere" }), [{ field: "buildingId", code: "unknown" }]);
  assert.deepEqual(codes({ title: 123 }), [{ field: "title", code: "type" }]);
  assert.deepEqual(validateEventReport(null).problems, [{ field: "body", code: "type" }]);
});

test("입력 검사: 시각은 +09:00, 지금-1일 ~ 지금+14일, 끝은 시작 이후 7일 이내", () => {
  const nowMs = NOW.getTime();
  const codes = (over) => validateEventReport(report(over), { nowMs }).problems ?? [];
  assert.deepEqual(codes({ startsAt: "2026-12-01T17:00:00Z" }), [{ field: "startsAt", code: "format" }]);
  assert.deepEqual(codes({ startsAt: "2026-11-25T11:59:00+09:00", endsAt: "2026-11-25T13:00:00+09:00" }), [{ field: "startsAt", code: "range" }], "하루 전보다 이전");
  assert.equal(validateEventReport(report({ startsAt: "2026-11-25T12:00:00+09:00", endsAt: "2026-11-25T13:00:00+09:00" }), { nowMs }).ok, true, "정확히 하루 전은 통과");
  assert.equal(validateEventReport(report({ startsAt: "2026-12-10T12:00:00+09:00", endsAt: "2026-12-10T13:00:00+09:00" }), { nowMs }).ok, true, "정확히 14일 뒤는 통과");
  assert.deepEqual(codes({ startsAt: "2026-12-10T12:01:00+09:00", endsAt: "2026-12-10T13:00:00+09:00" }), [{ field: "startsAt", code: "range" }], "14일 넘음");
  assert.deepEqual(codes({ endsAt: "2026-12-01T16:00:00+09:00" }), [{ field: "endsAt", code: "range" }], "시작보다 빠름");
  assert.deepEqual(codes({ endsAt: "2026-12-08T17:01:00+09:00" }), [{ field: "endsAt", code: "range" }], "7일 넘음");
  assert.deepEqual(codes({ endsAt: undefined }), [{ field: "endsAt", code: "required" }]);
});

test("개인정보: 모든 글 칸의 전화번호(하이픈 · 점 · 공백 · 붙여쓰기 · 전각 · +82 · 대표번호) 거절", () => {
  const nowMs = NOW.getTime();
  const phones = ["010-1234-5678", "010.1234.5678", "010 1234 5678", "01012345678", "０１０-１２３４-５６７８", "+82 10-1234-5678", "02-123-4567", "(02) 1234 5678", "031.123.4567", "1588-1234", "010 - 1234 - 5678"];
  for (const phone of phones) {
    for (const field of ["title", "host", "place", "summary"]) {
      const text = field === "host" ? phone : `문의 ${phone}`;
      const r = validateEventReport(report({ [field]: text }), { nowMs });
      assert.equal(r.ok, false, `${field}: ${phone}`);
      assert.ok(r.problems.some((p) => p.field === field && p.code === "phone"), `${field}: ${phone}`);
    }
  }
  // 날짜 · 시간 · 인원 · 가격은 전화번호가 아님
  for (const ok of ["12월 3일 18:00", "2026.12.03 18:00 ~ 2026.12.04", "선착순 100명, 참가비 10,000원", "B1-08호", "12/3(수) 15시"]) {
    assert.equal(contactProblem(ok), null, ok);
  }
});

test("개인정보: 이메일 · 카카오 링크 거절, url은 https://만 · 카카오 도메인 금지", () => {
  const nowMs = NOW.getTime();
  const problem = (over) => validateEventReport(report(over), { nowMs }).problems ?? [];
  assert.deepEqual(problem({ summary: "신청은 a.b@hufs.ac.kr 로" }), [{ field: "summary", code: "email" }]);
  assert.deepEqual(problem({ summary: "신청 abc @ gmail . com" }), [{ field: "summary", code: "email" }], "공백 넣은 이메일");
  assert.deepEqual(problem({ host: "test＠naver.com" }), [{ field: "host", code: "email" }], "전각 @");
  assert.deepEqual(problem({ summary: "오픈채팅 open.kakao.com/o/abc 참여" }), [{ field: "summary", code: "kakao" }]);
  assert.deepEqual(problem({ place: "pf.kakao.com/_x 참고" }), [{ field: "place", code: "kakao" }]);
  assert.deepEqual(problem({ url: "https://open.kakao.com/o/abcdef" }), [{ field: "url", code: "kakao" }]);
  assert.deepEqual(problem({ url: "https://pf.kakao.com/_x" }), [{ field: "url", code: "kakao" }]);
  assert.deepEqual(problem({ url: "https://www.kakao.co.kr/event" }), [{ field: "url", code: "kakao" }]);
  assert.deepEqual(problem({ url: "http://www.hufs.ac.kr/" }), [{ field: "url", code: "https_only" }]);
  assert.deepEqual(problem({ url: "javascript:alert(1)" }), [{ field: "url", code: "https_only" }]);
  assert.deepEqual(problem({ url: "https://user:pw@example.com/" }), [{ field: "url", code: "format" }]);
  assert.equal(validateEventReport(report({ url: "https://www.hufs.ac.kr/hufs/11281/subview.do" }), { nowMs }).ok, true);
});

test("거절 응답에는 칸 이름 · 코드만, 제보 내용은 없음", () => {
  const r = validateEventReport(report({ summary: "비밀문구 010-9999-8888" }), { nowMs: NOW.getTime() });
  const text = JSON.stringify(r);
  assert.ok(!text.includes("비밀문구") && !text.includes("9999"));
  assert.deepEqual(Object.keys(r.problems[0]).sort(), ["code", "field"]);
});

test("정적 데이터(shared/events.js)에는 sourceType crowd를 쓸 수 없음", () => {
  const base = {
    id: "evt-x",
    title: { ko: "행사", en: "Event" },
    host: { ko: "총학생회", en: "Council" },
    summary: { ko: "내용", en: "About" },
    startsAt: "2026-11-30T10:00:00+09:00",
    endsAt: "2026-11-30T12:00:00+09:00",
    place: { ko: "도서관", en: "Library" },
    category: "other",
    sourceType: "crowd",
    url: "https://www.hufs.ac.kr/",
    checked: { on: "2026-11-26", by: "테스트" },
  };
  assert.ok(eventProblems(base).some((p) => p.includes("crowd")));
});

// ───────── 설정 값 ─────────

test("env · 기준 인원 · 후보 날짜 범위", () => {
  assert.equal(reportEnv("production"), "production");
  for (const v of ["preview", "development", undefined, ""]) assert.equal(reportEnv(v), "preview");
  assert.equal(reportThreshold(undefined), 5);
  assert.equal(reportThreshold("3"), 3);
  for (const v of ["1", "0", "-4", "abc", "2.5", ""]) assert.equal(reportThreshold(v), 5, String(v));
  // 12/1 17:00 KST 시작 → 11/30 00:00 KST ~ 12/3 00:00 KST(미포함)
  assert.deepEqual(candidateRange("2026-12-01T17:00:00+09:00"), { from: "2026-11-29T15:00:00.000Z", to: "2026-12-02T15:00:00.000Z" });
  // 한국 시간 새벽 시작(UTC로는 전날)도 한국 날짜 기준
  assert.deepEqual(candidateRange("2026-12-01T01:00:00+09:00"), { from: "2026-11-29T15:00:00.000Z", to: "2026-12-02T15:00:00.000Z" });
});

// ───────── POST /api/event-report ─────────

test("로그인 필수(401), 학교 메일 아니면 403, POST만", async () => {
  resetProgressRateLimit();
  const supabase = createFakeSupabase({ users: { gmail: { id: "u-g", email: "x@gmail.com" } } });
  const handler = createEventReportHandler({ supabase, now });
  assert.equal((await send(handler, null, report())).statusCode, 401);
  assert.equal((await send(handler, "gmail", report())).statusCode, 403);
  const res = createMockRes();
  await handler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(supabase.calls.rpc.length, 0);
});

test("입력 거절(400)은 하루 횟수에 세지 않고 AI · DB 저장도 안 함, 로그에 내용 없음", async () => {
  resetProgressRateLimit();
  const supabase = createFakeSupabase({ users: students(1) });
  const clova = fakeClova(() => "none");
  const handler = createEventReportHandler({ supabase, now, apiKey: "test-key", fetch: clova.fetchImpl });
  const logs = quietLogs();
  try {
    const res = await send(handler, "tok-1", report({ summary: "문의 010.1234.5678" }));
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "invalid_report", problems: [{ field: "summary", code: "phone" }] });
  } finally {
    logs.restore();
  }
  assert.equal(supabase.calls.rpc.length, 0);
  assert.equal(clova.seen.length, 0);
  assert.ok(logs.lines.every((l) => !l.includes("010") && !l.includes("문의")));
});

test("후보가 없으면 AI를 부르지 않고 새 묶음, 응답에는 result · reporters · threshold만", async () => {
  resetProgressRateLimit();
  const supabase = createFakeSupabase({ users: students(1) });
  const clova = fakeClova(() => "none");
  const handler = createEventReportHandler({ supabase, now, apiKey: "test-key", fetch: clova.fetchImpl });
  const logs = quietLogs();
  let res;
  try {
    res = await send(handler, "tok-1", report());
  } finally {
    logs.restore();
  }
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { result: "new", reporters: 1, threshold: 5 });
  assert.equal(clova.seen.length, 0, "후보 없음 → AI 안 부름");
  assert.equal(supabase.clusters[0].env, "preview");
  assert.equal(supabase.clusters[0].title, "외대 겨울 축제", "대표 내용은 첫 제보 원문");
  // 로그: api · result · ms · ai만, 내용 · 이메일 · user_id 없음
  const line = JSON.parse(logs.lines.find((l) => l.includes("event-report")));
  assert.deepEqual(Object.keys(line).sort(), ["ai", "api", "ms", "result"]);
  assert.equal(line.ai, false);
  assert.ok(logs.lines.every((l) => !l.includes("user-uuid") && !l.includes("hufs.ac.kr") && !l.includes("축제")));
});

test("4명 → 5명째 published, 같은 사람 다시 제보는 duplicate(저장 안 함), 응답에 user_id 없음", async () => {
  resetProgressRateLimit();
  const supabase = createFakeSupabase({ users: students(6) });
  const clova = fakeClova((cands) => cands[0].id);
  const handler = createEventReportHandler({ supabase, now, apiKey: "test-key", fetch: clova.fetchImpl });
  const logs = quietLogs();
  const results = [];
  let dup;
  let sixth;
  try {
    for (let i = 1; i <= 5; i++) results.push((await send(handler, `tok-${i}`, report({ title: i === 1 ? "외대 겨울 축제" : "외대 겨울축제" }))).body);
    dup = await send(handler, "tok-2", report());
    sixth = await send(handler, "tok-6", report());
  } finally {
    logs.restore();
  }
  assert.deepEqual(results.map((b) => b.result), ["new", "joined", "joined", "joined", "published"]);
  assert.deepEqual(results.map((b) => b.reporters), [1, 2, 3, 4, 5]);
  assert.equal(supabase.clusters.length, 1);
  assert.equal(supabase.clusters[0].status, "published");
  assert.equal(supabase.clusters[0].title, "외대 겨울 축제", "대표 내용은 첫 제보 그대로");
  assert.deepEqual(dup.body, { result: "duplicate", reporters: 5, threshold: 5 });
  assert.equal(supabase.reports.length, 6, "duplicate는 저장 안 됨(5 + 6번째 1)");
  assert.deepEqual(sixth.body, { result: "joined", reporters: 6, threshold: 5 }, "이미 공개된 묶음에 합류");
  for (const body of [...results, dup.body, sixth.body]) {
    const text = JSON.stringify(body);
    assert.ok(!text.includes("user-uuid") && !text.includes("@hufs") && !text.includes("축제"), text);
    assert.deepEqual(Object.keys(body).sort(), ["reporters", "result", "threshold"]);
  }
  // AI 요청: HCX-007 · Structured Outputs · 추론 끔 · 지시 무시 문구 · 이메일 · user_id · 소개글 없음
  const sent = clova.seen[0];
  assert.equal(sent.url, MATCH_URL);
  assert.equal(sent.headers.Authorization, "Bearer test-key");
  assert.equal(sent.body.responseFormat.type, "json");
  assert.deepEqual(sent.body.responseFormat.schema.required, ["matchId"]);
  assert.deepEqual(sent.body.responseFormat.schema.properties.matchId.enum, ["1", "none"]);
  assert.deepEqual(sent.body.thinking, { effort: "none" });
  assert.ok(sent.body.maxCompletionTokens <= 100);
  assert.match(sent.body.messages[0].content, /지시.*무시/);
  assert.match(sent.body.messages[0].content, /행사명, 주최, 날짜, 장소/);
  const userMsg = sent.body.messages[1].content;
  assert.ok(!userMsg.includes("user-uuid") && !userMsg.includes("@hufs") && !userMsg.includes("푸드트럭"), "AI에 이메일 · user_id · 소개글 안 보냄");
});

test("기준 인원 EVENT_REPORT_THRESHOLD=2면 2명째 published", async () => {
  resetProgressRateLimit();
  const supabase = createFakeSupabase({ users: students(2) });
  const handler = createEventReportHandler({ supabase, now, threshold: "2", apiKey: "k", fetch: fakeClova((c) => c[0].id).fetchImpl });
  const logs = quietLogs();
  try {
    assert.equal((await send(handler, "tok-1", report())).body.result, "new");
    assert.deepEqual((await send(handler, "tok-2", report())).body, { result: "published", reporters: 2, threshold: 2 });
  } finally {
    logs.restore();
  }
});

test("하루 3건 제한(한국 날짜, duplicate 포함): 4번째는 429, AI · 저장 안 함", async () => {
  resetProgressRateLimit();
  const supabase = createFakeSupabase({ users: students(1) });
  const clova = fakeClova(() => "none");
  const handler = createEventReportHandler({ supabase, now, apiKey: "k", fetch: clova.fetchImpl });
  const logs = quietLogs();
  let fourth;
  try {
    for (let i = 0; i < EVENT_REPORT_DAILY_LIMIT; i++) {
      const res = await send(handler, "tok-1", report({ title: `행사 ${i}`, startsAt: `2026-12-0${i + 1}T10:00:00+09:00`, endsAt: `2026-12-0${i + 1}T12:00:00+09:00` }));
      assert.equal(res.statusCode, 200);
    }
    fourth = await send(handler, "tok-1", report({ title: "행사 4", startsAt: "2026-12-07T10:00:00+09:00", endsAt: "2026-12-07T12:00:00+09:00" }));
  } finally {
    logs.restore();
  }
  assert.equal(fourth.statusCode, 429);
  assert.equal(fourth.body.error, "report_limited");
  assert.equal(fourth.body.reason, "day");
  assert.equal(supabase.reports.length, 3);
  assert.equal(supabase.calls.rpc.filter((c) => c.fn === "submit_event_report").length, 3);
});

test("AI가 후보 밖 id를 주면 새 묶음", async () => {
  resetProgressRateLimit();
  const supabase = createFakeSupabase({ users: students(2) });
  const handler = createEventReportHandler({ supabase, now, apiKey: "k", fetch: fakeClova(() => "999").fetchImpl });
  const logs = quietLogs();
  try {
    await send(handler, "tok-1", report());
    const res = await send(handler, "tok-2", report());
    assert.equal(res.body.result, "new");
  } finally {
    logs.restore();
  }
  assert.equal(supabase.clusters.length, 2);
  assert.equal(supabase.calls.rpc.filter((c) => c.fn === "submit_event_report")[1].params.p_cluster_id, null);
});

test("AI 실패(HTTP 오류 · 예외 · JSON 아님 · 10초 초과 · 키 없음)면 새 묶음", async () => {
  const failures = {
    http500: async () => ({ ok: false, status: 500, json: async () => ({}) }),
    throws: async () => {
      throw new Error("network down");
    },
    notJson: async () => ({ ok: true, json: async () => ({ result: { message: { content: "같은 행사입니다: 1" } } }) }),
    hang: (url, init) =>
      new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
    ignoresSignal: () => new Promise(() => {}),
  };
  for (const [name, fetchImpl] of Object.entries(failures)) {
    resetProgressRateLimit();
    const supabase = createFakeSupabase({ users: students(2) });
    const handler = createEventReportHandler({ supabase, now, apiKey: "k", fetch: fetchImpl, matchTimeoutMs: 30 });
    const logs = quietLogs();
    let res;
    try {
      await send(handler, "tok-1", report());
      res = await send(handler, "tok-2", report());
    } finally {
      logs.restore();
    }
    assert.equal(res.statusCode, 200, name);
    assert.equal(res.body.result, "new", name);
    assert.equal(supabase.clusters.length, 2, name);
  }
  // 키 없음: 후보가 있어도 AI를 부르지 않고 새 묶음
  resetProgressRateLimit();
  const supabase = createFakeSupabase({ users: students(2) });
  const clova = fakeClova((c) => c[0].id);
  const handler = createEventReportHandler({ supabase, now, apiKey: "", fetch: clova.fetchImpl });
  const logs = quietLogs();
  try {
    await send(handler, "tok-1", report());
    assert.equal((await send(handler, "tok-2", report())).body.result, "new");
  } finally {
    logs.restore();
  }
  assert.equal(clova.seen.length, 0);
});

test("env가 다른 묶음 · hidden 묶음 · 시작일이 ±1일 밖인 묶음은 후보가 아님", async () => {
  resetProgressRateLimit();
  const supabase = createFakeSupabase({ users: students(4) });
  const clova = fakeClova((cands) => cands[0]?.id ?? "none");
  const prod = createEventReportHandler({ supabase, now, vercelEnv: "production", apiKey: "k", fetch: clova.fetchImpl });
  const preview = createEventReportHandler({ supabase, now, vercelEnv: "preview", apiKey: "k", fetch: clova.fetchImpl });
  const logs = quietLogs();
  try {
    assert.equal((await send(prod, "tok-1", report())).body.result, "new");
    assert.equal((await send(preview, "tok-2", report())).body.result, "new", "production 묶음과 섞이지 않음");
    assert.equal(clova.seen.length, 0, "다른 env 묶음은 후보에도 안 들어감");
    assert.deepEqual(supabase.clusters.map((c) => c.env), ["production", "preview"]);

    supabase.clusters[1].status = "hidden";
    assert.equal((await send(preview, "tok-3", report())).body.result, "new", "hidden 묶음에는 합치지 않음");
    assert.equal(clova.seen.length, 0);

    // 3번 묶음(12/1 시작)에서 2일 뒤(12/3) 시작 제보 → 후보 아님
    assert.equal((await send(preview, "tok-4", report({ startsAt: "2026-12-03T17:00:00+09:00", endsAt: "2026-12-03T21:00:00+09:00" }))).body.result, "new");
    assert.equal(clova.seen.length, 0);
  } finally {
    logs.restore();
  }
});

test("DB 저장 오류는 500, 로그에는 오류 종류만", async () => {
  resetProgressRateLimit();
  const supabase = createFakeSupabase({ users: students(1), failSelect: true });
  const handler = createEventReportHandler({ supabase, now });
  const logs = quietLogs();
  let res;
  try {
    res = await send(handler, "tok-1", report());
  } finally {
    logs.restore();
  }
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: "report_save_failed" });
  assert.ok(logs.lines.every((l) => !l.includes("user-uuid") && !l.includes("축제")));
});

// ───────── GET /api/events 합치기 ─────────

const staticEvent = {
  id: "evt-team",
  title: { ko: "팀 입력 행사", en: "Team event" },
  host: { ko: "총학생회", en: "Council" },
  summary: { ko: "내용", en: "About" },
  startsAt: "2026-11-28T10:00:00+09:00",
  endsAt: "2026-11-28T12:00:00+09:00",
  place: { ko: "도서관", en: "Library" },
  category: "other",
  sourceType: "school",
  url: "https://www.hufs.ac.kr/",
  checked: { on: "2026-11-26", by: "확인한사람" },
};

const clusterRow = (over = {}) => ({
  id: 7,
  env: "preview",
  status: "published",
  title: "외대 겨울 축제",
  host: null,
  summary: "푸드트럭과 공연",
  starts_at: "2026-12-01T08:00:00+00:00",
  ends_at: "2026-12-01T12:00:00+00:00",
  place: "학생회관 앞",
  building_id: null,
  category: "festival",
  source_url: null,
  reporter_count: 5,
  ...over,
});

async function getEvents(deps) {
  const res = createMockRes();
  const logs = quietLogs();
  try {
    await createEventsHandler({ now: () => NOW.getTime(), events: [staticEvent], ...deps })({ method: "GET", headers: {} }, res);
  } finally {
    logs.restore();
  }
  return res;
}

test("행사 합치기: 팀 입력 + 같은 env의 published · confirmed 묶음, 원문을 ko · en에 그대로", async () => {
  const supabase = createFakeSupabase();
  supabase.clusters.push(
    clusterRow(),
    clusterRow({ id: 8, status: "confirmed", title: "학과 설명회", category: "briefing", host: "영어학과 학생회", starts_at: "2026-11-27T05:00:00Z", ends_at: "2026-11-27T07:00:00Z" }),
    clusterRow({ id: 9, status: "collecting", title: "모으는 중" }),
    clusterRow({ id: 10, status: "hidden", title: "숨김" }),
    clusterRow({ id: 11, env: "production", title: "실서비스 묶음" }),
  );
  const res = await getEvents({ supabase, vercelEnv: "preview" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Cache-Control"], "no-store");
  const items = res.body.items;
  assert.deepEqual(items.map((e) => e.id), ["crowd-8", "evt-team", "crowd-7"], "시작 순으로 합쳐짐, collecting · hidden · 다른 env 없음");
  const crowd = items.find((e) => e.id === "crowd-7");
  assert.equal(crowd.sourceType, "crowd");
  assert.equal(crowd.reporters, 5);
  assert.equal(crowd.confirmed, false);
  assert.deepEqual(crowd.title, { ko: "외대 겨울 축제", en: "외대 겨울 축제" });
  assert.deepEqual(crowd.summary, { ko: "푸드트럭과 공연", en: "푸드트럭과 공연" });
  assert.deepEqual(crowd.host, { ko: "", en: "" }, "주최 없음 → 빈 글(화면이 host[lang]을 읽어도 안 죽음)");
  assert.equal(crowd.startsAt, "2026-12-01T17:00:00+09:00", "한국 시간 +09:00으로");
  assert.equal(crowd.checkedOn, null);
  assert.equal(items.find((e) => e.id === "crowd-8").confirmed, true);
  const text = JSON.stringify(res.body);
  assert.ok(!text.includes("user_id") && !text.includes("확인한사람") && !text.includes("reporter_count"));
});

test("행사 합치기: Supabase 오류 · 시간 초과 · 설정 없음이면 팀 입력 행사만", async () => {
  const failing = await getEvents({ supabase: createFakeSupabase({ failSelect: true }) });
  assert.equal(failing.statusCode, 200);
  assert.deepEqual(failing.body.items.map((e) => e.id), ["evt-team"]);

  const hanging = { from: () => ({ select() { return this; }, eq() { return this; }, in() { return this; }, gte() { return this; }, lte() { return this; }, order() { return this; }, limit() { return new Promise(() => {}); } }) };
  const slow = await getEvents({ supabase: hanging, crowdTimeoutMs: 20 });
  assert.deepEqual(slow.body.items.map((e) => e.id), ["evt-team"]);

  const throwing = { from: () => { throw new Error("boom"); } };
  assert.deepEqual((await getEvents({ supabase: throwing })).body.items.map((e) => e.id), ["evt-team"]);

  assert.deepEqual((await getEvents({ supabase: null })).body.items.map((e) => e.id), ["evt-team"]);
});

test("묶음 항목: 연락처 · 카카오가 들어 있거나 형식이 이상하면 내보내지 않음", () => {
  assert.ok(crowdItem(clusterRow()));
  assert.equal(crowdItem(clusterRow({ summary: "문의 010 1234 5678" })), null);
  assert.equal(crowdItem(clusterRow({ host: "a@b.com" })), null);
  assert.equal(crowdItem(clusterRow({ source_url: "https://open.kakao.com/o/x" })), null);
  assert.equal(crowdItem(clusterRow({ category: "party" })), null);
  assert.equal(crowdItem(clusterRow({ status: "collecting" })), null);
  assert.equal(crowdItem(clusterRow({ title: "" })), null);
  assert.equal(crowdItem(clusterRow({ source_url: "http://example.com" })).url, undefined, "https가 아니면 주소만 뺌");
});
