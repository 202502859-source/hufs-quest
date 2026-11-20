// 검색창 질문 쪼개기 도우미(api/_lib/decompose.js)를 확인합니다. 네트워크는 부르지 않습니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQueries, mergeDocs } from "../api/_lib/decompose.js";

// ── parseQueries ──
test("parseQueries: 정상 JSON은 문자열 배열로", () => {
  assert.deepEqual(parseQueries('{"queries": ["휴학 최대 기간"]}'), ["휴학 최대 기간"]);
  assert.deepEqual(parseQueries('{"queries": ["이중전공 이수 학점", "부전공 이수 학점"]}'), ["이중전공 이수 학점", "부전공 이수 학점"]);
});

test("parseQueries: 깨진 JSON · JSON이 아닌 출력은 null", () => {
  assert.equal(parseQueries('{"queries": ["휴학 최대 기간"'), null);
  assert.equal(parseQueries("휴학 최대 기간"), null);
  assert.equal(parseQueries('{"query": "휴학"}'), null);
  assert.equal(parseQueries('{"queries": "휴학"}'), null);
  assert.equal(parseQueries(""), null);
  assert.equal(parseQueries(null), null);
});

test("parseQueries: 코드블록으로 감싼 JSON도 읽음", () => {
  assert.deepEqual(parseQueries('```json\n{"queries": ["수강신청 기간"]}\n```'), ["수강신청 기간"]);
  assert.deepEqual(parseQueries('```\n{"queries": ["졸업학점", "졸업요건"]}\n```'), ["졸업학점", "졸업요건"]);
});

test("parseQueries: 3개 이상이면 앞의 2개만", () => {
  assert.deepEqual(parseQueries('{"queries": ["가", "나", "다", "라"]}'), ["가", "나"]);
});

test("parseQueries: 빈 배열 · 빈 값만 있으면 null", () => {
  assert.equal(parseQueries('{"queries": []}'), null);
  assert.equal(parseQueries('{"queries": ["", "   ", 3]}'), null);
});

test("parseQueries: 빈 값 · 중복은 빼고, 각 80자까지 자름", () => {
  assert.deepEqual(parseQueries('{"queries": ["", "휴학", " 휴학 ", "복학"]}'), ["휴학", "복학"]);
  const long = "가".repeat(120);
  const [first] = parseQueries(`{"queries": ["${long}"]}`);
  assert.equal(first.length, 80);
});

// ── mergeDocs ──
const doc = (id, similarity, url = `https://www.hufs.ac.kr/${id}`) => ({ title: id, url, text: `${id} 본문`, similarity });

test("mergeDocs: 하위 질문마다 상위 3개를 먼저 넣고, 하위 질문 순서대로", () => {
  const a = [doc("a1", 0.9), doc("a2", 0.85), doc("a3", 0.8), doc("a4", 0.79), doc("a5", 0.6)];
  const b = [doc("b1", 0.7), doc("b2", 0.65), doc("b3", 0.62), doc("b4", 0.61)];
  const merged = mergeDocs([a, b]);
  // 보장 6자리로 꽉 참: a1~a3, b1~b3 (a4가 b 쪽보다 유사도가 높아도 보장 자리가 먼저)
  assert.deepEqual(merged.map((d) => d.title), ["a1", "a2", "a3", "b1", "b2", "b3"]);
});

test("mergeDocs: 남는 자리는 유사도 순으로 채움", () => {
  const a = [doc("a1", 0.9), doc("a2", 0.85), doc("a3", 0.8), doc("a4", 0.79), doc("a5", 0.6)];
  const b = [doc("b1", 0.7), doc("b2", 0.65)];
  const merged = mergeDocs([a, b]);
  // 보장 5개(a1~a3, b1~b2) + 남는 1자리는 유사도가 가장 높은 a4
  assert.deepEqual(merged.map((d) => d.title), ["a1", "a2", "a3", "a4", "b1", "b2"]);
});

test("mergeDocs: 같은 조각(url+text)이 두 하위 질문에 나오면 한 번만", () => {
  const shared = doc("공통", 0.8);
  const a = [doc("a1", 0.9), { ...shared }, doc("a2", 0.7)];
  const b = [{ ...shared, similarity: 0.85 }, doc("b1", 0.75), doc("b2", 0.7)];
  const merged = mergeDocs([a, b]);
  assert.deepEqual(merged.map((d) => d.title), ["a1", "공통", "a2", "b1", "b2"]);
  // url은 같아도 text가 다르면 다른 조각
  const sameUrl = mergeDocs([[doc("x", 0.9, "https://same")], [doc("y", 0.8, "https://same")]]);
  assert.equal(sameUrl.length, 2);
});

test("mergeDocs: 한쪽 결과가 비었으면 다른 쪽으로만 채움", () => {
  const a = [doc("a1", 0.9), doc("a2", 0.85), doc("a3", 0.8), doc("a4", 0.79), doc("a5", 0.7), doc("a6", 0.6), doc("a7", 0.55)];
  const merged = mergeDocs([a, []]);
  assert.deepEqual(merged.map((d) => d.title), ["a1", "a2", "a3", "a4", "a5", "a6"]);
  assert.deepEqual(mergeDocs([[], []]), []);
  assert.deepEqual(mergeDocs([]), []);
});

test("mergeDocs: 하위 질문이 1개면 최대 4개", () => {
  const a = [doc("a1", 0.9), doc("a2", 0.85), doc("a3", 0.8), doc("a4", 0.79), doc("a5", 0.7), doc("a6", 0.6)];
  assert.deepEqual(mergeDocs([a]).map((d) => d.title), ["a1", "a2", "a3", "a4"]);
});

test("mergeDocs: 유사도가 없는 조각(키워드 검색)도 순서를 지켜 합침", () => {
  const kw = [{ title: "k1", url: "u1", text: "t1" }, { title: "k2", url: "u2", text: "t2" }];
  const vec = [doc("v1", 0.8)];
  assert.deepEqual(mergeDocs([kw, vec]).map((d) => d.title), ["k1", "k2", "v1"]);
});

// ── api/ask.js 연결: 하위 질문 2개 동시 검색 · 한쪽 실패 시 그쪽만 키워드 · RPC 허용 목록 · 로그에 질문 없음 ──
test("ask.js: 하위 질문별 동시 벡터 검색, 한쪽만 실패하면 그쪽만 키워드 검색, 로그에는 개수만", async () => {
  const ENV = { ASK_IP_SALT: "test-salt", SUPABASE_URL: "https://db.example.test", SUPABASE_SERVICE_KEY: "test-service-key", CLOVA_API_KEY: "test-clova-key" };
  const keys = [...Object.keys(ENV), "CHUNKS_RPC"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  let rewriteReply = "";
  let failEmbedFor = null;
  const embedTexts = [];
  const rpcUrls = [];
  let userPrompt = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    const body = init?.body ? JSON.parse(init.body) : {};
    if (u.includes("/rpc/ask_hit")) return json([{ allowed: true, reason: null, retry_after: 0, minute_hits: 1, day_hits: 1, global_hits: 1 }]);
    if (u.includes("HCX-DASH-002")) return json({ result: { message: { content: rewriteReply }, finishReason: "stop", usage: { promptTokens: 1, completionTokens: 1 } } });
    if (u.includes("/embedding/v2")) {
      embedTexts.push(body.text);
      if (body.text === failEmbedFor) return { ok: false, status: 500, json: async () => ({}) };
      return json({ result: { embedding: [body.text.length] } });
    }
    if (u.includes("/rpc/match_chunks")) {
      rpcUrls.push(u);
      assert.equal(body.match_count, 6);
      const tag = body.query_embedding[0];
      return json([
        { title: `이중전공 ${tag}`, url: "https://www.hufs.ac.kr/a", text: `이중전공은 42학점 ${tag}`, similarity: 0.8 },
        { title: `먼 조각 ${tag}`, url: "https://www.hufs.ac.kr/far", text: `관련 없음 ${tag}`, similarity: 0.6 },
      ]);
    }
    if (u.includes("HCX-005")) {
      userPrompt = body.messages[1].content;
      return json({ result: { message: { content: "이중전공은 42학점입니다. [1]" }, finishReason: "stop", usage: { promptTokens: 10, completionTokens: 5 } } });
    }
    throw new Error(`unexpected fetch ${u}`);
  };
  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...a) => logs.push(a.join(" "));
  console.error = () => {};
  try {
    const { default: handler } = await import("../api/ask.js");
    const call = async (question, ip) => {
      const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
      await handler({ method: "POST", headers: { "x-forwarded-for": ip }, body: { question, lang: "ko" } }, res);
      return res;
    };
    const lastLog = () => JSON.parse(logs.at(-1));

    // 1) 하위 질문 2개, 둘 다 벡터 검색 성공. 허용 목록 밖 RPC 이름은 match_chunks로.
    process.env.CHUNKS_RPC = "drop_table";
    rewriteReply = '```json\n{"queries": ["이중전공 이수 학점", "부전공 이수 학점"]}\n```';
    const both = await call("이중전공과 부전공은 각각 몇 학점이야?", "203.0.113.80");
    assert.equal(both.body.mode, "ai");
    assert.deepEqual(embedTexts, ["이중전공 이수 학점", "부전공 이수 학점"]);
    assert.ok(rpcUrls.every((u) => u.endsWith("/rest/v1/rpc/match_chunks")));
    assert.match(userPrompt, /\[하위 질문\]\n1\. 이중전공 이수 학점\n2\. 부전공 이수 학점/);
    let log = lastLog();
    assert.equal(log.subQueries, 2);
    assert.deepEqual(log.subQueryDocs, [1, 1]); // 유사도 차이 필터를 하위 질문별로 적용(0.6 조각 제외)
    assert.equal(log.rpc, "match_chunks");
    assert.equal(log.retrieval, "vector");

    // 2) 한쪽 벡터 검색만 실패 → 그쪽만 키워드 검색, 허용된 RPC 이름은 그대로
    process.env.CHUNKS_RPC = "match_chunks_next";
    embedTexts.length = 0;
    rpcUrls.length = 0;
    failEmbedFor = "부전공 이수 학점";
    await call("이중전공과 부전공은 각각 몇 학점이야?", "203.0.113.81");
    assert.equal(rpcUrls.length, 1);
    assert.ok(rpcUrls[0].endsWith("/rest/v1/rpc/match_chunks_next"));
    log = lastLog();
    assert.equal(log.retrieval, "mixed");
    assert.equal(log.rpc, "match_chunks_next");
    assert.equal(log.subQueryDocs[0], 1);

    // 3) JSON이 아니면 예전처럼 원래 질문 하나로 검색
    failEmbedFor = null;
    embedTexts.length = 0;
    rewriteReply = "이중전공 이수 학점";
    await call("이중전공은 몇 학점이야?", "203.0.113.82");
    assert.deepEqual(embedTexts, ["이중전공은 몇 학점이야?"]);
    assert.equal(lastLog().subQueries, 1);
    assert.equal(lastLog().rewritten, false);

    // 질문 · 검색어 내용은 로그에 없음
    assert.equal(/이수 학점|몇 학점이야/.test(logs.join("\n")), false);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
