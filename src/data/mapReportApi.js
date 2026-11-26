/*
 * 게임 안 지도 신고("실제와 달라요") — 서버 호출 · 응답 문구. 화면은 src/ui/mapReportOverlay.js, 서버는 api/map-report.js.
 * 로그인 분기는 행사 제보와 같습니다(src/data/eventReportApi.js reportMode · currentReportMode):
 * 진짜 로그인(AUTH_MODE real) + 토큰이면 폼, 게스트 · 가짜 로그인이면 "로그인하고 제보하기".
 * 개인정보: 신고 내용 · 토큰을 콘솔 · 저장소에 남기지 않습니다.
 */
import { getAccessToken } from "./auth.js";

const ENDPOINT = "/api/map-report";
const TIMEOUT_MS = 10_000;

// 검사 코드(shared/mapReport.js) → 칸 옆 문구 키(행사 제보 폼과 같은 문구를 씁니다)
const PROBLEM_KEY = {
  required: "eventFormErrRequired",
  type: "eventFormErrRequired",
  too_long: "eventFormErrTooLong",
  phone: "mapFormErrContact",
  email: "eventFormErrContact",
  kakao: "eventFormErrContact",
  https_only: "eventFormErrHttps",
  format: "eventFormErrFormat",
  unknown: "eventFormErrFormat",
};
export const mapProblemMessageKey = (code) => PROBLEM_KEY[code] ?? "eventFormErrFormat";

/*
 * 서버 응답 → 화면 문구. { key, ok, problems? }
 *   200 접수 "신고가 접수됐어요. 팀이 확인할게요." · 400 칸별 오류 · 429 "신고는 하루 5건까지 …" · 401/403 로그인 안내 · 그 밖 다시 시도
 */
export function mapReportResultMessage(status, body) {
  if (status === 200 && body?.result === "received") return { key: "mapReportReceived", ok: true };
  if (status === 400 && Array.isArray(body?.problems)) return { key: "eventReportFix", ok: false, problems: body.problems };
  if (status === 429) return { key: "mapReportLimit", ok: false };
  if (status === 401 || status === 403) return { key: "mapReportLogin", ok: false };
  return { key: "eventReportRetry", ok: false };
}

// 폼 값 → 보낼 신고(빈 근거 주소는 뺌)
export function buildMapReportPayload(form) {
  const text = (v) => (typeof v === "string" ? v.trim() : "");
  const payload = { buildingId: form.buildingId, kind: form.kind, description: text(form.description) };
  if (text(form.url)) payload.url = text(form.url);
  return payload;
}

// 신고를 보냅니다. → { status, body }. 토큰이 없으면 { status: 401 }, 네트워크 오류 · 시간 초과면 { status: 0 }.
export async function sendMapReport(payload, { fetchImpl = fetch, token } = {}) {
  const accessToken = token === undefined ? await getAccessToken().catch(() => null) : token;
  if (!accessToken) return { status: 401, body: null };
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const type = response.headers?.get?.("content-type") || "";
    const body = type.includes("json") ? await response.json().catch(() => null) : null;
    return { status: response.status, body };
  } catch {
    return { status: 0, body: null };
  }
}
