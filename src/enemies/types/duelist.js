// DUELIST (EVENTS 3.7): the ghost gunslinger of the Dead Man's Duel (QuickDraw controller). Never spawned by waves, never an elite, never drops loot.
//  * wait:    stands by the duel post, INVULNERABLE (bullets pass through) until the controller calls draw().
//  * draw:    0.45 s windup (windup pose + red aim line), then a 3-shot aimed burst (speed 360, 1 damage, 0.09 s apart).
//  * fight:   strafes vertically at 130 px/s; a burst every 1.2 s (0.4 s windup); every 3rd cycle a 300 px sidestep dash (0.35 s telegraph) comes first.
//             Below 50 % hp the burst is a 5-shot fan and the cadence drops to 0.95 s.
//  * Quick Draw: a player bullet FIRED within 0.7 s after DRAW that connects = QUICK DRAW! (that hit x2, duelist stunned 1.5 s). The design counts the
//    hit, but the room is 768 px wide and a shot takes ~1 s to arrive, so the window is measured at fire time (see notes in the job report).
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { DEPTH, ROOM } from '../../config.js';
import { subRng } from '../../core/rng.js';
import { DUEL } from '../../rooms/special/events/tables.js';
import { EVENT_LINES } from '../../data/story/dialogue.js';

const TEAL = 0x9fe0d0;
const STRAFE = 130;
const BURST = { windup: 0.45, windupLoop: 0.4, shots: 3, gap: 0.09, speed: 360, cadence: 1.2 };
const FAN = { shots: 5, step: 0.18, cadence: 0.95 }; // step = radians between neighbouring shots
const DASH = { dist: 300, telegraph: 0.35, speed: 1000 };
const AIM_LEN = 720;

class Duelist extends Enemy {
  init() {
    this.rng = subRng('duelist', this.floor, Math.round(this.x));
    this.setState('wait');
    this.invulnerable = true;
    this.noLoot = true;
    this.alphaOverride = 0.9;
    this.drawn = false;
    this.clock = 0; // seconds since DRAW
    this.quickUsed = false;
    this.cycle = 0;
    this.cool = 0;
    this.dir = this.rng.sign();
    this.dirT = 0.8;
    this.bobT = 0;
    this.busy = false; // windup / dash in progress
    this.glow = this.scene.add.image(this.x, this.y, 'glow').setTint(0x5fd8c0).setAlpha(0.35).setScale(1.5).setBlendMode(1).setDepth(DEPTH.actors - 1);
    this.sprite.setTint(TEAL);
  }

  refreshTint() {
    super.refreshTint();
    const st = this.status;
    if (this.sprite && this.flashT <= 0 && !(st.frozen || st.stun || st.fear || st.burn || st.poison || st.chill || st.slow) && !(this.wardT > 0)) this.sprite.setTint(TEAL);
  }

  syncVisual() {
    super.syncVisual();
    const g = this.glow;
    if (g && g.scene) g.setPosition(this.x, this.footY - 44).setDepth(this.sprite.depth - 0.1).setAlpha(0.3 + Math.sin(this.bobT * 3) * 0.08).setVisible(this.sprite.alpha > 0.1);
  }

  /** Controller: the bell has finished, DRAW! */
  draw() {
    if (this.drawn || !this.alive) return;
    this.drawn = true;
    this.invulnerable = false;
    this.clock = 0;
    this.setState('draw');
    this.stop();
    Sfx.play('duel_draw');
    this.aimAndFire(BURST.windup, false);
  }

  get phase2() { return this.hp < this.maxHp * 0.5; }

  ai(dt) {
    const p = this.player;
    this.bobT += dt;
    this.faceToward(p.x);
    if (!this.drawn) { this.stop(); this.setPose('move'); return; }
    this.clock += dt;
    if (this.busy) return; // windup / dash timers run through Enemy.after
    this.setPose('move');
    // vertical strafe, reverses on a timer and at the room edges
    this.dirT -= dt;
    if (this.dirT <= 0) { this.dir = -this.dir; this.dirT = 0.8 + this.rng.next() * 0.9; }
    if (this.y < ROOM.y + 90) this.dir = 1; else if (this.y > ROOM.bottom - 90) this.dir = -1;
    this.vx = 0; this.vy = this.dir * STRAFE;
    this.cool -= dt;
    if (this.cool > 0) return;
    this.cycle++;
    if (this.cycle % 3 === 0) this.sidestep(); else this.aimAndFire(BURST.windupLoop, true);
  }

  /** Windup pose + red aim line toward the player, then the burst (3 shots) or, below 50 % hp, the 5-shot fan. */
  aimAndFire(windup, loop) {
    this.busy = true;
    this.stop();
    const ang = this.angleToPlayer();
    const fan = this.phase2 && loop;
    const ox = this.x + Math.cos(ang) * 34, oy = this.y - 30 + Math.sin(ang) * 20;
    if (fan) for (let k = 0; k < FAN.shots; k++) { const a = ang + (k - 2) * FAN.step; this.scene.fx.warnLine(ox, oy, ox + Math.cos(a) * AIM_LEN, oy + Math.sin(a) * AIM_LEN, 14, windup); }
    else this.scene.fx.warnLine(ox, oy, ox + Math.cos(ang) * AIM_LEN, oy + Math.sin(ang) * AIM_LEN, 24, windup);
    this.telegraph(windup, () => {
      this.setPose('attack');
      Sfx.play('gun_cock', { vol: 0.6 });
      if (fan) { this.fire(ang, FAN.shots, FAN.step); this.after(0.3, () => this.recover(this.cd(FAN.cadence))); return; }
      this.fire(ang, 1);
      for (let k = 1; k < BURST.shots; k++) this.after(BURST.gap * k, () => this.fire(ang, 1));
      this.after(BURST.gap * BURST.shots + 0.25, () => this.recover(this.cd(BURST.cadence)));
    });
  }

  fire(ang, n, step = 0) {
    if (!this.alive) return;
    for (let k = 0; k < n; k++) {
      const a = ang + (k - (n - 1) / 2) * step;
      this.shoot(a, { speed: BURST.speed, damage: 1, kind: 'enemy', offset: 34, up: 4 });
    }
    const a0 = ang;
    this.scene.fx.muzzle(this.x + Math.cos(a0) * 44, this.y - 30 + Math.sin(a0) * 20, a0, 0.8);
  }

  recover(cool) { this.busy = false; this.cool = Math.max(0.2, cool - (BURST.windupLoop + 0.45)); this.setPose('move'); }

  /** 300 px vertical sidestep with a 0.35 s marker on the landing spot, then straight into the next burst. */
  sidestep() {
    this.busy = true;
    this.stop();
    const up = this.y - ROOM.y > ROOM.bottom - this.y ? -1 : 1; // toward the roomier side
    const dir = this.rng.chance(0.35) ? -up : up;
    const ty = Math.max(ROOM.y + 70, Math.min(ROOM.bottom - 70, this.y + dir * DASH.dist));
    this.scene.fx.warnCircle(this.x, ty, 44, DASH.telegraph, 0x5fd8c0);
    this.telegraph(DASH.telegraph, () => {
      const t = Math.abs(ty - this.y) / DASH.speed;
      this.setPose('move');
      this.vy = Math.sign(ty - this.y) * DASH.speed;
      this.vx = 0;
      Sfx.play('dodge_roll', { vol: 0.5 });
      this.after(t, () => { this.stop(); this.aimAndFire(BURST.windupLoop, true); });
    });
  }

  // ------------------------------------------------------------------------------------------ quick draw
  damageMultiplier(info) {
    const b = info && info.bullet;
    if (!this.quickUsed && this.drawn && b && b.age != null) {
      const firedAt = this.clock - b.age; // seconds after DRAW the bullet left the muzzle
      if (firedAt >= 0 && firedAt <= DUEL.quickWindow) {
        this.quickUsed = true;
        this.timers.length = 0; // the stun cancels a pending windup / burst
        this.busy = false; this.cool = DUEL.quickStun + 0.5;
        this.stop(); this.setPose('move');
        this.applyStatus('stun', { t: DUEL.quickStun });
        this.scene.fx.text(this.x, this.y - 100, EVENT_LINES.quick_draw.bell[2], { color: '#f0d060', size: 36, time: 1200 });
        this.scene.fx.ringPulse(this.x, this.y, 0xf0d060, 90, 500, 0.8);
        Sfx.play('quick_draw_ding');
        this.quickHit = true;
        return 2;
      }
    }
    return 1;
  }

  onDeath() {
    const s = this.scene;
    s.fx.burst(this.x, this.y - 30, { color: [0x9fe0d0, 0x5fd8c0, 0xffffff], count: 18, speed: [60, 240], gravity: -60, life: [400, 900], blend: 'ADD' });
    if (this.glow) { this.glow.destroy(); this.glow = null; }
  }

  destroy() {
    if (this.glow) { this.glow.destroy(); this.glow = null; }
    super.destroy();
  }
}

registerEnemy('duelist', Duelist);
