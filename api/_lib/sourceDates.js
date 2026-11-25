// 검색된 조각의 수집일을 추가 조회합니다.
// 검색 결과, 답변 생성 규칙, 출처 선정에는 영향을 주지 않습니다.

const DATE_TIMEOUT_MS = 2500;

// 수집 시각을 한국 시간 기준 YYYY-MM-DD로 변환합니다.
export function toKoreanDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

// 검색에 사용된 조각의 ID와 수집일만 읽습니다.
// 키워드 검색용 KB 조각은 DB 조회 대상에서 제외합니다.
export async function fetchCollectedDates(
  docs,
  rpc,
  { env = process.env, fetchImpl = fetch } = {},
) {
  const dates = new Map();

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return dates;
  }

  const ids = [...new Set(
    docs
      .map((d) => d.id)
      .filter((id) =>
        id != null &&
        /^[a-zA-Z0-9_-]+$/.test(String(id))
      )
      .map(String)
  )];

  if (!ids.length) return dates;

  const table = rpc === "match_chunks_next"
    ? "chunks_next"
    : "chunks";

  try {
    const url = new URL(
      `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}`
    );

    url.searchParams.set("select", "id,collected_at");
    url.searchParams.set("id", `in.(${ids.join(",")})`);

    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
      },
      signal: AbortSignal.timeout(DATE_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error("source date lookup failed");
    }

    const rows = await response.json();

    if (!Array.isArray(rows)) return dates;

    for (const row of rows) {
      const date = toKoreanDate(row.collected_at);
      if (date) dates.set(String(row.id), date);
    }

    return dates;
  } catch {
    // 수집일 조회에 실패해도 기존 답변은 정상 반환합니다.
    console.warn("source date lookup failed");
    return dates;
  }
}
