/*
 * Vercel 서버 함수: 행사 제보 보상 알림 가져가기 (POST /api/reward-notices, 로그인 필수)
 * - 팀이 행사 묶음을 confirmed로 바꾸면 DB 트리거(supabase/009_event_report_rewards.sql)가 경험치를 주고 알림 한 줄을 남깁니다.
 * - 게임이 접속 중이면 주기적으로(src/data/rewardNotices.js), 아니면 다음 접속 때 이 API를 불러 아직 안 본 알림을 가져갑니다.
 *   가져간 알림은 본 것으로 표시되어 다시 오지 않습니다(take_event_reward_notices).
 * - 응답: { count, exp, kinds: { event, map } } — 반영된 건수 · 받은 경험치 합계 · 종류별 건수만(010부터 지도 신고 'map' 포함).
 *   행사 · 신고 id, 제목, user_id는 넣지 않습니다. 010 실행 전 DB는 kind를 주지 않으므로 'event'로 셉니다.
 * - 로그: 알림이 있을 때만 { api, count }. 오류는 logServerError(종류만).
 * POST인 이유: 가져가면 본 것으로 바뀌는 요청이라 캐시되면 안 되기 때문입니다.
 */
import { authenticateStudent, logServerError } from "./_lib/progressServer.js";

export function createRewardNoticesHandler(deps = {}) {
  return async function handler(req, res) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "POST only" });
    }

    const auth = await authenticateStudent(req, res, deps);
    if (!auth) return;

    try {
      const { data, error } = await auth.supabase.rpc("take_event_reward_notices", { p_user_id: auth.userId });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      const exp = rows.reduce((sum, row) => sum + Math.max(0, Number(row?.exp) || 0), 0);
      const count = rows.length;
      const kinds = { event: 0, map: 0 };
      for (const row of rows) kinds[row?.kind === "map" ? "map" : "event"] += 1;
      if (count) console.log(JSON.stringify({ api: "reward-notices", count }));
      return res.status(200).json({ count, exp, kinds });
    } catch (error) {
      logServerError("reward-notices", error);
      return res.status(500).json({ error: "notice_load_failed" });
    }
  };
}

export default createRewardNoticesHandler();
