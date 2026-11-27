/*
 * 첫 화면(시작 위치 SPAWN, 카메라 시작 상태) 기준 계산입니다. 브라우저 코드 없이 숫자만 다뤄 테스트할 수 있습니다
 * (tests/campusGate.test.js · tests/hudLayout.test.js).
 * - 카메라 가로 오프셋: 오른쪽 위 HUD(미니맵 + 펼친 일일 퀘스트 창)가 정문 기둥 · 현수막 · "정문 안내실" 이름표 ·
 *   "정문 & 진입광장" 이름표를 가리면, 가리는 만큼 + 8px만큼 화면을 옮깁니다(안 가리면 0). 11/27 PM 결정: 이종헌.
 * - 방향키(휴대폰 · 터치만): 정중앙 x = 첫 화면에서 사이버관 "시설 안내문" 팻말의 화면 x. 한 번 정하면 고정.
 * 맵 v2 기준입니다(옛 맵 ?map=v1에는 정문이 없어 오프셋 0).
 */
import { BUILDINGS, OPEN_SPACES, SPAWN, WORLD_H, WORLD_W, gateRects } from "../data/campusV2.js";
import { signArtRect, signSpotOf } from "../data/stampRallySpots.js";
import { estimateLabelSize, liftClear, placeBuildingLabel } from "../data/buildingLabels.js";
import { MARGIN, MIN_TOUCH_PX, PANEL_SHADOW, hudButtonRowRect, hudSideLayout, statusRect } from "./hudLayout.js";

export const CAMERA_ZOOM = 3; // 캠퍼스 카메라 배율(CampusScene)
export const CLEAR_GAP = 8; // 첫 화면에서 HUD와 지켜야 할 여유(px)
export const CAMERA_OFFSET_MAX = 120; // 이보다 큰 오프셋이 필요하면 배치를 다시 정합니다(테스트가 확인)
export const PAD_LIFT = 16; // 방향키를 화면 아래 끝(MARGIN)보다 이만큼 위에
export const PAD_SIGN_ID = "cyber"; // 방향키 가로 자리를 맞출 팻말(사이버관 시설 안내문 팻말)

const mapAspect = WORLD_H / WORLD_W;
const box = (r) => ({ x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 });

// 정문 그림 · 정문 근처 이름표(월드 px, 사각형 { name, x, y, w, h })
export function gateThings() {
  const gate = gateRects();
  const gateBoxes = gate.map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }));
  const things = gate.map((r, i) => ({ name: ["정문 서쪽 기둥", "정문 동쪽 기둥", "현수막"][i], ...r }));
  // "정문 안내실" 이름표: CampusScene.layoutNameTag와 같은 규칙(지붕 안 자리 → 정문 그림에 가리면 위로), 한/영 중 큰 쪽
  const gatehouse = BUILDINGS.find((b) => b.id === "gatehouse");
  for (const lang of ["ko", "en"]) {
    const name = (lang === "en" ? gatehouse.nameEn : gatehouse.name) ?? gatehouse.name;
    const two = lang === "en" ? name : gatehouse.mapName ?? name;
    const measure = (scale, lines) => estimateLabelSize(lines === 2 ? two : name, scale, lines);
    const spot = placeBuildingLabel(gatehouse, measure, gateBoxes);
    const { w, h } = measure(spot.scale, spot.lines);
    const y = liftClear(spot.x, spot.y, w, h, gateBoxes);
    things.push({ name: `정문 안내실 이름표(${lang})`, x: spot.x - w / 2, y: y - h / 2, w, h });
  }
  const plaza = OPEN_SPACES.find((s) => s.id === "gate");
  const p = estimateLabelSize(plaza.name, 1, 1);
  things.push({ name: "정문 & 진입광장 이름표", x: plaza.tag.x - p.w / 2, y: plaza.tag.y - p.h / 2, w: p.w, h: p.h });
  return things;
}

// 사이버관 "시설 안내문" 팻말 자리와 그림 칸(월드 px). 11/27 오후: 안내원 NPC 대신 팻말 기준.
export function signThings() {
  const s = signSpotOf(BUILDINGS.find((b) => b.id === PAD_SIGN_ID));
  return { spot: s, art: { name: "사이버관 팻말", ...box(signArtRect(s)) } };
}

// 첫 화면 카메라가 보는 월드 범위. offset: 화면 px(+면 화면 속 물체가 왼쪽으로 옮겨짐)
export function firstCamera({ W, H, offset = 0 }) {
  const w = W / CAMERA_ZOOM;
  const h = H / CAMERA_ZOOM;
  return {
    x: Math.min(Math.max(SPAWN.x + offset / CAMERA_ZOOM - w / 2, 0), WORLD_W - w),
    y: Math.min(Math.max(SPAWN.y - h / 2, 0), WORLD_H - h),
    w,
    h,
  };
}
export const toScreen = (r, cam) => ({ ...r, x: (r.x - cam.x) * CAMERA_ZOOM, y: (r.y - cam.y) * CAMERA_ZOOM, w: r.w * CAMERA_ZOOM, h: r.h * CAMERA_ZOOM });
// 두 사각형 사이 거리(겹치면 0 이하)
export const rectGap = (a, b) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));

// 오른쪽 위 HUD 사각형(그림자 포함). 펼친 창은 학생 · 게스트 중 큰 쪽(게스트가 한 줄 더 김).
export function sideHudRects({ W, H, touch, displayScale, collapsed = false, guest = true, tabWidth = 140 }) {
  const L = hudSideLayout({ W, H, touch, guest, collapsed, displayScale, mapAspect, tabWidth });
  return [
    { name: "미니맵", x: L.minimap.x, y: L.minimap.y, w: L.minimap.panelW + PANEL_SHADOW, h: L.minimap.panelH + PANEL_SHADOW },
    { name: collapsed ? "일일 퀘스트 탭(접힘)" : "일일 퀘스트 창(펼침)", x: L.daily.x, y: L.daily.y, w: L.daily.w + PANEL_SHADOW, h: L.daily.h + PANEL_SHADOW },
  ];
}

/*
 * 카메라 가로 오프셋(화면 px). 펼친 창(게스트, 가장 큰 경우)과 미니맵이 정문 그림 · 이름표와 세로로 겹치는 높이에 있으면
 * 정문 쪽 물체의 오른쪽 끝 + 8px이 HUD 왼쪽 끝 안에 들어오도록 필요한 만큼만 옮깁니다. 안 가리면 0. 정수로 올림.
 */
export function cameraOffsetX({ W, H, touch, displayScale = 1 }) {
  const cam = firstCamera({ W, H });
  const huds = sideHudRects({ W, H, touch, displayScale });
  let need = 0;
  for (const t of gateThings().map((r) => toScreen(r, cam))) {
    for (const h of huds) {
      const verticalGap = Math.max(h.y - (t.y + t.h), t.y - (h.y + h.h));
      if (verticalGap >= CLEAR_GAP || t.x >= h.x + h.w + CLEAR_GAP) continue; // 세로로 떨어져 있거나 HUD 오른쪽(없음)
      need = Math.max(need, t.x + t.w + CLEAR_GAP - h.x);
    }
  }
  return Math.ceil(Math.max(0, need));
}

// 게임 화면에서 터치 버튼이 실제 화면 최소 크기가 되도록 키운 크기(HudScene.touchSize와 같은 식)
export const touchSize = (minimum, displayScale = 1) => Math.ceil(Math.max(minimum, MIN_TOUCH_PX / (displayScale || 1)));

/*
 * 방향키 자리(터치만, PC는 null). 정중앙 x = 첫 화면에서 사이버관 팻말의 화면 x(카메라 오프셋 포함), 화면 밖이면 MARGIN 안쪽으로.
 * 그 자리가 정문 그림을 가리면 가리는 만큼 + 8px 왼쪽으로(shift). 세로는 아래 끝에서 MARGIN + PAD_LIFT 위. 누르는 범위(zone)는 패드 가운데 기준 reach(= 큰 칸 × 3) 정사각형에서
 * 첫 화면의 사이버관 팻말, 정문 그림, 버튼 줄, 일일 퀘스트 창, 상태창과 8px 안 겹치게 잘라 냅니다.
 */
export function padLayout({ W, H, touch, displayScale = 1, offset = cameraOffsetX({ W, H, touch, displayScale }) }) {
  if (!touch) return null;
  const fullCell = touchSize(56, displayScale);
  const cell = Math.ceil(fullCell / 2);
  const size = cell * 3;
  const cam = firstCamera({ W, H, offset });
  const sign = signThings();
  const signX = (sign.spot.x - cam.x) * CAMERA_ZOOM;
  const top = H - MARGIN - size - PAD_LIFT;
  let left = Math.min(Math.max(signX - size / 2, MARGIN), W - MARGIN - size);
  // 팻말 x에 맞춘 방향키가 첫 화면의 정문 그림(기둥 · 현수막)을 가리면, 가리는 만큼 + 8px만 왼쪽으로 비킵니다(안 가리면 0).
  let shift = 0;
  for (const g of gateRects().map((r) => toScreen(r, cam))) {
    const p = { x: left, y: top, w: size, h: size };
    if (rectGap(p, g) < CLEAR_GAP && g.x + g.w / 2 > p.x + p.w / 2) shift = Math.max(shift, p.x + p.w + CLEAR_GAP - g.x);
  }
  left = Math.max(MARGIN, left - shift);
  const pad = { x: left, y: top, w: size, h: size };
  const center = { x: left + size / 2, y: top + size / 2 };
  const reach = fullCell * 3;
  const zone = { x0: Math.max(0, center.x - reach / 2), x1: Math.min(W, center.x + reach / 2), y0: Math.max(0, H - reach), y1: H };
  const obstacles = [
    toScreen(sign.art, cam),
    ...gateRects().map((r) => toScreen(r, cam)),
    hudButtonRowRect({ W, H, touch }),
    ...sideHudRects({ W, H, touch, displayScale }),
    statusRect(false),
  ];
  for (const o of obstacles) {
    // 지금 누르는 범위와 8px 안으로 붙는 것만 피합니다(멀리 있는 HUD는 상관없음).
    const near = o.x < zone.x1 + CLEAR_GAP && zone.x0 - CLEAR_GAP < o.x + o.w && o.y < zone.y1 + CLEAR_GAP && zone.y0 - CLEAR_GAP < o.y + o.h;
    if (!near) continue;
    if (o.x >= pad.x + pad.w) zone.x1 = Math.min(zone.x1, o.x - CLEAR_GAP);
    else if (o.x + o.w <= pad.x) zone.x0 = Math.max(zone.x0, o.x + o.w + CLEAR_GAP);
    else if (o.y + o.h <= pad.y) zone.y0 = Math.max(zone.y0, o.y + o.h + CLEAR_GAP);
  }
  return { cell, fullCell, pad, center, signX, shift, zone: { x: zone.x0, y: zone.y0, w: zone.x1 - zone.x0, h: zone.y1 - zone.y0 } };
}
