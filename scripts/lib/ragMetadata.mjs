// Advanced RAG 2단계: 검색 조각 주제 분류
// 원문 데이터는 수정하지 않습니다.

const TOPICS = {
  calendar: [
    "학사일정(대학)"
  ],
  major: [
    "이중전공", "부전공", "전과",
    "융합전공 전체보기", "마이크로디그리"
  ],
  registration: [
    "수강신청지침", "계절학기"
  ],
  graduation: [
    "졸업이수학점", "졸업", "수료", "조기졸업"
  ],
  academic_status: [
    "휴·복학", "제적", "재입학",
    "학사경고", "성적규정"
  ],
  curriculum: [
    "전공과정", "교양과정", "교양필수이수학점",
    "교직과정 이수예정자 선발",
    "기본이수과목 및 교과교육과목 현황",
    "학석사연계과정", "강의평가 및 결과 공개"
  ],
  scholarship: [
    "교내장학", "교외장학", "국가/국가근로장학"
  ],
  military: [
    "병무", "학군단(ROTC)", "예비군", "민방위"
  ],
  housing: [
    "국제학사 GlobeeDorm(서울)", "GLOBAL HALL(서울)"
  ],
  facilities: [
    "주요시설 및 설비", "시설대관", "주차시설"
  ],
  student_support: [
    "진로 취업", "교육복지", "학생상담",
    "보건진료", "복지", "현장실습", "생활협동조합"
  ],
  administration: [
    "인터넷증명발급", "증명서", "서울", "전자규정집"
  ],
  it_service: [
    "S/W", "e-mail 서비스",
    "Eduroam(에듀롬)사용안내",
    "국제전화 서비스", "홈페이지",
    "모바일서비스", "무선인터넷 사용방법"
  ],
  campus_life: [
    "동아리", "체육생활"
  ]
};

// 제목만으로 분류하기 어려운 조각의 검토 결과.
const CHUNK_TOPICS = {
  "11335-01": "it_service",
  "11307-01": "student_support",

  "11289-04": "curriculum",
  "11289-05": "curriculum",
  "11289-07": "scholarship",

  "guide2026-01": "facilities",
  "guide2026-02": "facilities",
  "guide2026-03": "it_service",
  "guide2026-04": "administration",

  "lifeguide2026-01": "administration",
  "lifeguide2026-02": "administration",
  "lifeguide2026-03": "student_support",
  "lifeguide2026-04": "scholarship",
  "lifeguide2026-05": "student_support",
  "lifeguide2026-06": "student_support",
  "lifeguide2026-07": "student_support",
  "lifeguide2026-08": "student_support",
  "lifeguide2026-09": "student_support",
  "lifeguide2026-10": "student_support",
  "lifeguide2026-11": "student_support",
  "lifeguide2026-12": "student_support",
  "lifeguide2026-13": "student_support",
  "lifeguide2026-14": "facilities",
  "lifeguide2026-15": "facilities",
  "lifeguide2026-16": "facilities",
  "lifeguide2026-17": "facilities",
  "lifeguide2026-18": "facilities",
  "lifeguide2026-19": "student_support",
  "lifeguide2026-20": "student_support",
  "lifeguide2026-21": "student_support",
  "lifeguide2026-22": "student_support",
  "lifeguide2026-23": "curriculum",
  "lifeguide2026-24": "it_service",

  "team1124-01": "facilities"
};

export function classifyTopic(chunk) {
  if (Object.hasOwn(CHUNK_TOPICS, chunk.id)) {
    return CHUNK_TOPICS[chunk.id];
  }

  const title = String(chunk.title || "").trim();

  for (const [topic, titles] of Object.entries(TOPICS)) {
    if (titles.includes(title)) {
      return topic;
    }
  }

  if (title.endsWith("전공")) {
    return "major";
  }

  return "unknown";
}
