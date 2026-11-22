# ⚡ 검색창 답변 캐시 설계안 (초안)

> 작성: 임현규 (2026-11-23) · 리뷰: 이종헌
> 상태: **초안 (구현 전 리뷰 대기)** — 이 문서가 확정되고 #50(출력 상한 400) Merge 이후 feat/answer-cache 브랜치에서 구현을 시작합니다.

## 1. 목적과 기본 원칙

- 같은 학사 질문이 반복될 때 CLOVA 임베딩 · LLM 호출을 줄여 **응답 속도를 높이고 API 비용(11/25 유료 과금)을 절감**합니다.
- **개인정보 비저장 원칙 유지:** 원문 질문 · 답변 로그 · 사용자 ID · IP는 캐시 테이블이나 Vercel 로그에 남기지 않습니다. 캐시 조회 키는 단방향 해시(SHA-256)만 사용합니다.
- **유효 기간(TTL):** 생성 시각으로부터 **24시간**입니다.

## 2. 핵심 설계 (5가지 확정 항목)

### ① 비우는 시점 (Invalidation)
- **언제 비우나:** 마감 공지(shared/deadlines.js)는 검색창 답변에 쓰이지 않으므로 공지 수정 시에는 비우지 않고, **학교 학사 문서를 DB에 다시 적재할 때(npm run ingest)** 비웁니다.
- **어떻게 처리하나 (이중 안전장치):**
  1. **데이터 버전 값(dataVersion)을 캐시 키에 포함:** answer_cache_meta 테이블(단일 행 id = 1)에 현재 data_version(예: ingest 완료 시각 ISO 문자열)을 저장합니다. api/ask.js가 조회하는 캐시 RPC가 현재 data_version을 함께 검증하므로, 문서 버전이 바뀌면 기존 캐시는 즉시 미적중(cacheHit: false) 처리됩니다.
  2. **npm run ingest 완료 시 자동 정리:** scripts/ingest.mjs가 실서비스 chunks 테이블(TABLE === "chunks", --dry-run 아님)의 업서트와 옛 조각 삭제를 **모두 성공적으로 마친 직후**, answer_cache_meta.data_version을 갱신하고 answer_cache의 기존 행을 삭제(DELETE)합니다. (--target next 시험 적재 시에는 실서비스 캐시를 건드리지 않습니다.)

### ② 저장 위치 및 스키마 (supabase/006_answer_cache.sql)
- **테이블:** public.answer_cache (캐시 본문), public.answer_cache_meta (현재 데이터 버전 1행)
- **보안(RLS):** 두 테이블 모두 RLS를 활성화하고 정책을 만들지 않으며, anon · authenticated 권한을 회수하여 **서버 함수(service_role)만** 읽고 씁니다.
- **실행 시점:** SQL 파일은 supabase/006_answer_cache.sql에 먼저 두고, **이 문서 합의("진행") 후 Supabase SQL Editor에서 실행**합니다.

| 테이블 | 열 이름 | 타입 | 설명 |
| --- | --- | --- | --- |
| answer_cache | cache_key (PK) | text | SHA-256 소문자 16진수 64자 |
| answer_cache | lang | text | 응답 언어 (ko / en) |
| answer_cache | answer | text | 검증을 통과한 AI 답변 본문 |
| answer_cache | sources | jsonb | 출처 배열 [{ title, url, refs }] |
| answer_cache | data_version | text | 생성 시점의 chunks 데이터 버전 |
| answer_cache | created_at | timestamptz | 생성 시각 (now()) |
| answer_cache | expires_at | timestamptz | 만료 시각 (created_at + 24시간) |

### ③ 캐시 키 생성 규칙
같은 질문이라도 한국어·영어 답변이 다르므로 언어를 반드시 포함합니다.

1. **질문 정규화 (normalizeQuestion):** 앞뒤 공백 제거(trim), 연속 공백·줄바꿈 단일 공백 치환, 문장 끝 물음표(? · ？) 및 마침표 연속 제거, 영문 소문자 변환(toLowerCase())
2. **언어 결정:** answerLanguage(question, body.lang)로 확정된 최종 응답 언어(ko 또는 en)
3. **해시 계산:** cacheKey = sha256(dataVersion + ":" + lang + ":" + normalizedQuestion)

### ④ 저장 조건 및 날짜 의존 질문 제외
- **저장하는 답:** mode === "ai" 이고 truncated === false 인 답변만 저장합니다. ungroundedDates 및 unsupportedNumbers 검사를 모두 통과해 실제 200 응답으로 나가는 답만 대상입니다.
- **저장하지 않는 답:** mode: "evidence" (근거 원문 폴백), mode: "none" (찾지 못함 / guard 차단), truncated: true (토큰 상한 400 잘림), 429 (mode: "limited"), 500 · 타임아웃 오류.
- **날짜·시점에 따라 달라지는 질문 제외 (shared/academicDate.js 재사용):**
  - 현재 shared/academicDate.js의 todayContext()가 시스템 프롬프트에 오늘 날짜와 현재 학기를 주입하므로, 아래 상대 시점 표현이 포함된 질문은 **캐시 조회와 저장을 모두 건너뜁니다.**
  - shared/academicDate.js에 순수 함수 hasTimeSensitiveWords(question)를 추가해 api/ask.js와 단위 테스트에서 재사용합니다.
  - **제외 표현 목록:**
    - **일·주·현재:** 오늘, 어제, 내일, 모레, 금일, 명일, 이번 주, 이번주, 금주, 다음 주, 다음주, 차주, 지난 주, 지난주, 전주, 요즘, 최근, 지금, 현재, 당장 / today, yesterday, tomorrow, this week, next week, last week, now, currently, right now, recent, recently
    - **월·학기·연도 상대 표현:** 이번 달, 이번달, 이달, 금월, 다음 달, 다음달, 내월, 익월, 지난 달, 지난달, 전월, 이번 학기, 이번학기, 금학기, 현학기, 다음 학기, 다음학기, 차기 학기, 지난 학기, 지난학기, 전학기, 올해, 금년, 내년, 명년, 작년, 전년 / this month, next month, last month, this semester, next semester, last semester, this year, next year, last year
    - **진행·마감 상태:** 마감됐, 마감했, 끝났, 지났, 남았, 신청 가능, 접수 중, 진행 중 / still open, deadline passed, days left, ongoing

### ⑤ 사용량 한도(api/_lib/usageLimit.js)와의 관계
- **1분 한도(minute: 10)는 센다:** 연타 및 매크로 도배 방지 (1차 메모리 제한 + DB 분당 카운터 적용).
- **하루 한도(day: 50, guestDay: 150)와 서비스 전체 하루 한도(globalDay: 500)는 세지 않는다:** 캐시 적중 시 CLOVA 임베딩 · 채팅 API를 호출하지 않아 과금이 발생하지 않기 때문입니다.
- **처리 순서 (api/ask.js):**
  1. 질문 길이(200자) · 언어 판별
  2. **1분 연타 한도 확인** (초과 시 429 반환)
  3. 날짜 의존 질문이 아니면 **캐시 조회**
     - **적중(cacheHit: true):** 하루 · 전체 한도를 차감하지 않고 즉시 200 { mode: "ai", answer, sources } 반환 (로그: cacheHit: true)
     - **미적중(cacheHit: false):** 기존 checkAskLimit으로 하루 · 전체 한도 확인 후 RAG + CLOVA 호출 → 저장 조건 충족 시 캐시에 저장 (로그: cacheHit: false)

## 3. 구현 및 검증 계획 (합의 후 진행)

1. #50(출력 상한 400) Merge 확인 후 최신 main에서 feat/answer-cache 브랜치 생성
2. supabase/006_answer_cache.sql 실행 및 RLS · 권한 확인
3. shared/academicDate.js, api/_lib/answerCache.js, api/ask.js, scripts/ingest.mjs 구현
4. 단위 테스트 추가 (node --test): 캐시 키 정규화 · 언어 분리(ko/en), 데이터 버전 변경 시 미적중, 저장 조건(mode: "ai" && truncated: false만 허용), 날짜 의존 표현 제외
5. Preview 배포에서 동일 질문 2회 호출 비교표(cacheHit: false -> true, 응답 시간 ms 단축) 확인 후 12/2 기능 동결 전 Merge
