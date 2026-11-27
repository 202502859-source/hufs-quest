// 검색창 질문 쪼개기 도우미(api/_lib/decompose.js)를 확인합니다. 네트워크는 부르지 않습니다. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQueries, fallbackQuery, mergeDocs, evidenceDocs } from "../api/_lib/decompose.js";

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

// ── fallbackQuery (JSON이 아닐 때 예전 방식의 한 줄 검색어) ──
test("fallbackQuery: 한 줄 검색어는 그대로", () => {
  assert.equal(fallbackQuery("이중전공 신청 시기 신청 방법"), "이중전공 신청 시기 신청 방법");
  assert.equal(fallbackQuery('"휴학 최대 기간"\n'), "휴학 최대 기간"); // 따옴표 · 줄바꿈 정리
});

test("fallbackQuery: 깨진 JSON · 81자 이상 · 빈 문자열은 null", () => {
  assert.equal(fallbackQuery('{"queries": ["휴학 최대 기간"'), null);
  assert.equal(fallbackQuery("휴학 최대 기간}"), null);
  assert.equal(fallbackQuery("가".repeat(81)), null);
  assert.equal(fallbackQuery("가".repeat(80)), "가".repeat(80));
  assert.equal(fallbackQuery(""), null);
  assert.equal(fallbackQuery("   \n "), null);
  assert.equal(fallbackQuery(null), null);
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

test("mergeDocs: 하위 질문이 둘이면 한 페이지가 몫을 다 차지하지 못함(11/21 조기졸업 재현 순위)", () => {
  // 11/21 로컬 재현: "조기졸업 평점 기준" / "졸업 요건 평점" 하위 질문의 실제 검색 순위와 유사도
  const page = (n) => `https://www.hufs.ac.kr/hufs/${n}/subview.do`;
  const early = [doc("11389-02", 0.730, page(11389)), doc("11389-01", 0.713, page(11389)), doc("11389-04", 0.711, page(11389))];
  const grad = [
    doc("11391-01", 0.724, page(11391)), doc("11391-t03", 0.716, page(11391)), doc("11391-t04", 0.716, page(11391)),
    doc("11391-t02", 0.713, page(11391)), doc("11391-t01", 0.710, page(11391)), doc("11390-01", 0.691, page(11390)),
  ];
  const merged = mergeDocs([early, grad]).map((d) => d.title);
  // 예전에는 11391 조각 3개가 둘째 몫을 다 차지해 졸업 요건(11390-01, "2.00 이상")이 빠졌음
  assert.deepEqual(merged, ["11389-02", "11389-01", "11389-04", "11391-01", "11391-t03", "11390-01"]);
  // 한 페이지 결과밖에 없는 하위 질문(조기졸업)은 같은 페이지로 몫을 채움
  assert.equal(merged.filter((t) => t.startsWith("11389")).length, 3);
});

test("mergeDocs: 페이지 제한은 몫을 고를 때만, 남는 자리는 그대로 유사도 순", () => {
  const p = "https://www.hufs.ac.kr/same";
  const a = [doc("a1", 0.9, p), doc("a2", 0.89, p), doc("a3", 0.88, p), doc("a4", 0.5)];
  const b = [doc("b1", 0.7)];
  // a의 몫: a1 · a2(같은 페이지 2개) + a4(다른 페이지). b의 몫: b1. 남는 2자리: a3(0.88)
  assert.deepEqual(mergeDocs([a, b]).map((d) => d.title), ["a1", "a2", "a3", "a4", "b1"]);
});

test("mergeDocs: 하위 질문이 1개면 페이지 제한 없이 순위 그대로(최대 4개)", () => {
  const p = "https://www.hufs.ac.kr/hufs/11373/subview.do";
  const one = [doc("t01", 0.9, p), doc("t02", 0.89, p), doc("t03", 0.88, p), doc("t04", 0.87, p), doc("x", 0.86)];
  assert.deepEqual(mergeDocs([one]).map((d) => d.title), ["t01", "t02", "t03", "t04"]);
});

test("mergeDocs: 유사도가 없는 조각(키워드 검색)도 순서를 지켜 합침", () => {
  const kw = [{ title: "k1", url: "u1", text: "t1" }, { title: "k2", url: "u2", text: "t2" }];
  const vec = [doc("v1", 0.8)];
  assert.deepEqual(mergeDocs([kw, vec]).map((d) => d.title), ["k1", "k2", "v1"]);
});

// ── mergeDocs: 형제 조각(시험용 DB, id 끝 "-a" · "-b")은 한 자리 ──
// 조각 id를 가진 문서(url은 페이지, text는 id마다 다름)
const chunk = (id, similarity) => ({ id, title: id, url: `https://www.hufs.ac.kr/hufs/${id.split("-")[0]}/subview.do`, text: `${id} 본문`, similarity });

test("siblingKey: 끝이 -소문자 한 글자면 그걸 뗀 값, 아니면 null", async () => {
  const { siblingKey } = await import("../api/_lib/decompose.js");
  assert.equal(siblingKey({ id: "11384-11-a" }), "11384-11");
  assert.equal(siblingKey({ id: "11384-11-b" }), "11384-11");
  assert.equal(siblingKey({ id: "11384-06" }), null);
  assert.equal(siblingKey({ id: "sugang2026-2-02" }), null);
  assert.equal(siblingKey({ id: "kb:abc" }), null);
  assert.equal(siblingKey({ id: null }), null);
  assert.equal(siblingKey({}), null);
});

test("mergeDocs: 형제 조각은 한 자리(11/26 C10 재현) — 하위 질문 1개, 후보 5개에서 11384-06이 들어감", () => {
  const list = [chunk("11384-09", 0.6), chunk("11384-11-a", 0.585), chunk("11388-07", 0.573), chunk("11384-11-b", 0.561), chunk("11384-06", 0.557)];
  const ids = mergeDocs([list]).map((d) => d.id);
  assert.ok(ids.includes("11384-06"), `11384-06이 빠짐: ${ids}`);
  // 형제는 처음 나온 조각 바로 뒤에 같이, 자리는 4개(11384-09 · 11384-11 묶음 · 11388-07 · 11384-06)
  assert.deepEqual(ids, ["11384-09", "11384-11-a", "11384-11-b", "11388-07", "11384-06"]);
});

test("mergeDocs: 형제는 한 묶음에서 최대 3개까지 같이 넣음(뽑힌 조각 + 3개)", async () => {
  const { MAX_SIBLINGS } = await import("../api/_lib/decompose.js");
  assert.equal(MAX_SIBLINGS, 3);
  const list = [chunk("1-1-a", 0.9), chunk("1-1-b", 0.89), chunk("1-1-c", 0.88), chunk("1-1-d", 0.87), chunk("1-1-e", 0.86), chunk("2-1", 0.5)];
  assert.deepEqual(mergeDocs([list]).map((d) => d.id), ["1-1-a", "1-1-b", "1-1-c", "1-1-d", "2-1"]);
});

test("mergeDocs: 하위 질문이 둘이면 형제 키 기준으로 몫 · 남는 자리를 셈", () => {
  const a = [chunk("10-1-a", 0.9), chunk("10-1-b", 0.88), chunk("10-2", 0.8), chunk("10-3", 0.7), chunk("10-4", 0.6)];
  const b = [chunk("20-1", 0.85), chunk("20-2", 0.75), chunk("20-3", 0.65), chunk("10-1-b", 0.88)];
  const ids = mergeDocs([a, b]).map((d) => d.id);
  // 자리 6개: a 몫(10-1 묶음 · 10-2 · 10-3), b 몫(20-1 · 20-2 · 20-3). 10-1-b는 b에 다시 나와도 같은 자리
  assert.deepEqual(ids, ["10-1-a", "10-1-b", "10-2", "10-3", "20-1", "20-2", "20-3"]);
});

test("mergeDocs: 형제 id가 없으면(실서비스 DB) 예전 계산과 결과가 완전히 같음", () => {
  // 형제 처리를 넣기 전의 mergeDocs(11/26 main)를 그대로 옮긴 기준 구현
  const docKey = (d) => `${d?.url ?? ""}\n${d?.text ?? ""}`;
  const sim = (d) => (typeof d?.similarity === "number" ? d.similarity : 0);
  function shareOfOld(list, pageCap, count) {
    const docs = list.filter(Boolean);
    const chosen = new Set();
    const perPage = new Map();
    for (const d of docs) {
      if (chosen.size >= count) break;
      const page = d.url ?? "";
      if ((perPage.get(page) ?? 0) >= pageCap) continue;
      perPage.set(page, (perPage.get(page) ?? 0) + 1);
      chosen.add(d);
    }
    for (const d of docs) {
      if (chosen.size >= count) break;
      chosen.add(d);
    }
    return docs.filter((d) => chosen.has(d));
  }
  function mergeDocsOld(lists, { perQuery = 3, max = 6, pageCap = 2 } = {}) {
    const safe = (Array.isArray(lists) ? lists : []).map((l) => (Array.isArray(l) ? l : []));
    const limit = safe.length <= 1 ? Math.min(max, 4) : max;
    if (limit <= 0) return [];
    const candidates = new Map();
    safe.forEach((list, queryIndex) => list.forEach((d, rank) => {
      if (!d) return;
      const k = docKey(d);
      if (!candidates.has(k)) candidates.set(k, { doc: d, queryIndex, rank });
    }));
    const picked = new Map();
    safe.forEach((list) => shareOfOld(list, safe.length > 1 ? pageCap : Infinity, perQuery).forEach((d) => {
      if (picked.size >= limit) return;
      const k = docKey(d);
      if (!picked.has(k)) picked.set(k, candidates.get(k));
    }));
    const rest = [...candidates.entries()].filter(([k]) => !picked.has(k)).sort(([, a], [, b]) => sim(b.doc) - sim(a.doc) || a.queryIndex - b.queryIndex || a.rank - b.rank);
    for (const [k, e] of rest) {
      if (picked.size >= limit) break;
      picked.set(k, e);
    }
    return [...picked.values()].sort((a, b) => a.queryIndex - b.queryIndex || a.rank - b.rank).map((e) => e.doc);
  }
  // 실서비스 형태 id(숫자로 끝남) · kb: 키워드 id · id 없음 · 같은 페이지 여러 조각 · 유사도 없음 · 중복 조각을 섞은 무작위 입력
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const ids = ["11384-06", "11384-09", "11384-11", "11388-07", "11377-02", "11377-05", "11390-01", "11391-02", "kb:3", null];
  for (let round = 0; round < 300; round++) {
    const lists = Array.from({ length: 1 + Math.floor(rand() * 3) }, () =>
      Array.from({ length: Math.floor(rand() * 8) }, () => {
        const id = ids[Math.floor(rand() * ids.length)];
        const page = ["11384", "11377", "11390"][Math.floor(rand() * 3)];
        return { id, title: String(id), url: `https://www.hufs.ac.kr/hufs/${page}/subview.do`, text: `${id} 본문`, ...(rand() < 0.8 ? { similarity: Math.round(rand() * 100) / 100 } : {}) };
      }),
    );
    assert.deepEqual(mergeDocs(lists), mergeDocsOld(lists), `round ${round}`);
  }
});

// ── api/ask.js 연결: 하위 질문 2개 동시 검색 · 한쪽 실패 시 그쪽만 키워드 · RPC 허용 목록 · 로그에 질문 없음 ──
test("ask.js: 하위 질문별 동시 벡터 검색, 한쪽만 실패하면 그쪽만 키워드 검색, 로그에는 개수만", async () => {
  const ENV = { ASK_IP_SALT: "test-salt", SUPABASE_URL: "https://db.example.test", SUPABASE_SERVICE_KEY: "test-service-key", CLOVA_API_KEY: "test-clova-key" };
  ENV.ASK_EVAL_TOKEN = "test-mixed-eval-token";
  const keys = [...Object.keys(ENV), "CHUNKS_RPC"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  let rewriteReply = "";
  let failEmbedFor = null;
  let failAnswer = false;
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
        { id: `a-${tag}`, title: `이중전공 ${tag}`, url: "https://www.hufs.ac.kr/a", text: `이중전공은 42학점 ${tag}`, similarity: 0.8 },
        { id: `far-${tag}`, title: `먼 조각 ${tag}`, url: "https://www.hufs.ac.kr/far", text: `관련 없음 ${tag}`, similarity: 0.6 },
      ]);
    }
    if (u.includes("HCX-005")) {
      userPrompt = body.messages[1].content;
      if (failAnswer) return { ok: false, status: 500, json: async () => ({}) };
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
    const call = async (question, ip, evalMode = false) => {
      const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
      const headers = { "x-forwarded-for": ip };

      if (evalMode) {
        headers["x-ask-eval-token"] = ENV.ASK_EVAL_TOKEN;
      }

      await handler({
        method: "POST",
        headers,
        body: { question, lang: "ko" }
      }, res);
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
    assert.deepEqual(log.subQueryIds, [["a-10"], ["a-9"]]); // 최종 근거에 들어간 조각 id만(질문 내용 없음)
    assert.equal(log.rpc, "match_chunks");
    assert.equal(log.retrieval, "vector");
    assert.equal(log.rewriteFormat, "json");

    // 2) 한쪽 벡터 검색만 실패 → 그쪽만 키워드 검색, 허용된 RPC 이름은 그대로
    process.env.CHUNKS_RPC = "match_chunks_next";
    embedTexts.length = 0;
    rpcUrls.length = 0;
    failEmbedFor = "부전공 이수 학점";
    const mixed = await call(
      "이중전공과 부전공은 각각 몇 학점이야?",
      "203.0.113.81",
      true
    );

    assert.equal(mixed.code, 200);

    const retrieved = mixed.body.debug.retrieved;

    assert.ok(retrieved.some(d =>
      d.method === "vector" &&
      d.id === "a-10" &&
      Number.isFinite(d.score)
    ));

    assert.ok(retrieved.some(d =>
      d.method === "keyword" &&
      d.id.startsWith("kb:") &&
      d.score === null
    ));

    assert.equal(Object.hasOwn(both.body, "debug"), false);
    assert.equal(rpcUrls.length, 1);
    assert.ok(rpcUrls[0].endsWith("/rest/v1/rpc/match_chunks_next"));
    log = lastLog();
    assert.equal(log.retrieval, "mixed");
    assert.equal(log.rpc, "match_chunks_next");
    assert.equal(log.subQueryDocs[0], 1);

    // 3) JSON이 아니지만 한 줄 검색어면 예전 방식처럼 그 한 줄로 검색(rewriteFormat "line")
    process.env.CHUNKS_RPC = "";
    failEmbedFor = null;
    embedTexts.length = 0;
    rewriteReply = "이중전공 이수 학점";
    await call("이중전공은 몇 학점이야?", "203.0.113.82");
    assert.deepEqual(embedTexts, ["이중전공 이수 학점"]);
    assert.equal(lastLog().subQueries, 1);
    assert.equal(lastLog().rewritten, true);
    assert.equal(lastLog().rewriteFormat, "line");

    // 4) 깨진 JSON이면 원래 질문 하나로 검색(rewriteFormat "none")
    embedTexts.length = 0;
    rewriteReply = '{"queries": ["이중전공 이수 학점"';
    await call("이중전공은 몇 학점이야?", "203.0.113.83");
    assert.deepEqual(embedTexts, ["이중전공은 몇 학점이야?"]);
    assert.equal(lastLog().rewritten, false);
    assert.equal(lastLog().rewriteFormat, "none");

    // 5) AI 호출 실패 + 하위 질문 2개 → 각 하위 질문의 1등 근거를 하나씩 원문으로
    failAnswer = true;
    rewriteReply = '{"queries": ["이중전공 이수 학점", "부전공 이수 학점"]}';
    const evidence = await call("이중전공과 부전공은 각각 몇 학점이야?", "203.0.113.84");
    assert.equal(evidence.body.mode, "evidence");
    assert.equal(evidence.body.answer, "이중전공은 42학점 10\n이중전공은 42학점 9");
    assert.equal(lastLog().mode, "evidence");
    failAnswer = false;

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

// ── evidenceDocs (AI 실패 시 보여 줄 근거 원문) ──
test("evidenceDocs: 하위 질문이 둘이면 각 1등을 하나씩", () => {
  const a = [doc("a1", 0.9), doc("a2", 0.85)];
  const b = [doc("b1", 0.7), doc("b2", 0.65)];
  assert.deepEqual(evidenceDocs([a, b], mergeDocs([a, b])).map((d) => d.title), ["a1", "b1"]);
});

test("evidenceDocs: 한쪽이 비었거나 1등이 같으면 합친 근거 앞쪽으로 채움", () => {
  const a = [doc("a1", 0.9), doc("a2", 0.85)];
  assert.deepEqual(evidenceDocs([a, []], mergeDocs([a, []])).map((d) => d.title), ["a1", "a2"]);
  const shared = doc("공통", 0.9);
  const b = [{ ...shared }, doc("b1", 0.7)];
  const c = [{ ...shared }, doc("c1", 0.6)];
  assert.deepEqual(evidenceDocs([b, c], mergeDocs([b, c])).map((d) => d.title), ["공통", "b1"]);
  // 하위 질문별 결과가 모두 비고 키워드 검색으로 다시 찾은 경우
  const kw = [doc("k1", 0), doc("k2", 0), doc("k3", 0)];
  assert.deepEqual(evidenceDocs([[], []], kw).map((d) => d.title), ["k1", "k2"]);
});

test("evidenceDocs: 하위 질문이 하나면 앞의 2개", () => {
  const a = [doc("a1", 0.9), doc("a2", 0.85), doc("a3", 0.8)];
  assert.deepEqual(evidenceDocs([a], mergeDocs([a])).map((d) => d.title), ["a1", "a2"]);
});

// ── api/ask.js 숫자 근거 검사: 걸린 숫자만 돌려주고, evidence 로그에는 숫자 토큰만 ──
test("unsupportedNumbers: 근거에 없던 숫자 · 시기 표현만 중복 없이 돌려줌(검사 기준은 그대로)", async () => {
  const { unsupportedNumbers } = await import("../api/ask.js");
  const docs = [{ title: "이중전공", text: "25학번 이후부터는 32학점 이상 이수해야 한다." }];
  // 표기를 바꿔 "2025학번"이라고 쓰면 여전히 걸림(검사를 느슨하게 하지 않음)
  assert.deepEqual(unsupportedNumbers("2025학번 이후는 32학점 이상입니다. [1]", docs), { numbers: ["2025"], timeWords: [] });
  // 자료 표기 그대로면 통과, 인용 번호 [1]은 숫자로 세지 않음
  assert.deepEqual(unsupportedNumbers("25학번 이후는 32학점 이상입니다. [1]", docs), { numbers: [], timeWords: [] });
  // 여러 개 · 중복
  assert.deepEqual(unsupportedNumbers("36학점, 36학점, 2025학번, 7학기 [1]", docs), { numbers: ["36", "2025", "7"], timeWords: [] });
  // 근거에 없는 시기 표현
  assert.deepEqual(unsupportedNumbers("Apply in early March. [1]", docs), { numbers: [], timeWords: ["march"] });
  // 줄 맨 앞의 목록 번호(1. · 2) · ①)는 검사에서 빼고, 문장 안의 숫자는 그대로 검사
  const listed = "1. 25학번 이후는 32학점 이상입니다. [1]\n2) 신청은 학기마다 합니다.\n3. 성적 기준이 있습니다.\n  4. 면담이 필요합니다.\n① 서류를 냅니다.";
  assert.deepEqual(unsupportedNumbers(listed, docs), { numbers: [], timeWords: [] });
  assert.deepEqual(unsupportedNumbers("1. 2025학번 이후는 36학점입니다.\n3. 4학기 이상 다녀야 합니다.", docs), { numbers: ["2025", "36", "4"], timeWords: [] });
  // 줄 맨 앞이 아닌 "3. "은 문장 안의 숫자로 검사, 줄 맨 앞의 날짜 · 연도는 번호로 보지 않음
  // (근거 검사는 부분 문자열 기준이라 "3"은 근거의 "32"에 포함돼 통과하므로, 근거에 없는 7로 확인)
  assert.deepEqual(unsupportedNumbers("조건은 7. 입니다.", docs), { numbers: ["7"], timeWords: [] });
  assert.deepEqual(unsupportedNumbers("2026.03.02 개강\n2025. 신청", docs), { numbers: ["2026.03", "02", "2025"], timeWords: [] });
});


// 질문에서 주어진 숫자는 허용하되 새로운 숫자는 허용하지 않습니다.
const questionNumberDocs = [{
  title: "이중전공",
  text: "34학점 이상 취득한 경우 우선 선발. 25학번 이후는 32학점 이상 우선 선발."
}];

const cohortQuestion = "24학번과 25학번의 일반 이중전공 우선 선발 기준 학점은 각각 몇 학점이야?";
const cohortAnswer = "24학번은 34학점, 25학번은 32학점 이상 취득 시 우선 선발됩니다. [1]";

test("unsupportedNumbers: C09 기존 방식은 24를 차단", async () => {
  const { unsupportedNumbers } = await import("../api/ask.js");
  assert.deepEqual(
    unsupportedNumbers(cohortAnswer, questionNumberDocs),
    { numbers: ["24"], timeWords: [] }
  );
});

test("unsupportedNumbers: C09 질문 숫자를 허용", async () => {
  const { unsupportedNumbers } = await import("../api/ask.js");
  assert.deepEqual(
    unsupportedNumbers(cohortAnswer, questionNumberDocs, cohortQuestion),
    { numbers: [], timeWords: [] }
  );
});

test("unsupportedNumbers: 질문과 근거에 모두 없는 숫자는 차단", async () => {
  const { unsupportedNumbers } = await import("../api/ask.js");
  assert.deepEqual(
    unsupportedNumbers(
      "24학번은 36학점, 25학번은 99학점입니다. [1]",
      questionNumberDocs,
      cohortQuestion
    ),
    { numbers: ["36", "99"], timeWords: [] }
  );
});

test("unsupportedNumbers: 질문 숫자의 부분 문자열은 새로 허용하지 않음", async () => {
  const { unsupportedNumbers } = await import("../api/ask.js");
  assert.deepEqual(
    unsupportedNumbers(
      "7학점과 72학점입니다.",
      [],
      "172학점인가요?"
    ),
    { numbers: ["7", "72"], timeWords: [] }
  );
});

test("unsupportedNumbers: 소수점 숫자는 같은 토큰만 허용", async () => {
  const { unsupportedNumbers } = await import("../api/ask.js");
  assert.deepEqual(
    unsupportedNumbers(
      "3.75와 3.7입니다.",
      [],
      "평점 3.75인가요?"
    ),
    { numbers: ["3.7"], timeWords: [] }
  );
});

test("unsupportedNumbers: 질문 속 시기 표현으로 기존 검사를 우회하지 않음", async () => {
  const { unsupportedNumbers } = await import("../api/ask.js");
  assert.deepEqual(
    unsupportedNumbers(
      "Apply in March. [1]",
      questionNumberDocs,
      "March에 신청하나요?"
    ),
    { numbers: [], timeWords: ["march"] }
  );
});

test("ask.js: 숫자 근거 검사에 걸리면 evidence 로그에 근거에 없던 숫자만(최대 5개), 문장은 남기지 않음", async () => {
  const ENV = { ASK_IP_SALT: "test-salt", SUPABASE_URL: "https://db.example.test", SUPABASE_SERVICE_KEY: "test-service-key", CLOVA_API_KEY: "test-clova-key" };
  const saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  let reply = "";
  let systemPrompt = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    if (u.includes("/rpc/ask_hit")) return json([{ allowed: true, reason: null, retry_after: 0, minute_hits: 1, day_hits: 1, global_hits: 1 }]);
    if (u.includes("HCX-DASH-002")) return json({ result: { message: { content: '{"queries": ["이중전공 신청 자격"]}' }, finishReason: "stop" } });
    if (u.includes("/embedding/v2")) return json({ result: { embedding: [0.1] } });
    if (u.includes("/rpc/match_chunks")) {
      return json([{ title: "이중전공", url: "https://www.hufs.ac.kr/x", text: "25학번 이후부터는 32학점 이상 이수해야 한다.", similarity: 0.8 }]);
    }
    if (u.includes("HCX-005")) {
      systemPrompt = JSON.parse(init.body).messages[0].content;
      return json({ result: { message: { content: reply }, finishReason: "stop", usage: { promptTokens: 10, completionTokens: 5 } } });
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
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    reply = "2025학번 이후 학생은 32학점 이상이고, 2019학번은 42학점, 2020 2021 2022 2023학번은 따로 정합니다. [1]";
    await handler({ method: "POST", headers: { "x-forwarded-for": "203.0.113.90" }, body: { question: "이중전공 신청 조건이 뭐야?", lang: "ko" } }, res);
    assert.equal(res.body.mode, "evidence");
    const log = JSON.parse(logs.at(-1));
    assert.equal(log.mode, "evidence");
    assert.deepEqual(log.unsupportedNumbers, ["2025", "2019", "42", "2020", "2021"]); // 최대 5개
    assert.equal(log.unsupportedTimeWords, 0);
    assert.equal(/학번|학점|이중전공/.test(logs.join("\n")), false); // 질문 · 답 문장은 없음
    assert.match(systemPrompt, /'25학번'이면 '2025학번'으로 바꾸지 않는다/);
    assert.match(systemPrompt, /이름이 다른 제도의 규칙을 질문한 제도의 규칙처럼 말하지 않는다/);
    assert.match(systemPrompt, /번호를 붙이지 말고 문장으로 이어 쓴다/);

    // 원본 질문의 학번이 실제 API 숫자 검증에도 전달되는지 확인합니다.
    reply = "24학번은 32학점 이상입니다. [1]";
    await handler({
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.91" },
      body: { question: "24학번의 기준은 뭐야?", lang: "ko" }
    }, res);
    assert.equal(res.body.mode, "ai");
    assert.match(res.body.answer, /24학번/);

    // 질문에 나온 숫자를 허용해도 새로운 숫자는 차단해야 합니다.
    reply = "24학번은 99학점 이상입니다. [1]";
    await handler({
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.92" },
      body: { question: "24학번의 기준은 무엇인가요?", lang: "ko" }
    }, res);
    assert.equal(res.body.mode, "evidence");
    assert.deepEqual(
      JSON.parse(logs.at(-1)).unsupportedNumbers,
      ["99"]
    );

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
