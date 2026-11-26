// 2026학년도 제2학기 서울캠퍼스 수강편람 수동 조각
const SUGANG_TITLE =
  "2026학년도 제2학기 서울캠퍼스 수강편람";

const SUGANG_SUBTOPICS = {
  "sugang2026-2-01": "registration_eligibility",
  "sugang2026-2-02": "registration_credits",
  "sugang2026-2-03": "registration_basket",
  "sugang2026-2-04": "registration_preapply",
  "sugang2026-2-05": "registration_schedule",
  "sugang2026-2-06": "registration_overload",
  "sugang2026-2-07": "registration_overload",
  "sugang2026-2-08": "registration_carryover",
  "sugang2026-2-09": "registration_change",
  "sugang2026-2-10": "registration_closed_course",
  "sugang2026-2-11": "registration_cancel",
  "sugang2026-2-12": "registration_retake",
  "sugang2026-2-13": "registration_retake",
  "sugang2026-2-14": "registration_retake",
  "sugang2026-2-15": "registration_rules"
};

function isSugangChunk(chunk) {
  return chunk.title === SUGANG_TITLE &&
    Object.hasOwn(SUGANG_SUBTOPICS, chunk.id);
}

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
  if (isSugangChunk(chunk)) return "registration";
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

// 캠퍼스가 명확하게 표시된 조각만 태깅합니다.
export function classifyCampus(chunk) {
  if (isSugangChunk(chunk)) return "seoul";
  const text = String(chunk.text || "").trim();
  const section = String(chunk.section || "");

  if (
    chunk.title === "졸업이수학점" &&
    section.startsWith("서울캠퍼스")
  ) {
    return "seoul";
  }

  if (text.startsWith("[서울]")) return "seoul";
  if (text.startsWith("[글로벌]")) return "global";

  return null;
}

// 원문에서 적용 학번 범위를 확인한 조각만 등록합니다.
const COHORT_RANGES = {
  "11373-01": [2025, null],
  "11373-02": [2015, 2024],
  "11373-t01": [2025, null],
  "11373-t02": [2025, null],
  "11373-t03": [2015, 2024],
  "11373-t04": [2015, 2024],
  "11373-t05": [2015, 2023],
  "11373-t06": [2024, 2024],
  "11388-t01": [null, 2024],
  "11388-t02": [2025, null]
};

export function classifyCohort(chunk) {
  const range = Object.hasOwn(COHORT_RANGES, chunk.id)
    ? COHORT_RANGES[chunk.id]
    : [null, null];

  return {
    cohort_min: range[0],
    cohort_max: range[1]
  };
}

// 핵심 평가 분야의 세부 주제를 구분합니다.
const CONVERGENCE_MAJORS = new Set([
  "융합전공 전체보기",
  "BRICs(브릭스)전공",
  "EU(유럽연합)전공",
  "동북아외교통상전공",
  "문화콘텐츠학전공",
  "국가리더전공",
  "세계문화예술경영전공",
  "디지털인문한국학전공",
  "AI융합전공",
  "데이터사이언스전공",
  "바이오데이터사이언스전공",
  "상담·UX심리전공",
  "Business & AI 전공",
  "융복합소프트웨어전공",
  "지역경제개발협력전공",
  "보험계리학전공"
]);

export function classifySubtopic(chunk) {
  if (isSugangChunk(chunk)) {
    return SUGANG_SUBTOPICS[chunk.id];
  }
  const title = String(chunk.title || "");
  const section = String(chunk.section || "");

  if (title === "이중전공") {
    if (section.startsWith("후기 이중전공")) {
      return "late_double_major";
    }

    if (section === "문의") {
      return "major_contact";
    }

    if ([
      "신청기간 및 방법",
      "이수요건",
      "배정원칙 및 기준",
      "유의사항"
    ].includes(section)) {
      return "double_major";
    }

    return null;
  }

  if (title === "부전공") return "minor";
  if (title === "전과") return "major_transfer";
  if (title === "마이크로디그리") return "microdegree";

  if (CONVERGENCE_MAJORS.has(title)) {
    return "convergence_major";
  }

  if (title === "계절학기") {
    return "seasonal_semester";
  }

  if (title === "수강신청지침") {
    if (section === "예비수강신청함") {
      return "registration_basket";
    }

    if (section === "수강신청 > 수강신청 일정") {
      return "registration_schedule";
    }

    if (section === "수강신청 > 수강학점") {
      return "registration_credits";
    }

    if (section === "수강신청 변경") {
      return "registration_change";
    }

    if (section === "수강신청 취소") {
      return "registration_cancel";
    }
  }

  if (title === "학사일정(대학)") {
    if (section.includes("제1학기")) {
      return "spring_semester";
    }

    if (section.includes("여름방학")) {
      return "summer_break";
    }

    if (section.includes("제2학기")) {
      return "fall_semester";
    }

    if (section.includes("겨울방학")) {
      return "winter_break";
    }
  }

  return null;
}

// 원본 조각의 내용을 수정하지 않고 메타데이터만 생성합니다.
export function buildMetadata(chunk) {
  return {
    topic: classifyTopic(chunk),
    subtopic: classifySubtopic(chunk),
    campus: classifyCampus(chunk),
    ...classifyCohort(chunk)
  };
}
