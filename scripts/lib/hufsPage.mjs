// 학교 홈페이지(K2Web) 페이지 HTML에서 본문만 뽑아 '제목 > 소제목' 단위로 나누고,
// 검색에 알맞은 크기의 조각(chunk)으로 자릅니다. collect.mjs와 테스트가 함께 씁니다.
import * as cheerio from "cheerio";

const HEADING = "\u0000H"; // 소제목 표시용 내부 기호
const NOISE = [/^\/WEB-INF\//, /^hufs_sub/, /^fnctId=/, /^RSS 2\.0$/, /^콘텐츠 담당자$/];
// 개인 연락처 가림(11/20 3차): 줄은 지우지 않습니다. 메일 주소는 기본으로 남깁니다.
// 같은 줄에 사람 이름 표시("담당자 ○○○", "○○○ 선생님 · 주무관 · 교수")가 있을 때만
// 그 이름과 그 줄의 메일 · 직통번호(전화 · 내선)를 "(개인 연락처 생략)"으로 바꿉니다. "대표" 번호와 나머지 문장은 남김.
//   예: "담당자 홍길동 (gildong@hufs.ac.kr, 02-2173-1234)" → "담당자 (개인 연락처 생략)"
//   남김: "BRICs(브릭스)전공 e-mail: brics@hufs.ac.kr", "인사팀 | 인사팀장 | 2163"(직책만), "비전임 교수 | 3322"
const PHONE = /(^|[^\d])0\d{1,2}[-.)\s]\s?\d{3,4}[-.\s]\d{4}(?!\d)/; // 02-2173-2112, 031-330-4027, 02)2173-2112
const PHONE_G = /0\d{1,2}[-.)\s]\s?\d{3,4}[-.\s]\d{4}(?!\d)/g;
const EXT_G = /(내선\s*)?(?<![\d.~-])\d{4}(?![\d.~-]|\s*(학|년|월|원|명|개|시|호|층|번|~))/g; // 이름 줄의 내선 "2130", "내선 2130"(연도 · 호실은 제외)
const EXTENSION = /\|\s*(\d{3,4}-)?\d{4}(\s*,\s*[\d-]+)*$/; // 전화안내 표의 "부서 | 2175" 내선
const EMAIL = /([\w.+-]+)@[\w-]+(\.[\w-]+)+/g;
const NAME = "[가-힣]{2,4}|[가-힣]○{1,3}";
// 이름 자리에 부서 · 직위가 온 경우(사람 이름이 아님)
const NOT_NAME = /(팀|과|실|처|부|센터|위원회|사무국|학과|전공|대학|학부)$|^(비전임|전임|명예|초빙|객원|겸임|주임|외국인|지도|담당|소속|해당|전공|학과)$/;
const MANAGER = new RegExp(`(^|[\\s|:,(·/])((콘텐츠\\s*)?담당자\\s*[:：]?\\s*)(${NAME})(?=$|[\\s,()|/])`, "g");
const NAME_TITLE = new RegExp(`(^|[\\s|:,(·/])(${NAME})\\s*(선생님|주무관|교수)(?=$|[\\s|,():/])`, "g");
const MASK = "(개인 연락처 생략)";
const TOKEN = "\u0001P\u0001";

function nameHits(line) {
  const hits = [];
  for (const m of line.matchAll(MANAGER)) if (!NOT_NAME.test(m[4])) hits.push({ kind: "manager", m });
  for (const m of line.matchAll(NAME_TITLE)) if (!NOT_NAME.test(m[2])) hits.push({ kind: "title", m });
  return hits;
}

// 줄에 사람 이름 표시가 있는지(가린 뒤에는 false가 되어야 함)
export function isPersonalContact(line) {
  return nameHits(line).length > 0;
}

// 개인 메일 아이디: 이름 표시가 없어도 이 아이디의 메일만 가립니다(같은 줄의 다른 내용은 그대로).
// 11/20 확인: 전공 문의 줄의 개인 이름형 메일. 새로 발견되면 여기에 추가
export const PERSONAL_MAIL_IDS = ["sanghoon", "ywlee"];

function maskPersonalMailIds(line) {
  const emails = [];
  const out = line.replace(EMAIL, (mail, id) => {
    if (!PERSONAL_MAIL_IDS.includes(id.toLowerCase())) return mail;
    emails.push(id);
    return MASK;
  });
  return { line: out, emails };
}

// 반환: { line: 가린 줄, masked: 가렸는지, emails: 가린 메일 아이디(@ 앞) }
// " / "로 나뉜 줄은 이름이 있는 구간만 가립니다.
//   예: "문의 : 생협 사무국 031-330-4192 / 담당자 : 홍길동 팀장" → 사무국 번호는 남기고 이름만 가림
export function maskPersonalContact(line) {
  if (!isPersonalContact(line)) {
    const listed = maskPersonalMailIds(line);
    return { line: listed.line, masked: listed.emails.length > 0, emails: listed.emails };
  }
  const parts = line.split(/(\s\/\s)/);
  if (parts.length > 1) {
    const emails = [];
    const out = parts.map((part, i) => {
      if (i % 2) return part;
      const r = isPersonalContact(part) ? maskSegment(part) : maskPersonalMailIds(part);
      emails.push(...r.emails);
      return r.line;
    });
    return { line: out.join(""), masked: true, emails };
  }
  return { ...maskSegment(line), masked: true };
}

function maskSegment(line) {
  const emails = [...line.matchAll(EMAIL)].map((m) => m[1]);
  let out = line
    .replace(MANAGER, (all, pre, label, _c, name) => (NOT_NAME.test(name) ? all : `${pre}${label}${TOKEN}`))
    .replace(NAME_TITLE, (all, pre, name) => (NOT_NAME.test(name) ? all : `${pre}${TOKEN}`))
    .replace(EMAIL, TOKEN)
    .replace(PHONE_G, (num, offset, str) => (/대표\s*(번호|전화)?\s*[:：]?\s*$/.test(str.slice(Math.max(0, offset - 12), offset)) ? num : TOKEN))
    .replace(EXT_G, TOKEN);
  // 붙어 있는 가림 표시는 하나로: "(⟪P⟫, ⟪P⟫)" → "⟪P⟫", "⟪P⟫ / ⟪P⟫" → "⟪P⟫"
  const t = TOKEN.replace(/\u0001/g, "\\u0001");
  out = out
    .replace(new RegExp(`${t}(\\s*[,/·|]?\\s*${t})+`, "g"), TOKEN)
    .replace(new RegExp(`\\s*\\(\\s*${t}\\s*\\)`, "g"), ` ${TOKEN}`)
    .replace(new RegExp(`${t}(\\s*[,/·|]?\\s*${t})+`, "g"), TOKEN)
    .replaceAll(TOKEN, MASK)
    .replace(/\s+/g, " ")
    .trim();
  return { line: out, emails };
}

// 부서 연락처(전화 · 내선 · 공용 메일)가 들어 있는 조각은 40자 미만이어도 남깁니다(문의 조각 · 전화안내 페이지).
function hasContact(body) {
  return body.split("\n").some((line) => PHONE.test(line) || EXTENSION.test(line) || /@/.test(line));
}
const MIN_BODY_CHARS = 40; // 머리글을 뺀 본문이 이보다 짧은 조각은 버림(연락처 조각은 예외)

export function extractPage(html) {
  const $ = cheerio.load(html);
  const title = $(".menu-title").first().text().trim() || $("title").text().trim();
  const main = $("#subContent").first();
  if (!main.length) return { title, lines: [] };

  main.find("script, style, noscript, input, caption, colgroup, .contntMaster, .menu-title-box").remove();
  // 페이지 끝 '콘텐츠 담당자' 상자는 별도의 '문의' 구간으로 둡니다.
  main.find(".people-info .title").each((_, el) => {
    $(el).replaceWith($("<p></p>").text(`\n${HEADING}2문의\n`));
  });
  main.find("table").each((_, table) => {
    const rows = $(table).find("tr").toArray().map((tr) =>
      $(tr).children("th, td").toArray()
        .map((cell) => cellText($, cell))
        .filter(Boolean)
        .join(" | "),
    ).filter(Boolean);
    $(table).replaceWith($("<p></p>").text(`\n${rows.join("\n")}\n`));
  });
  main.find("h2, h3, h4").each((_, h) => {
    $(h).replaceWith($("<p></p>").text(`\n${HEADING}${h.tagName.slice(1)}${clean($(h).text())}\n`));
  });
  main.find("p, div, li, br, dt, dd, h5, h6").each((_, el) => { $(el).append("\n"); });

  let personalMasked = 0;
  const personalEmails = []; // 가린 메일 아이디(@ 앞)만. 부서 메일이 잘못 가려졌는지 사람이 확인하는 용도
  const lines = main.text().split("\n").map(clean).map(stripFootnotes)
    .filter((line) => line && !NOISE.some((re) => re.test(line)))
    .map((line) => {
      const r = maskPersonalContact(line);
      if (r.masked) {
        personalMasked += 1;
        personalEmails.push(...r.emails);
      }
      return r.line;
    });
  return { title, lines, personalMasked, personalEmails };
}

// 머리글에 [글로벌] 표시가 붙은 조각(글로벌캠퍼스 전용 기준). 서울캠퍼스 서비스라 collect가 저장하지 않습니다.
// (11/20 eval: 2025학번 졸업학점 질문에 글로벌 기준이 섞여 오답) [서울]과 표시 없는 조각은 그대로.
export function isGlobalOnly(chunk) {
  return chunk.text.startsWith("[글로벌] ");
}

export function dropGlobalOnly(chunks) {
  const kept = chunks.filter((c) => !isGlobalOnly(c));
  return { kept, dropped: chunks.length - kept.length };
}

// 각주 기호(*, **, ***)를 지웁니다. 지운 뒤 남는 빈 괄호 "()"도 함께 정리.
export function stripFootnotes(line) {
  if (!line.includes("*")) return line;
  return line
    .replace(/\*+/g, " ")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([,.)])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// 조각 전체에 '글로벌캠퍼스'만 나오면 [글로벌], '서울캠퍼스'만 나오면 [서울]. 둘 다이거나 둘 다 없으면 표시 없음.
export function campusTag(text) {
  const global = text.includes("글로벌캠퍼스");
  const seoul = text.includes("서울캠퍼스");
  if (global && !seoul) return "[글로벌] ";
  if (seoul && !global) return "[서울] ";
  return "";
}

// 소제목 기준으로 묶은 뒤, 긴 구간은 maxChars 안에서 줄 단위로 자르고 앞 조각 끝을 조금 겹칩니다.
// 머리글을 뺀 본문이 MIN_BODY_CHARS 미만인 조각은 버리고(부서 연락처 조각은 남김), 캠퍼스 표시([서울] · [글로벌])를 머리글 앞에 붙입니다.
export function toChunks({ pageId, title, url, lines, maxChars = 700, overlapChars = 120 }) {
  const sections = [];
  let h2 = "";
  let h3 = "";
  let current = null;
  const open = () => {
    current = { section: [h2, h3].filter(Boolean).join(" > "), lines: [] };
    sections.push(current);
  };
  for (const line of lines) {
    if (line.startsWith(HEADING)) {
      const level = line[HEADING.length];
      const text = line.slice(HEADING.length + 1);
      if (level === "2") { h2 = text; h3 = ""; } else { h3 = text; }
      open();
      continue;
    }
    if (!current) open();
    current.lines.push(line);
  }

  const chunks = [];
  for (const { section, lines: body } of sections) {
    if (!body.length) continue;
    const header = `[${[title, section].filter(Boolean).join(" > ")}]`;
    let buf = [];
    let size = 0;
    let fresh = 0; // 마지막으로 자른 뒤 새로 들어온 줄 수
    const flush = () => {
      if (!buf.length) return;
      chunks.push({ section, text: `${header}\n${buf.join("\n")}` });
      const keep = [];
      let kept = 0;
      for (let i = buf.length - 1; i >= 0 && kept + buf[i].length <= overlapChars; i -= 1) {
        keep.unshift(buf[i]);
        kept += buf[i].length;
      }
      buf = keep;
      size = kept;
      fresh = 0;
    };
    for (const line of body) {
      for (const piece of splitLong(line, maxChars)) {
        if (size + piece.length > maxChars && size > overlapChars) flush();
        buf.push(piece);
        size += piece.length + 1;
        fresh += 1;
      }
    }
    if (fresh > 0) chunks.push({ section, text: `${header}\n${buf.join("\n")}` });
  }

  return chunks
    .filter((chunk) => {
      const body = chunk.text.slice(chunk.text.indexOf("\n") + 1);
      return body.length >= MIN_BODY_CHARS || hasContact(body);
    })
    .map((chunk, i) => ({
      id: `${pageId}-${String(i + 1).padStart(2, "0")}`,
      title,
      url,
      section: chunk.section || null,
      text: `${campusTag(chunk.text)}${chunk.text}`,
    }));
}

// 칸 안의 여러 문단은 쉼표로 이어 붙입니다 (예: "영어대학, 노어과").
function cellText($, cell) {
  const c = $(cell);
  c.find("p, li, div").append("\n");
  c.find("br").after("\n");
  return c.text().split("\n").map(clean).filter(Boolean).join(", ");
}

function splitLong(line, max) {
  if (line.length <= max) return [line];
  const parts = [];
  for (let i = 0; i < line.length; i += max) parts.push(line.slice(i, i + max));
  return parts;
}

function clean(text) {
  return text.replace(/[\s ]+/g, " ").trim();
}
