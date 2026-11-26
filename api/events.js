/*
 * Vercel 서버 함수: 학교 행사 (GET /api/events)
 * shared/events.js(팀이 원문을 보고 직접 입력한 데이터)와, 학생 제보 묶음(supabase/008_event_reports.sql event_clusters 중
 * 같은 env의 published · confirmed)을 합쳐 서버 시간 기준으로 골라 돌려줍니다.
 * 게시판 · SNS를 수집하지 않습니다. 확인한 사람(checked.by) · 주최 측 허락 기록 · 제보자 정보는 응답에 넣지 않습니다.
 * [예시] 행사는 화면에서 ?demoEvents=1일 때만 만들며, 이 응답에는 절대 섞지 않습니다.
 * Supabase를 못 읽으면(설정 없음 · 오류 · 3초 초과) 팀 입력 행사만 돌려줍니다(행사 창이 죽지 않게).
 *
 * 응답: { serverTime, items: [{ id, title, host, summary, startsAt, endsAt, place, buildingId?, target?, signup?,
 *        category, sourceType, url?, note?, checkedOn, status, reporters?, confirmed? }] }
 *   학생 제보 항목: id "crowd-<묶음 id>", sourceType "crowd", reporters(서로 다른 제보자 수), confirmed(팀 확인 여부),
 *   title · host · summary · place는 첫 제보 원문을 ko · en에 똑같이 넣습니다(번역 · 요약 안 함). checkedOn은 null.
 */
import { EVENTS } from "../shared/events.js";
import { EVENT_CATEGORIES, upcomingEvents } from "../shared/eventCalc.js";
import { contactProblem } from "../shared/eventReport.js";
import { getServiceSupabase, logServerError } from "./_lib/progressServer.js";
import { reportEnv } from "./event-report.js";

const CROWD_TIMEOUT_MS = 3000;
const CROWD_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const kstIso = (value) => {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? `${new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 19)}+09:00` : null;
};
const same = (text) => ({ ko: text, en: text });
const isText = (v) => typeof v === "string" && v.trim() !== "";

// DB 묶음 한 줄 → 행사 항목. 형식이 이상하거나 연락처 · 카카오가 들어 있으면(팀이 표를 직접 고친 경우 포함) null.
export function crowdItem(row) {
  if (!row || !Number.isInteger(Number(row.id))) return null;
  if (row.status !== "published" && row.status !== "confirmed") return null;
  const startsAt = kstIso(row.starts_at);
  const endsAt = kstIso(row.ends_at);
  if (!startsAt || !endsAt || !isText(row.title) || !isText(row.summary) || !isText(row.place) || !EVENT_CATEGORIES.includes(row.category)) return null;
  const host = isText(row.host) ? row.host : "";
  const url = typeof row.source_url === "string" && row.source_url.startsWith("https://") ? row.source_url : null;
  if ([row.title, host, row.summary, row.place, url ?? ""].some((t) => contactProblem(t))) return null;
  return {
    id: `crowd-${Number(row.id)}`,
    title: same(row.title),
    host: same(host),
    summary: same(row.summary),
    startsAt,
    endsAt,
    place: same(row.place),
    ...(isText(row.building_id) ? { buildingId: row.building_id } : {}),
    category: row.category,
    sourceType: "crowd",
    ...(url ? { url } : {}),
    reporters: Math.max(0, Number(row.reporter_count) || 0),
    confirmed: row.status === "confirmed",
  };
}

// 같은 env의 공개 묶음. 실패하면 [](로그에는 오류 종류만).
export async function loadCrowdEvents({ supabase, env, nowMs, timeoutMs = CROWD_TIMEOUT_MS }) {
  if (!supabase) return [];
  let timer;
  try {
    const query = supabase
      .from("event_clusters")
      .select("id, status, title, host, summary, starts_at, ends_at, place, building_id, category, source_url, reporter_count")
      .eq("env", env)
      .in("status", ["published", "confirmed"])
      .gte("ends_at", new Date(nowMs).toISOString())
      .lte("starts_at", new Date(nowMs + 15 * DAY_MS).toISOString())
      .order("starts_at", { ascending: true })
      .limit(CROWD_LIMIT);
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject({ code: "crowd_timeout" }), timeoutMs);
    });
    const { data, error } = await Promise.race([query, timeout]);
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map(crowdItem).filter(Boolean);
  } catch (error) {
    logServerError("events-crowd", error);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function eventsResponse(events, nowMs, crowd = []) {
  return { serverTime: new Date(nowMs).toISOString(), items: upcomingEvents([...events, ...crowd], nowMs) };
}

export function createEventsHandler(deps = {}) {
  return async function handler(req, res) {
    if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
    res.setHeader("Cache-Control", "no-store");
    const nowMs = deps.now ? deps.now() : Date.now();
    const supabase = "supabase" in deps ? deps.supabase : getServiceSupabase();
    const env = reportEnv(deps.vercelEnv ?? process.env.VERCEL_ENV);
    const crowd = await loadCrowdEvents({ supabase, env, nowMs, timeoutMs: deps.crowdTimeoutMs ?? CROWD_TIMEOUT_MS });
    return res.status(200).json(eventsResponse(deps.events ?? EVENTS, nowMs, crowd));
  };
}

export default createEventsHandler();
