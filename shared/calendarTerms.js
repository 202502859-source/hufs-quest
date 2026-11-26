// 학사일정 바로 찾기(C03)에 쓰는 동의어 표입니다. 검색창 질문의 말을 shared/academicCalendar.js 일정 이름과 맞춥니다.
// 위에서부터 차례로 보고 처음 맞는 항목 하나만 씁니다(더 구체적인 항목을 위에 둠: "수강신청 변경"이 "수강신청"보다 먼저).
//  - ask: 질문에서 찾는 말(한국어 · 영어)
//  - item: 그 항목으로 볼 일정 이름(원문 일정 이름 그대로 비교)
//  - exclude: 질문에 그 말이 없을 때 빼는 일정 이름(예: "개강"을 물으면 "계절학기 개강"은 빼기)
// 이 표에 없는 말은 바로 찾기를 하지 않고 지금처럼 검색합니다. 표를 바꾸면 tests/calendarRoute.test.js를 같이 고칩니다.
export const CALENDAR_TOPICS = [
  { key: "preRegistration", ask: /사전\s*수강\s*신청|예비\s*수강\s*신청|pre-?registration/i, item: /사전수강신청/ },
  { key: "registrationChange", ask: /수강\s*(?:신청\s*)?(?:변경|정정)|add\s*\/?\s*drop/i, item: /^수강신청\s*변경/ },
  { key: "registrationCancel", ask: /수강\s*(?:신청\s*)?(?:취소|철회)|course\s*withdrawal|withdraw\s+from\s+(?:a\s+)?course/i, item: /^수강신청\s*취소/ },
  { key: "registration", ask: /수강\s*신청|course\s*registration|register\s+for\s+(?:courses|classes)/i, item: /^수강신청(?:\s*\(|$)/ },
  { key: "midterm", ask: /중간\s*(?:고사|시험|평가)|midterm/i, item: /중간시험/ },
  { key: "final", ask: /기말\s*(?:고사|시험|평가)|final\s*exams?/i, item: /기말시험/ },
  { key: "makeup", ask: /보강\s*(?:주간|기간)|make-?up\s*(?:week|classes)/i, item: /보강주간/ },
  { key: "leaveReturn", ask: /휴\s*[·.,ㆍ․]?\s*복학|휴학\s*신청|복학\s*신청|leave\s+of\s+absence|return\s+to\s+school/i, item: /휴\s*[·.,ㆍ․]?\s*복학/ },
  { key: "gradeCheck", ask: /성적\s*(?:열람|정정|확인|이의)|grade\s*(?:check|correction|appeal)/i, item: /성적\s*열람/ },
  { key: "commencement", ask: /학위\s*수여식|졸업식|commencement|graduation\s*ceremony/i, item: /학위수여식/ },
  { key: "seasonal", ask: /계절\s*학기|summer\s*session|winter\s*session/i, item: /계절학기/ },
  { key: "semesterStart", ask: /개강|학기\s*시작|classes\s*(?:begin|start)|semester\s*(?:begin|start)/i, item: /개강/, exclude: /계절학기/ },
  { key: "semesterEnd", ask: /종강|classes\s*end|semester\s*end/i, item: /종강/, exclude: /계절학기/ },
];

// 날짜를 묻는 말. "기간에"(장소 · 때를 나타내는 말)처럼 날짜를 묻지 않는 쓰임은 넣지 않습니다.
export const DATE_QUESTION =
  /언제|며칠|몇\s*일|날짜|일정|기간\s*(?:은|이|을|도|좀|알려|이야|이에요|인가|\?|$)|마감|(?:개강|종강|시작|마감|신청)일|시작(?:해|하|돼|되|은|이)|끝나|\bwhen\b|\bwhat\s+date|\bdates?\b|\bdeadline|\bperiod\b|\bschedule/i;
