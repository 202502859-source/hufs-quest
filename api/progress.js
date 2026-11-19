/*
 * Vercel 서버 함수: 재학생 진행 상태 조회 (GET /api/progress)
 * - 첫 로그인 사용자면 profiles 행을 기본값(Lv.1, 경험치 0, 포인트 0)으로 생성합니다.
 */
import { authenticateStudent, buildProgress } from "./_lib/progressServer.js";

export function createProgressHandler(deps = {}) {
  return async function handler(req, res) {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "GET only" });
    }

    const auth = await authenticateStudent(req, res, deps);
    if (!auth) return;

    try {
      const now = deps.now ? deps.now() : new Date();
      const progress = await buildProgress(auth.supabase, auth.userId, auth.email, now);
      return res.status(200).json({ progress });
    } catch {
      return res.status(500).json({ error: "progress_load_failed" });
    }
  };
}

export default createProgressHandler();