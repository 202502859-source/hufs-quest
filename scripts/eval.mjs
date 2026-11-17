// 빠른 검색창 정확도 테스트 (50문항)
// 실제 배포된 사이트(/api/ask)에 질문을 보내고, 학교 홈페이지 원문 기준의 핵심어와 인용 출처로 채점합니다.
// 실행: npm run eval                                   (기본: https://hufs-quest.vercel.app)
//       npm run eval -- https://<Preview 주소>.vercel.app   (PR Preview 등 다른 주소로 테스트)
// API 키가 필요 없고, 서버의 1분당 요청 제한 때문에 질문 사이에 6.5초씩 쉽니다(약 6분 소요).
// 결과는 data/eval/<날짜-시간>.json에 저장되어 고치기 전후를 비교할 수 있습니다.
import { mkdir, writeFile } from "node:fs/promises";

const BASE = (process.argv[2] || "https://hufs-quest.vercel.app").replace(/\/$/, "");
const DELAY_MS = 6500;

// q: 질문 / type: 기본·구어체·조건·혼동·영어·범위밖 / pages: 정답 근거가 있는 학교 페이지 번호(URL의 숫자)
// must: 답에 모두 있어야 할 말 / any: 이 중 하나는 있어야 할 말 / mustNot: 있으면 안 되는 말 / lang: 기본 ko
// 모든 정답은 data/chunks.json(2026-11-10 수집)의 원문에서 뽑았습니다. 원문이 바뀌면 정답도 다시 확인하세요.
const CASES = [
  // ── 학사경고·제적·재입학
  { q: "학사경고 몇 번 받으면 제적돼?", type: "구어체", pages: ["11382", "11383"], must: ["4회"] },
  { q: "학사경고는 평점 몇 미만이면 받아?", type: "기본", pages: ["11382", "11383"], must: ["1.75"] },
  { q: "성적 불량으로 제적됐다가 재입학했는데 학사경고 받으면 어떻게 돼?", type: "조건", pages: ["11381", "11383"], must: ["제적"] },
  { q: "재입학 신청은 언제 해?", type: "기본", pages: ["11381"], must: ["5일"] },

  // ── 계절학기
  { q: "계절학기는 최대 몇 학점까지 들을 수 있어?", type: "기본", pages: ["11378"], must: ["6학점"] },
  { q: "휴학생도 계절학기 들을 수 있어?", type: "조건", pages: ["11378"], must: ["복학"] },
  { q: "계절학기 신청자가 적으면 폐강돼?", type: "구어체", pages: ["11378"], must: ["30명"] },
  { q: "How many credits can I take in a summer session?", type: "영어", lang: "en", pages: ["11378"], must: ["6"] },

  // ── 이중전공·부전공
  { q: "이중전공 언제 신청해?", type: "구어체", pages: ["11384"], must: ["1학년"] },
  { q: "이중전공 배정 기준이 뭐야?", type: "기본", pages: ["11384"], must: ["34학점"] },
  { q: "25학번은 이중전공 우선 선발 기준 학점이 몇이야?", type: "조건", pages: ["11384"], must: ["32학점"] },
  { q: "이중전공 배정 비율은 입학정원의 몇 퍼센트야?", type: "기본", pages: ["11384"], must: ["150%"] },
  { q: "사범대 학생이 아닌데 사범대 전공을 이중전공으로 할 수 있어?", type: "조건", pages: ["11384"], any: ["없", "불가"] },
  { q: "후기 이중전공은 어떤 제도야?", type: "혼동", pages: ["11384"], must: ["부전공"] },
  { q: "후기 이중전공은 언제 신청해?", type: "혼동", pages: ["11384"], must: ["4월"], mustNot: ["1학년 과정"] },
  { q: "부전공은 몇 학점 들어야 해?", type: "기본", pages: ["11385"], must: ["21학점"], mustNot: ["관계없이"] },

  // ── 졸업학점·졸업·조기졸업·수료
  { q: "2025학번 졸업하려면 몇 학점 필요해?", type: "조건", pages: ["11373"], must: ["126"], mustNot: ["150"] },
  { q: "서울캠퍼스 2020학번 이중전공하면 졸업학점이 몇이야?", type: "조건", pages: ["11373"], must: ["134"] },
  { q: "졸업하려면 평점이 몇 이상이어야 해?", type: "기본", pages: ["11390"], must: ["2.0"] },
  { q: "졸업 학점 다 채웠는데 휴학 중이면 졸업할 수 있어?", type: "조건", pages: ["11390", "11387"], any: ["불가", "없", "못"] },
  { q: "최우등 졸업 기준이 뭐야?", type: "기본", pages: ["11390"], must: ["4.25"] },
  { q: "조기졸업 조건이 뭐야?", type: "기본", pages: ["11389"], must: ["4.0"] },
  { q: "조기졸업하면 몇 학기 만에 졸업해?", type: "기본", pages: ["11389"], must: ["7학기"] },
  { q: "조기졸업 대상자인데 한 학기 평점이 3.7이면 어떻게 돼?", type: "조건", pages: ["11389"], must: ["취소"] },

  // ── 수강신청·성적
  { q: "예비수강신청함에 몇 강좌까지 담을 수 있어?", type: "기본", pages: ["11377"], must: ["15"] },
  { q: "수강신청 취소할 때 학점 제한 있어?", type: "기본", pages: ["11377"], must: ["12학점"] },
  { q: "4학년도 12학점 밑으로는 수강 취소 못 해?", type: "조건", pages: ["11377"], must: ["예외"] },
  { q: "1학기에 최대 학점 다 안 들으면 2학기로 넘길 수 있어?", type: "구어체", pages: ["11377"], must: ["이월"] },
  { q: "성적 A0는 평점이 몇이야?", type: "기본", pages: ["11379", "11382"], must: ["4.0"] },
  { q: "B+ 받으면 평점 몇 점이야?", type: "구어체", pages: ["11379", "11382"], must: ["3.5"] },
  { q: "How many academic warnings lead to dismissal?", type: "영어", lang: "en", pages: ["11382", "11383"], any: ["4", "four"] },

  // ── 전과·휴복학·학석사
  { q: "전과하려면 조건이 뭐야?", type: "기본", pages: ["11388"], must: ["3.5"] },
  { q: "25학번이 2학기 마치고 전과하려면 몇 학점 필요해?", type: "조건", pages: ["11388"], must: ["32학점"] },
  { q: "휴학은 최대 몇 년까지 할 수 있어?", type: "기본", pages: ["11387"], must: ["3년"] },
  { q: "신입생도 첫 학기에 휴학할 수 있어?", type: "조건", pages: ["11387"], must: ["4주"] },
  { q: "군대 가는데 휴학은 언제까지 신청해야 돼?", type: "혼동", pages: ["11387"], must: ["입대일"] },
  { q: "육아휴학은 최대 얼마나 할 수 있어?", type: "혼동", pages: ["11387"], must: ["2년"] },
  { q: "학석사연계과정 지원하려면 평점 몇 이상이야?", type: "기본", pages: ["11386"], must: ["3.5"] },

  // ── 장학·교직·증명서·교양·마이크로디그리
  { q: "성적우수 장학금 받으려면 몇 학점 이상, 평점 몇 이상이어야 해?", type: "조건", pages: ["11393"], must: ["14학점", "3.5"] },
  { q: "국가장학금 성적 기준이 뭐야?", type: "기본", pages: ["11394"], must: ["80"] },
  { q: "국가근로 하면 학기 중에 한 달에 몇 시간까지 일할 수 있어?", type: "구어체", pages: ["11394"], must: ["80시간"] },
  { q: "교직이수 신청하려면 몇 학점 이상 들어야 해?", type: "조건", pages: ["11398"], must: ["48학점"] },
  { q: "성적증명서는 어디서 발급받아?", type: "기본", pages: ["11304"], must: ["원스톱"] },
  { q: "증명서 자동발급기는 몇 시까지 운영해?", type: "기본", pages: ["11304"], any: ["20:00", "20시", "오후 8시"] },
  { q: "마이크로디그리 다 못 들으면 졸업에 지장 있어?", type: "조건", pages: ["13511"], any: ["무관", "관계없", "상관없", "영향"] },

  // ── 범위 밖 (지금 데이터에 없음 → "찾지 못했다"가 정답)
  { q: "오늘 학식 메뉴 뭐야?", type: "범위밖", outOfScope: true },
  { q: "2027년 1학기 개강일이 언제야?", type: "범위밖", outOfScope: true, note: "학사일정 수집 후 일반 문항으로 바꿀 것" },
  { q: "도서관 운영 시간 알려줘", type: "범위밖", outOfScope: true },
  { q: "기숙사 입사 신청은 언제 해?", type: "범위밖", outOfScope: true },
  { q: "이번 학기 중간고사 기간이 언제야?", type: "범위밖", outOfScope: true, note: "학사일정 수집 후 일반 문항으로 바꿀 것" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cut = (text, n) => {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

async function ask(question, lang) {
  const started = Date.now();
  const res = await fetch(`${BASE}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, lang }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ms: Date.now() - started, ...body };
}

// 결과 → 정확 / 거절 / 지어냄 / (나) 검색 실패 / (나) 엉뚱한 근거 / (다) 답변 오류
function grade(c, r) {
  const answer = String(r.answer ?? "");
  if (c.outOfScope) {
    const refused = r.mode === "none" || /찾지 못|찾을 수 없|couldn't find|could not find/i.test(answer);
    return { result: refused ? "거절" : "지어냄" };
  }
  const cited = (r.sources || []).map((s) => String(s?.url ?? ""));
  const foundSource = cited.some((url) => c.pages.some((p) => url.includes(`/${p}/`)));
  const ok =
    (c.must || []).every((w) => answer.includes(w)) &&
    (!c.any || c.any.some((w) => answer.includes(w))) &&
    !(c.mustNot || []).some((w) => answer.includes(w));

  if (r.mode === "none" || !answer) return { result: "(나) 검색 실패", foundSource };
  if (ok) return { result: "정확", foundSource };
  if (!foundSource) return { result: "(나) 엉뚱한 근거", foundSource };
  return { result: "(다) 답변 오류", foundSource };
}

const MARK = { 정확: "✓", 거절: "✓", 지어냄: "✗", "(나) 검색 실패": "✗", "(나) 엉뚱한 근거": "✗", "(다) 답변 오류": "△" };
const startedAt = new Date();
console.log(`\n빠른 검색창 정확도 테스트 ${CASES.length}문항  (${BASE}, ${startedAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })})\n`);

const rows = [];
for (const [i, c] of CASES.entries()) {
  let r;
  try {
    r = await ask(c.q, c.lang || "ko");
  } catch (err) {
    r = { status: 0, ms: 0, answer: `오류: ${err.message}` };
  }
  const g = grade(c, r);
  rows.push({ ...c, mode: r.mode, ms: r.ms, answer: r.answer ?? null, sources: (r.sources || []).map((s) => s?.url), ...g });
  console.log(`${String(i + 1).padStart(2)}. ${MARK[g.result]} [${c.type}] ${c.q}`);
  console.log(`      → ${cut(r.answer || "(답 없음)", 70)}  (${(r.ms / 1000).toFixed(1)}초, ${g.result}${r.mode === "evidence" ? ", AI 실패로 원문 표시" : ""})`);
  if (i < CASES.length - 1) await sleep(DELAY_MS);
}

const inScope = rows.filter((x) => !x.outOfScope);
const outScope = rows.filter((x) => x.outOfScope);
const correct = inScope.filter((x) => x.result === "정확").length;
const refused = outScope.filter((x) => x.result === "거절").length;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const avg = rows.reduce((sum, x) => sum + (x.ms || 0), 0) / rows.length / 1000;

console.log("\n──────────── 요약 ────────────");
console.log(`학사 질문    : ${inScope.length}개 중 ${correct}개 정확 (${pct(correct, inScope.length)}%)`);
console.log(`범위 밖 질문 : ${outScope.length}개 중 ${refused}개 "찾지 못함" 안내 (지어낸 답 ${outScope.length - refused}건)`);
console.log(`평균 응답    : ${avg.toFixed(1)}초\n`);

console.log("유형별 정확도");
for (const type of [...new Set(inScope.map((x) => x.type))]) {
  const list = inScope.filter((x) => x.type === type);
  const ok = list.filter((x) => x.result === "정확").length;
  console.log(`  ${type.padEnd(4)} ${ok}/${list.length} (${pct(ok, list.length)}%)`);
}

console.log("\n틀린 이유");
for (const kind of ["(나) 검색 실패", "(나) 엉뚱한 근거", "(다) 답변 오류"]) {
  const list = inScope.filter((x) => x.result === kind);
  if (list.length) console.log(`  ${kind} ${list.length}건: ${list.map((x) => `"${cut(x.q, 20)}"`).join(", ")}`);
}
console.log("  ※ (나) → 조각 나누기·검색 개선 / (다) → 답변 규칙·검증 개선 / 문서 자체가 없으면 (가) → 수집 대상 추가");

const stamp = new Date(startedAt.getTime() + 9 * 3600e3).toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-"); // 한국 시간
const outUrl = new URL(`../data/eval/${stamp}.json`, import.meta.url);
await mkdir(new URL("../data/eval/", import.meta.url), { recursive: true });
await writeFile(outUrl, `${JSON.stringify({ base: BASE, at: startedAt.toISOString(), correct, total: inScope.length, refused, outOfScope: outScope.length, rows }, null, 2)}\n`);
console.log(`\n결과 저장 → data/eval/${stamp}.json\n`);
