// RAIL RAT (floor 5, CHAPTER2 s3 enemy 5): swarm unit, templates place packs of five. Flocks: separation 40 px from packmates, chases at 290 px/s
// with +-25 % speed jitter (each rat re-rolls its own factor every ~1 s) and a personal flank offset that fades as it closes in. A bite (contact,
// 1 dmg) sends it fleeing for 0.8 s. Short 0.3 s spawn puff. Steam jets push it natively (SteamJets moves every grounded enemy).
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { subRng } from '../../core/rng.js';

const SEP = 40; // packmate separation distance
const SEP_W = 1.6; // separation weight against the seek vector
const JITTER = 0.25; // +-25 % chase speed
const FLEE_T = 0.8;
const BITE_DMG = 1;
const FLANK = 0.7; // max flank angle (rad) while far away

class RailRat extends Enemy {
  init() {
    this.rng = subRng('fe4', this.id, this.floor, Math.round(this.x), Math.round(this.y), this.scene.enemies.length);
    this.setState('chase');
    this.flank = this.rng.float(-FLANK, FLANK);
    this.jitter = 1 + this.rng.float(-JITTER, JITTER);
    this.jTarget = this.jitter;
    this.jT = this.rng.float(0.3, 1.2);
    this.fleeT = 0;
    this.biteT = 0;
    this.squeakT = this.rng.float(0.5, 3);
    this.contactDamage = 0; // the bite is handled here (flee after it)
    this.tgt = { x: 0, y: 0 };
  }

  ai(dt) {
    const p = this.player;
    this.jT -= dt;
    if (this.jT <= 0) { this.jT = this.rng.float(0.6, 1.3); this.jTarget = 1 + this.rng.float(-JITTER, JITTER); }
    this.jitter += (this.jTarget - this.jitter) * Math.min(1, dt * 4);
    const sp = this.speed * this.jitter;
    if (this.biteT > 0) { this.biteT -= dt; if (this.biteT <= 0) this.setPose('move'); }

    // seek / flee direction + separation from packmates
    let sx = 0, sy = 0;
    const list = this.scene.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === this || e.id !== 'rail_rat' || !e.alive) continue;
      const dx = this.x - e.x, dy = this.y - e.y, d2 = dx * dx + dy * dy;
      if (d2 >= SEP * SEP || d2 < 0.01) continue;
      const d = Math.sqrt(d2), w = (SEP - d) / SEP;
      sx += (dx / d) * w; sy += (dy / d) * w;
    }
    const dist = this.distToPlayer();
    let a = this.angleToPlayer();
    if (this.fleeT > 0) {
      this.fleeT -= dt;
      a += Math.PI;
      if (this.fleeT <= 0) this.setState('chase');
    } else {
      a += this.flank * Math.min(1, Math.max(0, (dist - 100) / 320)); // flank while far, converge when close
    }
    let dx = Math.cos(a) + sx * SEP_W, dy = Math.sin(a) + sy * SEP_W;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    this.tgt.x = this.x + dx * 120; this.tgt.y = this.y + dy * 120;
    this.steerToward(this.tgt.x, this.tgt.y, sp);
    this.faceToward(this.fleeT > 0 ? this.x - Math.cos(this.angleToPlayer()) : p.x);

    // bite
    if (this.fleeT <= 0 && p.canBeHit()) {
      const rr = p.hurtRadius + this.radius * 0.85;
      if (dist < rr) this.bite(p);
    }
    this.squeakT -= dt;
    if (this.squeakT <= 0) { this.squeakT = this.rng.float(2.5, 6); if (dist < 420) Sfx.play('rat_squeak', { vol: 0.4, gap: 0.25 }); }
  }

  bite(p) {
    if (!p.damage(BITE_DMG, { x: this.x, y: this.y, enemy: this, enemyName: 'rail_rat', kind: 'contact' })) return;
    this.setState('flee');
    this.fleeT = this.cd(FLEE_T);
    this.biteT = 0.25;
    this.setPose('attack');
    Sfx.play('rat_squeak', { vol: 0.7, rate: 1.3, gap: 0.05 });
    this.scene.fx.burst(this.x, this.y - 10, { color: [0xffd060, 0xff9030], count: 4, speed: [60, 160], life: [150, 300], scale: [1, 1.8], blend: 'ADD' });
  }

  onWallHit() { if (this.fleeT > 0) this.flank = -this.flank; }

  onDeath(info) {
    if (info && info.silent) return;
    Sfx.play('rat_squeak', { vol: 0.6, rate: 0.8, gap: 0.04 });
  }
}

// spawnTime 0.5 -> Enemy.spawnT = 0.3 s (the 0.3 s spawn puff)
registerEnemy('rail_rat', RailRat, { hp: 4, r: 16, speed: 290, floors: [5], weight: 3, spawnTime: 0.5 });
