/*
 * 건물 소개 안내원(정문 옆 NPC)의 [Enter] 시설 소개 창에서 쓰는 순수 함수입니다(화면 · CSS 없이 테스트할 수 있게 따로 둠).
 * 데이터는 src/data/buildingInfo.js의 BUILDING_INFO[id].offices를 그대로 씁니다.
 */
import { BUILDING_INFO, byRoom, isChecked } from "../data/buildingInfo.js";

// 안내원에서 이 거리(월드 px) 안이면 안내원 머리 위에 문구를 띄웁니다. 예전 입구 기준(OFFICE_RANGE 4타일)과 같게 시작합니다.
export const GUIDE_RANGE = 4 * 16;

// 사무실 · 시설 안내가 있는 건물인지(공식 페이지와 대조한 건물만). 없거나 확인 전이면 안내원을 세우지 않습니다.
export const hasOfficeInfo = (placeId) => {
  const info = BUILDING_INFO[placeId];
  return Boolean(info && isChecked(info));
};

// 여러 안내원이 가까우면 가장 가까운 하나만 돌려줍니다. places: [{ id, guide: {x, y} | null }]
export function nearestOfficePlace(places, x, y, range = GUIDE_RANGE, hasInfo = hasOfficeInfo) {
  let best = null;
  let bestDistance = range;
  for (const place of places) {
    if (!place.guide || !hasInfo(place.id)) continue;
    const distance = Math.hypot(place.guide.x - x, place.guide.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = place;
    }
  }
  return best;
}

// floor 칸 한 층("6F" · "LF" · "B1" · "OUT")을 { kind, n }으로 읽습니다. 읽지 못하면 null.
// kind: "up"(지상) · "lounge"(라운지층, 도서관 LF) · "basement"(지하, B1 · B2) · "out"(건물 밖)
export function parseFloor(token) {
  const text = String(token).trim();
  let m = /^(\d+)F$/.exec(text);
  if (m) return { kind: "up", n: Number(m[1]) };
  m = /^B(\d)$/.exec(text);
  if (m) return { kind: "basement", n: Number(m[1]) };
  if (text === "LF") return { kind: "lounge", n: 0 };
  if (text === "OUT") return { kind: "out", n: 0 };
  return null;
}

// "1F · 2F · 3F"처럼 여러 층이면 각 층을 모두 돌려줍니다. null이면 빈 배열(= "층 안내 없음").
export const floorsOf = (office) => (office.floor ? office.floor.split(" · ").map(parseFloor).filter(Boolean) : []);

// 정렬 순서(위에서 아래로): 지하 2층 → 지하 1층 → 라운지층(LF) → 1층 → 2층 → … → 건물 밖
const floorRank = (f) => ({ basement: -f.n, lounge: 0, up: f.n, out: 1000 })[f.kind];
const floorKey = (f) => `${f.kind}:${f.n}`;

// 위치 한 줄 · 묶음 제목에 쓰는 층 이름. 한국어 "6층" · "지하 1층" · "라운지층" · "건물 밖", 영어 "6F" · "B1" · "Lounge" · "Outside"
export function floorLabel(f, lang) {
  if (f.kind === "lounge") return lang === "en" ? "Lounge" : "라운지층";
  if (f.kind === "basement") return lang === "en" ? `B${f.n}` : `지하 ${f.n}층`;
  if (f.kind === "out") return lang === "en" ? "Outside" : "건물 밖";
  return lang === "en" ? `${f.n}F` : `${f.n}층`;
}

function floorText(floor, lang) {
  const floors = floorsOf({ floor });
  return floors.length ? floors.map((f) => floorLabel(f, lang)).join(" · ") : floor;
}

// 호실 표시: 한국어 "312호" · "B1-08호", 영어 "Room 312"
const roomText = (room, lang) => (lang === "en" ? `Room ${room.replace(/호$/, "")}` : room);

// 목록 · 상세의 위치 한 줄. 호실이 있으면 호실만(11/25: 층 생략), 없으면 위치 글(where, 예: 도서관 뒤) 또는 층.
// 모두 없으면 null(화면에 "위치 안내 없음").
export function locationText(office, lang) {
  if (office.room) return roomText(office.room, lang);
  if (office.where) return office.where[lang] ?? office.where.ko;
  return office.floor ? floorText(office.floor, lang) : null;
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

// 목록을 층별로 묶습니다. 맨 위에 건물 전체 안내(office.top, 묶음 제목 없음), 그다음 지하 → 라운지층 → 1층 → … → 건물 밖,
// 마지막에 "층 안내 없음"(floor null). 여러 층에 걸친 항목은 각 층 묶음에 모두 넣습니다.
// 묶음 안에서는 원래 순서 그대로, 원래 번호(index)를 함께 돌려줍니다.
// 반환: [{ top?: true, floor: {kind, n} | null, items: [{ office, index }] }]
export function groupByFloor(offices) {
  const groups = new Map();
  const none = [];
  const top = [];
  offices.forEach((office, index) => {
    if (office.top) {
      top.push({ office, index });
      return;
    }
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
  const sorted = [...groups.values()].sort((a, b) => floorRank(a.floor) - floorRank(b.floor));
  return [...(top.length ? [{ top: true, floor: null, items: top }] : []), ...sorted, ...(none.length ? [{ floor: null, items: none }] : [])];
}

// ── 묶음 항목(children: 동아리방 · 단과대학) ──
// 하위 목록 한 줄 이름: "그림촌(312호)", 영어 "그림촌 (Room 312)"
export const childLabel = (child, lang) => {
  const name = officeName(child, lang);
  if (!child.room) return name;
  return lang === "en" ? `${name} (${roomText(child.room, "en")})` : `${name}(${child.room})`;
};

// 하위 목록(호실 오름차순). 데이터도 이 순서로 넣지만 화면은 한 번 더 정렬합니다.
export const sortedChildren = (office) => [...(office.children ?? [])].sort(byRoom);

/*
 * 안내 창 안의 위치: { group, item }
 * - { group: null, item: null } 층별 목록
 * - { group: null, item: i } offices[i] 상세
 * - { group: g, item: null } offices[g]의 하위 목록(동아리 · 학과)
 * - { group: g, item: j } 하위 목록 j번째 상세
 * "뒤로"는 한 단계씩, ESC는 창 전체를 닫습니다(hudOverlay.js).
 */
export const ROOT_VIEW = { group: null, item: null };
export function resolveView(offices, view) {
  const parent = view.group === null ? null : offices[view.group];
  if (parent) {
    const children = sortedChildren(parent);
    const child = view.item === null ? null : children[view.item];
    return child ? { kind: "detail", office: child, parent, children } : { kind: "group", office: parent, parent, children };
  }
  const office = view.item === null ? null : offices[view.item];
  if (office?.children) return { kind: "group", office, parent: office, children: sortedChildren(office) };
  return office ? { kind: "detail", office, parent: null } : { kind: "list" };
}
// 목록에서 항목을 눌렀을 때: 묶음이면 하위 목록으로, 아니면 상세로
export const openItem = (offices, index) => (offices[index]?.children ? { group: index, item: null } : { group: null, item: index });
export const openChild = (view, index) => ({ group: view.group, item: index });
export const backView = (view) => (view.group !== null && view.item !== null ? { group: view.group, item: null } : ROOT_VIEW);

// 위쪽 한 줄 위치: "국제학사 및 학생회관 › 3층 › 동아리방"(하위 상세는 끝에 동아리 · 학과 이름)
export function crumbs(buildingName, offices, view, lang) {
  const resolved = resolveView(offices, view);
  if (resolved.kind === "list") return buildingName;
  const parts = [buildingName];
  const base = resolved.parent ?? resolved.office;
  const floors = floorsOf(base);
  if (floors.length === 1) parts.push(floorLabel(floors[0], lang));
  if (resolved.parent) parts.push(officeName(resolved.parent, lang));
  if (resolved.kind === "detail" && resolved.parent) parts.push(officeName(resolved.office, lang));
  return parts.join(" › ");
}
