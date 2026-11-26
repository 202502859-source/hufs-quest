import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/ask.js";
import { resetMemoryLimit } from "../api/_lib/usageLimit.js";

const ENV = {
  ASK_IP_SALT: "test-salt",
  SUPABASE_URL: "https://db.example.test",
  SUPABASE_SERVICE_KEY: "test-service-key",
  CLOVA_API_KEY: "test-clova-key",
  ASK_EVAL_TOKEN: "test-eval-token",
  CHUNKS_RPC: "match_chunks",
};

const DOC = {
  id: "11387-03",
  title: "휴학 안내",
  url: "https://www.hufs.ac.kr/hufs/11387/subview.do",
  text: "휴학은 최대 3년까지 할 수 있습니다.",
  similarity: 0.9,
};

async function call({
  token,
  serverToken = "test-eval-token",
  scenario = "normal",
} = {}) {
  const saved = Object.fromEntries(
    Object.keys(ENV).map((key) => [key, process.env[key]])
  );

  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalError = console.error;
  const unexpected = [];

  Object.assign(process.env, ENV);
  process.env.ASK_EVAL_TOKEN = serverToken;
  resetMemoryLimit();

  console.log = () => {};
  console.error = () => {};

  const question =
    scenario === "empty"
      ? "zzzxxyyqq"
      : scenario === "keyword"
        ? "이중전공 신청 언제야?"
        : "휴학은 최대 몇 년이야?";

  const json = (body) => ({
    ok: true,
    status: 200,
    json: async () => body,
  });

  globalThis.fetch = async (url, init) => {
    const u = String(url);

    if (u.endsWith("/rpc/get_answer_cache")) {
      return json([]);
    }

    if (u.endsWith("/rpc/set_answer_cache")) {
      return json(null);
    }

    if (u.endsWith("/rpc/ask_hit")) {
      return json([
        { allowed: true, reason: null, retry_after: 0 }
      ]);
    }

    if (u.includes("HCX-DASH-002")) {
      return json({
        result: {
          message: {
            content: JSON.stringify({ queries: [question] })
          }
        }
      });
    }

    if (u.includes("/embedding/v2")) {
      if (scenario === "keyword") {
        throw new Error("mock embedding failure");
      }

      return json({
        result: { embedding: [0.1, 0.2] }
      });
    }

    if (u.endsWith("/rpc/match_chunks")) {
      return json(scenario === "empty" ? [] : [DOC]);
    }

    if (new URL(u).pathname === "/rest/v1/chunks") {
      return json([
        {
          id: DOC.id,
          collected_at: "2026-11-20T03:00:00Z"
        }
      ]);
    }

    if (u.includes("HCX-005")) {
      if (scenario === "failure") {
        throw new Error("mock generation failure");
      }

      let answer = "휴학은 최대 3년까지 가능합니다. [1]";

      if (scenario === "guard") {
        answer = "2099년 3월 2일입니다. [1]";
      }

      if (scenario === "keyword") {
        answer = "종합정보시스템에서 신청합니다. [1]";
      }

      return json({
        result: {
          message: { content: answer },
          finishReason: "stop"
        }
      });
    }

    unexpected.push(u);
    throw new Error("unexpected fetch");
  };

  try {
    const headers = {
      "x-forwarded-for": "203.0.113.99"
    };

    if (token !== undefined) {
      headers["x-ask-eval-token"] = token;
    }

    const res = {
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.code = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      }
    };

    await handler({
      method: "POST",
      headers,
      body: { question, lang: "ko" }
    }, res);

    assert.deepEqual(unexpected, []);
    assert.equal(res.code, 200);

    return res.body;
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;

    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    resetMemoryLimit();
  }
}

test("인증된 eval 요청은 검색 조각 ID와 점수를 반환", async () => {
  const result = await call({ token: ENV.ASK_EVAL_TOKEN });

  assert.equal(result.mode, "ai");
  assert.deepEqual(result.debug, {
    retrieved: [{ id: DOC.id, score: 0.9 }]
  });
});

test("일반 사용자 응답 구조는 기존과 동일", async () => {
  const result = await call();

  assert.equal(result.mode, "ai");
  assert.deepEqual(
    Object.keys(result).sort(),
    ["answer", "mode", "sources"]
  );
});

test("잘못된 eval 토큰에는 debug 미반환", async () => {
  const result = await call({ token: "wrong-token" });
  assert.equal(result.mode, "ai");
  assert.equal(Object.hasOwn(result, "debug"), false);
});

test("서버 eval 토큰 미설정 시 debug 미반환", async () => {
  const result = await call({
    token: ENV.ASK_EVAL_TOKEN,
    serverToken: ""
  });

  assert.equal(result.mode, "ai");
  assert.equal(Object.hasOwn(result, "debug"), false);
});

test("검색 결과가 없으면 retrieved 빈 배열", async () => {
  const result = await call({
    token: ENV.ASK_EVAL_TOKEN,
    scenario: "empty"
  });

  assert.equal(result.mode, "none");
  assert.deepEqual(result.debug.retrieved, []);
});

test("날짜 검증 실패 시에도 검색 조각 정보 유지", async () => {
  const result = await call({
    token: ENV.ASK_EVAL_TOKEN,
    scenario: "guard"
  });

  assert.equal(result.mode, "none");
  assert.deepEqual(result.debug.retrieved, [
    { id: DOC.id, score: 0.9 }
  ]);
});

test("답변 생성 실패 시에도 검색 조각 정보 유지", async () => {
  const result = await call({
    token: ENV.ASK_EVAL_TOKEN,
    scenario: "failure"
  });

  assert.equal(result.mode, "evidence");
  assert.deepEqual(result.debug.retrieved, [
    { id: DOC.id, score: 0.9 }
  ]);
});

test("키워드 검색 조각의 점수는 null", async () => {
  const result = await call({
    token: ENV.ASK_EVAL_TOKEN,
    scenario: "keyword"
  });

  assert.ok(result.debug.retrieved.length > 0);

  for (const doc of result.debug.retrieved) {
    assert.ok(doc.id.startsWith("kb:"));
    assert.equal(doc.score, null);
  }
});

test("일반 요청의 검색 실패 및 fallback에도 debug 미반환", async () => {
  for (const scenario of ["empty", "guard", "failure", "keyword"]) {
    const result = await call({ scenario });
    assert.equal(Object.hasOwn(result, "debug"), false);
  }
});
