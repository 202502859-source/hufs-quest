import { KB, retrieve } from "../../shared/kb.js";
import { getAccessToken } from "./auth.js";

const ENDPOINT = "/api/ask";
const TIMEOUT_MS = 25_000;

/*
 * 상단 검색창의 질문을 서버(api/ask.js)에 보냅니다.
 * 돌려받는 값: { mode: "ai" | "evidence" | "local" | "none" | "busy" | "limit", answer, sources: [{ title, url }] }
 * - busy: 1분 한도에 걸림(잠시 후 다시) · limit: 오늘 한도(학생 계정 · 게스트 IP 하루 또는 서비스 전체 하루)에 걸림
 * - 로컬 개발 서버(npm run dev)에는 서버 함수가 없어서, 그때는 브라우저 안의 지식 베이스에서 근거 원문만 찾아 보여 줍니다.
 */
export async function askQuestion(question, lang) {
  try {
    // 로그인한 학생이면 토큰을 붙여 서버가 계정 기준으로 사용량을 셉니다(같은 와이파이의 다른 사람과 한도를 나눠 쓰지 않게).
    // 게스트 · 토큰을 못 얻으면 붙이지 않고, 서버는 IP 기준으로 셉니다. 질문 내용과 토큰은 화면 · 콘솔에 남기지 않습니다.
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ question, lang }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 429) {
      const { reason } = await response.json().catch(() => ({}));
      const mode = reason === "day" || reason === "global" ? "limit" : "busy";
      return { mode, answer: null, sources: [] };
    }
    if (!response.ok) throw new Error(`ask ${response.status}`);
    const data = await response.json();
    if (!data || !data.mode) throw new Error("bad response");
    return data;
  } catch {
    return localAnswer(question, lang);
  }
}

function localAnswer(question, lang) {
  const docs = retrieve(question, KB, lang, 2);
  if (!docs.length) return { mode: "none", answer: null, sources: [] };
  return {
    mode: "local",
    answer: docs.map((d) => d.text[lang]).join("\n"),
    sources: docs.map((d, i) => ({ title: d.source.label[lang], url: d.source.url, refs: [i + 1] })),
  };
}
