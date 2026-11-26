// 행사 제보 보상(팀 확인 → 경험치 20 + 게임 안 알림)을 확인합니다. 실행: npm test
// DB 트리거(supabase/009_event_report_rewards.sql)는 Supabase에서만 돌므로, 여기서는 규칙이 파일에 그대로 있는지와
// 서버 API(api/reward-notices.js) · 화면 쪽 로직(src/data/rewardNotices.js)을 확인합니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EVENT_REPORT_REWARD_EXP } from "../shared/progressRules.js";
import { resetProgressRateLimit } from "../api/_lib/progressServer.js";
import { createRewardNoticesHandler } from "../api/reward-notices.js";
import {
  createNoticeWatcher,
  demoNoticeEnabled,
  mergeNotices,
  rewardNoticeText,
  startRewardNoticeWatch,
  takeRewardNotices,
} from "../src/data/rewardNotices.js";
import { setLang, t } from "../src/state.js";

const SQL = readFileSync(new URL("../supabase/009_event_report_rewards.sql", import.meta.url), "utf8");
const code = SQL.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");

test("SQL 009: 경험치는 shared/progressRules.js와 같은 20, confirmed로 바뀔 때만 · 공개 전 제보자만 · 행사마다 1번", () => {
  assert.equal(EVENT_REPORT_REWARD_EXP, 20);
  assert.equal(Number(code.match(/v_exp constant integer := (\d+)/)?.[1]), EVENT_REPORT_REWARD_EXP, "SQL v_exp와 JS 상수가 같음");
  assert.match(code, /AFTER UPDATE OF status ON public\.event_clusters/);
  assert.match(code, /WHEN \(NEW\.status = 'confirmed' AND OLD\.status IS DISTINCT FROM 'confirmed'\)/, "다시 confirmed여도 트리거는 바뀔 때만");
  assert.match(code, /NEW\.published_at IS NULL OR r\.created_at <= NEW\.published_at/, "공개된 뒤 합류한 제보자는 제외");
  assert.match(code, /VALUES \(v_user, 'event-report', NEW\.id::text, v_exp, 0\)\s+ON CONFLICT \(user_id, source, ref_id\) DO NOTHING/, "행사마다 한 번(reward_log UNIQUE)");
  assert.match(code, /IF v_inserted > 0 THEN[\s\S]*total_exp = total_exp \+ v_exp[\s\S]*INSERT INTO public\.event_reward_notices/, "새로 지급할 때만 경험치 · 알림");
  assert.doesNotMatch(code, /daily|cap/i, "하루 상한 없음");
  // 보안: RLS 켜고 정책 없음, 브라우저 권한 회수, 알림 가져가기는 service_role만
  assert.match(code, /ALTER TABLE public\.event_reward_notices ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(code, /CREATE POLICY/);
  assert.match(code, /REVOKE ALL ON TABLE public\.event_reward_notices FROM anon, authenticated/);
  assert.match(code, /REVOKE ALL ON FUNCTION public\.take_event_reward_notices\(uuid\) FROM PUBLIC, anon, authenticated/);
  assert.match(code, /GRANT EXECUTE ON FUNCTION public\.take_event_reward_notices\(uuid\) TO service_role/);
  assert.match(code, /REVOKE ALL ON FUNCTION public\.reward_event_reporters\(\) FROM PUBLIC, anon, authenticated/);
  assert.match(code, /SET seen_at = now\(\)\s+WHERE n\.user_id = p_user_id AND n\.seen_at IS NULL/, "가져가면 본 것으로");
});

// ───────── POST /api/reward-notices ─────────

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

function fakeSupabase({ notices = {}, fail = false } = {}) {
  const calls = [];
  return {
    calls,
    auth: {
      async getUser(token) {
        const users = { "tok-a": { id: "user-uuid-a", email: "a@hufs.ac.kr" }, gmail: { id: "u-g", email: "x@gmail.com" } };
        return users[token] ? { data: { user: users[token] }, error: null } : { data: { user: null }, error: { message: "bad" } };
      },
    },
    async rpc(fn, params) {
      calls.push({ fn, params });
      if (fail) return { data: null, error: { code: "42883" } };
      const rows = notices[params.p_user_id] ?? [];
      notices[params.p_user_id] = []; // 가져가면 본 것으로
      return { data: rows, error: null };
    },
  };
}

const quiet = async (fn) => {
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

async function post(handler, token, method = "POST") {
  const res = createMockRes();
  await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {} }, res);
  return res;
}

test("알림 API: 로그인 필수 · 학교 메일만 · POST만", async () => {
  resetProgressRateLimit();
  const handler = createRewardNoticesHandler({ supabase: fakeSupabase() });
  assert.equal((await post(handler, null)).statusCode, 401);
  assert.equal((await post(handler, "gmail")).statusCode, 403);
  assert.equal((await post(handler, "tok-a", "GET")).statusCode, 405);
});

test("알림 API: 안 본 알림의 건수 · 경험치 합계만 돌려주고, 두 번째에는 0", async () => {
  resetProgressRateLimit();
  const supabase = fakeSupabase({ notices: { "user-uuid-a": [{ exp: 20 }, { exp: 20 }] } });
  const handler = createRewardNoticesHandler({ supabase });
  let first;
  let second;
  const logs = await quiet(async () => {
    first = await post(handler, "tok-a");
    second = await post(handler, "tok-a");
  });
  assert.deepEqual(first.body, { count: 2, exp: 40 });
  assert.deepEqual(second.body, { count: 0, exp: 0 });
  assert.equal(first.headers["Cache-Control"], "no-store");
  assert.deepEqual(supabase.calls[0], { fn: "take_event_reward_notices", params: { p_user_id: "user-uuid-a" } });
  assert.deepEqual(logs.map((l) => JSON.parse(l)), [{ api: "reward-notices", count: 2 }], "로그는 건수만, 0건이면 안 남김");
  assert.ok(!JSON.stringify(first.body).includes("user-uuid"));
});

test("알림 API: DB 오류(009 실행 전 등)면 500, 로그에는 오류 종류만", async () => {
  resetProgressRateLimit();
  const handler = createRewardNoticesHandler({ supabase: fakeSupabase({ fail: true }) });
  let res;
  const logs = await quiet(async () => {
    res = await post(handler, "tok-a");
  });
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: "notice_load_failed" });
  assert.ok(logs.every((l) => !l.includes("user-uuid")));
});

// ───────── 화면 쪽(src/data/rewardNotices.js) ─────────

test("알림 문구: 1건 · 여러 건, '+N EXP' 칩, 한국어 · 영어", () => {
  const one = rewardNoticeText({ count: 1, exp: 20 });
  assert.deepEqual(one, { key: "eventRewardNotice", vars: { count: 1 }, chip: "+20 EXP" });
  const many = rewardNoticeText({ count: 3, exp: 60 });
  assert.deepEqual(many, { key: "eventRewardNoticeMany", vars: { count: 3 }, chip: "+60 EXP" });
  setLang("ko");
  assert.equal(t(one.key, one.vars), "제보한 행사가 확인되어 경험치가 올랐어요");
  assert.equal(t(many.key, many.vars), "제보한 행사 3건이 확인되어 경험치가 올랐어요");
  setLang("en");
  assert.equal(t(one.key, one.vars), "Your reported event was verified!");
  assert.equal(t(many.key, many.vars), "3 reported events were verified!");
  setLang("ko");
  assert.deepEqual(mergeNotices(null, { count: 1, exp: 20 }), { count: 1, exp: 20 });
  assert.deepEqual(mergeNotices({ count: 1, exp: 20, until: 5 }, { count: 2, exp: 40 }), { count: 3, exp: 60 }, "떠 있는 알림과 합침");
});

test("알림 가져오기: POST · Bearer 토큰, 토큰 없으면 부르지 않음, 실패 · 이상한 응답은 null", async () => {
  const seen = [];
  const ok = async (url, init) => {
    seen.push({ url, init });
    return { ok: true, json: async () => ({ count: 1, exp: 20 }) };
  };
  assert.deepEqual(await takeRewardNotices({ fetchImpl: ok, token: "jwt" }), { count: 1, exp: 20 });
  assert.equal(seen[0].url, "/api/reward-notices");
  assert.equal(seen[0].init.method, "POST");
  assert.equal(seen[0].init.headers.Authorization, "Bearer jwt");
  assert.equal(await takeRewardNotices({ fetchImpl: ok, token: null }), null);
  assert.equal(seen.length, 1, "토큰 없으면 서버를 부르지 않음");
  assert.equal(await takeRewardNotices({ fetchImpl: async () => ({ ok: false, status: 500 }), token: "jwt" }), null);
  assert.equal(await takeRewardNotices({ fetchImpl: async () => { throw new Error("offline"); }, token: "jwt" }), null);
  assert.equal(await takeRewardNotices({ fetchImpl: async () => ({ ok: true, json: async () => ({ count: "x" }) }), token: "jwt" }), null);
});

test("알림 반복기: 시작하자마자 한 번(접속 안 했을 때 확인된 것), 그 뒤 주기적으로, 0건은 알리지 않음, 탭이 안 보이면 건너뜀, 멈추면 끝", async () => {
  const replies = [{ count: 1, exp: 20 }, { count: 0, exp: 0 }, null, { count: 2, exp: 40 }];
  let takes = 0;
  let visible = true;
  let tick = null;
  let cleared = false;
  const got = [];
  const watcher = createNoticeWatcher({
    take: async () => replies[takes++],
    onNotice: (n) => got.push(n),
    isVisible: () => visible,
    setIntervalFn: (fn) => {
      tick = fn;
      return 1;
    },
    clearIntervalFn: () => {
      cleared = true;
    },
  });
  watcher.start();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(got, [{ count: 1, exp: 20 }], "접속하자마자 바로");
  await tick(); // 0건
  await tick(); // 실패(null)
  visible = false;
  await tick(); // 탭 숨김 → 안 부름
  assert.equal(takes, 3);
  visible = true;
  await tick(); // 2건
  assert.deepEqual(got, [{ count: 1, exp: 20 }, { count: 2, exp: 40 }]);
  watcher.stop();
  assert.equal(cleared, true);
  await watcher.check();
  assert.equal(takes, 4, "멈춘 뒤에는 부르지 않음");
});

test("알림 반복기: 앞 요청이 끝나기 전에는 겹쳐 부르지 않음", async () => {
  let takes = 0;
  let release;
  const watcher = createNoticeWatcher({
    take: () => {
      takes++;
      return new Promise((r) => {
        release = () => r({ count: 0, exp: 0 });
      });
    },
    onNotice: () => {},
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
  });
  const first = watcher.check();
  await watcher.check();
  assert.equal(takes, 1);
  release();
  await first;
  watcher.stop();
});

test("가짜 로그인 · 게스트는 알림 서버를 부르지 않음, ?demoNotice=1은 화면 확인용", () => {
  let called = false;
  const stop = startRewardNoticeWatch(() => {
    called = true;
  }, { authMode: "mock" });
  assert.equal(typeof stop, "function");
  stop();
  assert.equal(called, false);
  assert.equal(demoNoticeEnabled("?demoNotice=1"), true);
  assert.equal(demoNoticeEnabled("?demoNotice=0"), false);
  assert.equal(demoNoticeEnabled(""), false);
});
