/*
 * 게임 안 지도 신고("실제와 달라요") 입력 검사 (순수 함수, 서버 api/map-report.js와 화면 src/ui/mapReportOverlay.js가 함께 씁니다)
 * - 연락처 · 카카오 링크 검사는 shared/eventReport.js의 contactProblem · urlProblem을 그대로 씁니다.
 * - 학교 부서 전화번호가 다르다는 신고는 분류 "phone"만 고르고 번호는 쓰지 않습니다(번호를 쓰면 거절).
 * - 거절하면 어떤 칸이 왜 문제인지 코드만 돌려줍니다. 신고 내용은 로그에 남기지 않습니다.
 */
import { contactProblem, urlProblem } from "./eventReport.js";

// 무엇이 다른지: 위치 · 이름 · 운영시간 · 전화번호 · 하는 일 · 기타
export const MAP_REPORT_KINDS = ["location", "name", "hours", "phone", "does", "other"];
export const MAP_REPORT_LIMITS = Object.freeze({ description: 200, url: 300 });
const BUILDING_ID = /^[a-z0-9-]{1,40}$/;

/*
 * input: { buildingId, kind, description, url? }
 * options.buildingIds: 있으면 buildingId가 이 목록(src/data/buildingInfo.js 키)에 있어야 함
 * 통과: { ok: true, value: { buildingId, kind, description, url } } — 앞뒤 공백만 지운 원문, url 없으면 null
 * 거절: { ok: false, problems: [{ field, code }] } — code: required · type · too_long · phone · email · kakao · format · https_only · unknown
 */
export function validateMapReport(input, { buildingIds = null } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, problems: [{ field: "body", code: "type" }] };
  const problems = [];
  const add = (field, code) => problems.push({ field, code });
  const value = {};

  const buildingId = input.buildingId;
  if (buildingId === undefined || buildingId === null || buildingId === "") add("buildingId", "required");
  else if (typeof buildingId !== "string" || !BUILDING_ID.test(buildingId)) add("buildingId", "format");
  else if (buildingIds && !buildingIds.includes(buildingId)) add("buildingId", "unknown");
  else value.buildingId = buildingId;

  if (!MAP_REPORT_KINDS.includes(input.kind)) add("kind", input.kind ? "unknown" : "required");
  else value.kind = input.kind;

  const raw = input.description;
  if (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim())) add("description", "required");
  else if (typeof raw !== "string") add("description", "type");
  else {
    const text = raw.trim();
    if ([...text].length > MAP_REPORT_LIMITS.description) add("description", "too_long");
    const contact = contactProblem(text);
    if (contact) add("description", contact);
    value.description = text;
  }

  const url = typeof input.url === "string" ? input.url.trim() : input.url;
  if (url === undefined || url === null || url === "") value.url = null;
  else if (typeof url !== "string") add("url", "type");
  else {
    const code = urlProblem(url) ?? contactProblem(url);
    if (code) add("url", code);
    else value.url = url;
  }

  if (problems.length) return { ok: false, problems };
  return { ok: true, value };
}
