const DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\+09:00$/;

const START_WORDS = /시작|개시|접수\s*시작|신청\s*시작/;
const END_WORDS = /마감|종료|접수\s*마감|신청\s*마감/;

function findDateEvidence(raw, value, field) {
  const match = DATE_RE.exec(value);
  if (!match) return null;

  const [, y, mo, d, h, mi] = match;

  const datePattern = new RegExp(
    `${y}\\s*년\\s*0*${Number(mo)}\\s*월\\s*0*${Number(d)}\\s*일\\s*0*${Number(h)}\\s*:\\s*0*${Number(mi)}`
  );

  const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  const matches = lines.filter(line => {
    if (!datePattern.test(line)) return false;

    if (field === "startsAt") {
      return START_WORDS.test(line) && !END_WORDS.test(line);
    }

    return END_WORDS.test(line) && !START_WORDS.test(line);
  });

  return matches.length === 1 ? matches[0] : null;
}

function findTextEvidence(raw, value, field) {
  const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  const matches = lines.filter(line => line.includes(value));

  if (field === "title") {
    return matches.length === 1 && matches[0] === value
      ? matches[0]
      : null;
  }

  if (field === "dept") {
    const departments = matches.filter(
      line => /담당\s*부서|주관\s*부서|담당\s*기관/.test(line)
    );

    return departments.length === 1 ? departments[0] : null;
  }

  return null;
}

export function attachNoticeEvidence(raw, extracted) {
  const result = structuredClone(extracted);

  for (const field of [
    "title", "dept", "category", "startsAt", "deadline"
  ]) {
    const entry = result?.[field];

    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.value !== "string") continue;

    if (
      typeof entry.evidence === "string" &&
      raw.includes(entry.evidence)
    ) continue;

    let evidence = null;

    if (field === "startsAt" || field === "deadline") {
      evidence = findDateEvidence(raw, entry.value, field);
    } else if (field === "category") {
      const categoryWords = {
        academic: /학사|수강|등록|졸업/,
        scholarship: /장학금|장학생/,
        campus: /교내|캠퍼스|학생\s*행사/,
        external: /대외|외부|공모전/,
      };

      const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const pattern = categoryWords[entry.value];

      const matches = pattern
        ? lines.filter(line => pattern.test(line))
        : [];

      const explicit = matches.filter(
        line => /^(?:분류|구분|카테고리)\s*[:：]/.test(line)
      );

      if (explicit.length === 1) {
        evidence = explicit[0];
      } else if (explicit.length === 0 && matches.length === 1) {
        evidence = matches[0];
      } else {
        evidence = null;
      }
    } else {
      evidence = findTextEvidence(raw, entry.value, field);
    }

    entry.evidence = evidence;
  }

  return result;
}
