/*
 * Vercel 서버 함수: 게임 안 지도 신고 "실제와 달라요" (POST /api/map-report, 로그인 필수)
 * - 로그인한 학생(@hufs.ac.kr)만. api/_lib/progressServer.js authenticateStudent 재사용(401 · 403 · 1분 60회 429).
 * - 입력 검사 shared/mapReport.js → submit_map_report(supabase/010_map_reports.sql)가 하루 한도(계정 5 · env 전체 300) 확인과 저장을 한 번에.
 * - 팀이 Table Editor에서 status를 accepted로 바꾸면 DB 트리거가 경험치 20 + 알림(api/reward-notices.js가 게임에 전달).
 * - 응답: 200 { result: "received" } · 400 { error: "invalid_report", problems } · 429 { error: "report_limited", reason, limit }.
 *   user_id · 다른 사람 신고는 넣지 않습니다.
 * - 로그: api · result · ms만. 신고 내용 · 이메일 · user_id는 남기지 않습니다.
 * env는 api/event-report.js와 같게 VERCEL_ENV === "production"이면 production, 나머지는 preview.
 */
import { BUILDING_INFO } from "../src/data/buildingInfo.js";
import { validateMapReport } from "../shared/mapReport.js";
import { authenticateStudent, logServerError, readJsonBody } from "./_lib/progressServer.js";
import { reportEnv } from "./event-report.js";

export const MAP_REPORT_DAILY_LIMIT = 5; // 계정당 한국 날짜 하루 신고 수
export const MAP_REPORT_GLOBAL_DAILY_LIMIT = 300; // env 전체 한국 날짜 하루 신고 수
const BUILDING_IDS = Object.keys(BUILDING_INFO);

function logReport(result, startedAt) {
  console.log(JSON.stringify({ api: "map-report", result, ms: Date.now() - startedAt }));
}

export function createMapReportHandler(deps = {}) {
  return async function handler(req, res) {
    const startedAt = Date.now();
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "POST only" });
    }

    const auth = await authenticateStudent(req, res, deps);
    if (!auth) return;

    const body = await readJsonBody(req);
    if (body === null) return res.status(400).json({ error: "invalid_json" });

    const checked = validateMapReport(body, { buildingIds: BUILDING_IDS });
    if (!checked.ok) {
      logReport("invalid", startedAt);
      return res.status(400).json({ error: "invalid_report", problems: checked.problems });
    }
    const report = checked.value;

    try {
      const { data, error } = await auth.supabase.rpc("submit_map_report", {
        p_user_id: auth.userId,
        p_env: reportEnv(deps.vercelEnv ?? process.env.VERCEL_ENV),
        p_building_id: report.buildingId,
        p_kind: report.kind,
        p_description: report.description,
        p_source_url: report.url,
        p_user_limit: MAP_REPORT_DAILY_LIMIT,
        p_global_limit: MAP_REPORT_GLOBAL_DAILY_LIMIT,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.result === "limited") {
        logReport("limited", startedAt);
        return res.status(429).json({ error: "report_limited", reason: row.reason === "global" ? "global" : "day", limit: MAP_REPORT_DAILY_LIMIT });
      }
      if (row?.result !== "ok") throw { code: "bad_rpc_result" };
      logReport("received", startedAt);
      return res.status(200).json({ result: "received" });
    } catch (error) {
      logServerError("map-report", error);
      return res.status(500).json({ error: "report_save_failed" });
    }
  };
}

export default createMapReportHandler();
