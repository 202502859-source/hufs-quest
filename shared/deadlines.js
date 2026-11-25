/*
 * 마감 임박 공지 데이터 (팀이 직접 입력하는 파일)
 *
 * ※ 실제 공지는 팀원이 학교 공지를 확인하고 직접 추가합니다. 기본 목록(DEADLINES)에는 예시(demo)를 넣지 않습니다.
 * ※ 학교 공지 게시판은 robots.txt로 자동 수집이 금지되어 있습니다. 크롤링하지 말고 이 파일에 손으로 적어 주세요.
 *
 * 형식
 *   id          : 고유 이름
 *   title       : { ko, en } 공지 내용
 *   dept        : { ko, en } 문서를 낸 부서
 *   category    : "academic"(학사정보) | "scholarship"(장학) | "campus"(학교생활) | "external"(대외활동)
 *   startsAt    : (선택) 접수 시작 일시, 한국 시간 문자열 (예: "2026-11-23T09:00:00+09:00")
 *   deadline    : 마감 일시, 한국 시간 문자열 (예: "2026-11-27T16:00:00+09:00")
 *   url         : 학교 사이트 원문 공지 링크 (*.hufs.ac.kr)
 *   checked     : { on: "YYYY-MM-DD", by: "팀원 실명" } 원문 대조 기록 (API 응답에서 by는 제외됨)
 *   demo        : 시연용 예시이면 true (DEMO_DEADLINES에만 사용)
 *   daysFromNow : demo 항목만 사용. 마감일을 "오늘로부터 며칠 뒤 17:00(한국 시간)"으로 계산
 *
 * 예시 항목의 url은 가짜 공지 주소를 만들지 않고, 학교 공식 안내 페이지를 적습니다.
 */

export const DEMO_DEADLINES = [
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
];

export const DEADLINES = [
  {
    id: "2026-winter-course-reg",
    title: {
      ko: "2026-겨울계절학기 수강신청 안내",
      en: "Winter 2026 Seasonal Semester Course Registration",
    },
    dept: { ko: "학사종합지원센터", en: "Academic Support Center" },
    category: "academic",
    deadline: "2026-11-27T16:00:00+09:00",
    url: "https://www.hufs.ac.kr/bbs/hufs/2181/270769/artclView.do",
    checked: { on: "2026-11-23", by: "임현규" },
  },
  {
    id: "2026-11-dept-major",
    title: {
      ko: "[서울] 학부/계열 입학자의 학과·세부전공 신청 공고",
      en: "[Seoul] Application for Department and Track Selection (Undergraduate/Division Entrants)",
    },
    dept: { ko: "학사종합지원센터(서울)", en: "Academic Support Center (Seoul)" },
    category: "academic",
    deadline: "2026-11-27T16:00:00+09:00",
    url: "https://www.hufs.ac.kr/bbs/hufs/2181/271666/artclView.do",
    checked: { on: "2026-11-23", by: "임현규" },
  },
  {
    id: "2026-winter-dorm",
    title: {
      ko: "2026학년도 동계방학 HUFS Dorm 사생 모집 안내",
      en: "Winter 2026 HUFS Dorm Resident Recruitment",
    },
    dept: { ko: "국제학사 운영팀", en: "Dormitory Office" },
    category: "campus",
    deadline: "2026-11-27T23:59:00+09:00",
    url: "https://www.hufs.ac.kr/bbs/hufs/2180/271685/artclView.do",
    checked: { on: "2026-11-23", by: "임현규" },
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
    checked: { on: "2026-11-23", by: "임현규" },
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
    checked: { on: "2026-11-23", by: "임현규" },
  },
  {
    id: "2026-12-cuhufs-winter-exchange",
    title: {
      ko: "한국외국어대학교-사이버한국외대 26-동계 계절학기 학점교류 신청 안내",
      en: "Cyber HUFS Winter 2026 Credit Exchange Application for HUFS Students",
    },
    dept: { ko: "학사종합지원센터", en: "Academic Support Center" },
    category: "academic",
    deadline: "2026-12-02T23:59:00+09:00",
    url: "https://www.hufs.ac.kr/bbs/hufs/2181/271826/artclView.do",
    checked: { on: "2026-11-23", by: "임현규" },
  },
  {
    id: "2026-12-hufs-dream-scholarship",
    title: {
      ko: "[서울][교내] 2026학년도 2학기 서울캠퍼스 HUFS Dream 장학금 신청 안내 (11/23~12/4)",
      en: "[Seoul][On-Campus] Fall 2026 Seoul Campus HUFS Dream Scholarship Application (11/23~12/4)",
    },
    dept: { ko: "서울캠퍼스 장학팀", en: "Seoul Campus Scholarship Team" },
    category: "scholarship",
    startsAt: "2026-11-23T09:00:00+09:00",
    deadline: "2026-12-04T16:00:00+09:00",
    url: "https://student.hufs.ac.kr/bbs/student/2431/272166/artclView.do",
    checked: { on: "2026-11-23", by: "임현규" },
  },
  {
    id: "2026-external-eu-youth-forum",
    title: {
      ko: "제10회 노벨평화상 기념 EU Youth Forum 개최 및 참가자 모집 안내",
      en: "10th Nobel Peace Prize Commemorative EU Youth Forum Participant Recruitment",
    },
    dept: { ko: "EU연구소", en: "EU Research Institute" },
    category: "external",
    deadline: "2026-12-10T13:00:00+09:00",
    url: "https://www.hufs.ac.kr/bbs/hufs/2180/272111/artclView.do",
    checked: { on: "2026-11-24", by: "임현규" },
  },
  {
    id: "2026-12-kfas-munwoorim-scholarship",
    title: {
      ko: "[공통][교외]한국고등교육재단 문우림 6기 장학생 선발(~12/11)",
      en: "[Common][Off-Campus] KFAS Munwoorim 6th Scholarship Selection (~12/11)",
    },
    dept: { ko: "장학팀", en: "Scholarship Team" },
    category: "scholarship",
    deadline: "2026-12-11T23:59:00+09:00",
    url: "https://student.hufs.ac.kr/bbs/student/2431/271345/artclView.do",
    checked: { on: "2026-11-23", by: "임현규" },
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
    checked: { on: "2026-11-24", by: "임현규" },
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
    checked: { on: "2026-11-24", by: "임현규" },
  },
  {
    id: "2026-12-waci-journal-cfp",
    title: {
      ko: "세계문화예술경영연구소『글로벌문화예술』 제2권 제1호 논문 투고",
      en: "Call for Papers: Global Arts & Culture Vol. 2, Issue 1 (WACI)",
    },
    dept: { ko: "세계문화예술경영연구소", en: "World Arts & Cultures Institute" },
    category: "external",
    deadline: "2026-12-10T23:59:00+09:00",
    url: "https://www.hufs.ac.kr/bbs/hufs/2180/272582/artclView.do",
    checked: { on: "2026-11-25", by: "임현규" },
  },
  {
    id: "2026-12-ir-education-survey",
    title: {
      ko: "2026학년도 교육만족도 조사 참여 안내 (기프티콘 추첨 증정)",
      en: "2026 Education Satisfaction Survey (Gift Card Raffle)",
    },
    dept: { ko: "IR센터", en: "IR Center" },
    category: "campus",
    startsAt: "2026-11-24T00:00:00+09:00",
    deadline: "2026-12-16T23:59:00+09:00",
    url: "https://www.hufs.ac.kr/bbs/hufs/2180/272496/artclView.do",
    checked: { on: "2026-11-25", by: "임현규" },
  },
  {
    id: "2026-12-hufs-pre-law-school",
    title: {
      ko: "법조인 양성을 위한 “HUFS Pre-Law School” 실원 모집",
      en: "HUFS Pre-Law School Member Recruitment",
    },
    dept: { ko: "HUFS Pre-Law School", en: "HUFS Pre-Law School" },
    category: "campus",
    startsAt: "2026-11-23T00:00:00+09:00",
    deadline: "2026-12-02T23:59:00+09:00",
    url: "https://www.hufs.ac.kr/bbs/hufs/2180/272466/artclView.do",
    checked: { on: "2026-11-25", by: "임현규" },
  },
];
