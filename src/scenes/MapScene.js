import Phaser from "phaser";
import { MAP_BASE_DATE, OFFICIAL_MAP_URL, REPORT_FORM_URL, reportFormUrl } from "../data/buildingInfo.js";
import { WORLD, findPlace } from "../data/world.js";
import { getLang, t } from "../state.js";
import { nearestPlace, overviewInfo, overviewTexture, placeName, trackedDestination } from "../ui/campusMap.js";
import { addButton, addLabel, addShade, centerLayout, drawPanel } from "../ui/widgets.js";

const MAP = { x: 92, y: 60 };
const MAP_BOX = { width: 440, height: 450 }; // 지도 그림이 들어갈 칸. 지도 그림 1px을 정수배로 키워 넣습니다(v1 88×90 → 5배, v2 410×383 → 1배)
const INFO = { x: 598, width: 310 };
const MIN_LABEL_WIDTH = 56;

// M 키나 미니맵 클릭으로 여는 전체 캠퍼스 지도입니다. 건물 위에 이름을 바로 표시합니다.
export class MapScene extends Phaser.Scene {
  constructor() {
    super("Map");
  }

  // data.highlight: 행사 창의 "지도에서 보기"로 열었을 때 강조할 건물 id
  create(data = {}) {
    centerLayout(this);
    // 뒤쪽 버튼이 눌리지 않게 화면 전체를 막습니다.
    addShade(this, 0.7);
    const panel = this.add.graphics();
    drawPanel(panel, 24, 16, 912, 508);
    addLabel(this, MAP.x, 28, t("mapTitle"), { size: 22, color: "#f2c94c" });

    const info = overviewInfo();
    const fit = Math.min(MAP_BOX.width / info.width, MAP_BOX.height / info.height);
    this.scale_ = fit >= 1 ? Math.floor(fit) : fit;
    this.mapSize = { width: info.width * this.scale_, height: info.height * this.scale_ };
    this.perWorld = info.perWorld * this.scale_; // 월드 px → 지도 px
    this.add.image(MAP.x, MAP.y, overviewTexture(this)).setOrigin(0).setScale(this.scale_);
    panel.lineStyle(2, 0x10182a, 1).strokeRect(MAP.x - 1, MAP.y - 1, this.mapSize.width + 2, this.mapSize.height + 2);

    this.placeLabels = [...WORLD.buildings, ...WORLD.openSpaces].map((place) => this.addPlaceLabel(place));
    this.drawCompass();

    this.drawQuizBoxes();
    this.drawDestinationMarker();
    this.drawHighlight(data.highlight);
    this.drawPlayerMarker();

    this.drawMapBasis();

    addLabel(this, INFO.x, 410, t(WORLD.version === "v1" ? "mapNote" : "mapNoteV2"), { size: 12, color: "#a9b6cf", wordWrap: { width: INFO.width, useAdvancedWrap: true } });
    addButton(this, 772, 464, 136, 42, t("mapClose"), () => this.closeMap(), { size: 16, color: "#f2c94c" });

    this.input.keyboard.on("keydown-M", () => this.closeMap());
    this.input.keyboard.on("keydown-ESC", () => this.closeMap());
  }

  addPlaceLabel(place) {
    const text = getLang() === "en" ? place.nameEn ?? place.name : place.mapName ?? place.name;
    // 여러 동으로 된 건물은 가장 큰 동 가운데에 이름을 둡니다(src/data/world.js mapLabel, 월드 px).
    const { x, y } = this.toMap(place.mapLabel[0], place.mapLabel[1]);
    return addLabel(this, x, y, text, {
      size: 10,
      backgroundColor: "#10182a",
      padding: { x: 2, y: 1 },
      align: "center",
      fontFamily: "Galmuri9, sans-serif",
      wordWrap: { width: Math.max(place.labelWidth * this.perWorld - 2, MIN_LABEL_WIDTH), useAdvancedWrap: true },
    }).setOrigin(0.5);
  }

  toMap(worldX, worldY) {
    return { x: MAP.x + worldX * this.perWorld, y: MAP.y + worldY * this.perWorld };
  }

  // 지도 오른쪽 위 나침반. 맵이 정문 진입로 기준으로 돌아가 있어 북쪽이 어디인지 보여 줍니다.
  drawCompass() {
    const cx = MAP.x + this.mapSize.width - 26;
    const cy = MAP.y + 26;
    const g = this.add.graphics();
    g.fillStyle(0x10182a, 0.85).fillCircle(cx, cy, 20).lineStyle(2, 0xf2c94c, 1).strokeCircle(cx, cy, 20);
    const a = Phaser.Math.DegToRad(WORLD.northDeg - 90);
    const tip = { x: cx + Math.cos(a) * 15, y: cy + Math.sin(a) * 15 };
    const side = (d) => ({ x: cx + Math.cos(a + d) * 6, y: cy + Math.sin(a + d) * 6 });
    const tail = { x: cx - Math.cos(a) * 12, y: cy - Math.sin(a) * 12 };
    g.fillStyle(0xe5484d, 1).fillTriangle(tip.x, tip.y, side(Math.PI / 2).x, side(Math.PI / 2).y, side(-Math.PI / 2).x, side(-Math.PI / 2).y);
    g.fillStyle(0xe8e6dc, 1).fillTriangle(tail.x, tail.y, side(Math.PI / 2).x, side(Math.PI / 2).y, side(-Math.PI / 2).x, side(-Math.PI / 2).y);
    const n = { x: cx + Math.cos(a) * 30, y: cy + Math.sin(a) * 30 };
    addLabel(this, n.x, n.y, getLang() === "en" ? "N" : "북", { size: 12, color: "#ff8f92" }).setOrigin(0.5);
  }

  // 표시(현재 위치 · 목적지) 이름표: 점의 위 · 아래 · 오른쪽 · 왼쪽 가운데 지도 밖으로 나가지 않고
  // 장소 이름표 · 다른 표시와 겹치지 않는 첫 자리에 둡니다. 다 겹치면 위쪽(지도 안으로 맞춤).
  addMapTag(x, y, text, background, color) {
    const tag = addLabel(this, x, y, text, { size: 12, color, backgroundColor: background, padding: { x: 4, y: 2 } }).setOrigin(0.5);
    const w = tag.width;
    const h = tag.height;
    const gap = 9;
    const spots = [
      [x, y - gap - h / 2],
      [x, y + gap + h / 2],
      [x + gap + w / 2, y],
      [x - gap - w / 2, y],
    ];
    const inMap = ([cx, cy]) =>
      cx - w / 2 >= MAP.x && cx + w / 2 <= MAP.x + this.mapSize.width && cy - h / 2 >= MAP.y && cy + h / 2 <= MAP.y + this.mapSize.height;
    const others = [...(this.placeLabels ?? []), ...(this.mapTags ?? [])].map((o) => o.getBounds());
    const free = ([cx, cy]) => {
      const r = new Phaser.Geom.Rectangle(cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4); // 2px 여백
      return others.every((o) => !Phaser.Geom.Intersects.RectangleToRectangle(r, o));
    };
    const [cx, cy] = spots.find((s) => inMap(s) && free(s)) ?? spots[0];
    tag.setPosition(
      Phaser.Math.Clamp(cx, MAP.x + w / 2, MAP.x + this.mapSize.width - w / 2),
      Phaser.Math.Clamp(cy, MAP.y + h / 2, MAP.y + this.mapSize.height - h / 2),
    );
    (this.mapTags ??= []).push(tag);
    return tag;
  }

  // 지금 맵에 있는 퀴즈 상자들을 작은 '?' 상자 그림으로 표시합니다.
  drawQuizBoxes() {
    const boxes = this.scene.get("Campus").quizBoxes?.boxes ?? [];
    boxes.forEach((box) => {
      const { x, y } = this.toMap(box.x, box.y);
      this.add.image(x, y, "quiz-box").setScale(0.8);
    });
    this.add.image(INFO.x + 7, 232, "quiz-box");
    addLabel(this, INFO.x + 22, 224, `${t("quizMapLegend")} ${boxes.length}`, { size: 14, color: "#f2c94c" });
  }

  drawDestinationMarker() {
    const destination = trackedDestination();
    if (!destination) return;
    const { x, y } = this.toMap(destination.worldX, destination.worldY);
    this.add.rectangle(x, y, 12, 12, 0xffffff);
    const dot = this.add.rectangle(x, y, 8, 8, 0xe5484d);
    this.tweens.add({ targets: dot, alpha: 0.25, duration: 400, yoyo: true, repeat: -1 });
    this.addMapTag(x, y, t("destination"), "#e5484d", "#ffffff");

    addLabel(this, INFO.x, 152, t("destination"), { size: 14, color: "#ff8f92" });
    addLabel(this, INFO.x, 172, placeName(destination.building), { size: 16, wordWrap: { width: INFO.width, useAdvancedWrap: true } });
  }

  // 행사 장소 강조: 건물 위에 깜빡이는 노란 고리와 "행사 장소" 표시, 오른쪽 정보 칸에 건물 이름
  drawHighlight(id) {
    const place = id ? findPlace(id) : null;
    if (!place) return;
    const { x, y } = this.toMap(place.mapLabel[0], place.mapLabel[1]);
    const ring = this.add.circle(x, y, 18).setStrokeStyle(3, 0xf2c94c);
    this.tweens.add({ targets: ring, scale: 1.35, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
    this.addMapTag(x, y, `★ ${placeName(place)}`, "#f2c94c", "#231a00");
    if (!trackedDestination()) {
      addLabel(this, INFO.x, 152, t("mapHighlight"), { size: 14, color: "#f2c94c" });
      addLabel(this, INFO.x, 172, placeName(place), { size: 16, wordWrap: { width: INFO.width, useAdvancedWrap: true } });
    }
  }

  drawPlayerMarker() {
    const { player } = this.scene.get("Campus");
    const { x, y } = this.toMap(player.x, player.y);
    this.add.rectangle(x, y, 12, 12, 0x10182a);
    const dot = this.add.rectangle(x, y, 8, 8, 0xffe14d);
    this.tweens.add({ targets: dot, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
    this.addMapTag(x, y, t("mapHere"), "#ffe14d", "#231a00");

    const near = nearestPlace(player.x, player.y);
    this.currentPlace = near.id;
    addLabel(this, INFO.x, 72, t("mapHere"), { size: 14, color: "#ffe14d" });
    addLabel(this, INFO.x, 92, `${placeName(near)} ${t("mapNear")}`, { size: 16, wordWrap: { width: INFO.width, useAdvancedWrap: true } });
  }

  // 맵 기준일, 공식 캠퍼스 지도 링크, "실제와 달라요" 신고 버튼입니다. 신고는 외부 폼으로만 받고 개인정보는 받지 않습니다.
  drawMapBasis() {
    const [year, month] = MAP_BASE_DATE.split("-");
    addLabel(this, INFO.x, 272, t("mapBaseDate", { year, month: Number(month) }), { size: 14, color: "#a9b6cf" });
    const openLink = (url) => window.open(url, "_blank", "noopener,noreferrer");
    addButton(this, INFO.x, 298, INFO.width, 34, t("mapOfficial"), () => openLink(OFFICIAL_MAP_URL), { size: 14 });
    if (REPORT_FORM_URL) {
      // 지금 플레이어 근처 장소(drawPlayerMarker에서 정함)를 폼 1번 문항에 미리 채웁니다. 못 찾으면 폼 주소만 엽니다.
      addButton(this, INFO.x, 342, INFO.width, 34, t("mapReport"), () => openLink(reportFormUrl(this.currentPlace)), { size: 14, color: "#ff8f92" });
    }
  }

  closeMap() {
    this.scene.get("Campus").closeOverlay();
    this.scene.stop();
  }
}
