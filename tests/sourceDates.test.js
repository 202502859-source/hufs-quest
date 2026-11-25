import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toKoreanDate,
  fetchCollectedDates,
} from "../api/_lib/sourceDates.js";
import { citedSources } from "../api/ask.js";

const env = {
  SUPABASE_URL: "https://db.example.test",
  SUPABASE_SERVICE_KEY: "mock-key",
};

test("일반 수집일의 한국 시간 변환", () => {
  assert.equal(
    toKoreanDate("2026-11-24T05:17:24.000Z"),
    "2026-11-24"
  );
});

test("UTC 날짜와 한국 날짜가 다르면 한국 날짜 사용", () => {
  assert.equal(
    toKoreanDate("2026-11-24T16:00:00.000Z"),
    "2026-11-25"
  );
});

test("유효하지 않은 날짜는 생략", () => {
  for (const value of [null, undefined, "", "invalid"]) {
    assert.equal(toKoreanDate(value), null);
  }
});

test("조각 ID 중복 제거 및 KB 조각 제외", async () => {
  let count = 0;

  const dates = await fetchCollectedDates(
    [
      { id: "11384-01" },
      { id: "11384-01" },
      { id: "kb:example" },
      { id: null },
    ],
    "match_chunks",
    {
      env,
      fetchImpl: async (url, init) => {
        count++;
        const parsed = new URL(url);

        assert.equal(init.method, "GET");
        assert.equal(parsed.pathname, "/rest/v1/chunks");
        assert.equal(
          parsed.searchParams.get("select"),
          "id,collected_at"
        );
        assert.equal(
          parsed.searchParams.get("id"),
          "in.(11384-01)"
        );

        return {
          ok: true,
          json: async () => [
            {
              id: "11384-01",
              collected_at: "2026-11-24T05:17:24Z",
            },
          ],
        };
      },
    }
  );

  assert.equal(count, 1);
  assert.equal(dates.size, 1);
  assert.equal(dates.get("11384-01"), "2026-11-24");
});

test("시험용 RPC는 chunks_next 조회", async () => {
  await fetchCollectedDates(
    [{ id: "11384-01" }],
    "match_chunks_next",
    {
      env,
      fetchImpl: async (url) => {
        assert.equal(
          new URL(url).pathname,
          "/rest/v1/chunks_next"
        );
        return { ok: true, json: async () => [] };
      },
    }
  );
});

test("조회 대상이 없으면 DB 호출하지 않음", async () => {
  let called = false;

  const dates = await fetchCollectedDates(
    [{ id: "kb:example" }, { id: null }],
    "match_chunks",
    {
      env,
      fetchImpl: async () => {
        called = true;
        throw new Error("unexpected request");
      },
    }
  );

  assert.equal(called, false);
  assert.equal(dates.size, 0);
});

test("DB 조회 실패 시 수집일 없이 계속 처리", async () => {
  const dates = await fetchCollectedDates(
    [{ id: "11384-01" }],
    "match_chunks",
    {
      env,
      fetchImpl: async () => {
        throw new Error("network");
      },
    }
  );

  assert.equal(dates.size, 0);
});

const docs = [
  { id: "a", title: "이중전공", url: "https://www.hufs.ac.kr/a" },
  { id: "b", title: "이중전공", url: "https://www.hufs.ac.kr/a" },
  { id: "c", title: "부전공", url: "https://www.hufs.ac.kr/b" },
  { id: "d", title: "팀 확인", url: "" },
];

const dates = new Map([
  ["a", "2026-11-24"],
  ["b", "2026-11-20"],
  ["c", "2026-11-23"],
  ["d", "2026-11-24"],
]);

test("실제 인용된 조각의 날짜만 출처에 반영", () => {
  assert.deepEqual(citedSources("답변 [1]", docs, dates), [
    {
      title: "이중전공",
      url: "https://www.hufs.ac.kr/a",
      refs: [1],
      collectedAt: "2026-11-24",
    },
  ]);
});

test("동일 URL은 기존처럼 합치고 가장 오래된 수집일 표시", () => {
  assert.deepEqual(citedSources("답변 [1][2]", docs, dates), [
    {
      title: "이중전공",
      url: "https://www.hufs.ac.kr/a",
      refs: [1, 2],
      collectedAt: "2026-11-20",
    },
  ]);
});

test("인용 번호가 없으면 기존 출처 선정 규칙 유지", () => {
  const sources = citedSources("", docs, dates);

  assert.equal(sources.length, 2);
  assert.deepEqual(sources[0].refs, [1, 2]);
  assert.deepEqual(sources[1].refs, [3]);
  assert.equal(sources[1].collectedAt, "2026-11-23");
});

test("수집일이 없으면 기존 응답 구조 유지", () => {
  assert.deepEqual(citedSources("답변 [1]", docs), [
    {
      title: "이중전공",
      url: "https://www.hufs.ac.kr/a",
      refs: [1],
    },
  ]);
});
