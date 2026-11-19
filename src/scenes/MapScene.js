import Phaser from "phaser";
import { MAP_BASE_DATE, OFFICIAL_MAP_URL, REPORT_FORM_URL, reportFormUrl } from "../data/buildingInfo.js";
import { BUILDINGS, MAP_HEIGHT, MAP_WIDTH, OPEN_SPACES } from "../data/campus.js";
import { TILE_SIZE } from "../gfx/textures.js";
import { getLang, t } from "../state.js";
import { nearestPlace, overviewTexture, placeName, trackedDestination } from "../ui/campusMap.js";
import { addButton, addLabel, addShade, centerLayout, drawPanel } from "../ui/widgets.js";

const SCALE = 6; // 타일 하나를 6픽셀로 그립니다.
const MAP = { x: 92, y: 64 };
const INFO = { x: 598, width: 310 };
const MIN_LABEL_WIDTH = 56;

// M 키나 미니맵 클릭으로 여는 전체 캠퍼스 지도입니다. 건물 위에 이름을 바로 표시합니다.
export class MapScene extends Phaser.Scene {
  constructor() {
    super("Map");
  }

  create() {
    centerLayout(this);
    // 뒤쪽 버튼이 눌리지 않게 화면 전체를 막습니다.
    addShade(this, 0.7);
    const panel = this.add.graphics();
    drawPanel(panel, 24, 16, 912, 508);
    addLabel(this, MAP.x, 28, t("mapTitle"), { size: 22, color: "#f2c94c" });

    this.add.image(MAP.x, MAP.y, overviewTexture(this)).setOrigin(0).setScale(SCALE);
    panel.lineStyle(2, 0x10182a, 1).strokeRect(MAP.x - 1, MAP.y - 1, MAP_WIDTH * SCALE + 2, MAP_HEIGHT * SCALE + 2);

    this.placeLabels = [...BUILDINGS, ...OPEN_SPACES].map((place) => this.addPlaceLabel(place));

    this.drawQuizBoxes();
    this.drawDestinationMarker();
    this.drawPlayerMarker();

    this.drawMapBasis();

    addLabel(this, INFO.x, 410, t("mapNote"), { size: 12, color: "#a9b6cf", wordWrap: { width: INFO.width, useAdvancedWrap: true } });
    addButton(this, 772, 464, 136, 42, t("mapClose"), () => this.closeMap(), { size: 16, color: "#f2c94c" });

    this.input.keyboard.on("keydown-M", () => this.closeMap());
    this.input.keyboard.on("keydown-ESC", () => this.closeMap());
  }

  addPlaceLabel(place) {
    const text = getLang() === "en" ? place.nameEn : place.mapName ?? place.name;
    return addLabel(this, MAP.x + (place.x + place.w / 2) * SCALE, MAP.y + (place.y + place.h / 2) * SCALE, text, {
      size: 10,
      backgroundColor: "#10182a",
      padding: { x: 2, y: 1 },
      align: "center",
      fontFamily: "Galmuri9, sans-serif",
      wordWrap: { width: Math.max(place.w * SCALE - 2, MIN_LABEL_WIDTH), useAdvancedWrap: true },
    }).setOrigin(0.5);
  }

  toMap(worldX, worldY) {
    return { x: MAP.x + (worldX / TILE_SIZE) * SCALE, y: MAP.y + (worldY / TILE_SIZE) * SCALE };
  }

  addMapTag(x, y, text, background, color) {
    const tag = addLabel(this, x, y - 12, text, { size: 12, color, backgroundColor: background, padding: { x: 4, y: 2 } }).setOrigin(0.5, 1);
    // 표시가 지도 밖으로 나가지 않게 위치를 맞춥니다.
    const half = tag.width / 2;
    tag.setX(Phaser.Math.Clamp(x, MAP.x + half, MAP.x + MAP_WIDTH * SCALE - half));
    if (tag.y - tag.height < MAP.y) tag.setOrigin(0.5, 0).setY(y + 12);
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
