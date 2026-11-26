/*
 * 학교 행사 창(eventOverlay.js)에서 쓰는 순수 함수입니다(화면 · CSS 없이 테스트할 수 있게 따로 둠).
 */

// 출처 종류(shared/events.js sourceType · 학생 제보 "crowd") → 배지 문구 키(src/state.js). 모르는 값이면 null(배지 없음).
// crowd는 팀 확인 여부(confirmed)에 따라 "학생 제보 R명 · 미확인" / "학생 제보 R명 · 팀 확인"(문구의 {count}에 제보자 수).
const SOURCE_BADGE_KEY = { school: "eventSourceSchool", sns: "eventSourceSns", host: "eventSourceHost", crowd: "eventSourceCrowd" };
export const sourceBadgeKey = (sourceType, confirmed = false) => {
  if (!Object.hasOwn(SOURCE_BADGE_KEY, sourceType)) return null;
  return sourceType === "crowd" && confirmed === true ? "eventSourceCrowdChecked" : SOURCE_BADGE_KEY[sourceType];
};

// 배지 글자. t는 src/state.js의 t(테스트에서도 같은 함수를 넘김). 배지가 없으면 null.
export function sourceBadgeText(item, t) {
  const key = sourceBadgeKey(item?.sourceType, item?.confirmed);
  if (!key) return null;
  return item.sourceType === "crowd" ? t(key, { count: Math.max(0, Number(item.reporters) || 0) }) : t(key);
}

// 영어 화면에서 학생 제보(원문 한국어 그대로)면 제목 아래 "Original text (Korean)"를 붙입니다.
export const showOriginalNote = (item, lang) => lang === "en" && item?.sourceType === "crowd";

// "행사 제보하기" 링크 주소. https://로 시작할 때만 그 주소를, 아니면(빈 값 포함) null을 돌려줍니다(링크를 그리지 않음).
export const reportLinkUrl = (url) => (typeof url === "string" && url.startsWith("https://") ? url : null);
