/*
 * 건물 입구 [주요 기능 알아보기] 창에서 쓰는 순수 함수입니다(화면 · CSS 없이 테스트할 수 있게 따로 둠).
 * 데이터는 src/data/buildingInfo.js의 BUILDING_INFO[id].offices를 그대로 씁니다.
 */
import { BUILDING_INFO, isChecked } from "../data/buildingInfo.js";

// 입구에서 이 거리(월드 px) 안이면 문구를 띄웁니다. 수강 설계 버튼(PLANNER_RANGE 6타일)보다 조금 좁게 시작합니다.
export const OFFICE_RANGE = 4 * 16;

// 사무실 · 시설 안내가 있는 건물인지(공식 페이지와 대조한 건물만). 없거나 확인 전이면 문구를 띄우지 않습니다.
export const hasOfficeInfo = (placeId) => {
  const info = BUILDING_INFO[placeId];
  return Boolean(info && isChecked(info));
};

// 여러 건물이 가까우면 가장 가까운 입구 하나만 돌려줍니다. places: [{ id, door: {x, y} }]
export function nearestOfficePlace(places, x, y, range = OFFICE_RANGE, hasInfo = hasOfficeInfo) {
  let best = null;
  let bestDistance = range;
  for (const place of places) {
    if (!place.door || !hasInfo(place.id)) continue;
    const distance = Math.hypot(place.door.x - x, place.door.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = place;
    }
  }
  return best;
}

// floor 칸 한 층("6F" · "LF" · "B1F" · 예전 표기 "B1")을 { kind, n }으로 읽습니다. 읽지 못하면 null.
// kind: "up"(지상) · "lobby"(로비층) · "basement"(지하)
export function parseFloor(token) {
  const text = String(token).trim();
  let m = /^(\d+)F$/.exec(text);
  if (m) return { kind: "up", n: Number(m[1]) };
  if (text === "LF") return { kind: "lobby", n: 0 };
  m = /^B(\d+)F?$/.exec(text);
  if (m) return { kind: "basement", n: Number(m[1]) };
  return null;
}

// "1F · 2F · 3F"처럼 여러 층이면 각 층을 모두 돌려줍니다. null이면 빈 배열(= "층 안내 없음").
export const floorsOf = (office) => (office.floor ? office.floor.split(" · ").map(parseFloor).filter(Boolean) : []);

// 정렬 순서: 높은 층 → 1F → 로비층(LF) → 지하 1층 → 지하 2층 …
const floorRank = (f) => (f.kind === "up" ? 1000 + f.n : f.kind === "lobby" ? 500 : 500 - f.n);
const floorKey = (f) => `${f.kind}:${f.n}`;

// 위치 한 줄에 쓰는 층 이름. 한국어 "6층" · "로비층" · "지하 1층", 영어 "6F" · "Lobby" · "B1"
export function floorLabel(f, lang) {
  if (f.kind === "lobby") return lang === "en" ? "Lobby" : "로비층";
  if (f.kind === "basement") return lang === "en" ? `B${f.n}` : `지하 ${f.n}층`;
  return lang === "en" ? `${f.n}F` : `${f.n}층`;
}

function floorText(floor, lang) {
  const floors = floorsOf({ floor });
  return floors.length ? floors.map((f) => floorLabel(f, lang)).join(" · ") : floor;
}

// 목록 · 상세의 위치 한 줄. 층 · 호수가 모두 없으면 null(화면에 "위치 안내 없음").
export function locationText(office, lang) {
  const floor = office.floor ? floorText(office.floor, lang) : null;
  const room = office.room ? (lang === "en" ? `Room ${office.room.replace(/호$/, "")}` : office.room) : null;
  if (!floor && !room) return null;
  return lang === "en" ? [floor, room].filter(Boolean).join(", ") : [floor, room].filter(Boolean).join(" ");
}

// 전화번호 칸은 근거에 적힌 그대로("02-2173-2152~4", "02-2173-2133, 2134") 보여 주고, 링크는 첫 번호로 겁니다.
export function firstTel(phone) {
  const match = /^(0\d{1,2})-(\d{3,4})-(\d{4})/.exec(phone);
  return match ? `tel:${match[1]}${match[2]}${match[3]}` : null;
}

// 영어 화면에서 영어 이름이 없으면(null) 한국어 이름을 보여 줍니다.
export const officeName = (office, lang) => (lang === "en" && office.name.en ? office.name.en : office.name.ko);

// 편의시설(category "amenity")은 이름 뒤에 "(편의시설)"을 붙여 보여 줍니다. 데이터의 name은 바꾸지 않습니다.
// suffix는 화면 언어의 문구(state.js officeAmenitySuffix)를 넘겨받습니다.
export const displayName = (office, lang, suffix) => `${officeName(office, lang)}${office.category === "amenity" ? suffix : ""}`;

// 목록을 층별로 묶습니다. 높은 층부터, 마지막에 "층 안내 없음"(floor null). 여러 층에 걸친 항목은 각 층 묶음에 모두 넣습니다.
// 묶음 안에서는 원래 순서 그대로, 원래 번호(index)를 함께 돌려줍니다. 반환: [{ floor: {kind, n} | null, items: [{ office, index }] }]
export function groupByFloor(offices) {
  const groups = new Map();
  const none = [];
  offices.forEach((office, index) => {
    const floors = floorsOf(office);
    if (!floors.length) {
      none.push({ office, index });
      return;
    }
    floors.forEach((f) => {
      const key = floorKey(f);
      if (!groups.has(key)) groups.set(key, { floor: f, items: [] });
      groups.get(key).items.push({ office, index });
    });
  });
  const sorted = [...groups.values()].sort((a, b) => floorRank(b.floor) - floorRank(a.floor));
  return none.length ? [...sorted, { floor: null, items: none }] : sorted;
}
