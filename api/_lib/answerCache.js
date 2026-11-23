import { createHash } from "node:crypto";
import { hasTimeSensitiveWords } from "../../shared/academicDate.js";

export const CACHE_TTL_SECONDS = 86_400; // 24시간
const CACHE_TIMEOUT_MS = 2500;

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

// 앞뒤 공백 제거, 연속 공백·줄바꿈 단일 공백 치환, 문장 끝 물음표·마침표 제거, 영문 소문자 변환
export function normalizeQuestion(question) {
  return String(question ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\s?.？。]+$/g, "")
    .toLowerCase();
}

// 응답 언어(ko/en)와 정규화 질문으로 캐시 키(SHA-256)를 만듭니다.
// 데이터 버전 비교는 DB 함수(get_answer_cache · set_answer_cache) 내부에서 처리합니다.
export function buildCacheKey(question, lang = "ko") {
  const safeLang = lang === "en" ? "en" : "ko";
  const deploymentEnv = process.env.VERCEL_ENV || "local";
  const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA || "local";

  return sha256(
    `${deploymentEnv}:${deploymentSha}:${safeLang}:${normalizeQuestion(question)}`
  );
}

// eval 요청이 아니고 날짜·시점 의존 표현이 없을 때만 캐시를 조회·저장합니다.
export function canUseAnswerCache({ evalMode = false, question = "" } = {}) {
  if (evalMode) return false;
  if (hasTimeSensitiveWords(question)) return false;
  return true;
}

// 검증을 통과한 정상 AI 답변(mode "ai", 잘림 없음)만 캐시에 저장합니다.
export function shouldCacheAnswer({ mode, truncated } = {}) {
  return mode === "ai" && truncated === false;
}

export async function getAnswerCache(cacheKey, { env = process.env, fetchImpl = fetch } = {}) {
  if (!cacheKey || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return null;
  try {
    const response = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/get_answer_cache`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_KEY },
      body: JSON.stringify({ p_cache_key: cacheKey }),
      signal: AbortSignal.timeout(CACHE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`get_answer_cache ${response.status}`);
    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row.answer !== "string" || !row.answer.trim()) return null;
    return {
      answer: row.answer,
      sources: Array.isArray(row.sources) ? row.sources : [],
    };
  } catch (err) {
    const message = String(err?.message || "");
    console.error("answer cache get failed:", err?.name === "TimeoutError" ? "timeout" : message.startsWith("get_answer_cache") ? message : "network");
    return null;
  }
}

export async function setAnswerCache(
  { cacheKey, lang, answer, sources, ttlSeconds = CACHE_TTL_SECONDS },
  { env = process.env, fetchImpl = fetch } = {},
) {
  if (!cacheKey || !answer || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return false;
  try {
    const response = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/set_answer_cache`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_KEY },
      body: JSON.stringify({
        p_cache_key: cacheKey,
        p_lang: lang === "en" ? "en" : "ko",
        p_answer: answer,
        p_sources: Array.isArray(sources) ? sources : [],
        p_ttl_seconds: ttlSeconds,
      }),
      signal: AbortSignal.timeout(CACHE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`set_answer_cache ${response.status}`);
    return true;
  } catch (err) {
    const message = String(err?.message || "");
    console.error("answer cache set failed:", err?.name === "TimeoutError" ? "timeout" : message.startsWith("set_answer_cache") ? message : "network");
    return false;
  }
}
