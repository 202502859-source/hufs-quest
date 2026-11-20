# AGENTS.md

Cursor 등 AI 코딩 도구용 안내입니다. 규칙의 원본은 `CLAUDE.md`, `docs/PRD.md`, `docs/ROADMAP.md`, `docs/OPERATIONS.md`입니다.

## 작업 전에

0. `docs/STATUS.md`를 먼저 읽는다(지금 상태, 열린 PR, 전환 전까지 지킬 것, 사람별 다음 작업).
1. `CLAUDE.md`를 읽고 구조·명령·규칙(보안 규칙, 검증 규칙 포함)을 따른다.
2. `docs/ROADMAP.md`에서 이 작업이 어느 항목인지, `docs/PRD.md`의 '하지 않을 것'에 해당하지 않는지 확인한다.
3. 서버 함수·입력창·DB를 고치면 `docs/OPERATIONS.md` 4장 '배포 전 5분 점검'을 PR 확인 방법에 넣는다.

## 꼭 지킬 것

- API 키와 `.env`는 읽거나 고치거나 커밋하지 않는다. 서버 비밀 키(`CLOVA_API_KEY`, `SUPABASE_SERVICE_KEY`)는 `src/`나 `VITE_` 변수에 절대 넣지 않는다. 예외는 공개용 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`뿐이다(자세한 규칙은 `CLAUDE.md`).
- 사용자 입력과 AI 답변은 `textContent`로만 화면에 넣는다. `innerHTML` 등 HTML을 그대로 넣는 코드를 만들지 않는다.
- AI를 부르는 서버 함수에는 입력 길이·횟수(공용 카운터)·출력 토큰 상한을 둔다.
- `npm run ingest`(대상 지정 없음)는 실제 서비스 DB를 바꾸므로 사용자가 요청할 때만 실행한다. 시험은 `npm run ingest -- --target next`(시험 DB `chunks_next`)로 한다. 지시문·검색 설정을 바꾸거나 ingest한 뒤에는 `npm run eval` 전체를 다시 돌리고, 정답 수가 떨어지면 되돌린다.
- 에러가 나면 원인부터 설명하고, 고치는 방법 2~3개와 장단점을 제안한 뒤 사용자가 고른 방법으로 고친다.
- 범위 밖 경로(`public/planner/`, `src/ui/plannerOverlay.js`, `src/scenes/MockRegScene.js`, `teammate/`)는 수정하지 않는다(숨김 처리용 진입 버튼 코드만 예외).
- 건물 내부 진입, 행사 실시간·등록 폼, 과제 일정 등록, 제3언어는 대회 기간에 만들지 않는다.
- 11/24까지는 유료 서비스가 필요한 방법을 제안하지 않는다.
- 주 담당이 다른 파일도 고칠 수 있다. 멈추고 묻지 말고, 작업이 끝나면 바꾼 파일과 각 파일의 주 담당자를 PR 설명 "작업 기록" 칸에 적는다.
- 모든 작업은 브랜치 → push → PR → Merge로 GitHub에 기록을 남긴다.
- 12/2 기능 동결 이후에는 버그 수정만 한다. 마감 공지 데이터 추가는 예외(팀 검수 후).
- 마감 공지 · 건물 정보 내용은 사람이 원문을 보고 옮긴다. AI가 만들거나 추측해 채우지 않는다.
- Windows PowerShell에서는 `npm` 대신 `npm.cmd`를 쓴다.
