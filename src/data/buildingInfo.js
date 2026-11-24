/*
 * 캠퍼스 건물·공간 정보입니다. 맵 배치(위치·크기·지붕 색)는 campus.js에, 이름과 안내 내용은 이 파일에 둡니다.
 * 두 파일은 건물 ID(id)로만 연결됩니다. 건물이 바뀌면 이 파일만 고치고, 위치가 바뀔 때만 campus.js를 고칩니다.
 *
 * 건물 항목
 * - name / nameEn: 화면에 쓰는 한국어 · 영어 이름
 * - mapName: 전체 지도 · 게임 이름표에서 두 줄로 보여 줄 이름. 줄바꿈은 띄어쓰기가 아니라 "\n"으로 넣습니다
 *   (띄어쓰기를 넣으면 한 줄로 쓰는 화면에서 "인문 과학관"처럼 보임). 없으면 name
 * - use: 건물 용도 한 줄 { ko, en }. offices에 적힌 내용만 요약합니다. 확인 전에는 null
 * - offices: 건물 안의 사무실 · 시설 · 주요 기능 목록(아래 형식). 확인 전에는 []
 * - checkedAt: 마지막으로 공식 페이지와 대조한 날짜 "YYYY-MM-DD". 확인 전에는 null
 * - status: "open"(운영 중) · "construction"(공사 중) · "new"(신규)
 * - onMap: false면 맵(campus.js)에 그리지 않는 장소입니다(좌표 미확인 등). 항목은 지우지 않고 남깁니다. 없으면 맵에 있음
 * - nameEn이 null이면 영어 공식 표기를 확인하지 못한 것입니다(PENDING에 이유). 화면은 한국어 이름으로 대신 보여 줍니다
 *
 * offices 한 줄: { name: {ko,en}, floor, room, does: {ko,en}, src, category, phone, hours, details, extraSrc?, checkedAt? }
 * - name.en: 근거에 적힌 영어 공식 표기만. 없으면 null(화면은 한국어 이름으로 대신 보여 줌)
 * - floor: "1F" · "B1" 처럼 근거 페이지에 층이 적혀 있을 때만. 호수만 있으면 null(호수로 층을 짐작해 넣지 않음)
 * - room: "118호"처럼 근거에 적힌 그대로. 없으면 null
 * - does: 하는 일 한 줄. 근거 페이지에 적힌 범위 안에서만
 * - src: 아래 SOURCES의 키. 항목마다 근거가 다를 수 있어 줄마다 붙입니다
 * - category: "office"(행정 · 센터 · 도서관 안 시설) · "amenity"(식당 · 카페 · 매점 등 편의시설). 목록을 두 묶음으로 나눌 때 씁니다
 * - phone: 학교 부서 번호 문자열 배열(02-2173- · 02-6235-로 시작, 근거에 적힌 그대로 "02-2173-2152~4"). 없으면 null.
 *   전화번호는 이 칸에만 넣습니다(does · details · hours 글에 넣지 않음). 휴대폰 · 가게 직통 · 팩스 · 이메일은 넣지 않습니다
 * - hours: 운영시간 { ko, en }. 없으면 null(화면에 "안내 없음")
 * - details: 주요 기능 · 지원 사업 { ko: [], en: [] }. 최대 5줄, 줄마다 40자 안팎. 없으면 null
 * - extraSrc: 기존 줄에 phone · hours · details를 덧붙였거나, 그 칸의 근거가 src와 다를 때 그 칸의 근거.
 *   문자열(덧붙인 칸 모두 같은 근거) 또는 { phone, hours, details } 칸별 SOURCES 키
 * - checkedAt: 새로 넣거나 덧붙인 줄을 확인한 날("YYYY-MM-DD"). 건물의 checkedAt과 따로 둡니다
 *
 * 규칙
 * - use · offices를 채우면 checkedAt도 같이 채웁니다. 모든 offices 줄에는 src가 있어야 합니다(근거 없는 내용 금지).
 * - 근거는 학교 공식 사이트(*.hufs.ac.kr)만 씁니다. 공식 페이지가 옛 정보일 때만 팀 현장 확인(SOURCES.team)을 씁니다. 두 공식 페이지가 서로 다르면 넣지 않고 PENDING에 적어 둡니다.
 * - 이름은 2026-11 서울캠퍼스 조감도의 범례를 따랐습니다(이전 campus.js에서 옮김).
 * - 키 · 개인 연락처(담당자 이름 · 개인 전화)는 넣지 않습니다(공개 저장소).
 * - lifeguide2026(PDF)은 서울캠퍼스 표기 · 서울 번호(02-) · 서울 칸으로 확인한 값만 씁니다. 기존 값(이 파일 · 검색창 조각)과 다르면 넣지 않습니다.
 * - team1124: 공식 자료에 없는 도서관 시험기간 운영, 종헌 확인으로 예외 허용.
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
  // 아래 두 개는 2026-11-24에 추가했습니다. lifeguide2026 주소는 학교 홈페이지 '대학생활 길라잡이' 게시판(2026판 게시)입니다.
  lifeguide2026: { title: "Life@HUFS 2026 대학생활 길라잡이(2026.3)", url: "https://www.hufs.ac.kr/hufs/11415/subview.do" },
  team1124: { title: "팀 확인(이종헌, 2026-11-24)", url: null },
};

// 공식 페이지끼리 다르거나 건물이 분명하지 않아 아직 넣지 않은 것입니다. 확인되면 offices로 옮기고 여기서 지웁니다.
export const PENDING = [
  "전화안내의 '1층안내데스크 · 2층안내데스크': 건물 이름이 적혀 있지 않음",
  "진로취업지원센터 · 국제교류팀 · 학생지원팀: 공식 페이지에서 위치를 찾지 못함",
  "Minerva Complex(오바마홀): 전화안내(전기실만 기재), 공식 캠퍼스맵, 2026 신입생 대학생활안내 PDF 확인했으나 층·호수 및 입주 시설 공식 안내 미기재",
  "출판부: 전화안내(동일 명칭 없음) 및 공식 캠퍼스맵 확인했으나 층·호수·용도 설명 미기재",
  "역사관(역사기념관): 전화안내(동일 명칭 없음) 및 공식 캠퍼스맵 확인했으나 층·호수·용도 설명 미기재",
  "교수연구동: 전화안내에 '제1교수연구동 안내실'로 표기되어 있으나 맵 건물이 제1교수연구동인지 확인 근거가 없어 PENDING 이동",
  "정문 & 진입광장 영어 이름: HUFS MAP English 목록에서 같은 위도 · 경도의 항목이 'Main(Administration) Building'(본관 이름)으로 적혀 있어 오기로 보고 넣지 않음(2026-11-22 확인). 확인 전에는 화면에 한국어 이름",
  "원스톱서비스센터 호수:원스톱 사이트(dep.hufs.ac.kr/onestop)는 118호, 증명서 페이지(학생지원 > 증명서)는 국제학사 1층 114호 → 114호로 확정(이종헌 확인, 2026-11-20). 원스톱 사이트는 옛 정보",
];

const CHECKED = "2026-11-19";
const empty = { use: null, offices: [], checkedAt: null, status: "open" };
// o(...)의 앞 7개 인자는 예전 그대로이고, 8번째 extra로 category · phone · hours · details · extraSrc · checkedAt을 받습니다.
const o = (ko, en, floor, room, doesKo, doesEn, src, extra = {}) => ({
  name: { ko, en },
  floor,
  room,
  does: { ko: doesKo, en: doesEn },
  src,
  category: extra.category ?? null,
  phone: extra.phone ?? null,
  hours: extra.hours ?? null,
  details: extra.details ?? null,
  ...(extra.extraSrc ? { extraSrc: extra.extraSrc } : {}),
  ...(extra.checkedAt ? { checkedAt: extra.checkedAt } : {}),
});
const OFFICE = { category: "office" };
const AMENITY = { category: "amenity" };
const L = (ko, en) => ({ ko, en }); // hours · details 한/영 묶음
const ADDED = "2026-11-24"; // lifeguide2026 · team1124로 새로 넣거나 덧붙인 날
// 서울도서관 자료실(일반자료실 · 학술연구자료실 · 스마트플라자) 이용시간(lifeguide2026 26쪽)
const LIB_HOURS = L(
  "학기 중 평일 09:00~21:00 · 방학 중 평일 09:00~17:00 · 토요일 09:00~17:00 · 공휴일 폐실",
  "Semester weekdays 09:00-21:00 · Vacation weekdays 09:00-17:00 · Saturdays 09:00-17:00 · Closed on holidays"
);

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
      o("안내실", "Information desk", "1F", null, "건물 안내, 자동심장충격기(AED) 비치", "Building information; AED on site", "health", OFFICE),
      o("4층 안내실", "4th-floor information desk", "4F", null, "층 안내", "Floor information", "phone", OFFICE),
      o("교육혁신원", "Institute for Educational Innovation", null, "303호", "교육과정 개선 · 원격교육 지원", "Curriculum improvement and remote-learning support", "iei", {
        ...OFFICE,
        details: L(
          [
            "IR센터: 대학 성과관리, 교육성과 분석 · 환류",
            "전공설계지원센터: 전공 탐색 지원 · 설계 상담",
            "교수학습개발센터: 교수법 · 학습법 연구, 컨설팅",
            "혁신지원팀: 교육정책 기획, 대학혁신지원사업 운영",
            "교육지원팀: 원격수업 개설 · 운영, 강의 촬영 지원",
          ],
          [
            "IR Center: performance management, analysis and feedback on educational outcomes",
            "Major Design Support Center: major exploration support and planning advice",
            "Teaching and learning center: research and consulting on teaching and learning methods",
            "Innovation Support Team: education policy planning, university innovation projects",
            "Education Support Team: online course setup and operation, lecture filming support",
          ]
        ),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
    ],
    checkedAt: CHECKED,
  },
  humanities: {
    ...empty,
    name: "인문과학관",
    mapName: "인문\n과학관",
    nameEn: "Humanities Hall",
    use: {
      ko: "1층에 학생 식당 · 우편취급국 · 문구점 · 복사실이 있어요.",
      en: "The 1st floor has the student cafeteria, post office, stationery store and copy room.",
    },
    offices: [
      o("학생 식당", "Student cafeteria", "1F", null, "한식 · 양식 · 면 · 분식", "Korean, Western, noodles and snacks", "welfare", {
        ...AMENITY,
        phone: ["02-2173-2211"],
        hours: L(
          "아침 08:00~10:00 · 점심 11:00~14:30 · 저녁 16:40~18:40 · 면(점심) 11:00~14:00 · 스낵 08:20~18:30",
          "Breakfast 08:00-10:00 · Lunch 11:00-14:30 · Dinner 16:40-18:40 · Noodles (lunch) 11:00-14:00 · Snacks 08:20-18:30"
        ),
        details: L(["학생 대상 한식 · 중식 · 양식 · 분식 · 스낵 판매", "스낵 메뉴: 라면 · 토스트 등"], ["Korean, Chinese, Western, light meals and snacks for students", "Snack menu: ramen, toast and more"]),
        extraSrc: { phone: "welfare", hours: "lifeguide2026", details: "lifeguide2026" },
        checkedAt: ADDED,
      }),
      o("매점", "Snack shop", "1F", null, "간식 · 음료 판매", "Snacks and drinks", "welfare", {
        ...AMENITY,
        phone: ["02-2173-2210"],
        details: L(["음료 · 과자류 · 간이식품 · 생필품 판매"], ["Drinks, snacks, light food and daily necessities"]),
        extraSrc: { phone: "welfare", details: "lifeguide2026" },
        checkedAt: ADDED,
      }),
      o("우편취급국", "Post office", "1F", null, "우편 · 택배", "Mail and parcels", "welfare", {
        ...AMENITY,
        details: L(["우편 업무 · 각종 금융서비스"], ["Postal services and financial services"]),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("문구점", "Stationery store", "1F", null, "문구류 · 컴퓨터용품 · 잡화", "Stationery, computer supplies and goods", "welfare", {
        ...AMENITY,
        details: L(["문구류 · 팬시류 판매"], ["Stationery and fancy goods"]),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("복사실", "Copy room", "1F", null, "인쇄 · 복사 · 제본", "Printing, copying and binding", "welfare", AMENITY),
      o("복사실", "Copy room", "2F", null, "인쇄 · 복사 · 제본", "Printing, copying and binding", "welfare", {
        ...AMENITY,
        details: L(["복사 · 제본(책 · 롤스프링) · 출력(인터넷 검색)"], ["Copying, binding (book, spiral) and printing (internet search)"]),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("주차권 발급(동원안전시스템)", "Parking passes (Dongwon Safety System)", null, "104호", "주차권 신규 발급", "New parking passes", "parking", OFFICE),
    ],
    checkedAt: CHECKED,
  },
  tlc: {
    ...empty,
    name: "교수학습개발원",
    mapName: "교수학습\n개발원",
    nameEn: "Teaching Center",
    use: { ko: "301호에 정보지원팀(강의실 기자재 · 교내 컴퓨터 민원)이 있어요.", en: "The IT Support Team (classroom equipment, campus computer help) is in Room 301." },
    offices: [
      o("정보지원팀", "IT Support Team", null, "301호", "강의실 기자재 관리 · 행사 장비 지원 · 교내 컴퓨터 민원", "Classroom equipment, event AV support and campus computer help", "guide2026", {
        ...OFFICE,
        details: L(["디지털 기자재 대여", "시설 사용신청", "전산기기(컴퓨터 · 프린터 등) 관리"], ["Digital equipment rental", "Facility use requests", "Management of computers, printers and other IT equipment"]),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
    ],
    checkedAt: CHECKED,
  },
  social: {
    ...empty,
    name: "사회과학관",
    nameEn: "Social Sciences Hall",
    use: { ko: "1층에 복사실이 있어요.", en: "There is a copy room on the 1st floor." },
    offices: [
      o("복사실", "Copy room", "1F", null, "인쇄 · 복사 · 제본", "Printing, copying and binding", "welfare", {
        ...AMENITY,
        phone: ["02-2173-3262"],
        details: L(["복사 · 제본(책 · 롤스프링) · 출력(인터넷 검색)"], ["Copying, binding (book, spiral) and printing (internet search)"]),
        extraSrc: { phone: "welfare", details: "lifeguide2026" },
        checkedAt: ADDED,
      }),
    ],
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
      o("원스톱서비스센터", "One-Stop Service Center", "1F", "114호", "증명서 발급", "Certificates", "cert", {
        ...OFFICE,
        phone: ["02-2173-2152~4"],
        details: L(
          ["학부 · 대학원 증명서 발급", "국제학생증 발급", "학적부 기재사항 정정 신청 처리", "습득물 · 분실물 관리", "학생증 재발급(신분증 지참, 무료)"],
          [
            "Undergraduate and graduate certificates",
            "International student ID cards",
            "Corrections to academic records",
            "Lost and found",
            "Student ID card reissue (bring ID, free)",
          ]
        ),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("무인 증명서 발급기", "Certificate kiosk", "1F", null, "원스톱서비스센터 앞, 08:00~20:00", "In front of the One-Stop Service Center, 08:00-20:00", "cert", {
        ...AMENITY,
        hours: L("08:00~20:00", "08:00-20:00"),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("CU 편의점", "CU convenience store", "1F", null, "간식 · 생필품, 택배", "Snacks, daily goods and parcels", "welfare", {
        ...AMENITY,
        details: L(["음료 · 과자류 · 도시락류(간이식품) · 생필품 판매"], ["Drinks, snacks, lunch boxes and daily necessities"]),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("STN 커피", "STN Coffee", "1F", null, "커피 · 음료 · 베이커리", "Coffee, drinks and bakery", "welfare", AMENITY),
      o("기념품점", "Souvenir shop", "1F", null, "외대 · Boo 기념품, 문구류", "HUFS and Boo souvenirs, stationery", "welfare", {
        ...AMENITY,
        details: L(["기념품 · 가방 · 티셔츠 · 상패", "소량 · 단체 주문"], ["Souvenirs, bags, T-shirts and plaques", "Small and group orders"]),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("자동심장충격기(AED)", "AED", "1F", null, "1층 로비", "1st-floor lobby", "health", AMENITY),
      o("보건실", "Health room", "2F", null, "보건 진료", "Basic health care", "health", {
        ...OFFICE,
        phone: ["02-2173-2139"],
        details: L(
          ["응급처치 · 간단한 의약품 제공", "혈압 · 혈당 · 체성분 측정과 상담", "심폐소생술 교육(방학 포함 월 1회)", "행사용 구급함 대여(행사 전 신청)", "학생보험 관리 · 안정실 운영"],
          [
            "First aid and basic medicine",
            "Blood pressure, blood sugar and body composition checks with advice",
            "CPR training (monthly, including vacations)",
            "First-aid kit rental for events (apply in advance)",
            "Student insurance and a rest room",
          ]
        ),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("장애학생지원센터", "Disability Support Center", null, "101호", "장애 학생 지원", "Support for students with disabilities", "disability", {
        ...OFFICE,
        phone: ["02-2173-2133"],
        details: L(
          ["수강신청 등록 지원 · 평가 및 시험 편의", "졸업 외국어인증제 면제", "기숙사 입주 우선선발 지원", "튜터링 · 학습컨설팅 · 도우미(보조인력) 지원", "보조기기 대여 · 상담 · 장학금 지원"],
          [
            "Course registration help, exam and assessment accommodations",
            "Exemption from the graduation foreign language requirement",
            "Priority dormitory selection",
            "Tutoring, learning consulting and student helpers",
            "Assistive device loans, counseling and scholarships",
          ]
        ),
        extraSrc: { phone: "phone", details: "lifeguide2026" },
        checkedAt: ADDED,
      }),
      o("학생상담센터", "Student Counseling Center", null, "345호", "학생 상담", "Student counseling", "counseling", {
        ...OFFICE,
        phone: ["02-2173-3572"],
        details: L(
          ["개인상담(주 1회 50분) · 심리검사", "집단상담 · 열린 상담실", "생명존중 캠페인 · 자살예방 지킴이 교육", "또래상담 · 외국인 유학생 상담(영어 · 중국어)", "재학생 무료 · 비밀 보장, HUFSAbility로 신청"],
          [
            "Individual counseling (50 min weekly) and psychological tests",
            "Group counseling and an open counseling room",
            "Life-respect campaigns and suicide-prevention gatekeeper training",
            "Peer counseling, counseling for international students (English, Chinese)",
            "Free and confidential for enrolled students; apply via HUFSAbility",
          ]
        ),
        extraSrc: { phone: "phone", details: "lifeguide2026" },
        checkedAt: ADDED,
      }),
      o("학생지원팀", "Student Affairs Team", null, "101호", "학생자치기구 · 동아리 활동 지원, 행사 승인", "Support for student government and clubs, event approval", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2133, 2134"],
        details: L(
          [
            "총학생회 · 동아리연합회 등 학생자치기구 지원",
            "중앙동아리 등록 · 승인 · 교비 지원 · 안전교육",
            "학생자치기구 행사 승인(행사 1주 전까지 신청)",
            "방과 후 강의실 사용 신청",
            "비교과(글로벌 봉사단 · HUFS 사회봉사단 등)",
          ],
          [
            "Support for student government such as the student council and club union",
            "Central club registration, approval, funding and safety training",
            "Event approval for student bodies (apply one week ahead)",
            "After-class classroom use requests",
            "Extracurricular programs (global volunteer corps, HUFS volunteer corps, etc.)",
          ]
        ),
        extraSrc: { phone: "phone" },
        checkedAt: ADDED,
      }),
      o("장학팀", "Scholarship Support Team", null, "121호", "장학금 신청 · 상담, 학자금 대출 안내", "Scholarship applications and advice, student loan guidance", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2136~8"],
        details: L(
          ["교내 · 교외 장학금 신청 접수(정해진 기간)", "학기 중 상시 장학 상담", "외부 장학재단 장학금 학교 추천서 발급", "학자금 대출(한국장학재단) 안내"],
          [
            "On-campus and external scholarship applications (set periods)",
            "Scholarship advice throughout the semester",
            "University recommendation letters for external foundations",
            "Student loan guidance (Korea Student Aid Foundation)",
          ]
        ),
        checkedAt: ADDED,
      }),
      o("진로취업지원센터", "Career Development Center", "1F", "122호", "진로 · 취업 상담과 취업 지원 프로그램", "Career and job counseling, employment programs", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2142"],
        details: L(
          [
            "1:1 진로취업상담(1회 50분, 연간 최대 15회)",
            "상담 신청: HUFSAbility, 매주 금 16:30 다음 주 오픈",
            "진로취업 교과목 · 비교과 프로그램",
            "채용설명회 · 캠퍼스 리크루팅 · 추천채용",
            "AI면접실, 진로취업도서 · 면접정장 대여",
          ],
          [
            "1:1 career counseling (50 min per session, up to 15 a year)",
            "Apply on HUFSAbility; next week's slots open Fridays 16:30",
            "Career courses and extracurricular programs",
            "Recruiting sessions, campus recruiting and recommended hiring",
            "AI interview room; career books and interview suit rental",
          ]
        ),
        checkedAt: ADDED,
      }),
      o("현장실습지원센터", "Cooperative Education Center", "1F", "122호", "국내 · 해외 현장실습 운영", "Domestic and overseas internships", "lifeguide2026", {
        ...OFFICE,
        details: L(
          ["학기 중 · 방학 중 국내 현장실습 운영", "선발 학생 실습지원금 · 학점인정", "해외 현장실습 운영", "KOTRA 해외무역관 현장실습"],
          [
            "Domestic internships during the semester and vacations",
            "Internship stipends and credit for selected students",
            "Overseas internships",
            "Internships at KOTRA overseas trade offices",
          ]
        ),
        checkedAt: ADDED,
      }),
      o("창업인재양성센터", "Entrepreneurship Education Center", null, "119호", "학생 창업 교육 · 지원", "Startup education and support for students", "lifeguide2026", {
        ...OFFICE,
        details: L(
          ["창업교과목(학점인정 정규강좌) 개설", "창업특강 · 창업캠프(연 1회, 수료증)", "창업경진대회(연 1회)", "창업동아리 활동 지원금 · 멘토링", "창업휴학(심의 후 일정 기간 휴학 허용)"],
          [
            "Credit-bearing startup courses",
            "Startup lectures and a startup camp (yearly, certificate)",
            "Startup competition (yearly)",
            "Funding and mentoring for startup clubs",
            "Startup leave of absence (after review)",
          ]
        ),
        checkedAt: ADDED,
      }),
      o("인권센터", "HUFS Human Rights Center", null, "346호", "인권침해 상담 · 사건 처리, 폭력예방교육", "Human rights counseling, case handling and violence-prevention education", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-3526"],
        details: L(
          ["법정 폭력예방교육 · 인권침해예방교육", "인권침해 피해상담 · 사건 처리(비밀 보장)", "인권 서포터즈 운영", "인권침해 실태조사 · 인권의식 세미나", "상담 신청: 방문 · 전화 · 이메일 · 온라인"],
          [
            "Mandatory violence-prevention and human rights education",
            "Counseling and case handling for human rights violations (confidential)",
            "Human rights supporters program",
            "Surveys on human rights violations and awareness seminars",
            "Apply in person, by phone, by email or online",
          ]
        ),
        checkedAt: ADDED,
      }),
      o("동아리연합회", null, null, "405호", "학생자치기구(중앙동아리 연합)", "Student body for central clubs", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2831"],
        checkedAt: ADDED,
      }),
      o("국제학사 운영팀", null, null, null, "국제학사(GlobeeDorm) 입사 문의 · 증빙서류 접수", "GlobeeDorm admission inquiries and document submission", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2215~9"],
        details: L(
          ["신청대상: 서울캠퍼스 재학 학부생(여석 시 대학원생)", "신청: 학교 홈페이지 → 국제학사 GlobeeDorm(서울)"],
          ["Eligible: enrolled Seoul Campus undergraduates (graduate students if rooms remain)", "Apply via the university website → GlobeeDorm (Seoul)"]
        ),
        checkedAt: ADDED,
      }),
    ],
    checkedAt: "2026-11-20",
  },
  law: {
    ...empty,
    name: "법학관",
    nameEn: "Law Hall",
    use: { ko: "건물 안내실이 있어요.", en: "Has a building information desk." },
    offices: [
      o("안내실", "Information desk", null, null, "건물 안내", "Building information", "phone", OFFICE),
      o("법학도서관 자료실 · 인터넷정보검색실", null, "2F", null, "법학 자료(9만 3천여 권) 열람 · 대출, 인터넷정보검색", "Law collection (about 93,000 books) and internet search room", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2427"],
        hours: L("평일 09:00~17:00 · 토요일 · 공휴일 폐실", "Weekdays 09:00-17:00 · Closed Saturdays and holidays"),
        checkedAt: ADDED,
      }),
      o("법학도서관 열람실", null, "3F", null, "170석 규모 열람실", "Reading room with 170 seats", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2427"],
        hours: L("24시간 개방(법전원 소속 이용 가능)", "Open 24 hours (Law School members may use it)"),
        checkedAt: ADDED,
      }),
    ],
    checkedAt: "2026-11-20",
  },
  grad: {
    ...empty,
    name: "대학원",
    nameEn: "Graduate School",
    use: { ko: "1층에 카페와 자동심장충격기(AED)가 있어요.", en: "The 1st floor has a café and an AED." },
    offices: [
      o("HUS 동문 커피", "HUS Alumni Coffee", "1F", null, "커피 · 음료", "Coffee and drinks", "welfare", AMENITY),
      o("자동심장충격기(AED)", "AED", "1F", null, "1층 로비", "1st-floor lobby", "health", AMENITY),
    ],
    checkedAt: CHECKED,
  },
  flc: {
    ...empty,
    name: "외국어연수평가원",
    mapName: "외국어\n연수평가원",
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
        "flttc",
        {
          ...OFFICE,
          phone: ["02-2173-2525, 2515, 2557"],
          details: L(
            [
              "영어 · 중국어 · 일본어 · 스페인어 · 프랑스어 · 베트남어 등",
              "정규 20주과정(연 2회, 2월 · 8월)",
              "야간회화과정 · 주말특별과정",
              "방학특별과정(6월 · 12월): 외국어인증 대체과정",
              "기업체 위탁과정(수시)",
            ],
            [
              "English, Chinese, Japanese, Spanish, French, Vietnamese and more",
              "Regular 20-week course (twice a year, February and August)",
              "Evening conversation and weekend courses",
              "Vacation courses (June, December): replace the foreign language requirement",
              "Contract courses for companies (any time)",
            ]
          ),
          extraSrc: "lifeguide2026",
          checkedAt: ADDED,
        }
      ),
      o("FLEX센터", "FLEX Center", null, null, "FLEX(외국어능력시험) 출제 · 시행", "Develops and runs the FLEX foreign language exam", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2532"],
        details: L(
          ["FLEX 7개 언어 시험 출제 · 시행", "iBT-영어 · 중국어 시험 시행 · 운영", "기관맞춤형 어학평가 · 특수외국어능력평가 시행"],
          [
            "Writes and runs FLEX exams in 7 languages",
            "Runs iBT English and Chinese exams",
            "Custom language tests for organizations and critical foreign language tests",
          ]
        ),
        checkedAt: ADDED,
      }),
    ],
    checkedAt: "2026-11-20",
  },
  intl: {
    ...empty,
    name: "국제관",
    nameEn: "International Hall",
    use: { ko: "2층에 카페가 있어요.", en: "There is a café on the 2nd floor." },
    offices: [o("나무라듸오", "Namu Radio café", "2F", null, "커피 · 음료 · 베이커리", "Coffee, drinks and bakery", "welfare", AMENITY)],
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
      o("서울도서관 안내", null, null, null, "서울도서관 이용 문의", "Seoul Library inquiries", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2472~4"],
        details: L(
          [
            "지상 6층 · 지하층, 60만 권 자료실 · 70만 권 보존서고",
            "자유열람실 5개 900석, 특수열람실 159석",
            "컨퍼런스룸 180석, 캐럴 59실, 그룹스터디룸 16실",
            "멀티미디어실(PC 90석 · 노트북 129석), 세미나룸",
            "출입: 학생증 또는 모바일ID(QR · NFC)",
          ],
          [
            "Six floors above ground plus a lower level; stacks for 600,000 and storage for 700,000 volumes",
            "Five reading rooms with 900 seats, special reading rooms with 159 seats",
            "Conference room for 180, 59 carrels, 16 group study rooms",
            "Multimedia room (90 PCs, 129 laptop seats) and seminar rooms",
            "Entry: student ID or mobile ID (QR or NFC)",
          ]
        ),
        checkedAt: ADDED,
      }),
      o("이문일공칠 인더북", "Imun 107 In the Book café", "1F", null, "로비 카페(커피 · 음료 · 베이커리)", "Lobby café", "welfare", AMENITY),
      o("자동심장충격기(AED)", "AED", "1F", null, "1층 로비", "1st-floor lobby", "health", AMENITY),
      o("복사실", "Copy room", "1F", null, "복사", "Copying", "phone", AMENITY),
      o("스마트플라자", null, "1F", null, "노트북 열람실 · 그룹스터디룸 · PC", "Laptop reading room, group study rooms and PCs", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2472"],
        hours: LIB_HOURS,
        details: L(
          ["노트북 열람실(모든 테이블 전원 · 충전)", "그룹스터디룸 16실(4~16인실, 도서관 앱 예약)", "그룹스터디룸마다 모니터 · 글라스보드", "PC 이용(인터넷 · 정보검색 · 문서 작업)"],
          [
            "Laptop reading room (power and charging at every table)",
            "16 group study rooms for 4-16 people (book in the library app)",
            "Monitor and glass board in every group study room",
            "PCs for internet, searching and document work",
          ]
        ),
        checkedAt: ADDED,
      }),
      o("휴플레이스", null, "2F", null, "리클라인 소파 · 빈백 · 평상형 소파 휴게 공간", "Lounge with recliners, beanbags and floor sofas", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2472"],
        checkedAt: ADDED,
      }),
      o("카페라운지", null, null, null, "로비층 개방형 열람공간(학습 · 토론 · 휴식), 카페", "Open study space on the lobby floor (study, discussion, rest) with a café", "lifeguide2026", {
        ...OFFICE,
        checkedAt: ADDED,
      }),
      o("무인반납기", null, null, null, "로비층 · 1층 부출입구에서 도서 직접 반납", "Self-return machines on the lobby floor and at the 1st-floor side entrance", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2474"],
        checkedAt: ADDED,
      }),
      o("일반자료실", "General collection", "3F", null, "정보봉사파트 자료실", "Information services collection", "phone", OFFICE),
      o("반납 창구", null, "3F", null, "도서 반납", "Book returns", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2472"],
        details: L(
          ["학부생 대출: 10권까지, 권당 14일", "권당 2회 연장(홈페이지 My Account)", "도서 예약: 2권까지"],
          ["Undergraduate loans: up to 10 books, 14 days each", "Two renewals per book (My Account on the website)", "Holds: up to 2 books"]
        ),
        checkedAt: ADDED,
      }),
      o("복사실", "Copy room", "3F", null, "복사", "Copying", "phone", AMENITY),
      o("무인 복사실", "Self-service copy room", "1F · 2F · 3F", null, "복사 · 프린트", "Copying and printing", "welfare", AMENITY),
      o("학술연구자료실", "Research collection", "4F", null, "정보봉사파트 자료실", "Information services collection", "phone", {
        ...OFFICE,
        phone: ["02-2173-2480, 2481, 2485"],
        details: L(
          ["참고자료(백과사전 · 연감 · 통계 등), 관외 대출 불가", "학위논문(본교 석 · 박사, 원문 이용)", "정기간행물(학술지 · 신문 등)", "비도서자료(CD-ROM · DVD, 관내 이용)", "필요하면 무인복사기로 복사"],
          [
            "Reference materials (encyclopedias, yearbooks, statistics); no checkout",
            "Theses and dissertations (HUFS master's and doctoral, full text)",
            "Periodicals (journals, newspapers)",
            "Non-book materials (CD-ROM, DVD; in-library use)",
            "Self-service copiers available",
          ]
        ),
        extraSrc: { phone: "phone", details: "lifeguide2026" },
        checkedAt: ADDED,
      }),
      o("열람실 좌석 키오스크", null, "2F · 3F · 4F · 5F", null, "층마다 열람실 입구에 1대, 자유열람실 좌석 배정", "One per reading room entrance on each floor; seat assignment", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2471"],
        details: L(
          ["키오스크 또는 모바일ID 앱으로 좌석 배정", "기본 4시간, 1일 3회까지 연장", "온라인 예약 좌석은 30분 안에 출입게이트 통과"],
          ["Assign a seat at the kiosk or in the mobile ID app", "4 hours by default, up to 3 extensions a day", "Online bookings must pass the entry gate within 30 minutes"]
        ),
        checkedAt: ADDED,
      }),
      o("매점", "Snack shop", "6F", null, "간식 · 음료 판매", "Snacks and drinks", "phone", AMENITY),
      o("국립외교원시험 연구실", null, null, "603호", "외교관후보자 선발시험 준비 고시반", "Study room for the diplomat candidate exam", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2235"],
        details: L(["약 25명 규모, 연 2회 선발(3월 중순 · 9월 중순)", "개인 학습 공간 · 사물함, 수험서적 열람", "합격생 멘토링 · 특강, PSAT 모의고사 지원"], ["About 25 members; selection twice a year (mid-March, mid-September)", "Personal study space, locker and shared exam books", "Mentoring and lectures by past passers, PSAT mock exams"]),
        checkedAt: ADDED,
      }),
      o("임용고시 연구실", null, null, "604호", "중등교사 임용시험 준비 고시반", "Study room for the secondary teacher exam", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2235"],
        details: L(["약 25명 규모, 2월 중순 선발", "개인 좌석 · 사물함, 출결 관리", "임용 관련 서적, 인터넷 강의비 · 도서 · 인쇄 지원"], ["About 25 members; selection in mid-February", "Personal seat and locker, attendance management", "Exam books, online lecture, book and printing support"]),
        checkedAt: ADDED,
      }),
      o("행정고시 연구실(사민재)", null, null, "605호", "행정고시 · 입법고시 등 고등고시 준비", "Study room for the civil service and legislative exams", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2235"],
        details: L(["매년 상반기(3~4월) · 하반기(9~10월) 선발", "개인 지정 좌석 · 사물함", "교수 · 강사 모의고사 · 강평, 시험 스터디 지원"], ["Selection in spring (Mar-Apr) and fall (Sep-Oct)", "Assigned seat and locker", "Mock exams and reviews by professors, study group support"]),
        checkedAt: ADDED,
      }),
      o("CPA시험 연구실(한림정)", null, null, "606호", "공인회계사 시험 준비 고시반", "Study room for the CPA exam", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2235"],
        details: L(["개인 학습 공간 · 사물함, 수험서적 열람", "모의고사 · 서브노트 공유, 강의비 지원"], ["Personal study space, locker and shared exam books", "Mock exams, shared study notes and lecture fee support"]),
        checkedAt: ADDED,
      }),
      o("HUFS Pre-Law School(의향재)", "HUFS Pre-Law School", null, "607호", "법학전문대학원(로스쿨) 진학 준비 고시반", "Study room for law school preparation", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2235"],
        details: L(["연 2회 선발(3월 · 12월)", "개인 학습 공간 · 사물함", "법학적성시험 대비 특강 · 모의고사, 논술 첨삭"], ["Selection twice a year (March, December)", "Personal study space and locker", "LEET lectures and mock exams, essay feedback"]),
        checkedAt: ADDED,
      }),
      o("언론고시 연구실(데모스)", null, null, "608호", "기자 · PD · 아나운서 등 언론사 공채 준비", "Study room for journalist, PD and announcer exams", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2235"],
        details: L(["개인 지정 좌석 · 사물함", "일반도서 · 문제집 · 일간지 열람(약 1,600권)", "현직 언론인의 글쓰기 강의 · 논작문 첨삭"], ["Assigned seat and locker", "Books, workbooks and daily newspapers (about 1,600)", "Writing lectures and essay feedback from journalists"]),
        checkedAt: ADDED,
      }),
      o("빵명장", "Bbang Myeongjang bakery", null, null, "건물 뒤 베이커리 카페", "Bakery café behind the building", "welfare", AMENITY),
      o("자료실 이용시간", "Collection hours", null, null, "학기 중 평일 09:00~21:00, 학기 중 토요일 09:00~17:00, 방학 중 평일·토요일 09:00~17:00, 공휴일 폐실", "Semester weekdays 09:00-21:00, semester Saturdays 09:00-17:00, vacation weekdays and Saturdays 09:00-17:00, closed on holidays", "guide2026", {
        ...OFFICE,
        hours: LIB_HOURS,
        details: L(
          ["일반자료실 · 학술연구자료실 · 스마트플라자 같은 시간", "법정공휴일 휴관", "방학 중 시간은 학교 지침에 따라 바뀔 수 있음(도서관 홈페이지 공지)"],
          ["Same hours for the general and research collections and Smart Plaza", "Closed on public holidays", "Vacation hours may change by university policy (see library notices)"]
        ),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("제1 · 5 자유열람실", null, null, null, "24시간 개방", "Open 24 hours", "lifeguide2026", {
        ...OFFICE,
        hours: L("24시간 개방", "Open 24 hours"),
        checkedAt: ADDED,
      }),
      o("제2~4 자유열람실", null, null, null, "06:00~23:00", "06:00-23:00", "lifeguide2026", {
        ...OFFICE,
        hours: L("06:00~23:00", "06:00-23:00"),
        checkedAt: ADDED,
      }),
      o("시험기간 자유열람실", null, null, null, "시험기간 2주 전부터 제1~5 자유열람실 모두 24시간 개방", "From two weeks before exams, Reading Rooms 1-5 are all open 24 hours", "team1124", {
        ...OFFICE,
        hours: L("시험기간 2주 전부터 24시간 개방", "Open 24 hours from two weeks before exams"),
        checkedAt: ADDED,
      }),
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
      o("우리은행", "Woori Bank", "1F", null, "은행 업무, 학생증 발급", "Banking and student ID cards", "welfare", {
        ...AMENITY,
        details: L(["입출금 · 송금 · 카드발급 · 대출 · 외환 업무"], ["Deposits, transfers, cards, loans and foreign exchange"]),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("하나투어", "Hanatour travel agency", "1F", null, "여행 상담 · 예약", "Travel booking", "welfare", AMENITY),
      o("무인 복사 · 아이스크림", "Self-service copy & ice cream", "1F", null, "무인 복사, 아이스크림", "Self-service copying and ice cream", "welfare", {
        ...AMENITY,
        details: L(["복사 · 제본(책 · 롤스프링) · 출력(밤새출력)"], ["Copying, binding (book, spiral) and printing (overnight printing)"]),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("아트박스(문구)", null, "1F", null, "문구류 · 팬시류 판매", "Stationery and fancy goods", "lifeguide2026", { ...AMENITY, checkedAt: ADDED }),
      o("교직원 식당", "Faculty cafeteria", "2F", null, "한식 · 양식", "Korean and Western meals", "welfare", {
        ...AMENITY,
        phone: ["02-2173-2664"],
        details: L(["일반식: 한식 · 양식 · 예약식", "연회: 한정식 · 양식 · 뷔페(스탠딩뷔페)"], ["Regular meals: Korean, Western, reserved meals", "Banquets: Korean course, Western and standing buffet"]),
        extraSrc: { phone: "welfare", details: "lifeguide2026" },
        checkedAt: ADDED,
      }),
    ],
    checkedAt: CHECKED,
  },
  press: { ...empty, name: "출판부", nameEn: "Univ. Press" },
  gatehouse: {
    ...empty,
    name: "정문안내실",
    mapName: "정문\n안내실",
    nameEn: "Gate Office",
    use: { ko: "정문 안내실이 있어요.", en: "Has the main gate information desk." },
    offices: [
      o("정문 안내실", "Main gate information desk", null, null, "정문 안내", "Main gate information", "phone", OFFICE),
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
      o("학사종합지원센터", "Academic Support Center", null, "105호", "학사 · 학적 업무(수강 · 휴복학 · 졸업 등)", "Academic records, registration, leave and graduation", "academic", {
        ...OFFICE,
        phone: ["02-2173-2130"],
        details: L(
          [
            "수강신청 · 강의개설 · 성적처리 · 계절학기",
            "휴복학 · 재입학 · 자퇴 · 전과 · 제적 · 학사경고",
            "졸업사무(조기졸업 · 학석사 연계과정 등)",
            "이중전공 · 부전공 배정, 국내대학 교류 · 학점인정",
            "외국어인증 제출 · 유고결석계 발급 · 교직과정",
          ],
          [
            "Course registration, course opening, grades and seasonal sessions",
            "Leave, return, readmission, withdrawal, major change, dismissal and academic warnings",
            "Graduation affairs (early graduation, combined BA-MA)",
            "Double major and minor assignment, domestic exchange and credit transfer",
            "Foreign language certificate submission, absence notes and teacher training",
          ]
        ),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("올리브영", "Olive Young", "1F", null, "헬스 · 뷰티 제품", "Health and beauty", "welfare", AMENITY),
      o("아티제", "Artisée café", "1F", null, "커피 · 음료 · 베이커리", "Coffee, drinks and bakery", "welfare", AMENITY),
    ],
    checkedAt: "2026-11-20",
  },

  // 건물이 아닌 공간(광장·운동장·휴게공간)
  square: { ...empty, name: "Minerva Square", nameEn: "Minerva Square" },
  field: { ...empty, name: "대운동장", nameEn: "Main Field" },
  // 좌표가 없어 이번 맵(2026-11 배치)에서는 그리지 않습니다. 위치가 확인되면 onMap을 지우고 campus.js에 넣습니다.
  rest: { ...empty, name: "휴게공간 오디", nameEn: "Odi Lounge", onMap: false },
  // 이름은 HUFS MAP 서울캠퍼스 목록 표기(한국어 · English, 같은 위도 · 경도로 짝지음, 2026-11-22 확인)
  lawn: { ...empty, name: "잔디광장", nameEn: "Open Air Theater" },
  gate: { ...empty, name: "정문 & 진입광장", nameEn: null },
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
// 덧붙인 칸의 근거(extraSrc)도 포함합니다.
export const officeSourceKeys = (office) => {
  const extra = office.extraSrc;
  const extraKeys = !extra ? [] : typeof extra === "string" ? [extra] : Object.values(extra);
  return [...new Set([office.src, ...extraKeys])];
};
export const buildingSources = (info) => [...new Set((info.offices ?? []).flatMap(officeSourceKeys))].map((key) => SOURCES[key]).filter(Boolean);
