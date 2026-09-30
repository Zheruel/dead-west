// FirePatch (D2): the ONE ground-fire class of the game. API (via Room.addFire / Hazards.addFire):
//   room.addFire(x, y, r, dur, { dmg = 1, team = 'enemy' | 'player', dps, tag })
// - team 'enemy': hurts the player (dmg per tick, i-frames give the effective 1 unit / 1.0 s; `explosionImmune` and `pyroImmune` are immune) and burns enemies that are
//   not fireproof (tag `fire`, affix `burning`, ghosts, bosses). team 'player' (item FirePool): never hurts the player, burns + `dps` on enemies.
// - Damage is checked every 0.25 s, none in the last 0.3 s of a patch's life. Cap 14 per room: the oldest patch is culled. Ground flyers are ignored.
// - Art: `fx_hellfire` (128x192, bottom anchor, loop 10 fps, scale r/64) with a code-drawn flame fallback.
import Phaser from 'phaser';
import { DEPTH, actorDepth } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { hurtPlayer, fireproof, ensureHazTextures, TAU, clamp } from './common.js';

export const FIRE_CAP = 14;
const TICK = 0.25;
const TONGUES = 4;

class FirePatch {
  constructor(field) {
    this.field = field;
    const s = field.scene;
    this.active = false;
    this.glow = s.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.glow.__noSnap = true;
    this.spr = null; // real art sprite (lazy)
    this.tongues = [];
    this.tag = null;
  }

  start(x, y, r, dur, o) {
    const f = this.field, s = f.scene;
    this.active = true;
    this.x = x; this.y = y; this.r = r; this.life = dur; this.t = 0;
    this.dmg = o.dmg ?? 1; this.team = o.team || 'enemy'; this.dps = o.dps || 0; this.tag = o.tag || null;
    this.tickT = TICK;
    this.seed = (x * 13 + y * 7) % 6.28;
    const player = this.team === 'player';
    this.tint = player ? 0xffd070 : 0xff7a1f;
    const real = Assets.has('fx_hellfire');
    if (real) {
      if (!this.spr) {
        this.spr = Assets.makeSprite(s, x, y, 'fx_hellfire', 0);
        this.spr.__noSnap = true;
      }
      const anim = Assets.ensureAnim(s, 'fx_hellfire', { fps: 10, name: 'loop' });
      this.spr.setVisible(true).setActive(true).setPosition(x, y + 6).setScale(r / 64).setAlpha(1);
      if (player) this.spr.setTint(0xfff0a0); else this.spr.clearTint();
      this.spr.play(anim, true);
      for (const t of this.tongues) t.setVisible(false);
    } else {
      ensureHazTextures(s);
      if (!this.tongues.length) {
        for (let i = 0; i < TONGUES; i++) { const t = s.add.image(0, 0, 'hz_tongue').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD); t.__noSnap = true; this.tongues.push(t); }
      }
      for (const t of this.tongues) t.setVisible(true).setActive(true).setTint(this.tint);
      if (this.spr) this.spr.setVisible(false);
    }
    this.glow.setVisible(true).setActive(true).setTint(this.tint).setPosition(x, y).setScale((r * 2.3) / 128, (r * 1.5) / 128).setDepth(DEPTH.floor + 2).setAlpha(0.55);
    this.place();
  }

  place() {
    const dep = this.field.room.darkMask ? DEPTH.bullets + 2 + this.y * 0.001 : actorDepth(this.y);
    this.glow.setDepth(this.field.room.darkMask ? DEPTH.bullets + 1 : DEPTH.floor + 2);
    if (this.spr && this.spr.visible) this.spr.setDepth(dep);
    for (let i = 0; i < this.tongues.length; i++) this.tongues[i].setDepth(dep);
  }

  stop() {
    this.active = false;
    this.glow.setVisible(false).setActive(false);
    if (this.spr) { this.spr.setVisible(false).setActive(false); this.spr.anims.stop(); }
    for (const t of this.tongues) t.setVisible(false).setActive(false);
  }

  update(dt) {
    this.t += dt;
    if (this.t >= this.life) { this.stop(); return false; }
    const left = this.life - this.t;
    const fade = clamp(left / 0.5, 0, 1); // fade the last 0.5 s
    const flick = 0.85 + 0.15 * Math.sin(this.t * 17 + this.seed);
    this.glow.setAlpha(0.55 * fade * flick);
    if (this.spr && this.spr.visible) this.spr.setAlpha(fade);
    if (this.tongues.length && this.tongues[0].visible) {
      const u = this.r / 48; // tongues sized to the patch
      for (let i = 0; i < TONGUES; i++) {
        const a = this.seed + (i / TONGUES) * TAU, rr = this.r * 0.42 * (i ? 1 : 0);
        const h = (0.85 + 0.35 * Math.sin(this.t * (9 + i * 2.3) + i * 1.7 + this.seed)) * u;
        this.tongues[i].setPosition(this.x + Math.cos(a) * rr, this.y + Math.sin(a) * rr * 0.6 + 8).setScale(0.75 * u, h).setAlpha(fade * (0.75 + 0.25 * Math.sin(this.t * 13 + i)));
      }
    }
    this.tickT -= dt;
    if (this.tickT <= 0) { this.tickT += TICK; if (left > 0.3) this.tick(); }
    return true;
  }

  tick() {
    const s = this.field.scene, p = s.player;
    const enemyTeam = this.team !== 'player';
    if (enemyTeam && p && !p.dead && !p.stats.pyroImmune && p.canBeHit()) {
      const rr = this.r + p.hurtRadius * 0.5;
      if ((p.x - this.x) ** 2 + (p.y - this.y) ** 2 < rr * rr) hurtPlayer(s, this.dmg, this.x, this.y, 'fire', { explosion: true });
    }
    const list = s.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || e.flying) continue;
      if (enemyTeam && (e.isBoss || fireproof(e))) continue;
      if (!enemyTeam && e.id === 'ghost') continue;
      const rr = this.r + e.hitRadius * 0.6;
      if ((e.x - this.x) ** 2 + (e.y - this.y) ** 2 > rr * rr) continue;
      e.applyStatus('burn', { dps: 3, t: 2.5 });
      if (this.dps > 0) e.hurt(this.dps * TICK, { dot: true, fire: true });
    }
  }

  destroy() {
    this.glow.destroy(); if (this.spr) this.spr.destroy();
    for (const t of this.tongues) t.destroy();
    this.tongues.length = 0;
  }
}

/** Pool + rules for one room: cap 14, oldest culled, one shared crackle loop while any patch is alive. */
export class FireField {
  constructor(room) {
    this.room = room;
    this.scene = room.scene;
    this.pool = [];
    this.order = []; // active patches, oldest first
    this.loop = null;
  }

  get count() { return this.order.length; }
  countTag(tag) { let n = 0; for (const p of this.order) if (p.tag === tag) n++; return n; }

  /** Add a patch. `o.tag` + `o.maxTag` cap patches per source (chandelier rain, hellfire modifier): past the cap the oldest of that tag is recycled. */
  add(x, y, r, dur, o = {}) {
    let p = null;
    if (o.tag && o.maxTag && this.countTag(o.tag) >= o.maxTag) {
      const i = this.order.findIndex((q) => q.tag === o.tag);
      p = this.order.splice(i, 1)[0];
      p.stop();
    }
    if (!p) for (const q of this.pool) if (!q.active) { p = q; break; }
    if (!p) {
      if (this.pool.length < FIRE_CAP) { p = new FirePatch(this); this.pool.push(p); }
      else { p = this.order.shift(); p.stop(); } // room cap: cull the oldest
    }
    p.start(x, y, r, dur, o);
    this.order.push(p);
    if (!this.loop) this.loop = Sfx.loop('fire_crackle', { vol: 0.7 });
    return p;
  }

  update(dt) {
    const o = this.order;
    for (let i = o.length - 1; i >= 0; i--) {
      const p = o[i];
      if (!p.update(dt)) o.splice(i, 1);
      else p.place();
    }
    if (!o.length && this.loop) { this.loop.stop(); this.loop = null; }
  }

  clear() {
    for (const p of this.order) p.stop();
    this.order.length = 0;
    if (this.loop) { this.loop.stop(); this.loop = null; }
  }

  destroy() {
    this.clear();
    for (const p of this.pool) p.destroy();
    this.pool.length = 0;
  }
}

export { FirePatch };
export default FirePatch;
