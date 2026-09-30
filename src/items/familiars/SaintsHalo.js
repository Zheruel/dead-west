// Saint's Halo (ITEMS_V2 4.1 / 4.4): a cracked gold halo with tiny wings floating over the head. The absorb itself lives in Player.damage (stats.haloCharges,
// player.haloLeft, 200 px holy nova for 3 x damage, re-armed on floor:changed); this familiar is the visual and the feedback: bright with a glow and a slow
// pulse while armed, grey and low while spent, a flare when it takes a hit, a ring + chime when it re-arms.
import Phaser from 'phaser';
import Familiar from './Familiar.js';
import { SHEET } from './familiarKit.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { DEPTH, actorDepth } from '../../config.js';

const LIFT = 112;

export default class SaintsHalo extends Familiar {
  constructor(player) {
    super(player);
    const s = this.scene;
    this.t = 0;
    this.k = player.haloLeft > 0 ? 1 : 0; // 0 spent .. 1 armed (eased)
    this.last = player.haloLeft;
    this.flare = 0;
    this.frameI = 0; this.animT = 0;
    this.frames = [Assets.frame(SHEET, 'halo_a'), Assets.frame(SHEET, 'halo_b')];
    this.glow = this.own(s.add.image(0, 0, 'glow').setTint(0xffe090).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1).setDepth(DEPTH.overlay - 6));
    this.sprite = this.own(Assets.makeCell(s, 0, 0, SHEET, 'halo_a', 0.5).setScale(0.9));
    this.appear = 0;
    this.place(0);
  }

  update(dt, player) {
    if (!this.alive) return;
    if (dt > 0.05) dt = 0.05;
    this.t += dt;
    this.appear = Math.min(1, this.appear + dt * 3);
    const n = player.haloLeft;
    if (n < this.last) { // hit absorbed
      this.flare = 0.5; this.k = 0.35;
      this.scene.fx.burst(this.x, this.y - LIFT, { color: [0xfff0b0, 0xffffff, 0xf0d060], count: 14, speed: [80, 260], life: [250, 550], scale: [1, 2.4], blend: 'ADD' });
    } else if (n > this.last) { // re-armed (new floor / second copy)
      this.flare = 0.5;
      this.scene.fx.ringPulse(player.x, player.footY, 0xfff0b0, 90, 520, 0.8);
      Sfx.play('holy_chime', { vol: 0.45, gap: 0.5 });
    }
    this.last = n;
    if (this.flare > 0) this.flare -= dt;
    this.k += ((n > 0 ? 1 : 0) - this.k) * Math.min(1, dt * 6);
    // ride above the head, slightly lagging behind sharp moves
    this.follow(player.x, player.y, dt, 14);
    this.animT += dt;
    if (this.animT >= 1 / 6) { this.animT = 0; this.frameI ^= 1; this.sprite.setFrame(this.frames[this.frameI]); }
    this.place(dt);
  }

  place() {
    const a = Math.min(1, this.appear);
    const armed = this.k;
    const bob = Math.sin(this.t * 3.2) * 4 + (1 - armed) * 8; // spent: sags
    const y = this.y - LIFT + bob;
    const sp = this.sprite;
    sp.setPosition(this.x, y).setDepth(actorDepth(this.y) + 8).setAlpha(a * (0.55 + 0.45 * armed));
    sp.setScale(0.9 * (1 + (this.flare > 0 ? this.flare * 0.7 : 0)));
    if (armed > 0.6) sp.clearTint(); else sp.setTint(0x8a8a8a);
    this.glow.setPosition(this.x, y).setDepth(DEPTH.overlay - 6)
      .setAlpha(a * armed * (0.3 + 0.1 * Math.sin(this.t * 4) + (this.flare > 0 ? this.flare * 1.2 : 0)))
      .setScale(1.1 + (this.flare > 0 ? this.flare * 2 : 0));
  }
}
