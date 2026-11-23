import Phaser from "phaser";
import { QUEST_LIST, getLang, isGuest, session, t, trackQuest } from "../state.js";
import { WORLD } from "../data/world.js";
import { placeName } from "../ui/campusMap.js";
import { COLOR, addButton, addLabel, addShade, centerLayout, drawPanel } from "../ui/widgets.js";

const BOX = { x: 210, y: 120, w: 540, h: 300 };

// 퀘스트 목록에서 퀘스트를 눌렀을 때 뜨는 설명 창입니다.
export class QuestInfoScene extends Phaser.Scene {
  constructor() {
    super("QuestInfo");
  }

  create({ id }) {
    const quest = QUEST_LIST.find((q) => q.id === id);
    const locked = isGuest() && quest.studentOnly;
    const done = session.completed.has(id);
    const lang = getLang();
    // 잠긴 퀘스트와 끝낸 퀘스트는 길 안내를 켜지 않습니다.
    if (!locked && !done && quest.destination) trackQuest(id);

    centerLayout(this);
    addShade(this, 0.6);
    const g = this.add.graphics();
    drawPanel(g, BOX.x, BOX.y, BOX.w, BOX.h);

    const left = BOX.x + 28;
    const wrap = { width: BOX.w - 56, useAdvancedWrap: true };
    addLabel(this, left, BOX.y + 22, quest.name[lang], { size: 22, color: "#f2c94c", wordWrap: wrap });
    addLabel(this, left, BOX.y + 66, quest.description[lang], { size: 16, lineSpacing: 7, wordWrap: wrap });

    const building = WORLD.buildings.find((b) => b.id === quest.destination);
    const status = locked ? t("studentOnly") : done ? t("questDone") : "";
    const where = building ? placeName(building) : t("questAskHere");
    addLabel(this, left, BOX.y + 176, `${t("destination")}: ${where}`, { size: 16, color: "#ff8f92", wordWrap: wrap });
    if (status) addLabel(this, left, BOX.y + 198, status, { size: 14, color: "#a9b6cf" });
    addLabel(this, left, BOX.y + 220, t("questNote"), { size: 12, color: "#a9b6cf", wordWrap: wrap });

    const buttonY = BOX.y + BOX.h - 58;
    const right = BOX.x + BOX.w - 28;
    addButton(this, right - 120, buttonY, 120, 42, t("questClose"), () => this.closeInfo(), { size: 16, border: COLOR.line });
    if (quest.minigame && !locked) {
      addButton(this, right - 268, buttonY, 140, 42, t("questStart"), () => this.startMinigame(), { size: 16, color: "#f2c94c" });
    }

    this.input.keyboard.on("keydown-ESC", () => this.closeInfo());
  }

  closeInfo() {
    this.scene.get("Campus").closeOverlay();
    this.scene.stop();
  }

  startMinigame() {
    const campus = this.scene.get("Campus");
    campus.closeOverlay();
    this.scene.stop();
    campus.openMockReg();
  }
}
