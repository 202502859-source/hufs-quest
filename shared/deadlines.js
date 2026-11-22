/*
 * 마감 임박 공지 데이터 (팀이 직접 입력하는 파일)
 *
 * ※ 실제 공지는 팀원이 학교 공지를 확인하고 직접 추가할 것. demo 항목은 본선 전 삭제.
 * ※ 학교 공지 게시판은 robots.txt로 자동 수집이 금지되어 있습니다. 크롤링하지 말고 이 파일에 손으로 적어 주세요.
 *
 * 형식
 *   id          : 고유 이름
 *   title       : { ko, en } 공지 내용
 *   dept        : { ko, en } 문서를 낸 부서
 *   category    : "academic"(학사정보) | "scholarship"(장학) | "campus"(학교생활) | "external"(대외활동)
 *   deadline    : 마감 일시, 한국 시간 문자열 (예: "2026-11-14T17:00:00+09:00")
 *   url         : 원문 공지 링크
 *   demo        : 시연용 예시이면 true
 *   daysFromNow : demo 항목만 사용. 마감일을 "오늘로부터 며칠 뒤 17:00(한국 시간)"으로 계산
 *
 * 예시 항목의 url은 가짜 공지 주소를 만들지 않고, 학교 공식 안내 페이지를 씁니다.
 */
export const DEADLINES = [
  {
    id: "demo-scholarship",
    title: { ko: "[예시] 2027학년도 1학기 교내 장학금 신청", en: "[Example] Spring 2027 on-campus scholarship application" },
    dept: { ko: "학생지원팀 (예시)", en: "Student Support Team (example)" },
    category: "scholarship",
    url: "https://www.hufs.ac.kr/hufs/11393/subview.do",
    demo: true,
    daysFromNow: 0,
  },
  {
    id: "demo-dorm",
    title: { ko: "[예시] 2027학년도 1학기 국제학사 입사 신청", en: "[Example] Spring 2027 GlobeeDorm move-in application" },
    dept: { ko: "국제학사 운영팀 (예시)", en: "Dormitory Office (example)" },
    category: "campus",
    url: "https://www.hufs.ac.kr/hufs/11313/subview.do",
    demo: true,
    daysFromNow: 1,
  },
  {
    id: "demo-return",
    title: { ko: "[예시] 2027학년도 1학기 복학 신청", en: "[Example] Spring 2027 return-from-leave application" },
    dept: { ko: "학사종합지원센터 (예시)", en: "Academic Support Center (example)" },
    category: "academic",
    url: "https://www.hufs.ac.kr/hufs/11387/subview.do",
    demo: true,
    daysFromNow: 3,
  },
  {
    id: "demo-double-major",
    title: { ko: "[예시] 2027학년도 1학기 이중전공 신청", en: "[Example] Spring 2027 double major application" },
    dept: { ko: "학사종합지원센터 (예시)", en: "Academic Support Center (example)" },
    category: "academic",
    url: "https://www.hufs.ac.kr/hufs/11384/subview.do",
    demo: true,
    daysFromNow: 5,
  },
  {
    id: "demo-contest",
    title: { ko: "[예시] 교외 대학생 아이디어 공모전 접수", en: "[Example] Off-campus student idea contest submission" },
    dept: { ko: "진로취업지원센터 (예시)", en: "Career Development Center (example)" },
    category: "external",
    url: "https://www.hufs.ac.kr/hufs/11302/subview.do",
    demo: true,
    daysFromNow: 9,
  },
  {
    id: "2026-11-dept-major",
    title: {
      ko: "[서울] 학부/계열 입학생의 학과·세부전공 신청 공고",
      en: "[Seoul] Application for Department and Track Selection (Undergraduate/Division Entrants)",
    },
    dept: { ko: "학사종합지원센터(서울)", en: "Academic Support Center (Seoul)" },
    category: "academic",
    deadline: "2026-11-27T16:00:00+09:00",
    url: "https://www.hufs.ac.kr/bbs/hufs/2181/271666/artclView.do",
  },
  {
    id: "2026-11-double-major",
    title: {
      ko: "[공통] 2026-2학기 이중전공 신청 일정 공고(LD학부 지원자격 수정)",
      en: "[Common] Fall 2026 Double Major Application Schedule (LD Division Eligibility Updated)",
    },
    dept: { ko: "학사종합지원센터", en: "Academic Support Center" },
    category: "academic",
    deadline: "2026-11-30T16:00:00+09:00",
    url: "https://www.hufs.ac.kr/bbs/hufs/2181/270884/artclView.do",
  },
  {
    id: "2026-12-cuhufs-winter-exchange",
    title: {
      ko: "한국외대생 대상 사이버한국외대 26-동계 계절학기 학점교류 신청 안내",
      en: "Cyber HUFS Winter 2026 Credit Exchange Application for HUFS Students",
    },
    dept: { ko: "학사종합지원센터", en: "Academic Support Center" },
    category: "academic",
    deadline: "2026-12-02T23:59:00+09:00",
    url: "https://www.hufs.ac.kr/bbs/hufs/2181/271826/artclView.do",
  },
  {
    id: "2026-12-mandatory-education",
    title: {
      ko: "2026학년도 서울캠퍼스 재학생 대상 법정의무교육 이수 안내",
      en: "2026 Mandatory Legal Education Guide for Seoul Campus Students",
    },
    dept: { ko: "학생지원팀", en: "Student Support Team" },
    category: "campus",
    deadline: "2026-12-31T23:59:00+09:00",
    url: "https://www.hufs.ac.kr/bbs/hufs/2180/267820/artclView.do",
  },
  {
    id: "2026-12-reserve-forces-3rd",
    title: {
      ko: "(서울) 2026년도 후반기 학생예비군 기본 3차훈련(안내)",
      en: "(Seoul) 2026 Second-Half Student Reserve Forces 3rd Basic Training Notice",
    },
    dept: { ko: "예비군연대(서울)", en: "Reserve Forces Regiment (Seoul)" },
    category: "campus",
    deadline: "2026-12-07T09:00:00+09:00",
    url: "https://www.hufs.ac.kr/bbs/hufs/2180/271180/artclView.do",
  },
  {
    id: "2026-12-hufs-dream-scholarship",
    title: {
      ko: "[서울][교내] 2026학년도 2학기 서울캠퍼스 HUFS Dream 장학금 신청 안내 (11/23~12/4)",
      en: "[Seoul][On-Campus] Fall 2026 Seoul Campus HUFS Dream Scholarship Application (11/23–12/4)",
    },
    dept: { ko: "서울캠퍼스 장학팀", en: "Seoul Campus Scholarship Team" },
    category: "scholarship",
    deadline: "2026-12-04T16:00:00+09:00",
    url: "https://student.hufs.ac.kr/bbs/student/2431/272166/artclView.do",
  },
  {
    id: "2026-11-startup-scholarship",
    title: {
      ko: "[공통][교내]2026학년도 창업장학금 신청 안내(~11/27)",
      en: "[Common][On-Campus] 2026 Entrepreneurship Scholarship Application (~11/27)",
    },
    dept: { ko: "글로벌창업지원단", en: "Global Startup Support Foundation" },
    category: "scholarship",
    deadline: "2026-11-27T23:59:00+09:00",
    url: "https://student.hufs.ac.kr/bbs/student/2431/269128/artclView.do",
  },
  {
    id: "2027-01-kosaf-national-scholarship",
    title: {
      ko: "[공통][국가] 2027년 1학기 국가장학금 신청",
      en: "[Common][National] Spring 2027 National Scholarship Application",
    },
    dept: { ko: "장학팀", en: "Scholarship Team" },
    category: "scholarship",
    deadline: "2027-01-07T18:00:00+09:00",
    url: "https://student.hufs.ac.kr/bbs/student/2431/272011/artclView.do",
  },
  {
    id: "2026-11-yangcheon-scholarship",
    title: {
      ko: "(공통)(교외)2026-2학기 양천장학회 학업지원특별장학금 신청 안내",
      en: "(Common)(Off-Campus) Fall 2026 Yangcheon Scholarship Foundation Academic Support Scholarship",
    },
    dept: { ko: "장학팀", en: "Scholarship Team" },
    category: "scholarship",
    deadline: "2026-11-23T11:00:00+09:00",
    url: "https://student.hufs.ac.kr/bbs/student/2431/272012/artclView.do",
  },
  {
    id: "2026-12-kfas-munwoorim-scholarship",
    title: {
      ko: "[공통][교외]한국고등교육재단 문우림 제6기 장학생 선발(~12/11)",
      en: "[Common][Off-Campus] KFAS Munwoorim 6th Scholarship Selection (~12/11)",
    },
    dept: { ko: "장학팀", en: "Scholarship Team" },
    category: "scholarship",
    deadline: "2026-12-11T23:59:00+09:00",
    url: "https://student.hufs.ac.kr/bbs/student/2431/271345/artclView.do",
  },
];
