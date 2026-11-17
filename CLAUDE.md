# CLAUDE.md

## 프로젝트

한국외대 서울캠퍼스를 배경으로 한 레트로 탑다운 도트 RPG 스타일의 학사정보 웹 게임.
2026 AI 캠퍼스 바이브코딩 경진대회 본선 출품작 (팀 404 Not Found). 배포: https://hufs-quest.vercel.app

## 작업 전에 반드시 읽을 것

- **`docs/ROADMAP.md`** — 본선 우선순위, 담당자, 마감, 범위 밖 기능. 작업이 로드맵의 어느 항목인지 확인하고 시작한다.
- 요청이 로드맵의 '범위 밖' 기능이거나 🔴 항목보다 우선순위가 낮으면, 진행하기 전에 사용자에게 한 번 알린다.
- 12/2(기능 동결) 이후에는 새 기능을 만들지 않고 버그 수정만 한다.

## 기술

Phaser 3 + Vite, JavaScript. 서버 함수는 Vercel(`api/`), DB는 Supabase, AI는 네이버클라우드 CLOVA Studio(HyperCLOVA X).

## 구조

| 경로 | 내용 | 담당 |
| --- | --- | --- |
| `index.html`, `src/main.js`, `src/scenes/`, `src/ui/`, `src/gfx/` | 게임 장면, 화면 UI, 도트 그래픽 | 이종헌 |
| `src/data/campus.js`, `src/data/npcs.js`, `src/quizBoxes.js` | 캠퍼스 맵 데이터, 퀴즈 상자 배치 | 이종헌 |
| `src/state.js`, `src/quizProgress.js` | 게임 상태(경험치·포인트·퀴즈 기록). 지금은 메모리에만 저장 | 이종헌 · 임현규 공동 |
| `src/ui/searchBar.js` → `src/data/askApi.js` → `api/ask.js` | 빠른 검색창. 벡터 검색(Supabase + CLOVA 임베딩 v2) → 없으면 `shared/kb.js` 키워드 검색 → HCX-005 답변 + 출처 링크 | 신중혁 |
| `scripts/`, `data/chunks.json` | 학사 페이지 수집·임베딩·정확도 테스트 | 신중혁 |
| `src/data/quiz.js` | O/X 퀴즈 60문항 (문항마다 출처 URL) | 신중혁 |
| `shared/deadlines.js`, `shared/deadlineCalc.js`, `api/deadlines.js` | 마감 임박 공지. 데이터는 손으로 입력 (게시판 크롤링 금지) | 임현규 |
| `supabase/`, 새 `api/*` | DB 스키마, 로그인, 진행 저장, 행사 | 임현규 |
| `campus-map/` | 이전 프로토타입. 배포 안 됨. 건물 진입·Tiled·행사 로직 참고용 | 참고만 |
| `public/planner/`, `src/ui/plannerOverlay.js`, `src/scenes/MockRegScene.js`, `teammate/` | 범위 밖(수강신청 추천·모의 수강신청). 수정하지 않는다 | — |

다른 사람 담당 경로를 고쳐야 하면, 고치기 전에 사용자에게 어떤 파일을 왜 바꾸는지 알린다.

## 명령

- 실행: `npm run dev` → http://localhost:5173 (Windows PowerShell에서는 `npm.cmd run dev`)
- 로컬에는 서버 함수가 없어 검색창은 "AI 연결 없이 찾은 원문" 모드로만 동작한다. AI 답변은 PR의 Vercel Preview 링크에서 확인한다.
- 학사 페이지 추가: `scripts/urls.txt`에 한 줄 추가 → `npm run collect` → `npm run ingest`
- 정확도 테스트: `npm run eval`
- **`npm run ingest`는 실제 서비스 DB를 바꾼다.** 사용자가 명시적으로 요청할 때만 실행한다.

## 규칙

- 화면 크기는 960x540, 도트 그래픽이 선명하도록 `pixelArt` 설정을 유지한다.
- 포켓몬 등 기존 게임의 캐릭터·UI·이름은 쓰지 않고 오리지널 디자인으로 만든다. 외부 에셋은 라이선스를 확인하고 출처를 기록한다.
- API 키(`CLOVA_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`)는 Vercel 환경 변수와 `.env`에만 둔다. `src/` 코드나 `VITE_` 변수에 넣지 않는다. `.env`는 읽거나 고치거나 커밋하지 않는다.
- 저장소는 공개 상태다. 키, 개인 연락처, 학번을 코드·문서·커밋에 넣지 않는다.
- 학교 홈페이지는 robots.txt가 허용하는 페이지만 수집한다. 공지 게시판은 자동 수집하지 않는다.
- 학사 정보를 화면이나 퀴즈에 넣을 때는 항상 원문 출처 URL을 함께 둔다. 근거 없는 숫자·날짜를 지어내지 않는다.
- `main`에 직접 커밋·push하지 않는다. 기능별 브랜치(`feat/...`, `fix/...`)에서 작업한다.
- 한 번에 한 기능씩 만들고, 끝나면 확인 방법을 알려준다.
- 로드맵 항목을 끝냈으면 `docs/ROADMAP.md`의 상태와 체크박스를 같이 고친다.
