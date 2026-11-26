// 평가 인증정보가 잘못된 주소로 전송되지 않도록 검사합니다.

const PRODUCTION = "https://hufs-quest.vercel.app";

function parseOrigin(value) {
  const url = new URL(value);

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("평가 주소는 HTTPS origin 형식이어야 합니다.");
  }

  return url.origin;
}

export function validateEvalTarget(
  base,
  trustedPreview = ""
) {
  const origin = parseOrigin(base);

  if (origin === PRODUCTION) {
    return origin;
  }

  if (
    !trustedPreview ||
    origin !== parseOrigin(trustedPreview)
  ) {
    throw new Error("승인된 Preview 주소가 아닙니다.");
  }

  return origin;
}
