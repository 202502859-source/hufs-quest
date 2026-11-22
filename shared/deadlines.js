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
    id: "2026-campus-mandatory-edu",
    title: {
      ko: "2026학년도 서울캠퍼스 재학생 대상 법정의무교육 이수 안내",
      en: "2026 Mandatory Statutory Education for Seoul Campus Students",
    },
    dept: { ko: "학생지원팀", en: "Student Support Team" },
    category: "campus",
    deadline: "2026-12-31T23:59:00+09:00",
    url: "https://www.hufs.ac.kr/hufs/11281/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGaHVmcyUyRjIxODAlMkYyNjc4MjAlMkZhcnRjbFZpZXcuZG8lM0ZwYWdlJTNEMSUyNnNyY2hDb2x1bW4lM0QlMjZzcmNoV3JkJTNEJTI2YmJzQ2xTZXElM0QlMjZiYnNPcGVuV3JkU2VxJTNEJTI2cmdzQmduZGVTdHIlM0QlMjZyZ3NFbmRkZVN0ciUzRCUyNmlzVmlld01pbmUlM0RmYWxzZSUyNnBhc3N3b3JkJTNEJTI2",
  },
  {
    id: "2026-campus-reserve-forces-3rd",
    title: {
      ko: "(서울) 2026년도 후반기 학생예비군 기본 3차훈련(안내)",
      en: "2026 Second Half Student Reserve Forces 3rd Basic Training (Seoul)",
    },
    dept: { ko: "예비군연대(서울)", en: "Reserve Forces Regiment (Seoul)" },
    category: "campus",
    deadline: "2026-12-07T09:00:00+09:00",
    url: "https://www.hufs.ac.kr/hufs/11281/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGaHVmcyUyRjIxODAlMkYyNzExODAlMkZhcnRjbFZpZXcuZG8lM0ZwYWdlJTNEMSUyNnNyY2hDb2x1bW4lM0QlMjZzcmNoV3JkJTNEJTI2YmJzQ2xTZXElM0QlMjZiYnNPcGVuV3JkU2VxJTNEJTI2cmdzQmduZGVTdHIlM0QlMjZyZ3NFbmRkZVN0ciUzRCUyNmlzVmlld01pbmUlM0RmYWxzZSUyNnBhc3N3b3JkJTNEJTI2",
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
    url: "https://www.hufs.ac.kr/hufs/11281/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGaHVmcyUyRjIxODAlMkYyNzIxMTElMkZhcnRjbFZpZXcuZG8lM0ZwYWdlJTNEMSUyNnNyY2hDb2x1bW4lM0QlMjZzcmNoV3JkJTNEJTI2YmJzQ2xTZXElM0QlMjZiYnNPcGVuV3JkU2VxJTNEJTI2cmdzQmduZGVTdHIlM0QlMjZyZ3NFbmRkZVN0ciUzRCUyNmlzVmlld01pbmUlM0RmYWxzZSUyNnBhc3N3b3JkJTNEJTI2",
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