// FE-E6 helpers (Last Chance Saloon enemies): lobbed whiskey bottle (waiter_imp), jack-in-the-box (joker) and a safe blink-spot picker.
// Both projectiles live in `scene.dynamites` (updated with the gameplay dt, destroyed on every room change) and are cancelled when their owner dies.
import Dynamite from '../../../entities/Dynamite.js';
import { DEPTH, ROOM } from '../../../config.js';
import { Assets } from '../../../core/Assets.js';
import { Sfx } from '../../../core/Audio.js';

const TAU = Math.PI * 2;
const BAD_TILES = new Set(['spikes', 'lava', 'quicksand', 'vent', 'rspikes', 'pit']);
const GLASS = [0x6fbf4a, 0xd8f0c0, 0xffffff];
const CONFETTI = [0xd63a2a, 0xffd23a, 0xb070ff, 0xf2e6c8, 0x1a1414];

/** Generated once per game: a green whiskey bottle and a jack-in-the-box smiley (code-drawn, art-independent). */
export function ensureE6Textures(scene) {
  const t = scene.textures;
  if (!t.exists('e6_bottle')) {
    const c = t.createCanvas('e6_bottle', 24, 52), x = c.getContext();
    x.lineWidth = 3; x.strokeStyle = '#120c0a'; x.fillStyle = '#4c9a3a';
    x.beginPath(); x.moveTo(8, 50); x.lineTo(8, 22); x.lineTo(10, 16); x.lineTo(10, 4); x.lineTo(14, 4); x.lineTo(14, 16); x.lineTo(16, 22); x.lineTo(16, 50); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#e8dcc0'; x.fillRect(9, 30, 6, 10);
    x.fillStyle = '#b8843f'; x.fillRect(10, 2, 4, 5);
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.fillRect(10, 24, 2, 8);
    c.refresh();
  }
  if (!t.exists('e6_face')) {
    const c = t.createCanvas('e6_face', 32, 32), x = c.getContext();
    x.fillStyle = '#ffd23a'; x.strokeStyle = '#120c0a'; x.lineWidth = 3;
    x.beginPath(); x.arc(16, 16, 12, 0, TAU); x.fill(); x.stroke();
    x.fillStyle = '#120c0a';
    x.beginPath(); x.arc(11.5, 13, 2.4, 0, TAU); x.arc(20.5, 13, 2.4, 0, TAU); x.fill();
    x.lineWidth = 2.6; x.beginPath(); x.arc(16, 17, 6.5, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
    c.refresh();
  }
}

/** Ground marker: faint disc + ring + a disc that grows to the full radius as `k` goes 0 -> 1. */
export class Marker {
  constructor(scene, x, y, r, color) {
    this.dia = r * 2;
    this.imgs = [
      scene.add.image(x, y, 'disc').setTint(color).setAlpha(0.16).setDepth(DEPTH.decals + 6).setDisplaySize(this.dia, this.dia),
      scene.add.image(x, y, 'ring').setTint(color).setAlpha(0.85).setDepth(DEPTH.decals + 7).setDisplaySize(this.dia, this.dia),
      scene.add.image(x, y, 'disc').setTint(color).setAlpha(0.32).setDepth(DEPTH.decals + 6).setDisplaySize(4, 4),
    ];
  }
  set(k, blink = false) {
    const s = 4 + (this.dia - 4) * k * k;
    const im = this.imgs;
    if (!im) return;
    im[2].setDisplaySize(s, s);
    im[1].setAlpha(blink ? 1 : 0.85);
    im[0].setAlpha(blink ? 0.3 : 0.16);
  }
  destroy() { if (this.imgs) { this.imgs.forEach((i) => i.destroy()); this.imgs = null; } }
}

const removeFrom = (list, o) => { const i = list.indexOf(o); if (i >= 0) list.splice(i, 1); };

/** Whiskey bottle lobbed by a waiter_imp: arcs to `(x,y)` in `flight` s while a marker fills, then 1 dmg r `radius` + a ring of `shard` bullets. */
export class Bottle {
  constructor(scene, x, y, o) {
    ensureE6Textures(scene);
    this.scene = scene;
    this.x = x; this.y = y;
    this.alive = true;
    this.owner = o.owner || null;
    this.from = o.from;
    this.flight = o.flight ?? 1.0;
    this.radius = o.radius ?? 70;
    this.dmg = o.dmg ?? 1;
    this.shards = o.shards ?? 8;
    this.shardSpeed = o.shardSpeed ?? 280;
    this.shardLife = o.shardLife ?? 0.7;
    this.a0 = o.angle0 ?? 0;
    this.t = 0;
    this.fuse = 1; // Dynamite chain reactions poke this on every lit stick: ignored
    this.marker = new Marker(scene, x, y, this.radius, 0xffa040);
    this.spr = scene.add.image(o.from.x, o.from.y, 'e6_bottle').setDepth(DEPTH.bullets + 5).setScale(1.1);
    this.shadow = scene.add.image(x, y + 18, 'shadow').setDepth(DEPTH.shadows + 1).setScale(0.3).setAlpha(0.55);
    scene.dynamites.push(this);
  }

  update(dt) {
    if (!this.alive) return;
    if (this.owner && !this.owner.alive) { this.cancel(); return; }
    this.t += dt;
    const k = Math.min(1, this.t / this.flight);
    const px = this.from.x + (this.x - this.from.x) * k, py = this.from.y + (this.y - this.from.y) * k;
    this.spr.setPosition(px, py - Math.sin(k * Math.PI) * 170).setRotation(k * 11);
    this.shadow.setPosition(px, py + 14);
    this.marker.set(k, k > 0.8 && Math.floor(this.t * 16) % 2 === 0);
    if (k >= 1) this.land();
  }

  land() {
    this.finish();
    const s = this.scene, fx = s.fx, p = s.player;
    fx.burst(this.x, this.y - 10, { color: GLASS, count: 16, speed: [120, 340], life: [250, 600], scale: [1.4, 3], gravity: 420 });
    fx.dust(this.x, this.y + 8, 0.9);
    fx.shake(0.005, 90);
    Sfx.play('glass_break', { vol: 0.85, gap: 0.05 });
    if (p && !p.dead && (p.x - this.x) ** 2 + (p.y - this.y) ** 2 < (this.radius + p.hurtRadius * 0.5) ** 2) {
      p.damage(this.dmg, { x: this.x, y: this.y, kind: 'bottle', enemyName: 'waiter_imp', enemy: this.owner || undefined });
    }
    const bl = s.bullets && s.bullets.enemy;
    if (bl) for (let i = 0; i < this.shards; i++) bl.fire({ x: this.x, y: this.y, angle: this.a0 + (i / this.shards) * TAU, speed: this.shardSpeed, life: this.shardLife, damage: 1, kind: 'shard', owner: this.owner && this.owner.alive ? this.owner : null });
  }

  /** Owner died mid-flight: the bottle shatters harmlessly. */
  cancel() {
    if (!this.alive) return;
    this.scene.fx.burst(this.spr.x, this.spr.y, { color: GLASS, count: 8, speed: [60, 200], life: [200, 450], scale: [1.2, 2.4], gravity: 420 });
    this.finish();
  }

  finish() {
    this.alive = false;
    this.marker.destroy();
    if (this.spr) { this.spr.destroy(); this.spr = null; }
    if (this.shadow) { this.shadow.destroy(); this.shadow = null; }
    removeFrom(this.scene.dynamites, this);
  }

  /** Room change / scene teardown. */
  destroy() { this.alive = false; this.marker.destroy(); if (this.spr) { this.spr.destroy(); this.spr = null; } if (this.shadow) { this.shadow.destroy(); this.shadow = null; } }
}

/** Jack-in-the-box: a purple, smiling Dynamite with a 1.5 s fuse and an r 110 ring. Pop = 1 dmg + 6 confetti `shard` bullets. Never hurts enemies or terrain. */
export class JackBox extends Dynamite {
  constructor(scene, x, y, o = {}) {
    ensureE6Textures(scene);
    super(scene, x, y, { fuse: 1.5, radius: 110, damage: 0, playerDamage: 1, hurtEnemies: false, ...o });
    this.owner = o.owner || null;
    this.radius = o.radius ?? 110;
    this.confetti = o.shards ?? 6;
    this.shardSpeed = o.shardSpeed ?? 240;
    this.a0 = o.angle0 ?? 0;
    this.age = 0;
    this.marker = new Marker(scene, x, y, this.radius, 0xff4a9a);
    this.face = scene.add.image(x, y - 16, 'e6_face').setDepth(DEPTH.bullets - 3).setScale(0.8);
    this.base = this.sprite ? this.sprite.scaleX : 1;
    this.sprite.setTint(0xc070ff);
  }

  /** Not a real dynamite: no 'dynamite:placed' event (the meta engine counts those), quieter fuse. */
  _start() { this.fuseLoop = Sfx.loop('fuse', { vol: 0.3 }); }

  update(dt) {
    if (!this.alive) return;
    if (this.owner && !this.owner.alive) { this.defuse(); return; }
    this.age += dt;
    super.update(dt);
    if (!this.alive) return;
    const pop = Math.min(1, this.age / 0.22), sc = this.base * (0.3 + 0.7 * (1 + 2.2 * (pop - 1) ** 3 + 1.2 * (pop - 1) ** 2));
    const blink = this.fuse < 0.6 && Math.floor(this.fuse * 14) % 2 === 0;
    this.sprite.setTint(blink ? 0xffffff : 0xc070ff).setScale(sc);
    this.face.setPosition(this.x, this.y - 12 + (1 - pop) * 10).setScale(0.8 * pop).setDepth(this.sprite.depth + 0.01);
    this.marker.set(1 - Math.max(0, this.fuse) / this.maxFuse, blink);
  }

  explode() {
    if (!this.alive) return;
    this.alive = false;
    if (this.fuseLoop) this.fuseLoop.stop();
    this.kill();
    const s = this.scene, fx = s.fx, p = s.player, x = this.x, y = this.y;
    fx.burst(x, y - 20, { color: CONFETTI, count: 26, speed: [120, 380], life: [450, 900], scale: [1.6, 3.2], gravity: 380 });
    fx.ringPulse(x, y, 0xff4a9a, this.radius, 320, 0.8);
    fx.dust(x, y + 10, 1.1);
    fx.shake(0.005, 100);
    Sfx.play('bottle_pop', { vol: 0.9, gap: 0.05 });
    Sfx.play('devil_laugh', { vol: 0.35, rate: 1.5, gap: 0.3 });
    if (p && !p.dead && (p.x - x) ** 2 + (p.y - y) ** 2 < (this.radius + p.hurtRadius * 0.5) ** 2) {
      p.damage(1, { x, y, explosion: true, kind: 'jack_box', enemyName: 'joker', enemy: this.owner || undefined });
    }
    const bl = s.bullets && s.bullets.enemy;
    if (bl) for (let i = 0; i < this.confetti; i++) bl.fire({ x, y, angle: this.a0 + (i / this.confetti) * TAU, speed: this.shardSpeed, damage: 1, kind: 'shard', owner: this.owner && this.owner.alive ? this.owner : null });
  }

  /** Owner died: the joke is off (harmless puff of confetti). */
  defuse() {
    if (!this.alive) return;
    this.alive = false;
    if (this.fuseLoop) this.fuseLoop.stop();
    this.scene.fx.burst(this.x, this.y - 20, { color: CONFETTI, count: 12, speed: [60, 220], life: [300, 650], scale: [1.4, 2.6], gravity: 300 });
    this.kill();
  }

  kill() { this.cleanup(); removeFrom(this.scene.dynamites, this); }
  cleanup() {
    this.destroyVisuals();
    if (this.marker) { this.marker.destroy(); this.marker = null; }
    if (this.face) { this.face.destroy(); this.face = null; }
  }
  destroy() { this.cleanup(); super.destroy(); }
}

/**
 * A blink destination 260-520 px from the player on a walkable tile inside the room (no rock, pit, spikes, lava, quicksand, vent).
 * `rnd` is a seeded RNG. Writes into `out` and returns true, or false when nothing fit (caller stays put).
 */
export function pickBlinkSpot(room, actor, px, py, rnd, out, lo = 260, hi = 520) {
  const m = actor.radius + 40;
  for (let i = 0; i < 18; i++) {
    const a = rnd.next() * TAU, d = lo + rnd.next() * (hi - lo);
    const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
    if (x < ROOM.x + m || x > ROOM.right - m || y < ROOM.y + m || y > ROOM.bottom - m) continue;
    if (room.probe(x, y, actor.radius + 6, actor)) continue;
    const t = room.tileAt(x, y);
    if (!t || t.solid || BAD_TILES.has(t.type)) continue;
    out.x = x; out.y = y;
    return true;
  }
  return false;
}
