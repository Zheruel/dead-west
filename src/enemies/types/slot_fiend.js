// SLOT FIEND (floor 6, CHAPTER2 s5 enemy 3): waddling slot machine. Walks 40 px/s toward the player. Every 4.5 s it pulls the lever:
// three code-drawn reels above its head spin 1.2 s and stop at 0.5 / 0.8 / 1.1 s, the result stays readable until 1.7 s, then it acts:
//   CHERRIES (35)  aimed fan of 5 chips, 340 px/s, 40 deg spread
//   BELLS (25)     ring of 12 chips, 260 px/s
//   SKULLS (15)    spawns 1 waiter_imp (max 2 alive; when capped the roll is redrawn without skulls)
//   NO PAYOUT (25) mismatch: jams for 1.2 s (stunned, takes x1.3 damage) and spits 3 coins (at most 2 jams pay out per machine)
// Death: spills 3 coins.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { spawnEnemy } from '../index.js';
import { Sfx } from '../../core/Audio.js';
import { DEPTH, ROOM } from '../../config.js';
import { enemyRng, holdFrame } from '../parts/FE-E5/common.js';
import { drawReels, REEL_STOPS, SPIN_TIME, SYM_CHERRY, SYM_BELL, SYM_SKULL } from '../parts/FE-E5/reels.js';

const WALK = 40, PULL_CD = 4.5, ACT_AT = 1.7, RECOVER = 0.3, JAM = 1.2, JAM_MULT = 1.3, FAN_N = 5, FAN_SPREAD = 40, FAN_SPEED = 340, RING_N = 12, RING_SPEED = 260;
const MAX_IMPS = 2, JAM_COINS = 3, MAX_PAYING_JAMS = 2, CHIP_LIFE = 3.4;
const OUTCOMES = [{ id: 'cherries', w: 35, col: 0xff5a4a }, { id: 'bells', w: 25, col: 0xffd24a }, { id: 'skulls', w: 15, col: 0xb070ff }, { id: 'jam', w: 25, col: 0xc8c8c8 }];
const NO_SKULL = OUTCOMES.filter((o) => o.id !== 'skulls');
const SYM_OF = { cherries: SYM_CHERRY, bells: SYM_BELL, skulls: SYM_SKULL };
const TOP = 0.86; // reel panel sits above the sprite (fraction of its height)

class SlotFiend extends Enemy {
  init() {
    this.rnd = enemyRng(this);
    this.setState('walk');
    this.cdT = this.rnd.float(1.4, 2.6); // first pull soon after the spawn-in
    this.t = 0;
    this.outcome = null;
    this.final = [0, 0, 0];
    this.imps = [];
    this.jams = 0;
    this.spat = 0;
    this.stopped = 0;
    this.drawT = 0;
    this.gfx = null;
    this.acted = false;
  }

  ai(dt) {
    const p = this.player;
    const raw = dt / (this.aiScale || 1); // the reel timeline (a telegraph) ignores the swift affix
    this.cdT -= dt;
    switch (this.state) {
      case 'walk': {
        this.faceToward(p.x);
        this.setPose('move');
        this.steerToward(p.x, p.y, this.speed);
        if (this.cdT <= 0 && this.distToPlayer() < 900) this.pull();
        break;
      }
      case 'pull': {
        this.stop();
        this.faceToward(p.x);
        this.t += raw;
        this.stepReels(raw);
        if (!this.acted && this.t >= ACT_AT) { this.acted = true; this.act(); }
        break;
      }
      case 'recover': {
        this.stop();
        this.t += raw;
        if (this.t >= RECOVER) this.endCycle();
        break;
      }
      case 'jam': {
        this.stop();
        this.t += raw;
        this.spitCoins();
        if (this.t >= JAM) this.endCycle();
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------------------------------------------ pull the lever
  pull() {
    const imps = this.liveImps();
    const o = this.rnd.weighted(imps >= MAX_IMPS ? NO_SKULL : OUTCOMES, (x) => x.w);
    this.outcome = o;
    if (o.id === 'jam') { // mismatch: any three symbols that are not all equal
      const a = this.rnd.int(0, 2), b = (a + this.rnd.int(1, 2)) % 3;
      this.final = this.rnd.chance(0.5) ? [a, b, this.rnd.int(0, 2)] : [a, this.rnd.int(0, 2), b];
      if (this.final[0] === this.final[1] && this.final[1] === this.final[2]) this.final[2] = (this.final[2] + 1) % 3;
    } else { const s = SYM_OF[o.id]; this.final = [s, s, s]; }
    this.setState('pull');
    this.t = 0;
    this.acted = false;
    this.stopped = 0;
    this.cdT = this.cd(PULL_CD);
    this.stop();
    holdFrame(this, 4, 'windup');
    Sfx.play('slot_spin', { vol: 0.6 });
    if (!this.gfx) this.gfx = this.scene.add.graphics().setDepth(DEPTH.bullets + 2);
    this.gfx.setVisible(true).setAlpha(1);
    this.drawT = 0;
    this.placeGfx();
    drawReels(this.gfx, 0, this.final);
  }

  liveImps() {
    const l = this.imps;
    for (let i = l.length - 1; i >= 0; i--) if (!l[i].alive) l.splice(i, 1);
    return l.length;
  }

  stepReels(raw) {
    // a stop ding per reel as the timeline crosses it, then the outcome frame colour pulses
    while (this.stopped < 3 && this.t >= REEL_STOPS[this.stopped]) { this.stopped++; Sfx.play('slot_ding', { vol: 0.5, rate: 0.9 + this.stopped * 0.1, gap: 0.05 }); }
    this.drawT -= raw;
    if (this.drawT > 0) return;
    this.drawT = this.t < SPIN_TIME + 0.15 ? 0 : 0.05; // every frame while the reels move, ~20 Hz for the outcome pulse
    const done = this.t >= REEL_STOPS[2];
    drawReels(this.gfx, this.t, this.final, done ? this.outcome.col : 0, done ? 0.5 + 0.5 * Math.sin((this.t - REEL_STOPS[2]) * 22) : 0);
  }

  // ------------------------------------------------------------------------------------------------ outcomes
  act() {
    const id = this.outcome.id;
    const a = this.angleToPlayer();
    const mx = this.x + Math.cos(a) * 34, my = this.y + Math.sin(a) * 20 - 6;
    if (id === 'cherries') {
      this.scene.bullets.enemy.fan({ x: mx, y: my, speed: FAN_SPEED, damage: 1, kind: 'chip', radius: 13, life: CHIP_LIFE, owner: this, lift: 34 }, FAN_N, FAN_SPREAD, a);
      Sfx.play('chip_clatter', { vol: 0.7 });
      this.kick(0xff5a4a);
      this.finish();
    } else if (id === 'bells') {
      this.scene.bullets.enemy.ring({ x: this.x, y: this.y - 6, speed: RING_SPEED, damage: 1, kind: 'chip', radius: 13, life: CHIP_LIFE, owner: this, lift: 34 }, RING_N, this.rnd.float(0, 30));
      Sfx.play('chip_clatter', { vol: 0.7, rate: 0.85 });
      this.kick(0xffd24a);
      this.finish();
    } else if (id === 'skulls') {
      this.spawnImp();
      this.kick(0xb070ff);
      this.finish();
    } else { // jam
      this.setState('jam');
      this.t = 0;
      this.spitT = 0;
      this.spat = 0;
      this.jams++;
      holdFrame(this, 5, 'attack');
      Sfx.play('slot_jam', { vol: 0.7 });
      this.scene.fx.burst(this.x, this.y - 70, { color: [0xffe070, 0x8a8a8a, 0xffffff], count: 10, speed: [60, 200], life: [250, 550], scale: [1.4, 2.6], gravity: 300 });
      this.scene.fx.shake(0.003, 90);
      if (this.gfx) this.gfx.setAlpha(1);
    }
  }

  /** Cherries / bells / skulls: a short recoil in the lever pose, then walk again. */
  finish() { this.setState('recover'); this.t = 0; if (this.gfx) this.gfx.setAlpha(0.6); }

  kick(col) {
    const s = this.scene;
    s.fx.ringPulse(this.x, this.y - 40, col, 44, 300, 0.8);
    s.fx.burst(this.x, this.y - 50, { color: [col, 0xffffff], count: 6, speed: [50, 170], life: [200, 420], scale: [1.4, 2.4] });
  }

  spawnImp() {
    const a = this.angleToPlayer() + this.rnd.float(-0.6, 0.6), d = 90;
    const x = Math.max(ROOM.x + 40, Math.min(ROOM.right - 40, this.x + Math.cos(a) * d));
    const y = Math.max(ROOM.y + 40, Math.min(ROOM.bottom - 40, this.y + Math.sin(a) * d));
    const imp = spawnEnemy(this.scene, 'waiter_imp', x, y, { floor: this.floor, instant: true, affixes: [], noLoot: true });
    if (imp) { imp.noLoot = true; this.imps.push(imp); }
    Sfx.play('slot_ding', { vol: 0.6, rate: 0.6 });
    this.scene.fx.burst(x, y - 30, { color: [0xb070ff, 0x1a0a20], count: 8, speed: [40, 140], life: [250, 500], scale: [1.6, 3], tex: 'glow' });
  }

  /** Jam: spits 3 coins, one every 0.25 s from the mouth; a machine pays out at most MAX_PAYING_JAMS times (no coin farming by stalling). */
  spitCoins() {
    if (this.jams > MAX_PAYING_JAMS || this.noLoot || (this.scene.mut && this.scene.mut.noCoinDrops)) return;
    while (this.spat < JAM_COINS && this.t >= this.spat * 0.25) {
      const room = this.scene.room;
      const a = this.angleToPlayer() + (this.spat - 1) * 0.5;
      if (room) room.dropPickup('coin', this.x + Math.cos(a) * (this.radius + 24), this.y + Math.sin(a) * (this.radius + 24) + 10);
      Sfx.play('chip_clatter', { vol: 0.35, rate: 1.2, gap: 0.1 });
      this.spat++;
    }
  }

  endCycle() {
    this.setState('walk');
    this.t = 0;
    if (this.gfx) { this.gfx.clear(); this.gfx.setVisible(false); }
    this.setPose('move');
  }

  damageMultiplier() { return this.state === 'jam' ? JAM_MULT : 1; }

  // ------------------------------------------------------------------------------------------------ visuals / cleanup
  placeGfx() {
    if (this.gfx && this.sprite) this.gfx.setPosition(this.x, this.footY - this.airHeight - this.sprite.displayHeight * TOP - 26);
  }
  syncVisual() { super.syncVisual(); this.placeGfx(); }

  /** Death: spills 3 coins (replaces the normal 10 % coin roll). */
  dropLoot() {
    const room = this.scene.room;
    if (!room || this.noLoot || (this.scene.mut && this.scene.mut.noCoinDrops)) return;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * 6.283 + this.rnd.float(0, 1);
      room.dropPickup('coin', this.x + Math.cos(a) * 46, this.y + Math.sin(a) * 30 + 8);
    }
  }

  onDeath() {
    if (this.gfx) { this.gfx.destroy(); this.gfx = null; }
    this.scene.fx.burst(this.x, this.y - 50, { color: [0xffe070, 0xf2c132, 0xffffff], count: 12, speed: [90, 260], life: [300, 650], scale: [1.6, 3], gravity: 420 });
    Sfx.play('chip_clatter', { vol: 0.6, rate: 0.8 });
  }

  destroy() {
    if (this.gfx) { this.gfx.destroy(); this.gfx = null; }
    super.destroy();
  }
}

registerEnemy('slot_fiend', SlotFiend, { hp: 36, r: 44, speed: WALK, floors: [6], weight: 1, threat: 3, frame: 160, affixBan: ['splitting'] });
