// The Dealer (npc_dealer, 160x160, 6 frames: 0-3 idle loop 6 fps, 4 beckon / talk, 5 laugh). An untargetable NPC: bullets pass, never in
// scene.enemies. Without the sheet a code-drawn silhouette (frock coat, top hat, wide grin, goat-yellow eyes) stands in.
// Speech lives in DealerSpeech; `say(category, ctx)` picks a line and switches to the talk pose while it types.
import { DEPTH, actorDepth } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';
import DealerSpeech from './DealerSpeech.js';

const KEY = 'npc_dealer';

export default class Dealer {
  /** o: {seed, track(obj)}. (x, y) = the tile centre he stands on. */
  constructor(scene, x, y, o = {}) {
    this.scene = scene;
    this.x = x; this.y = y;
    this.age = 0;
    this.poseT = 0;
    this.pose = 'idle';
    this.real = Assets.has(KEY);
    const track = o.track || (() => {});
    const footY = y + 44;
    this.footY = footY;
    this.shadow = scene.add.image(x, footY - 2, 'shadow').setScale(1.0, 0.9).setAlpha(0.7).setDepth(DEPTH.shadows);
    track(this.shadow);
    if (this.real) {
      this.sprite = Assets.makeSprite(scene, x, footY, KEY, 0).setDepth(actorDepth(footY));
      this.idleAnim = Assets.ensureAnim(scene, KEY, { start: 0, end: 3, fps: 6, name: 'idle' });
      this.sprite.play(this.idleAnim, true);
    } else {
      this.sprite = scene.add.graphics().setDepth(actorDepth(footY));
      this.drawSilhouette(this.sprite);
      this.sprite.setPosition(x, footY);
    }
    track(this.sprite);
    this.speech = new DealerSpeech(scene, { x, y: footY - 178, seed: o.seed, track });
  }

  /** Tall gaunt figure in a black frock coat and top hat; local origin = feet. */
  drawSilhouette(g) {
    g.fillStyle(0x120c0a, 1);
    g.fillPoints([{ x: -26, y: 0 }, { x: -20, y: -78 }, { x: -12, y: -104 }, { x: 12, y: -104 }, { x: 20, y: -78 }, { x: 26, y: 0 }], true); // coat
    g.fillStyle(0x2a1a22, 1); g.fillRect(-4, -100, 8, 92); // shirt front
    g.fillStyle(0xe8dcc0, 1); g.fillCircle(0, -122, 15); // pale face
    g.fillStyle(0x120c0a, 1); g.fillRect(-19, -134, 38, 5); g.fillRect(-12, -166, 24, 34); // hat brim + crown
    g.fillStyle(0xd63a2a, 1); g.fillRect(-12, -140, 24, 4); // hat band
    g.fillStyle(0xe8c840, 1); g.fillCircle(-5, -124, 2.6); g.fillCircle(5, -124, 2.6); // goat-yellow eyes
    g.lineStyle(2, 0x120c0a, 1); g.beginPath(); g.moveTo(-9, -114); g.lineTo(-3, -110); g.lineTo(3, -110); g.lineTo(9, -114); g.strokePath(); // too-wide grin
    g.fillStyle(0xe8dcc0, 1); g.fillRect(-32, -70, 10, 18); g.fillRect(22, -70, 10, 18); // cuffs
  }

  /** Talk / laugh pose for `sec` seconds, then back to idle. */
  setPose(pose, sec = 0) {
    this.pose = pose; this.poseT = sec;
    if (!this.real) return;
    if (pose === 'idle') this.sprite.play(this.idleAnim, true);
    else { this.sprite.anims.stop(); this.sprite.setFrame(pose === 'laugh' ? 5 : 4); }
  }

  laugh(sfx = true) {
    this.setPose('laugh', 1.1);
    if (sfx) Sfx.play('dealer_laugh', { vol: 0.9 });
  }

  /** Pick a line of `cat` (greet / hover / signed / refused / leaving / curse) and say it. */
  say(cat, ctx) {
    const line = this.speech.sayCategory(cat, ctx);
    if (line) this.setPose('talk', Math.max(1.2, line.length / 40 + 0.4));
    return line;
  }

  get talking() { return this.speech.busy; }

  update(dt) {
    this.age += dt;
    this.speech.update(dt);
    if (this.poseT > 0) { this.poseT -= dt; if (this.poseT <= 0) this.setPose('idle'); }
    if (!this.real) { // idle sway / laugh bounce for the silhouette
      const g = this.sprite;
      g.setRotation(Math.sin(this.age * 1.4) * 0.02);
      const b = this.pose === 'laugh' ? 1 + Math.abs(Math.sin(this.age * 22)) * 0.05 : 1 + Math.sin(this.age * 1.4) * 0.008;
      g.setScale(1, b);
    }
  }

  destroy() {
    this.speech.destroy();
    if (this.sprite && this.sprite.scene) this.sprite.destroy();
    if (this.shadow && this.shadow.scene) this.shadow.destroy();
  }
}
