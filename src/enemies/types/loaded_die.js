// LOADED DIE (floor 6, CHAPTER2 s5 enemy 2): big red casino die. Rolls straight at 240 px/s along one of 8 directions (biased toward
// the player), bouncing off walls and obstacles by plain reflection. After its 2nd bounce it lands: stops 0.6 s (squash, then flat) and
// shows N white pips (N = 1..6, weights 1 2 3 3 2 1, code-drawn over the sprite), then fires N `chip` bullets evenly spaced (random
// rotation, 300 px/s) and rolls again. Contact damage 1 while rolling. The pip count is the number of chips: read it and move.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { DEPTH } from '../../config.js';
import { enemyRng, holdFrame } from '../parts/FE-E5/common.js';
import { drawPips, PIP_WEIGHTS } from '../parts/FE-E5/pips.js';

const ROLL_SPEED = 240, BOUNCES = 2, LAND_TIME = 0.6, SQUASH_TIME = 0.14, POP_GAP = 0.05, CHIP_SPEED = 300, CHIP_LIFE = 3.2, RECOIL = 0.16;
const MAX_ROLL = 7; // the roll speed itself is meta.speed (affixes scale this.speed); safety: a roll that finds no wall for this long lands anyway
const BIAS = [5, 2.5, 0.8, 0.2, 0.1]; // weight of a direction by its octant distance from the player's bearing (0, +-1, +-2, +-3, 4)
const OCT = Math.PI / 4;

class LoadedDie extends Enemy {
  init() {
    this.rnd = enemyRng(this);
    this.setState('pick');
    this.t = 0;
    this.bounces = 0;
    this.heading = 0;
    this.pips = 0;
    this.shown = 0;
    this.gfx = null;
    this.dustT = 0;
  }

  ai(dt) {
    const raw = dt / (this.aiScale || 1);
    switch (this.state) {
      case 'pick': this.startRoll(); break;
      case 'roll': {
        this.t += dt;
        this.setPose('move');
        this.sprite.anims.timeScale = 1.2;
        this.moveAngle(this.heading, this.speed);
        this.dustT -= dt;
        if (this.dustT <= 0) { this.dustT = 0.2; this.scene.fx.dust(this.x, this.footY, 0.5); }
        if (this.t >= MAX_ROLL) this.land();
        break;
      }
      case 'land': {
        this.stop();
        this.t += raw;
        if (!this.flat && this.t >= SQUASH_TIME) { this.flat = true; holdFrame(this, 5, 'windup'); } // flat face up for the count ('windup' keeps swift from shortening it)
        const want = Math.min(this.pips, Math.floor(this.t / POP_GAP) + 1);
        const k = this.t > LAND_TIME - 0.2 ? 0.5 + 0.5 * Math.sin(this.t * 50) : 0; // the last 0.2 s the pips swell and pulse: it is about to fire
        if (want !== this.shown || k) { this.shown = want; this.redrawPips(k); }
        if (this.t >= LAND_TIME) this.fire();
        break;
      }
      case 'recoil': {
        this.stop();
        this.t += raw;
        if (this.t >= RECOIL) this.setState('pick');
        break;
      }
      default: break;
    }
  }

  /** Pick one of the 8 directions, biased toward the player, and start rolling. */
  startRoll() {
    const base = Math.round(this.angleToPlayer() / OCT);
    const off = this.rnd.weighted([0, 1, -1, 2, -2, 3, -3, 4], (o) => BIAS[Math.abs(o)]);
    this.heading = (base + off) * OCT;
    this.bounces = 0;
    this.t = 0;
    this.setState('roll');
    this.moveAngle(this.heading, this.speed);
  }

  land() {
    this.setState('land');
    this.t = 0;
    this.stop();
    this.pips = this.rnd.weighted([1, 2, 3, 4, 5, 6], (n) => PIP_WEIGHTS[n - 1]);
    this.shown = 0;
    this.flat = false;
    holdFrame(this, 4, 'windup'); // landing squash
    this.pulse(LAND_TIME);
    Sfx.play('dice_roll', { vol: 0.6 });
    this.scene.fx.dust(this.x, this.footY, 0.9);
    if (!this.gfx) this.gfx = this.scene.add.graphics().setDepth(DEPTH.bullets - 1);
    this.gfx.setVisible(true);
    this.syncVisual();
  }

  redrawPips(k) { drawPips(this.gfx, this.pips, this.shown, k); }

  fire() {
    const n = this.pips, a0 = this.rnd.float(0, 6.283);
    for (let i = 0; i < n; i++) {
      this.shoot(a0 + (i / n) * 6.283185, { speed: CHIP_SPEED, damage: 1, kind: 'chip', radius: 13, life: CHIP_LIFE, offset: this.radius, up: 6, lift: 34 });
    }
    Sfx.play('chip_clatter', { vol: 0.6 });
    this.scene.fx.burst(this.x, this.y - 40, { color: [0xfff8e8, 0xe8dcc0], count: 8, speed: [60, 200], life: [200, 420], scale: [1.4, 2.4] });
    if (this.gfx) { this.gfx.clear(); this.gfx.setVisible(false); }
    this.pips = 0;
    this.shown = 0;
    this.setState('recoil');
    this.t = 0;
    holdFrame(this, 5, 'flat');
  }

  /** Plain reflection off walls / obstacles; the 2nd bounce lands the die. */
  onWallHit(nx, ny) {
    if (this.state !== 'roll') return;
    const hx = Math.cos(this.heading), hy = Math.sin(this.heading);
    const dot = hx * nx + hy * ny;
    if (dot >= 0) return; // already moving away (the same wall hit again next frame)
    this.heading = Math.atan2(hy - 2 * dot * ny, hx - 2 * dot * nx);
    this.bounces++;
    Sfx.play('dice_roll', { vol: 0.4, detune: 200, gap: 0.12 });
    this.scene.fx.burst(this.x - nx * this.radius, this.y - 24, { color: [0xd63a2a, 0xe8dcc0], count: 4, speed: [50, 150], life: [200, 350], scale: [1.2, 2] });
    if (this.bounces >= BOUNCES) this.land();
    else this.moveAngle(this.heading, this.speed);
  }

  syncVisual() {
    super.syncVisual();
    if (this.gfx && this.sprite && this.state === 'land') this.gfx.setPosition(this.x, this.footY - this.sprite.displayHeight * 0.4);
  }

  destroy() {
    if (this.gfx) { this.gfx.destroy(); this.gfx = null; }
    super.destroy();
  }
}

registerEnemy('loaded_die', LoadedDie, { hp: 22, r: 36, speed: ROLL_SPEED, floors: [6], weight: 2, threat: 2, frame: 128, fps: 10, flip: false, knockback: 60, affixBan: ['splitting'] });
