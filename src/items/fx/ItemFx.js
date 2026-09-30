// Per-scene runtime for item effects that outlive one call: toxic clouds (poisonCloud), the roll dust trail (devils_dust) and a local fire-patch
// fallback used when Room.addFire is not available. All objects are pooled; one update() per frame from Player.update. Cleared on room change.
import Phaser from 'phaser';
import { DEPTH } from '../../config.js';
import { bus } from '../../core/events.js';

const CLOUD_CAP = 6, DUST_CAP = 28, FIRE_CAP = 8, TICK = 0.5, DUST_TICK = 0.1, DUST_LIFE = 1.5;

const acquire = (list, cap, make) => {
  for (let i = 0; i < list.length; i++) if (!list[i].on) return list[i];
  if (list.length < cap) { const o = make(); list.push(o); return o; }
  let old = list[0]; // cap reached: recycle the oldest
  for (let i = 1; i < list.length; i++) if (list[i].age > old.age) old = list[i];
  return old;
};

export class ItemFx {
  constructor(scene) {
    this.scene = scene;
    this.clouds = [];
    this.dust = [];
    this.fires = [];
    this.dustSpawnT = 0;
    this.off = bus.scoped(scene, 'room:transition', () => this.clear());
  }

  _img(tint, depth) {
    const im = this.scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDepth(depth).setVisible(false);
    im.__noSnap = true;
    return im;
  }

  /** Toxic cloud: `dps` to enemies inside + poison, never hurts the player. */
  cloud(x, y, r, dur = 3, dps = 4) {
    const c = acquire(this.clouds, CLOUD_CAP, () => ({ on: false, age: 0, img: this._img(0x8fd040, DEPTH.fx - 4) }));
    c.on = true; c.age = 0; c.x = x; c.y = y; c.r = r; c.life = dur; c.dps = dps; c.tick = 0.1;
    c.img.setVisible(true).setPosition(x, y).setScale((r * 2.2) / 128, (r * 1.5) / 128);
  }

  /** Local ground fire (fallback for Room.addFire): team enemy = also hurts the player (1 unit, i-frames apply). */
  fire(x, y, r, dur, dps = 6, hurtsPlayer = false) {
    const f = acquire(this.fires, FIRE_CAP, () => ({ on: false, age: 0, img: this._img(0xff8a30, DEPTH.floor + 2) }));
    f.on = true; f.age = 0; f.x = x; f.y = y; f.r = r; f.life = dur; f.dps = dps; f.hurts = hurtsPlayer; f.tick = 0.1;
    f.img.setVisible(true).setPosition(x, y).setScale((r * 2.3) / 128, (r * 1.5) / 128);
  }

  /** One dust-trail segment (devils_dust). */
  dustAt(x, y) {
    const d = acquire(this.dust, DUST_CAP, () => ({ on: false, age: 0, img: this._img(0xc8a878, DEPTH.decals + 4) }));
    d.on = true; d.age = 0; d.x = x; d.y = y; d.tick = 0;
    d.img.setVisible(true).setPosition(x, y).setScale(0.55, 0.4).setAlpha(0.7);
  }

  update(dt) {
    const scene = this.scene, p = scene.player;
    if (p && !p.dead && p.stats.dustTrail && p.rolling) {
      this.dustSpawnT -= dt;
      if (this.dustSpawnT <= 0) { this.dustSpawnT = 0.08; this.dustAt(p.x, p.footY); }
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      if (!c.on) continue;
      c.age += dt;
      if (c.age >= c.life) { c.on = false; c.img.setVisible(false); continue; }
      c.img.setAlpha(0.42 * Math.min(1, (c.life - c.age) / 0.6) * (0.85 + 0.15 * Math.sin(c.age * 7)));
      c.tick -= dt;
      if (c.tick <= 0) {
        c.tick += TICK;
        const st = p ? Math.max(1, p.stats.poison) : 1;
        const list = scene.enemies;
        for (let j = 0; j < list.length; j++) {
          const e = list[j];
          if (!e.alive || e.flying) continue;
          const rr = c.r + e.hitRadius * 0.6;
          if ((e.x - c.x) ** 2 + (e.y - c.y) ** 2 > rr * rr) continue;
          e.applyStatus('poison', { dps: st, t: 2, stack: false });
          e.hurt(c.dps * TICK, { dot: true, poison: true });
        }
      }
    }
    for (let i = 0; i < this.fires.length; i++) {
      const f = this.fires[i];
      if (!f.on) continue;
      f.age += dt;
      if (f.age >= f.life) { f.on = false; f.img.setVisible(false); continue; }
      f.img.setAlpha(0.6 * Math.min(1, (f.life - f.age) / 0.5) * (0.8 + 0.2 * Math.sin(f.age * 17)));
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick += TICK;
        const list = scene.enemies;
        for (let j = 0; j < list.length; j++) {
          const e = list[j];
          if (!e.alive || e.flying || e.id === 'ghost') continue;
          const rr = f.r + e.hitRadius * 0.6;
          if ((e.x - f.x) ** 2 + (e.y - f.y) ** 2 > rr * rr) continue;
          e.applyStatus('burn', { dps: 3, t: 2.5 });
          if (f.dps > 0) e.hurt(f.dps * TICK, { dot: true, fire: true });
        }
        if (f.hurts && p && !p.dead && !p.stats.pyroImmune && p.canBeHit()) {
          const rr = f.r + p.hurtRadius * 0.5;
          if ((p.x - f.x) ** 2 + (p.y - f.y) ** 2 < rr * rr) p.damage(1, { x: f.x, y: f.y, explosion: true, kind: 'fire' });
        }
      }
    }
    for (let i = 0; i < this.dust.length; i++) {
      const d = this.dust[i];
      if (!d.on) continue;
      d.age += dt;
      if (d.age >= DUST_LIFE) { d.on = false; d.img.setVisible(false); continue; }
      d.img.setAlpha(0.7 * (1 - d.age / DUST_LIFE));
      d.tick -= dt;
      if (d.tick <= 0) {
        d.tick += DUST_TICK;
        const dmg = p ? p.stats.damage * 2 : 4;
        const list = scene.enemies;
        for (let j = 0; j < list.length; j++) {
          const e = list[j];
          if (!e.alive || e.flying) continue;
          const rr = 34 + e.hitRadius * 0.6;
          if ((e.x - d.x) ** 2 + (e.y - d.y) ** 2 > rr * rr) continue;
          e.hurt(dmg, { dot: true, dust: true });
          if (e.alive && !e.isBoss) e.applyStatus('slow', { t: 2, mult: 0.5 });
        }
        scene.bullets.enemy.clearRadius(d.x, d.y, 34);
      }
    }
  }

  clear() {
    for (const list of [this.clouds, this.dust, this.fires]) for (const o of list) { o.on = false; if (o.img.scene) o.img.setVisible(false); }
  }
}

/** The ItemFx of `scene` (created on first use). */
export const itemFx = (scene) => scene._itemFx || (scene._itemFx = new ItemFx(scene));
