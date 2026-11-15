// 빠른 검색창 간이 정확도 테스트
// 실제 배포된 사이트(/api/ask)에 학사 질문을 보내고, 학교 홈페이지 원문 기준의 핵심어로 채점합니다.
// 실행: npm run eval            (기본: https://hufs-quest.vercel.app)
//       npm run eval -- http://localhost:3000   (다른 주소로 테스트)
// API 키가 필요 없고, 서버의 1분당 요청 제한 때문에 질문 사이에 6.5초씩 쉽니다(약 2분 소요).

const BASE = (process.argv[2] || "https://hufs-quest.vercel.app").replace(/\/$/, "");
const DELAY_MS = 6500;

// must: 답에 꼭 들어가야 할 핵심어(원문 기준), mustNot: 들어가면 안 되는 말, outOfScope: 데이터 범위 밖이라 "찾지 못했다"고 해야 정답
const CASES = [
  { q: "학사경고 몇 번 받으면 제적돼?", must: ["4회"], src: "학사경고" },
  { q: "학사경고는 평점 몇 미만이면 받아?", must: ["1.75"], src: "학사경고" },
  { q: "계절학기는 최대 몇 학점까지 들을 수 있어?", must: ["6학점"], src: "계절학기" },
  { q: "휴학생도 계절학기 들을 수 있어?", must: ["복학"], src: "계절학기" },
  { q: "이중전공 언제 신청해?", must: ["1학년"], src: "이중전공" },
  { q: "이중전공 배정 기준이 뭐야?", must: ["34학점"], src: "이중전공" },
  { q: "부전공은 몇 학점 들어야 해?", must: ["21학점"], mustNot: ["관계없이"], src: "부전공" },
  { q: "2025학번 졸업하려면 몇 학점 필요해?", must: ["126"], mustNot: ["150"], src: "졸업이수학점" },
  { q: "예비수강신청함에 몇 강좌까지 담을 수 있어?", must: ["15"], src: "수강신청지침" },
  { q: "수강신청 취소할 때 학점 제한 있어?", must: ["12학점"], src: "수강신청지침" },
  { q: "성적 A0는 평점이 몇이야?", must: ["4.0"], src: "성적규정" },
  { q: "전과하려면 조건이 뭐야?", must: ["3.5"], src: "전과" },
  { q: "휴학은 최대 몇 년까지 할 수 있어?", must: ["3년"], src: "휴·복학" },
  { q: "신입생도 첫 학기에 휴학할 수 있어?", must: ["4주"], src: "휴·복학" },
  { q: "조기졸업 조건이 뭐야?", must: ["4.0"], src: "조기졸업" },
  { q: "졸업하려면 평점이 몇 이상이어야 해?", must: ["2.0"], src: "졸업" },
  { q: "성적증명서는 어디서 발급받아?", must: ["원스톱"], src: "증명서" },
  { q: "오늘 학식 메뉴 뭐야?", outOfScope: true },
  { q: "2027년 1학기 개강일이 언제야?", outOfScope: true },
  { q: "도서관 운영 시간 알려줘", outOfScope: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cut = (text, n) => {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

async function ask(question) {
  const started = Date.now();
  const res = await fetch(`${BASE}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, lang: "ko" }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ms: Date.now() - started, ...body };
}

function grade(c, r) {
  const answer = String(r.answer ?? "");
  if (c.outOfScope) {
    const refused = r.mode === "none" || /찾지 못|찾을 수 없/.test(answer);
    return refused ? "거절" : "지어냄";
  }
  if (r.mode === "none" || !answer) return "답 없음";
  const hasAll = c.must.every((w) => answer.includes(w));
  const hasBad = (c.mustNot || []).some((w) => answer.includes(w));
  return hasAll && !hasBad ? "정확" : "확인 필요";
}

console.log(`\n빠른 검색창 간이 정확도 테스트  (${BASE}, ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })})\n`);

const rows = [];
for (const [i, c] of CASES.entries()) {
  let r;
  try {
    r = await ask(c.q);
  } catch (err) {
    r = { status: 0, ms: 0, answer: `오류: ${err.message}` };
  }
  const result = grade(c, r);
  rows.push({ c, r, result });
  const mark = { 정확: "✓", 거절: "✓", "확인 필요": "△", "답 없음": "✗", 지어냄: "✗" }[result];
  const kind = c.outOfScope ? "범위 밖" : "학사";
  console.log(`${String(i + 1).padStart(2)}. ${mark} [${kind}] ${c.q}`);
  console.log(`      → ${cut(r.answer || "(답 없음)", 70)}  (${(r.ms / 1000).toFixed(1)}초, ${result})`);
  if (i < CASES.length - 1) await sleep(DELAY_MS);
}

const inScope = rows.filter((x) => !x.c.outOfScope);
const outScope = rows.filter((x) => x.c.outOfScope);
const correct = inScope.filter((x) => x.result === "정확").length;
const refused = outScope.filter((x) => x.result === "거절").length;
const avg = rows.reduce((sum, x) => sum + x.r.ms, 0) / rows.length / 1000;

console.log("\n──────────── 요약 ────────────");
console.log(`학사 질문    : ${inScope.length}개 중 ${correct}개 핵심어 일치 (${Math.round((correct / inScope.length) * 100)}%)`);
console.log(`범위 밖 질문 : ${outScope.length}개 중 ${refused}개 "찾지 못함" 안내 (지어낸 답 ${outScope.length - refused}건)`);
console.log(`평균 응답    : ${avg.toFixed(1)}초`);
console.log("※ '확인 필요'는 원문의 핵심 기준이 빠졌거나 근거 없는 말이 섞인 답변입니다.\n");
