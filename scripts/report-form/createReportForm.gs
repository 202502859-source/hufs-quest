/**
 * HUFS Quest "실제와 달라요" 신고용 구글 폼을 만드는 Apps Script입니다.
 *
 * 사용법: script.google.com → 새 프로젝트 → 이 파일 전체를 붙여 넣기 → 함수 createReportForm 실행 → 권한 허용
 *         → 실행 로그에서 ① 응답 주소 ② 미리 채우기 entry ID ③ 편집 주소 확인
 * 실행할 때마다 새 폼이 하나씩 생깁니다. 두 번 실행했다면 남는 폼은 구글 드라이브에서 지워 주세요.
 *
 * 개인정보: 이메일 수집 · 로그인 요구 · 파일 업로드(로그인이 필요해짐)를 모두 쓰지 않습니다.
 * 건물 목록(PLACES)은 scripts/report-form/buildPlaceList.mjs가 src/data/buildingInfo.js에서 만듭니다.
 * 건물이 바뀌면: node scripts/report-form/buildPlaceList.mjs 실행 → 폼을 새로 만들거나, 기존 폼 1번 문항 선택지를 손으로 맞춤.
 */

// <<PLACES:BEGIN>>
// 아래 배열은 scripts/report-form/buildPlaceList.mjs가 src/data/buildingInfo.js에서 만듭니다. 손으로 고치지 마세요.
var PLACES = [
  "본관",
  "인문과학관",
  "교수학습개발원",
  "사회과학관",
  "국제학사 및 학생회관",
  "법학관",
  "대학원",
  "외국어연수평가원",
  "국제관",
  "도서관",
  "교수연구동",
  "교수회관",
  "출판부",
  "정문안내실",
  "역사관",
  "Minerva Complex",
  "사이버관",
  "Minerva Square",
  "대운동장",
  "휴게공간 오디",
  "목록에 없음(설명에 적어 주세요)",
];
// <<PLACES:END>>

var FORM_TITLE = "HUFS Quest · 실제 캠퍼스와 달라요";
var FORM_DESCRIPTION =
  "게임 지도·건물 정보가 실제와 다른 점을 알려 주세요. " +
  "이름·이메일·학번 같은 개인정보는 받지 않아요. 개인정보는 적지 말아 주세요.";
var CONFIRMATION = "알려 주셔서 고마워요! 팀이 확인 후 지도에 반영할게요.";
var KINDS = ["건물 이름", "위치·모양", "용도·층별 사무실", "공사 중·새 건물", "기타"];
var DETAIL_MAX = 500;

function createReportForm() {
  if (!PLACES.length) throw new Error("PLACES가 비어 있습니다. buildPlaceList.mjs로 만든 파일을 붙여 넣었는지 확인하세요.");

  var form = FormApp.create(FORM_TITLE);
  form.setDescription(FORM_DESCRIPTION);

  // ── 설정: 개인정보를 받지 않고 누구나 응답 ──
  if (typeof form.setEmailCollectionType === "function") {
    form.setEmailCollectionType(FormApp.EmailCollectionType.DO_NOT_COLLECT);
  } else {
    form.setCollectEmail(false);
  }
  try {
    // 학교(Google Workspace) 계정은 기본값이 "같은 도메인만 응답"일 수 있어 꺼 둡니다.
    form.setRequireLogin(false);
  } catch (e) {
    Logger.log("로그인 요구 설정은 이 계정에서 바꿀 수 없어 건너뜀: " + e.message);
  }
  form.setLimitOneResponsePerUser(false); // 응답 1회 제한 끔(켜면 로그인이 필요해짐)
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  form.setPublishingSummary(false); // 다른 사람의 응답 요약을 보여 주지 않음
  form.setConfirmationMessage(CONFIRMATION);
  form.setAcceptingResponses(true);

  // ── 1. 어느 건물·공간인가요? (드롭다운, 필수) ──
  var placeItem = form
    .addListItem()
    .setTitle("어느 건물·공간인가요?")
    .setChoiceValues(PLACES)
    .setRequired(true);

  // ── 2. 무엇이 다른가요? (체크박스, 필수) ──
  form.addCheckboxItem().setTitle("무엇이 다른가요?").setChoiceValues(KINDS).setRequired(true);

  // ── 3. 자세히 알려 주세요 (긴 답변, 필수, 500자 이하) ──
  var detailRule = FormApp.createParagraphTextValidation()
    .setHelpText(DETAIL_MAX + "자 이하로 적어 주세요.")
    .requireTextLengthLessThanOrEqualTo(DETAIL_MAX)
    .build();
  form
    .addParagraphTextItem()
    .setTitle("자세히 알려 주세요")
    .setHelpText("무엇이 어떻게 다른지 적어 주세요. 이름·연락처 같은 개인정보는 적지 말아 주세요. (" + DETAIL_MAX + "자 이하)")
    .setValidation(detailRule)
    .setRequired(true);

  // ── 4. 확인한 날짜 (날짜, 선택) ──
  form.addDateItem().setTitle("확인한 날짜").setHelpText("실제로 보고 확인한 날짜예요.").setRequired(false);

  // ── 5. 참고할 공식 페이지 링크 (짧은 답변, 선택, URL 형식) ──
  var urlRule = FormApp.createTextValidation()
    .setHelpText("https://로 시작하는 주소를 적어 주세요.")
    .requireTextIsUrl()
    .build();
  form
    .addTextItem()
    .setTitle("참고할 공식 페이지 링크")
    .setHelpText("학교 공식 페이지 등 근거가 되는 주소가 있으면 적어 주세요.")
    .setValidation(urlRule)
    .setRequired(false);

  // 2025년 이후 폼에는 "게시" 상태가 있습니다. 게시되지 않았으면 응답을 받을 수 없어 게시합니다.
  if (typeof form.isPublished === "function" && !form.isPublished()) form.setPublished(true);

  // ── 미리 채우기 entry ID: 1번 문항에 첫 선택지를 넣은 미리 채우기 주소에서 "entry.숫자"를 뽑습니다(제출하지 않음) ──
  var prefilled = form.createResponse().withItemResponse(placeItem.createResponse(PLACES[0])).toPrefilledUrl();
  var match = prefilled.match(/entry\.\d+/);

  Logger.log("① 응답 주소(REPORT_FORM_URL): " + form.getPublishedUrl());
  Logger.log("② 1번 문항 미리 채우기 entry ID(REPORT_FORM_PLACE_ENTRY): " + (match ? match[0] : "찾지 못함 → " + prefilled));
  // ⚠️ ③ 편집 주소는 폼을 고치고 응답(신고 내용)을 볼 수 있는 주소입니다.
  //    공개 저장소 · 코드 · 문서 · 커밋 · 단톡에 붙이지 마세요. 응답 확인은 이 주소로 본인만 합니다.
  Logger.log("③ 응답 확인용 편집 주소(저장소에 넣지 말 것): " + form.getEditUrl());
}
