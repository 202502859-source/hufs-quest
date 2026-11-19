/*
 * 캠퍼스 건물·공간 정보입니다. 맵 배치(위치·크기·지붕 색)는 campus.js에, 이름과 안내 내용은 이 파일에 둡니다.
 * 두 파일은 건물 ID(id)로만 연결됩니다. 건물이 바뀌면 이 파일만 고치고, 위치가 바뀔 때만 campus.js를 고칩니다.
 *
 * 건물 항목
 * - name / nameEn: 화면에 쓰는 한국어 · 영어 이름
 * - mapName: 전체 지도에서 줄바꿈해서 보여 줄 이름(없으면 name)
 * - use: 건물 용도 한 줄 { ko, en }. offices에 적힌 내용만 요약합니다. 확인 전에는 null
 * - offices: 건물 안의 사무실 · 시설 · 주요 기능 목록(아래 형식). 확인 전에는 []
 * - checkedAt: 마지막으로 공식 페이지와 대조한 날짜 "YYYY-MM-DD". 확인 전에는 null
 * - status: "open"(운영 중) · "construction"(공사 중) · "new"(신규)
 *
 * offices 한 줄: { name: {ko,en}, floor, room, does: {ko,en}, src }
 * - floor: "1F" · "B1" 처럼 근거 페이지에 층이 적혀 있을 때만. 호수만 있으면 null(호수로 층을 짐작해 넣지 않음)
 * - room: "118호"처럼 근거에 적힌 그대로. 없으면 null
 * - does: 하는 일 한 줄. 근거 페이지에 적힌 범위 안에서만
 * - src: 아래 SOURCES의 키. 항목마다 근거가 다를 수 있어 줄마다 붙입니다
 *
 * 규칙
 * - use · offices를 채우면 checkedAt도 같이 채웁니다. 모든 offices 줄에는 src가 있어야 합니다(근거 없는 내용 금지).
 * - 근거는 학교 공식 사이트(*.hufs.ac.kr)만 씁니다. 두 공식 페이지가 서로 다르면 넣지 않고 PENDING에 적어 둡니다.
 * - 이름은 2026-11 서울캠퍼스 조감도의 범례를 따랐습니다(이전 campus.js에서 옮김).
 * - 키 · 개인 연락처(담당자 이름 · 개인 전화)는 넣지 않습니다(공개 저장소).
 * - 위 규칙은 tests/buildingInfo.test.js가 확인합니다(npm test).
 */

// 화면에 보여 줄 맵 기준일입니다. 맵을 다시 현행화하면 이 값을 고칩니다.
export const MAP_BASE_DATE = "2026-11";

// 전체 지도 화면의 링크입니다. 학교 공식 캠퍼스 안내 페이지(서울캠퍼스 탭 선택)입니다.
export const OFFICIAL_MAP_URL = "https://www.hufs.ac.kr/campusMap/hufs/view.do";

// "실제와 달라요" 신고 폼(외부 구글 폼) 응답 주소입니다. 폼에는 건물 이름과 다른 점만 묻고 이메일·이름은 받지 않습니다.
// 비어 있으면 신고 버튼을 숨깁니다. 폼은 scripts/report-form/createReportForm.gs로 만들었습니다(응답 확인: 이종헌).
export const REPORT_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSflRuhX1PZp05LIotk9WIhYKX4pVasef7ZUcH_ZMF7dINSFEA/viewform";

// 폼 1번 문항(어느 건물·공간인가요?)의 미리 채우기 이름입니다. 폼을 새로 만들면 바뀝니다.
export const REPORT_FORM_PLACE_ENTRY = "entry.1318155621";

// 근거 페이지 목록입니다. offices의 src가 이 키를 가리킵니다. 모두 2026-11-19에 확인했습니다.
export const SOURCES = {
  phone: { title: "전화안내", url: "https://www.hufs.ac.kr/hufs/11159/subview.do" },
  welfare: { title: "시설이용 > 복지", url: "https://www.hufs.ac.kr/hufs/11316/subview.do" },
  health: { title: "학생지원 > 보건진료", url: "https://www.hufs.ac.kr/hufs/11301/subview.do" },
  parking: { title: "시설이용 > 주차시설", url: "https://www.hufs.ac.kr/hufs/11323/subview.do" },
  cert: { title: "학생지원 > 증명서", url: "https://www.hufs.ac.kr/hufs/11304/subview.do" },
  onestop: { title: "원스톱서비스센터 > 위치 및 연락처", url: "https://dep.hufs.ac.kr/onestop/13394/subview.do" },
  counseling: { title: "학생상담센터", url: "https://sccs.hufs.ac.kr/" },
  disability: { title: "장애학생지원센터", url: "http://support.hufs.ac.kr/" },
};

// 공식 페이지끼리 다르거나 건물이 분명하지 않아 아직 넣지 않은 것입니다. 확인되면 offices로 옮기고 여기서 지웁니다.
export const PENDING = [
  "학사종합지원센터: 학사종합지원센터 사이트 하단은 '사이버관 105호', 2026학년도 신입생 대학생활안내(2026.2)는 '본관 1층' — 어느 쪽이 지금 위치인지 확인 필요",
  "교육혁신원: iei.hufs.ac.kr 하단 '대학본부 303호' — 대학본부가 우리 맵의 본관과 같은 건물인지 확인 필요",
  "전화안내의 '1층안내데스크 · 2층안내데스크': 건물 이름이 적혀 있지 않음",
  "진로취업지원센터 · 국제교류팀 · 학생지원팀: 공식 페이지에서 위치를 찾지 못함",
];

const CHECKED = "2026-11-19";
const empty = { use: null, offices: [], checkedAt: null, status: "open" };
const o = (ko, en, floor, room, doesKo, doesEn, src) => ({ name: { ko, en }, floor, room, does: { ko: doesKo, en: doesEn }, src });

export const BUILDING_INFO = {
  main: {
    ...empty,
    name: "본관",
    nameEn: "Main Hall",
    use: { ko: "1층 안내실에 자동심장충격기(AED)가 있어요.", en: "An AED is kept at the 1st-floor information desk." },
    offices: [
      o("안내실", "Information desk", "1F", null, "건물 안내, 자동심장충격기(AED) 비치", "Building information; AED on site", "health"),
      o("4층 안내실", "4th-floor information desk", "4F", null, "층 안내", "Floor information", "phone"),
    ],
    checkedAt: CHECKED,
  },
  humanities: {
    ...empty,
    name: "인문과학관",
    mapName: "인문 과학관",
    nameEn: "Humanities Hall",
    use: {
      ko: "1층에 학생 식당 · 우편취급국 · 문구점 · 복사실이 있어요.",
      en: "The 1st floor has the student cafeteria, post office, stationery store and copy room.",
    },
    offices: [
      o("학생 식당", "Student cafeteria", "1F", null, "한식 · 양식 · 면 · 분식", "Korean, Western, noodles and snacks", "welfare"),
      o("매점", "Snack shop", "1F", null, "간식 · 음료 판매", "Snacks and drinks", "welfare"),
      o("우편취급국", "Post office", "1F", null, "우편 · 택배", "Mail and parcels", "welfare"),
      o("문구점", "Stationery store", "1F", null, "문구류 · 컴퓨터용품 · 잡화", "Stationery, computer supplies and goods", "welfare"),
      o("복사실", "Copy room", "1F", null, "인쇄 · 복사 · 제본", "Printing, copying and binding", "welfare"),
      o("복사실", "Copy room", "2F", null, "인쇄 · 복사 · 제본", "Printing, copying and binding", "welfare"),
      o("주차권 발급(동원안전시스템)", "Parking passes (Dongwon Safety System)", null, "104호", "주차권 신규 발급", "New parking passes", "parking"),
    ],
    checkedAt: CHECKED,
  },
  tlc: { ...empty, name: "교수학습개발원", mapName: "교수학습 개발원", nameEn: "Teaching Center" },
  social: {
    ...empty,
    name: "사회과학관",
    nameEn: "Social Sciences Hall",
    use: { ko: "1층에 복사실이 있어요.", en: "There is a copy room on the 1st floor." },
    offices: [o("복사실", "Copy room", "1F", null, "인쇄 · 복사 · 제본", "Printing, copying and binding", "welfare")],
    checkedAt: CHECKED,
  },
  // 공식 페이지는 이 건물을 "국제학사(기숙사 및 학생회관)"로 부릅니다(장애학생지원 > 주요시설 및 설비).
  union: {
    ...empty,
    name: "학생회관 및 기숙사",
    nameEn: "Student Union & Dorm",
    use: {
      ko: "원스톱서비스센터(증명서) · 보건실 · 학생상담센터가 있어요.",
      en: "Home to the One-Stop Service Center (certificates), health room and counseling center.",
    },
    offices: [
      o("원스톱서비스센터", "One-Stop Service Center", "1F", "118호", "증명서 발급", "Certificates", "onestop"),
      o("무인 증명서 발급기", "Certificate kiosk", "1F", null, "원스톱서비스센터 앞, 08:00~20:00", "In front of the One-Stop Service Center, 08:00-20:00", "cert"),
      o("CU 편의점", "CU convenience store", "1F", null, "간식 · 생필품, 택배", "Snacks, daily goods and parcels", "welfare"),
      o("STN 커피", "STN Coffee", "1F", null, "커피 · 음료 · 베이커리", "Coffee, drinks and bakery", "welfare"),
      o("기념품점", "Souvenir shop", "1F", null, "외대 · Boo 기념품, 문구류", "HUFS and Boo souvenirs, stationery", "welfare"),
      o("자동심장충격기(AED)", "AED", "1F", null, "1층 로비", "1st-floor lobby", "health"),
      o("보건실", "Health room", "2F", null, "보건 진료", "Basic health care", "health"),
      o("장애학생지원센터", "Disability Support Center", null, "101호", "장애 학생 지원", "Support for students with disabilities", "disability"),
      o("학생상담센터", "Student Counseling Center", null, "345호", "학생 상담", "Student counseling", "counseling"),
    ],
    checkedAt: CHECKED,
  },
  law: { ...empty, name: "법학관", nameEn: "Law Hall" },
  grad: {
    ...empty,
    name: "대학원",
    nameEn: "Graduate School",
    use: { ko: "1층에 카페와 자동심장충격기(AED)가 있어요.", en: "The 1st floor has a café and an AED." },
    offices: [
      o("HUS 동문 커피", "HUS Alumni Coffee", "1F", null, "커피 · 음료", "Coffee and drinks", "welfare"),
      o("자동심장충격기(AED)", "AED", "1F", null, "1층 로비", "1st-floor lobby", "health"),
    ],
    checkedAt: CHECKED,
  },
  flc: { ...empty, name: "외국어연수평가원", mapName: "외국어 연수평가원", nameEn: "Language Center" },
  intl: {
    ...empty,
    name: "국제관",
    nameEn: "International Hall",
    use: { ko: "2층에 카페가 있어요.", en: "There is a café on the 2nd floor." },
    offices: [o("나무라듸오", "Namu Radio café", "2F", null, "커피 · 음료 · 베이커리", "Coffee, drinks and bakery", "welfare")],
    checkedAt: CHECKED,
  },
  library: {
    ...empty,
    name: "도서관",
    nameEn: "Library",
    use: {
      ko: "3층 일반자료실, 4층 학술연구자료실이 있어요.",
      en: "General collection on 3F, research collection on 4F.",
    },
    offices: [
      o("이문일공칠 인더북", "Imun 107 In the Book café", "1F", null, "로비 카페(커피 · 음료 · 베이커리)", "Lobby café", "welfare"),
      o("자동심장충격기(AED)", "AED", "1F", null, "1층 로비", "1st-floor lobby", "health"),
      o("복사실", "Copy room", "1F", null, "복사", "Copying", "phone"),
      o("일반자료실", "General collection", "3F", null, "정보봉사파트 자료실", "Information services collection", "phone"),
      o("복사실", "Copy room", "3F", null, "복사", "Copying", "phone"),
      o("무인 복사실", "Self-service copy room", "1F · 2F · 3F", null, "복사 · 프린트", "Copying and printing", "welfare"),
      o("학술연구자료실", "Research collection", "4F", null, "정보봉사파트 자료실", "Information services collection", "phone"),
      o("매점", "Snack shop", "6F", null, "간식 · 음료 판매", "Snacks and drinks", "phone"),
      o("빵명장", "Bbang Myeongjang bakery", null, null, "건물 뒤 베이커리 카페", "Bakery café behind the building", "welfare"),
    ],
    checkedAt: CHECKED,
  },
  faculty: { ...empty, name: "교수연구동", nameEn: "Faculty Research" },
  club: {
    ...empty,
    name: "교수회관",
    nameEn: "Faculty Club",
    use: { ko: "1층에 우리은행(학생증 발급)이 있어요.", en: "Woori Bank (student ID cards) is on the 1st floor." },
    offices: [
      o("우리은행", "Woori Bank", "1F", null, "은행 업무, 학생증 발급", "Banking and student ID cards", "welfare"),
      o("하나투어", "Hanatour travel agency", "1F", null, "여행 상담 · 예약", "Travel booking", "welfare"),
      o("무인 복사 · 아이스크림", "Self-service copy & ice cream", "1F", null, "무인 복사, 아이스크림", "Self-service copying and ice cream", "welfare"),
      o("교직원 식당", "Faculty cafeteria", "2F", null, "한식 · 양식", "Korean and Western meals", "welfare"),
    ],
    checkedAt: CHECKED,
  },
  press: { ...empty, name: "출판부", nameEn: "Univ. Press" },
  gatehouse: { ...empty, name: "정문안내실", mapName: "정문 안내실", nameEn: "Gate Office" },
  history: { ...empty, name: "역사관", nameEn: "History Hall" },
  minerva: { ...empty, name: "Minerva Complex", nameEn: "Minerva Complex" },
  cyber: {
    ...empty,
    name: "사이버관",
    nameEn: "Cyber Hall",
    use: { ko: "1층에 올리브영과 카페(아티제)가 있어요.", en: "Olive Young and Artisée café are on the 1st floor." },
    offices: [
      o("올리브영", "Olive Young", "1F", null, "헬스 · 뷰티 제품", "Health and beauty", "welfare"),
      o("아티제", "Artisée café", "1F", null, "커피 · 음료 · 베이커리", "Coffee, drinks and bakery", "welfare"),
    ],
    checkedAt: CHECKED,
  },

  // 건물이 아닌 공간(광장·운동장·휴게공간)
  square: { ...empty, name: "Minerva Square", nameEn: "Minerva Square" },
  field: { ...empty, name: "대운동장", nameEn: "Main Field" },
  rest: { ...empty, name: "휴게공간 오디", nameEn: "Odi Lounge" },
};

const UNKNOWN = { ...empty, name: "알 수 없는 건물", nameEn: "Unknown building" };

// 건물 ID로 정보를 찾습니다. 빠진 ID가 있으면 개발 중에 바로 알 수 있게 콘솔에 남깁니다.
export function buildingInfo(id) {
  const info = BUILDING_INFO[id];
  if (!info) {
    console.warn(`[buildingInfo] 정보가 없는 건물 ID: ${id}`);
    return { ...UNKNOWN };
  }
  return info;
}

// 신고 폼 주소를 만듭니다. 근처 장소를 알면 1번 문항에 그 건물 이름을 미리 채웁니다.
// 폼에 보내는 값은 건물 이름 하나뿐입니다(좌표·로그인 정보·이메일은 붙이지 않음).
// 장소를 모르거나 목록에 없는 ID면 미리 채우기 없이 폼 주소만 돌려줍니다. 폼 주소가 비어 있으면 "".
export function reportFormUrl(placeId, { formUrl = REPORT_FORM_URL, entry = REPORT_FORM_PLACE_ENTRY } = {}) {
  if (!formUrl) return "";
  const url = new URL(formUrl);
  const name = placeId ? BUILDING_INFO[placeId]?.name : null;
  if (name && entry) {
    url.searchParams.set("usp", "pp_url");
    url.searchParams.set(entry, name);
  }
  return url.toString();
}

// 공식 페이지와 대조해 용도 · 사무실이 확인된 건물인지 알려 줍니다.
export const isChecked = (info) => Boolean(info.use && info.checkedAt && info.offices?.length && info.offices.every((x) => SOURCES[x.src]));

// 건물에 쓰인 근거 페이지 목록(중복 없이). 화면에 "출처"로 보여 줄 때 씁니다.
export const buildingSources = (info) => [...new Set((info.offices ?? []).map((x) => x.src))].map((key) => SOURCES[key]).filter(Boolean);
