/*
 * 캠퍼스 건물·공간 정보입니다. 맵 배치(위치·크기·지붕 색)는 campus.js에, 이름과 안내 내용은 이 파일에 둡니다.
 * 두 파일은 건물 ID(id)로만 연결됩니다. 건물이 바뀌면 이 파일만 고치고, 위치가 바뀔 때만 campus.js를 고칩니다.
 *
 * 항목 설명
 * - name / nameEn: 화면에 쓰는 한국어 · 영어 이름
 * - mapName: 전체 지도에서 줄바꿈해서 보여 줄 이름(없으면 name)
 * - use: 건물 용도 한 줄 { ko, en }. 확인 전에는 null
 * - floors: 층별 사무실 [{ floor: "1F", offices: ["학사종합지원센터"] }]. 확인 전에는 []
 * - source: 내용의 근거 { title, url }. 학교 공식 페이지만 씁니다. 확인 전에는 null
 * - checkedAt: 마지막으로 공식 페이지와 대조한 날짜 "YYYY-MM-DD". 확인 전에는 null
 * - status: "open"(운영 중) · "construction"(공사 중) · "new"(신규)
 *
 * 규칙
 * - use · floors를 채우면 source와 checkedAt도 반드시 같이 채웁니다(근거 없는 내용 금지).
 * - 이름은 2026-11 서울캠퍼스 조감도의 범례를 따랐습니다(이전 campus.js에서 옮김).
 * - 키 · 개인 연락처는 넣지 않습니다(공개 저장소).
 */

// 화면에 보여 줄 맵 기준일입니다. 맵을 다시 현행화하면 이 값을 고칩니다.
export const MAP_BASE_DATE = "2026-11";

// 전체 지도 화면의 링크입니다. 학교 공식 캠퍼스 안내 페이지(서울캠퍼스 탭 선택)입니다.
export const OFFICIAL_MAP_URL = "https://www.hufs.ac.kr/campusMap/hufs/view.do";

// "실제와 달라요" 신고 폼(외부 구글 폼) 응답 주소입니다. 폼에는 건물 이름과 다른 점만 묻고 이메일·이름은 받지 않습니다.
// 비어 있으면 신고 버튼을 숨깁니다. 폼은 scripts/report-form/createReportForm.gs로 만들었습니다(응답 확인: 이종헌).
export const REPORT_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSflRuhX1PZp05LIotk9WIhYKX4pVasef7ZUcH_ZMF7dINSFEA/viewform";

// 폼 1번 문항(어느 건물·공간인가요?)의 미리 채우기 이름입니다. 폼을 새로 만들면 바뀝니다.
export const REPORT_FORM_PLACE_ENTRY = "entry.1318155621";

const empty = { use: null, floors: [], source: null, checkedAt: null, status: "open" };

export const BUILDING_INFO = {
  main: { ...empty, name: "본관", nameEn: "Main Hall" },
  humanities: { ...empty, name: "인문과학관", mapName: "인문 과학관", nameEn: "Humanities Hall" },
  tlc: { ...empty, name: "교수학습개발원", mapName: "교수학습 개발원", nameEn: "Teaching Center" },
  social: { ...empty, name: "사회과학관", nameEn: "Social Sciences Hall" },
  union: { ...empty, name: "학생회관 및 기숙사", nameEn: "Student Union & Dorm" },
  law: { ...empty, name: "법학관", nameEn: "Law Hall" },
  grad: { ...empty, name: "대학원", nameEn: "Graduate School" },
  flc: { ...empty, name: "외국어연수평가원", mapName: "외국어 연수평가원", nameEn: "Language Center" },
  intl: { ...empty, name: "국제관", nameEn: "International Hall" },
  library: { ...empty, name: "도서관", nameEn: "Library" },
  faculty: { ...empty, name: "교수연구동", nameEn: "Faculty Research" },
  club: { ...empty, name: "교수회관", nameEn: "Faculty Club" },
  press: { ...empty, name: "출판부", nameEn: "Univ. Press" },
  gatehouse: { ...empty, name: "정문안내실", mapName: "정문 안내실", nameEn: "Gate Office" },
  history: { ...empty, name: "역사관", nameEn: "History Hall" },
  minerva: { ...empty, name: "Minerva Complex", nameEn: "Minerva Complex" },
  cyber: { ...empty, name: "사이버관", nameEn: "Cyber Hall" },

  // 건물이 아닌 공간(광장·운동장·휴게공간)
  square: { ...empty, name: "Minerva Square", nameEn: "Minerva Square" },
  field: { ...empty, name: "대운동장", nameEn: "Main Field" },
  rest: { ...empty, name: "휴게공간 오디", nameEn: "Odi Lounge" },
};

const UNKNOWN = { ...empty, name: "알 수 없는 건물", nameEn: "Unknown building" };

// 건물 ID로 정보를 찾습니다. 빠진 ID가 있으면 개발 중에 바로 알 수 있게 콘솔에 남깁니다.
export function buildingInfo(id) {
  const info = BUILDING_INFO[id];
  if (!info) {
    console.warn(`[buildingInfo] 정보가 없는 건물 ID: ${id}`);
    return { ...UNKNOWN };
  }
  return info;
}

// 신고 폼 주소를 만듭니다. 근처 장소를 알면 1번 문항에 그 건물 이름을 미리 채웁니다.
// 폼에 보내는 값은 건물 이름 하나뿐입니다(좌표·로그인 정보·이메일은 붙이지 않음).
// 장소를 모르거나 목록에 없는 ID면 미리 채우기 없이 폼 주소만 돌려줍니다. 폼 주소가 비어 있으면 "".
export function reportFormUrl(placeId, { formUrl = REPORT_FORM_URL, entry = REPORT_FORM_PLACE_ENTRY } = {}) {
  if (!formUrl) return "";
  const url = new URL(formUrl);
  const name = placeId ? BUILDING_INFO[placeId]?.name : null;
  if (name && entry) {
    url.searchParams.set("usp", "pp_url");
    url.searchParams.set(entry, name);
  }
  return url.toString();
}

// 공식 페이지와 대조해 용도가 확인된 건물인지 알려 줍니다.
export const isChecked = (info) => Boolean(info.use && info.source?.url && info.checkedAt);
