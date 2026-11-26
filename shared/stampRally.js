// 캠퍼스 스탬프 랠리(일일 퀘스트)의 대상 건물과 부스 문제 은행입니다. 서버(api/quiz-answer.js)와 화면이 같이 씁니다.
// 이 파일에는 브라우저 전용 코드를 넣지 않습니다. 부스 · 팻말 좌표는 화면 쪽(src/data/stampRallySpots.js)에 있습니다.
//
// 문제 규칙(11/27 PM 결정: 이종헌) — tests/stampRally.test.js가 확인합니다.
// - 문제 · 정답 · 오답 보기는 모두 src/data/buildingInfo.js의 시설 안내 내용에서만 가져옵니다(지어내지 않음).
// - 정답은 그 건물 시설 안내 화면에 보이는 글자 그대로, 오답 보기는 "다른 건물"의 시설 안내에 실제로 있는 글자입니다.
// - 잘 안 바뀌는 정보만(사무실 이름 · 하는 일 · 층 · 호실). 운영시간 · 전화번호 · 이메일은 쓰지 않습니다.
// - 출처가 외부 참고(SOURCES의 kind: "external")인 항목은 문제 · 정답 · 오답 보기에 쓰지 않습니다.
// - 각 문제의 basis: 정답이 적힌 곳(BUILDING_INFO[건물].offices의 이름 · 칸)과 그 줄의 출처 키(SOURCES).
//   출처 링크는 buildingInfo.js SOURCES[키].url 입니다.

// 표시 순서. label은 도장 안에 찍히는 약칭입니다.
export const STAMP_RALLY_STOPS = [
  { buildingId: "library", label: { ko: "도서관", en: "Library" } },
  { buildingId: "union", label: { ko: "학생회관", en: "Union" } },
  { buildingId: "main", label: { ko: "본관", en: "Main" } },
  { buildingId: "humanities", label: { ko: "인문", en: "Human." } },
];

export const STAMP_RALLY_IDS = STAMP_RALLY_STOPS.map((stop) => stop.buildingId);
export const isRallyStop = (buildingId) => STAMP_RALLY_IDS.includes(buildingId);

// 보기 한 줄: text(화면 글자, 영어 이름이 없는 곳은 시설 안내 화면처럼 한국어 이름), from(그 글자가 있는 건물 id)
const opt = (ko, en, from) => ({ text: { ko, en: en ?? ko }, from });

/*
 * 건물마다 3지선다 후보 3개. answer는 options에서 정답의 번호(0부터)입니다.
 * 출처 링크(SOURCES): libFloor https://lib.hufs.ac.kr/service/facility/floor · phone https://www.hufs.ac.kr/hufs/11159/subview.do
 *   lifeguide2026 https://www.hufs.ac.kr/hufs/11415/subview.do · cert https://www.hufs.ac.kr/hufs/11304/subview.do
 *   counseling https://sccs.hufs.ac.kr/ · iei https://iei.hufs.ac.kr/ · ois https://ois.hufs.ac.kr/ois/index.do
 *   welfare https://www.hufs.ac.kr/hufs/11316/subview.do · parking https://www.hufs.ac.kr/hufs/11323/subview.do
 */
export const STAMP_RALLY_QUESTIONS = {
  library: [
    {
      // 근거: library.offices "학술정보팀 정보봉사파트"(3F) does "자료 대출 · 반납, 이용자 정보서비스" — 출처 libFloor · libHours · lifeguide2026
      id: "library-1",
      question: { ko: "도서관에서 '자료 대출 · 반납, 이용자 정보서비스'를 맡는 곳은?", en: "Which Library office handles 'Book loans and returns, user information services'?" },
      options: [opt("원스톱서비스센터", "One-Stop Service Center", "union"), opt("학술정보팀 정보봉사파트", null, "library"), opt("교육혁신원", "Institute for Educational Innovation", "main")],
      answer: 1,
      basis: { office: "학술정보팀 정보봉사파트", field: "name · does", src: ["libFloor", "libHours", "lifeguide2026"] },
    },
    {
      // 근거: library.offices "그룹스터디룸"(1F) does "16실(4 · 6 · 8 · 12인실), 예약 후 이용" — 출처 libFloor · libHours
      id: "library-2",
      question: { ko: "도서관 1층에서 '예약 후 이용'하는 시설은?", en: "Which facility on the Library's 1st floor has 'booking required'?" },
      options: [opt("그룹스터디룸", null, "library"), opt("보건실", "Health room", "union"), opt("우편취급국", "Post office", "humanities")],
      answer: 0,
      basis: { office: "그룹스터디룸", field: "name · floor · does", src: ["libFloor", "libHours"] },
    },
    {
      // 근거: library.offices "학술연구자료실"(4F) — 출처 phone · libHours · lifeguide2026
      id: "library-3",
      question: { ko: "도서관 4층에 있는 자료실은?", en: "Which collection is on the Library's 4th floor?" },
      options: [opt("장학팀", "Scholarship Support Team", "union"), opt("정보시스템팀", "Information Systems Team", "main"), opt("학술연구자료실", "Research collection", "library")],
      answer: 2,
      basis: { office: "학술연구자료실", field: "name · floor", src: ["phone", "libHours", "lifeguide2026"] },
    },
  ],
  union: [
    {
      // 근거: union.offices "원스톱서비스센터"(114호) does "증명서 발급" — 출처 cert · lifeguide2026
      id: "union-1",
      question: { ko: "국제학사 및 학생회관에서 '증명서 발급'을 맡는 곳은?", en: "Which office in GlobeeDorm & Student Union handles 'Certificates'?" },
      options: [opt("교육혁신원", "Institute for Educational Innovation", "main"), opt("학술정보팀 정보봉사파트", null, "library"), opt("원스톱서비스센터", "One-Stop Service Center", "union")],
      answer: 2,
      basis: { office: "원스톱서비스센터", field: "name · does", src: ["cert", "lifeguide2026"] },
    },
    {
      // 근거: union.offices "학생상담센터" room "345호" — 출처 counseling · phone · lifeguide2026
      id: "union-2",
      question: { ko: "학생상담센터는 몇 호에 있나요?", en: "Which room is the Student Counseling Center in?" },
      options: [opt("345호", "Room 345", "union"), opt("303호", "Room 303", "main"), opt("104호", "Room 104", "humanities")],
      answer: 0,
      basis: { office: "학생상담센터", field: "room", src: ["counseling", "phone", "lifeguide2026"] },
    },
    {
      // 근거: union.offices "장학팀"(121호) does "장학금 신청 · 상담, 학자금 대출 안내" — 출처 lifeguide2026
      id: "union-3",
      question: { ko: "'장학금 신청 · 상담, 학자금 대출 안내'를 맡는 곳은?", en: "Which office handles 'Scholarship applications and advice, student loan guidance'?" },
      options: [opt("정보시스템팀", "Information Systems Team", "main"), opt("장학팀", "Scholarship Support Team", "union"), opt("공공인재개발원", null, "library")],
      answer: 1,
      basis: { office: "장학팀", field: "name · does", src: ["lifeguide2026"] },
    },
  ],
  main: [
    {
      // 근거: main.offices "교육혁신원" room "303호" — 출처 iei · lifeguide2026
      id: "main-1",
      question: { ko: "교육혁신원은 몇 호에 있나요?", en: "Which room is the Institute for Educational Innovation in?" },
      options: [opt("114호", "Room 114", "union"), opt("303호", "Room 303", "main"), opt("104호", "Room 104", "humanities")],
      answer: 1,
      basis: { office: "교육혁신원", field: "room", src: ["iei", "lifeguide2026"] },
    },
    {
      // 근거: main.offices "정보시스템팀"(446호) does "학사·행정 정보시스템 운영" — 출처 ois
      id: "main-2",
      question: { ko: "본관에서 '학사·행정 정보시스템 운영'을 맡는 곳은?", en: "Which office in the Main Building 'runs academic and administrative information systems'?" },
      options: [opt("정보시스템팀", "Information Systems Team", "main"), opt("장학팀", "Scholarship Support Team", "union"), opt("학술정보팀 정보봉사파트", null, "library")],
      answer: 0,
      basis: { office: "정보시스템팀", field: "name · does", src: ["ois"] },
    },
    {
      // 근거: main.offices "교육혁신원"(303호) does "교육과정 개선 · 원격교육 지원" — 출처 iei · lifeguide2026
      id: "main-3",
      question: { ko: "본관에서 '교육과정 개선 · 원격교육 지원'을 맡는 곳은?", en: "Which office in the Main Building handles 'Curriculum improvement and remote-learning support'?" },
      options: [opt("진로취업지원센터", "Career Development Center", "union"), opt("공공인재개발원", null, "library"), opt("교육혁신원", "Institute for Educational Innovation", "main")],
      answer: 2,
      basis: { office: "교육혁신원", field: "name · does", src: ["iei", "lifeguide2026"] },
    },
  ],
  // 인문과학관: 2층 대강당은 출처가 외부 참고(나무위키)라 쓰지 않았습니다. 공식 출처 항목은 1 · 2층 편의시설과 주차권 발급뿐입니다.
  humanities: [
    {
      // 근거: humanities.offices "우편취급국"(1F) does "우편 · 택배" — 출처 welfare · lifeguide2026
      id: "humanities-1",
      question: { ko: "인문과학관 1층에서 '우편 · 택배'를 맡는 곳은?", en: "Which place on the 1st floor of the Humanities Building handles 'Mail and parcels'?" },
      options: [opt("기념품점", "Souvenir shop", "union"), opt("우편취급국", "Post office", "humanities"), opt("스마트플라자", null, "library")],
      answer: 1,
      basis: { office: "우편취급국", field: "name · floor · does", src: ["welfare", "lifeguide2026"] },
    },
    {
      // 근거: humanities.offices "주차권 발급(동원안전시스템)" room "104호", does "주차권 신규 발급" — 출처 parking
      id: "humanities-2",
      question: { ko: "인문과학관에서 '주차권 신규 발급'을 하는 곳은 몇 호인가요?", en: "Which room in the Humanities Building issues 'New parking passes'?" },
      options: [opt("104호", "Room 104", "humanities"), opt("114호", "Room 114", "union"), opt("303호", "Room 303", "main")],
      answer: 0,
      basis: { office: "주차권 발급(동원안전시스템)", field: "room · does", src: ["parking"] },
    },
    {
      // 근거: humanities.offices "문구점"(1F) does "문구류 · 컴퓨터용품 · 잡화" — 출처 welfare · lifeguide2026
      id: "humanities-3",
      question: { ko: "인문과학관 1층에서 '문구류 · 컴퓨터용품 · 잡화'를 파는 곳은?", en: "Which place on the 1st floor of the Humanities Building sells 'Stationery, computer supplies and goods'?" },
      options: [opt("STN 커피", "STN Coffee", "union"), opt("휴플레이스", null, "library"), opt("문구점", "Stationery store", "humanities")],
      answer: 2,
      basis: { office: "문구점", field: "name · floor · does", src: ["welfare", "lifeguide2026"] },
    },
  ],
};

// "YYYY-MM-DD"(한국 날짜, progressRules.js kstToday) → 1970-01-01부터의 날 수
const dayNumber = (kstDate) => Math.floor(Date.parse(`${kstDate}T00:00:00Z`) / 86_400_000);

// 오늘의 부스 문제. 한국 날짜로만 정해지므로 서버와 화면이 같은 문제를 고릅니다. 날마다 다음 후보로 바뀝니다.
// 후보가 0개면 null("준비 중"), 1개면 매일 그 문제.
export function boothQuestionFor(buildingId, kstDate) {
  const list = STAMP_RALLY_QUESTIONS[buildingId];
  const stopIndex = STAMP_RALLY_IDS.indexOf(buildingId);
  if (stopIndex < 0 || !list?.length) return null;
  const day = dayNumber(kstDate);
  if (!Number.isFinite(day)) return null;
  return list[(((day + stopIndex) % list.length) + list.length) % list.length];
}

// 채점. choiceIndex가 0 · 1 · 2가 아니거나 문제가 없으면 null.
export function gradeBooth(buildingId, kstDate, choiceIndex) {
  const question = boothQuestionFor(buildingId, kstDate);
  if (!question || !Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= question.options.length) return null;
  return choiceIndex === question.answer;
}

// 받은 스탬프 목록에서 표시 순서상 아직 안 받은 첫 건물 id(모두 받았으면 null)
export const nextRallyStop = (stamps = []) => STAMP_RALLY_IDS.find((id) => !stamps.includes(id)) ?? null;
export const rallyComplete = (stamps = []) => STAMP_RALLY_IDS.every((id) => stamps.includes(id));
