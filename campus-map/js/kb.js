/*
 * 학사 지식 베이스 (브라우저와 서버 api/npc.js가 함께 사용)
 * 모든 항목은 학교 공식 페이지 내용을 요약한 것이며, 2026-11-08에 확인했습니다.
 * 학칙이 바뀌면 이 파일(또는 이후 벡터 DB)만 갱신하면 됩니다.
 */
(function (root) {
  const SRC = {
    grad: { label: { ko: "학사정보 > 교육과정 > 졸업이수학점", en: "Academics > Curriculum > Graduation Credits" }, url: "https://www.hufs.ac.kr/hufs/11373/subview.do" },
    dm: { label: { ko: "학사정보 > 학적 > 이중전공", en: "Academics > Records > Double Major" }, url: "https://envi.hufs.ac.kr/hufs/11384/subview.do" },
    reg: { label: { ko: "수강신청지침", en: "Course Registration Guidelines" }, url: "https://www.hufs.ac.kr/hufs/11377/subview.do" },
  };

  const KB = [
    {
      id: "grad-2025", source: SRC.grad,
      keywords: ["졸업", "졸업학점", "졸업요건", "126", "25학번", "2025", "신입생", "graduation", "graduate", "credits", "2025 entrants"],
      title: { ko: "졸업학점: 서울캠퍼스 2025학년도 이후 입학생", en: "Graduation credits: Seoul, entered 2025 or later" },
      text: {
        ko: "서울캠퍼스 2025학년도 이후 입학생(사범대학 제외)의 이중전공 이수 기준은 전공 42학점, 이중전공 42학점, 교양 32학점, 기초 6학점이며 졸업학점 합계는 126학점입니다. 사범대학은 기준이 다르므로 공식 표를 확인하세요.",
        en: "For Seoul Campus students who entered in 2025 or later (excluding the College of Education), the double major track requires 42 major, 42 double major, 32 liberal arts and 6 foundation credits, for a graduation total of 126. The College of Education differs, so check the official table.",
      },
    },
    {
      id: "grad-2015", source: SRC.grad,
      keywords: ["졸업", "졸업학점", "졸업요건", "134", "2015", "2024", "24학번", "23학번", "22학번", "21학번", "20학번", "ai융합", "graduation", "credits", "2024 entrants"],
      title: { ko: "졸업학점: 서울캠퍼스 2015~2024학년도 입학생", en: "Graduation credits: Seoul, entered 2015–2024" },
      text: {
        ko: "서울캠퍼스 2015~2024학년도 입학생의 이중전공 이수 기준은 전공 54학점, 이중전공 42학점, 교양 32학점이며 졸업학점 합계는 134학점입니다(사범대학, AI융합대학 제외). AI융합대학은 전공 42학점, 이중전공 42학점, 교양 32학점, 합계 134학점입니다.",
        en: "For Seoul Campus students who entered in 2015–2024, the double major track requires 54 major, 42 double major and 32 liberal arts credits, for a total of 134 (excluding the Colleges of Education and AI Convergence). The College of AI Convergence requires 42 major, 42 double major and 32 liberal arts credits, also 134 in total.",
      },
    },
    {
      id: "minor-credits", source: SRC.grad,
      keywords: ["부전공", "전공심화", "단일전공", "21학점", "minor", "intensive"],
      title: { ko: "부전공·전공심화 이수학점", en: "Minor and intensive major credits" },
      text: {
        ko: "서울캠퍼스 2025학년도 이후 입학생(사범대학 제외)은 부전공 트랙에서 전공 42학점과 부전공 21학점을, 전공심화+부전공 트랙에서 전공 54학점과 부전공 21학점을, 전공심화(단일전공) 트랙에서 전공 54학점을 이수합니다.",
        en: "Seoul Campus students who entered in 2025 or later (excluding the College of Education) take 42 major and 21 minor credits on the minor track, 54 major and 21 minor credits on the intensive major plus minor track, and 54 major credits on the intensive single major track.",
      },
    },
    {
      id: "dm-apply", source: SRC.dm,
      keywords: ["이중전공", "신청", "언제", "시기", "기간", "방법", "2학년", "종합정보시스템", "double major", "apply", "when", "start"],
      title: { ko: "이중전공 시작 시기와 신청 방법", en: "When and how to apply for a double major" },
      text: {
        ko: "이중전공은 2학년부터 시작합니다. 1학년 과정이 끝나기 전에 학교 홈페이지의 종합정보시스템에서 신청합니다.",
        en: "A double major starts from the second year. Apply through the university's integrated information system before the end of the first-year program.",
      },
    },
    {
      id: "dm-select", source: SRC.dm,
      keywords: ["이중전공", "배정", "선발", "우선", "34학점", "32학점", "150%", "비율", "성적", "계절학기", "double major", "selection", "priority", "quota"],
      title: { ko: "이중전공 배정 원칙", en: "Double major selection rules" },
      text: {
        ko: "1학년 과정을 마치고 34학점 이상 취득한 학생을 우선 선발합니다. 25학번 이후는 32학점 이상이 기준입니다. 배정은 학과별 기준을 따르고 배정 학기의 계절학기 성적은 포함하지 않습니다. 배정 비율은 입학정원의 150%이며 사범대학은 100%입니다.",
        en: "Students with 34 or more credits after the first-year program get priority (32 or more from the 2025 entering class). Each department sets its own criteria, and summer or winter session grades in the assignment semester are excluded. The quota is 150% of the department's admission capacity, or 100% for the College of Education.",
      },
    },
    {
      id: "dm-limit", source: SRC.dm,
      keywords: ["이중전공", "제한", "사범대", "사범대학", "글로벌캠퍼스", "캠퍼스 간", "캠퍼스간", "순수외국인", "double major", "restriction", "education", "global campus"],
      title: { ko: "이중전공 제한 사항", en: "Double major restrictions" },
      text: {
        ko: "비사범대학 학생은 사범대학 각 학과의 전공을 이중전공으로 이수할 수 없습니다. 일부 학과는 학번에 따라 캠퍼스 간 이중전공과 부전공 이수를 제한합니다. 양 캠퍼스에 동일하게 개설된 융합전공과 부전공은 본인 소속 캠퍼스에서 이수합니다. 외국어로서의한국어교육전공과 외국어로서의한국어통번역전공은 순수외국인전형 입학생만 신청할 수 있습니다.",
        en: "Students outside the College of Education cannot take its majors as a double major. Some departments restrict cross-campus double majors and minors depending on the entering year. Convergence majors and minors offered at both campuses must be taken at your own campus. The two Korean-as-a-foreign-language majors are open only to students admitted through the international student track.",
      },
    },
    {
      id: "dm-late", source: SRC.dm,
      keywords: ["후기이중전공", "후기 이중전공", "9학기", "4월", "부전공", "late double major", "ninth semester", "april"],
      title: { ko: "후기 이중전공", en: "Late double major" },
      text: {
        ko: "부전공 이수자가 정규 8학기 안에 졸업학점을 모두 취득한 뒤 1~2학기를 추가로 수학해 제1전공과 이중전공 학위를 함께 받는 제도입니다. 2015학번 이후 이중전공 이수학점은 42학점입니다. 8학기까지 학점을 모두 채웠더라도 9학기 등록과 수강신청이 필수입니다. 신청은 매년 4월 중 연 1회이며, 조기졸업 대상자와 학·석사연계과정 이수자는 신청할 수 없습니다.",
        en: "Minor students who earn all graduation credits within eight semesters can study one or two more semesters to receive both first major and double major degrees. It requires 42 double major credits for the 2015 entering class onward. Registering and enrolling for a ninth semester is mandatory, even if all credits are finished by the eighth. Applications open once a year in April. Early graduates and combined bachelor's-master's students cannot apply.",
      },
    },
    {
      id: "reg-basket", source: SRC.reg,
      keywords: ["예비수강신청", "예비수강신청함", "장바구니", "15강좌", "담기", "basket", "cart", "pre-registration", "수강신청"],
      title: { ko: "예비수강신청함", en: "Pre-registration basket" },
      text: {
        ko: "예비수강신청함에는 최대 15강좌까지 담을 수 있습니다. 담은 과목은 수강신청 기간에 반드시 수강신청으로 처리해야 이수할 수 있습니다.",
        en: "The pre-registration basket holds up to 15 courses. Courses in the basket still must be registered during the registration period to count.",
      },
    },
    {
      id: "reg-schedule", source: SRC.reg,
      keywords: ["수강신청", "일정", "학년", "등록횟수", "등록", "언제", "registration", "schedule", "year", "when"],
      title: { ko: "수강신청 학년 구분", en: "Registration schedule by year" },
      text: {
        ko: "수강신청 학년은 해당 학기 등록 횟수로 구분합니다. 1학년은 1~2회, 2학년은 3~4회, 3학년은 5~6회, 4학년은 7회 이상입니다. 세부 일정은 매 학기 공지사항을 확인해야 합니다.",
        en: "Registration year is based on the number of registered semesters: 1–2 for first year, 3–4 for second, 5–6 for third, and 7 or more for fourth. Check each semester's notice for exact dates.",
      },
    },
    {
      id: "reg-limit", source: SRC.reg,
      keywords: ["최대", "수강학점", "이월", "최대학점", "수강편람", "maximum", "max credits", "carry over"],
      title: { ko: "학기당 최대 수강학점과 이월", en: "Credit limit and carry-over" },
      text: {
        ko: "학기당 최대 수강학점은 학번과 단과대학에 따라 다르므로 캠퍼스별 수강편람을 확인해야 합니다. 같은 해 1학기에 신청하지 않은 최대 수강학점만큼을 2학기에 이월해 신청할 수 있으며, 대상과 이월 학점도 수강편람을 따릅니다.",
        en: "The per-semester credit limit varies by entering year and college, so check your campus course catalog. Unused credit allowance from the first semester can be carried over to the second semester of the same year, and the catalog sets who qualifies and how much.",
      },
    },
    {
      id: "reg-change", source: SRC.reg,
      keywords: ["수강취소", "취소", "변경", "정정", "12학점", "여석", "4학년", "cancel", "drop", "change", "add"],
      title: { ko: "수강 변경과 취소", en: "Changing and cancelling courses" },
      text: {
        ko: "수강 변경 기간에는 과목별 여석 범위 안에서 추가 신청할 수 있습니다. 수강 취소는 12학점 미만이 되도록 할 수 없습니다. 4학년은 예외이지만 전체 과목을 취소할 수는 없습니다.",
        en: "During the change period you can add courses within available seats. A cancellation cannot bring you below 12 credits. Fourth-year students are exempt but cannot cancel every course.",
      },
    },
    {
      id: "reg-self", source: SRC.reg,
      keywords: ["본인", "대리", "성적", "청강", "수강신청 없이", "수강신청 안 하고", "수업 들으면", "무단", "without registering", "grade", "audit"],
      title: { ko: "수강신청 유의사항", en: "Registration notes" },
      text: {
        ko: "수강신청은 학생 본인이 기간 중 직접 해야 합니다. 수강신청 없이 수업에 참여하면 성적으로 인정되지 않습니다.",
        en: "Students must register for courses themselves during the period. Attending a class without registering does not earn a grade.",
      },
    },
    {
      id: "contact", source: SRC.dm,
      keywords: ["담당", "부서", "문의", "연락처", "전화", "학사종합지원센터", "contact", "office", "phone", "call"],
      title: { ko: "담당 부서", en: "Responsible office" },
      text: {
        ko: "이중전공 페이지의 담당 부서는 서울 학사종합지원센터(02-2173-2130)와 글로벌 학사종합지원센터(031-330-4026)입니다.",
        en: "The office listed on the double major page is the Academic Support Center: Seoul 02-2173-2130, Global 031-330-4026.",
      },
    },
  ];

  root.KB = KB;
  if (typeof module !== "undefined" && module.exports) module.exports = KB;
})(typeof globalThis !== "undefined" ? globalThis : this);
