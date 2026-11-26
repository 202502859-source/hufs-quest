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

  // 신청 가능 여부를 단순 키워드만으로 판단하지 않음.
  if (c.id === "C11") {
    const denied =
      /신청[^.!?;]{0,25}(?:불가|불가능|수\s*없|안\s*됩|안\s*돼|못)/.test(text) ||
      /신청\s*못/.test(text) ||
      /(?:조기\s*졸업|대상자)[^.!?;]{0,30}(?:불가|불가능)/.test(text);

    return denied;
  }

  // 예비수강신청과 실제 수강신청을 구분함.
  if (c.id === "C15") {
    const required =
      /(?:별도(?:로|의)?|반드시|직접|다시)[^.!?;]{0,40}신청[^.!?;]{0,30}(?:해야|하여야|필수|필요)/.test(text) ||
      /수강신청[^.!?;]{0,40}(?:별도|직접|다시)[^.!?;]{0,30}(?:해야|하여야|필수|필요)/.test(text);

    const falseAutomatic =
      /자동(?:으로)?\s*(?:완료됩니다|완료돼요|완료됨)/.test(text);

    return required && !falseAutomatic;
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
