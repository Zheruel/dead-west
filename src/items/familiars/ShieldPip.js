// Duster Coat visual: amber bubble + pips above the head while player.shieldLeft > 0 (the block itself lives in Player.damage()).
// Pops with a shard burst when a hit is blocked and re-inflates when a new room refills the shield.
import Phaser from 'phaser';
import Familiar from './Familiar.js';
import { Sfx } from '../../core/Audio.js';
import { DEPTH, actorDepth } from '../../config.js';

export default class ShieldPip extends Familiar {
  constructor(player) {
    super(player);
    const s = this.scene;
    this.last = player.shieldLeft;
    this.t = 0;
    this.k = this.last > 0 ? 1 : 0; // bubble visibility 0..1
    this.ring = this.own(s.add.image(0, 0, 'ring').setTint(0xf0a640).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.actors + 50));
    this.gfx = this.own(s.add.graphics().setDepth(DEPTH.overlay - 5));
  }

  update(dt, player) {
    if (!this.alive) return;
    this.t += dt;
    const n = player.shieldLeft;
    if (n < this.last) { // a hit was absorbed
      this.scene.fx.burst(player.x, player.y - 34, { color: [0xf0a640, 0xffe090, 0xffffff], count: 16, speed: [120, 320], life: [250, 500], scale: [1.5, 3] });
      this.k = 0.2;
    } else if (n > this.last) { // shield refilled
      this.k = 0;
      Sfx.play('sixth_bullet_ready', { vol: 0.35, rate: 1.4, gap: 0.2 });
    }
    this.last = n;
    const target = n > 0 ? 1 : 0;
    this.k += (target - this.k) * Math.min(1, dt * 10);
    const pulse = 1 + Math.sin(this.t * 4) * 0.03;
    const inflate = n > 0 ? 0.5 + 0.5 * this.k : this.k;
    this.ring.setPosition(player.x, player.y - 30).setScale(0.62 * pulse * (1.4 - 0.4 * inflate)).setAlpha(this.k * (0.42 + Math.sin(this.t * 5) * 0.08));
    this.ring.setVisible(this.k > 0.02);
    this.ring.setDepth(actorDepth(player.footY) + 1);
    const g = this.gfx;
    g.clear();
    if (this.k > 0.05) {
      // pips above the head, one per shield left
      for (let i = 0; i < n; i++) {
        const px = player.x + (i - (n - 1) / 2) * 20, py = player.y - 104 + Math.sin(this.t * 3 + i) * 2;
        g.fillStyle(0x120c0a, 0.9).fillCircle(px, py, 9);
        g.fillStyle(0xf0a640, this.k).fillCircle(px, py, 7);
        g.fillStyle(0xfff0c0, this.k).fillCircle(px - 2, py - 2, 2.5);
      }
    }
  }
}
