// Falling chandelier (F6, template `chandelier:true`, combat only): every 7.0 s (first at 4.0 s), one at a time. Target = the player's position at
// telegraph start + a random 0-90 px offset. Tell 1.2 s (shadow circle r 100 grows, creak, dust falls), the sprite drops in the last 0.35 s. Impact: 2 dmg
// in r 100 (roll dodges), 25 to walkers, fire patch r 80 for 3.0 s, 6 `shard` bullets in a ring (speed 200), rubble decal. Built on GroundHaz.
import { ROOM } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { GroundHaz } from '../../systems/GroundHaz.js';
import { clamp, TAU } from './common.js';
import { TEX } from './tiles.js';

export const CHANDELIER = { period: 7.0, first: 4.0, tell: 1.2, fallDur: 0.35, radius: 100, dmg: 2, enemyDmg: 25, fire: { r: 80, dur: 3.0 }, shards: 6, shardSpeed: 200, maxFire: 6, tag: 'chandelier' };

export function makeChandelierSprite(scene) {
  if (Assets.has('prop_chandelier')) return Assets.makeSprite(scene, 0, 0, 'prop_chandelier', 0).setOrigin(0.5, 0.75);
  return scene.add.image(0, 0, TEX.chandelier(scene)).setOrigin(0.5, 0.75);
}

/** Drop one chandelier at (x, y). Used by the room scheduler and by boss code (`Hazards.chandelier(room, x, y)`). Returns the GroundHaz handle. */
export function dropChandelier(scene, x, y, o = {}) {
  const C = CHANDELIER;
  return GroundHaz.of(scene).circle({
    x, y, r: o.r ?? C.radius, tell: o.tell ?? C.tell, active: 0.25, dmg: o.dmg ?? C.dmg, kind: 'chandelier', style: 'shadow', dust: true,
    enemyDmg: o.enemyDmg ?? C.enemyDmg,
    fall: (s) => { const spr = makeChandelierSprite(s); spr.setScale(1.05); return spr; }, fallDur: C.fallDur, fallHeight: y + 240, fallLift: 10,
    sfx: 'chandelier_crash', fire: { r: C.fire.r, dur: C.fire.dur, team: 'enemy', tag: C.tag, maxTag: C.maxFire }, burstColors: [0xd4a537, 0xe8dcc0, 0x8a7a68], decal: true, shake: true,
    onLand: (h) => {
      const bus = scene.bullets && scene.bullets.enemy;
      if (!bus) return;
      const a0 = Math.random() * TAU;
      for (let i = 0; i < C.shards; i++) bus.fire({ x: h.x, y: h.y, angle: a0 + (i / C.shards) * TAU, speed: C.shardSpeed, damage: 1, kind: 'shard', source: { kind: 'chandelier', hazard: 'chandelier' } });
    },
  });
}

export class ChandelierField {
  constructor(hz) {
    this.hz = hz;
    this.scene = hz.scene;
    this.next = CHANDELIER.first;
    this.cur = null;
    this.creak = false;
  }

  update() {
    const hz = this.hz;
    if (this.cur && this.cur.done) this.cur = null;
    if (!hz.live || hz.t < this.next) return;
    if (this.cur) { this.next = hz.t + 0.25; return; } // one at a time
    const p = this.scene.player;
    if (!p || p.dead) { this.next = hz.t + 0.5; return; }
    this.next += CHANDELIER.period;
    const a = hz.rng.float(0, TAU), d = hz.rng.float(0, 90);
    const x = clamp(p.x + Math.cos(a) * d, ROOM.x + 50, ROOM.right - 50), y = clamp(p.y + Math.sin(a) * d, ROOM.y + 50, ROOM.bottom - 50);
    this.cur = dropChandelier(this.scene, x, y);
    Sfx.play('chandelier_creak', { vol: 0.9 });
  }

  /** Room cleared: a chandelier that is still telegraphing is cancelled, one that has landed finishes its window. */
  stop() { if (this.cur && !this.cur.fired) this.cur.cancel(); this.cur = null; this.next = Infinity; }
  destroy() { this.stop(); }
}

export default ChandelierField;
