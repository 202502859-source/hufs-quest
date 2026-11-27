/*
 * 근거에 없는 연락처 · 주소 검사 (11/27, PM 결정: 이종헌)
 *
 * 배경: 11/27 범위 밖 질문 점검("교수님 이메일", "오늘 학식 메뉴", "학사모 대여")에서 AI가 근거 번호를 단 채
 *       근거 조각에 없는 연락처나 안내처를 덧붙였다(예: 영양사실 내선 "2211"을 "(02)2211"로 바꿔 씀).
 *       #98의 숫자 검사(api/ask.js unsupportedNumbers)와 같은 방식으로, 근거에도 질문에도 없는 연락처가 있으면 막는다.
 *
 * unsupportedContacts(answer, docs, question) → [{ kind: "email" | "phone" | "url", value: 정규화한 값 }]
 *  - 답에 있는 이메일 주소, 전화번호(010 · 02 · 031 같은 지역번호 · 1588 같은 대표번호, 하이픈 · 점 · 공백 · 괄호 · 붙여쓰기 모두),
 *    인터넷 주소(http(s)://… · www.…)를 찾는다.
 *  - 비교는 공백 · 하이픈 · 점(전화번호는 괄호도)을 뺀 정규화 값으로 한다. 근거 조각 원문(제목 · 본문 · 출처 주소)이나
 *    질문에 같은 값이 있으면 통과, 없으면 돌려준다. 근거에 있는 학교 부서 대표번호 · 공식 주소는 그대로 통과한다.
 *  - 순수 함수: 네트워크 · 로그 없음. 돌려주는 값은 로그에 남기지 않는다(ask.js는 개수만 남김).
 */

// 공백 · 하이픈 · 점(과 괄호)을 빼고 소문자로 바꾼 비교용 값
const squash = (text) => String(text ?? "").toLowerCase().replace(/[\s\-.()‐-―]/g, "");

// 이메일: 아이디@도메인.최상위
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;

// 인터넷 주소: http(s)://… 또는 www.… (끝의 문장부호 · 닫는 괄호는 뺌)
const URL_LIKE = /(?:https?:\/\/|www\.)[^\s<>"'`，、가-힣]+/gi;

// 전화번호. 앞뒤가 숫자이면 다른 숫자(학번 · 날짜 등)의 일부라서 제외합니다.
//  1) 0으로 시작하는 국번(02 · 031 · 010 · 070 …) + 3~4자리 + 4자리. 구분자는 공백 · 하이픈 · 점 · 괄호, 없어도 됨(붙여쓰기)
//  2) 괄호로 감싼 국번 뒤에 3~4자리만 있는 짧은 형태("(02)2211"처럼 내선을 국번과 붙여 만든 번호)
//  3) 15xx · 16xx · 18xx 대표번호 + 4자리
const SEP = "[\\s.\\-)\\u2010-\\u2015]*";
const PHONE = new RegExp(
  [
    `\\(?0\\d{1,2}\\)?${SEP}\\d{3,4}${SEP}\\d{4}`,
    `\\(0\\d{1,2}\\)\\s*\\d{3,4}`,
    `0\\d{1,2}\\)\\s*\\d{3,4}`,
    `1[5-9]\\d{2}${SEP}\\d{4}`,
  ]
    .map((p) => `(?<!\\d)${p}(?!\\d)`)
    .join("|"),
  "g",
);

const trimUrl = (url) => url.replace(/[.,;:!?)\]}>]+$/, "");
const urlKey = (url) => squash(trimUrl(url).replace(/^https?:\/\//i, "").replace(/\/+$/, ""));
const phoneKey = (phone) => phone.replace(/\D/g, "");

// 답에서 연락처 후보를 찾아 { kind, value(정규화) } 목록으로 돌려줍니다. 같은 값은 한 번만.
export function findContacts(text) {
  const source = String(text ?? "");
  const found = [];
  const seen = new Set();
  const push = (kind, value) => {
    const key = `${kind}:${value}`;
    if (value && !seen.has(key)) {
      seen.add(key);
      found.push({ kind, value });
    }
  };
  // 이메일을 먼저 찾고, 이메일 안의 숫자 · 도메인이 전화번호 · 주소로 다시 잡히지 않게 지웁니다.
  let rest = source.replace(EMAIL, (m) => {
    push("email", squash(m));
    return " ";
  });
  rest = rest.replace(URL_LIKE, (m) => {
    push("url", urlKey(m));
    return " ";
  });
  for (const m of rest.matchAll(PHONE)) push("phone", phoneKey(m[0]));
  return found;
}

// 근거 조각 원문(제목 · 본문 · 출처 주소)과 질문 어디에도 없는 연락처 · 주소만 돌려줍니다.
export function unsupportedContacts(answer, docs = [], question = "") {
  const contacts = findContacts(answer);
  if (!contacts.length) return [];
  const evidence = squash(
    [...(docs || []).map((d) => `${d?.title ?? ""} ${d?.text ?? ""} ${d?.url ?? ""}`), question].join(" "),
  );
  return contacts.filter(({ value }) => !evidence.includes(value));
}
