import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  structureCalendar,
  calendarNotes
} from "./calendarPage.mjs";

const chunks = JSON.parse(readFileSync(
  new URL("../../data/chunks.json", import.meta.url),
  "utf8"
));

const source = chunks.filter(
  c => /^11360-\d{2}$/.test(c.id)
);

const result = structureCalendar(source);
const items = result.items;

function changed(id, modify) {
  const copy = structuredClone(source);
  const chunk = copy.find(c => c.id === id);

  assert.ok(chunk);
  modify(chunk);

  return copy;
}

test("2026학년도 일정 행 63개 구조화", () => {
  assert.equal(result.academicYear, 2026);
  assert.equal(items.length, 63);
});

test("구역별 일정 개수 보존", () => {
  const counts = {};

  for (const item of items) {
    counts[item.period] =
      (counts[item.period] || 0) + 1;
  }

  assert.deepEqual(counts, {
    spring: 24,
    summer: 8,
    fall: 21,
    winter: 10
  });
});

test("일정 ID 중복 없음", () => {
  assert.equal(
    new Set(items.map(item => item.id)).size,
    items.length
  );
});

test("모든 일정의 원문 행을 손실 없이 복원", () => {
  for (const chunk of source) {
    const rows = items.filter(
      item => item.sourceId === chunk.id
    );

    assert.ok(rows.length);

    const restored = rows.map(item => {
      const start = item.startDate.replaceAll("-", ".");
      const end = item.endDate?.replaceAll("-", ".");

      return end
        ? `${start} ~ ${end}: ${item.name}`
        : `${start}: ${item.name}`;
    });

    const original = chunk.text.split("\n").slice(
      1 + calendarNotes(2026, rows[0].period).length
    );

    assert.deepEqual(restored, original);
  }
});

test("원본 출처 및 수집일 보존", () => {
  for (const item of items) {
    const chunk = source.find(
      c => c.id === item.sourceId
    );

    assert.ok(chunk);
    assert.equal(item.sourceUrl, chunk.url);
    assert.equal(item.collectedAt, chunk.collected_at);
  }
});

test("단일 날짜 일정의 종료일은 null 유지", () => {
  const item = items.find(
    c => c.name === "제2학기 종강"
  );

  assert.equal(item.startDate, "2026-12-21");
  assert.equal(item.endDate, null);
});

test("12월에서 다음 해 1월로 이어지는 일정", () => {
  const item = items.find(
    c => c.name === "제2학기 성적 열람 및 정정"
  );

  assert.equal(item.academicYear, 2026);
  assert.equal(item.startDate, "2026-12-28");
  assert.equal(item.endDate, "2027-01-04");
});

test("다음 해 2월 수강신청의 실제 날짜 보존", () => {
  const item = items.find(
    c => c.name === "수강신청(2~4학년)"
  );

  assert.equal(item.academicYear, 2026);
  assert.equal(item.startDate, "2027-02-10");
  assert.equal(item.endDate, "2027-02-12");
});

test("학기개시일과 개강 관련 원문 기록 보존", () => {
  const dates = [
    ["삼일절·학기개시일", "2026-03-01"],
    ["2026학년도 제1학기 개강·대체휴업일", "2026-03-02"],
    ["제1학기 개강", "2026-03-03"]
  ];

  for (const [name, date] of dates) {
    assert.ok(items.some(
      c => c.name === name && c.startDate === date
    ));
  }
});

test("2027학년도 제1학기 개강일을 생성하지 않음", () => {
  assert.equal(items.filter(
    c =>
      c.startDate.startsWith("2027-") &&
      c.name.includes("제1학기") &&
      c.name.includes("개강")
  ).length, 0);
});

test("잘못된 달력 날짜 차단", () => {
  const data = changed("11360-04", c => {
    c.text = c.text.replace(
      "2027.02.19:", "2027.02.30:"
    );
  });

  assert.throws(
    () => structureCalendar(data),
    /유효하지 않은 학사일정 날짜/
  );
});

test("시작일과 종료일 역전 차단", () => {
  const data = changed("11360-03", c => {
    c.text = c.text.replace(
      "2026.12.15 ~ 2026.12.21",
      "2026.12.15 ~ 2026.12.14"
    );
  });

  assert.throws(
    () => structureCalendar(data),
    /시작일과 종료일 역전/
  );
});

test("학년도 범위를 벗어난 날짜 차단", () => {
  const data = changed("11360-04", c => {
    c.text = c.text.replace(
      "2027.02.19:", "2026.02.19:"
    );
  });

  assert.throws(
    () => structureCalendar(data),
    /학년도 범위 초과/
  );
});

test("일정 월과 구역 불일치 차단", () => {
  const data = changed("11360-03", c => {
    c.text = c.text.replace(
      "2026.09.01:", "2026.08.01:"
    );
  });

  assert.throws(
    () => structureCalendar(data),
    /월과 구역 불일치/
  );
});

test("잘못된 공식 출처 차단", () => {
  const data = changed("11360-01", c => {
    c.url = "https://example.com";
  });

  assert.throws(
    () => structureCalendar(data),
    /출처 불일치/
  );
});

test("학사일정 조각 누락 차단", () => {
  assert.throws(
    () => structureCalendar(source.slice(0, 3)),
    /4개여야/
  );
});

test("학사일정 조각 중복 차단", () => {
  const data = [...source.slice(0, 3), source[0]];

  assert.throws(
    () => structureCalendar(data),
    /중복 또는 누락/
  );
});

test("알 수 없는 일정 행 형식 차단", () => {
  const data = changed("11360-01", c => {
    c.text += "\n확인되지 않은 일정";
  });

  assert.throws(
    () => structureCalendar(data),
    /형식 불일치/
  );
});

test("구조화 과정에서 원본 객체 수정 없음", () => {
  const before = structuredClone(source);

  structureCalendar(source);

  assert.deepEqual(source, before);
});

test("해당 학기 필드 전체 검증", () => {
  assert.ok(items.every(
    item => Object.hasOwn(item, "targetSemester")
  ));

  const allowed = new Set([
    "2026-1", "2026-2", "2027-1",
    "2026-summer", "2026-winter", null
  ]);

  assert.ok(items.every(
    item => allowed.has(item.targetSemester)
  ));
});

const semesterCases = [
  ["11360-01-03", "2026-1"],
  ["11360-01-24", "2026-1"],
  ["11360-01-23", "2026-summer"],
  ["11360-02-01", "2026-summer"],
  ["11360-02-02", "2026-1"],
  ["11360-02-03", "2026-2"],
  ["11360-02-04", "2026-2"],
  ["11360-02-05", "2026-2"],
  ["11360-02-08", "2026-1"],
  ["11360-03-01", "2026-2"],
  ["11360-03-19", "2026-winter"],
  ["11360-03-21", "2026-2"],
  ["11360-04-02", "2026-winter"],
  ["11360-04-03", "2026-2"],
  ["11360-04-04", "2027-1"],
  ["11360-04-05", "2027-1"],
  ["11360-04-08", "2027-1"],
  ["11360-04-09", "2026-2"],
  ["11360-04-10", "2027-1"],
  ["11360-02-06", null],
  ["11360-04-01", null]
];

for (const [id, expected] of semesterCases) {
  test(`해당 학기 분류: ${id}`, () => {
    const item = items.find(d => d.id === id);

    assert.ok(item);

    assert.equal(
      item.targetSemester,
      expected
    );
  });
}

test("2027-1 수강신청은 다음 학년도 개강일이 아님", () => {
  const next = items.filter(
    item => item.targetSemester === "2027-1"
  );

  assert.equal(next.length, 4);

  assert.equal(
    next.filter(item =>
      item.name.includes("개강")
    ).length,
    0
  );
});

// ── 11/27: 2027학년도 화면(subview.do?year=2027) 조각을 함께 구조화 ──
test("2026 · 2027학년도 조각 8개를 함께 구조화: 학년도별 63행, 2026 항목은 그대로", () => {
  const all = chunks.filter(c => /^11360-(?:\d{4}-)?\d{2}$/.test(c.id));
  const both = structureCalendar(all);

  assert.equal(both.academicYear, 2026);
  assert.deepEqual(both.academicYears, [2026, 2027]);
  assert.equal(both.items.length, 126);
  assert.deepEqual(both.items.filter(i => i.academicYear === 2026), items);

  const y2027 = both.items.filter(i => i.academicYear === 2027);
  assert.equal(y2027.length, 63);
  assert.ok(y2027.every(i => i.id.startsWith("11360-2027-")));
  assert.ok(y2027.every(i => i.sourceUrl === "https://www.hufs.ac.kr/hufs/11360/subview.do?year=2027"));
});

test("2027학년도 해당 학기 분류(같은 규칙): 제1학기 개강 · 여름 계절학기 · 2027-2 수강신청 · 2028-1 수강신청", () => {
  const both = structureCalendar(chunks.filter(c => /^11360-(?:\d{4}-)?\d{2}$/.test(c.id)));
  const find = (start, name) => both.items.find(i => i.startDate === start && i.name === name);

  assert.equal(find("2027-03-02", "2027학년도 제1학기 개강").targetSemester, "2027-1");
  assert.equal(find("2027-06-22", "하계방학 및 계절학기 개강").targetSemester, "2027-summer");
  assert.equal(find("2027-08-09", "수강신청").targetSemester, "2027-2");
  assert.equal(find("2028-02-07", "수강신청(2~4학년)").targetSemester, "2028-1");
  assert.equal(find("2028-01-31", "사전수강신청").targetSemester, "2028-1");
});

test("2026 겨울방학 조각 안내 줄: 2027 조각이 생겨 '2027학년도 일정은 2027학년도 학사일정 조각 참고'", () => {
  const winter = chunks.find(c => c.id === "11360-04");
  assert.ok(winter.text.includes("2027학년도 일정은 2027학년도 학사일정 조각 참고"));
  assert.ok(!winter.text.includes("개강일은 이 일정표에 없음"));
  assert.deepEqual(calendarNotes(2026, "winter", true).at(-1), "2027학년도 일정은 2027학년도 학사일정 조각 참고");
  // 2027 겨울방학 조각은 2028 화면이 없어 예전 문장 그대로
  assert.ok(chunks.find(c => c.id === "11360-2027-04").text.includes("2028학년도 제1학기 개강일은 이 일정표에 없음"));
});

test("다른 학년도 조각의 id 연도와 본문 학년도가 다르면 차단", () => {
  const all = structuredClone(chunks.filter(c => /^11360-(?:\d{4}-)?\d{2}$/.test(c.id)));
  for (const c of all) if (c.id.startsWith("11360-2027-")) c.id = c.id.replace("2027", "2028");
  assert.throws(() => structureCalendar(all), /학사일정/);
});
