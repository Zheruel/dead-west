// Preacher's Faith controller (CHARACTERS_META A2). Faith 0..100 (kept in player.itemState.sermon_bible.faith so checkpoints carry it):
//   +8 per enemy kill within 400 px, +25 per elite / miniboss kill, +4 extra on a Sixth Bullet kill, +0.4 per hit on a boss; no decay;
//   nothing is gained while Sanctified. At 100 -> resets to 0 and grants the 8 s `sanctified` buff (x1.5 bullet damage, +1 pierce, +1 luck),
//   heals 1 unit once, gold halo under the feet and pale-gold bullets (player.bulletTint, read by Player.fire).
// Visual: thin gold arc (r 40) around the player that fills with Faith; a small cross icon is shown by the HUD Relics strip via the item itself.
import Phaser from 'phaser';
import Familiar from './Familiar.js';
import { Sfx } from '../../core/Audio.js';
import { bus } from '../../core/events.js';
import { DEPTH, actorDepth } from '../../config.js';

const MAX = 100, RANGE = 400, R = 40, LIFT = 34, SANCT_T = 8, TINT = 0xffe8a0;
const GAIN = { kill: 8, elite: 25, sixth: 4, bossHit: 0.4 };
const buff = (s) => { s.bulletDamageMult *= 1.5; s.pierce += 1; s.luck += 1; };

export default class FaithMeter extends Familiar {
  constructor(player) {
    super(player);
    const s = this.scene;
    this.t = 0;
    this.sanct = 0; // seconds of Sanctified left
    this.shown = -1; // last drawn faith (redraw only on change / while animating)
    this.arc = this.own(s.add.graphics().setDepth(DEPTH.overlay - 6));
    this.halo = this.own(s.add.image(0, 0, 'glow').setTint(0xffe090).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.shadows + 1).setScale(2.1).setAlpha(0));
    const off = [
      bus.scoped(s, 'enemy:died', (e) => this.onDied(e)),
      bus.scoped(s, 'mini:defeated', () => this.gain(GAIN.elite)),
      bus.scoped(s, 'enemy:hit', (e) => { if (e && e.enemy && e.enemy.isBoss) this.gain(GAIN.bossHit); }),
    ];
    this.offs = off;
  }

  get st() {
    const is = this.player.itemState || (this.player.itemState = {}); // itemState is created by ItemSystem (FN-4); tolerate its absence
    return is.sermon_bible || (is.sermon_bible = { faith: 0 });
  }

  get faith() { return this.st.faith; }

  onDied(e) {
    if (!this.alive || !e || e.boss || this.sanct > 0) return;
    const p = this.player;
    if (Math.hypot((e.x || 0) - p.x, (e.y || 0) - p.y) > RANGE) return;
    let n = e.elite ? GAIN.elite : GAIN.kill;
    if (e.by === 'sixth') n += GAIN.sixth;
    this.gain(n);
  }

  gain(n) {
    if (!this.alive || this.sanct > 0) return;
    const st = this.st;
    st.faith = Math.min(MAX, st.faith + n);
    if (st.faith >= MAX) this.sanctify();
  }

  sanctify() {
    const p = this.player;
    this.st.faith = 0;
    this.sanct = SANCT_T;
    p.bulletTint = TINT;
    p.addBuff('sanctified', buff, SANCT_T);
    p.heal(1);
    this.scene.fx.ringPulse(p.x, p.y - LIFT, 0xffe090, 90, 520, 0.85);
    this.scene.fx.burst(p.x, p.y - LIFT, { color: [0xffe090, 0xfff4c8, 0xffffff], count: 22, speed: [120, 380], life: [300, 640], scale: [1.5, 3] });
    Sfx.play('item_get', { vol: 0.7, rate: 0.8 });
    Sfx.play('room_clear', { vol: 0.5, rate: 1 });
    bus.emit('ui:toast', { text: 'SANCTIFIED', color: '#ffe090' });
    bus.emit('faith:sanctified', {});
  }

  update(dt, player) {
    if (!this.alive) return;
    this.t += dt;
    this.x = player.x; this.y = player.y;
    if (this.sanct > 0) {
      this.sanct -= dt;
      if (this.sanct <= 0) { this.sanct = 0; player.bulletTint = null; }
    }
    const on = this.sanct > 0;
    const f = this.faith;
    // halo under the feet while Sanctified
    const ha = on ? (this.sanct < 1.5 ? 0.25 + Math.abs(Math.sin(this.t * 10)) * 0.3 : 0.5 + Math.sin(this.t * 4) * 0.08) : 0;
    this.halo.setPosition(player.x, player.footY - 4).setAlpha(ha).setDepth(actorDepth(player.footY) - 1).setVisible(ha > 0.01);
    this.arc.setPosition(player.x, player.y - LIFT); // the arc is drawn around its own origin and only redrawn when Faith changes
    if (!on && f === this.shown) return;
    this.shown = on ? -1 : f;
    const g = this.arc;
    g.clear();
    if (!on && f <= 0) return;
    const cx = 0, cy = 0;
    g.lineStyle(3, 0x120c0a, 0.55).beginPath().arc(cx, cy, R, 0, Math.PI * 2).strokePath();
    if (on) {
      g.lineStyle(4, TINT, 0.55 + Math.sin(this.t * 8) * 0.25).beginPath().arc(cx, cy, R, 0, Math.PI * 2).strokePath();
    } else {
      const a0 = -Math.PI / 2;
      g.lineStyle(4, f > 80 ? 0xfff0b0 : 0xe0a830, 0.9).beginPath().arc(cx, cy, R, a0, a0 + (f / MAX) * Math.PI * 2).strokePath();
    }
  }

  destroy() {
    if (this.offs) { for (const o of this.offs) o(); this.offs = null; }
    if (this.player) this.player.bulletTint = null;
    super.destroy();
  }
}
