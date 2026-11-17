// 시연용 게임 상태입니다. 실제 서버와 로그인이 없으므로 모든 값은 가짜 데이터입니다.
const listeners = new Set();
let lang = "ko";

export const getLang = () => lang;

export function setLang(next) {
  if (next === lang) return;
  lang = next;
  listeners.forEach((fn) => fn());
}

// 언어가 바뀔 때 호출할 함수를 등록합니다. 돌려받은 함수를 부르면 해제됩니다.
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const session = {
  mode: "guest", // "student" 또는 "guest"
  level: 3,
  exp: 40,
  expMax: 100,
  points: 120,
  completed: new Set(),
  trackedQuest: null, // 목적지를 안내 중인 퀘스트
  pendingReward: null, // 미니게임에서 받아 캠퍼스로 돌아올 때 알릴 보상
};

// 미니게임 보상을 주고, 캠퍼스로 돌아왔을 때 알릴 수 있게 쌓아 둡니다.
export function grantReward(exp, points) {
  const leveledUp = gainExp(exp);
  session.points += points;
  const pending = session.pendingReward ?? { exp: 0, points: 0 };
  session.pendingReward = { exp: pending.exp + exp, points: pending.points + points };
  return leveledUp;
}

export const isGuest = () => session.mode === "guest";

export function trackQuest(id) {
  session.trackedQuest = id;
}

export function completeQuest(id) {
  session.completed.add(id);
  if (session.trackedQuest === id) session.trackedQuest = null;
}

// 경험치를 더하고, 레벨이 올랐으면 true를 돌려줍니다.
export function gainExp(amount) {
  session.exp += amount;
  let leveledUp = false;
  while (session.exp >= session.expMax) {
    session.exp -= session.expMax;
    session.level += 1;
    leveledUp = true;
  }
  return leveledUp;
}

const STRINGS = {
  title: { ko: "HUFS Quest", en: "HUFS Quest" },
  subtitle: { ko: "걸어 다니며 만나는 한국외대 서울캠퍼스 학사 정보", en: "Discover HUFS Seoul Campus academics on foot" },
  studentLogin: { ko: "재학생 로그인", en: "Student Login" },
  guestBrowse: { ko: "게스트로 둘러보기", en: "Browse as Guest" },
  demoNote: { ko: "대회 시연용 프로토타입 · 실제 로그인 없음", en: "Competition prototype · No real login" },
  points: { ko: "포인트", en: "Points" },
  guestBadge: { ko: "게스트 모드", en: "Guest Mode" },
  guestNote: { ko: "레벨과 포인트는 재학생 전용", en: "Levels and points: students only" },
  todayEvent: { ko: "오늘의 행사: 외대 축제 부스 오픈!", en: "Today's event: HUFS festival booths open!" },
  quests: { ko: "퀘스트", en: "Quests" },
  studentOnly: { ko: "재학생 전용", en: "Students only" },
  searchPlaceholder: { ko: "학사 정보를 물어보세요 (예: 이중전공 신청 기간은?)", en: "Ask about academics (e.g. double major application)" },
  searchButton: { ko: "질문", en: "Ask" },
  aiName: { ko: "AI 학사 안내원", en: "AI Academic Guide" },
  aiThinking: { ko: "학교 공개 학사 안내를 찾아보는 중", en: "Searching the university's public academic guides" },
  aiNotFound: {
    ko: "공개된 학사 안내에서 찾지 못했어요. 추측해서 답하지 않을게요.\n담당 부서(학사종합지원센터)에 확인해 주세요.",
    en: "I couldn't find this in the public academic guides, and I won't guess.\nPlease check with the Academic Support Center.",
  },
  aiBusy: { ko: "질문이 너무 많아요. 잠시 후 다시 물어봐 주세요.", en: "Too many questions. Please try again in a moment." },
  aiEvidenceOnly: { ko: "(AI 연결 없이 찾은 공식 안내 원문입니다)", en: "(Official guide text found without the AI)" },
  aiSources: { ko: "출처 (누르면 학교 홈페이지로 이동)", en: "Sources (opens the university website)" },
  aiNotice: { ko: "※ AI 답변은 참고용이며 최종 확인은 학교 공식 안내를 따르세요 · 학번·이름 등 개인정보는 입력하지 마세요", en: "※ AI answers are for reference only; confirm with official notices. · Do not enter personal info." },
  aiClose: { ko: "닫기 (Esc)", en: "Close (Esc)" },
  aiPrevPage: { ko: "◀ 이전", en: "◀ Previous" },
  aiNextPage: { ko: "다음 ▶", en: "Next ▶" },
  questAskHere: { ko: "화면 맨 위 검색창", en: "The search bar at the top" },
  mapButton: { ko: "전체 지도 (M)", en: "Full Map (M)" },
  mapTitle: { ko: "서울캠퍼스 전체 지도", en: "Seoul Campus Map" },
  mapHere: { ko: "현재 위치", en: "You are here" },
  mapNear: { ko: "근처", en: "(nearby)" },
  rotateNotice: { ko: "가로로 돌려주세요", en: "Please rotate your device" },
  destination: { ko: "목적지", en: "Destination" },
  questClose: { ko: "닫기", en: "Close" },
  questStart: { ko: "지금 도전", en: "Start now" },
  questDone: { ko: "완료한 퀘스트입니다", en: "Quest completed" },
  questNote: { ko: "목적지는 시연용 배치이며 실제 담당 부서 위치가 아닙니다.", en: "Destinations are for demo only, not actual office locations." },
  mapClose: { ko: "닫기 (M)", en: "Close (M)" },
  // HUD 버튼은 반드시 두 줄로 보이도록 줄바꿈을 넣습니다.
  plannerButton: { ko: "수강신청\n추천 서비스", en: "Course Registration\nHelper" },
  plannerTitle: { ko: "수강신청 추천 서비스 (시연)", en: "Course Registration Helper (demo)" },
  plannerClose: { ko: "닫기 (ESC)", en: "Close (ESC)" },
  plannerNotice: { ko: "과목·시간·평점은 모두 시연용 가상 데이터입니다.", en: "All courses, times and ratings are fictional demo data." },
  deadlineTooltip: { ko: "마감 임박 공지", en: "Upcoming deadlines" },
  deadlineTitle: { ko: "마감 임박 공지 (7일 이내)", en: "Upcoming Deadlines (within 7 days)" },
  deadlineAsOf: { ko: "기준", en: "As of" },
  deadlineKst: { ko: "한국 시간", en: "KST" },
  deadlineDevice: { ko: "(기기 시간)", en: "(device time)" },
  deadlineColDday: { ko: "남은 날짜", en: "Due" },
  deadlineColDept: { ko: "관련 부서", en: "Office" },
  deadlineColTitle: { ko: "내용", en: "Notice" },
  deadlineColNote: { ko: "비고", en: "Type" },
  deadlineColLink: { ko: "원문", en: "Source" },
  deadlineLink: { ko: "↗ 원문", en: "↗ Source" },
  deadlineEmpty: { ko: "7일 안에 마감되는 공지가 없어요", en: "No notices are due within 7 days" },
  deadlineLoading: { ko: "불러오는 중…", en: "Loading…" },
  deadlineFooter: {
    ko: "마감일은 반드시 원문 공지에서 최종 확인하세요. [예시] 항목은 시연용입니다.",
    en: "Always confirm deadlines in the original notice. [Example] items are for demo only.",
  },
  deadlineClose: { ko: "닫기 (ESC)", en: "Close (ESC)" },
  catAcademic: { ko: "학사정보", en: "Academics" },
  catScholarship: { ko: "장학", en: "Scholarship" },
  catCampus: { ko: "학교생활", en: "Campus Life" },
  catExternal: { ko: "대외활동", en: "External" },
  quizOpenKey: { ko: "Space로 열기", en: "Press Space to open" },
  quizOpenTouch: { ko: "상자를 터치해 열기", en: "Tap the box to open" },
  quizTitle: { ko: "O/X 퀴즈", en: "O/X Quiz" },
  quizKeys: { ko: "키보드 O / X 키로도 고를 수 있어요", en: "You can also press the O or X key" },
  quizCorrect: { ko: "정답이에요!", en: "Correct!" },
  quizWrong: { ko: "아쉬워요, 오답이에요.", en: "Not quite." },
  quizAnswerIs: { ko: "정답: ", en: "Answer: " },
  quizSource: { ko: "출처", en: "Source" },
  quizGuest: { ko: "게스트 모드에서는 경험치가 쌓이지 않아요.", en: "Guest mode doesn't earn EXP." },
  quizAlready: { ko: "이미 경험치를 받은 문제예요.", en: "You already earned EXP for this question." },
  quizCap: { ko: "오늘 퀴즈로 받을 수 있는 경험치(50)를 다 받았어요.", en: "You've reached today's quiz EXP limit (50)." },
  quizClose: { ko: "닫기 (ESC)", en: "Close (ESC)" },
  quizMapLegend: { ko: "퀴즈 상자", en: "Quiz boxes" },
  mapNote: { ko: "조감도를 위에서 본 형태로 옮긴 근사치이며, 길은 단순화했습니다.", en: "An approximation of the aerial map seen from above. Roads are simplified." },
};

export const t = (key) => STRINGS[key][lang];

export const QUEST_LIST = [
  {
    id: "doubleMajor",
    name: { ko: "이중전공 요건 알아보기", en: "Double major requirements" },
    studentOnly: true,
    destination: null, // 어디서든 상단 검색창으로 물어보면 됩니다.
    description: {
      ko: "화면 맨 위 검색창에 이중전공 신청 요건을 물어보세요.\n예: 이중전공 신청 요건이 뭐야?",
      en: "Ask about double major requirements in the search bar at the top.\ne.g. What are the double major requirements?",
    },
  },
  {
    id: "mockReg",
    name: { ko: "모의 수강신청 도전", en: "Mock course registration" },
    studentOnly: true,
    destination: "cyber",
    minigame: true,
    description: {
      ko: "30초 안에 가상 과목을 담아 보는 미니게임이에요.\n빨리 누를수록 성공 확률이 높아요.",
      en: "A minigame where you add fictional courses within 30 seconds.\nThe faster you click, the better your odds.",
    },
  },
  {
    id: "stampRally",
    name: { ko: "다국어 스탬프 랠리", en: "Language stamp rally" },
    studentOnly: false,
    destination: "flc",
    description: {
      ko: "여러 나라 말로 인사를 배우며 스탬프를 모으는 퀘스트예요.\n시연판에서는 아직 준비 중이라 목적지만 안내해요.",
      en: "Collect stamps while learning greetings in many languages.\nStill in progress in this demo, so only the destination is shown.",
    },
  },
];
