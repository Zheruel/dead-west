// CRATE MIMIC (floor 5, CHAPTER2 s3 enemy 4): an ambusher that sits in the room as a plain `obst_f5.breakable` crate (sprite swapped, shadow only, no
// damage, no contact). It wakes when the player comes within 240 px, when it is shot (the bullet is spent with a wood knock, no damage) or 7 s after
// the last other enemy in the room died. Wake = 0.5 s shake (pose 4 + dust; one eye glint hints at it a moment before the 7 s timer fires or as the
// player closes in), then it reveals and alternates:
//   pounce: crouch 0.35 s (pose 4, landing ring shown) -> hop 0.5 s toward the player (max 320 px) -> landing shock r 80, 1 dmg.
//   bite (player within ~80 px): 0.4 s windup (pose 5, bite ring shown) -> 90 px lunge -> 2 dmg inside the ring.
// Drops 2 nickels. Elite rings / nameplate stay hidden while it is disguised.
import Phaser from 'phaser';
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { Assets } from '../../core/Assets.js';
import { subRng } from '../../core/rng.js';
import { ROOM, TILE, DEPTH, FLOORS, actorDepth } from '../../config.js';
import { darkWarn, shockRing } from '../f3fx.js';

const WAKE_DIST = 240; // player proximity that wakes it
const HINT_DIST = 330; // one eye glint the first time the player gets this close
const IDLE_WAKE = 7; // s after the last other enemy died
const HINT_AT = IDLE_WAKE - 1.5; // glint in the last 1.5 s of that countdown
const SHAKE_T = 0.5;
const CROUCH_T = 0.35; // pounce telegraph (landing ring is up for crouch + hop = 0.85 s)
const HOP_T = 0.5;
const HOP_MAX = 320;
const HOP_H = 90;
const SHOCK_R = 80;
const BITE_RANGE = 92; // "within 80 px" measured between body centres, plus a little slack for the body radius
const BITE_WIND = 0.4;
const BITE_LUNGE = 90;
const BITE_LUNGE_T = 0.12;
const BITE_R = 78; // damage ring, centred on the lunge end point
const BITE_DMG = 2;
const WOOD = [0x8a5a2a, 0x6b4423, 0xb8843f];
const COAL = [0x2a2622, 0x4a4238];

class CrateMimic extends Enemy {
  init() {
    this.rng = subRng('fe4', this.id, this.floor, Math.round(this.x), Math.round(this.y), this.scene.enemies.length);
    this.setState('disguise');
    this.disguised = true;
    this.contactDamage = 0; // its damage is the landing shock and the bite only
    this.idleT = 0;
    this.glintDone = false;
    this.proxGlint = false;
    this.timer = 0;
    this.shakeT = 0;
    this.target = null;
    this.warn = null;
    this.sprite.anims.stop();
    this.sprite.setVisible(false);
    const info = FLOORS[this.floor];
    const want = (info && info.obst) || 'obst_f5';
    const sheet = Assets.has(want) ? want : 'obst_f5';
    this.crate = Assets.makeCell(this.scene, this.x, this.y + TILE / 2, sheet, 'breakable', 1);
    this.crate.setDepth(actorDepth(this.y + TILE / 2));
    this.affixNeedsHide = true; // Affixes.apply runs after init(): hide the elite ring / plate on the first syncVisual
  }

  frame(i) { if (this.sprite) { this.pose = `f${i}`; this.sprite.anims.stop(); this.sprite.setFrame(i); } }

  // ------------------------------------------------------------------------------------------ AI
  ai(dt) {
    const p = this.player;
    switch (this.state) {
      case 'disguise': this.watch(dt, p); break;
      case 'wake': {
        this.timer -= dt;
        this.shakeT += dt;
        if (this.timer > 0) {
          if (((this.shakeT * 30) | 0) % 6 === 0) this.scene.fx.dust(this.x + (this.rng.next() - 0.5) * 40, this.y + 22, 0.5);
        } else this.reveal();
        break;
      }
      case 'rest': {
        this.stop();
        this.faceToward(p.x);
        this.timer -= dt;
        if (this.timer <= 0) this.decide();
        break;
      }
      case 'crouch': {
        this.stop();
        this.faceToward(p.x);
        this.timer -= dt;
        if (this.timer <= 0) this.takeOff();
        break;
      }
      case 'hop': {
        const k = Math.min(1, this.stateTime / HOP_T);
        this.airHeight = Math.sin(Math.PI * k) * HOP_H;
        this.frame(k < 0.25 ? 1 : k < 0.8 ? 2 : 3);
        if (k >= 1) this.land();
        break;
      }
      case 'bitewind': {
        this.stop();
        this.timer -= dt;
        if (this.timer <= 0) this.lunge();
        break;
      }
      case 'lunge': {
        this.timer -= dt;
        if (this.timer <= 0) this.bite();
        break;
      }
      default: break;
    }
  }

  /** Disguised: count the idle timer, look for the player, and give the one-blink hints. */
  watch(dt, p) {
    const d = this.distToPlayer();
    let others = 0;
    const list = this.scene.enemies;
    for (let i = 0; i < list.length; i++) { const e = list[i]; if (e !== this && e.alive && !e.disguised) others++; }
    const room = this.scene.room;
    if (others > 0 || (room && room.pending > 0)) this.idleT = 0; else this.idleT += dt;
    if (d < WAKE_DIST || this.idleT >= IDLE_WAKE) { this.wake(); return; }
    if (!this.glintDone && (this.idleT >= HINT_AT || (!this.proxGlint && d < HINT_DIST))) {
      this.glintDone = this.idleT >= HINT_AT;
      this.proxGlint = true;
      this.glint();
    }
  }

  /** One blink of two glowing eyes on the crate. */
  glint() {
    const s = this.scene, y = this.y - 6;
    for (let i = 0; i < 2; i++) {
      const g = s.add.image(this.x + (i ? 11 : -11), y, 'glow').setTint(0xffe27a).setBlendMode(Phaser.BlendModes.ADD).setDepth(actorDepth(this.y + TILE / 2) + 0.5).setScale(0.05).setAlpha(0);
      s.fx._track(g);
      s.tweens.add({ targets: g, alpha: 0.95, scale: 0.16, duration: 130, yoyo: true, hold: 60, ease: 'Quad.easeOut', onComplete: () => { if (g.scene) g.destroy(); } });
    }
    Sfx.play('mimic_chomp', { vol: 0.25, rate: 1.6 });
  }

  wake() {
    if (this.state !== 'disguise') return;
    this.setState('wake');
    this.timer = SHAKE_T;
    this.shakeT = 0;
    if (this.crate) { this.crate.destroy(); this.crate = null; }
    this.sprite.setVisible(true);
    this.frame(4);
    this.faceToward(this.player.x);
    this.scene.fx.dust(this.x, this.y + 26, 1.2);
    this.scene.fx.burst(this.x, this.y - 10, { color: WOOD, count: 8, speed: [60, 190], life: [250, 500], scale: [1.4, 2.6], gravity: 420, angle: [220, 320] });
    Sfx.play('step_wood', { vol: 0.7, rate: 0.6 });
    Sfx.play('mimic_chomp', { vol: 0.5, rate: 0.7 });
  }

  reveal() {
    this.disguised = false;
    this.affixNeedsHide = false;
    this.affixVisible(true);
    this.shakeT = 0;
    const fx = this.scene.fx;
    fx.shake(0.006, 140);
    fx.burst(this.x, this.y - 20, { color: WOOD.concat(COAL), count: 14, speed: [100, 300], life: [300, 600], scale: [1.4, 2.8], gravity: 500, angle: [200, 340] });
    shockRing(this.scene, this.x, this.y + 10, 70, 0xffd0a0, 260);
    Sfx.play('mimic_chomp', { vol: 0.9 });
    this.setState('rest');
    this.timer = this.cd(0.45);
    this.setPose('move');
  }

  decide() {
    if (this.distToPlayer() < BITE_RANGE) this.startBite(); else this.startPounce();
  }

  // ------------------------------------------------------------------------------------------ pounce
  startPounce() {
    const d = this.distToPlayer();
    const a = this.angleToPlayer();
    const hop = Math.min(d, HOP_MAX);
    const tx = Phaser.Math.Clamp(this.x + Math.cos(a) * hop, ROOM.x + this.radius, ROOM.right - this.radius);
    const ty = Phaser.Math.Clamp(this.y + Math.sin(a) * hop, ROOM.y + this.radius, ROOM.bottom - this.radius);
    this.target = { x: tx, y: ty };
    this.setState('crouch');
    this.timer = CROUCH_T;
    this.setPose('windup');
    this.pulse(CROUCH_T);
    this.warn = darkWarn(this.scene, tx, ty, SHOCK_R, CROUCH_T + HOP_T, 0xd63a2a);
    Sfx.play('step_wood', { vol: 0.5, rate: 0.9 });
  }

  takeOff() {
    this.setState('hop');
    this.flying = true; // hops over rocks and pits
    const d = Math.hypot(this.target.x - this.x, this.target.y - this.y);
    this.moveToward(this.target.x, this.target.y, d / HOP_T);
    this.faceToward(this.target.x);
    this.scene.fx.dust(this.x, this.y + 22, 1.1);
    Sfx.play('step_wood', { vol: 0.7, rate: 0.7 });
  }

  land() {
    const s = this.scene, fx = s.fx, p = this.player;
    this.warn = null;
    this.stop();
    this.airHeight = 0;
    this.flying = !!this.meta.flying;
    this.moveBy(0, 0); // pushed out of anything solid it came down on
    this.frame(3);
    this.setState('rest');
    this.timer = this.cd(0.6);
    fx.shake(0.007, 170);
    fx.dust(this.x, this.y + 20, 1.6);
    shockRing(s, this.x, this.y, SHOCK_R, 0xffc890, 340);
    fx.burst(this.x, this.y + 10, { color: COAL.concat(WOOD), count: 12, speed: [90, 260], life: [250, 500], scale: [1.4, 2.6], gravity: 320, angle: [190, 350] });
    Sfx.play('coal_thud', { vol: 0.9 });
    Sfx.play('bullet_hit_wall', { vol: 0.7, rate: 0.55 });
    if (Math.hypot(p.x - this.x, p.y - this.y) < SHOCK_R) p.damage(1, { x: this.x, y: this.y, enemy: this, enemyName: 'crate_mimic', kind: 'shockwave' });
  }

  // ------------------------------------------------------------------------------------------ bite
  startBite() {
    const a = this.angleToPlayer();
    this.biteAng = a;
    this.target = { x: this.x + Math.cos(a) * BITE_LUNGE, y: this.y + Math.sin(a) * BITE_LUNGE };
    this.setState('bitewind');
    this.timer = BITE_WIND;
    this.setPose('attack'); // pose 5: jaws open
    this.pulse(BITE_WIND);
    this.faceToward(this.player.x);
    this.warn = darkWarn(this.scene, this.target.x, this.target.y, BITE_R, BITE_WIND, 0xd63a2a);
    Sfx.play('mimic_chomp', { vol: 0.55, rate: 0.85 });
  }

  lunge() {
    this.setState('lunge');
    this.timer = BITE_LUNGE_T;
    this.moveAngle(this.biteAng, BITE_LUNGE / BITE_LUNGE_T);
    this.scene.fx.dust(this.x, this.y + 20, 0.9);
  }

  bite() {
    const s = this.scene, p = this.player;
    this.warn = null;
    this.stop();
    this.moveBy(0, 0);
    this.setState('rest');
    this.timer = this.cd(0.7);
    this.setPose('move');
    s.fx.shake(0.007, 150);
    shockRing(s, this.x + Math.cos(this.biteAng) * 40, this.y + Math.sin(this.biteAng) * 40, BITE_R, 0xffe0b0, 240);
    s.fx.burst(this.x, this.y - 10, { color: [0xffe8c0, 0xe8dcc0, 0xd63a2a], count: 10, speed: [120, 320], life: [200, 420], scale: [1.2, 2.4], gravity: 300, dir: this.biteAng, spread: 50 });
    Sfx.play('mimic_chomp', { vol: 1, rate: 1.05 });
    const cx = this.target.x, cy = this.target.y;
    if (Math.hypot(p.x - cx, p.y - cy) < BITE_R) p.damage(BITE_DMG, { x: this.x, y: this.y, enemy: this, enemyName: 'crate_mimic', kind: 'bite' });
  }

  // ------------------------------------------------------------------------------------------ overrides
  /** Disguised (or shaking awake): the bullet is spent on the crate with a wood knock, no damage; a shot wakes it. */
  takeHit(dmg, info = {}) {
    if (this.disguised) {
      if (!this.alive || this.spawnT > 0) return 'ignore';
      if (this.state === 'disguise') this.wake();
      const px = info.x ?? this.x, py = info.y ?? this.y;
      this.scene.fx.burst(px, py - 16, { color: WOOD, count: 5, speed: [60, 190], life: [200, 420], scale: [1.2, 2.2], gravity: 420, dir: info.angle != null ? info.angle + Math.PI : 0, spread: 60 });
      Sfx.play('step_wood', { vol: 0.6, rate: 1.3 });
      Sfx.play('bullet_hit_wall', { vol: 0.5, rate: 0.7 });
      return 'hit';
    }
    return super.takeHit(dmg, info);
  }

  /** Poison / burn ticks bypass takeHit: nothing hurts the crate until it has revealed itself. */
  hurt(dmg, info = {}) { if (this.disguised && !info.force) return; super.hurt(dmg, info); }

  /** Elite ring, glyph, nameplate, shield bubble and aura would give the crate away. */
  affixVisible(v) {
    const st = this._affix;
    if (!st) return;
    for (const r of st.rings || []) r.setVisible(v);
    for (const g of st.glyphs || []) g.setVisible(v);
    if (st.plate) st.plate.setVisible(v);
    if (st.aura) st.aura.setVisible(v);
    if (st.bubble) st.bubble.setVisible(v);
    if (st.bubbleRing) st.bubbleRing.setVisible(v);
  }

  syncVisual() {
    super.syncVisual();
    if (this.crate) this.crate.setAlpha(this.spawnT > 0 ? 1 - Math.max(0, this.spawnT) / this.spawnDur : 1);
    if (this.state === 'wake' && this.sprite) this.sprite.x += Math.sin(this.shakeT * 90) * 3;
    if (this.affixNeedsHide && this._affix) { this.affixNeedsHide = false; this.affixVisible(false); }
  }

  dropLoot() {
    const room = this.scene.room;
    if (!room || this.noLoot || (this.scene.mut && this.scene.mut.noCoinDrops)) return;
    for (let i = 0; i < 2; i++) room.dropPickup('coin_nickel', this.x + (i ? 20 : -20), this.y + 4);
  }

  onDeath(info) {
    if (info && info.silent) return;
    const fx = this.scene.fx;
    Sfx.play('mimic_chomp', { vol: 0.8, rate: 0.55 });
    fx.shake(0.007, 180);
    fx.burst(this.x, this.y - 30, { color: WOOD.concat(COAL), count: 16, speed: [120, 340], life: [350, 700], scale: [1.6, 3.2], gravity: 500 });
  }

  destroy() {
    if (this.warn) { this.warn.destroy(); this.warn = null; }
    if (this.crate) { this.crate.destroy(); this.crate = null; }
    super.destroy();
  }
}

// `foot` puts the sprite's feet where the crate tile's bottom edge was, so the reveal does not pop vertically.
registerEnemy('crate_mimic', CrateMimic, { hp: 22, r: 34, speed: 0, floors: [5], weight: 1, foot: 38, ambush: true });
