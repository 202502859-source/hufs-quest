# CLAUDE.md

## 프로젝트

한국외대 서울캠퍼스를 배경으로 한 레트로 탑다운 도트 RPG 스타일의 학사정보 웹 게임

## 기술

Phaser 3 + Vite, JavaScript

## 지금 목표

기획서에 넣을 시연용 프로토타입

- 건물 NPC는 없앴고, 화면 맨 위 검색창(src/ui/searchBar.js) → AI 학사 안내원 답변 패널(DialogScene.openAnswer)로 학사 정보를 묻는다.
- 답변 서버 함수는 api/ask.js (Vercel). 벡터 검색(Supabase chunks + CLOVA 임베딩 v2) → 없으면 shared/kb.js 키워드 검색 → HyperCLOVA X(HCX-005) 답변 + 출처 링크.
- 학교 페이지 수집: `npm run collect`(scripts/urls.txt → data/chunks.json) → `npm run ingest`(CLOVA 임베딩 → Supabase chunks 저장, 이번에 없는 옛 조각은 삭제). 학사 페이지를 추가할 땐 urls.txt에 한 줄 넣고 두 명령을 다시 실행한다.
- 로컬 `npm run dev`에는 서버 함수가 없어 브라우저 안 지식 베이스 원문만 보여 준다. 서버 함수까지 확인하려면 `vercel dev`를 쓴다.

## 규칙

- 화면 크기는 960x540으로 하고, 도트 그래픽이 선명하게 보이도록 pixelArt 설정을 사용한다.
- 포켓몬 등 기존 게임의 캐릭터·UI·이름은 절대 쓰지 말고 오리지널 디자인으로 만든다.
- API 키(CLOVA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY)는 Vercel 환경 변수와 .env에만 두고, src 코드나 VITE_ 변수에 절대 넣지 않는다.
- 한 번에 한 기능씩 만들고, 끝나면 실행 방법을 알려준다.
