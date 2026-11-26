/*
 * 앱 안 행사 제보(2단계 화면) — 로그인 분기 · 시각 문자열 · 서버 호출 · 응답 문구.
 * 화면(src/ui/eventOverlay.js)은 이 파일로만 제보를 보냅니다. 서버는 api/event-report.js(1단계).
 * 순수 함수(reportMode · kstDateOf · kstTimestamp · buildReportPayload · reportResultMessage · problemMessageKey)는
 * 브라우저 없이 tests/eventReportUi.test.js가 확인합니다.
 *
 * 개인정보: 제보 내용 · 토큰을 콘솔 · 저장소에 남기지 않습니다. 토큰은 요청 헤더에만 붙입니다.
 */
import { kstParts } from "../../shared/deadlineCalc.js";
import { AUTH_MODE, getAccessToken } from "./auth.js";

const ENDPOINT = "/api/event-report";
const TIMEOUT_MS = 20_000; // 서버의 AI 판단(최대 10초) + DB
export const DEFAULT_THRESHOLD = 5;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const pad = (n) => String(n).padStart(2, "0");

// 마지막으로 서버가 알려 준 공개 기준 인원(모르면 5). 폼 위 안내 문구의 N에 씁니다.
let knownThreshold = DEFAULT_THRESHOLD;
export const reportThreshold = () => knownThreshold;

/*
 * 행사창 "행사 제보하기"를 어떻게 보여 줄지.
 *   "app"  : 진짜 로그인(AUTH_MODE real) + 로그인 토큰 있음 → 행사창 안 제보 폼
 *   "link" : 로그인 안 함 · 가짜(mock) 로그인 → "로그인하면 앱에서 바로 제보할 수 있어요" + 구글 폼 링크
 */
export const reportMode = ({ authMode, token }) => (authMode === "real" && typeof token === "string" && token ? "app" : "link");

export async function currentReportMode() {
  if (AUTH_MODE !== "real") return "link";
  const token = await getAccessToken().catch(() => null);
  return reportMode({ authMode: AUTH_MODE, token });
}

// 한국 날짜 "YYYY-MM-DD"(브라우저 시간대와 무관). 폼의 날짜 기본값에 씁니다.
export function kstDateOf(nowMs) {
  const { y, m, d } = kstParts(nowMs);
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

// 날짜("YYYY-MM-DD") + 시각("HH:MM") → "YYYY-MM-DDTHH:MM:00+09:00". 형식이 틀리거나 없는 날짜(2/30 등)면 "".
// 브라우저 시간대를 쓰지 않고 입력한 글자를 그대로 한국 시간으로 붙입니다.
export function kstTimestamp(date, time) {
  if (typeof date !== "string" || typeof time !== "string" || !DATE.test(date) || !TIME.test(time)) return "";
  const [y, m, d] = date.split("-").map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return "";
  return `${date}T${time}:00+09:00`;
}

// 폼 값 → 서버로 보낼 제보. 빈 선택 칸은 빼고, 시각은 kstTimestamp로 만듭니다(검사는 shared/eventReport.js validateEventReport).
export function buildReportPayload(form) {
  const text = (v) => (typeof v === "string" ? v.trim() : "");
  const payload = {
    title: text(form.title),
    place: text(form.place),
    summary: text(form.summary),
    category: form.category,
    startsAt: kstTimestamp(form.date, form.startTime),
    endsAt: kstTimestamp(form.endDate || form.date, form.endTime),
  };
  if (text(form.host)) payload.host = text(form.host);
  if (text(form.buildingId)) payload.buildingId = text(form.buildingId);
  if (text(form.url)) payload.url = text(form.url);
  return payload;
}

// 검사 코드(shared/eventReport.js) → 칸 옆에 보여 줄 문구 키(src/state.js)
const PROBLEM_KEY = {
  required: "eventFormErrRequired",
  type: "eventFormErrRequired",
  too_long: "eventFormErrTooLong",
  phone: "eventFormErrContact",
  email: "eventFormErrContact",
  kakao: "eventFormErrContact",
  format: "eventFormErrFormat",
  https_only: "eventFormErrHttps",
  unknown: "eventFormErrFormat",
};
export function problemMessageKey(field, code) {
  if (code === "range") return field === "endsAt" ? "eventFormErrEndRange" : "eventFormErrStartRange";
  return PROBLEM_KEY[code] ?? "eventFormErrFormat";
}

/*
 * 서버 응답(HTTP 상태 + 본문) → 화면 문구. 돌려주는 값: { key, vars, ok, published, problems? }
 *   ok: 접수 성공(폼을 비움) · published: 행사 목록 새로고침 필요 · problems: 400 입력 거절의 칸별 코드
 */
export function reportResultMessage(status, body) {
  const threshold = Number.isInteger(body?.threshold) && body.threshold >= 2 ? body.threshold : knownThreshold;
  if (status === 200) {
    const reporters = Math.max(0, Number(body?.reporters) || 0);
    switch (body?.result) {
      case "published":
        return { key: "eventReportPublished", vars: {}, ok: true, published: true };
      case "duplicate":
        return { key: "eventReportDuplicate", vars: {}, ok: false, published: false };
      case "new":
        return { key: "eventReportCount", vars: { count: Math.max(1, reporters), threshold }, ok: true, published: false };
      case "joined":
        return reporters >= 1
          ? { key: "eventReportCount", vars: { count: reporters, threshold }, ok: true, published: false }
          : { key: "eventReportReceived", vars: {}, ok: true, published: false };
      default:
        return { key: "eventReportRetry", vars: {}, ok: false, published: false };
    }
  }
  if (status === 400 && Array.isArray(body?.problems)) return { key: "eventReportFix", vars: {}, ok: false, published: false, problems: body.problems };
  if (status === 429) return { key: "eventReportLimit", vars: {}, ok: false, published: false };
  if (status === 401 || status === 403) return { key: "eventReportLogin", vars: {}, ok: false, published: false };
  return { key: "eventReportRetry", vars: {}, ok: false, published: false };
}

// 제보를 보냅니다. → { status, body }. 로그인 토큰이 없으면 { status: 401 }. 네트워크 오류 · 시간 초과면 { status: 0 }.
export async function sendEventReport(payload, { fetchImpl = fetch, token } = {}) {
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
    if (Number.isInteger(body?.threshold) && body.threshold >= 2) knownThreshold = body.threshold;
    return { status: response.status, body };
  } catch {
    return { status: 0, body: null };
  }
}
