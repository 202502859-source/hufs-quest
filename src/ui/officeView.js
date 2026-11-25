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

// "1F" → "1층", "B1" → "지하 1층", "2F · 3F" → "2 · 3층". 영어는 "1F"를 그대로 씁니다.
function floorText(floor, lang) {
  if (lang === "en") return floor;
  const parts = floor.split(" · ").map((f) => (f.startsWith("B") ? `지하 ${f.slice(1).replace(/F$/, "")}` : f.replace(/F$/, "")));
  return parts.length > 1 ? `${parts.join(" · ")}층` : `${parts[0]}층`;
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

// 목록을 "행정 · 센터" / "편의시설" 두 묶음으로 나눕니다. 원래 순서는 그대로, 원래 번호(index)를 함께 돌려줍니다.
export function groupOffices(offices) {
  const groups = { office: [], amenity: [] };
  offices.forEach((office, index) => groups[office.category === "amenity" ? "amenity" : "office"].push({ office, index }));
  return groups;
}
