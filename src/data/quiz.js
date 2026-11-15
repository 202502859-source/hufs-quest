// 맵 곳곳의 '?' 퀴즈 상자에서 나오는 O/X 문제 60개입니다.
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
];
