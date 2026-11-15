# 캠퍼스 퀘스트 (본선 시연용 프로토타입)

한국외대 서울캠퍼스를 걸어 다니며 학사 정보를 익히는 웹 게임입니다. 설치와 빌드 없이 Phaser 3로 동작합니다.

## 실행

Windows PowerShell에서 이 폴더를 연 뒤 실행하고, 브라우저에서 http://localhost:8123 을 엽니다.

```bash
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Phaser와 글꼴을 CDN에서 받으므로 인터넷 연결이 필요합니다. 발표장 인터넷이 불안하면 두 파일을 내려받아 `index.html`의 주소를 바꾸세요.

조작: 방향키 또는 WASD로 이동, E 또는 스페이스로 상호작용, Q 퀘스트, M 지도, V 행사, T 스탬프. 터치 기기에는 화면 버튼이 나옵니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `js/kb.js` | 학사 지식 베이스. 항목마다 출처가 있습니다 |
| `js/retrieval.js` | 질문에 맞는 근거 검색 (브라우저와 서버 공용) |
| `js/data.js` | 건물, NPC, 퀘스트, 행사, 교환소, 화면 문구 (한/영) |
| `js/tiles.js` | 도트 그래픽과 Tiled 형식 맵 생성 |
| `js/game.js` | 이동, 충돌, 건물 진입 (Phaser 장면) |
| `js/state.js` | 저장, 포인트, 퀘스트 진행, 행사 |
| `js/ui.js` | HUD와 모든 창 |
| `api/npc.js` | HyperCLOVA X 연결 서버 함수 (Vercel용, 실제 호출 미검증) |

## 실제 서비스로 바꿀 때

- **AI NPC:** Vercel에 배포하고 환경 변수 `CLOVA_API_KEY`를 넣은 뒤 `js/config.js`의 `npcEndpoint`를 `"/api/npc"`로 바꿉니다. 키는 브라우저 코드에 넣지 마세요.
- **Tiled 맵:** 주소 끝에 `?dev=1`을 붙이고 지도 창의 "Tiled 맵 내보내기"로 맵과 타일 이미지를 받습니다. Tiled에서 수정한 뒤 `assets/campus.tmj`로 저장하면 그 파일을 우선해서 읽습니다. 건물을 옮길 때는 `places` 객체 레이어의 위치도 함께 옮기세요.
- **포인트:** 지금은 브라우저에 저장되어 누구나 값을 바꿀 수 있습니다. 실제 상품을 걸기 전에 지급과 일일 상한 검사를 Supabase 서버 쪽으로 옮겨야 합니다.
- **행사:** `js/state.js`의 `Events.init`, `Events.add`를 Supabase Realtime 구독과 저장으로 바꿉니다.

## 데이터 출처와 주의

- 건물 이름과 좌표: [공식 캠퍼스맵](https://www.hufs.ac.kr/campusMap/hufs/view.do)
- 졸업학점: [졸업이수학점](https://www.hufs.ac.kr/hufs/11373/subview.do)
- 이중전공: [이중전공 안내](https://envi.hufs.ac.kr/hufs/11384/subview.do)
- 수강신청: [수강신청지침](https://www.hufs.ac.kr/hufs/11377/subview.do)

2026-11-08 기준 자료입니다. 다음 항목은 시연용 가정이며 실제 정보가 아닙니다.

- 건물 내부 배치, NPC 위치, 도로 모양 (건물의 상대 위치만 실제 좌표 기준)
- 행사, 교환소 상품, 모의 수강신청 과목 (화면에 샘플, 시연, 가상으로 표시)
