/*
 * 진행 저장 API(api/progress.js, quiz-answer.js, quest-complete.js, check-in.js) 공통 서버 모듈
 * - Authorization: Bearer <Supabase JWT> 토큰 검증 → @hufs.ac.kr 도메인 확인(아니면 403)
 * - 쓰기는 Supabase security definer RPC 함수(service_role 전용)로 원자적 처리
 * - 개인정보: 이메일·토큰·user_id를 로그나 오류 메시지에 남기지 않습니다.
 */
import { createClient } from "@supabase/supabase-js";
import { DAILY_QUIZ_GOAL, QUIZ_DAILY_CAP, dailyQuestKey, isDailyQuestRecord, kstToday, levelFromTotalExp } from "../../shared/progressRules.js";
import { STAMP_RALLY_IDS } from "../../shared/stampRally.js";

const ALLOWED_DOMAIN = "@hufs.ac.kr";
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 60;
const rateBuckets = new Map();

let cachedAdminClient = null;
let cachedEnvKey = "";

export function getServiceSupabase(env = process.env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) return null;
  const key = `${url}::${serviceKey}`;
  if (!cachedAdminClient || cachedEnvKey !== key) {
    cachedAdminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cachedEnvKey = key;
  }
  return cachedAdminClient;
}

// 서버 오류를 Vercel 로그에 남깁니다(매일 5분 점검용). 개인정보 규칙에 따라 이메일 · 토큰 · user_id · 오류 메시지 본문은 남기지 않고
// 어느 API에서 어떤 종류의 오류가 났는지(Postgres/PostgREST 오류 코드, HTTP 상태)만 남깁니다.
export function logServerError(api, error) {
  console.error(
    JSON.stringify({
      mode: "error",
      api,
      code: typeof error?.code === "string" ? error.code : null,
      status: Number.isInteger(error?.status) ? error.status : null,
      name: typeof error?.name === "string" ? error.name : null,
    }),
  );
}

export function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store");
}

function checkRateLimit(key, nowMs = Date.now()) {
  const hits = (rateBuckets.get(key) || []).filter((t) => nowMs - t < RATE_WINDOW_MS);
  hits.push(nowMs);
  if (rateBuckets.size > 5000 && !rateBuckets.has(key)) rateBuckets.clear();
  rateBuckets.set(key, hits);
  if (hits.length <= RATE_MAX_REQUESTS) return 0;
  return Math.max(1, Math.ceil((hits[hits.length - 1 - RATE_MAX_REQUESTS] + RATE_WINDOW_MS - nowMs) / 1000));
}

export function resetProgressRateLimit() {
  rateBuckets.clear();
}

function extractBearerToken(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

export async function readJsonBody(req) {
  if (req?.body && typeof req.body === "object") return req.body;
  if (typeof req?.body === "string") {
    try {
      return req.body.trim() ? JSON.parse(req.body) : {};
    } catch {
      return null;
    }
  }
  if (!req || typeof req[Symbol.asyncIterator] !== "function") return {};
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/*
 * 요청 토큰 검증 후 { supabase, userId, email } 반환.
 * 실패 시 응답(401 / 403 / 429 / 500)을 보내고 null 반환.
 */
export async function authenticateStudent(req, res, { supabase = getServiceSupabase(), now = () => new Date() } = {}) {
  setNoStore(res);
  if (!supabase) {
    logServerError("auth", { code: "server_not_configured" });
    res.status(500).json({ error: "server_not_configured" });
    return null;
  }

  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      res.status(401).json({ error: "unauthorized" });
      return null;
    }
    user = data.user;
  } catch {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  const email = String(user.email ?? "").trim().toLowerCase();
  if (!email.endsWith(ALLOWED_DOMAIN)) {
    res.status(403).json({ error: "forbidden" });
    return null;
  }

  const retryAfter = checkRateLimit(user.id, now().getTime());
  if (retryAfter > 0) {
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({ error: "rate_limited", retryAfter });
    return null;
  }

  return { supabase, userId: user.id, email };
}

export async function ensureProfile(supabase, userId, email) {
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, email }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function getCurrentTotalExp(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("total_exp")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.total_exp ?? 0);
}

export async function buildProgress(supabase, userId, email, now = new Date()) {
  await ensureProfile(supabase, userId, email);

  const today = kstToday(now);
  const kstStart = `${today}T00:00:00+09:00`;
  const kstEnd = `${today}T23:59:59.999+09:00`;

  const [profileRes, quizRes, questRes, rewardRes] = await Promise.all([
    supabase.from("profiles").select("total_exp, points").eq("user_id", userId).single(),
    supabase
      .from("quiz_log")
      .select("question_id, rewarded")
      .eq("user_id", userId)
      .order("answered_at", { ascending: true }),
    supabase
      .from("quest_log")
      .select("quest_id")
      .eq("user_id", userId)
      .order("completed_at", { ascending: true }),
    supabase
      .from("reward_log")
      .select("source, ref_id, exp")
      .eq("user_id", userId)
      .in("source", ["quiz", "stamp"])
      .gte("created_at", kstStart)
      .lte("created_at", kstEnd),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (quizRes.error) throw quizRes.error;
  if (questRes.error) throw questRes.error;
  if (rewardRes.error) throw rewardRes.error;

  const totalExp = Number(profileRes.data?.total_exp ?? 0);
  const points = Number(profileRes.data?.points ?? 0);
  const { level, exp, expMax } = levelFromTotalExp(totalExp);

  const quizRows = quizRes.data ?? [];
  const answered = quizRows.map((row) => row.question_id);
  const rewarded = quizRows.filter((row) => row.rewarded).map((row) => row.question_id);
  const todayRows = rewardRes.data ?? [];
  const todayQuizRows = todayRows.filter((row) => row.source === "quiz");
  const todayExp = todayQuizRows.reduce((sum, row) => sum + Number(row.exp ?? 0), 0);
  // 일일 퀴즈 "맞춘 정답 n/DAILY_QUIZ_GOAL"(11/27부터 5)의 n = 오늘(한국 날짜) 퀴즈로 경험치를 받은 개수
  const quizCorrect = todayQuizRows.filter((row) => Number(row.exp ?? 0) > 0).length;
  // 오늘 받은 스탬프(ref_id "YYYY-MM-DD:<buildingId>"), 표시 순서대로
  const stamped = new Set(
    todayRows
      .filter((row) => row.source === "stamp" && String(row.ref_id).startsWith(`${today}:`))
      .map((row) => String(row.ref_id).slice(today.length + 1)),
  );
  const stamps = STAMP_RALLY_IDS.filter((id) => stamped.has(id));
  // 일일 퀘스트 완료 기록("stampRally:날짜" · "dailyQuiz:날짜", 11/24 이전의 날짜 없는 "stampRally" 포함)은
  // completedQuests에 싣지 않고 daily로만 알립니다(옛 영구 기록이 새 일일 퀘스트를 "완료"로 보이게 하지 않도록).
  const questIds = (questRes.data ?? []).map((row) => row.quest_id);
  const completedQuests = questIds.filter((id) => !isDailyQuestRecord(id));

  return {
    level,
    exp,
    expMax,
    points,
    completedQuests,
    quiz: {
      rewarded,
      answered,
      todayExp,
      dailyCap: QUIZ_DAILY_CAP,
    },
    daily: {
      date: today,
      quizCorrect,
      quizGoal: DAILY_QUIZ_GOAL,
      quizBonusDone: questIds.includes(dailyQuestKey("dailyQuiz", today)),
      stamps,
      rallyDone: questIds.includes(dailyQuestKey("stampRally", today)),
    },
  };
}