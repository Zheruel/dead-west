// Bounty Hunter's WANTED controller (CHARACTERS_META A3). On every wave (bus `room:wave`) the living non-boss enemy with the highest maxHp
// (ties: nearest) gets `enemy.marked = true`: Enemy.takeHit multiplies damage by stats.markMult (markBossMult for a boss), and a code-drawn
// WANTED poster floats over its head. A boss is marked at the start of the fight (no payout). One mark per wave; a dead mark is not replaced.
// Payout on a marked kill: 1 nickel + 1 coin pickup, 35% +1 dynamite; killed by the player's own dynamite = a guaranteed dynamite instead.
// Emits `mark:collected {id, by}`.
import Phaser from 'phaser';
import Familiar from './Familiar.js';
import { Sfx } from '../../core/Audio.js';
import { bus } from '../../core/events.js';
import { subRng } from '../../core/rng.js';
import { DEPTH, FONT_TITLE } from '../../config.js';

const DYN_CHANCE = 0.35;

export default class WantedMark extends Familiar {
  constructor(player) {
    super(player);
    const s = this.scene;
    this.t = 0;
    this.target = null;
    this.batch = 0; // fallback debounce (s) when no `room:wave` event was ever seen
    this.sawWave = false;
    this.rng = subRng('wanted', player.char || 'hunter');
    this.poster = this.own(s.add.graphics().setDepth(DEPTH.overlay - 8).setVisible(false));
    this.poster.fillStyle(0x120c0a, 0.55).fillRect(-12, -15, 26, 34)
      .fillStyle(0xe8dcc0, 1).fillRect(-13, -17, 26, 34).lineStyle(2, 0x6b4423, 1).strokeRect(-13, -17, 26, 34)
      .fillStyle(0x8a1c14, 1).fillRect(-9, -13, 18, 4).fillRect(-9, 11, 18, 2);
    this.buck = this.own(s.add.text(0, 0, '$', { fontFamily: FONT_TITLE, fontSize: '20px', color: '#6b1f14' }).setOrigin(0.5).setDepth(DEPTH.overlay - 7).setVisible(false));
    this.glow = this.own(s.add.image(0, 0, 'glow').setTint(0xc01818).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.shadows + 2).setVisible(false));
    this.offs = [
      bus.scoped(s, 'room:wave', (e) => { this.sawWave = true; this.markFrom(e && e.enemies); }),
      bus.scoped(s, 'enemy:spawned', () => { if (!this.sawWave) this.batch = 0.3; }),
      bus.scoped(s, 'boss:spawned', (e) => { if (e && e.boss) this.setMark(e.boss); }),
      bus.scoped(s, 'enemy:died', (e) => this.onDied(e)),
    ];
  }

  /** Pick the toughest living non-boss enemy of `list` (default: every enemy in the scene). */
  markFrom(list) {
    if (!this.alive) return;
    const p = this.player;
    let best = null, bd = 0;
    for (const e of list && list.length ? list : this.scene.enemies) {
      if (!e || !e.alive || e.isBoss || e.noClear || e.marked) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (!best || e.maxHp > best.maxHp || (e.maxHp === best.maxHp && d < bd)) { best = e; bd = d; }
    }
    if (best) this.setMark(best);
  }

  setMark(e) {
    if (this.target && this.target !== e) this.target.marked = false;
    e.marked = true;
    this.target = e;
    this.poster.setVisible(true); this.buck.setVisible(true); this.glow.setVisible(true);
    Sfx.play('card_flip', { vol: 0.35, rate: 1.2, gap: 0.2 });
  }

  clearMark() {
    this.target = null;
    this.poster.setVisible(false); this.buck.setVisible(false); this.glow.setVisible(false);
  }

  onDied(e) {
    const en = e && e.enemy;
    if (!en || (en !== this.target && !en.marked)) return;
    const boss = !!en.isBoss;
    this.clearMark();
    if (boss) return;
    const room = this.scene.room;
    if (!room || !room.dropPickup) return;
    const own = e.by === 'explosion' && e.info && (e.info.own || (e.info.source && e.info.source.own));
    const x = e.x ?? en.x, y = e.y ?? en.y;
    room.dropPickup('coin_nickel', x - 18, y + 8, { pop: true });
    room.dropPickup('coin', x + 18, y + 8, { pop: true });
    if (own || this.rng.chance(DYN_CHANCE)) room.dropPickup('dynamite', x, y - 14, { pop: true });
    this.scene.fx.text(x, y - 40, own ? 'BLAST BOUNTY' : 'BOUNTY', { color: '#e8c84a', size: 24 });
    Sfx.play('pickup_coin', { vol: 0.5, rate: 0.85 });
    bus.emit('mark:collected', { id: en.id, by: own ? 'own_dynamite' : (e.by || 'bullet') });
  }

  update(dt, player) {
    if (!this.alive) return;
    this.t += dt;
    if (this.batch > 0) { this.batch -= dt; if (this.batch <= 0 && !this.sawWave) this.markFrom(null); }
    const e = this.target;
    if (!e) return;
    if (!e.alive || !e.sprite || !e.sprite.scene) { this.clearMark(); return; }
    const top = e.y - (e.sprite.displayHeight || 60) - 26 + Math.sin(this.t * 4) * 3;
    this.poster.setPosition(e.x, top).setRotation(Math.sin(this.t * 2.5) * 0.08);
    this.buck.setPosition(e.x, top + 1);
    this.glow.setPosition(e.x, e.y - 20).setScale(Math.max(1.2, (e.radius || 30) / 22)).setAlpha(0.42 + Math.sin(this.t * 6) * 0.1);
  }

  destroy() {
    if (this.offs) { for (const o of this.offs) o(); this.offs = null; }
    if (this.target) this.target.marked = false;
    super.destroy();
  }
}
