# 📮 새 공지 알림 → 본문 복사 → AI 초안 → 원문 대조 (사용법)

> 작성: 2026-11-26 · 임현규 (작업지시서 11/26 작업 1) · 규칙의 원본은 [OPERATIONS.md 7장](OPERATIONS.md#7-학교-협의-기록)
> 학교 답신(11/25): 공지 **본문 자동 접근 불가**, robots.txt 허용 범위에서만 자동 이용. 그래서 기계는 **목록 페이지만** 보고, 본문은 사람이 엽니다.

## 한눈에 보기

| 순서 | 누가 | 무엇을 | 어디서 |
| --- | --- | --- | --- |
| 1 | GitHub Actions(자동) | 목록 페이지 4곳에서 제목 · 게시일 · 글 번호만 읽기, 새 글 비교 | `.github/workflows/notice-watch.yml` → `scripts/notice-watch.mjs` |
| 2 | 자동 | 새 글이 있으면 이슈 1개(담당 임현규, 마감 · 행사 후보 체크리스트) | GitHub 이슈 `[공지 알림] …` |
| 3 | **현규** | 목록 페이지에서 글을 클릭해 열고 본문 전체 복사 → `.local/notices/글번호.txt` | 브라우저 · 메모장 |
| 4 | 현규 PC | `npm.cmd run notice:draft -- <파일> <원문 주소>` → AI 초안 · 근거 검사 · `shared/deadlines.js`에 추가(checked 없음) · Draft PR | `scripts/notice-draft.mjs` |
| 5 | **현규** | 비교표를 보고 원문과 한 칸씩 대조, 영문 칸 · `checked: { on, by: "임현규" }` 채우기 | Draft PR 브랜치 |
| 6 | 중혁 → 종헌 | 교차 검수 → Merge | PR |

## 감시하는 목록 페이지 (11/26 robots.txt 확인)

robots.txt(www · student 같은 규칙)는 `/bbs/*`, `/bbs/*/*/*/artclView.do`, `/*/*/subview.do?enc=*` 등을 막습니다. `?enc=` 없는 `/…/숫자/subview.do` 목록 페이지는 막혀 있지 않습니다.

| 게시판 | 목록 주소 |
| --- | --- |
| 공지(일반) | https://www.hufs.ac.kr/hufs/11281/subview.do |
| 학사 | https://www.hufs.ac.kr/hufs/11282/subview.do |
| 장학 | https://www.hufs.ac.kr/hufs/11283/subview.do |
| 학생지원·장학팀 장학(공지) | https://student.hufs.ac.kr/student/12767/subview.do |

- 주소는 `scripts/lib/noticeWatch.mjs`의 `BOARDS`에 고정되어 있고, 다른 주소는 열지 않습니다(`isAllowedListUrl`). 게시판을 늘리려면 robots.txt를 다시 보고 PR로 추가합니다.
- 1쪽만, 페이지 사이 1.5초 간격. 작성자 칸은 읽지 않습니다. 제목이 `[글로벌]`이거나 `(글로벌)`이 들어간 글은 뺍니다(서울캠퍼스 기준).
- 마감 후보 키워드: 신청 · 모집 · 접수 · 마감 · 기한 · 제출 · 선발 / 행사 후보: 특강 · 설명회 · 축제 · 행사 · 공연.

## "이미 본 글"은 어떻게 기억하나

- 처음 기준: `data/notice-seen.json`(11/26 목록 68건). 여기 있는 글은 알림을 보내지 않습니다.
- 그 뒤: 이슈 본문 끝에 `<!-- notice-seen: hufs/2181/272350 -->` 표시를 숨겨 두고, 다음 실행 때 이 스크립트가 만든 이슈(열림 · 닫힘 모두)에서 모읍니다.
- 그래서 Actions에는 **저장소 쓰기 권한이 필요 없습니다**(issues: write, 코드 받기용 contents: read만). main에 자동 커밋하지 않습니다.
- 알림 이슈를 **지우면** 그 글들이 다시 알림으로 옵니다. 지우지 말고 닫아 주세요.

## 현규가 할 일 (알림이 왔을 때)

1. GitHub 앱 알림 → 이슈를 엽니다. 후보 줄의 **[목록에서 열기]**로 목록 페이지에 간 뒤 글을 클릭해 엽니다(원문 주소를 직접 입력하면 막힐 수 있음).
2. 본문 전체를 복사해 `C:\dev\hufs-quest\.local\notices\글번호.txt`에 붙여 넣습니다(UTF-8). `.local/`은 저장소에 올라가지 않습니다.
3. 실행 전에 `git status`가 깨끗한지 확인합니다(커밋 안 한 변경이 있으면 `notice:draft`가 새 브랜치를 만들지 않고 멈춤). 그다음 PowerShell(저장소 폴더):
   ```powershell
   git status --short   # 아무것도 안 나오면 깨끗함
   ```
   ```powershell
   npm.cmd run notice:draft -- .local/notices/272350.txt https://www.hufs.ac.kr/bbs/hufs/2181/272350/artclView.do
   ```
   - `.env`의 `CLOVA_API_KEY`를 node가 읽기만 합니다(값을 출력하지 않음). 비용은 NCP 크레딧, 여러 번 돌려 비교해도 됩니다.
   - 새 브랜치 `data/notice-글번호`(origin/main 기준) → `shared/deadlines.js` 끝에 항목(checked 없음) → 커밋 · push → `gh`가 있으면 Draft PR, 없으면 PR 만들기 주소 출력.
   - 비교표는 화면과 `.local/notice-draft-글번호.md`에 남습니다.
   - 시험만 할 때: `--dry-run`(파일 안 고침), `--no-git`(파일만 고침).
4. 원문을 다시 보며 비교표의 칸을 하나씩 대조합니다. 틀린 값은 고치고, 영문 제목 · 부서를 채우고, 주석 줄을 `checked: { on: "YYYY-MM-DD", by: "임현규" },`로 바꿉니다. 커밋 · push 후 Draft를 Ready로 바꿉니다.
5. 이슈 체크박스를 챙깁니다. 마감이 아닌 글은 "해당 없음"으로 체크하고, 다 보면 이슈를 닫습니다.

## 안전장치

- `checked`가 없으면 `tests/deadlines.test.js`가 실패합니다 → Draft PR은 대조 전까지 빨간불이 정상입니다.
- `checked`가 없으면 `/api/deadlines`가 내보내지 않습니다(`api/deadlines.js` `isChecked`) → 실수로 Merge돼도 화면에 안 나옵니다.
- 공지 본문은 공개 이슈 · Actions로 다루지 않습니다(직원 이름 · 연락처가 있을 수 있음).

## 끄기 · 문제가 생겼을 때

- 이슈가 너무 많이 생기면: GitHub → Actions → "새 공지 알림" → ⋯ → **Disable workflow**, 단톡에 한 줄.
- Actions 로그에 "목록에서 글을 찾지 못함" 경고가 나오면 학교 페이지 모양이 바뀐 것입니다. `scripts/lib/fixtures/notice-list-*.html`을 새로 저장하고 `parseNoticeList`를 고칩니다.
- 로컬에서 미리 보기: `npm.cmd run notice:watch`(학교 목록 4곳을 읽어 이슈 내용만 출력, 이슈 안 만듦).

## 도우미 바꿔 끼우기 (11/30, HCX-007)

`scripts/notice-draft.mjs` 맨 위 `EXTRACTOR`만 중혁 님 HCX-007 도우미 경로로 바꿉니다. 도우미 출력에 `=== 공지 추출 JSON 초안 ===`과 `=== shared/deadlines.js 입력용 초안 ===` 구획이 그대로 있으면 나머지는 그대로 동작합니다(`scripts/lib/noticeDraft.mjs` `parseExtractOutput`).

### HCX-007 도우미 연동 안내

신규 도우미 경로는
`scripts/extract-notice-hcx007.mjs`입니다.

PM 검토 및 Merge 이후 담당자가 기존 `EXTRACTOR`를
이 경로로 변경합니다. 이번 구현에서는 연결 경로를
아직 변경하지 않았습니다.

정상 검증 시 기존 두 JSON 출력 구획을 그대로 사용합니다.
11/27 PM 피드백에 따라 날짜 보완 정책을 변경했습니다.

| 원문 상황 | 초안 처리 및 검수 표시 |
|---|---|
| 날짜 및 시각 명시 | 원문 일시 유지 |
| 날짜만 있음 | 23:59 적용 · 시각 없음 → 23:59로 둠 |
| 연도 없음 | 사람이 입력한 게시일 기준 연도 추정 |
| 1차·2차 등 복수 마감 | 마지막 마감 적용 · 앞선 마감 메모 |
| 날짜 자체 없음 | 초안 폐기 |
| 개인정보 의심 | API 요청 전 차단 |

연도 추정에 필요한 게시일이 없거나 원문 근거
검증에 실패하면 초안을 폐기합니다.

검수 메모는 실제 공지 데이터에 저장하지 않고
터미널, 로컬 검수 문서 및 Draft PR의 확인 목록에
전달하도록 구성했습니다.

### 게시일 입력 방법

HCX-007 경로로 전환한 뒤 PowerShell에서 실행합니다.

```powershell
npm.cmd run notice:draft -- .local/notices/272350.txt https://www.hufs.ac.kr/bbs/hufs/2181/272350/artclView.do --published-at 2026-11-27
```

위 주소와 게시일은 사용법 예시입니다.
실제 공지 주소와 목록에 표시된 실제 게시일로
바꿔 입력합니다.

게시일은 YYYY-MM-DD 형식으로 입력합니다.
현재 날짜를 게시일로 자동 사용하지 않습니다.

연도가 명시된 공지는 게시일을 생략할 수 있지만,
실제 공지 작업에서는 입력을 권장합니다.

실제 반영 없이 시험하려면 --dry-run을 추가합니다.

### checked 작성 전 확인 사항

- 비교표의 날짜와 원문 근거를 대조합니다.
- 연도 추정 및 요일 불일치 메모를 확인합니다.
- 23:59로 보완된 마감 시각을 확인합니다.
- 복수 마감의 차수별 적용 대상을 확인합니다.
- 필요한 경우 초안의 날짜를 직접 수정합니다.
- 영문 제목과 부서를 작성한 후 checked를 추가합니다.

명시된 연도와 요일이 불일치하거나 해석할 수 없는
별도 마감이 있으면 안전을 위해 보류할 수 있습니다.

가상 공지 4종의 실제 API 및 dry-run 검증은
완료했으나 실제 학교 공지와 GitHub Draft PR
생성에 대한 검증은 11/30 연동 작업으로 남겨 둡니다.

사람이 개인정보를 제거한 공지 원문만 입력합니다.
자동 검사만으로 모든 개인정보를 찾을 수는 없습니다.

영문 제목과 부서 및 checked는 팀원이 원문 검수 후
직접 작성합니다. 실제 공지 등록은 별도 검수 후 진행합니다.

검증 결과와 모델별 비교 수치는
[NCP_USAGE.md](NCP_USAGE.md)를 참고합니다.
