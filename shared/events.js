/*
 * 학교 행사 목록 — 팀이 원문을 직접 열어 보고 손으로 입력합니다(마감 임박 공지 shared/deadlines.js와 같은 원칙).
 * - 게시판 · SNS 자동 수집 금지. AI가 행사 내용을 만들거나 요약하지 않습니다(summary는 원문 표현 그대로 한두 줄).
 * - 서버(api/events.js)와 화면(src/data/eventsApi.js)이 shared/eventCalc.js로 "오늘부터 14일 안 · 진행 중" 행사만 골라 씁니다.
 * - 형식 · 출처 규칙은 tests/events.test.js가 확인합니다(npm test). 규칙 함수: shared/eventCalc.js eventProblems
 *
 * 항목 형식
 *   id: "evt-2026-12-festival"          // 겹치지 않는 영문 id
 *   title: { ko, en }                    // 행사명
 *   host: { ko, en }                     // 행사 주체(총학생회 · 학과 학생회 · 부서 등). 사람 이름 금지
 *   summary: { ko, en }                  // 행사 내용 한두 줄(원문 표현 기준)
 *   startsAt / endsAt: "2026-12-01T10:00:00+09:00"   // 반드시 +09:00
 *   place: { ko, en }, buildingId?: "union"          // buildingId는 src/data/buildingInfo.js의 id(지도에서 보기)
 *   target?: { ko, en }, signup?: { ko, en }, note?: { ko, en }
 *   category: "festival" | "briefing" | "lecture" | "recruit" | "other"   // 축제 · 설명회 · 특강 · 모집 · 기타
 *   sourceType: "school"  // 학교 · 학과 홈페이지 공지        → url 필수(*.hufs.ac.kr)
 *             | "sns"     // 학과 · 학생회 공식 공개 SNS 게시물 → url 필수(공식 계정의 공개 게시물 주소만, 개인 계정 금지)
 *             | "host"    // 주최 측이 직접 주고 게시를 허락한 정보 → url 없어도 됨, hostConsent: { on: "YYYY-MM-DD" } 필수
 *   url?: "https://…"
 *   hostConsent?: { on: "YYYY-MM-DD" }  // 주최 측이 게시를 허락한 날
 *   checked: { on: "YYYY-MM-DD", by: "확인한 팀원" }   // by는 서버 응답 · 화면에 내보내지 않습니다
 *
 * 넣지 않는 것: 비공개 단톡방 공지(허락 없이), 담당자 이름 · 전화번호 · 이메일, 오픈채팅 · 카카오 링크, 카톡 캡처.
 */
export const EVENTS = [];
