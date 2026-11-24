# ⚡ 검색창 답변 캐시 설계안 (초안)

> 작성: 임현규 (2026-11-23) · 리뷰: 이종헌
> 상태: **리뷰 피드백 반영 완료 (Merge 대기)** — 이 문서 Merge 후 SQL을 함께 실행하고 `feat/answer-cache` 브랜치에서 구현을 시작합니다.

## 1. 목적과 기본 원칙

- 같은 학사 질문이 반복될 때 CLOVA 임베딩 · LLM 호출을 줄여 **응답 속도를 높이고 API 비용(NCP 크레딧 차감)을 절감**합니다.
- **개인정보 비저장 원칙 유지:** 원문 질문 · 답변 로그 · 사용자 ID · IP는 캐시 테이블이나 Vercel 로그에 남기지 않습니다. 캐시 조회 키는 단방향 해시(`SHA-256`)만 사용합니다.
- **eval 요청 제외:** `isEvalRequest(req)`가 참(`x-ask-eval-token` 일치)인 요청은 **캐시 조회와 저장을 모두 건너뛰어** 실제 모델 · 검색 정확도를 측정합니다.
- **유효 기간(TTL):** 생성 시각으로부터 **24시간**입니다.

## 2. 핵심 설계 (확정 항목)

### ① 비우는 시점 (Invalidation)
- **언제 비우나:** 마감 공지(`shared/deadlines.js`)는 검색창 답변에 쓰이지 않으므로 공지 수정 시에는 비우지 않고, **학교 학사 문서를 DB에 다시 적재할 때(`npm run ingest`)** 비웁니다.
- **어떻게 처리하나 (이중 안전장치):**
  1. **DB 함수 내부에서 `data_version` 비교 (DB 왕복 1회 절약):** `api/ask.js`가 요청마다 `data_version`을 따로 읽지 않고, `get_answer_cache(p_cache_key)`와 `set_answer_cache(...)` 내부에서 `answer_cache_meta(id = 1)`의 현재 `data_version`과 직접 비교·저장합니다.
  2. **`npm run ingest` 완료 시 자동 정리:** `scripts/ingest.mjs`가 실서비스 `chunks` 테이블(`TABLE === "chunks"`, `--dry-run` 아님)의 업서트와 옛 조각 삭제를 **모두 성공적으로 마친 직후**, `bump_answer_cache_version`을 호출해 버전을 갱신하고 이전 버전 캐시를 삭제합니다. (`--target next` 시험 적재 시에는 실서비스 캐시를 건드리지 않습니다.)

### ② 저장 위치 및 스키마 (`supabase/006_answer_cache.sql`)
- **테이블:** `public.answer_cache` (캐시 본문), `public.answer_cache_meta` (현재 데이터 버전 1행)
- **보안(RLS):** 두 테이블 모두 RLS를 활성화하고 정책을 만들지 않으며, `anon` · `authenticated` 권한을 회수하여 **서버 함수(`service_role`)만** 읽고 씁니다.
- **실행 시점:** 이 문서(#52) Merge 후 Supabase SQL Editor에서 함께 실행합니다.

| 테이블 | 열 이름 | 타입 | 설명 |
| --- | --- | --- | --- |
| `answer_cache` | `cache_key` (PK) | `text` | `sha256(lang + ":" + normalizedQuestion)` (소문자 16진수 64자) |
| `answer_cache` | `lang` | `text` | 응답 언어 (`ko` / `en`) |
| `answer_cache` | `answer` | `text` | 검증을 통과한 AI 답변 본문 |
| `answer_cache` | `sources` | `jsonb` | 출처 배열 `[{ title, url, refs }]` |
| `answer_cache` | `data_version` | `text` | 저장 시점의 `answer_cache_meta.data_version` |
| `answer_cache` | `created_at` | `timestamptz` | 생성 시각 (`now()`) |
| `answer_cache` | `expires_at` | `timestamptz` | 만료 시각 (`created_at + interval '24 hours'`) |

### ③ 캐시 키 생성 규칙
같은 질문이라도 한국어·영어 답변이 다르므로 언어를 포함하며, 버전 비교는 DB 함수가 담당하므로 키는 언어와 정규화 질문만으로 만듭니다.

1. **질문 정규화 (`normalizeQuestion`):** 앞뒤 공백 제거(`trim`), 연속 공백·줄바꿈 단일 공백 치환, 문장 끝 물음표(`?`, `？`) 및 마침표 연속 제거, 영문 소문자 변환(`toLowerCase()`)
2. **언어 결정:** `answerLanguage(question, body.lang)`로 확정된 최종 응답 언어(`ko` 또는 `en`)
3. **해시 계산:** `cacheKey = sha256(`${lang}:${normalizedQuestion}`)`

### ④ 저장 조건 및 날짜 의존 질문 제외
- **저장하는 답:** `mode === "ai"` 이고 `truncated === false` 인 답변만 저장합니다. `ungroundedDates` 및 `unsupportedNumbers` 검사를 모두 통과해 실제 `200` 응답으로 나가는 답만 대상입니다.
- **저장하지 않는 답:** `mode: "evidence"` (근거 원문 폴백), `mode: "none"` (찾지 못함 / `guard` 차단), `truncated: true` (토큰 상한 400 잘림), `429` (`mode: "limited"`), `500` · 타임아웃 오류.
- **날짜·시점에 따라 달라지는 질문 제외 (`shared/academicDate.js` 재사용):**
  - 현재 `shared/academicDate.js`의 `todayContext()`가 시스템 프롬프트에 오늘 날짜와 현재 학기를 주입하므로, 아래 상대 시점 표현이 포함된 질문은 **캐시 조회와 저장을 모두 건너뜁니다.**
  - `shared/academicDate.js`에 순수 함수 `hasTimeSensitiveWords(question)`를 추가해 `api/ask.js`와 단위 테스트에서 재사용합니다.
  - **영어 표현 단어 경계 처리:** 영어 시간 표현은 반드시 단어 경계(`\b...\b`, 대소문자 무시)로 검사하여 `now`가 `know` 같은 단어 안에서 오탐되지 않게 합니다.
  - **제외 표현 목록:**
    - **일·주·현재 (한국어):** 오늘, 어제, 내일, 모레, 금일, 명일, 이번 주, 이번주, 금주, 다음 주, 다음주, 차주, 지난 주, 지난주, 전주, 요즘, 최근, 지금, 현재, 당장
    - **월·학기·연도 상대 표현 (한국어):** 이번 달, 이번달, 이달, 금월, 다음 달, 다음달, 내월, 익월, 지난 달, 지난달, 전월, 이번 학기, 이번학기, 금학기, 현학기, 다음 학기, 다음학기, 차기 학기, 지난 학기, 지난학기, 전학기, 올해, 금년, 내년, 명년, 작년, 전년
    - **진행·마감 상태 (한국어):** 마감됐, 마감했, 끝났, 지났, 남았, 신청 가능, 접수 중, 진행 중
    - **영어 (`\b...\b` 단어 경계 매칭):** `today`, `yesterday`, `tomorrow`, `this week`, `next week`, `last week`, `now`, `currently`, `right now`, `recent`, `recently`, `this month`, `next month`, `last month`, `this semester`, `next semester`, `last semester`, `this year`, `next year`, `last year`, `still open`, `deadline passed`, `days left`, `ongoing`

### ⑤ 사용량 한도(`api/_lib/usageLimit.js`)와의 관계
- **캐시 적중 시 1차 메모리 1분 한도(`memory-first`)만 적용:** DB의 `ask_hit` 함수는 1분 · 하루 · 전체 카운터를 한 번에 증가시키므로, 캐시 적중 시에는 `ask_hit`을 호출하지 않고 **1차 메모리 제한(인스턴스별 1분 10회)만** 확인해 연타를 막습니다. 따라서 하루 한도(`day: 50`, `guestDay: 150`)와 서비스 전체 하루 한도(`globalDay: 500`)는 차감되지 않습니다.
- **처리 순서 (`api/ask.js`):**
  1. 질문 길이(200자) · 언어 판별 · `eval` 여부(`isEvalRequest`) 확인
  2. `eval`이 아니면 **1차 메모리 1분 한도 확인** (초과 시 `429` 반환)
  3. `eval`이 아니고 날짜 의존 질문이 아니면 **캐시 조회 (`get_answer_cache`)**
     - **적중(`cacheHit: true`):** `ask_hit` 없이 즉시 `200 { mode: "ai", answer, sources }` 반환 (로그: `cacheHit: true`, `limit: "memory-first"`)
     - **미적중(`cacheHit: false`) 또는 건너뜀:** 기존 `checkAskLimit`으로 DB 공용 한도 확인 후 RAG + CLOVA 호출 → `eval`이 아니고 저장 조건 충족 시 `set_answer_cache`로 저장 (로그: `cacheHit: false`)

## 3. 구현 및 검증 계획 (Merge 후 진행)

1. `#52` 문서 Merge 후 Supabase SQL Editor에서 `supabase/006_answer_cache.sql` 함께 실행 및 RLS · 권한 확인
2. 최신 `main`에서 `feat/answer-cache` 브랜치 생성
3. `shared/academicDate.js`, `api/_lib/answerCache.js`, `api/ask.js`, `scripts/ingest.mjs` 구현
4. 단위 테스트 추가 (`node --test`): 캐시 키 정규화 · 언어 분리(`ko`/`en`), `eval` 우회, 저장 조건(`mode: "ai"` && `truncated: false`만 허용), 영어 단어 경계(`know` 통과 / `now` 제외) 검증
5. Preview 배포에서 동일 질문 2회 호출 비교표(`cacheHit: false` -> `true`, 응답 시간 `ms` 단축) 확인 후 12/2 기능 동결 전 Merge
