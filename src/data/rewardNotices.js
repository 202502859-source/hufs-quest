/*
 * 행사 제보 보상 알림 — 팀이 제보한 행사를 확인(confirmed)하면 DB가 경험치를 주고 알림을 남깁니다(supabase/009).
 * 게임은 이 파일로 그 알림을 가져와 HUD(src/scenes/HudScene.js)에 "제보한 행사가 확인되어 경험치가 올랐어요"를 띄웁니다.
 *   - 접속 중: 캠퍼스에 있는 동안 NOTICE_POLL_MS마다(탭이 보일 때만) 확인 → 거의 실시간
 *   - 접속 안 했을 때 확인됨: 다음에 로그인해 캠퍼스에 들어오는 순간 바로 확인
 * 진짜 로그인(AUTH_MODE real)일 때만 서버를 부릅니다. 가짜 로그인 · 게스트는 부르지 않습니다.
 * 화면 확인용: 주소에 ?demoNotice=1을 붙이면 서버 없이 예시 알림을 한 번 띄웁니다(src/scenes/HudScene.js).
 */
import { AUTH_MODE, getAccessToken } from "./auth.js";

const ENDPOINT = "/api/reward-notices";
const TIMEOUT_MS = 8_000;
export const NOTICE_POLL_MS = 15_000;
export const NOTICE_SHOW_MS = 2_000; // 알림이 떠 있는 시간(그 뒤 0.4초 동안 사라짐)

// 종류별 건수({ event, map }). 서버가 kinds를 주지 않으면(010 실행 전) 모두 행사 제보로 봅니다.
const kindsOf = (notice) => {
  const event = Math.max(0, Number(notice?.kinds?.event) || 0);
  const map = Math.max(0, Number(notice?.kinds?.map) || 0);
  return event + map > 0 ? { event, map } : { event: Math.max(0, Number(notice?.count) || 0), map: 0 };
};

// 알림 문구. chip은 "+20 EXP".
//   행사 제보만: "제보한 행사가 확인되어 경험치가 올랐어요" / 여러 건이면 "제보한 행사 N건이 …"
//   지도 신고만: "신고한 지도 정보가 고쳐져서 경험치가 올랐어요" / 여러 건이면 "신고한 지도 정보 N건이 …"
//   둘 다: "제보·신고 N건이 반영되어 경험치가 올랐어요"
export function rewardNoticeText(notice) {
  const n = Math.max(1, Number(notice?.count) || 1);
  const kinds = kindsOf(notice);
  const chip = `+${Math.max(0, Number(notice?.exp) || 0)} EXP`;
  if (kinds.event > 0 && kinds.map > 0) return { key: "rewardNoticeMixed", vars: { count: n }, chip };
  if (kinds.map > 0) return { key: n > 1 ? "mapRewardNoticeMany" : "mapRewardNotice", vars: { count: n }, chip };
  return { key: n > 1 ? "eventRewardNoticeMany" : "eventRewardNotice", vars: { count: n }, chip };
}

// 쌓인 알림을 하나로 합칩니다(HUD가 그리기 전에 여러 번 와도 한 번에). 종류별 건수도 더합니다.
export const mergeNotices = (a, b) => {
  const kb = kindsOf(b);
  if (!a) return { count: b.count, exp: b.exp, kinds: kb };
  const ka = kindsOf(a);
  return { count: a.count + b.count, exp: a.exp + b.exp, kinds: { event: ka.event + kb.event, map: ka.map + kb.map } };
};

// 아직 안 본 알림을 가져갑니다(가져가면 서버에서 본 것으로 바뀜). → { count, exp, kinds } · 토큰 없음 · 실패면 null
export async function takeRewardNotices({ fetchImpl = fetch, token } = {}) {
  const accessToken = token === undefined ? await getAccessToken().catch(() => null) : token;
  if (!accessToken) return null;
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = await response.json();
    const count = Number(body?.count);
    const exp = Number(body?.exp);
    return Number.isInteger(count) && count >= 0 && Number.isFinite(exp) ? { count, exp, kinds: kindsOf({ count, kinds: body?.kinds }) } : null;
  } catch {
    return null;
  }
}

/*
 * 알림 확인 반복기(순수 로직, 타이머 · 화면 상태는 바꿔 끼울 수 있음).
 *   take: 알림 가져오기 함수 · onNotice: 새 알림({ count, exp }, count ≥ 1)을 받을 함수
 *   isVisible: 탭이 보일 때만 확인 · 한 번에 하나만 요청(앞 요청이 끝나기 전엔 건너뜀)
 */
export function createNoticeWatcher({ take, onNotice, intervalMs = NOTICE_POLL_MS, isVisible = () => true, setIntervalFn = setInterval, clearIntervalFn = clearInterval }) {
  let timer = null;
  let busy = false;
  let stopped = false;
  async function check() {
    if (busy || stopped || !isVisible()) return;
    busy = true;
    try {
      const result = await take();
      if (!stopped && result && result.count > 0) onNotice(result);
    } finally {
      busy = false;
    }
  }
  return {
    check,
    start() {
      stopped = false;
      check();
      timer ??= setIntervalFn(check, intervalMs);
    },
    stop() {
      stopped = true;
      if (timer !== null) clearIntervalFn(timer);
      timer = null;
    },
  };
}

// 캠퍼스에 들어온 재학생이면 알림 확인을 시작합니다. 돌려받은 함수를 부르면 멈춥니다(로그아웃 · 장면 종료).
export function startRewardNoticeWatch(onNotice, { authMode = AUTH_MODE } = {}) {
  if (authMode !== "real" || typeof document === "undefined") return () => {};
  const watcher = createNoticeWatcher({
    take: () => takeRewardNotices(),
    onNotice,
    isVisible: () => document.visibilityState !== "hidden",
  });
  // 다른 탭에 있다가 돌아오면 바로 한 번 확인합니다.
  const onVisible = () => document.visibilityState === "visible" && watcher.check();
  document.addEventListener("visibilitychange", onVisible);
  watcher.start();
  return () => {
    watcher.stop();
    document.removeEventListener("visibilitychange", onVisible);
  };
}

export const demoNoticeEnabled = (search = typeof location === "undefined" ? "" : location.search) => demoNoticeKind(search) !== null;
// ?demoNotice=1 → 행사 제보 예시, ?demoNotice=map → 지도 신고 예시, 그 밖 → null
export function demoNoticeKind(search = typeof location === "undefined" ? "" : location.search) {
  const value = new URLSearchParams(search).get("demoNotice");
  return value === "1" ? "event" : value === "map" ? "map" : null;
}
