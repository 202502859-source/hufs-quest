// 학교 홈페이지(K2Web) 페이지 HTML에서 본문만 뽑아 '제목 > 소제목' 단위로 나누고,
// 검색에 알맞은 크기의 조각(chunk)으로 자릅니다. collect.mjs와 테스트가 함께 씁니다.
import * as cheerio from "cheerio";

const HEADING = "\u0000H"; // 소제목 표시용 내부 기호
const NOISE = [/^\/WEB-INF\//, /^hufs_sub/, /^fnctId=/, /^RSS 2\.0$/, /^콘텐츠 담당자$/];
// 개인정보 줄: 전화번호 · 이메일 · "담당자 홍길동" 형태. 줄 전체를 버리고, 부서 이름 · 위치만 있는 줄은 남깁니다.
export const PRIVACY = [
  /(^|[^\d])0\d{1,2}[-.)\s]\s?\d{3,4}[-.\s]\d{4}(?!\d)/, // 02-2173-2112, 031-330-4027, 02)2173-2112, 010-1234-5678
  /[\w.+-]+@[\w-]+(\.[\w-]+)+/, // 이메일
  /^(콘텐츠\s*)?담당자\s*[:：]?\s*[가-힣○]{2,4}(\s|$|[,(|/])/, // 담당자 홍길동
];
const MIN_BODY_CHARS = 40; // 머리글을 뺀 본문이 이보다 짧은 조각은 버림

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

  let privacyRemoved = 0;
  const lines = main.text().split("\n").map(clean).map(stripFootnotes).filter((line) => {
    if (!line || NOISE.some((re) => re.test(line))) return false;
    if (PRIVACY.some((re) => re.test(line))) {
      privacyRemoved += 1;
      return false;
    }
    return true;
  });
  return { title, lines, privacyRemoved };
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
// 머리글을 뺀 본문이 MIN_BODY_CHARS 미만인 조각은 버리고, 캠퍼스 표시([서울] · [글로벌])를 머리글 앞에 붙입니다.
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
    .filter((chunk) => chunk.text.slice(chunk.text.indexOf("\n") + 1).length >= MIN_BODY_CHARS)
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
