// core-1126 문항별 추가 채점 조건.
// 기존 legacy 문항의 채점 방식에는 영향을 주지 않습니다.

export function checkCoreAnswer(c, answer) {
  if (c.set !== "core-1126") {
    return true;
  }

  const text = String(answer || "")
    .replace(/\s+/g, " ");

  const dates = {
    C01: [[3, 3], [3, 9]],
    C02: [[6, 16], [6, 22]],
    C03: [[8, 10], [8, 14]],
    C04: [[9, 1]],
    C05: [[12, 15], [12, 21]],
    C06: [[12, 28], [1, 4]],
    C07: [[2, 10], [2, 12]]
  };

  if (dates[c.id]) {
    let remaining = text;

    for (const [i, [month, day]] of dates[c.id].entries()) {
      const m = `0?${month}`;
      const d = `0?${day}`;

      const full =
        `(?:^|[^\\d])${m}\\s*(?:월\\s*|[./-]\\s*)${d}(?!\\d)`;

      const short = `(?:^|[^\\d])${d}\\s*일`;

      const pattern = i > 0 &&
        dates[c.id][i - 1][0] === month
        ? `${full}|${short}`
        : full;

      const match = new RegExp(pattern).exec(remaining);

      if (!match) return false;

      remaining = remaining.slice(
        match.index + match[0].length
      );
    }

    return true;
  }

  if (c.id === "C20") {
    const allCancelDenied =
      /(?:전체\s*과목|모든\s*과목|전\s*과목|전부)[^.!?;]{0,40}(?:불가|없|안\s*됩|안\s*돼|안\s*됨|못)/.test(text);

    return allCancelDenied;
  }

  if (c.id === "C09") {
    const correct24 =
      /(?:2024|24)\s*학번(?:(?!(?:2025|25)\s*학번)[^.!?;]){0,60}?34\s*학점/.test(text);

    const correct25 =
      /(?:2025|25)\s*학번(?:(?!(?:2024|24)\s*학번)[^.!?;]){0,60}?32\s*학점/.test(text);

    const swapped24 =
      /(?:2024|24)\s*학번(?:(?!(?:2025|25)\s*학번)[^.!?;]){0,60}?32\s*학점/.test(text);

    const swapped25 =
      /(?:2025|25)\s*학번(?:(?!(?:2024|24)\s*학번)[^.!?;]){0,60}?34\s*학점/.test(text);

    return correct24 && correct25 &&
      !swapped24 && !swapped25;
  }

  return true;
}
