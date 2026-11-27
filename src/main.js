import Phaser from "phaser";
import "galmuri/dist/galmuri.css";
import { TitleScene } from "./scenes/TitleScene.js";
import { CampusScene } from "./scenes/CampusScene.js";
import { HudScene } from "./scenes/HudScene.js";
import { DialogScene } from "./scenes/DialogScene.js";
import { MockRegScene } from "./scenes/MockRegScene.js";
import { MapScene } from "./scenes/MapScene.js";
import { QuestInfoScene } from "./scenes/QuestInfoScene.js";
import { QuizScene } from "./scenes/QuizScene.js";
import { BoothScene } from "./scenes/BoothScene.js";
import { setupViewport, viewportSize } from "./viewport.js";

// 글자가 기본 글꼴로 그려지지 않도록 도트 글꼴을 먼저 불러옵니다. 실패해도 게임은 시작합니다.
await Promise.race([
  Promise.all([
    document.fonts.load('10px "Galmuri9"', "본관"),
    document.fonts.load('24px "Galmuri11"', "안내원"),
  ]).catch(() => {}),
  new Promise((resolve) => setTimeout(resolve, 2000)),
]);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  ...viewportSize(),
  backgroundColor: "#10182a",
  pixelArt: true,
  // 방향 패드를 누른 채 대화하기 버튼도 누를 수 있게 터치 두 개 이상을 받습니다.
  input: { activePointers: 3 },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: 0 } },
  },
  scene: [TitleScene, CampusScene, HudScene, DialogScene, MockRegScene, MapScene, QuestInfoScene, QuizScene, BoothScene],
});

game.events.once(Phaser.Core.Events.READY, () => setupViewport(game));

// 개발 서버에서만 콘솔로 게임 상태를 볼 수 있게 합니다.
if (import.meta.env.DEV) window.__game = game;
