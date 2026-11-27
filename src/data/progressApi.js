// 재학생 진행 상태(레벨 · 경험치 · 포인트 · 퀘스트 · 퀴즈 기록)를 서버와 주고받는 유일한 통로입니다.
// 화면 코드는 이 파일의 함수 5개만 부릅니다. 요청 · 응답 형식은 docs/PROGRESS_API.md 4장과 같습니다.
// 게스트는 이 파일을 부르지 않습니다.
//
// 모드: VITE_PROGRESS_MODE (비밀 값 아님)
//   "real"      진짜 서버(/api/*)를 부릅니다.
//   없음 · "mock" 가짜 서버(progressMock.js)를 브라우저 메모리에서 돌립니다. 새로고침하면 진행이 초기화됩니다.
// 로그인 방식(VITE_AUTH_MODE, auth.js)과 따로 고릅니다. 예: 진짜 메일 로그인 + 가짜 진행 저장으로 로그인만 먼저 시험.
// 진짜 진행 저장(real)은 진짜 로그인(VITE_AUTH_MODE=real)과 함께 써야 합니다. 가짜 로그인에는 진짜 토큰이 없으므로,
// VITE_AUTH_MODE=mock + VITE_PROGRESS_MODE=real이면 콘솔에 경고하고 진행 저장도 가짜(mock)로 동작합니다.
//
// 가짜 모드에서 주소 끝에 붙여 상황을 재현할 수 있습니다.
//   ?mock=cap      오늘 퀴즈 상한(100)에 이미 도달한 계정
//   ?mock=daily    오늘 스탬프 2곳 + 퀴즈 정답 3개 · ?mock=rally3 스탬프 3곳 · ?mock=quiz9 퀴즈 정답 목표 - 1개(지금 4개)(일일 퀘스트 확인용)
//   ?mock=already  퀴즈 · 퀘스트 · 출석을 모두 이미 받은 계정
//   ?mock=error    퀴즈 · 퀘스트 · 출석 저장이 서버 오류로 실패 (불러오기는 성공)
//   ?mock=slow     모든 응답이 3초 늦게 옴
import { AUTH_MODE, getAccessToken } from "./auth.js";
import { ProgressApiError, createMockServer } from "./progressMock.js";

export { ProgressApiError };

// 요청한 진행 저장 방식과 로그인 방식으로 실제로 쓸 방식을 정합니다. 진짜 진행 저장은 진짜 로그인일 때만 씁니다.
export function resolveProgressMode(requested, authMode) {
  if (requested !== "real") return "mock";
  return authMode === "real" ? "real" : "mock";
}

const REQUESTED_PROGRESS_MODE = import.meta.env?.VITE_PROGRESS_MODE;
export const PROGRESS_MODE = resolveProgressMode(REQUESTED_PROGRESS_MODE, AUTH_MODE);
if (REQUESTED_PROGRESS_MODE === "real" && PROGRESS_MODE === "mock") {
  console.warn(
    "[progress] VITE_PROGRESS_MODE=real이지만 VITE_AUTH_MODE가 mock이라 진짜 로그인 토큰이 없습니다. 진행 저장도 가짜(mock)로 동작합니다. " +
      "진짜 진행 저장을 쓰려면 VITE_AUTH_MODE=real로 함께 바꾸세요. (docs/AUTH_SETUP.md 0장)",
  );
}

// 성공하면 PROGRESS_API.md의 응답 본문을 그대로 돌려줍니다. 실패하면 ProgressApiError를 던집니다(status: HTTP 상태, 네트워크 오류는 0).

// ① 진행 상태 불러오기 → { progress }
export function getProgress() {
  return PROGRESS_MODE === "real" ? request("GET", "/api/progress") : mockCall("getProgress", undefined, { write: false });
}

// ② 퀴즈 답 기록. choice: O = true, X = false → { result, correct, gained, leveledUp, progress }
export function answerQuiz(questionId, choice) {
  const body = { questionId, choice };
  return PROGRESS_MODE === "real" ? request("POST", "/api/quiz-answer", body) : mockCall("answerQuiz", body);
}

// ②-2 스탬프 랠리 부스 답. choiceIndex: 0 · 1 · 2 → { result: "ok" | "already" | "wrong", correct, gained(0), progress }
// 새 서버 함수 없이 같은 /api/quiz-answer에 kind: "booth"로 보냅니다.
export function answerBooth(buildingId, choiceIndex) {
  const body = { kind: "booth", buildingId, choiceIndex };
  return PROGRESS_MODE === "real" ? request("POST", "/api/quiz-answer", body) : mockCall("answerBooth", body);
}

// ③ 퀘스트 완료 기록(일일 퀘스트 "stampRally" · "dailyQuiz" 포함) → { result, gained, leveledUp, progress }
export function completeQuest(questId) {
  const body = { questId };
  return PROGRESS_MODE === "real" ? request("POST", "/api/quest-complete", body) : mockCall("completeQuest", body);
}

// ④ 하루 첫 접속(출석) 보상 → { result, gained, progress }
export function checkIn() {
  return PROGRESS_MODE === "real" ? request("POST", "/api/check-in") : mockCall("checkIn");
}

// ── 진짜 모드 ─────────────────────────────────────────────
// 아직 서버(api/progress.js 등, 임현규 담당)가 없어 시험 불가. 서버가 생기면 Vercel Preview에서 함께 확인합니다.

// 로그인 토큰을 붙이는 곳은 여기 한 곳뿐입니다. 토큰은 auth.js(Supabase 로그인 세션)에서 받습니다.
async function authHeader() {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(method, path, body) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ProgressApiError(0, `network error: ${error?.message ?? error}`);
  }
  if (!response.ok) throw new ProgressApiError(response.status);
  return response.json();
}

// ── 가짜 모드 ─────────────────────────────────────────────
const MOCK_DELAY_MS = 300;
const MOCK_SLOW_MS = 3000;

function mockScenario() {
  try {
    return new URLSearchParams(window.location.search).get("mock");
  } catch {
    return null;
  }
}

const scenario = PROGRESS_MODE === "mock" ? mockScenario() : null;
let mockServer = null;

// 로그아웃하면 가짜 서버의 진행 기록을 비웁니다. 다른 아이디로 다시 로그인했을 때 앞 사람 기록이 보이지 않게 합니다.
export function resetProgressCache() {
  mockServer = null;
}

async function mockCall(name, body, { write = true } = {}) {
  mockServer ??= createMockServer({ seed: scenario });
  await new Promise((resolve) => setTimeout(resolve, scenario === "slow" ? MOCK_SLOW_MS : MOCK_DELAY_MS));
  if (scenario === "error" && write) throw new ProgressApiError(500, "mock server error (?mock=error)");
  // 진짜 서버처럼 JSON으로 한 번 오간 값을 돌려줘, 화면이 가짜 서버 내부 값을 직접 건드리지 않게 합니다.
  return JSON.parse(JSON.stringify(mockServer[name](body)));
}
