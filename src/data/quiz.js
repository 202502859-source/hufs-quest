// 맵 곳곳의 '?' 퀴즈 상자에서 나오는 O/X 문제 100개입니다(O 50 · X 50, 학사 45 · 외대 상식 25 · 학교생활 30).
// 2026-11-27에 40문제를 더했습니다. 새 문제의 근거 원문은 docs/quiz-100-check.md 표에 있습니다.
// 모든 문제는 출처(source)의 원문과 대조해 만들었습니다(2026-11 기준).
// 학교 제도·시설 정보는 바뀔 수 있으니, 바뀌면 source.url의 원문을 다시 확인하고 고쳐 주세요.
//
// 형식
//   id        : 문제 고유 이름 (경험치 중복 지급 방지에 사용)
//   category  : "academic"(학사) | "hufs"(외대 상식) | "life"(학교생활)
//   question  : { ko, en } 문제 문장
//   answer    : true = O, false = X
//   explain   : { ko, en } 정답 해설
//   source    : { name: { ko, en }, url } 출처 이름과 원문 링크 (화면에 "출처: 이름 ↗"로 표시)

export const QUIZ_CATEGORIES = {
  academic: { ko: "학사", en: "Academics" },
  hufs: { ko: "외대 상식", en: "About HUFS" },
  life: { ko: "학교생활", en: "Campus Life" },
};

const hufsPage = (no) => `https://www.hufs.ac.kr/hufs/${no}/subview.do`;
const site = (no, ko, en) => ({ name: { ko: `한국외대 홈페이지 – ${ko}`, en: `HUFS website – ${en}` }, url: hufsPage(no) });

const SRC = {
  grad: site(11373, "졸업이수학점", "Graduation Credits"),
  warning: site(11382, "학사경고", "Academic Warning"),
  seasonal: site(11378, "계절학기", "Seasonal Session"),
  doubleMajor: site(11384, "이중전공", "Double Major"),
  minor: site(11385, "부전공", "Minor"),
  registration: site(11377, "수강신청지침", "Course Registration Guide"),
  grades: site(11379, "성적규정", "Grading Rules"),
  transfer: site(11388, "전과", "Change of Major"),
  certificate: site(11304, "증명서", "Certificates"),
  graduation: site(11390, "졸업", "Graduation"),
  earlyGrad: site(11389, "조기졸업", "Early Graduation"),
  leave: site(11387, "휴·복학", "Leave of Absence"),
  bachelorMaster: site(11386, "학석사연계과정", "Combined Bachelor's-Master's"),
  microDegree: site(13511, "마이크로디그리", "Micro Degree"),
  liberalArts: site(11372, "교양과정", "Liberal Arts"),
  readmission: site(11381, "재입학", "Readmission"),
  ideals: site(11115, "교훈 및 창학정신", "Founding Ideals"),
  symbol: site(11128, "상징(교표)", "University Emblem"),
  directions: site(11162, "찾아오시는 길", "Directions"),
  vision: site(11119, "외대비전 2028", "Vision 2028"),
  facts: site(11142, "Facts & Figures", "Facts & Figures"),
  phone: site(11159, "전화안내", "Phone Directory"),
  dorm: site(11313, "국제학사 GlobeeDorm", "GlobeeDorm"),
  welfare: site(11316, "복지시설", "Welfare Facilities"),
  health: site(11301, "보건진료", "Health Center"),
  coop: site(11325, "생활협동조합", "University Co-op"),
  council: site(11166, "자치기구·단체", "Student Council"),
  clubs: site(11292, "동아리", "Clubs"),
  facilities: site(11321, "시설대관", "Facility Rental"),
  parking: site(11323, "주차시설", "Parking"),
  exchange: site(11291, "국제교류", "International Exchange"),
  slogan: {
    name: { ko: "대학저널 – 나민구 한국외대 입학처장 인터뷰 (2017)", en: "Daehak Journal – HUFS admissions interview (2017)" },
    url: "https://dhnews.co.kr/news/view/179516293415854",
  },
  festival: {
    name: { ko: "대학저널 – 한국외대 가을축제 'QUINQUATRIA: LIGHT UP' (2022)", en: "Daehak Journal – HUFS festival 'QUINQUATRIA: LIGHT UP' (2022)" },
    url: "https://dhnews.co.kr/news/view/179524878683285",
  },
  // ── 2026-11-27 추가 40문제용 출처(모두 학교 공식 홈페이지) ──
  courseEval: site(12647, "강의평가 및 결과 공개", "Course Evaluation"),
  teaching: site(11398, "교직과정 이수예정자 선발", "Teacher Certification Track"),
  convergence: site(11254, "융합전공", "Convergence Majors"),
  history: site(11123, "역사", "History"),
  timeline: site(11124, "연표", "Timeline"),
  mascotSymbol: site(11133, "상징", "University Symbol"),
  character: site(11137, "캐릭터", "Mascot Character"),
  talent: site(11120, "인재상", "Ideal Graduate"),
  competency: site(11121, "핵심역량", "Core Competencies"),
  rotc: site(11294, "학군단(ROTC)", "ROTC"),
  reserve: site(11296, "예비군", "Reserve Forces"),
  globalHall: site(11314, "GLOBAL HALL(서울)", "Global Hall (Seoul)"),
  internship: site(11303, "현장실습", "Internships"),
  eduroam: site(11334, "Eduroam(에듀롬) 사용안내", "Eduroam Guide"),
  software: site(11338, "S/W", "Software"),
  email: site(11340, "e-mail 서비스", "E-mail Service"),
  counseling: site(11300, "학생상담", "Student Counseling"),
};

export const QUIZ = [
  // ───────────── 학사 (30) ─────────────
  {
    id: "grad-2025",
    category: "academic",
    question: {
      ko: "서울캠퍼스 2025학년도 이후 입학생(사범대 제외)의 졸업학점은 126학점이다.",
      en: "Seoul Campus students admitted in 2025 or later (excluding the College of Education) need 126 credits to graduate.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 2025학년도 이후 입학생은 사범대학을 제외하고 졸업학점이 126학점이에요.",
      en: "Correct. For students admitted in 2025 or later, the requirement is 126 credits (except the College of Education).",
    },
    source: SRC.grad,
  },
  {
    id: "grad-2015",
    category: "academic",
    question: {
      ko: "서울캠퍼스 2015~2024학년도 입학생(사범대·AI융합대 제외)의 졸업학점은 126학점이다.",
      en: "Seoul Campus students admitted in 2015–2024 (excluding Education and AI Convergence) need 126 credits to graduate.",
    },
    answer: false,
    explain: {
      ko: "2015~2024학년도 입학생(사범대·AI융합대 제외)은 134학점이에요. 126학점은 2025학년도 이후 입학생 기준이에요.",
      en: "Students admitted in 2015–2024 (excluding Education and AI Convergence) need 134 credits. 126 credits applies from the 2025 intake.",
    },
    source: SRC.grad,
  },
  {
    id: "liberal-arts-32",
    category: "academic",
    question: {
      ko: "서울캠퍼스 2025학년도 이후 입학생(사범대 제외)은 교양을 최소 32학점 이수해야 한다.",
      en: "Seoul Campus students admitted in 2025 or later (excluding Education) must complete at least 32 liberal arts credits.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 졸업학점 배분표에서 교양 최소 이수학점은 32학점이에요.",
      en: "Correct. The graduation credit table sets at least 32 liberal arts credits.",
    },
    source: SRC.grad,
  },
  {
    id: "warning-dismissal",
    category: "academic",
    question: {
      ko: "학사경고가 4회 이상 누적되면 제적된다.",
      en: "A student is dismissed after receiving four or more academic warnings.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 학사경고가 4회 이상 누적되면 학업성적 불량으로 제적돼요.",
      en: "Correct. Four or more accumulated academic warnings lead to dismissal for poor academic performance.",
    },
    source: SRC.warning,
  },
  {
    id: "warning-gpa",
    category: "academic",
    question: {
      ko: "한 학기 평점평균이 1.75 미만이면 학사경고를 받는다.",
      en: "A semester GPA below 1.75 results in an academic warning.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 매 학기 평점평균이 1.75 미만이면 학사경고를 받아요.",
      en: "Correct. A semester GPA below 1.75 results in an academic warning.",
    },
    source: SRC.warning,
  },
  {
    id: "readmission-warning",
    category: "academic",
    question: {
      ko: "성적 불량으로 제적됐다가 재입학한 학생은 학사경고를 한 번만 받아도 다시 제적된다.",
      en: "A student readmitted after dismissal for poor grades is dismissed again after even one academic warning.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 학업성적 불량으로 제적된 뒤 재입학한 학생은 학사경고를 단 1회라도 받으면 다시 제적돼요.",
      en: "Correct. After readmission following dismissal for poor grades, a single academic warning leads to dismissal again.",
    },
    source: SRC.readmission,
  },
  {
    id: "seasonal-credits",
    category: "academic",
    question: {
      ko: "계절학기에는 한 번에 최대 9학점까지 신청할 수 있다.",
      en: "You can take up to 9 credits in one summer or winter session.",
    },
    answer: false,
    explain: {
      ko: "계절학기마다 신청할 수 있는 학점은 최대 6학점이에요.",
      en: "Each summer or winter session allows up to 6 credits.",
    },
    source: SRC.seasonal,
  },
  {
    id: "seasonal-leave",
    category: "academic",
    question: {
      ko: "휴학생은 계절학기를 들을 수 없다.",
      en: "Students on leave of absence cannot take summer or winter session courses.",
    },
    answer: false,
    explain: {
      ko: "계절학기가 끝난 뒤 바로 이어지는 정규학기에 복학하면 휴학생도 들을 수 있어요. 휴학 중 인정 학점은 최대 6학점이에요.",
      en: "Students on leave can take them if they return to the regular semester right after. Up to 6 credits are recognized while on leave.",
    },
    source: SRC.seasonal,
  },
  {
    id: "dm-start",
    category: "academic",
    question: {
      ko: "이중전공은 1학년부터 시작한다.",
      en: "A double major starts from the first year.",
    },
    answer: false,
    explain: {
      ko: "이중전공은 2학년부터 시작해요. 신청은 1학년 과정이 끝나기 전에 종합정보시스템에서 해요.",
      en: "A double major starts from the second year. You apply in the student information system before finishing your first year.",
    },
    source: SRC.doubleMajor,
  },
  {
    id: "dm-education",
    category: "academic",
    question: {
      ko: "비사범대 학생은 사범대 학과를 이중전공으로 이수할 수 없다.",
      en: "Students outside the College of Education cannot take an Education department as a double major.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 비사범대학 학생은 사범대학 각 학과의 전공을 이중전공으로 이수할 수 없어요.",
      en: "Correct. Students outside the College of Education cannot take its majors as a double major.",
    },
    source: SRC.doubleMajor,
  },
  {
    id: "minor-credits",
    category: "academic",
    question: {
      ko: "부전공은 21학점 이상 이수해야 한다.",
      en: "A minor requires at least 21 credits.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 부전공 이수학점은 21학점 이상이에요.",
      en: "Correct. A minor requires 21 or more credits.",
    },
    source: SRC.minor,
  },
  {
    id: "basket-limit",
    category: "academic",
    question: {
      ko: "예비수강신청함에는 최대 15강좌까지 담을 수 있다.",
      en: "You can put up to 15 courses in the pre-registration basket.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 최대 15강좌를 담을 수 있고, 담은 과목은 수강신청 기간에 꼭 신청으로 처리해야 해요.",
      en: "Correct. The basket holds up to 15 courses, and you must still register for them during the registration period.",
    },
    source: SRC.registration,
  },
  {
    id: "drop-limit",
    category: "academic",
    question: {
      ko: "수강신청 취소로 12학점 미만이 되어도 상관없다.",
      en: "It is fine to drop courses even if you end up with fewer than 12 credits.",
    },
    answer: false,
    explain: {
      ko: "12학점 미만으로는 수강신청을 취소할 수 없어요. 4학년은 예외지만 전체 과목을 취소할 수는 없어요.",
      en: "You cannot drop below 12 credits. Fourth-year students are an exception, but they still cannot drop all courses.",
    },
    source: SRC.registration,
  },
  {
    id: "grade-a0",
    category: "academic",
    question: {
      ko: "성적 A0의 평점은 4.0이다.",
      en: "An A0 grade is worth 4.0 grade points.",
    },
    answer: true,
    explain: {
      ko: "맞아요. A+는 4.5, A0는 4.0, B+는 3.5예요.",
      en: "Correct. A+ is 4.5, A0 is 4.0 and B+ is 3.5.",
    },
    source: SRC.grades,
  },
  {
    id: "retake",
    category: "academic",
    question: {
      ko: "이미 D0 이상으로 통과한 과목도 재수강할 수 있다.",
      en: "You can retake a course even if you already passed it with D0 or higher.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 성적규정에 따르면 일단 학점을 취득한 과목도 재수강할 수 있어요.",
      en: "Correct. Under the grading rules, a course you already earned credit for can be retaken.",
    },
    source: SRC.grades,
  },
  {
    id: "transfer-once",
    category: "academic",
    question: {
      ko: "전과는 재학 중 여러 번 신청할 수 있다.",
      en: "You can change your major (transfer departments) several times while enrolled.",
    },
    answer: false,
    explain: {
      ko: "전과는 재학 중 1회만 할 수 있고, 여러 학과에 동시에 신청할 수도 없어요.",
      en: "You can transfer departments only once while enrolled, and you cannot apply to several at once.",
    },
    source: SRC.transfer,
  },
  {
    id: "transfer-gpa",
    category: "academic",
    question: {
      ko: "전과를 신청하려면 평점평균이 3.50 이상이어야 한다.",
      en: "You need a GPA of 3.50 or higher to apply for a change of major.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 정해진 학점 이상을 취득하고 평점평균 3.50 이상인 재학생이 신청할 수 있어요.",
      en: "Correct. Enrolled students who earned the required credits with a GPA of 3.50 or higher can apply.",
    },
    source: SRC.transfer,
  },
  {
    id: "transfer-double-major",
    category: "academic",
    question: {
      ko: "전과한 학생은 원래 학과의 전공을 이중전공으로 이수할 수 있다.",
      en: "After changing majors, you can take your former department as a double major.",
    },
    answer: false,
    explain: {
      ko: "전과생은 전적 학과의 전공을 이중전공으로 이수할 수 없어요. 부전공은 가능해요.",
      en: "You cannot take your former department as a double major, but you can take it as a minor.",
    },
    source: SRC.transfer,
  },
  {
    id: "graduation-gpa",
    category: "academic",
    question: {
      ko: "졸업하려면 총 평점평균이 2.00 이상이어야 한다.",
      en: "You need an overall GPA of 2.00 or higher to graduate.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 영역별 졸업학점을 채우고 총 평점평균이 2.00 이상이어야 졸업할 수 있어요.",
      en: "Correct. You must meet the credit requirements and have an overall GPA of 2.00 or higher.",
    },
    source: SRC.graduation,
  },
  {
    id: "graduation-leave",
    category: "academic",
    question: {
      ko: "졸업학점을 모두 채웠다면 휴학 중에도 졸업할 수 있다.",
      en: "If you have earned all required credits, you can graduate while on leave of absence.",
    },
    answer: false,
    explain: {
      ko: "졸업에 필요한 학점을 모두 이수했어도 휴학 중에는 졸업할 수 없어요. 졸업하는 학기에는 재학 중이어야 해요.",
      en: "Even with all credits completed, you cannot graduate while on leave. You must be enrolled in your graduating semester.",
    },
    source: SRC.graduation,
  },
  {
    id: "summa-cum-laude",
    category: "academic",
    question: {
      ko: "최우등(Summa Cum Laude) 졸업은 졸업 평점 4.0 이상이면 된다.",
      en: "Graduating Summa Cum Laude only requires a final GPA of 4.0 or higher.",
    },
    answer: false,
    explain: {
      ko: "최우등은 4.25 이상이에요. 4.0 이상 4.25 미만은 우등(Magna Cum Laude)이고, 2026년 2월 졸업생부터 적용돼요.",
      en: "Summa Cum Laude needs 4.25 or higher. 4.0 to below 4.25 is Magna Cum Laude, applied from February 2026 graduates.",
    },
    source: SRC.graduation,
  },
  {
    id: "early-graduation",
    category: "academic",
    question: {
      ko: "조기졸업은 평점평균 4.0 이상인 학생이 7학기 만에 졸업하는 제도다.",
      en: "Early graduation lets students with a GPA of 4.0 or higher graduate in 7 semesters.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 성적이 우수한 학생(평점평균 4.0 이상)이 수업연한을 1학기 줄여 7학기에 졸업하는 제도예요.",
      en: "Correct. High achievers (GPA 4.0+) can shorten their studies by one semester and graduate in 7 semesters.",
    },
    source: SRC.earlyGrad,
  },
  {
    id: "leave-limit",
    category: "academic",
    question: {
      ko: "일반 휴학은 재학 중 통산 5년까지 할 수 있다.",
      en: "A general leave of absence can total up to 5 years during your studies.",
    },
    answer: false,
    explain: {
      ko: "일반 휴학은 1회 1년이 원칙이고, 재학 중 통산 3년을 넘을 수 없어요.",
      en: "A general leave is one year at a time and cannot exceed 3 years in total.",
    },
    source: SRC.leave,
  },
  {
    id: "leave-freshman",
    category: "academic",
    question: {
      ko: "신입생도 첫 학기부터 자유롭게 일반 휴학을 할 수 있다.",
      en: "New students can freely take a general leave of absence in their first semester.",
    },
    answer: false,
    explain: {
      ko: "신·편입생의 첫 학기 일반 휴학은 원칙적으로 허가되지 않아요. 4주 이상 치료가 필요한 질병·입원만 예외예요.",
      en: "A general leave is not allowed in the first semester, except for illness or hospitalization needing 4+ weeks of treatment.",
    },
    source: SRC.leave,
  },
  {
    id: "leave-parental",
    category: "academic",
    question: {
      ko: "육아 휴학은 여학생만 신청할 수 있다.",
      en: "Only female students can apply for parental leave.",
    },
    answer: false,
    explain: {
      ko: "남학생도 육아 휴학을 신청할 수 있어요. 자녀 1명당 1회, 2년(4개 학기) 이내예요.",
      en: "Male students can also apply. It is once per child, for up to 2 years (4 semesters).",
    },
    source: SRC.leave,
  },
  {
    id: "bachelor-master",
    category: "academic",
    question: {
      ko: "학·석사 연계과정은 학사와 석사 학위를 6년 안에 받는 과정이다.",
      en: "The combined bachelor's-master's program lets you earn both degrees within 6 years.",
    },
    answer: false,
    explain: {
      ko: "학사 3.5년 + 석사 1.5년으로, 5년 안에 두 학위를 받는 과정이에요.",
      en: "It takes 3.5 years (bachelor's) + 1.5 years (master's), so both degrees within 5 years.",
    },
    source: SRC.bachelorMaster,
  },
  {
    id: "micro-degree",
    category: "academic",
    question: {
      ko: "마이크로디그리를 이수하지 않으면 졸업할 수 없다.",
      en: "You cannot graduate without completing a micro degree.",
    },
    answer: false,
    explain: {
      ko: "마이크로디그리는 이중·부전공과 별도로 운영되는 비학위과정으로, 졸업요건과 무관해요.",
      en: "A micro degree is a non-degree program separate from double majors and minors, and it is not a graduation requirement.",
    },
    source: SRC.microDegree,
  },
  {
    id: "college-language",
    category: "academic",
    question: {
      ko: "대학외국어(1)과 (2)는 서로 다른 언어로 이수해도 된다.",
      en: "You may take College Foreign Language (1) and (2) in different languages.",
    },
    answer: false,
    explain: {
      ko: "대학외국어(1), (2)는 반드시 같은 언어로 이수해야 해요.",
      en: "College Foreign Language (1) and (2) must be taken in the same language.",
    },
    source: SRC.liberalArts,
  },
  {
    id: "community-service",
    category: "academic",
    question: {
      ko: "사회봉사 교양은 재학 중 최대 2과목(4학점)까지 이수할 수 있다.",
      en: "Community service liberal arts courses can be taken up to 2 courses (4 credits) during your studies.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 사회봉사(정규·농활·해외)는 재학 중 최대 2과목(4학점)까지 이수할 수 있어요.",
      en: "Correct. Community service (regular, farm or overseas) is limited to 2 courses (4 credits).",
    },
    source: SRC.liberalArts,
  },
  {
    id: "cert-kiosk",
    category: "academic",
    question: {
      ko: "서울캠퍼스 증명서 자동발급기는 국제학사 1층 원스톱서비스센터 앞에 있다.",
      en: "The certificate kiosk on Seoul Campus is in front of the One-Stop Service Center on the 1st floor of the International Dormitory.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 국제학사 1층 114호 원스톱서비스센터 앞에 있고, 08:00~20:00에 이용할 수 있어요.",
      en: "Correct. It is in front of Room 114 on the 1st floor of the International Dormitory, available 08:00–20:00.",
    },
    source: SRC.certificate,
  },

  // ───────────── 외대 상식 (10) ─────────────
  {
    id: "founded-1954",
    category: "hufs",
    question: {
      ko: "한국외대는 1954년에 개교했다.",
      en: "HUFS was founded in 1954.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 한국전쟁 직후인 1954년, 조국의 근대화와 세계 평화를 위해 세워졌어요.",
      en: "Correct. It was founded in 1954, right after the Korean War, for the nation's modernization and world peace.",
    },
    source: SRC.ideals,
  },
  {
    id: "founding-spirit",
    category: "hufs",
    question: {
      ko: "한국외대의 창학정신은 '진리·평화·창조'이다.",
      en: "HUFS's founding spirit is 'Truth, Peace, Creation'.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 진리(眞理), 평화(平和), 창조(創造)가 한국외대의 창학정신이에요.",
      en: "Correct. Truth, Peace and Creation are HUFS's founding ideals.",
    },
    source: SRC.ideals,
  },
  {
    id: "slogan",
    category: "hufs",
    question: {
      ko: "한국외대의 슬로건은 '외대를 만나면 세계가 보인다'이다.",
      en: "HUFS's slogan is 'Meet HUFS, and you will see the world'.",
    },
    answer: true,
    explain: {
      ko: "맞아요. '외대를 만나면 세계가 보인다!'는 한국외대를 대표해 온 슬로건이에요.",
      en: "Correct. 'Meet HUFS, and you will see the world!' has long been HUFS's signature slogan.",
    },
    source: SRC.slogan,
  },
  {
    id: "emblem-letters",
    category: "hufs",
    question: {
      ko: "한국외대 교표의 'ㅇ'과 'ㄷ'은 '외대'라는 글자에서 따왔다.",
      en: "The 'ㅇ' and 'ㄷ' in the HUFS emblem come from the Korean word '외대' (Oe-dae).",
    },
    answer: true,
    explain: {
      ko: "맞아요. 'ㅇ'은 지구를 나타내 인재를 온 세계에 배출함을, 'ㄷ'은 진리·평화·창조를 상징해요.",
      en: "Correct. 'ㅇ' represents the globe, and 'ㄷ' symbolizes Truth, Peace and Creation.",
    },
    source: SRC.symbol,
  },
  {
    id: "emblem-color",
    category: "hufs",
    question: {
      ko: "한국외대 교표의 대표색은 빨간색이다.",
      en: "The main color of the HUFS emblem is red.",
    },
    answer: false,
    explain: {
      ko: "대표색은 청록색(Pantone 315C)이에요. 미래, 생명, 성장, 희망을 뜻해요.",
      en: "It is teal (Pantone 315C), representing the future, life, growth and hope.",
    },
    source: SRC.symbol,
  },
  {
    id: "campus-address",
    category: "hufs",
    question: {
      ko: "한국외대 서울캠퍼스는 서대문구에 있다.",
      en: "HUFS Seoul Campus is located in Seodaemun-gu.",
    },
    answer: false,
    explain: {
      ko: "서울캠퍼스는 동대문구 이문로 107에 있어요.",
      en: "Seoul Campus is at 107 Imun-ro, Dongdaemun-gu.",
    },
    source: SRC.directions,
  },
  {
    id: "languages-45",
    category: "hufs",
    question: {
      ko: "한국외대는 45개의 전문화된 외국어 교육을 하고 있다.",
      en: "HUFS offers specialized education in 45 foreign languages.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 외대비전 2028에 따르면 45개의 전문화된 외국어 교육을 바탕으로 하고 있어요.",
      en: "Correct. According to Vision 2028, HUFS is built on specialized education in 45 foreign languages.",
    },
    source: SRC.vision,
  },
  {
    id: "exchange-countries",
    category: "hufs",
    question: {
      ko: "한국외대는 100개가 넘는 나라의 대학·기관과 국제교류 협정을 맺고 있다.",
      en: "HUFS has international exchange agreements with universities and institutions in more than 100 countries.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 2026년 3월 5일 기준 102개 국가, 616개 대학, 73개 기관과 협정을 맺고 있어요.",
      en: "Correct. As of March 5, 2026: 102 countries, 616 universities and 73 institutions.",
    },
    source: SRC.facts,
  },
  {
    id: "language-ai",
    category: "hufs",
    question: {
      ko: "Language & AI융합학부는 AI융합대학 소속이다.",
      en: "The Division of Language & AI belongs to the College of AI Convergence.",
    },
    answer: true,
    explain: {
      ko: "맞아요. AI융합대학에는 Language & AI융합학부와 Social Science & AI융합학부가 있어요.",
      en: "Correct. The College of AI Convergence includes the Language & AI and Social Science & AI divisions.",
    },
    source: SRC.phone,
  },
  {
    id: "voxel-campus",
    category: "hufs",
    question: {
      ko: "한국외대 홈페이지에서는 캠퍼스를 3D 블록(복셀)으로 체험할 수 있다.",
      en: "On the HUFS website, you can explore the campus in 3D blocks (voxels).",
    },
    answer: true,
    explain: {
      ko: "맞아요. '찾아오시는 길' 페이지에서 '3D 복셀 캠퍼스 체험하기'를 할 수 있어요.",
      en: "Correct. The Directions page offers a '3D voxel campus' experience.",
    },
    source: SRC.directions,
  },

  // ───────────── 학교생활 (20) ─────────────
  {
    id: "festival-name",
    category: "life",
    question: {
      ko: "한국외대 서울캠퍼스 가을 대동제의 이름은 '퀸쿠아트리아(QUINQUATRIA)'이다.",
      en: "The autumn festival of HUFS Seoul Campus is called 'QUINQUATRIA'.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 2022년 가을 대동제 'QUINQUATRIA: LIGHT UP'처럼 퀸쿠아트리아라는 이름을 써요. 부제는 해마다 바뀔 수 있어요.",
      en: "Correct. For example, the 2022 festival was 'QUINQUATRIA: LIGHT UP'. The subtitle can change every year.",
    },
    source: SRC.festival,
  },
  {
    id: "festival-origin",
    category: "life",
    question: {
      ko: "축제 이름 '퀸쿠아트리아'는 그리스 신화의 아테나 축제에서 따왔다.",
      en: "The festival name 'Quinquatria' comes from a festival for Athena in Greek mythology.",
    },
    answer: false,
    explain: {
      ko: "고대 로마의 미네르바 여신 축제에서 영감을 받은 이름이에요.",
      en: "It is inspired by the ancient Roman festival for the goddess Minerva.",
    },
    source: SRC.festival,
  },
  {
    id: "dorm-name",
    category: "life",
    question: {
      ko: "서울캠퍼스 재학생 기숙사의 이름은 '국제학사 GlobeeDorm'이다.",
      en: "The Seoul Campus student dormitory is called 'GlobeeDorm' (International Dormitory).",
    },
    answer: true,
    explain: {
      ko: "맞아요. 국제학사 GlobeeDorm은 서울캠퍼스 재학생을 위한 기숙사예요.",
      en: "Correct. GlobeeDorm is the dormitory for Seoul Campus students.",
    },
    source: SRC.dorm,
  },
  {
    id: "dorm-rooms",
    category: "life",
    question: {
      ko: "국제학사 GlobeeDorm은 1인실 위주로 운영된다.",
      en: "GlobeeDorm mainly offers single rooms.",
    },
    answer: false,
    explain: {
      ko: "2인실(307실)과 3인실(16실)로 운영되며, 모두 662명이 입사할 수 있어요.",
      en: "It has double rooms (307) and triple rooms (16), housing 662 students in total.",
    },
    source: SRC.dorm,
  },
  {
    id: "dorm-selection",
    category: "life",
    question: {
      ko: "국제학사 재학생 입사 선발은 학업성적 70%와 통학거리 30%로 점수를 매긴다.",
      en: "GlobeeDorm selects current students by 70% grades and 30% commuting distance.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 재학생은 직전 학기 성적 70% + 통학거리 30%(외국인·재외국민은 35%)로 선발해요. 신입생은 거리가 먼 순서예요.",
      en: "Correct. Current students: previous semester grades 70% + distance 30% (35% for international students). Freshmen are ranked by distance.",
    },
    source: SRC.dorm,
  },
  {
    id: "dorm-meals",
    category: "life",
    question: {
      ko: "국제학사 입사 납입금에는 식비가 포함되어 있다.",
      en: "The GlobeeDorm fee includes meals.",
    },
    answer: false,
    explain: {
      ko: "입사 납입금에는 의무식사가 포함되지 않아요. 식사는 식권을 따로 사서 해요.",
      en: "Meals are not included. You buy meal tickets separately.",
    },
    source: SRC.dorm,
  },
  {
    id: "cafeteria-location",
    category: "life",
    question: {
      ko: "서울캠퍼스 학생식당은 인문과학관 1층에 있다.",
      en: "The Seoul Campus student cafeteria is on the 1st floor of the Humanities Building.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 인문과학관 1층 학생식당에서 한식, 양식, 면, 분식 코너를 운영해요.",
      en: "Correct. The cafeteria on the 1st floor of the Humanities Building serves Korean, Western, noodle and snack menus.",
    },
    source: SRC.welfare,
  },
  {
    id: "cafeteria-breakfast",
    category: "life",
    question: {
      ko: "서울캠퍼스 학생식당은 아침(조식)도 운영한다.",
      en: "The Seoul Campus student cafeteria also serves breakfast.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 조식은 08:00~10:00에 운영해요. 운영 시간은 바뀔 수 있으니 원문을 확인하세요.",
      en: "Correct. Breakfast is served 08:00–10:00. Hours may change, so check the source.",
    },
    source: SRC.welfare,
  },
  {
    id: "health-center-location",
    category: "life",
    question: {
      ko: "서울캠퍼스 보건실은 도서관 1층에 있다.",
      en: "The Seoul Campus health center is on the 1st floor of the library.",
    },
    answer: false,
    explain: {
      ko: "보건실은 학생회관(국제학사) 2층에 있어요. 전화는 02-2173-2139예요.",
      en: "It is on the 2nd floor of the Student Union (International Dormitory). Tel. 02-2173-2139.",
    },
    source: SRC.health,
  },
  {
    id: "health-center-doctor",
    category: "life",
    question: {
      ko: "서울캠퍼스 보건실에서는 학기 중 내과 진료상담을 받을 수 있다.",
      en: "At the Seoul Campus health center, you can get internal medicine consultations during the semester.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 학기 중 둘째·넷째 주 수요일 14:00~16:00에 내과 진료상담이 있어요.",
      en: "Correct. Internal medicine consultations are on the 2nd and 4th Wednesday of each month during the semester, 14:00–16:00.",
    },
    source: SRC.health,
  },
  {
    id: "student-id-bank",
    category: "life",
    question: {
      ko: "교수회관 1층 우리은행에서 학생증을 발급받을 수 있다.",
      en: "You can get your student ID card at the Woori Bank on the 1st floor of the Faculty Hall.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 교수회관 1층 우리은행에서 은행 업무와 학생증 발급 등을 해요(09:00~16:00).",
      en: "Correct. The Woori Bank in the Faculty Hall handles banking and student ID cards (09:00–16:00).",
    },
    source: SRC.welfare,
  },
  {
    id: "convenience-store",
    category: "life",
    question: {
      ko: "국제학사 1층 편의점은 연중무휴로 운영된다.",
      en: "The convenience store on the 1st floor of the International Dormitory is open all year round.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 국제학사 1층 CU편의점은 연중무휴로 운영되고 택배도 맡길 수 있어요.",
      en: "Correct. The CU store there is open every day of the year and also handles parcels.",
    },
    source: SRC.welfare,
  },
  {
    id: "coop-third",
    category: "life",
    question: {
      ko: "한국외대 생활협동조합은 국내에서 세 번째로 설립된 학생 생협이다.",
      en: "The HUFS university co-op was the third student co-op established in Korea.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 1990년 5월 31일 창립총회를 열었고, 국내에서 세 번째 학생 생협으로 설립됐어요.",
      en: "Correct. Founded on May 31, 1990, it was the third student co-op in Korea.",
    },
    source: SRC.coop,
  },
  {
    id: "student-council-60",
    category: "life",
    question: {
      ko: "2026년 서울캠퍼스 총학생회는 제60대 총학생회다.",
      en: "The 2026 Seoul Campus student council is the 60th student council.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 2026년 서울캠퍼스 총학생회는 제60대 총학생회 '선명'이고, 국제학사 450호에 있어요.",
      en: "Correct. The 60th student council 'Seonmyeong' runs in 2026, located in Room 450 of the International Dormitory.",
    },
    source: SRC.council,
  },
  {
    id: "club-thursday-music",
    category: "life",
    question: {
      ko: "'목요음악반'은 매주 목요일 정기 감상회를 여는 클래식 음악 감상 동아리다.",
      en: "'Thursday Music Club' is a classical music appreciation club that meets every Thursday.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 1972년에 만들어진 클래식 음악 감상 동아리로, 학기 중 매주 목요일 정기 감상회를 열어요.",
      en: "Correct. Founded in 1972, it holds regular listening sessions every Thursday during the semester.",
    },
    source: SRC.clubs,
  },
  {
    id: "club-eolsori",
    category: "life",
    question: {
      ko: "'얼소리'는 한국외대의 중앙 밴드 동아리다.",
      en: "'Eolsori' is HUFS's central rock band club.",
    },
    answer: false,
    explain: {
      ko: "얼소리는 다양한 국악기로 전통음악을 이어 가는 중앙국악관현악단 동아리예요.",
      en: "Eolsori is a central Korean traditional orchestra club that plays traditional instruments.",
    },
    source: SRC.clubs,
  },
  {
    id: "study-space",
    category: "life",
    question: {
      ko: "도서관 1층 스마트플라자 같은 학생 자율학습 시설은 꼭 미리 예약해야 쓸 수 있다.",
      en: "Self-study spaces such as the Smart Plaza on the library's 1st floor require a reservation.",
    },
    answer: false,
    explain: {
      ko: "학생 자율학습 시설(교수학습개발원 1층 멀티프라자, 도서관 1층 스마트플라자)은 예약 없이 이용할 수 있어요. 스터디룸은 대관사이트에서 예약해요.",
      en: "Self-study spaces (Multi Plaza, Smart Plaza) need no reservation. Study rooms are booked on the rental website.",
    },
    source: SRC.facilities,
  },
  {
    id: "parking-free",
    category: "life",
    question: {
      ko: "서울캠퍼스 주차장은 일반 차량도 15분 미만이면 무료다.",
      en: "At Seoul Campus, parking is free for general vehicles if under 15 minutes.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 일반 차량은 15분 미만 무료이고, 이후에는 시간에 따라 요금이 붙어요. 카드 결제만 돼요.",
      en: "Correct. Under 15 minutes is free; fees apply after that. Card payment only.",
    },
    source: SRC.parking,
  },
  {
    id: "exchange-tuition",
    category: "life",
    question: {
      ko: "교환학생은 외국 대학의 등록금을 따로 내야 한다.",
      en: "Exchange students must pay the partner university's tuition separately.",
    },
    answer: false,
    explain: {
      ko: "교환학생은 한국외대에 등록금을 내고, 외국 대학 등록금은 면제돼요.",
      en: "Exchange students pay HUFS tuition, and the partner university's tuition is waived.",
    },
    source: SRC.exchange,
  },
  {
    id: "seven-plus-one",
    category: "life",
    question: {
      ko: "'7+1 파견학생 제도'는 외국 대학에서 한 학기를 공부하는 장학금 제도다.",
      en: "The '7+1 program' is a scholarship program for studying one semester at a foreign university.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 외국 대학에서 1개 학기 동안 방문학생으로 공부하며, 한국외대 등록금은 장학금으로 면제되고 외국 대학 등록금은 직접 내요.",
      en: "Correct. You study one semester abroad as a visiting student; HUFS tuition is covered by a scholarship, but you pay the foreign university's tuition.",
    },
    source: SRC.exchange,
  },

  // ═════════════ 2026-11-27 추가 40문제 (근거 원문: docs/quiz-100-check.md) ═════════════
  // ───────────── 학사 추가 (15) ─────────────
  {
    id: "warning-no-course-registration",
    category: "academic",
    question: {
      ko: "등록을 하고도 정당한 사유 없이 수강신청을 하지 않으면 학사경고를 받는다.",
      en: "If you pay tuition but do not register for any courses without a valid reason, you receive an academic warning.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 평점평균이 1.75 미만일 때뿐 아니라, 등록을 하고도 정당한 사유 없이 수강신청을 하지 않은 학생도 학사경고를 받아요.",
      en: "Correct. Besides a GPA below 1.75, enrolling but not registering for courses without a valid reason also results in an academic warning.",
    },
    source: SRC.warning,
  },
  {
    id: "warning-extra-semester",
    category: "academic",
    question: {
      ko: "수업연한(4년)을 넘겨 등록한 학생도 평점평균이 1.75 미만이면 학사경고를 받는다.",
      en: "Students enrolled beyond the standard four years still receive an academic warning if their GPA falls below 1.75.",
    },
    answer: false,
    explain: {
      ko: "수업연한(4년)을 초과하여 등록한 학생은 학사경고 대상에서 제외돼요.",
      en: "Students enrolled beyond the standard four years are exempt from academic warnings.",
    },
    source: SRC.warning,
  },
  {
    id: "gpa-truncate",
    category: "academic",
    question: {
      ko: "평점평균을 계산할 때는 소수점 셋째 자리에서 반올림한다.",
      en: "When calculating GPA, the third decimal place is rounded.",
    },
    answer: false,
    explain: {
      ko: "반올림하지 않아요. 평점평균을 계산할 때 소수점 셋째 자리 이하는 절사(버림)해요.",
      en: "It is not rounded. Everything from the third decimal place onward is dropped (truncated).",
    },
    source: SRC.warning,
  },
  {
    id: "grade-aplus-score",
    category: "academic",
    question: {
      ko: "100점 기준으로 90점 이상이면 A+를 받는다.",
      en: "On a 100-point scale, a score of 90 or above earns an A+.",
    },
    answer: false,
    explain: {
      ko: "A+는 95~100점이에요. 90~94점은 A0예요.",
      en: "An A+ requires 95–100 points. A score of 90–94 is an A0.",
    },
    source: SRC.grades,
  },
  {
    id: "seasonal-min-enrollment",
    category: "academic",
    question: {
      ko: "계절학기 교과목은 수강신청 인원이 20명 이상이면 개설된다.",
      en: "A summer or winter session course opens as long as at least 20 students sign up.",
    },
    answer: false,
    explain: {
      ko: "계절학기에서는 수강신청 인원이 30명 미만인 교과목은 개설하지 않아요.",
      en: "Seasonal session courses with fewer than 30 students signed up are not offered.",
    },
    source: SRC.seasonal,
  },
  {
    id: "readmission-wait-grades",
    category: "academic",
    question: {
      ko: "학업성적 불량으로 제적되면 제적 학기를 포함해 1개 학기만 지나도 재입학을 신청할 수 있다.",
      en: "A student dismissed for poor grades can apply for readmission after just one semester, counting the semester of dismissal.",
    },
    answer: false,
    explain: {
      ko: "학업성적 불량·징계로 제적되면 제적된 학기를 포함해 2개 학기 이상 지나야 해요. 1개 학기는 미등록 제적·자퇴 등의 기준이에요.",
      en: "Students dismissed for poor grades or discipline must wait at least two semesters, counting the semester of dismissal.",
    },
    source: SRC.readmission,
  },
  {
    id: "readmission-records",
    category: "academic",
    question: {
      ko: "재입학이 허가되면 제적 전의 성적과 학사경고 기록은 그대로 유효하다.",
      en: "After readmission, your grades and academic warnings from before the dismissal remain valid.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 재입학이 허가되면 제적 전의 성적, 등록, 휴학, 학사경고, 제한조치 등이 계속 유효해요.",
      en: "Correct. Grades, enrollment, leave, academic warnings and restrictions from before the dismissal all carry over.",
    },
    source: SRC.readmission,
  },
  {
    id: "transfer-education",
    category: "academic",
    question: {
      ko: "비사범대학 학생도 사범대학의 학과로 전과할 수 있다.",
      en: "Students outside the College of Education can transfer into one of its departments.",
    },
    answer: false,
    explain: {
      ko: "비사범대학 학생은 사범대학의 학과로 전과할 수 없어요.",
      en: "Students outside the College of Education cannot transfer into its departments.",
    },
    source: SRC.transfer,
  },
  {
    id: "transfer-year-limit",
    category: "academic",
    question: {
      ko: "2026학년도 전과부터는 1개 학기 이상 이수했다면 학년 제한 없이 전과를 신청할 수 있다.",
      en: "From the 2026 transfer round, anyone who has completed at least one semester can apply regardless of year level.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 2026학년도 전과부터 학년 제한이 폐지되어 1개 학기 이상 이수자가 신청할 수 있어요. 학점·평점 기준은 그대로예요.",
      en: "Correct. The year-level limit was removed from 2026, so students with one or more semesters can apply. Credit and GPA requirements still apply.",
    },
    source: SRC.transfer,
  },
  {
    id: "late-double-major-ninth",
    category: "academic",
    question: {
      ko: "후기 이중전공은 8학기까지 필요한 학점을 모두 채웠더라도 9학기를 반드시 이수해야 한다.",
      en: "In the late double major track, you must enroll in a 9th semester even if you finished all required credits by the 8th.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 8학기까지 이중전공에 해당하는 학점을 모두 완료했어도 9학기 이수가 필수예요(수강신청과 등록 필요).",
      en: "Correct. Even with all double major credits done by the 8th semester, a 9th semester (with registration and tuition) is mandatory.",
    },
    source: SRC.doubleMajor,
  },
  {
    id: "convergence-ai-minor",
    category: "academic",
    question: {
      ko: "AI융합전공은 부전공으로도 이수할 수 있다.",
      en: "The AI Convergence major can also be taken as a minor.",
    },
    answer: false,
    explain: {
      ko: "융합전공은 이중전공으로만 이수할 수 있어요. 부전공으로도 이수할 수 있는 융합전공은 국가리더전공과 데이터사이언스전공뿐이에요.",
      en: "Convergence majors can only be taken as a double major. Only the National Leader and Data Science majors can also be taken as a minor.",
    },
    source: SRC.convergence,
  },
  {
    id: "teaching-apply-once",
    category: "academic",
    question: {
      ko: "비사범대 학생은 교직과정 이수예정자 선발에서 떨어져도 다음 해에 다시 신청할 수 있다.",
      en: "Students outside the College of Education who miss out on the teaching track can apply again the next year.",
    },
    answer: false,
    explain: {
      ko: "비사범대 교직과정 이수예정자 선발은 재학 중 1회만 신청할 수 있어요.",
      en: "You can apply for the teacher certification track only once during your studies.",
    },
    source: SRC.teaching,
  },
  {
    id: "course-eval-twice",
    category: "academic",
    question: {
      ko: "강의평가는 학기 말에 한 번만 실시한다.",
      en: "Course evaluations are conducted only once, at the end of the semester.",
    },
    answer: false,
    explain: {
      ko: "강의평가는 중간평가와 기말평가로 나누어 한 학기에 두 번 실시해요.",
      en: "Course evaluations are conducted twice a semester: a midterm evaluation and a final evaluation.",
    },
    source: SRC.courseEval,
  },
  {
    id: "bachelor-master-gpa",
    category: "academic",
    question: {
      ko: "학·석사 연계과정은 총 평점평균이 3.00 이상이면 지원할 수 있다.",
      en: "You can apply for the combined bachelor's-master's program with an overall GPA of 3.00 or higher.",
    },
    answer: false,
    explain: {
      ko: "3학년 1학기(5학기)까지 정해진 학점 이상을 취득하고 총 평점평균이 3.50 이상이어야 해요.",
      en: "You need the required credits by your 5th semester and an overall GPA of 3.50 or higher.",
    },
    source: SRC.bachelorMaster,
  },
  {
    id: "credit-carryover",
    category: "academic",
    question: {
      ko: "수강학점 이월은 1학기에 다 쓰지 않은 수강학점을 같은 해 2학기에 이월해 신청하는 제도다.",
      en: "Credit carryover lets you use course credits you did not take in the spring semester in the fall semester of the same year.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 1학기에 최대 수강학점까지 듣지 않은 학점은 같은 해 2학기로 이월돼요. 적용 대상과 이월 학점은 수강편람을 확인하세요.",
      en: "Correct. Credits left unused in spring carry over to the fall of the same year. See the course handbook for eligibility and limits.",
    },
    source: SRC.registration,
  },

  // ───────────── 외대 상식 추가 (15) ─────────────
  {
    id: "opening-place",
    category: "hufs",
    question: {
      ko: "한국외대는 1954년에 지금의 이문동 캠퍼스에서 개교했다.",
      en: "HUFS opened in 1954 on its present-day Imun-dong campus.",
    },
    answer: false,
    explain: {
      ko: "1954년 4월 20일 서울 종로2가 영보빌딩에서 개교했어요. 이문동으로는 1957년에 교사를 새로 지어 옮겼어요.",
      en: "It opened on April 20, 1954 in the Yeongbo Building in Jongno 2-ga, Seoul, and moved to a new building in Imun-dong in 1957.",
    },
    source: SRC.history,
  },
  {
    id: "first-departments",
    category: "hufs",
    question: {
      ko: "한국외대가 개교할 때 처음 설치한 학과 가운데 일본어과가 있었다.",
      en: "Japanese was one of the departments HUFS started with when it opened.",
    },
    answer: false,
    explain: {
      ko: "처음 설치된 학과는 영어과, 불어과, 중국어과, 독일어과, 러시아어과였어요. 이듬해에 서반아어과가 더해졌어요.",
      en: "The first departments were English, French, Chinese, German and Russian. Spanish was added the following year.",
    },
    source: SRC.history,
  },
  {
    id: "first-graduates",
    category: "hufs",
    question: {
      ko: "한국외대의 첫 졸업생은 개교 이듬해인 1955년에 나왔다.",
      en: "HUFS produced its first graduates in 1955, the year after it opened.",
    },
    answer: false,
    explain: {
      ko: "첫 졸업생(133명)은 1958년에 배출됐어요.",
      en: "The first graduating class (133 students) finished in 1958.",
    },
    source: SRC.history,
  },
  {
    id: "university-status-1980",
    category: "hufs",
    question: {
      ko: "한국외대는 1990년에 종합대학교로 승격됐다.",
      en: "HUFS was upgraded from a college to a full university in 1990.",
    },
    answer: false,
    explain: {
      ko: "1980년 10월 2일 문교부에서 종합대학교 승격 인가를 받았어요.",
      en: "It received approval to become a full university on October 2, 1980.",
    },
    source: SRC.history,
  },
  {
    id: "campus-merge-2014",
    category: "hufs",
    question: {
      ko: "서울캠퍼스와 글로벌캠퍼스는 2004년부터 통합 운영되고 있다.",
      en: "The Seoul and Global campuses have been run as one integrated university since 2004.",
    },
    answer: false,
    explain: {
      ko: "교육부의 본·분교 통합 승인을 받아 2014년 3월 1일부터 서울캠퍼스와 글로벌캠퍼스를 통합 운영했어요.",
      en: "After the Ministry of Education approved merging the main and branch campuses, they have been run together since March 1, 2014.",
    },
    source: SRC.history,
  },
  {
    id: "founder-private",
    category: "hufs",
    question: {
      ko: "한국외대는 정부가 세운 국립대학으로 출발했다.",
      en: "HUFS began as a national university established by the government.",
    },
    answer: false,
    explain: {
      ko: "창립자 김흥배 박사가 재산을 희사해 학교법인 동원육영회를 세우고 설립한 사립대학이에요.",
      en: "It is a private university: founder Dr. Kim Heung-bae donated his fortune to set up the Dongwon Educational Foundation, which established the school.",
    },
    source: SRC.history,
  },
  {
    id: "symbol-owl",
    category: "hufs",
    question: {
      ko: "한국외대의 상징은 지혜의 여신 미네르바와 독수리를 조합한 것이다.",
      en: "The HUFS symbol combines Minerva, the goddess of wisdom, with an eagle.",
    },
    answer: false,
    explain: {
      ko: "고대 로마 신화 속 지혜의 여신 미네르바와 부엉이의 조합이에요.",
      en: "It combines Minerva, the Roman goddess of wisdom, with an owl.",
    },
    source: SRC.mascotSymbol,
  },
  {
    id: "core-competencies-six",
    category: "hufs",
    question: {
      ko: "한국외대는 인재상을 구현하기 위한 핵심역량을 4가지로 정해 두었다.",
      en: "HUFS has defined four core competencies for realizing its ideal graduate.",
    },
    answer: false,
    explain: {
      ko: "6대 핵심역량이에요. 자기주도적 학습, 지식·정보·기술활용, 세계 시민, 의사소통, 창의·혁신, 대인관계 역량이에요.",
      en: "There are six: self-directed learning, knowledge and technology use, global citizenship, communication, creativity and innovation, and interpersonal skills.",
    },
    source: SRC.competency,
  },
  {
    id: "ai-college-2024",
    category: "hufs",
    question: {
      ko: "AI융합대학은 2020학년도에 설립됐다.",
      en: "The College of AI Convergence was established in the 2020 academic year.",
    },
    answer: false,
    explain: {
      ko: "2024학년도부터 양 캠퍼스 통합 단과대학으로 AI융합대학을 설립했어요.",
      en: "It was established from the 2024 academic year as a college spanning both campuses.",
    },
    source: SRC.timeline,
  },
  {
    id: "enrollment-campus",
    category: "hufs",
    question: {
      ko: "한국외대 재학생 수는 글로벌캠퍼스가 서울캠퍼스보다 많다.",
      en: "The Global Campus has more enrolled students than the Seoul Campus.",
    },
    answer: false,
    explain: {
      ko: "2025년 4월 1일 기준 재학생은 서울캠퍼스 12,291명, 글로벌캠퍼스 7,357명으로 서울캠퍼스가 더 많아요.",
      en: "As of April 1, 2025, Seoul Campus had 12,291 students and the Global Campus 7,357.",
    },
    source: SRC.facts,
  },
  {
    id: "mascot-boo",
    category: "hufs",
    question: {
      ko: "한국외대 마스코트 캐릭터의 이름은 '부(Boo)'이다.",
      en: "The HUFS mascot character is named 'Boo'.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 알을 깨고 나온 아기 부엉이 '부(Boo)'가 한국외대의 마스코트예요.",
      en: "Correct. 'Boo', a baby owl hatched from an egg, is the HUFS mascot.",
    },
    source: SRC.character,
  },
  {
    id: "president-13th",
    category: "hufs",
    question: {
      ko: "2026년 3월에 한국외대 제13대 총장이 취임했다.",
      en: "The 13th president of HUFS took office in March 2026.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 2026년 3월 1일에 제13대 총장이 취임했어요.",
      en: "Correct. The 13th president took office on March 1, 2026.",
    },
    source: SRC.history,
  },
  {
    id: "emblem-globe-lines",
    category: "hufs",
    question: {
      ko: "한국외대의 현재 교표에는 지구의 위도와 경도선이 들어 있다.",
      en: "The current HUFS emblem includes the lines of latitude and longitude of the globe.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 지구의 위도와 경도선을 넣어 글로벌의 의지를 구체적으로 표현했어요.",
      en: "Correct. The latitude and longitude lines express the university's global ambition.",
    },
    source: SRC.symbol,
  },
  {
    id: "ideal-graduate",
    category: "hufs",
    question: {
      ko: "한국외대의 인재상은 '미래시대를 선도하는 글로벌 창의융합 인재'이다.",
      en: "HUFS describes its ideal graduate as 'a global, creative, convergent talent who leads the future'.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 진리·평화·창조의 창학정신에 바탕을 둔 '미래시대를 선도하는 글로벌 창의융합 인재'가 인재상이에요.",
      en: "Correct. Built on the founding ideals of Truth, Peace and Creation, this is the university's stated ideal graduate.",
    },
    source: SRC.talent,
  },
  {
    id: "foreign-faculty",
    category: "hufs",
    question: {
      ko: "서울캠퍼스의 전임교원 가운데 외국인 교원은 100명이 넘는다.",
      en: "More than 100 of the full-time faculty members at Seoul Campus are international.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 2025년 4월 1일 기준 서울캠퍼스 전임교원 357명 가운데 외국인이 114명이에요.",
      en: "Correct. As of April 1, 2025, 114 of the 357 full-time faculty at Seoul Campus were international.",
    },
    source: SRC.facts,
  },

  // ───────────── 학교생활 추가 (10) ─────────────
  {
    id: "club-aegis",
    category: "life",
    question: {
      ko: "'아이기스'는 한국외대 서울캠퍼스의 응원단이다.",
      en: "'Aegis' is the cheerleading squad of HUFS Seoul Campus.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 아이기스는 '미네르바 여신의 방패'라는 뜻을 내건 서울캠퍼스 응원단이에요.",
      en: "Correct. Aegis, named after 'the shield of the goddess Minerva', is the Seoul Campus cheer squad.",
    },
    source: SRC.clubs,
  },
  {
    id: "club-howl",
    category: "life",
    question: {
      ko: "'하울'은 여러 악기를 연주하는 밴드 동아리다.",
      en: "'Howl' is a band club that plays a range of instruments.",
    },
    answer: false,
    explain: {
      ko: "하울은 악기 없이 노래하는 아카펠라 동아리예요.",
      en: "Howl is an a cappella club that sings without instruments.",
    },
    source: SRC.clubs,
  },
  {
    id: "rotc-two-years",
    category: "life",
    question: {
      ko: "학군사관(ROTC) 후보생은 4년 동안 군사교육을 받는다.",
      en: "ROTC cadets receive four years of military training.",
    },
    answer: false,
    explain: {
      ko: "학군사관은 대학 재학생 가운데 우수자를 선발해 2년간 군사교육을 하는 과정이에요.",
      en: "ROTC selects outstanding students and gives them two years of military training.",
    },
    source: SRC.rotc,
  },
  {
    id: "reserve-transfer-out",
    category: "life",
    question: {
      ko: "휴학하면 대학 직장예비군 전출을 본인이 따로 신청해야 한다.",
      en: "When you take a leave of absence, you must apply separately to be transferred out of the university reserve forces unit.",
    },
    answer: false,
    explain: {
      ko: "휴학·졸업 등으로 인한 예비군 전출은 학적변동과 동시에 자동 처리되어 별도 신청이 없어요.",
      en: "Transfers out for a leave of absence, graduation and the like are handled automatically with the status change. No application is needed.",
    },
    source: SRC.reserve,
  },
  {
    id: "global-hall-selection",
    category: "life",
    question: {
      ko: "글로벌홀 기숙사는 직전 학기 성적이 높은 순서로 입사자를 선발한다.",
      en: "The Global Hall dormitory selects residents in order of their previous semester's grades.",
    },
    answer: false,
    explain: {
      ko: "글로벌홀은 지역 쿼터제로 선발하고, 쿼터별로 경쟁이 생기면 추첨으로 뽑아요.",
      en: "Global Hall uses regional quotas, and when a quota is oversubscribed residents are chosen by lottery.",
    },
    source: SRC.globalHall,
  },
  {
    id: "internship-credit-year",
    category: "life",
    question: {
      ko: "현장실습(인턴십) 학점 인정은 1학년부터 받을 수 있다.",
      en: "First-year students can already receive academic credit for internships.",
    },
    answer: false,
    explain: {
      ko: "현장실습 학점 인정은 3~4학년 대상이에요.",
      en: "Internship credit is available to third- and fourth-year students.",
    },
    source: SRC.internship,
  },
  {
    id: "alumni-mail-signup",
    category: "life",
    question: {
      ko: "졸업생도 HUFS 메일 계정을 새로 만들 수 있다.",
      en: "Graduates can sign up for a new HUFS e-mail account.",
    },
    answer: false,
    explain: {
      ko: "졸업생은 신규 가입이 안 돼요. 재학 중에 만든 메일은 졸업 후 졸업생 신분으로 바뀌어 계속 쓸 수 있어요.",
      en: "Graduates cannot create a new account. An account made while enrolled switches to alumni status after graduation and keeps working.",
    },
    source: SRC.email,
  },
  {
    id: "eduroam-visit",
    category: "life",
    question: {
      ko: "한국외대 구성원은 eduroam에 가입한 다른 대학을 방문하면 그곳의 무선 랜을 무료로 쓸 수 있다.",
      en: "HUFS members can use the Wi-Fi for free when visiting another university that has joined eduroam.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 무선 네트워크 'eduroam'을 고르고 학교 계정으로 인증하면 방문 기관의 무선 랜을 무료로 쓸 수 있어요.",
      en: "Correct. Select the 'eduroam' network and sign in with your HUFS account to use the host institution's Wi-Fi for free.",
    },
    source: SRC.eduroam,
  },
  {
    id: "office365-personal",
    category: "life",
    question: {
      ko: "한국외대 학생은 Office 365를 개인용으로 사용할 수 있다.",
      en: "HUFS students can use Office 365 for personal use.",
    },
    answer: true,
    explain: {
      ko: "맞아요. Office 365는 외대 구성원(교수·학생·직원)이 개인사용 할 수 있는 소프트웨어예요.",
      en: "Correct. Office 365 is available for personal use by HUFS members: faculty, students and staff.",
    },
    source: SRC.software,
  },
  {
    id: "counseling-tests",
    category: "life",
    question: {
      ko: "학생상담센터에서는 성격이나 직업적성과 관련된 심리검사를 받을 수 있다.",
      en: "At the Student Counseling Center, you can take psychological tests on personality and career aptitude.",
    },
    answer: true,
    explain: {
      ko: "맞아요. 학생상담센터는 심리검사(성격, 직업적성 관련) 실시와 해석, 개인·집단 상담 등을 해요.",
      en: "Correct. The center offers psychological testing (personality and career aptitude) with interpretation, plus individual and group counseling.",
    },
    source: SRC.counseling,
  },
];
