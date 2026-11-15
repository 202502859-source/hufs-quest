import { KB, retrieve } from "../../shared/kb.js";

const ENDPOINT = "/api/ask";
const TIMEOUT_MS = 25_000;

/*
 * 상단 검색창의 질문을 서버(api/ask.js)에 보냅니다.
 * 돌려받는 값: { mode: "ai" | "evidence" | "local" | "none" | "busy", answer, sources: [{ title, url }] }
 * - 로컬 개발 서버(npm run dev)에는 서버 함수가 없어서, 그때는 브라우저 안의 지식 베이스에서 근거 원문만 찾아 보여 줍니다.
 */
export async function askQuestion(question, lang) {
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, lang }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 429) return { mode: "busy", answer: null, sources: [] };
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
