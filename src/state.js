// 게임 상태입니다. 재학생의 레벨·경험치·포인트·완료 퀘스트는 서버 응답(progress)으로만 바뀝니다(applyProgress).
// 서버와 주고받는 것은 src/data/progressApi.js가 맡고, 게스트는 지금처럼 메모리에서만 동작합니다.
import { DAILY_QUIZ_GOAL, REWARD_QUESTS, expToNextLevel, kstToday } from "../shared/progressRules.js";
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

// 일일 퀘스트(스탬프 랠리 · 일일 퀴즈)의 오늘 상태. 재학생은 서버 응답(progress.daily), 게스트는 메모리(src/dailyQuests.js).
export const emptyDaily = (date = kstToday()) => ({ date, quizCorrect: 0, quizGoal: DAILY_QUIZ_GOAL, quizBonusDone: false, stamps: [], rallyDone: false });

// 재학생 값은 처음 불러올 때(getProgress) 서버 값으로 덮어씁니다. 새 계정은 Lv.1 · 경험치 0 · 포인트 0입니다.
export const session = {
  mode: "guest", // "student" 또는 "guest"
  level: 1,
  exp: 0,
  expMax: expToNextLevel(1), // 레벨 n → n+1에 10·n (shared/progressRules.js)
  points: 0,
  completed: new Set(),
  quiz: null, // 서버의 퀴즈 기록(progress.quiz) 복사본. 다음 문제를 고를 때만 읽습니다.
  daily: emptyDaily(), // 오늘의 일일 퀘스트 상태(한국 날짜가 바뀌면 0으로)
  progressLoaded: false, // 서버 진행 상태를 한 번이라도 받았는지(처음 불러올 때는 레벨 업 알림을 띄우지 않음)
  pendingLevelUp: null, // 캠퍼스 화면에서 알릴 레벨 업(마지막 레벨만, 저장 안 함)
  trackedQuest: null, // 목적지를 안내 중인 퀘스트 (저장 안 함)
  pendingReward: null, // 캠퍼스 화면에서 알릴 보상 (저장 안 함)
};

// 서버 응답의 progress로 session을 덮어씁니다. 화면에서 경험치·포인트를 따로 더하거나 빼지 않습니다.
export function applyProgress(progress) {
  // 이미 불러온 뒤 레벨이 오르면 알림을 한 번 쌓습니다. 여러 레벨이 한 번에 올라도 마지막 레벨만 남습니다.
  if (session.progressLoaded && progress.level > session.level) session.pendingLevelUp = progress.level;
  session.progressLoaded = true;
  session.level = progress.level;
  session.exp = progress.exp;
  session.expMax = progress.expMax;
  session.points = progress.points;
  // 서버가 모르는 범위 밖 퀘스트(mockReg)의 완료 표시는 화면에 남겨 둡니다.
  const localOnly = [...session.completed].filter((id) => !REWARD_QUESTS.includes(id));
  session.completed = new Set([...progress.completedQuests, ...localOnly]);
  session.quiz = { ...progress.quiz, rewarded: [...progress.quiz.rewarded], answered: [...progress.quiz.answered] };
  // 옛 응답(daily 없음)도 오류 없이 0으로 둡니다.
  session.daily = progress.daily ? { ...emptyDaily(progress.daily.date), ...progress.daily, stamps: [...(progress.daily.stamps ?? [])] } : emptyDaily();
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
    expMax: expToNextLevel(1),
    points: 0,
    completed: new Set(),
    quiz: null,
    daily: emptyDaily(),
    trackedQuest: null,
    pendingReward: null,
    progressLoaded: false,
    pendingLevelUp: null,
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

// 경험치를 더하고(게스트 · 메모리), 레벨이 올랐으면 true를 돌려줍니다. 서버와 같은 규칙(레벨 n → n+1에 10·n),
// 필요량에 닿으면 레벨업하고 남은 경험치는 이월, 한 번에 여러 레벨도 오릅니다.
export function gainExp(amount) {
  session.exp += amount;
  let leveledUp = false;
  while (session.exp >= session.expMax) {
    session.exp -= session.expMax;
    session.level += 1;
    session.expMax = expToNextLevel(session.level);
    leveledUp = true;
  }
  if (leveledUp) session.pendingLevelUp = session.level;
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
  aiCollectedAt: { ko: "{date} 수집", en: "collected {date}" },
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
  // 출처 칸 맨 앞 배지(출처 종류, src/ui/eventView.js sourceBadgeKey)
  eventSourceSchool: { ko: "학교 공지", en: "School notice" },
  eventSourceSns: { ko: "학생회·동아리 SNS", en: "Student org SNS" },
  eventSourceHost: { ko: "주최 측 제공", en: "Provided by host" },
  eventReportLink: { ko: "행사 제보하기 ↗", en: "Report an event ↗" },
  // eventReportLink · eventReportNote · eventReportLoginHint: 11/26 게스트 제보 닫음으로 화면에서 사용 안 함(되돌릴 때 씀)
  eventReportNote: { ko: "제보는 팀이 출처를 확인한 뒤 올라가요", en: "Reports are posted after the team checks the source" },
  eventChecked: { ko: "확인 {date}", en: "Checked {date}" },
  eventEmpty: { ko: "등록된 행사가 없어요. 학교 공지에서 확인해 주세요", en: "No events listed. Please check the school notices" },
  eventNoticeLink: { ko: "학교 공지 ↗", en: "School notices ↗" },
  eventFooter: {
    ko: "팀이 원문을 직접 확인해 옮긴 행사예요. 일시 · 장소 · 신청 방법은 원문에서 다시 확인하세요.",
    en: "Events copied by our team after checking the original posts. Please confirm details in the source.",
  },
  // 목록에 학생 제보(crowd)가 있을 때의 안내문(src/ui/eventView.js footerKey)
  eventFooterCrowd: {
    ko: "팀 확인 행사는 원문을 직접 확인해 옮긴 것이고, '미확인' 학생 제보는 아직 팀이 확인하기 전이에요. 일시·장소·신청 방법은 원문이나 주최 측에서 다시 확인하세요.",
    en: "Team-checked events were copied from the original source; 'Unverified' student reports have not been checked by the team yet. Please confirm the time, place and sign-up with the original source or the host.",
  },
  eventDemoTag: { ko: "[예시]", en: "[Example]" },
  eventCatFestival: { ko: "축제", en: "Festival" },
  eventCatBriefing: { ko: "설명회", en: "Briefing" },
  eventCatLecture: { ko: "특강", en: "Lecture" },
  eventCatRecruit: { ko: "모집", en: "Recruiting" },
  eventCatOther: { ko: "기타", en: "Other" },
  // 학생 제보(앱 안 행사 제보, src/data/eventReportApi.js · api/event-report.js)
  eventSourceCrowd: { ko: "학생 제보 {count}명 · 미확인", en: "Student reports: {count} · Unverified" },
  eventSourceCrowdChecked: { ko: "학생 제보 {count}명 · 팀 확인", en: "Student reports: {count} · Team checked" },
  eventCrowdOriginal: { ko: "원문(한국어)", en: "Original text (Korean)" },
  eventReportLoginHint: { ko: "로그인하면 앱에서 바로 제보할 수 있어요", en: "Log in to report right in the app" },
  eventReportLoginButton: { ko: "로그인하고 제보하기 (경험치 제공)", en: "Log in to report (earn EXP)" },
  eventReportOpen: { ko: "제보하고 경험치 쌓기", en: "Report & earn EXP" },
  eventFormTitle: { ko: "행사 제보", en: "Report an event" },
  eventFormBack: { ko: "← 행사 목록", en: "← Event list" },
  eventFormNotice: {
    ko: "전화번호·이메일·카카오 링크는 넣을 수 없어요. 로그인한 학생 {threshold}명이 같은 행사를 제보하면 '미확인' 표시와 함께 올라가요. 팀이 확인하면 공개 전에 제보한 사람 모두 경험치 +20을 받아요.",
    en: "Phone numbers, emails and Kakao links are not allowed. When {threshold} logged-in students report the same event, it is posted with an 'Unverified' label. When the team confirms it, everyone who reported before it was posted gets +20 EXP.",
  },
  eventFormName: { ko: "행사명", en: "Event name" },
  eventFormHost: { ko: "주최 단체", en: "Host group" },
  eventFormHostHint: { ko: "사람 이름 말고 단체명", en: "A group name, not a person's name" },
  eventFormDate: { ko: "날짜", en: "Date" },
  eventFormStart: { ko: "시작 시각", en: "Starts at" },
  eventFormEndDate: { ko: "끝 날짜", en: "End date" },
  eventFormEnd: { ko: "끝 시각", en: "Ends at" },
  eventFormPlace: { ko: "장소", en: "Place" },
  eventFormBuilding: { ko: "건물", en: "Building" },
  eventFormBuildingNone: { ko: "선택 안 함", en: "Not selected" },
  eventFormCategory: { ko: "분류", en: "Category" },
  eventFormSummary: { ko: "한두 줄 소개", en: "Short description (1–2 lines)" },
  eventFormUrl: { ko: "원문 주소", en: "Source link" },
  eventFormRequired: { ko: "(필수)", en: "(required)" },
  eventFormOptional: { ko: "(선택)", en: "(optional)" },
  eventFormSubmit: { ko: "제보 보내기", en: "Send report" },
  eventFormSending: { ko: "보내는 중…", en: "Sending…" },
  eventFormErrRequired: { ko: "꼭 써 주세요", en: "Required" },
  eventFormErrTooLong: { ko: "글자 수가 너무 많아요", en: "Too long" },
  eventFormErrContact: { ko: "연락처·카카오 링크는 넣을 수 없어요", en: "Contact info and Kakao links are not allowed" },
  eventFormErrFormat: { ko: "형식을 확인해 주세요", en: "Please check the format" },
  eventFormErrHttps: { ko: "https://로 시작하는 주소만 넣을 수 있어요", en: "Only https:// links are allowed" },
  eventFormErrStartRange: { ko: "오늘부터 14일 안 행사만 제보할 수 있어요", en: "Only events within the next 14 days can be reported" },
  eventFormErrEndRange: { ko: "끝 시각은 시작 뒤 7일 안이어야 해요", en: "The end must be after the start, within 7 days" },
  eventReportCount: { ko: "접수됐어요. 같은 행사 제보 {count}명 / 기준 {threshold}명", en: "Received. Reports for this event: {count} / {threshold} needed" },
  eventReportReceived: { ko: "접수됐어요.", en: "Received." },
  eventReportPublished: { ko: "기준 인원이 모여 행사창에 올라갔어요!", en: "Enough students reported it. It's now in the event list!" },
  eventReportDuplicate: { ko: "이미 이 행사를 제보했어요.", en: "You already reported this event." },
  eventReportLimit: { ko: "제보는 하루 3건까지 할 수 있어요.", en: "You can send up to 3 reports a day." },
  eventReportLogin: { ko: "로그인이 필요해요. 다시 로그인한 뒤 제보해 주세요.", en: "Please log in again to send a report." },
  eventReportRetry: { ko: "잠시 후 다시 시도해 주세요.", en: "Please try again in a moment." },
  eventReportFix: { ko: "표시한 칸을 고쳐 주세요.", en: "Please fix the marked fields." },
  levelUp: { ko: "레벨 업! Lv.{level}", en: "Level up! Lv.{level}" },
  deadlineTitle: { ko: "마감 임박 공지 (14일 이내)", en: "Upcoming Deadlines (within 14 days)" },
  deadlineAsOf: { ko: "기준", en: "As of" },
  deadlineKst: { ko: "한국 시간", en: "KST" },
  deadlineDevice: { ko: "(기기 시간)", en: "(device time)" },
  deadlineColDday: { ko: "남은 날짜", en: "Due" },
  deadlineColDept: { ko: "관련 부서", en: "Office" },
  deadlineColTitle: { ko: "내용", en: "Notice" },
  deadlineColNote: { ko: "비고", en: "Type" },
  deadlineColLink: { ko: "원문", en: "Source" },
  deadlineLink: { ko: "↗ 원문", en: "↗ Source" },
  deadlineUpcoming: { ko: "접수 예정", en: "Upcoming" },
  deadlineCheckedOn: { ko: "확인", en: "Checked" },
  deadlineEmpty: { ko: "14일 안에 마감되는 공지가 없어요", en: "No notices are due within 14 days" },
  deadlineCategoryEmpty: { ko: "이 분류의 마감 임박 공지가 없어요", en: "No upcoming deadlines in this category" },
  deadlineBoardLink: { ko: "학교 공지 보러 가기 ↗", en: "View HUFS Notices ↗" },
  deadlineGroupThisWeek: { ko: "이번 주 마감", en: "Due This Week" },
  deadlineGroupUpcoming: { ko: "다가오는 공지", en: "Upcoming Notices" },
  deadlineFilterLabel: { ko: "공지 분류 필터", en: "Notice category filter" },
  catAll: { ko: "전체", en: "All" },
  deadlineLoading: { ko: "불러오는 중…", en: "Loading…" },
  deadlineFooter: { ko: "마감일과 세부 요건은 반드시 원문 공지에서 최종 확인하세요.", en: "Always confirm deadlines and eligibility in the original notice." },
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
  // 일일 퀘스트 창(HUD, 미니맵 바로 위) · 스탬프 랠리 부스 · 시설 안내문 팻말 (11/27)
  dailyTitle: { ko: "일일 퀘스트", en: "Daily Quests" },
  dailyRally: { ko: "스탬프 랠리", en: "Stamp Rally" },
  dailyRallyNext: { ko: "다음: {place}", en: "Next: {place}" },
  dailyRallyDone: { ko: "완주! +{exp} EXP", en: "Complete! +{exp} EXP" },
  dailyRallyDoneGuest: { ko: "완주!", en: "Complete!" },
  dailyQuiz: { ko: "일일 퀴즈", en: "Daily Quiz" },
  dailyQuizCount: { ko: "맞춘 정답: {n}/{goal}개", en: "Correct today: {n}/{goal}" },
  dailyQuizDone: { ko: "완료! 보너스 +{exp} EXP", en: "Done! Bonus +{exp} EXP" },
  dailyQuizDoneGuest: { ko: "완료!", en: "Done!" },
  dailyGuestNote: { ko: "게스트는 경험치가 저장되지 않아요", en: "Guests don't keep EXP" },
  dailyQuizBonus: { ko: "일일 퀴즈 완료! 보너스 +{exp} EXP", en: "Daily Quiz done! Bonus +{exp} EXP" },
  rallyDetailIntro: {
    ko: "건물 앞 부스 4곳에서 문제를 맞히면 스탬프를 받아요. 답은 부스 옆 '시설 안내문' 팻말에 있어요. 매일 한국 시간 자정에 새로 시작해요.",
    en: "Answer the question at each of the 4 booths to get a stamp. The answer is on the 'Facility Guide' sign by the booth. Resets daily at midnight (KST).",
  },
  rallyStopDone: { ko: "스탬프 받음", en: "Stamped" },
  rallyStopTodo: { ko: "아직", en: "Not yet" },
  rallyReward: { ko: "4곳 완주 보상: +{exp} EXP, +{points} 포인트 (하루 한 번)", en: "Reward for all 4: +{exp} EXP, +{points} points (once a day)" },
  dailyQuizDetail: {
    ko: "맵의 '?' 퀴즈 상자에서 정답 {goal}개를 맞히면 보너스 +{exp} EXP (하루 한 번)",
    en: "Get {goal} correct answers from '?' quiz boxes for a +{exp} EXP bonus (once a day)",
  },
  boothPrompt: { ko: "스탬프 랠리", en: "Stamp Rally" },
  boothLabel: { ko: "[스탬프 랠리 부스]", en: "[Stamp Rally Booth]" },
  signLabel: { ko: "[시설 안내문]", en: "[Facility Guide]" },
  boothTitle: { ko: "스탬프 랠리 부스", en: "Stamp Rally Booth" },
  boothHint: { ko: "답은 옆 '시설 안내문'에 있어요", en: "The answer is on the 'Facility Guide' sign next to the entrance" },
  boothKeys: { ko: "키보드 1 / 2 / 3 키로도 고를 수 있어요", en: "You can also press the 1, 2 or 3 key" },
  boothWrong: { ko: "시설 안내문에서 다시 찾아보세요", en: "Check the Facility Guide sign and try again" },
  boothAlready: { ko: "오늘 이 부스 스탬프는 이미 받았어요", en: "You already got today's stamp here" },
  boothPreparing: { ko: "이 부스는 준비 중이에요", en: "This booth is coming soon" },
  stampCollected: { ko: "스탬프 획득! ({n}/{total})", en: "Stamp collected! ({n}/{total})" },
  rallyComplete: { ko: "랠리 완주! +{exp} EXP", en: "Rally complete! +{exp} EXP" },
  rallyCompleteGuest: { ko: "랠리 완주!", en: "Rally complete!" },
  saveFailed: { ko: "저장하지 못했어요. 잠시 후 다시 시도해 주세요.", en: "Couldn't save. Please try again in a moment." },
  // 행사 제보 보상 알림(src/data/rewardNotices.js · HudScene). 앞에 "+20 EXP" 칩이 붙습니다.
  eventRewardNotice: { ko: "제보한 행사가 확인되어 경험치가 올랐어요", en: "Your reported event was verified!" },
  mapRewardNotice: { ko: "신고한 지도 정보가 고쳐져서 경험치가 올랐어요", en: "Your map report was fixed!" },
  mapRewardNoticeMany: { ko: "신고한 지도 정보 {count}건이 고쳐져서 경험치가 올랐어요", en: "{count} map reports were fixed!" },
  rewardNoticeMixed: { ko: "제보·신고 {count}건이 반영되어 경험치가 올랐어요", en: "{count} of your reports were accepted!" },
  eventRewardNoticeMany: { ko: "제보한 행사 {count}건이 확인되어 경험치가 올랐어요", en: "{count} reported events were verified!" },
  checkInReward: { ko: "출석 보상 +{points} 포인트", en: "Daily check-in +{points} points" },
  progressLoading: { ko: "진행 기록을 불러오는 중…", en: "Loading your progress…" },
  progressLoadFailed: { ko: "진행 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", en: "Couldn't load your progress. Please try again in a moment." },
  quizClose: { ko: "닫기 (ESC)", en: "Close (ESC)" },
  quizMapLegend: { ko: "퀴즈 상자", en: "Quiz boxes" },
  mapNote: { ko: "공식 캠퍼스 지도 좌표와 위성 사진을 따라 그린 근사치입니다(북쪽이 위). 건물 모양과 길은 단순화했습니다.", en: "Drawn to approximate the official campus map coordinates and satellite view (north is up). Buildings and roads are simplified." },
  mapNoteV2: { ko: "정문 기준 방향입니다(정문에서 들어가면 위쪽). 북쪽은 나침반을 참고하세요. 공식 캠퍼스 지도 좌표와 위성 사진을 따라 그린 근사치예요.", en: "Oriented from the main gate (entering the gate = up). See the compass for north. Drawn to approximate the official campus map coordinates and satellite view." },
  mapBaseDate: { ko: "{year}년 {month}월 기준 캠퍼스", en: "Campus as of {month}/{year}" },
  mapOfficial: { ko: "공식 캠퍼스 지도 ↗", en: "Official campus map ↗" },
  // 11/26 게임 안 신고로 교체: 바깥 링크(↗)가 아니라 게임 안 창(src/ui/mapReportOverlay.js)을 엽니다.
  mapReport: { ko: "실제와 달라요 (신고 시 경험치 제공)", en: "Report a difference (earn EXP)" },
  mapReportTitle: { ko: "지도 정보 신고", en: "Report map info" },
  mapReportFooter: {
    ko: "팀이 원문과 현장을 확인한 뒤 지도를 고쳐요. 신고 내용은 팀만 볼 수 있어요.",
    en: "The team checks the source and the site before fixing the map. Only the team can see reports.",
  },
  mapReportLoginNeeded: { ko: "지도 신고는 학교 메일로 로그인한 학생만 할 수 있어요.", en: "Only students logged in with a school email can report map info." },
  mapFormNotice: {
    ko: "전화번호·이메일·카카오 링크는 넣을 수 없어요. 팀이 확인해 지도를 고치면 경험치 +20을 드려요.",
    en: "Phone numbers, emails and Kakao links are not allowed. If the team fixes the map, you get +20 EXP.",
  },
  mapFormBuilding: { ko: "건물", en: "Building" },
  mapFormKind: { ko: "무엇이 다른지", en: "What is different" },
  mapFormDescription: { ko: "설명", en: "Description" },
  mapFormDescriptionHint: { ko: "예: 1층 안내실이 2층으로 옮겼어요 (200자 이내)", en: "e.g. The info desk moved to the 2nd floor (up to 200 chars)" },
  mapFormUrl: { ko: "근거 주소", en: "Source link" },
  mapFormSubmit: { ko: "신고 보내기", en: "Send report" },
  mapKindLocation: { ko: "위치", en: "Location" },
  mapKindName: { ko: "이름", en: "Name" },
  mapKindHours: { ko: "운영시간", en: "Hours" },
  mapKindPhone: { ko: "전화번호", en: "Phone number" },
  mapKindDoes: { ko: "하는 일", en: "What it does" },
  mapKindOther: { ko: "기타", en: "Other" },
  mapKindPhoneHint: {
    ko: "전화번호가 다르면 이 분류만 고르고, 번호는 쓰지 말아 주세요. 팀이 공식 페이지에서 확인해요.",
    en: "If the phone number is wrong, just pick this category and don't write the number. The team checks the official page.",
  },
  mapFormErrContact: { ko: "전화번호·이메일은 넣을 수 없어요. 전화번호가 다르면 분류만 '전화번호'로 골라 주세요", en: "No phone numbers or emails. If the number is wrong, just pick 'Phone number'" },
  mapReportReceived: { ko: "신고가 접수됐어요. 팀이 확인할게요.", en: "Report received. The team will check it." },
  mapReportLimit: { ko: "신고는 하루 5건까지 할 수 있어요.", en: "You can send up to 5 map reports a day." },
  mapReportLogin: { ko: "로그인이 필요해요. 다시 로그인한 뒤 신고해 주세요.", en: "Please log in again to send a report." },
  // 건물 입구의 [주요 기능 알아보기] 문구와 사무실 · 시설 안내 창(src/ui/officeOverlay.js)
  // 건물 소개 안내원(정문 옆 NPC) 머리 위 문구: "[Enter] 시설 소개" · 터치 화면 "[터치] 시설 소개"
  officePrompt: { ko: "시설 소개", en: "Facility guide" },
  officeKeyHint: { ko: "[Enter]", en: "[Enter]" },
  officeKeyHintTouch: { ko: "[터치]", en: "[Tap]" },
  guideLabel: { ko: "건물 소개 안내원", en: "Building Guide" },
  // 층별 묶음: 층 이름(라운지층 · 1층 · 6층)은 src/ui/officeView.js floorLabel이 만들고, floor가 없을 때만 아래 문구
  officeFloorNone: { ko: "층 안내 없음", en: "Floor not listed" },
  officeAmenitySuffix: { ko: "(편의시설)", en: " (Amenity)" },
  officeNoLocation: { ko: "위치 안내 없음", en: "Location not listed" },
  officeNone: { ko: "안내 없음", en: "Not listed" },
  officeListHint: { ko: "항목을 누르면 위치 · 전화 · 운영시간을 볼 수 있어요.", en: "Select an item to see its location, phone and hours." },
  officeBack: { ko: "← 목록으로", en: "← Back to list" },
  officeLocation: { ko: "위치", en: "Location" },
  officePhone: { ko: "학교 전화", en: "Phone" },
  officePhoneOther: { ko: "전화", en: "Phone" },
  officeHours: { ko: "운영시간", en: "Hours" },
  officeDoes: { ko: "하는 일", en: "What it does" },
  officeDetails: { ko: "주요 기능 · 지원 사업", en: "Services & programs" },
  officeSource: { ko: "출처", en: "Source" },
  officeHoursNote: { ko: "운영시간은 학사일정에 따라 바뀔 수 있어요.", en: "Hours may change with the academic calendar." },
};

// 문구 안의 {이름}은 vars 값으로 바꿉니다. 예: t("quizCap", { cap: 50 })
export const t = (key, vars) => {
  const text = STRINGS[key][lang];
  return vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text;
};

// outOfScope: true인 퀘스트는 src/data/features.js의 SHOW_OUT_OF_SCOPE가 false면 목록에서 빠집니다.
// 11/27 일일 퀘스트(캠퍼스 스탬프 랠리 4곳·일일 퀴즈)로 복원·추가(이종헌)
// daily: true인 퀘스트는 HUD의 일일 퀘스트 창(미니맵 바로 위)에 보이고, 완료 여부는 session.completed가 아니라 session.daily로 봅니다
// (매일 한국 시간 자정에 다시 시작). '이중전공 요건 알아보기'(doubleMajor) · 모의 수강신청(mockReg)은 계속 숨김입니다.
const ALL_QUESTS = [
  {
    id: "stampRally",
    daily: true,
    name: { ko: "캠퍼스 스탬프 랠리", en: "Campus Stamp Rally" },
    description: {
      ko: "건물 앞 스탬프 랠리 부스 4곳에서 문제를 맞히고 스탬프를 모아요.\n답은 부스 옆 '시설 안내문' 팻말에 있어요.",
      en: "Answer the question at 4 stamp rally booths to collect stamps.\nThe answer is on the 'Facility Guide' sign by each booth.",
    },
  },
  {
    id: "dailyQuiz",
    daily: true,
    name: { ko: "일일 퀴즈", en: "Daily Quiz" },
    description: {
      ko: `맵의 '?' 퀴즈 상자에서 하루에 정답 ${DAILY_QUIZ_GOAL}개를 맞혀요.`,
      en: `Get ${DAILY_QUIZ_GOAL} correct answers a day from the '?' quiz boxes on the map.`,
    },
  },
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

// 일일 퀘스트(스탬프 랠리 · 일일 퀴즈). HUD의 일일 퀘스트 창과 상세 창(src/ui/questOverlay.js)이 씁니다.
export const DAILY_QUEST_LIST = QUEST_LIST.filter((q) => q.daily);

// 진행 중인(아직 완료하지 않은) 일반 퀘스트(일일 퀘스트 제외). 서버가 보낸 완료 기록 중 목록에 없는 id는 쓰지 않습니다.
export const activeQuests = () => QUEST_LIST.filter((q) => !q.daily && !session.completed.has(q.id));
