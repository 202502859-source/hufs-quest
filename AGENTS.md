# AGENTS.md

Cursor 등 AI 코딩 도구용 안내입니다. 규칙의 원본은 `CLAUDE.md`와 `docs/ROADMAP.md`입니다.

## 작업 전에

1. `CLAUDE.md`를 읽고 구조·명령·규칙을 따른다.
2. `docs/ROADMAP.md`에서 이 작업이 어느 항목인지, 담당자가 누구인지, 범위 밖 기능은 아닌지 확인한다.

## 꼭 지킬 것

- API 키와 `.env`는 읽거나 고치거나 커밋하지 않는다. 키는 `src/`나 `VITE_` 변수에 넣지 않는다.
- `npm run ingest`는 실제 서비스 DB를 바꾸므로 사용자가 요청할 때만 실행한다.
- 범위 밖 경로(`public/planner/`, `src/ui/plannerOverlay.js`, `src/scenes/MockRegScene.js`, `teammate/`)는 수정하지 않는다.
- 다른 사람 담당 경로를 고쳐야 하면 먼저 사용자에게 알린다.
- 12/2 기능 동결 이후에는 버그 수정만 한다.
- Windows PowerShell에서는 `npm` 대신 `npm.cmd`를 쓴다.
