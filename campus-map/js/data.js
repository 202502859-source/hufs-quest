/*
 * 게임 콘텐츠 데이터
 * 건물 이름과 좌표: 학교 공식 캠퍼스맵(https://www.hufs.ac.kr/campusMap/hufs/view.do), 2026-11-08 확인
 * 건물 내부의 NPC와 시설 배치는 시연용 가정이며 실제 부서 위치가 아닙니다. 본선 전에 실제 정보로 교체하세요.
 */
const k = (ko, en) => ({ ko, en });

const GEO = { originLat: 37.5995, originLng: 127.0565, mPerLat: 111000, mPerLng: 88000, mPerTile: 4 };
const MAP_W = 108;
const MAP_H = 122;

const BUILDINGS = [
  { id: "main", name: k("본관", "Main Hall"), lat: 37.597522, lng: 127.057841, w: 10, h: 7, roof: 0, kind: "admin", desc: k("학사 안내 NPC는 재학생 모드에서 만날 수 있습니다.", "The academic guide NPC is available in student mode.") },
  { id: "humanities", name: k("인문과학관", "Humanities Hall"), lat: 37.597981, lng: 127.057416, w: 9, h: 6, roof: 1, kind: "classroom", desc: k("건물번호 1번. 강의실과 학과 사무실을 체험합니다.", "Building 1. Explore a classroom and a department office.") },
  { id: "tlc", name: k("교수학습개발원", "Teaching & Learning Center"), lat: 37.598366, lng: 127.057933, w: 7, h: 5, roof: 2, kind: "office", desc: k("건물번호 2번.", "Building 2.") },
  { id: "social", name: k("사회과학관", "Social Sciences Hall"), lat: 37.59611, lng: 127.057683, w: 9, h: 6, roof: 1, kind: "classroom", desc: k("건물번호 3번. 강의실 체험과 졸업요건 퀘스트가 있습니다.", "Building 3. Classroom tour and the graduation quest.") },
  { id: "union", name: k("학생회관·기숙사", "Student Union & Dorm"), lat: 37.596644, lng: 127.05715, w: 7, h: 7, dx: -2, roof: 2, kind: "union", desc: k("건물번호 4번. 포인트 교환소가 있습니다.", "Building 4. Home of the reward shop.") },
  { id: "law", name: k("법학관", "Law Hall"), lat: 37.596743, lng: 127.057437, w: 7, h: 6, dx: 1, roof: 0, kind: "office", desc: k("건물번호 5번.", "Building 5.") },
  { id: "grad", name: k("대학원", "Graduate School"), lat: 37.597551, lng: 127.060125, w: 8, h: 5, roof: 1, kind: "office", desc: k("건물번호 6번.", "Building 6.") },
  { id: "flc", name: k("외국어연수평가원", "Foreign Language Center"), lat: 37.598394, lng: 127.058575, w: 8, h: 5, roof: 2, kind: "office", desc: k("건물번호 7번.", "Building 7.") },
  { id: "intl", name: k("국제관", "International Hall"), lat: 37.597986, lng: 127.059377, w: 9, h: 6, roof: 0, kind: "office", desc: k("건물번호 8번.", "Building 8.") },
  { id: "library", name: k("도서관", "Library"), lat: 37.595882, lng: 127.058708, w: 10, h: 7, roof: 1, kind: "library", desc: k("건물번호 9번. 책장 사이를 둘러볼 수 있습니다.", "Building 9. Walk between the shelves.") },
  { id: "faculty", name: k("교수연구동", "Faculty Research Hall"), lat: 37.595521, lng: 127.058998, w: 8, h: 6, roof: 2, kind: "office", desc: k("건물번호 10번.", "Building 10.") },
  { id: "club", name: k("교수회관", "Faculty Club"), lat: 37.595791, lng: 127.059435, w: 8, h: 5, roof: 0, kind: "office", desc: k("건물번호 11번.", "Building 11.") },
  { id: "press", name: k("출판부", "University Press"), lat: 37.597352, lng: 127.060647, w: 7, h: 5, roof: 2, kind: "office", desc: k("건물번호 12번.", "Building 12.") },
  { id: "obama", name: k("오바마홀", "Obama Hall"), lat: 37.597279, lng: 127.058487, w: 8, h: 6, roof: 1, kind: "hall", desc: k("Minerva Complex에 있는 홀입니다.", "A hall in the Minerva Complex.") },
  { id: "cyber", name: k("사이버관", "Cyber Hall"), lat: 37.596358, lng: 127.059701, w: 9, h: 7, roof: 0, kind: "pc", desc: k("이 게임에서는 모의 수강신청 PC실이 있습니다.", "In this game, it hosts the mock registration lab.") },
  { id: "history", name: k("역사기념관", "History Hall"), lat: 37.597645, lng: 127.058249, w: 7, h: 5, roof: 2, kind: "hall", desc: k("학교의 역사를 소개하는 공간입니다.", "A space introducing the university's history.") },
  { id: "second", name: k("제2교수연구동", "Faculty Research Hall II"), lat: 37.599086, lng: 127.057073, w: 8, h: 5, roof: 1, kind: "office", desc: k("캠퍼스 북쪽 끝에 있습니다.", "At the north end of campus.") },
  { id: "global", name: k("글로벌홀", "Global Hall"), lat: 37.596739, lng: 127.060672, w: 8, h: 6, roof: 0, kind: "hall", desc: k("정문 근처의 홀입니다.", "A hall near the main gate.") },
];

const OPEN_SPACES = [
  { id: "gate", name: k("정문·진입광장", "Main Gate Plaza"), lat: 37.596484, lng: 127.060141, w: 12, h: 8, tile: "plaza" },
  { id: "lawn", name: k("잔디광장", "Lawn Plaza"), lat: 37.596546, lng: 127.058403, w: 16, h: 10, tile: "lawn" },
  { id: "minerva", name: k("Minerva Square", "Minerva Square"), lat: 37.59707, lng: 127.05842, w: 9, h: 4, tile: "plaza" },
  { id: "field", name: k("대운동장", "Main Field"), lat: 37.597185, lng: 127.059658, w: 16, h: 12, tile: "field" },
];

/* 맵 위 좌표 계산. 위도·경도를 미터로 바꾼 뒤 타일로 환산합니다. */
function geoToTile(lat, lng) {
  return {
    x: Math.round(((lng - GEO.originLng) * GEO.mPerLng) / GEO.mPerTile),
    y: Math.round(((GEO.originLat - lat) * GEO.mPerLat) / GEO.mPerTile),
  };
}

const SPRITES = { guide: 0, student: 1, staff: 2, prof: 3, intl: 4, keeper: 5 };

/* 건물 내부 NPC. x, y는 내부 방의 타일 좌표입니다. actions는 ui.js의 NPC 메뉴를 만듭니다. */
const NPCS = {
  academic: { building: "main", x: 8, y: 4, sprite: "staff", studentOnly: true, name: k("학사 안내원", "Academic Guide"), line: k("이중전공, 수강신청, 졸업요건을 물어보세요. 공개된 규정에서 찾은 근거와 함께 답해 드릴게요.", "Ask about double majors, registration or graduation. I'll answer with evidence from public rules."), ai: true, offers: ["dm"] },
  dmAdvisor: { building: "humanities", x: 14, y: 4, sprite: "prof", studentOnly: true, name: k("학과 사무실 조교", "Department Assistant"), line: k("이중전공은 시기를 놓치면 다음 기회까지 기다려야 해요. 규정을 먼저 확인해 두세요.", "Double major timing matters. Check the rules early.") },
  gradAdvisor: { building: "social", x: 5, y: 4, sprite: "prof", studentOnly: true, name: k("졸업요건 상담 조교", "Graduation Assistant"), line: k("입학 연도마다 졸업학점이 달라요. 본인 학번 표를 보는 것이 첫걸음입니다.", "Graduation credits vary by entering year. Start with the table for your class."), offers: ["grad"] },
  regTutor: { building: "cyber", x: 5, y: 4, sprite: "student", name: k("PC실 선배", "Lab Senior"), line: k("수강신청은 연습이 전부죠. 모의 수강신청으로 손을 풀어 볼래요?", "Registration takes practice. Want to warm up with a mock run?"), offers: ["reg"], minigame: true },
  shop: { building: "union", x: 10, y: 4, sprite: "keeper", name: k("교환소 직원", "Shop Keeper"), line: k("모은 포인트를 상품으로 바꿀 수 있어요. 지금은 시연용 상품입니다.", "Trade points for rewards here. These are demo items for now."), shop: true },
  librarian: { building: "library", x: 10, y: 3, sprite: "staff", name: k("도서관 안내원", "Library Guide"), line: k("서울캠퍼스 도서관에 오신 것을 환영합니다. 천천히 둘러보세요.", "Welcome to the Seoul Campus Library. Feel free to look around.") },
  historian: { building: "history", x: 10, y: 4, sprite: "prof", name: k("기념관 해설사", "History Guide"), line: k("학교의 역사를 소개하는 공간입니다. 전시 내용은 본선 전에 실제 자료로 채울 예정이에요.", "This space introduces the university's history. Real exhibits will be added before the finals.") },
  hallGuide: { building: "obama", x: 10, y: 4, sprite: "guide", name: k("홀 안내원", "Hall Guide"), line: k("이곳은 Minerva Complex의 오바마홀입니다.", "This is Obama Hall in the Minerva Complex.") },
};

/* 야외 NPC. x, y는 캠퍼스 맵의 타일 좌표입니다. */
const OUTDOOR_NPCS = {
  campusGuide: { x: 77, y: 84, sprite: "guide", name: k("캠퍼스 안내원", "Campus Guide"), line: k("어서 오세요! 건물 다섯 곳을 둘러보는 캠퍼스 투어부터 시작해 볼까요?", "Welcome! How about starting with a five-building campus tour?"), offers: ["tour"] },
};

/* 다국어 스탬프 랠리: 잔디광장에 서 있는 언어 부스 NPC */
const LANGUAGES = [
  { id: "zh", name: k("중국어", "Chinese"), hello: "你好", say: "nǐ hǎo", dx: -6, dy: -3 },
  { id: "ja", name: k("일본어", "Japanese"), hello: "こんにちは", say: "konnichiwa", dx: -2, dy: -3 },
  { id: "es", name: k("스페인어", "Spanish"), hello: "¡Hola!", say: "ola", dx: 2, dy: -3 },
  { id: "fr", name: k("프랑스어", "French"), hello: "Bonjour", say: "bonjour", dx: 6, dy: -3 },
  { id: "ar", name: k("아랍어", "Arabic"), hello: "مرحبا", say: "marhaba", dx: -3, dy: 3 },
  { id: "ru", name: k("러시아어", "Russian"), hello: "Здравствуйте", say: "zdravstvuyte", dx: 3, dy: 3 },
];

const Q = (q, choices, answer, why) => ({ q, choices, answer, why });

const QUESTS = {
  tour: {
    title: k("캠퍼스 첫걸음", "First Steps on Campus"), reward: 20, public: true,
    summary: k("주요 건물 다섯 곳에 들어가 봅니다.", "Enter five major buildings."),
    steps: [{ type: "visit", buildings: ["main", "library", "cyber", "union", "humanities"], hint: k("표시된 건물에 들어가세요", "Enter the marked buildings") }],
  },
  dm: {
    title: k("이중전공 정복", "Mastering the Double Major"), reward: 30,
    summary: k("학사 안내원에게 퀘스트를 받아 학과 사무실에서 규정을 익히고 퀴즈를 풉니다.", "Learn the rules at the department office, then take the quiz."),
    steps: [
      { type: "talk", npc: "dmAdvisor", hint: k("인문과학관의 학과 사무실 조교를 찾아가세요", "Visit the department assistant in Humanities Hall"),
        cards: ["dm-apply", "dm-select", "dm-limit"] },
      { type: "quiz", npc: "academic", hint: k("본관 학사 안내원에게 돌아가 퀴즈를 푸세요", "Return to the academic guide for the quiz"), questions: [
        Q(k("이중전공은 몇 학년부터 시작하나요?", "From which year does a double major start?"), [k("1학년", "First"), k("2학년", "Second"), k("3학년", "Third")], 1, "dm-apply"),
        Q(k("25학번 이후의 우선 선발 기준은 1학년 과정을 마치고 몇 학점 이상인가요?", "What is the priority credit threshold from the 2025 entering class?"), [k("30학점", "30"), k("32학점", "32"), k("34학점", "34")], 1, "dm-select"),
        Q(k("비사범대학 학생이 사범대학 전공을 이중전공으로 이수할 수 있나요?", "Can non-Education students double major in the College of Education?"), [k("할 수 있다", "Yes"), k("할 수 없다", "No")], 1, "dm-limit"),
      ] },
    ],
  },
  reg: {
    title: k("수강신청 생존 훈련", "Registration Survival Training"), reward: 30,
    summary: k("PC실에서 규정 퀴즈를 풀고 모의 수강신청에 성공합니다.", "Pass the rules quiz and clear the mock registration."),
    steps: [
      { type: "quiz", npc: "regTutor", hint: k("사이버관 PC실 선배에게 퀴즈를 받으세요", "Take the quiz from the lab senior in Cyber Hall"), questions: [
        Q(k("예비수강신청함에는 최대 몇 강좌까지 담을 수 있나요?", "How many courses fit in the pre-registration basket?"), [k("10강좌", "10"), k("15강좌", "15"), k("20강좌", "20")], 1, "reg-basket"),
        Q(k("예비수강신청함에 담기만 하면 수강이 확정되나요?", "Does adding to the basket complete registration?"), [k("확정된다", "Yes"), k("수강신청 기간에 따로 처리해야 한다", "No, you must register during the period")], 1, "reg-basket"),
        Q(k("수강 취소는 몇 학점 미만이 되도록 할 수 없나요? (4학년 제외)", "Cancelling cannot bring you below how many credits? (except fourth years)"), [k("9학점", "9"), k("12학점", "12"), k("15학점", "15")], 1, "reg-change"),
      ] },
      { type: "minigame", npc: "regTutor", hint: k("모의 수강신청에서 목표 과목을 2개 이상 잡으세요", "Get at least 2 target courses in the mock run") },
    ],
  },
  grad: {
    title: k("졸업요건 점검", "Graduation Check"), reward: 30,
    summary: k("입학 연도별 졸업학점과 트랙별 이수학점을 확인합니다.", "Review graduation credits by entering year and track."),
    steps: [
      { type: "quiz", npc: "gradAdvisor", hint: k("사회과학관의 졸업요건 상담 조교에게 퀴즈를 받으세요", "Take the quiz from the assistant in Social Sciences Hall"), questions: [
        Q(k("서울캠퍼스 2025학년도 이후 입학생(사범대 제외)의 이중전공 트랙 졸업학점은?", "Graduation total for Seoul 2025+ entrants on the double major track (excl. Education)?"), [k("126학점", "126"), k("134학점", "134"), k("140학점", "140")], 0, "grad-2025"),
        Q(k("서울캠퍼스 2015~2024학년도 입학생(사범대, AI융합대 제외)의 이중전공 트랙 졸업학점은?", "Graduation total for Seoul 2015–2024 entrants on the double major track (excl. Education, AI Convergence)?"), [k("126학점", "126"), k("134학점", "134"), k("150학점", "150")], 1, "grad-2015"),
        Q(k("서울캠퍼스 2025학년도 이후 입학생(사범대 제외)의 부전공 이수학점은?", "Minor credits for Seoul 2025+ entrants (excl. Education)?"), [k("18학점", "18"), k("21학점", "21"), k("24학점", "24")], 1, "minor-credits"),
      ] },
    ],
  },
};

const SHOP = [
  { id: "coffee", name: k("[시연] 커피 교환권", "[Demo] Coffee voucher"), cost: 50 },
  { id: "print", name: k("[시연] 무료 인쇄권", "[Demo] Free printing"), cost: 80 },
  { id: "goods", name: k("[시연] 캠퍼스 굿즈", "[Demo] Campus goods"), cost: 150 },
];

/* 샘플 행사: 실제 행사가 아니며, 본선에서는 Supabase events 테이블로 대체합니다. startH, endH는 현재 시각 기준(시간)입니다. */
const SAMPLE_EVENTS = [
  { id: "s1", title: k("[샘플] 동아리 체험 부스", "[Sample] Club booths"), place: "lawn", startH: -1, endH: 3, audience: "public" },
  { id: "s2", title: k("[샘플] 이중전공 설명회", "[Sample] Double major info session"), place: "obama", startH: 2, endH: 4, audience: "students" },
  { id: "s3", title: k("[샘플] 공개 강연", "[Sample] Open lecture"), place: "global", startH: 24, endH: 26, audience: "public" },
];

/* 모의 수강신청의 과목은 모두 가상입니다. */
const MOCK_COURSES = [
  { id: "c1", name: k("가상 세계사의 이해", "Intro to Fictional History"), seats: 9, target: true },
  { id: "c2", name: k("가상 언어학 입문", "Fictional Linguistics 101"), seats: 7, target: true },
  { id: "c3", name: k("픽셀 경제학", "Pixel Economics"), seats: 5, target: true },
  { id: "c4", name: k("캠퍼스 데이터 분석", "Campus Data Analysis"), seats: 12, target: false },
  { id: "c5", name: k("상상 속 국제관계", "Imaginary Relations"), seats: 4, target: true },
  { id: "c6", name: k("도트 그래픽 실습", "Pixel Art Lab"), seats: 15, target: false },
];

const UI_TEXT = {
  title: k("캠퍼스 퀘스트", "Campus Quest"),
  subtitle: k("걸어 다니며 만나는 한국외대 서울캠퍼스 학사 정보", "Discover HUFS Seoul Campus academics on foot"),
  student: k("재학생으로 시작", "Start as a student"),
  studentNote: k("AI 학사 NPC, 학사 퀘스트, 포인트 (시연판은 이메일 인증 생략)", "AI NPC, academic quests, points (email check skipped in this demo)"),
  visitor: k("외부인 체험", "Visitor tour"),
  visitorNote: k("캠퍼스 둘러보기, 공개 행사, 스탬프 랠리", "Campus tour, public events, stamp rally"),
  controls: k("이동: 방향키 또는 WASD · 상호작용: E 또는 스페이스", "Move: arrow keys or WASD · Interact: E or Space"),
  disclaimerDemo: k("대회 시연용 프로토타입입니다. 학교 공식 서비스가 아닙니다.", "Competition prototype. Not an official university service."),
  quests: k("퀘스트", "Quests"), events: k("행사", "Events"), map: k("지도", "Map"), stamps: k("스탬프", "Stamps"),
  points: k("포인트", "pts"), today: k("오늘", "Today"), close: k("닫기", "Close"),
  enter: k("입장", "Enter"), exit: k("나가기", "Exit"), talk: k("대화", "Talk"), interact: k("상호작용", "Interact"),
  ask: k("AI에게 질문하기", "Ask the AI"), accept: k("퀘스트 받기", "Accept quest"), startQuiz: k("퀴즈 풀기", "Take the quiz"),
  openShop: k("교환소 열기", "Open shop"), playMini: k("모의 수강신청 시작", "Start mock registration"),
  askPlaceholder: k("예: 이중전공은 언제 신청해요?", "e.g. When do I apply for a double major?"),
  send: k("보내기", "Send"), evidence: k("근거", "Evidence"), openSource: k("원문 보기", "Open source"),
  aiNotice: k("AI 답변은 참고용이며 법적 효력이 없습니다. 정확한 내용은 담당 부서에 확인하세요.", "AI answers are for reference only and carry no legal effect. Confirm with the responsible office."),
  localMode: k("로컬 검색 모드: 규정 문장을 찾아 그대로 보여 줍니다", "Local search mode: shows matching rule text as is"),
  llmMode: k("HyperCLOVA X 연결됨", "HyperCLOVA X connected"),
  noAnswer: k("공개 규정에서 근거를 찾지 못했습니다. 추측해서 답하지 않을게요. 서울 학사종합지원센터(02-2173-2130)에 문의해 주세요.", "I couldn't find evidence in the public rules, so I won't guess. Please contact the Seoul Academic Support Center (02-2173-2130)."),
  suggested: [k("이중전공은 언제 신청해요?", "When do I apply for a double major?"), k("25학번 졸업학점은 몇 학점이에요?", "How many graduation credits for 2025 entrants?"), k("예비수강신청함에 몇 강좌 담을 수 있어요?", "How many courses fit in the pre-registration basket?"), k("후기 이중전공이 뭐예요?", "What is a late double major?")],
  checkIn: k("출석 완료", "Checked in"), streak: k("일 연속", "day streak"),
  capReached: k("오늘 포인트 상한에 도달했습니다", "Daily point limit reached"),
  questDone: k("퀘스트 완료", "Quest complete"), reward: k("보상", "Reward"), correct: k("정답입니다", "Correct"), wrong: k("다시 생각해 보세요", "Try again"),
  next: k("다음", "Next"), noActive: k("진행 중인 퀘스트가 없습니다. NPC에게 말을 걸어 보세요.", "No active quest. Talk to an NPC to get one."),
  whereGiver: k("받는 곳", "Get it from"), done: k("완료", "Done"), active: k("진행 중", "Active"), available: k("받을 수 있음", "Available"), locked: k("재학생 전용", "Students only"),
  live: k("진행 중", "Live"), upcoming: k("예정", "Upcoming"), guide: k("길 안내", "Navigate"), go: k("바로 이동", "Go now"),
  addEvent: k("행사 등록 (운영자 시연)", "Add an event (admin demo)"), eventName: k("행사 이름", "Event name"), add: k("등록", "Add"),
  eventsNote: k("샘플 데이터입니다. 등록하면 맵에 바로 나타나고, 열려 있는 다른 탭에도 즉시 전달됩니다.", "Sample data. New events appear on the map at once and reach other open tabs immediately."),
  searchPlace: k("건물 이름 검색", "Search buildings"), layoutNote: k("건물 위치는 공식 캠퍼스맵 좌표 기준입니다. 도로와 건물 모양, 내부 배치는 시연용입니다.", "Building positions use official campus map coordinates. Roads, shapes and interiors are for demo."),
  demoInterior: k("이 건물 내부 배치와 NPC는 시연용 가정입니다.", "This interior and its NPCs are demo assumptions."),
  emptyInterior: k("내부 콘텐츠를 준비 중입니다.", "Interior content is coming soon."),
  shopTitle: k("포인트 교환소", "Reward Shop"), buy: k("교환", "Redeem"), owned: k("교환 완료", "Redeemed"), notEnough: k("포인트가 부족합니다", "Not enough points"),
  visitorNoPoints: k("외부인 체험 모드에서는 포인트가 쌓이지 않습니다.", "Visitor mode doesn't earn points."),
  miniTitle: k("모의 수강신청", "Mock Registration"), miniHelp: k("★ 표시 과목을 여석이 사라지기 전에 신청하세요. 모든 과목은 가상입니다.", "Register ★ courses before seats run out. All courses are fictional."),
  miniStart: k("시작", "Start"), miniApply: k("신청", "Register"), miniApplied: k("완료", "Done"), miniFull: k("마감", "Full"), seats: k("여석", "Seats"),
  miniResult: k("목표 과목", "Target courses"), miniAgain: k("다시 하기", "Try again"), miniOnce: k("오늘의 보상은 이미 받았습니다", "Today's reward already claimed"),
  stampTitle: k("다국어 스탬프 랠리", "Language Stamp Rally"), stampHelp: k("잔디광장의 언어 부스에서 인사말을 배우세요. 여섯 개를 모으면 보상을 받습니다.", "Learn greetings at the Lawn Plaza booths. Collect all six for a reward."),
  stampLearn: k("인사말 배우기", "Learn the greeting"), stampQuiz: k("이 인사말은 어느 언어일까요?", "Which language is this greeting?"), stampGot: k("스탬프 획득", "Stamp collected"),
  booth: k("언어 부스", "Language Booth"), reset: k("진행 초기화", "Reset progress"), resetConfirm: k("모든 진행 상황을 지울까요? 되돌릴 수 없습니다.", "Erase all progress? This can't be undone."),
  exportTiled: k("Tiled 맵 내보내기", "Export Tiled map"), waypoint: k("목적지", "Destination"), arrived: k("도착했습니다", "You have arrived"),
  loadFailed: k("게임 엔진을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.", "Couldn't load the game engine. Check your connection and reload."),
};
