// Little Coffin (ITEMS_V2 4.4): hops along behind you. While enemies exist, every 5 x familiarCd s the lid pops and 2 bats (+1 per extra copy) fly out, seek the
// nearest foe, bite once for 0.9 x damage (min 2) x familiarMult and vanish. Boneyard Pack: 4 bats and a 1 s shorter cycle. Pack Leader: bites carry your
// statuses. Bats are pooled code-side entities (enemy_bat frames at half scale, violet tint), not Enemy instances: they never take damage or block anything.
import Phaser from 'phaser';
import { Pet, nearestEnemy, validTarget, bite } from './familiarKit.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { bus } from '../../core/events.js';
import { DEPTH, actorDepth } from '../../config.js';

const CYCLE = 5, BATS = 2, BATS_BONEYARD = 4, BAT_SPEED = 400, BAT_LIFE = 3.2, BAT_CAP = 14, STAGGER = 0.12;
const TRAIL_MIN = 70, TRAIL_MAX = 120, HOP_SPEED = 300;
const TINT = 0xb8a0ff;

export default class LittleCoffin extends Pet {
  constructor(player) {
    super(player, { key: 'coffin_pal', radius: 16, footOffset: 8, scale: 1, shadow: 0.36, fps: 4 });
    this.timer = 0;
    this.pending = 0; // bats still to leave the lid (staggered)
    this.pendT = 0;
    this.bats = [];
    this.open = 0; // seconds the lid stays visibly open (frame b) after a release
    this.hopT = 0;
    Assets.ensureAnim(this.scene, 'enemy_bat', { start: 0, end: 3, fps: 14, name: 'familiar' });
    this.offTrans = bus.scoped(this.scene, 'room:transition', () => this.clearBats());
  }

  get batCount() {
    const st = this.player.stats;
    const copies = Math.max(1, this.player.itemCount('little_coffin'));
    return (st.boneyard ? BATS_BONEYARD : BATS) + (copies - 1);
  }
  get cycle() { return Math.max(1.5, CYCLE * this.cdMult - (this.player.stats.boneyard ? 1 : 0)); }

  anyFoe() {
    const list = this.scene.enemies;
    for (let i = 0; i < list.length; i++) if (validTarget(list[i])) return true;
    return false;
  }

  tick(dt, p) {
    // hop along behind the player
    const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
    let moving = false;
    if (d > TRAIL_MAX) {
      const sp = Math.min(HOP_SPEED * 1.4, 80 + (d - TRAIL_MAX) * 4.5);
      this.walk((dx / d) * sp, (dy / d) * sp, dt); moving = true;
      if (Math.abs(dx) > 12) this.faceLeft = dx < 0;
    } else if (d < TRAIL_MIN) { this.walk(-(dx / d) * 120, -(dy / d) * 120, dt); moving = true; }
    if (moving) { this.hopT += dt; this.bob = Math.abs(Math.sin(this.hopT * 9)) * 12; } else { this.hopT = 0; this.bob = Math.max(0, this.bob - dt * 60); }

    // release cycle: only ticks while foes are alive
    if (this.anyFoe()) {
      this.timer += dt;
      if (this.timer >= this.cycle) { this.timer = 0; this.release(p); }
    }
    if (this.pending > 0) {
      this.pendT -= dt;
      if (this.pendT <= 0) { this.pendT = STAGGER; this.pending--; this.launch(p); }
    }
    if (this.open > 0) { this.open -= dt; this.animT = 0; if (this.frameI === 0) { this.frameI = 1; this.sprite.setFrame(this.frames[1]); } }
    this.updateBats(dt, p);
  }

  release(p) {
    this.pending = this.batCount;
    this.pendT = 0;
    this.open = 0.6;
    this.squash = 0.16;
    Sfx.play('coffin_open', { vol: 0.5, rate: 1.2, gap: 0.3 });
    Sfx.play('bat_screech', { vol: 0.3, rate: 1.3, gap: 0.2 });
    this.scene.fx.burst(this.x, this.y - 30, { color: [TINT, 0x3a2a5a], count: 8, speed: [40, 150], life: [200, 420], scale: [1, 2.2], blend: 'ADD' });
  }

  acquireBat() {
    for (let i = 0; i < this.bats.length; i++) if (!this.bats[i].on) return this.bats[i];
    if (this.bats.length >= BAT_CAP) return null;
    const s = this.scene;
    const sprite = this.own(Assets.makeSprite(s, 0, 0, 'enemy_bat', 0));
    sprite.setTint(TINT).setVisible(false);
    sprite.play('enemy_bat:familiar');
    const glow = this.own(s.add.image(0, 0, 'glow').setTint(0x9070ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setVisible(false));
    const b = { on: false, x: 0, y: 0, age: 0, life: 0, target: null, sprite, glow, ph: 0 };
    this.bats.push(b);
    return b;
  }

  launch(p) {
    const b = this.acquireBat();
    if (!b) return;
    b.on = true; b.age = 0; b.life = BAT_LIFE; b.target = null;
    b.x = this.x + (this.faceLeft ? -8 : 8); b.y = this.y - 26; b.ph = this.t * 9 + this.bats.indexOf(b);
    b.vx = 0; b.vy = -160;
    b.sprite.setVisible(true).setScale(0.5).setAlpha(1);
    b.glow.setVisible(true);
    b.sprite.anims.setProgress((b.ph % 6) / 6);
  }

  updateBats(dt, p) {
    const dmg = Math.max(2, p.stats.damage * 0.9) * this.power;
    for (let i = 0; i < this.bats.length; i++) {
      const b = this.bats[i];
      if (!b.on) continue;
      b.age += dt;
      let e = b.target;
      if (!validTarget(e)) { e = b.target = nearestEnemy(this.scene, b.x, b.y, 1200); }
      if (!e || b.age >= b.life) { this.vanish(b); continue; }
      const tx = e.x - b.x, ty = e.y - 26 - b.y, d = Math.hypot(tx, ty) || 1; // b.y is the visual height (chest level of the target)
      if (d <= e.hitRadius + 14) {
        bite(p, e, dmg, Math.atan2(ty, tx), this, 0.6);
        this.scene.fx.burst(b.x, b.y, { color: [TINT, 0xffffff], count: 6, speed: [60, 190], life: [160, 340], scale: [1, 2.2], blend: 'ADD' });
        Sfx.play('bat_screech', { vol: 0.25, rate: 1.5 + Math.random() * 0.3, gap: 0.08 });
        this.vanish(b);
        continue;
      }
      // steer: velocity eases toward the target, a sine wobble keeps the flight bat-like
      const k = Math.min(1, dt * 7);
      const sp = BAT_SPEED * (b.age < 0.25 ? 0.6 + b.age * 1.6 : 1);
      b.vx += ((tx / d) * sp - b.vx) * k; b.vy += ((ty / d) * sp - b.vy) * k;
      const wob = Math.sin(this.t * 14 + b.ph) * 90;
      b.x += (b.vx + (-ty / d) * wob) * dt; b.y += (b.vy + (tx / d) * wob) * dt;
      b.sprite.setPosition(b.x, b.y).setDepth(actorDepth(b.y + 40)).setFlipX(b.vx < 0);
      b.glow.setPosition(b.x, b.y).setDepth(DEPTH.bullets - 3).setAlpha(0.35);
    }
  }

  vanish(b) {
    b.on = false; b.target = null;
    b.sprite.setVisible(false); b.glow.setVisible(false);
  }

  clearBats() { for (let i = 0; i < this.bats.length; i++) this.vanish(this.bats[i]); this.pending = 0; }

  destroy() {
    if (this.offTrans) { this.offTrans(); this.offTrans = null; }
    super.destroy();
  }
}
