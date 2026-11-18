/*
 * 검색창(api/ask.js) 사용량 제한. AI를 부르기 전에 한 번 부릅니다.
 *
 * 1차: 메모리 제한 — 이 서버 인스턴스 안에서만 IP 해시당 1분 10회. Supabase를 부르기 전에 연타를 끊어 DB 호출도 아낍니다.
 * 2차: 공용 카운터 — Supabase 함수 ask_hit(supabase/003_usage_limits.sql)로 모든 인스턴스가 같은 수를 셉니다.
 *      IP 해시당 1분 · 하루, 서비스 전체 하루 한도를 한 번에 확인하고, 통과할 때만 +1 합니다.
 * Supabase 호출이 실패하거나 설정이 없으면: 1차 메모리 제한만으로 판단합니다(2026-11-19 결정).
 *
 * eval 토큰: 요청 헤더 x-ask-eval-token이 서버 환경 변수 ASK_EVAL_TOKEN과 같으면 IP 1분 · 하루 한도를 건너뛰고
 *            전체 하루 한도에는 셉니다. eval 요청은 IP와 상관없이 하루 하나의 "eval" 칸에 따로 셉니다.
 *
 * 개인정보: 원본 IP는 저장하거나 로그에 남기지 않습니다. 해시 = SHA-256(ASK_IP_SALT + 한국 날짜 + IP)라서
 *          날짜가 바뀌면 같은 IP도 다른 해시가 되어 여러 날에 걸쳐 같은 사람을 이어 볼 수 없습니다. 해시도 로그에 남기지 않습니다.
 *
 * 환경 변수(Vercel에만, 브라우저 코드 · VITE_ 변수에 넣지 않음)
 * - ASK_IP_SALT: IP 해시용 비밀 소금
 * - SUPABASE_URL, SUPABASE_SERVICE_KEY: ask_hit 호출용(서버 비밀 키)
 * - ASK_EVAL_TOKEN: scripts/eval.mjs 전용 토큰(없으면 eval 우회 없음)
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { kstToday } from "../../shared/progressRules.js";

// 검색창 한도. 바꾸려면 이 한 곳만 고칩니다.
export const ASK_LIMITS = Object.freeze({
  minute: 10, // IP당 1분
  day: 50, // IP당 한국 날짜 하루
  globalDay: 500, // 서비스 전체 한국 날짜 하루
});

// eval 요청의 IP 한도 대신 넘기는 값(사실상 제한 없음). 전체 하루 한도는 그대로 ASK_LIMITS.globalDay.
const NO_IP_LIMIT = 2_147_483_647;
const MEMORY_WINDOW_MS = 60_000;
const MEMORY_MAX_KEYS = 5000;
const DB_TIMEOUT_MS = 3000;
export const EVAL_TOKEN_HEADER = "x-ask-eval-token";

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

// Vercel은 x-forwarded-for를 덮어써서 외부에서 넣은 IP를 넘기지 않습니다(IP 위조 방지). 첫 번째 값을 씁니다.
export function clientIp(req) {
  const header = req?.headers?.["x-forwarded-for"];
  const first = String(Array.isArray(header) ? header[0] : header || "").split(",")[0].trim();
  return first || "unknown";
}

export const ipHash = (ip, salt, day) => sha256(`${salt}${day}${ip}`);

// 토큰이 맞는지 시간 차이가 나지 않게 비교합니다. 둘 다 해시로 바꿔 길이를 맞춥니다.
export function isEvalRequest(req, token) {
  const sent = req?.headers?.[EVAL_TOKEN_HEADER];
  if (!token || typeof sent !== "string" || !sent) return false;
  return timingSafeEqual(Buffer.from(sha256(sent), "hex"), Buffer.from(sha256(token), "hex"));
}

// ── 1차: 메모리 제한 (인스턴스별) ──
const memoryHits = new Map();

// 이번 요청을 기록하고, 1분 안에 한도를 넘었으면 다시 시도까지 남은 초를, 아니면 0을 돌려줍니다.
function memoryHit(key, nowMs) {
  const recent = (memoryHits.get(key) || []).filter((t) => nowMs - t < MEMORY_WINDOW_MS);
  recent.push(nowMs);
  if (memoryHits.size >= MEMORY_MAX_KEYS && !memoryHits.has(key)) memoryHits.clear();
  memoryHits.set(key, recent);
  if (recent.length <= ASK_LIMITS.minute) return 0;
  return Math.max(1, Math.ceil((recent[recent.length - 1 - ASK_LIMITS.minute] + MEMORY_WINDOW_MS - nowMs) / 1000));
}

export function resetMemoryLimit() {
  memoryHits.clear();
}

// ── 2차: Supabase 공용 카운터 ──
async function askHit(hash, limits, env, fetchImpl) {
  const response = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/ask_hit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_KEY },
    body: JSON.stringify({
      p_ip_hash: hash,
      p_minute_limit: limits.minute,
      p_day_limit: limits.day,
      p_global_day_limit: limits.globalDay,
    }),
    signal: AbortSignal.timeout(DB_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`ask_hit ${response.status}`);
  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row || typeof row.allowed !== "boolean") throw new Error("ask_hit bad response");
  return { allowed: row.allowed, reason: row.reason ?? null, retryAfter: Number(row.retry_after) || 0 };
}

/*
 * 이번 질문을 받아도 되는지 판단합니다.
 * → { allowed, reason: null | "minute" | "day" | "global", retryAfter(초), source: "db" | "memory", eval }
 *   source가 "memory"면 공용 카운터 없이 메모리 제한만으로 판단한 것입니다(설정 없음 · 호출 실패 · 1차에서 끊음).
 */
export async function checkAskLimit(req, { env = process.env, fetchImpl = fetch, now = new Date() } = {}) {
  const evalMode = isEvalRequest(req, env.ASK_EVAL_TOKEN);
  const salt = env.ASK_IP_SALT || "";
  const subject = evalMode ? "eval" : clientIp(req);
  const hash = ipHash(subject, salt, kstToday(now));
  const memoryDecision = () => {
    const wait = memoryHit(hash, now.getTime());
    return wait
      ? { allowed: false, reason: "minute", retryAfter: wait, source: "memory", eval: evalMode }
      : { allowed: true, reason: null, retryAfter: 0, source: "memory", eval: evalMode };
  };

  // eval이 아니면 1차 메모리 제한부터. 여기서 끊기면 Supabase를 부르지 않습니다.
  if (!evalMode) {
    const first = memoryDecision();
    if (!first.allowed) return first;
  }

  const ready = Boolean(env.ASK_IP_SALT && env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY);
  if (ready) {
    const limits = evalMode
      ? { minute: NO_IP_LIMIT, day: NO_IP_LIMIT, globalDay: ASK_LIMITS.globalDay }
      : ASK_LIMITS;
    try {
      const result = await askHit(hash, limits, env, fetchImpl);
      return { ...result, source: "db", eval: evalMode };
    } catch (err) {
      // 원인 메시지에는 주소 등이 섞일 수 있어 상태만 남깁니다. 해시 · IP는 남기지 않습니다.
      const message = String(err?.message || "");
      console.error("usage limit unavailable:", err?.name === "TimeoutError" ? "timeout" : message.startsWith("ask_hit") ? message : "network");
    }
  }
  // 공용 카운터를 쓸 수 없으면 메모리 제한만으로 판단합니다. eval이 아니면 위에서 이미 셌으므로 통과입니다.
  return evalMode ? memoryDecision() : { allowed: true, reason: null, retryAfter: 0, source: "memory", eval: false };
}
