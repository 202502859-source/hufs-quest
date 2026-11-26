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
 * offices 한 줄: { name: {ko,en}, floor, room, does: {ko,en}, src, category, phone, hours, details, extraSrc?, checkedAt?, where?, children? }
 * - name.en: 근거에 적힌 영어 공식 표기만. 없으면 null(화면은 한국어 이름으로 대신 보여 줌)
 * - floor: "1F" · "LF"(라운지층, 도서관) · "B1"(지하 1층)처럼 근거에 층이 적혀 있을 때, 여러 층이면 "2F · 3F" · "B1 · B2".
 *   "OUT"은 건물 밖(지금은 도서관 뒤 빵명장 하나, where에 위치 글). 안내 창은 이 값으로 층별 묶음을 만듭니다
 *   (지하 2층 → 지하 1층 → 라운지층 → 1층 → … → 건물 밖 → 층 안내 없음). 도서관은 지하층 줄을 두지 않습니다.
 * - 호수로 층 정하기(11/25 종헌 결정, floorFromRoom): floor가 비어 있고 room이 있으면 room에서 층을 계산합니다.
 *   마지막 두 자리를 뺀 앞자리가 층(321호 → 3F, 1201호 → 12F), 붙은 번호는 무시(101-2호 → 1F, 122-1~6호 → 1F).
 *   "B1-08" · "B2-05"는 지하 그 층(B1 · B2), "B101~B105"는 B 뒤 첫 숫자가 지하 층, 사회과학관 "B001~B007"은 지하 1층(종헌 확정).
 *   floor가 적혀 있고 room으로 계산한 층과 다르면 테스트가 실패합니다(충돌은 바꾸지 말고 보고).
 * - top: true면 층 묶음 위, 목록 맨 위에 묶음 제목 없이 보여 줍니다(건물 전체 안내 한 줄용)
 * - room: "118호" · "B1-08호"처럼 근거에 적힌 그대로 + "호". 없으면 null. 화면 위치는 호실이 있으면 호실만(층 생략)
 * - children: 누르면 아래 목록이 열리는 묶음 줄(층마다 "동아리방", 단과대학). 하위 줄도 같은 형식이고 호실 오름차순으로 보여 줍니다
 * - does: 하는 일 한 줄. 근거 페이지에 적힌 범위 안에서만
 * - src: 아래 SOURCES의 키. 항목마다 근거가 다를 수 있어 줄마다 붙입니다
 * - category: "office"(행정 · 센터 · 도서관 안 시설) · "amenity"(식당 · 카페 · 매점 · 휴게 공간 등 편의시설). 편의시설은 화면에서 이름 뒤에 "(편의시설)"
 * - phone: 전화번호 문자열 배열(근거에 적힌 그대로 "02-2173-2152~4"). 없으면 null. 11/25 규칙(종헌 확정):
 *   010(개인 번호)은 넣지 않음, 0507 업체 안심번호는 넣음, 지역번호 없는 직통(969-0050)은 "02-969-0050", 교내 4자리(2212)는 "02-2173-2212".
 *   전화번호는 이 칸에만 넣습니다(does · details · hours 글에 넣지 않음). 팩스 · 이메일은 넣지 않습니다
 * - hours: 운영시간 { ko, en }. 없으면 null(화면에 "안내 없음")
 * - details: 주요 기능 · 지원 사업 { ko: [], en: [] }. 최대 5줄, 줄마다 40자 안팎. 없으면 null
 * - extraSrc: 기존 줄에 phone · hours · details를 덧붙였거나, 그 칸의 근거가 src와 다를 때 그 칸의 근거.
 *   문자열(덧붙인 칸 모두 같은 근거) 또는 { phone, hours, details, room, floor, does } 칸별 SOURCES 키
 * - checkedAt: 새로 넣거나 덧붙인 줄을 확인한 날("YYYY-MM-DD"). 건물의 checkedAt과 따로 둡니다
 *
 * 규칙
 * - use · offices를 채우면 checkedAt도 같이 채웁니다. 모든 offices 줄에는 src가 있어야 합니다(근거 없는 내용 금지).
 * - 근거는 학교 공식 사이트(*.hufs.ac.kr)만 씁니다. 공식 페이지가 옛 정보일 때만 팀 현장 확인(SOURCES.team)을 씁니다. 두 공식 페이지가 서로 다르면 넣지 않고 PENDING에 적어 둡니다.
 * - 예외: 종헌이 직접 준 외부 주소만 kind: "external" 출처로 씁니다(제목에 "외부 참고", 화면 출처에도 보임). Claude가 찾은 외부 사이트는 쓰지 않습니다.
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
// 11/26 게임 안 신고로 교체(src/ui/mapReportOverlay.js · api/map-report.js): 화면에서 사용 안 함. 되돌릴 수 있게 상수 · reportFormUrl · 테스트는 남겨 둡니다.
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
  // 서울도서관 홈페이지(2026-11-24 확인). 층별 상세는 floor-detail?tabIndex=1(B1F)~8(6F). 로그인 없이 열리는 공개 메뉴입니다.
  libFloor: { title: "서울도서관 홈페이지 > 층별안내", url: "https://lib.hufs.ac.kr/service/facility/floor" },
  libHours: { title: "서울도서관 홈페이지 > 이용시간", url: "https://lib.hufs.ac.kr/service/facility/hours" },
  // 개인스터디룸 이용안내는 홈페이지에서 팝업으로 열려 따로 주소가 없습니다(문구는 이종헌이 홈페이지에서 옮김).
  libStudyRoom: { title: "서울도서관 홈페이지 > 개인스터디룸 이용안내", url: "https://lib.hufs.ac.kr/" },
  // 11/25 추가(#71 피드백)
  team1125: { title: "팀 확인(이종헌, 2026-11-25)", url: null },
  campus3d: { title: "HUFS 3D 복셀 캠퍼스(서울캠퍼스)", url: "https://www.hufs.ac.kr/sites/hufs/campus3d/index.html?campus=seoul" },
  ois: { title: "정보처 > 정보시스템팀", url: "https://ois.hufs.ac.kr/ois/index.do" },
  // 외부 참고: 종헌이 직접 준 주소만(학교 공식 사이트가 아님)
  namuwiki: {
    title: "나무위키(외부 참고) > 한국외국어대학교/서울캠퍼스 > 인문과학관",
    url: "https://namu.wiki/w/%ED%95%9C%EA%B5%AD%EC%99%B8%EA%B5%AD%EC%96%B4%EB%8C%80%ED%95%99%EA%B5%90/%EC%84%9C%EC%9A%B8%EC%BA%A0%ED%8D%BC%EC%8A%A4#s-4.2",
    kind: "external",
  },
  oliveyoung: { title: "올리브영(외부 참고) > 매장 안내", url: "https://www.oliveyoung.co.kr/store/store/store-detail.do?strNo=B205", kind: "external" },
  naverArtisee: { title: "네이버 지도(외부 참고) > 아티제", url: "https://map.naver.com/p/entry/place/33860204", kind: "external" },
  naverBread: { title: "네이버 지도(외부 참고) > 빵명장", url: "https://map.naver.com/p/entry/place/1149726279", kind: "external" },
  naverNamuRadio: { title: "네이버 지도(외부 참고) > 나무라듸오", url: "https://map.naver.com/p/entry/place/1811791118", kind: "external" },
  naverHufsCoffee: { title: "네이버 지도(외부 참고) > HUFS동문커피", url: "https://map.naver.com/p/entry/place/1880518736", kind: "external" },
};

// 공식 페이지끼리 다르거나 건물이 분명하지 않아 아직 넣지 않은 것입니다. 확인되면 offices로 옮기고 여기서 지웁니다.
export const PENDING = [
  "전화안내의 '1층안내데스크 · 2층안내데스크': 건물 이름이 적혀 있지 않음",
  "진로취업지원센터 · 국제교류팀 · 학생지원팀: 공식 페이지에서 위치를 찾지 못함",
  "Minerva Complex(오바마홀): 전화안내(전기실만 기재), 공식 캠퍼스맵, 2026 신입생 대학생활안내 PDF 확인했으나 층·호수 및 입주 시설 공식 안내 미기재 → 동아리방은 lifeguide2026 76~77p로 확인(11/25). 11/25 종헌 확인: B1·B2 대강당(오바마홀, 존재는 공식 3D 복셀 캠퍼스)",
  "출판부: 전화안내(동일 명칭 없음) 및 공식 캠퍼스맵 확인했으나 층·호수·용도 설명 미기재",
  "역사관(역사기념관): 전화안내(동일 명칭 없음) 및 공식 캠퍼스맵 확인했으나 층·호수·용도 설명 미기재",
  "교수연구동: 전화안내에 '제1교수연구동 안내실'로 표기되어 있으나 맵 건물이 제1교수연구동인지 확인 근거가 없어 PENDING 이동",
  "정문 & 진입광장 영어 이름: HUFS MAP English 목록에서 같은 위도 · 경도의 항목이 'Main(Administration) Building'(본관 이름)으로 적혀 있어 오기로 보고 넣지 않음(2026-11-22 확인). 확인 전에는 화면에 한국어 이름",
  "원스톱서비스센터 호수:원스톱 사이트(dep.hufs.ac.kr/onestop)는 118호, 증명서 페이지(학생지원 > 증명서)는 국제학사 1층 114호 → 114호로 확정(이종헌 확인, 2026-11-20). 원스톱 사이트는 옛 정보",
];

const CHECKED = "2026-11-19";

// 호수로 층 정하기(11/25 종헌 결정). "321호" → "3F", "B1-08호" → "B1", "B105호" → "B1", "B001호" → "B1"(종헌 확정). 못 읽으면 null
export function floorFromRoom(room) {
  if (!room) return null;
  const text = String(room).replace(/호$/, "");
  let m = /^B(\d)-\d+/.exec(text);
  if (m) return `B${m[1]}`;
  m = /^B(\d)\d{2}$/.exec(text);
  if (m) return m[1] === "0" ? "B1" : `B${m[1]}`;
  m = /^(\d+)(\d{2})(-[\d~]+)?$/.exec(text);
  if (m) return `${Number(m[1])}F`;
  return null;
}
const empty = { use: null, offices: [], checkedAt: null, status: "open" };
// o(...)의 앞 7개 인자는 예전 그대로이고, 8번째 extra로 category · phone · hours · details · extraSrc · checkedAt을 받습니다.
const o = (ko, en, floor, room, doesKo, doesEn, src, extra = {}) => ({
  name: { ko, en },
  floor: floor ?? floorFromRoom(room),
  room,
  does: { ko: doesKo, en: doesEn },
  src,
  category: extra.category ?? null,
  phone: extra.phone ?? null,
  hours: extra.hours ?? null,
  details: extra.details ?? null,
  ...(extra.extraSrc ? { extraSrc: extra.extraSrc } : {}),
  ...(extra.checkedAt ? { checkedAt: extra.checkedAt } : {}),
  ...(extra.top ? { top: true } : {}),
  ...(extra.where ? { where: extra.where } : {}),
  ...(extra.children ? { children: extra.children } : {}),
});
const OFFICE = { category: "office" };
const AMENITY = { category: "amenity" };
const L = (ko, en) => ({ ko, en }); // hours · details 한/영 묶음
const ADDED = "2026-11-24"; // lifeguide2026 · team1124로 새로 넣거나 덧붙인 날
const ADDED_1125 = "2026-11-25"; // #71 피드백(AED 삭제 · 88p 전화 · 동아리방 · 학과사무실 · 외부 참고)으로 넣거나 고친 날

// ── 동아리방(lifeguide2026 76~77p 서울캠퍼스 동아리 현황, 표 그대로) ──
// [동아리명, 위치(건물 표기 그대로), 호실, 활동내용, 분과]. 동아리연합회(국제학사 405호)는 union에 따로 둡니다.
const CLUBS = [
  ["세레브로", "국제학사", "313", "보드게임", "생활·문화"],
  ["그림촌", "국제학사", "312", "순수미술", "생활·문화"],
  ["앵글스", "국제학사", "316", "사진촬영", "생활·문화"],
  ["목요음악반", "국제학사", "440", "클래식 음악 감상", "생활·문화"],
  ["영화울림", "국제학사", "442", "영화 제작 및 감상", "생활·문화"],
  ["Humans of HUFS", "국제학사", "427", "평범한 사람들의 특별한 이야기(인터뷰)", "생활·문화"],
  ["해갈", "지하캠퍼스", "B1-04", "서브컬쳐", "생활·문화"],
  ["The Moda", "국제학사", "231", "패션", "생활·문화"],
  ["기우회", "지하캠퍼스", "B1-08", "바둑", "생활·문화"],
  ["POSTRADE", "국제학사", "320", "증권 투자 연구", "응용·학술"],
  ["AIESEC", "국제학사", "321", "국제리더십학생협회", "응용·학술"],
  ["TIME", "국제학사", "342", "TIME지를 통한 영어 및 국제 시사 공부", "응용·학술"],
  ["KUSEA", "국제학사", "343", "한국대학생경제학회", "응용·학술"],
  ["OLIVO(에스페란토)", "국제학사", "447", "에스페란토어 연구", "응용·학술"],
  ["인액터스", "국제학사", "319", "사회적 책임감을 갖춘 실천형 비즈니스 창업 단체", "응용·학술"],
  ["마술피리", "국제학사", "431", "마케팅 학회", "응용·학술"],
  ["멋쟁이사자처럼", "국제학사", "435", "IT창업(코딩)", "응용·학술"],
  ["만리행", "국제학사", "318", "지역답사 자전거 여행", "응용·학술"],
  ["MAST", "국제학사", "434", "경영전략학회", "응용·학술"],
  ["얼소리", "국제학사", "404", "국악(관현악, 성악)", "공연"],
  ["취현", "국제학사", "436", "클래식 기타", "공연"],
  ["HUFSPhil", "국제학사", "438", "오케스트라", "공연"],
  ["외대연극회", "국제학사", "441", "연극 공연", "공연"],
  ["HUFSDOVY", "사회과학관", "B004", "힙합(랩/댄스)", "공연"],
  ["재인", "사회과학관", "B005", "댄스", "공연"],
  ["라온", "지하캠퍼스", "B2-05", "뮤지컬 공연", "공연"],
  ["노래나래", "지하캠퍼스", "B2-09", "어쿠스틱, 인디, 팝송 커버 및 자작곡 공연", "공연"],
  ["외인부대", "지하캠퍼스", "B2-11", "락 밴드", "공연"],
  ["F.A.", "지하캠퍼스", "B2-13", "사운드 엔지니어링 밴드", "공연"],
  ["새물결", "지하캠퍼스", "B2-17", "다양한 장르의 밴드", "공연"],
  ["외대합창단", "지하캠퍼스", "B2-18", "합창", "공연"],
  ["아이기스", "국제학사", "428", "응원단", "공연"],
  ["태권도부", "교수학습개발원", "B1-04", "태권도", "체육 1"],
  ["산악부", "국제학사", "304-1", "등산, 등반", "체육 1"],
  ["검도부", "국제학사", "322", "검도", "체육 1"],
  ["수영부", "국제학사", "419", "수영", "체육 1"],
  ["Airo F.F(스노우보드부)", "국제학사", "423", "스노우보드", "체육 1"],
  ["러너스하이", "국제학사", "448", "런닝", "체육 1"],
  ["복싱부", "국제학사", "B105", "복싱", "체육 1"],
  ["조정부", "국제학사", "B103", "조정", "체육 1"],
  ["훕스 라이딩", "지하캠퍼스", "B1-09", "자전거 나들이", "체육 1"],
  ["펜싱부", "국제학사", "317", "펜싱", "체육 1"],
  ["유도부 하랑", "국제학사", "B104", "유도", "체육 1"],
  ["PLUTO(볼링부)", "국제학사", "420", "볼링", "체육 2"],
  ["Black Knights(미식축구부)", "국제학사", "445", "미식축구", "체육 2"],
  ["탁구부", "국제학사", "B101", "탁구", "체육 2"],
  ["테니스부", "사회과학관", "B001", "테니스", "체육 2"],
  ["농구부", "사회과학관", "B002", "농구", "체육 2"],
  ["핸드볼부", "사회과학관", "B003", "핸드볼", "체육 2"],
  ["야구부", "사회과학관", "B006", "야구", "체육 2"],
  ["축구부", "사회과학관", "B007", "축구", "체육 2"],
  ["불교학생회", "국제학사", "421", "불교", "종교·봉사"],
  ["KR BUDDY", "국제학사", "422", "외국인과 투어 및 교류", "종교·봉사"],
  ["KUSA", "국제학사", "432", "교육 봉사", "종교·봉사"],
  ["로타랙트", "국제학사", "433", "봉사", "종교·봉사"],
  ["세인트", "국제학사", "449", "가톨릭", "종교·봉사"],
  ["칠하담", "국제학사", "344", "벽화봉사", "종교·봉사"],
  ["CCC", "국제학사", "424", "기독교 (전도)", "종교·봉사"],
  ["IVF", "국제학사", "425", "기독교 (복음 운동)", "종교·봉사"],
  ["해외문학회", "국제학사", "443", "해외 문학 연구", "인문·사회"],
  ["노곳떼", "국제학사", "444", "토론", "인문·사회"],
  ["국제관계연구회", "국제학사", "446", "국제 관계 연구", "인문·사회"],
  ["HDS", "국제학사", "426", "의회식 영어 토론 동아리", "인문·사회"],
  ["외대문학회", "국제학사", "430", "문학 연구", "인문·사회"],
  ["마르크스 정치경제학회 왼쪽날개", "국제학사", "429", "사회과학 연구", "인문·사회"],
  ["외대법학회", "지하캠퍼스", "B1-07", "법 연구", "인문·사회"],
];
export const CLUB_COUNT = CLUBS.length;
const CLUB_BUILDING = { 국제학사: "union", 사회과학관: "social", 지하캠퍼스: "minerva", 교수학습개발원: "tlc" };
const DIVISION_EN = {
  "생활·문화": "Life & Culture",
  "응용·학술": "Applied & Academic",
  공연: "Performance",
  "체육 1": "Sports 1",
  "체육 2": "Sports 2",
  "종교·봉사": "Religion & Service",
  "인문·사회": "Humanities & Social",
};

// 호실 정렬 키: [층(지하는 음수), 호실 번호, 붙은 번호]. "304-1" → [3, 4, 1], "B1-08" → [-1, 8, 0], "B101" → [-1, 1, 0]
export function roomSortKey(room) {
  const text = String(room ?? "").replace(/호$/, "");
  let m = /^B(\d)-(\d+)/.exec(text);
  if (m) return [-Number(m[1]), Number(m[2]), 0];
  m = /^B(\d)(\d{2})$/.exec(text);
  if (m) return [-(Number(m[1]) || 1), Number(m[2]), 0];
  m = /^(\d+)(\d{2})(?:-(\d+))?/.exec(text);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  return [Infinity, 0, 0];
}
export const byRoom = (a, b) => {
  const [x, y] = [roomSortKey(a.room), roomSortKey(b.room)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

const club = ([name, , room, does, division]) =>
  o(name, null, null, `${room}호`, does, null, "lifeguide2026", {
    ...OFFICE,
    details: L(["동아리 활동 지원 및 운영", `분과: ${division}`], ["Club activities and operations", `Division: ${DIVISION_EN[division]}`]),
    checkedAt: ADDED_1125,
  });
// 그 건물의 동아리를 층마다 "동아리방" 묶음 하나로(하위 목록은 호실 오름차순)
function clubRooms(buildingId) {
  const byFloor = new Map();
  for (const row of CLUBS.filter((r) => CLUB_BUILDING[r[1]] === buildingId)) {
    const item = club(row);
    if (!byFloor.has(item.floor)) byFloor.set(item.floor, []);
    byFloor.get(item.floor).push(item);
  }
  return [...byFloor].map(([floor, items]) =>
    o("동아리방", "Club rooms", floor, null, `동아리방 ${items.length}곳`, `${items.length} club rooms`, "lifeguide2026", {
      ...OFFICE,
      children: items.sort(byRoom),
      checkedAt: ADDED_1125,
    })
  );
}

// ── 학과(부) 사무실(lifeguide2026 80p 서울캠퍼스 표, 국번 02-2173-) ──
// [단과대학, 학과, 위치(표기 그대로), 호실, 전화 4자리]. 대학본부 = 본관(main)
const DEPTS = [
  ["영어대학", "ELLT학과", "대학본부", "415", "2266"],
  ["영어대학", "영미문학·문화학과", "대학본부", "416", "2267"],
  ["영어대학", "영어통번역학과", "대학본부", "417", "2268"],
  ["서양어대학", "프랑스어학부", "대학본부", "325", "2282"],
  ["서양어대학", "독일어과", "대학본부", "323", "2283"],
  ["서양어대학", "노어과", "대학본부", "321", "2284"],
  ["서양어대학", "스페인어과", "대학본부", "334", "2285"],
  ["서양어대학", "이탈리아어과", "대학본부", "337", "2286"],
  ["서양어대학", "포르투갈어과", "대학본부", "336", "2287"],
  ["서양어대학", "네덜란드어과", "대학본부", "307", "2288"],
  ["서양어대학", "스칸디나비아어과", "대학본부", "332", "2289"],
  ["아시아언어문화대학", "말레이·인도네시아어과", "대학본부", "312", "2298"],
  ["아시아언어문화대학", "아랍어과", "대학본부", "308", "2304"],
  ["아시아언어문화대학", "태국어과", "대학본부", "314", "2299"],
  ["아시아언어문화대학", "베트남어과", "대학본부", "313", "2300"],
  ["아시아언어문화대학", "인도어과", "대학본부", "318", "2301"],
  ["아시아언어문화대학", "튀르키예·아제르바이잔학과", "대학본부", "319", "2302"],
  ["아시아언어문화대학", "페르시아어·이란학과", "대학본부", "320", "2303"],
  ["아시아언어문화대학", "몽골어과", "대학본부", "309", "2415"],
  ["중국학대학", "중국언어문화학부", "대학본부", "311", "2296"],
  ["중국학대학", "중국외교통상학부", "대학본부", "424", "2295"],
  ["일본학대학", "일본언어문화학부", "대학본부", "310", "2297"],
  ["일본학대학", "융합일본지역학부", "대학본부", "410", "2442"],
  ["사회과학대학", "정치외교학과", "사회과학관", "101-2", "2312"],
  ["사회과학대학", "행정학과", "사회과학관", "102", "2313"],
  ["사회과학대학", "미디어커뮤니케이션학부", "사회과학관", "103-2", "2314"],
  ["상경대학", "국제통상학과", "사회과학관", "109", "2332"],
  ["상경대학", "경제학부", "사회과학관", "108", "2333"],
  ["경영대학", "경영학부", "사이버관", "503", "2334"],
  ["사범대학", "영어교육과", "대학본부", "406", "2342"],
  ["사범대학", "한국어교육과", "대학본부", "407", "2345"],
  ["사범대학", "외국어교육학부(프랑스어교육전공)", "대학본부", "409", "2343"],
  ["사범대학", "외국어교육학부(독일어교육전공)", "대학본부", "408", "2344"],
  ["사범대학", "외국어교육학부(중국어교육전공)", "대학본부", "421", "3236"],
  ["AI융합대학", "Language & AI융합학부", "대학본부", "422", "2278"],
  ["AI융합대학", "Social Science & AI융합학부", "대학본부", "423", "2769"],
  ["국제학부", "국제학전공", "사회과학관", "101-4", "3315"],
  ["Language & Diplomacy학부", "Language&Diplomacy전공", "사회과학관", "105-1", "2478"],
  ["Language & Trade학부", "Language&Trade전공", "사회과학관", "104-2", "3350"],
  // 본관 9층: 공식 3D 복셀 캠퍼스 본관 "지상 13층"으로 9층 확인(11/25 종헌 결정)
  ["KFL학부", "외국어로서의한국어교육전공", "대학본부", "902", "2477"],
  ["KFL학부", "외국어로서의한국어통번역전공", "대학본부", "902", "2477"],
  ["자유전공학부", "자유전공학부(서울)", "대학본부", "114-1", "3510"],
];
export const DEPT_COUNT = DEPTS.length;
const DEPT_BUILDING = { 대학본부: "main", 사회과학관: "social", 사이버관: "cyber" };
const dept = ([, name, , room, tel]) =>
  o(name, null, null, `${room}호`, "학과(부) 사무실", "Department office", "lifeguide2026", {
    ...OFFICE,
    phone: [`02-2173-${tel}`],
    details: L(["해당 학과의 행정 업무 처리 및 학과 운영 지원"], ["Administrative work and support for the department"]),
    checkedAt: ADDED_1125,
  });
// 그 건물의 학과 사무실을 층 → 단과대학 묶음으로. 같은 단과대학이 여러 층에 있으면 층마다 따로(그 층 학과만)
function deptOffices(buildingId) {
  const groups = new Map();
  for (const row of DEPTS.filter((r) => DEPT_BUILDING[r[2]] === buildingId)) {
    const item = dept(row);
    const key = `${item.floor}|${row[0]}`;
    if (!groups.has(key)) groups.set(key, { college: row[0], floor: item.floor, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()]
    .map(({ college, floor, items }) => {
      items.sort(byRoom);
      return o(college, null, floor, null, `학과(부) 사무실 ${items.length}곳`, `${items.length} department offices`, "lifeguide2026", {
        ...OFFICE,
        children: items,
        checkedAt: ADDED_1125,
      });
    })
    .sort((a, b) => byRoom(a.children[0], b.children[0]));
}
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
      ko: "1층 안내실, 교육혁신원(303호), 정보시스템팀(446호)과 여러 학과(부) 사무실이 있어요.",
      en: "Home to the 1st-floor information desk, the Institute for Educational Innovation (Room 303), the Information Systems Team (Room 446) and many department offices.",
    },
    offices: [
      o("안내실", "Information desk", "1F", null, "건물 안내", "Building information", "health", OFFICE),
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
      // 하는 일은 정보처 사이트 "업무별 연락처" 목록을 요약한 문장(11/25 종헌 확인), 주요 기능은 그 목록 5줄
      o("정보시스템팀", "Information Systems Team", null, "446호", "학사·행정 정보시스템 운영", "Runs academic and administrative information systems", "ois", {
        ...OFFICE,
        phone: ["02-2173-2228"],
        details: L(
          ["수업 · 졸업", "성적 · 계절학기 · 강의평가", "학적 · 등록 · 전공 · 교직 · 증명", "FLEX · 전자결재", "e-Class · 모바일 · 전자출결"],
          ["Classes and graduation", "Grades, seasonal sessions and course evaluations", "Academic records, enrollment, majors, teacher training and certificates", "FLEX and e-approval", "e-Class, mobile and e-attendance"]
        ),
        checkedAt: ADDED_1125,
      }),
      ...deptOffices("main"),
    ],
    checkedAt: ADDED_1125,
  },
  humanities: {
    ...empty,
    name: "인문과학관",
    mapName: "인문\n과학관",
    nameEn: "Humanities Hall",
    use: {
      ko: "1층에 학생 식당 · 우편취급국 · 문구점 · 복사실, 2층에 대강당이 있어요.",
      en: "The 1st floor has the student cafeteria, post office, stationery store and copy room; the main auditorium is on the 2nd floor.",
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
        phone: ["02-960-1311", "02-2173-2661"],
        details: L(["우편 업무 · 각종 금융서비스"], ["Postal services and financial services"]),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("문구점", "Stationery store", "1F", null, "문구류 · 컴퓨터용품 · 잡화", "Stationery, computer supplies and goods", "welfare", {
        ...AMENITY,
        phone: ["02-2173-2733"],
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
      o("대강당", null, "2F", null, "강연·공연 및 시험 장소", "Lectures, performances and exams", "namuwiki", { ...OFFICE, checkedAt: ADDED_1125 }),
    ],
    checkedAt: ADDED_1125,
  },
  tlc: {
    ...empty,
    name: "교수학습개발원",
    mapName: "교수학습\n개발원",
    nameEn: "Teaching Center",
    use: {
      ko: "301호에 정보지원팀(강의실 기자재 · 교내 컴퓨터 민원)이 있고, 지하 1층에 동아리방이 있어요.",
      en: "The IT Support Team (classroom equipment, campus computer help) is in Room 301, and there is a club room on B1.",
    },
    offices: [
      o("정보지원팀", "IT Support Team", null, "301호", "강의실 기자재 관리 · 행사 장비 지원 · 교내 컴퓨터 민원", "Classroom equipment, event AV support and campus computer help", "guide2026", {
        ...OFFICE,
        details: L(["디지털 기자재 대여", "시설 사용신청", "전산기기(컴퓨터 · 프린터 등) 관리"], ["Digital equipment rental", "Facility use requests", "Management of computers, printers and other IT equipment"]),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      ...clubRooms("tlc"),
    ],
    checkedAt: ADDED_1125,
  },
  social: {
    ...empty,
    name: "사회과학관",
    nameEn: "Social Sciences Hall",
    use: {
      ko: "1층에 복사실과 학과(부) 사무실, 지하 1층에 동아리방이 있어요.",
      en: "The 1st floor has a copy room and department offices; club rooms are on B1.",
    },
    offices: [
      o("복사실", "Copy room", "1F", null, "인쇄 · 복사 · 제본", "Printing, copying and binding", "welfare", {
        ...AMENITY,
        phone: ["02-2173-3262"],
        details: L(["복사 · 제본(책 · 롤스프링) · 출력(인터넷 검색)"], ["Copying, binding (book, spiral) and printing (internet search)"]),
        extraSrc: { phone: "welfare", details: "lifeguide2026" },
        checkedAt: ADDED,
      }),
      ...deptOffices("social"),
      ...clubRooms("social"),
    ],
    checkedAt: ADDED_1125,
  },
  // 공식 페이지는 이 건물을 "국제학사(기숙사 및 학생회관)"로 부릅니다(장애학생지원 > 주요시설 및 설비). 이름은 11/19 이종헌 결정.
  // 이름을 바꾸면 "실제와 달라요" 구글 폼 1번 드롭다운 항목도 같은 이름으로 고쳐야 미리 채우기가 됩니다.
  union: {
    ...empty,
    name: "국제학사 및 학생회관",
    nameEn: "GlobeeDorm & Student Union",
    use: {
      ko: "1층에 원스톱서비스센터(증명서)가 있고, 지하 1층 · 2~4층에 동아리방이 있어요.",
      en: "The One-Stop Service Center (certificates) is on the 1st floor; club rooms are on B1 and the 2nd-4th floors.",
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
        phone: ["02-957-3263"],
        details: L(["음료 · 과자류 · 도시락류(간이식품) · 생필품 판매"], ["Drinks, snacks, lunch boxes and daily necessities"]),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("STN 커피", "STN Coffee", "1F", null, "커피 · 음료 · 베이커리", "Coffee, drinks and bakery", "welfare", {
        ...AMENITY,
        phone: ["02-957-2793"],
        extraSrc: { phone: "lifeguide2026" },
        checkedAt: ADDED_1125,
      }),
      o("기념품점", "Souvenir shop", "1F", null, "외대 · Boo 기념품, 문구류", "HUFS and Boo souvenirs, stationery", "welfare", {
        ...AMENITY,
        phone: ["02-2173-2212"],
        details: L(["기념품 · 가방 · 티셔츠 · 상패", "소량 · 단체 주문"], ["Souvenirs, bags, T-shirts and plaques", "Small and group orders"]),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
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
      o("국제학사 운영팀", null, null, "111호", "국제학사(GlobeeDorm) 입사 문의 · 증빙서류 접수", "GlobeeDorm admission inquiries and document submission", "lifeguide2026", {
        ...OFFICE,
        phone: ["02-2173-2215~9"],
        extraSrc: { room: "team1125" },
        details: L(
          ["신청대상: 서울캠퍼스 재학 학부생(여석 시 대학원생)", "신청: 학교 홈페이지 → 국제학사 GlobeeDorm(서울)"],
          ["Eligible: enrolled Seoul Campus undergraduates (graduate students if rooms remain)", "Apply via the university website → GlobeeDorm (Seoul)"]
        ),
        checkedAt: ADDED_1125,
      }),
      ...clubRooms("union"),
    ],
    checkedAt: ADDED_1125,
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
    use: { ko: "1층에 카페가 있어요.", en: "The 1st floor has a café." },
    offices: [
      // 이름은 lifeguide2026 88p 표기(11/25 종헌 결정). 88p 번호는 010이라 넣지 않음
      // 운영시간 · 비고는 네이버 지도(외부 참고, 11/25 종헌 확인). 전화는 010이라 넣지 않음
      o("HUFS동문커피", "HUFS Alumni Coffee", "1F", null, "커피 · 음료", "Coffee and drinks", "lifeguide2026", {
        ...AMENITY,
        hours: L("월~목 08:30~20:30, 금 08:30~18:30, 토 08:30~14:00, 일 정보 없음", "Mon-Thu 08:30-20:30, Fri 08:30-18:30, Sat 08:30-14:00, Sun no info"),
        details: L(["행사·시험 기간에는 연장 영업"], ["Extended hours during events and exams"]),
        extraSrc: { hours: "naverHufsCoffee", details: "naverHufsCoffee" },
        checkedAt: ADDED_1125,
      }),
    ],
    checkedAt: ADDED_1125,
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
    offices: [
      // 운영시간은 네이버 지도(외부 참고, 11/25 종헌 확인). 전화는 010이라 넣지 않음
      o("나무라듸오", "Namu Radio café", "2F", null, "커피 · 음료 · 베이커리", "Coffee, drinks and bakery", "welfare", {
        ...AMENITY,
        hours: L(
          "월~금 08:30~16:30 (브레이크타임 11:20~11:50, 라스트오더 16:00), 토·일 정기휴무",
          "Mon-Fri 08:30-16:30 (break 11:20-11:50, last order 16:00), closed Sat-Sun"
        ),
        extraSrc: { hours: "naverNamuRadio" },
        checkedAt: ADDED_1125,
      }),
    ],
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
      o("서울캠퍼스 도서관 안내", null, null, null, "서울캠퍼스 도서관 이용 문의", "Seoul Campus Library inquiries", "lifeguide2026", {
        ...OFFICE,
        top: true,
        phone: ["02-2173-2472~4"],
        hours: LIB_HOURS,
        details: L(
          [
            "지상 6층, 60만 권 자료실 · 70만 권 보존서고",
            "자유열람실 5개 900석, 특수열람실 159석",
            "컨퍼런스룸 180석, 캐럴 59실, 그룹스터디룸 16실",
            "멀티미디어실(PC 90석 · 노트북 129석), 세미나룸",
            "출입: 학생증 또는 모바일ID(QR · NFC)",
          ],
          [
            "Six floors above ground; stacks for 600,000 and storage for 700,000 volumes",
            "Five reading rooms with 900 seats, special reading rooms with 159 seats",
            "Conference room for 180, 59 carrels, 16 group study rooms",
            "Multimedia room (90 PCs, 129 laptop seats) and seminar rooms",
            "Entry: student ID or mobile ID (QR or NFC)",
          ]
        ),
        extraSrc: { hours: "team1124" },
        checkedAt: ADDED,
      }),
      // 6F (서울도서관 홈페이지 층별안내)
      o("공공인재개발원", null, "6F", null, "국가고시 준비 연구실(고시반) · 공공인재열람실 · 세미나실 · 운영팀", "National exam study rooms, public service reading room, seminar room and office", "libFloor", {
        ...OFFICE,
        phone: ["02-2173-2235"],
        details: L(
          ["국립외교원시험 · 임용고시 · 행정고시(사민재) 연구실", "CPA시험(한림정) · 언론고시(데모스) 연구실", "HUFS Pre-Law School(의향재)", "연구실마다 선발, 개인 학습 공간 · 사물함 제공"],
          [
            "Study rooms for the diplomat, teacher and civil service (Saminjae) exams",
            "Study rooms for the CPA (Hallimjeong) and media (Demos) exams",
            "HUFS Pre-Law School (Uihyangjae)",
            "Members selected by each room; personal study space and lockers",
          ]
        ),
        extraSrc: { phone: "lifeguide2026", details: "lifeguide2026" },
        checkedAt: ADDED,
      }),
      o("캐럴", null, "6F", null, "캐럴 51실", "51 carrels", "libFloor", {
        ...OFFICE,
        hours: L("24시간 개방(평일 · 토요일 · 공휴일)", "Open 24 hours (weekdays, Saturdays, holidays)"),
        extraSrc: { hours: "libHours" },
        checkedAt: ADDED,
      }),
      // 5F
      o("제1자유열람실", null, "5F", null, "칸막이형 · 오픈형 열람테이블, 480석 규모", "Partitioned and open tables, about 480 seats", "libFloor", {
        ...OFFICE,
        hours: L("24시간 개방(평일 · 토요일 · 공휴일)", "Open 24 hours (weekdays, Saturdays, holidays)"),
        extraSrc: { hours: "libHours" },
        checkedAt: ADDED,
      }),
      o("제5자유열람실", null, "5F", null, "칸막이형 · 오픈형 열람테이블, 100석 규모", "Partitioned and open tables, about 100 seats", "libFloor", {
        ...OFFICE,
        hours: L("24시간 개방(평일 · 토요일 · 공휴일)", "Open 24 hours (weekdays, Saturdays, holidays)"),
        extraSrc: { hours: "libHours" },
        checkedAt: ADDED,
      }),
      o("개인스터디룸(캐럴)", null, "5F", null, "1인 독실 스터디룸 8실, 컨퍼런스홀 입구 쪽 복도", "8 single-person study rooms in the hallway by the conference hall", "libStudyRoom", {
        ...OFFICE,
        hours: L("학기 중 평일 09:00~17:00 · 토요일 · 공휴일 휴실", "Semester weekdays 09:00-17:00 · Closed Saturdays and holidays"),
        details: L(
          ["도서관 홈페이지 · 모바일 앱에서 예약 후 이용", "예약 시간에서 10분 지나도 이용하지 않으면 자동 취소"],
          ["Book on the library website or mobile app", "Bookings are cancelled if unused 10 minutes after the start time"]
        ),
        extraSrc: { hours: "libHours" },
        checkedAt: ADDED,
      }),
      o("컨퍼런스룸", null, "5F", null, "180석 규모", "About 180 seats", "libFloor", { ...OFFICE, checkedAt: ADDED }),
      // 4F
      o("제4자유열람실", null, "4F", null, "칸막이형 · 오픈형 열람테이블, 100석 규모", "Partitioned and open tables, about 100 seats", "libFloor", {
        ...OFFICE,
        hours: L("06:00~23:00(평일 · 토요일 · 공휴일)", "06:00-23:00 (weekdays, Saturdays, holidays)"),
        details: L(["비고: 학교 공식 시험기간에는 24시간 개방"], ["Note: open 24 hours during official exam periods"]),
        extraSrc: { hours: "libHours", details: "team1124" },
        checkedAt: ADDED,
      }),
      // 3F
      o("제3자유열람실", null, "3F", null, "칸막이형 · 오픈형 열람테이블, 100석 규모", "Partitioned and open tables, about 100 seats", "libFloor", {
        ...OFFICE,
        hours: L("06:00~23:00(평일 · 토요일 · 공휴일)", "06:00-23:00 (weekdays, Saturdays, holidays)"),
        details: L(["비고: 학교 공식 시험기간에는 24시간 개방"], ["Note: open 24 hours during official exam periods"]),
        extraSrc: { hours: "libHours", details: "team1124" },
        checkedAt: ADDED,
      }),
      o("학술정보팀 정보봉사파트", null, "3F", null, "자료 대출 · 반납, 이용자 정보서비스", "Book loans and returns, user information services", "libFloor", {
        ...OFFICE,
        phone: ["02-2173-2471"],
        details: L(
          ["학부생 대출: 10권까지, 권당 14일", "권당 2회 연장(홈페이지 My Account)", "도서 예약: 2권까지"],
          ["Undergraduate loans: up to 10 books, 14 days each", "Two renewals per book (My Account on the website)", "Holds: up to 2 books"]
        ),
        extraSrc: { phone: "libHours", details: "lifeguide2026" },
        checkedAt: ADDED,
      }),
      // 2F
      o("제2자유열람실", null, "2F", null, "칸막이형 · 오픈형 열람테이블, 80석 규모", "Partitioned and open tables, about 80 seats", "libFloor", {
        ...OFFICE,
        hours: L("06:00~23:00(평일 · 토요일 · 공휴일)", "06:00-23:00 (weekdays, Saturdays, holidays)"),
        details: L(["비고: 학교 공식 시험기간에는 24시간 개방"], ["Note: open 24 hours during official exam periods"]),
        extraSrc: { hours: "libHours", details: "team1124" },
        checkedAt: ADDED,
      }),
      o("세미나룸", null, "2F", null, "35석", "35 seats", "libFloor", { ...OFFICE, checkedAt: ADDED }),
      // 1F · 라운지층(LF): 이 두 층의 시설은 스마트플라자와 여는 · 닫는 시간이 같습니다(이종헌 확인, team1124).
      o("안내실", null, "1F", null, "도서관 1층 안내", "Library 1st-floor information desk", "libFloor", {
        ...OFFICE,
        hours: LIB_HOURS,
        extraSrc: { hours: "team1124" },
        checkedAt: ADDED,
      }),
      o("그룹스터디룸", null, "1F", null, "16실(4 · 6 · 8 · 12인실), 예약 후 이용", "16 rooms for 4, 6, 8 or 12 people; booking required", "libFloor", {
        ...OFFICE,
        hours: L("학기 중 평일 09:00~20:30 · 토요일 · 공휴일 휴실", "Semester weekdays 09:00-20:30 · Closed Saturdays and holidays"),
        extraSrc: { hours: "libHours" },
        checkedAt: ADDED,
      }),
      o("복사실", "Copy room", "1F", null, "복사", "Copying", "phone", {
        ...AMENITY,
        hours: LIB_HOURS,
        extraSrc: { hours: "team1124" },
        checkedAt: ADDED,
      }),
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
        ...AMENITY,
        phone: ["02-2173-2472"],
        hours: L("학기 중 평일 09:00~21:00 · 토요일 09:00~17:00 · 공휴일 휴실", "Semester weekdays 09:00-21:00 · Saturdays 09:00-17:00 · Closed on holidays"),
        details: L(["휴게 열람실: 세미나 테이블 · 휴게 시설"], ["Rest and reading room with seminar tables and lounge furniture"]),
        extraSrc: { hours: "libHours", details: "libFloor" },
        checkedAt: ADDED,
      }),
      // 라운지층(LF)
      o("카페라운지(이문일공칠)", null, "LF", null, "라운지층 카페, 좌석 배정 없이 이용 · 음료 가능", "Lounge-floor café; no seat booking, drinks allowed", "libFloor", {
        ...AMENITY,
        hours: LIB_HOURS,
        phone: ["02-2173-3376"],
        details: L(["커피 · 음료 · 베이커리(이문일공칠 인더북)"], ["Coffee, drinks and bakery (Imun 107 In the Book)"]),
        extraSrc: { hours: "team1124", details: "welfare", phone: "lifeguide2026" },
        checkedAt: ADDED_1125,
      }),
      o("스터디라운지", null, "LF", null, "개방형 열람실, 좌석 배정 없이 이용", "Open reading space; no seat booking", "libFloor", {
        ...AMENITY,
        hours: LIB_HOURS,
        details: L(["북토크 · 음악회 · 전시회 등 행사 공간"], ["Used for book talks, concerts and exhibitions"]),
        extraSrc: { hours: "team1124" },
        checkedAt: ADDED,
      }),
      o("일반자료실", "General collection", "3F", null, "정보봉사파트 자료실", "Information services collection", "phone", {
        ...OFFICE,
        hours: LIB_HOURS,
        extraSrc: { hours: "libHours" },
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
        hours: LIB_HOURS,
        extraSrc: { phone: "phone", hours: "libHours", details: "lifeguide2026" },
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
      // 건물 밖(도서관 뒤): 88p 학내 복지시설(11/25 종헌 결정). 층이 없어 목록 맨 아래 "건물 밖" 묶음
      o("빵명장", null, "OUT", null, "커피, 기타 음료 및 빵 등 판매", "Coffee, other drinks and bread", "lifeguide2026", {
        ...AMENITY,
        where: L("도서관 뒤(건물 밖)", "Behind the library (outside)"),
        phone: ["02-969-9678"],
        hours: L("월~토 08:30~21:00, 일요일 정기휴무", "Mon-Sat 08:30-21:00, closed Sundays"),
        extraSrc: { hours: "naverBread" },
        checkedAt: ADDED_1125,
      }),
    ],
    checkedAt: ADDED_1125,
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
        phone: ["02-969-0050"],
        details: L(["입출금 · 송금 · 카드발급 · 대출 · 외환 업무"], ["Deposits, transfers, cards, loans and foreign exchange"]),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("무인 복사 · 아이스크림", "Self-service copy & ice cream", "1F", null, "무인 복사, 아이스크림", "Self-service copying and ice cream", "welfare", {
        ...AMENITY,
        details: L(["복사 · 제본(책 · 롤스프링) · 출력(밤새출력)"], ["Copying, binding (book, spiral) and printing (overnight printing)"]),
        extraSrc: "lifeguide2026",
        checkedAt: ADDED,
      }),
      o("아트박스(문구)", null, "1F", null, "문구류 · 팬시류 판매", "Stationery and fancy goods", "lifeguide2026", { ...AMENITY, phone: ["0507-1400-0919"], checkedAt: ADDED_1125 }),
      o("교직원 식당", "Faculty cafeteria", "2F", null, "한식 · 양식", "Korean and Western meals", "welfare", {
        ...AMENITY,
        phone: ["02-2173-2664"],
        details: L(["일반식: 한식 · 양식 · 예약식", "연회: 한정식 · 양식 · 뷔페(스탠딩뷔페)"], ["Regular meals: Korean, Western, reserved meals", "Banquets: Korean course, Western and standing buffet"]),
        extraSrc: { phone: "welfare", details: "lifeguide2026" },
        checkedAt: ADDED,
      }),
    ],
    checkedAt: ADDED_1125,
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
  // 지상 건물이 아니라 역사관 앞 광장 · 미네르바 광장(길라잡이 캠퍼스맵 15 · 16번 구역) 아래의 지하캠퍼스
  minerva: {
    ...empty,
    name: "Minerva Complex",
    nameEn: "Minerva Complex",
    use: {
      ko: "역사관 앞 광장 아래 지하캠퍼스예요. 지하 1·2층에 동아리방과 오바마홀이 있어요.",
      en: "An underground campus beneath the plaza in front of the History Hall. Club rooms and Obama Hall are on B1 and B2.",
    },
    offices: [
      ...clubRooms("minerva"),
      // 존재 · 이름: 공식 3D 복셀 캠퍼스. 층(B1 · B2) · 용도(대강당): 11/25 종헌 확인
      o("오바마홀", "Obama Hall", "B1 · B2", null, "대강당", "Auditorium", "campus3d", {
        ...OFFICE,
        extraSrc: { floor: "team1125", does: "team1125" },
        checkedAt: ADDED_1125,
      }),
    ],
    checkedAt: ADDED_1125,
  },
  cyber: {
    ...empty,
    name: "사이버관",
    nameEn: "Cyber Hall",
    use: {
      ko: "105호에 학사종합지원센터가 있고, 1층에 올리브영과 카페(아티제), 5층에 경영학부 사무실이 있어요.",
      en: "The Academic Support Center is in Room 105, Olive Young and Artisée café are on the 1st floor, and the Business School office is on the 5th floor.",
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
      o("올리브영", "Olive Young", "1F", null, "헬스 · 뷰티 제품", "Health and beauty", "welfare", {
        ...AMENITY,
        phone: ["02-3295-5290"],
        hours: L("월~토 09:30~22:30, 일 11:30~22:30", "Mon-Sat 09:30-22:30, Sun 11:30-22:30"),
        extraSrc: { phone: "lifeguide2026", hours: "oliveyoung" },
        checkedAt: ADDED_1125,
      }),
      o("아티제", "Artisée café", "1F", null, "커피 · 음료 · 베이커리", "Coffee, drinks and bakery", "welfare", {
        ...AMENITY,
        phone: ["02-959-2411"],
        hours: L("월~금 07:30~22:00, 토·일 09:00~22:00", "Mon-Fri 07:30-22:00, Sat-Sun 09:00-22:00"),
        extraSrc: { phone: "lifeguide2026", hours: "naverArtisee" },
        checkedAt: ADDED_1125,
      }),
      ...deptOffices("cyber"),
    ],
    checkedAt: ADDED_1125,
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
// 11/26 게임 안 신고로 교체: 화면에서 사용 안 함(되돌릴 때 씀).
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
// 하위 줄(children)까지 펼친 모든 줄
export const allOffices = (offices = []) => offices.flatMap((office) => [office, ...allOffices(office.children)]);
export const buildingSources = (info) => [...new Set(allOffices(info.offices).flatMap(officeSourceKeys))].map((key) => SOURCES[key]).filter(Boolean);
