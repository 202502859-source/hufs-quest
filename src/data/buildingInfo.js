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
 * - 근거는 학교 공식 사이트(*.hufs.ac.kr)만 씁니다. 공식 페이지가 옛 정보일 때만 팀 현장 확인(SOURCES.team)을 씁니다. 두 공식 페이지가 서로 다르면 넣지 않고 PENDING에 적어 둡니다.
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

// 근거 목록입니다. offices의 src가 이 키를 가리킵니다. 모두 2026-11-19에 확인했습니다.
// url이 null인 것은 팀이 현장에서 직접 확인한 내용입니다(공식 페이지끼리 다르거나 옛 정보일 때만 씀).
export const SOURCES = {
  phone: { title: "전화안내", url: "https://www.hufs.ac.kr/hufs/11159/subview.do" },
  welfare: { title: "시설이용 > 복지", url: "https://www.hufs.ac.kr/hufs/11316/subview.do" },
  health: { title: "학생지원 > 보건진료", url: "https://www.hufs.ac.kr/hufs/11301/subview.do" },
  parking: { title: "시설이용 > 주차시설", url: "https://www.hufs.ac.kr/hufs/11323/subview.do" },
  cert: { title: "학생지원 > 증명서", url: "https://www.hufs.ac.kr/hufs/11304/subview.do" },
  onestop: { title: "원스톱서비스센터 > 위치 및 연락처", url: "https://dep.hufs.ac.kr/onestop/13394/subview.do" },
  iei: { title: "교육혁신원", url: "https://iei.hufs.ac.kr/" },
  team: { title: "팀 현장 확인(이종헌, 2026-11-19)", url: null },
  guide2026: { title: "2026학년도 신입생 대학생활안내(교무처 학사종합지원센터, 2026.2.20) 서울캠퍼스 표기 부분", url: "https://www.hufs.ac.kr/sites/hufs/download/studentlifeguide2026.pdf" },
  counseling: { title: "학생상담센터", url: "https://sccs.hufs.ac.kr/" },
  disability: { title: "장애학생지원센터", url: "http://support.hufs.ac.kr/" },
  flttc: { title: "외국어연수평가원", url: "https://flttc.hufs.ac.kr/" },
  academic: { title: "학사종합지원센터(학사 공지)", url: "https://www.hufs.ac.kr/hufs/11282/subview.do" },
};

// 공식 페이지끼리 다르거나 건물이 분명하지 않아 아직 넣지 않은 것입니다. 확인되면 offices로 옮기고 여기서 지웁니다.
export const PENDING = [
  "전화안내의 '1층안내데스크 · 2층안내데스크': 건물 이름이 적혀 있지 않음",
  "진로취업지원센터 · 국제교류팀 · 학생지원팀: 공식 페이지에서 위치를 찾지 못함",
  "Minerva Complex(오바마홀): 전화안내(전기실만 기재), 공식 캠퍼스맵, 2026 신입생 대학생활안내 PDF 확인했으나 층·호수 및 입주 시설 공식 안내 미기재",
  "출판부: 전화안내(동일 명칭 없음) 및 공식 캠퍼스맵 확인했으나 층·호수·용도 설명 미기재",
  "역사관(역사기념관): 전화안내(동일 명칭 없음) 및 공식 캠퍼스맵 확인했으나 층·호수·용도 설명 미기재",
  "교수연구동: 전화안내에 '제1교수연구동 안내실'로 표기되어 있으나 맵 건물이 제1교수연구동인지 확인 근거가 없어 PENDING 이동",
  "원스톱서비스센터 호수: 원스톱 사이트(dep.hufs.ac.kr/onestop)는 118호, 증명서 페이지(학생지원 > 증명서)는 국제학사 1층 114호 → 114호로 확정(이종헌 확인, 2026-11-20). 원스톱 사이트는 옛 정보",
];

const CHECKED = "2026-11-19";
const empty = { use: null, offices: [], checkedAt: null, status: "open" };
const o = (ko, en, floor, room, doesKo, doesEn, src) => ({ name: { ko, en }, floor, room, does: { ko: doesKo, en: doesEn }, src });

export const BUILDING_INFO = {
  main: {
    ...empty,
    name: "본관",
    nameEn: "Main Hall",
    use: {
      ko: "1층 안내실(AED 비치)과 교육혁신원(303호)이 있어요.",
      en: "Home to the 1st-floor information desk (with an AED) and the Institute for Educational Innovation (Room 303).",
    },
    offices: [
      o("안내실", "Information desk", "1F", null, "건물 안내, 자동심장충격기(AED) 비치", "Building information; AED on site", "health"),
      o("4층 안내실", "4th-floor information desk", "4F", null, "층 안내", "Floor information", "phone"),
      o("교육혁신원", "Institute for Educational Innovation", null, "303호", "교육과정 개선 · 원격교육 지원", "Curriculum improvement and remote-learning support", "iei"),
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
  tlc: {
    ...empty,
    name: "교수학습개발원",
    mapName: "교수학습 개발원",
    nameEn: "Teaching Center",
    use: { ko: "301호에 정보지원팀(강의실 기자재 · 교내 컴퓨터 민원)이 있어요.", en: "The IT Support Team (classroom equipment, campus computer help) is in Room 301." },
    offices: [
      o("정보지원팀", "IT Support Team", null, "301호", "강의실 기자재 관리 · 행사 장비 지원 · 교내 컴퓨터 민원", "Classroom equipment, event AV support and campus computer help", "guide2026"),
    ],
    checkedAt: CHECKED,
  },
  social: {
    ...empty,
    name: "사회과학관",
    nameEn: "Social Sciences Hall",
    use: { ko: "1층에 복사실이 있어요.", en: "There is a copy room on the 1st floor." },
    offices: [o("복사실", "Copy room", "1F", null, "인쇄 · 복사 · 제본", "Printing, copying and binding", "welfare")],
    checkedAt: CHECKED,
  },
  // 공식 페이지는 이 건물을 "국제학사(기숙사 및 학생회관)"로 부릅니다(장애학생지원 > 주요시설 및 설비). 이름은 11/19 이종헌 결정.
  // 이름을 바꾸면 "실제와 달라요" 구글 폼 1번 드롭다운 항목도 같은 이름으로 고쳐야 미리 채우기가 됩니다.
  union: {
    ...empty,
    name: "국제학사 및 학생회관",
    nameEn: "GlobeeDorm & Student Union",
    use: {
      ko: "1층에 원스톱서비스센터(증명서)가 있어요.",
      en: "The One-Stop Service Center (certificates) is on the 1st floor.",
    },
    offices: [
      o("원스톱서비스센터", "One-Stop Service Center", "1F", "114호", "증명서 발급", "Certificates", "cert"),
      o("무인 증명서 발급기", "Certificate kiosk", "1F", null, "원스톱서비스센터 앞, 08:00~20:00", "In front of the One-Stop Service Center, 08:00-20:00", "cert"),
      o("CU 편의점", "CU convenience store", "1F", null, "간식 · 생필품, 택배", "Snacks, daily goods and parcels", "welfare"),
      o("STN 커피", "STN Coffee", "1F", null, "커피 · 음료 · 베이커리", "Coffee, drinks and bakery", "welfare"),
      o("기념품점", "Souvenir shop", "1F", null, "외대 · Boo 기념품, 문구류", "HUFS and Boo souvenirs, stationery", "welfare"),
      o("자동심장충격기(AED)", "AED", "1F", null, "1층 로비", "1st-floor lobby", "health"),
      o("보건실", "Health room", "2F", null, "보건 진료", "Basic health care", "health"),
      o("장애학생지원센터", "Disability Support Center", null, "101호", "장애 학생 지원", "Support for students with disabilities", "disability"),
      o("학생상담센터", "Student Counseling Center", null, "345호", "학생 상담", "Student counseling", "counseling"),
    ],
    checkedAt: "2026-11-20",
  },
  law: {
    ...empty,
    name: "법학관",
    nameEn: "Law Hall",
    use: { ko: "건물 안내실이 있어요.", en: "Has a building information desk." },
    offices: [o("안내실", "Information desk", null, null, "건물 안내", "Building information", "phone")],
    checkedAt: "2026-11-20",
  },
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
  flc: {
    ...empty,
    name: "외국어연수평가원",
    mapName: "외국어 연수평가원",
    nameEn: "Language Center",
    use: {
      ko: "외국어 교육 과정과 외국어 평가를 운영해요.",
      en: "Runs foreign language training programs and proficiency testing.",
    },
    offices: [
      o(
        "외국어연수평가원",
        "Foreign Language Training and Testing Center",
        null,
        null,
        "외국어 교육 과정(정규 · 야간 · 주말 · 대학원시험대체 등) 및 외국어 평가",
        "Foreign language courses (regular, evening, weekend, graduate exam replacement) and testing",
        "flttc"
      ),
    ],
    checkedAt: "2026-11-20",
  },
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
      o("자료실 이용시간", "Collection hours", null, null, "학기 중 평일 09:00~21:00, 학기 중 토요일 09:00~17:00, 방학 중 평일·토요일 09:00~17:00, 공휴일 폐실", "Semester weekdays 09:00-21:00, semester Saturdays 09:00-17:00, vacation weekdays and Saturdays 09:00-17:00, closed on holidays", "guide2026"),
      o("제1 · 제2자유열람실", "Reading Rooms 1 & 2", null, null, "24시간 개방", "Open 24 hours", "guide2026"),
      o("제3 · 제4자유열람실", "Reading Rooms 3 & 4", null, null, "06:00~23:00", "06:00-23:00", "guide2026"),
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
  gatehouse: {
    ...empty,
    name: "정문안내실",
    mapName: "정문 안내실",
    nameEn: "Gate Office",
    use: { ko: "정문 안내실이 있어요.", en: "Has the main gate information desk." },
    offices: [
      o("정문 안내실", "Main gate information desk", null, null, "정문 안내", "Main gate information", "phone"),
    ],
    checkedAt: "2026-11-20",
  },
  history: { ...empty, name: "역사관", nameEn: "History Hall" },
  minerva: { ...empty, name: "Minerva Complex", nameEn: "Minerva Complex" },
  cyber: {
    ...empty,
    name: "사이버관",
    nameEn: "Cyber Hall",
    use: {
      ko: "105호에 학사종합지원센터가 있고, 1층에 올리브영과 카페(아티제)가 있어요.",
      en: "The Academic Support Center is in Room 105, and Olive Young and Artisée café are on the 1st floor.",
    },
    offices: [
      o("학사종합지원센터", "Academic Support Center", null, "105호", "학사 · 학적 업무(수강 · 휴복학 · 졸업 등)", "Academic records, registration, leave and graduation", "academic"),
      o("올리브영", "Olive Young", "1F", null, "헬스 · 뷰티 제품", "Health and beauty", "welfare"),
      o("아티제", "Artisée café", "1F", null, "커피 · 음료 · 베이커리", "Coffee, drinks and bakery", "welfare"),
    ],
    checkedAt: "2026-11-20",
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
