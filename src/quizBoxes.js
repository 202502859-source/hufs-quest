import Phaser from "phaser";
import { WORLD } from "./data/world.js";

export const QUIZ_BOX_COUNT = 15;
const RESPAWN_MS = 30_000;
const OPEN_RANGE = 22; // 상자 중심에서 이 거리(px) 안이면 열 수 있습니다.
const MIN_GAP_PX = 64; // 상자끼리, 또 캐릭터와 이만큼(4타일 = 16m) 떨어뜨려 놓습니다.

/*
 * 맵 위 O/X 퀴즈 상자 15개를 관리합니다.
 * 보행로 · 잔디 · 흙 광장 칸 가운데, 시작 위치에서 실제로 걸어갈 수 있는 칸에만 놓습니다
 * (건물 · 숲 · 차도 · 입구 앞 · 안내원 자리 제외, WORLD.quizSpots — src/data/world.js).
 * 푼 상자는 사라지고 30초 뒤 다른 무작위 칸에 새로 생겨 개수를 15개로 유지합니다.
 */
export class QuizBoxes {
  constructor(scene, onTap) {
    this.scene = scene;
    this.onTap = onTap;
    this.boxes = [];
    this.candidates = WORLD.quizSpots(); // 월드 px
    for (let i = 0; i < QUIZ_BOX_COUNT; i++) this.spawn();
  }

  spawn() {
    const player = this.scene.player;
    const here = player ? { x: player.x, y: player.y } : WORLD.spawn;
    const farFrom = (p, other) => Math.max(Math.abs(p.x - other.x), Math.abs(p.y - other.y)) >= MIN_GAP_PX;
    let spot = null;
    for (let tries = 0; tries < 300 && !spot; tries++) {
      const pick = Phaser.Utils.Array.GetRandom(this.candidates);
      if (farFrom(pick, here) && this.boxes.every((b) => farFrom(pick, b))) spot = pick;
    }
    spot ??= Phaser.Utils.Array.GetRandom(this.candidates);

    const { x, y } = spot;
    const sprite = this.scene.add.image(x, y, "quiz-box").setDepth(y).setInteractive({ useHandCursor: true });
    const box = { x, y, sprite, question: null };
    this.scene.tweens.add({ targets: sprite, y: y - 2, duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    // 터치 화면에서는 가까이 간 상자를 눌러서 엽니다.
    sprite.on("pointerdown", () => {
      if (this.nearest() === box) this.onTap(box);
    });
    this.boxes.push(box);
    return box;
  }

  // 캐릭터와 가장 가까운, 열 수 있는 거리 안의 상자입니다. 없으면 null입니다.
  nearest() {
    const player = this.scene.player;
    let best = null;
    let bestDistance = OPEN_RANGE;
    this.boxes.forEach((box) => {
      const distance = Phaser.Math.Distance.Between(player.x, player.y, box.x, box.y);
      if (distance < bestDistance) {
        best = box;
        bestDistance = distance;
      }
    });
    return best;
  }

  // 다른 상자에 이미 들어 있는 문제입니다. 같은 문제가 두 상자에 동시에 나오지 않게 합니다.
  assignedIds(except) {
    return new Set(this.boxes.filter((b) => b !== except && b.question).map((b) => b.question.id));
  }

  solve(box) {
    const index = this.boxes.indexOf(box);
    if (index === -1) return;
    this.boxes.splice(index, 1);
    this.scene.tweens.killTweensOf(box.sprite);
    box.sprite.destroy();
    this.scene.time.delayedCall(RESPAWN_MS, () => this.spawn());
  }
}
