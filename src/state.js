// 게임 상태입니다. 재학생의 레벨·경험치·포인트·완료 퀘스트는 서버 응답(progress)으로만 바뀝니다(applyProgress).
// 서버와 주고받는 것은 src/data/progressApi.js가 맡고, 게스트는 지금처럼 메모리에서만 동작합니다.
import { REWARD_QUESTS } from "../shared/progressRules.js";
import { SHOW_OUT_OF_SCOPE } from "./data/features.js";

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

// 재학생 값은 처음 불러올 때(getProgress) 서버 값으로 덮어씁니다. 새 계정은 Lv.1 · 경험치 0 · 포인트 0입니다.
export const session = {
  mode: "guest", // "student" 또는 "guest"
  level: 1,
  exp: 0,
  expMax: 100,
  points: 0,
  completed: new Set(),
  quiz: null, // 서버의 퀴즈 기록(progress.quiz) 복사본. 다음 문제를 고를 때만 읽습니다.
  trackedQuest: null, // 목적지를 안내 중인 퀘스트 (저장 안 함)
  pendingReward: null, // 캠퍼스 화면에서 알릴 보상 (저장 안 함)
};

// 서버 응답의 progress로 session을 덮어씁니다. 화면에서 경험치·포인트를 따로 더하거나 빼지 않습니다.
export function applyProgress(progress) {
  session.level = progress.level;
  session.exp = progress.exp;
  session.expMax = progress.expMax;
  session.points = progress.points;
  // 서버가 모르는 범위 밖 퀘스트(mockReg)의 완료 표시는 화면에 남겨 둡니다.
  const localOnly = [...session.completed].filter((id) => !REWARD_QUESTS.includes(id));
  session.completed = new Set([...progress.completedQuests, ...localOnly]);
  session.quiz = { ...progress.quiz, rewarded: [...progress.quiz.rewarded], answered: [...progress.quiz.answered] };
  if (session.completed.has(session.trackedQuest)) session.trackedQuest = null;
}

// 캠퍼스 화면(HUD)에서 알릴 보상을 쌓아 둡니다. label을 주면 그 문구로 알립니다(예: "checkInReward").
export function notifyReward({ exp = 0, points = 0 }, label = null) {
  const pending = session.pendingReward ?? { exp: 0, points: 0, label: null };
  session.pendingReward = { exp: pending.exp + exp, points: pending.points + points, label: label ?? pending.label };
}

// 로그아웃하면 처음 상태(게스트, Lv.1 · 0)로 되돌립니다.
export function resetSession() {
  Object.assign(session, {
    mode: "guest",
    level: 1,
    exp: 0,
    expMax: 100,
    points: 0,
    completed: new Set(),
    quiz: null,
    trackedQuest: null,
    pendingReward: null,
  });
}

// 미니게임(모의 수강신청, 범위 밖) 보상입니다. 서버에 저장되지 않으므로,
// 재학생은 다음 서버 응답 때 경험치·포인트가 서버 값으로 돌아갑니다.
export function grantReward(exp, points) {
  const leveledUp = gainExp(exp);
  session.points += points;
  notifyReward({ exp, points });
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
  demoNote: { ko: "대회 시연용 프로토타입", en: "Competition prototype" },
  demoNoteMockLogin: { ko: "가짜 로그인(메일을 보내지 않음)", en: "Mock login (no email is sent)" },
  // 학교 이메일 로그인 창
  loginTitle: { ko: "재학생 로그인", en: "Student Login" },
  loginIntro: { ko: "학교 이메일로 받은 6자리 인증 코드로 로그인해요.", en: "Log in with a 6-digit code sent to your school email." },
  loginIdLabel: { ko: "학교 메일 아이디", en: "School email ID" },
  loginIdPlaceholder: { ko: "예: hufsquest25", en: "e.g. hufsquest25" },
  loginDomainLabel: { ko: "학교 메일 주소", en: "School email domain" },
  loginIdRule: { ko: "영문과 숫자만 쓸 수 있어요", en: "Only letters and numbers" },
  loginForeignDomain: { ko: "학교 메일({domains})만 사용할 수 있어요", en: "Only school email ({domains}) can be used" },
  loginSend: { ko: "인증 코드 받기", en: "Get code" },
  // 개인정보 안내(docs/OPERATIONS.md 8장). 문구를 바꾸면 OPERATIONS 8장과 같이 고칩니다.
  loginPrivacyTitle: { ko: "개인정보 안내", en: "Privacy notice" },
  loginPrivacyCollect: {
    ko: "모으는 것: 학교 이메일 주소, 게임 진행 기록(경험치·포인트·퀴즈·퀘스트)",
    en: "What we collect: your school email and game progress (EXP, points, quizzes, quests)",
  },
  loginPrivacyPurpose: { ko: "목적: 로그인과 진행 저장", en: "Why: to log you in and save your progress" },
  loginPrivacyRetention: { ko: "보관 기간: 대회가 끝난 뒤 2026-12-31까지 모두 삭제", en: "How long: all deleted by Dec 31, 2026, after the contest" },
  loginPrivacyNoQuestions: { ko: "검색창에 입력한 질문 내용은 저장하지 않아요.", en: "Questions you type in the search bar are not stored." },
  loginPrivacyAgree: { ko: "위 내용을 확인했고 동의해요", en: "I have read and agree to the above" },
  loginSending: { ko: "보내는 중…", en: "Sending…" },
  loginCodeTitle: { ko: "인증 코드 입력", en: "Enter Code" },
  loginCodeIntro: { ko: "학교 메일로 보낸 6자리 인증 코드를 입력해 주세요.", en: "Enter the 6-digit code we sent to your school email." },
  loginCodeNote: { ko: "메일이 안 보이면 스팸함도 확인해 주세요.", en: "Can't find it? Check your spam folder." },
  loginCodeLabel: { ko: "인증 코드 6자리", en: "6-digit code" },
  loginVerifying: { ko: "확인하는 중…", en: "Checking…" },
  loginResend: { ko: "코드 다시 받기", en: "Resend code" },
  loginResendIn: { ko: "코드 다시 받기 ({s}초)", en: "Resend code ({s}s)" },
  loginResent: { ko: "새 인증 코드를 보냈어요.", en: "We sent a new code." },
  loginBack: { ko: "아이디 다시 입력", en: "Change email ID" },
  loginClose: { ko: "닫기 (Esc)", en: "Close (Esc)" },
  loginWrongCode: { ko: "인증 코드가 맞지 않아요.", en: "That code doesn't match." },
  loginExpiredCode: { ko: "인증 코드가 만료됐어요. 다시 받아 주세요.", en: "This code has expired. Please get a new one." },
  loginRateLimited: { ko: "{s}초 뒤에 다시 받을 수 있어요.", en: "You can get a new code in {s}s." },
  loginForbidden: { ko: "학교 메일로만 로그인할 수 있어요.", en: "Only school email addresses can log in." },
  loginNotConfigured: { ko: "로그인 서버가 아직 설정되지 않았어요.", en: "Login isn't set up yet." },
  loginNetwork: { ko: "연결이 불안정해요. 잠시 후 다시 시도해 주세요.", en: "Connection problem. Please try again shortly." },
  loginFailed: { ko: "로그인하지 못했어요. 잠시 후 다시 시도해 주세요.", en: "Couldn't log in. Please try again shortly." },
  loginNoCode: { ko: "인증 코드를 먼저 받아 주세요.", en: "Please get a code first." },
  loginDevCode: { ko: "개발용 인증 코드", en: "Dev code" },
  loginSessionExpired: { ko: "로그인이 만료됐어요. 다시 로그인해 주세요.", en: "Your login expired. Please log in again." },
  logout: { ko: "로그아웃", en: "Log out" },
  points: { ko: "포인트", en: "Points" },
  guestBadge: { ko: "게스트 모드", en: "Guest Mode" },
  guestNote: { ko: "레벨과 포인트는 재학생 전용", en: "Levels and points: students only" },
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
  aiDailyLimit: { ko: "오늘 질문 한도에 도달했어요.", en: "You've reached today's question limit." },
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
  // HUD 버튼(퀘스트 Q · 행사 V · 마감 공지 N)과 행사 · 퀘스트 창
  questTooltip: { ko: "퀘스트", en: "Quests" },
  mapHighlight: { ko: "행사 장소", en: "Event venue" },
  questEmpty: { ko: "진행 중인 퀘스트가 없어요", en: "No active quests" },
  eventTooltip: { ko: "학교 행사", en: "Campus events" },
  eventTitle: { ko: "학교 행사 (오늘~{days}일 안)", en: "Campus Events (next {days} days)" },
  eventColStatus: { ko: "상태", en: "Status" },
  eventColTitle: { ko: "행사 · 내용", en: "Event" },
  eventColHost: { ko: "주최", en: "Host" },
  eventColTime: { ko: "일시", en: "When" },
  eventColPlace: { ko: "장소", en: "Where" },
  eventColSource: { ko: "출처", en: "Source" },
  eventColNote: { ko: "비고", en: "Note" },
  eventStatusOngoing: { ko: "진행 중", en: "Ongoing" },
  eventStatusToday: { ko: "오늘", en: "Today" },
  eventStatusUpcoming: { ko: "예정", en: "Upcoming" },
  eventTarget: { ko: "대상", en: "For" },
  eventSignup: { ko: "신청", en: "Sign-up" },
  eventShowOnMap: { ko: "지도에서 보기", en: "Show on map" },
  eventSourceLink: { ko: "원문 ↗", en: "Source ↗" },
  eventSourceHost: { ko: "주최 측 제공", en: "Provided by host" },
  eventChecked: { ko: "확인 {date}", en: "Checked {date}" },
  eventEmpty: { ko: "등록된 행사가 없어요. 학교 공지에서 확인해 주세요", en: "No events listed. Please check the school notices" },
  eventNoticeLink: { ko: "학교 공지 ↗", en: "School notices ↗" },
  eventFooter: {
    ko: "팀이 원문을 직접 확인해 옮긴 행사예요. 일시 · 장소 · 신청 방법은 원문에서 다시 확인하세요.",
    en: "Events copied by our team after checking the original posts. Please confirm details in the source.",
  },
  eventDemoTag: { ko: "[예시]", en: "[Example]" },
  eventCatFestival: { ko: "축제", en: "Festival" },
  eventCatBriefing: { ko: "설명회", en: "Briefing" },
  eventCatLecture: { ko: "특강", en: "Lecture" },
  eventCatRecruit: { ko: "모집", en: "Recruiting" },
  eventCatOther: { ko: "기타", en: "Other" },
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
  quizCap: { ko: "오늘 퀴즈로 받을 수 있는 경험치({cap})를 다 받았어요.", en: "You've reached today's quiz EXP limit ({cap})." },
  quizSaving: { ko: "저장하는 중…", en: "Saving…" },
  saveFailed: { ko: "저장하지 못했어요. 잠시 후 다시 시도해 주세요.", en: "Couldn't save. Please try again in a moment." },
  checkInReward: { ko: "출석 보상 +{points} 포인트", en: "Daily check-in +{points} points" },
  progressLoading: { ko: "진행 기록을 불러오는 중…", en: "Loading your progress…" },
  progressLoadFailed: { ko: "진행 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", en: "Couldn't load your progress. Please try again in a moment." },
  quizClose: { ko: "닫기 (ESC)", en: "Close (ESC)" },
  quizMapLegend: { ko: "퀴즈 상자", en: "Quiz boxes" },
  mapNote: { ko: "공식 캠퍼스 지도 좌표와 위성 사진을 따라 그린 근사치입니다(북쪽이 위). 건물 모양과 길은 단순화했습니다.", en: "Drawn to approximate the official campus map coordinates and satellite view (north is up). Buildings and roads are simplified." },
  mapNoteV2: { ko: "정문 기준 방향입니다(정문에서 들어가면 위쪽). 북쪽은 나침반을 참고하세요. 공식 캠퍼스 지도 좌표와 위성 사진을 따라 그린 근사치예요.", en: "Oriented from the main gate (entering the gate = up). See the compass for north. Drawn to approximate the official campus map coordinates and satellite view." },
  mapBaseDate: { ko: "{year}년 {month}월 기준 캠퍼스", en: "Campus as of {month}/{year}" },
  mapOfficial: { ko: "공식 캠퍼스 지도 ↗", en: "Official campus map ↗" },
  mapReport: { ko: "실제와 달라요 (신고) ↗", en: "Report a difference ↗" },
};

// 문구 안의 {이름}은 vars 값으로 바꿉니다. 예: t("quizCap", { cap: 50 })
export const t = (key, vars) => {
  const text = STRINGS[key][lang];
  return vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text;
};

// outOfScope: true인 퀘스트는 src/data/features.js의 SHOW_OUT_OF_SCOPE가 false면 목록에서 빠집니다.
// 11/24: '이중전공 요건 알아보기'(doubleMajor) · '다국어 스탬프 랠리'(stampRally)는 화면 목록에서 뺐습니다.
// 서버(shared/progressRules.js REWARD_QUESTS, api/quest-complete.js)와 이미 저장된 완료 기록은 그대로 둡니다.
const ALL_QUESTS = [
  {
    id: "mockReg",
    name: { ko: "모의 수강신청 도전", en: "Mock course registration" },
    studentOnly: true,
    destination: "cyber",
    minigame: true,
    outOfScope: true, // 모의 수강신청: 본선 범위 밖(PRD 3장)
    description: {
      ko: "30초 안에 가상 과목을 담아 보는 미니게임이에요.\n빨리 누를수록 성공 확률이 높아요.",
      en: "A minigame where you add fictional courses within 30 seconds.\nThe faster you click, the better your odds.",
    },
  },
];

// 화면(퀘스트 목록 · 안내 창 · 지도)이 쓰는 퀘스트 목록입니다.
export const QUEST_LIST = SHOW_OUT_OF_SCOPE ? ALL_QUESTS : ALL_QUESTS.filter((q) => !q.outOfScope);

// 진행 중인(아직 완료하지 않은) 퀘스트. 0개면 HUD의 퀘스트 버튼을 숨깁니다. 서버가 보낸 완료 기록 중 목록에 없는 id는 쓰지 않습니다.
export const activeQuests = () => QUEST_LIST.filter((q) => !session.completed.has(q.id));
