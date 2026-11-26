/*
 * 학교 행사 창(eventOverlay.js)에서 쓰는 순수 함수입니다(화면 · CSS 없이 테스트할 수 있게 따로 둠).
 */

// 출처 종류(shared/events.js sourceType) → 배지 문구 키(src/state.js). 모르는 값이면 null(배지 없음).
const SOURCE_BADGE_KEY = { school: "eventSourceSchool", sns: "eventSourceSns", host: "eventSourceHost" };
export const sourceBadgeKey = (sourceType) => (Object.hasOwn(SOURCE_BADGE_KEY, sourceType) ? SOURCE_BADGE_KEY[sourceType] : null);

// "행사 제보하기" 링크 주소. https://로 시작할 때만 그 주소를, 아니면(빈 값 포함) null을 돌려줍니다(링크를 그리지 않음).
export const reportLinkUrl = (url) => (typeof url === "string" && url.startsWith("https://") ? url : null);
