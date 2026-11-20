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
    id: "2026-winter-session",
    title: { ko: "2026-겨울계절학기 수강신청", en: "2026 Winter Session course registration" },
    dept: { ko: "학사종합지원센터", en: "Academic Support Center" },
    category: "academic",
    deadline: "2026-11-27T16:00:00+09:00",
    url: "https://www.hufs.ac.kr/hufs/11282/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGaHVmcyUyRjIxODElMkYyNzA3NjklMkZhcnRjbFZpZXcuZG8lM0ZwYWdlJTNEMSUyNnNyY2hDb2x1bW4lM0QlMjZzcmNoV3JkJTNEJTI2YmJzQ2xTZXElM0QlMjZiYnNPcGVuV3JkU2VxJTNEJTI2cmdzQmduZGVTdHIlM0QlMjZyZ3NFbmRkZVN0ciUzRCUyNmlzVmlld01pbmUlM0RmYWxzZSUyNnBhc3N3b3JkJTNEJTI2",
  },
  {
    id: "2026-major-assignment",
    title: { ko: "[서울] 학부/계열 입학생 학과·세부전공 신청", en: "[Seoul] Department & sub-major application for division entrants" },
    dept: { ko: "학사종합지원센터", en: "Academic Support Center" },
    category: "academic",
    deadline: "2026-11-27T16:00:00+09:00",
    url: "https://www.hufs.ac.kr/hufs/11282/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGaHVmcyUyRjIxODElMkYyNzE2NjYlMkZhcnRjbFZpZXcuZG8lM0ZwYWdlJTNEMSUyNnNyY2hDb2x1bW4lM0QlMjZzcmNoV3JkJTNEJTI2YmJzQ2xTZXElM0QlMjZiYnNPcGVuV3JkU2VxJTNEJTI2cmdzQmduZGVTdHIlM0QlMjZyZ3NFbmRkZVN0ciUzRCUyNmlzVmlld01pbmUlM0RmYWxzZSUyNnBhc3N3b3JkJTNEJTI2",
  },
  {
    id: "2026-winter-dorm",
    title: { ko: "2026학년도 동계방학 HUFS Dorm 사생 모집", en: "Winter 2026 HUFS Dormitory resident application" },
    dept: { ko: "HUFS Dorm 학사운영팀", en: "HUFS Dorm Residence Office" },
    category: "campus",
    deadline: "2026-11-27T23:59:00+09:00",
    url: "https://www.hufs.ac.kr/hufs/11281/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGaHVmcyUyRjIxODAlMkYyNzE2ODUlMkZhcnRjbFZpZXcuZG8lM0ZwYWdlJTNEMSUyNnNyY2hDb2x1bW4lM0QlMjZzcmNoV3JkJTNEJTI2YmJzQ2xTZXElM0QlMjZiYnNPcGVuV3JkU2VxJTNEJTI2cmdzQmduZGVTdHIlM0QlMjZyZ3NFbmRkZVN0ciUzRCUyNmlzVmlld01pbmUlM0RmYWxzZSUyNnBhc3N3b3JkJTNEJTI2",
  },
  {
    id: "2026-2-double-major",
    title: { ko: "2026-2학기 이중전공 신청", en: "Fall 2026 double major application" },
    dept: { ko: "학사종합지원센터", en: "Academic Support Center" },
    category: "academic",
    deadline: "2026-11-30T16:00:00+09:00",
    url: "https://www.hufs.ac.kr/hufs/11282/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGaHVmcyUyRjIxODElMkYyNzA4ODQlMkZhcnRjbFZpZXcuZG8lM0ZwYWdlJTNEMSUyNnNyY2hDb2x1bW4lM0QlMjZzcmNoV3JkJTNEJTI2YmJzQ2xTZXElM0QlMjZiYnNPcGVuV3JkU2VxJTNEJTI2cmdzQmduZGVTdHIlM0QlMjZyZ3NFbmRkZVN0ciUzRCUyNmlzVmlld01pbmUlM0RmYWxzZSUyNnBhc3N3b3JkJTNEJTI2",
  },
  {
    id: "2026-2-hufs-dream",
    title: { ko: "[서울] 2026-2학기 HUFS Dream 장학금 신청", en: "[Seoul] Fall 2026 HUFS Dream Scholarship application" },
    dept: { ko: "장학팀", en: "Scholarship Team" },
    category: "scholarship",
    deadline: "2026-12-04T16:00:00+09:00",
    url: "https://student.hufs.ac.kr/student/12767/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGc3R1ZGVudCUyRjI0MzElMkYyNzIxNjYlMkZhcnRjbFZpZXcuZG8lM0ZwYWdlJTNEMSUyNnNyY2hDb2x1bW4lM0QlMjZzcmNoV3JkJTNEJTI2YmJzQ2xTZXElM0QlMjZiYnNPcGVuV3JkU2VxJTNEJTI2cmdzQmduZGVTdHIlM0QlMjZyZ3NFbmRkZVN0ciUzRCUyNmlzVmlld01pbmUlM0RmYWxzZSUyNnBhc3N3b3JkJTNEJTI2",
  },
  {
    id: "2026-munwoorim-scholarship",
    title: { ko: "[교외] 한국고등교육재단 문우림 제6기 장학생 선발", en: "[External] KFAS Munwoorim 6th Scholarship selection" },
    dept: { ko: "장학팀", en: "Scholarship Team" },
    category: "scholarship",
    deadline: "2026-12-11T23:59:00+09:00",
    url: "https://student.hufs.ac.kr/student/12767/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGc3R1ZGVudCUyRjI0MzElMkYyNzEzNDUlMkZhcnRjbFZpZXcuZG8lM0ZwYWdlJTNEMSUyNnNyY2hDb2x1bW4lM0QlMjZzcmNoV3JkJTNEJTI2YmJzQ2xTZXElM0QlMjZiYnNPcGVuV3JkU2VxJTNEJTI2cmdzQmduZGVTdHIlM0QlMjZyZ3NFbmRkZVN0ciUzRCUyNmlzVmlld01pbmUlM0RmYWxzZSUyNnBhc3N3b3JkJTNEJTI2",
  },
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