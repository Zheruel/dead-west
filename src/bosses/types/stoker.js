// MINI-BOSS 5 - STOKER JACK (soot-black brute with a boiler on his back, floor 5, HP 400, EVENTS s4.3). Strip enemy_stoker (0-3 trudge, 4 leans back, 5 lunges).
// Trudges (80 px/s) to ~330 px between attacks.
//  * coal_toss     - 0.5 s lean-back, 3 coals (player + 2 spread points) land after 0.9 s on red discs (r60), 1 dmg + a fire patch for 3 s.
//  * steam_vent    - white cone (70 deg x 420 px) warns 0.8 s, then a 1.0 s jet: 1 dmg per 0.5 s tick (your i-frames make it one hit) + 40 % slow while inside.
//  * boiler_charge - 0.8 s wind-up (tracking line, locked for the last 0.3 s), 450 px/s for up to 700 px (2 dmg, steam trail), then vents 0.9 s (x1.2 damage).
//  * phase 2, Overpressure (< 50 %): speed +30 % and every 2.5 s one of four floor grates bursts (0.7 s warning, r80, 1 dmg).
import MiniBase, { ROOM, TILE, TAU, DEPTHS } from '../parts/MiniBase.js';
import { registerBoss } from '../registry.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { envOf } from '../../rooms/hazards/common.js';
import { angleDiff } from '../../core/util.js';

const CONE_HALF = (35 * Math.PI) / 180;
const CONE_LEN = 420;
const GRATES = [[6, 1], [2, 3], [10, 3], [6, 5]]; // tile coords (the champion arena keeps these free)

class Stoker extends MiniBase {
  build() {
    this.addAttack('coal_toss', this.atkCoal, { weight: 3 });
    this.addAttack('steam_vent', this.atkSteam, { weight: 2 });
    this.addAttack('boiler_charge', this.atkBoiler, { weight: 2 });
    this.strafe = this.rng.sign();
    this.strafeT = 1.5;
    this.grates = [];
    this.grateT = 2.5;
    this.lastGrate = -1;
    this.baseSpeed = this.speed;
  }

  moveBehaviour(dt) {
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = this.rng.float(1.4, 2.6); }
    this.keepDistance(330, 0.3 * this.strafe, this.speed, 60);
  }

  laneWidth() { return 2 * (this.radius * 0.85 + this.player.hurtRadius) - 4; }

  // ------------------------------------------------------------------------------------------ coal toss
  *atkCoal() {
    const p = this.player;
    this.setPose('windup');
    this.pulse(0.5);
    Sfx.play('fire_whoosh', { rate: 0.6, vol: 0.6 });
    yield 0.5;
    this.setPose('attack');
    const pts = [{ x: p.x, y: p.y }];
    const a0 = this.rng.float(0, TAU);
    for (let i = 0; i < 2; i++) {
      const a = a0 + i * Math.PI + this.rng.float(-0.4, 0.4), d = this.rng.float(170, 230);
      pts.push(this.clampIn(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 80));
    }
    for (const q of pts) {
      this.zone(q.x, q.y, 60, {
        tell: 0.9, dmg: 1, kind: 'coal', color: 0xff7a1f, fire: { r: 54, dur: 3 }, sfx: 'fire_whoosh', fallHeight: 520, fallDur: 0.5, fallLift: 10,
        burstColors: [0xff7a1f, 0x2a2a30, 0xffd060],
        fall: (sc) => Assets.makeCell(sc, 0, 0, 'projectiles_c2', 'bullet_coal', 0.5).setScale(1.7),
      });
    }
    yield 0.9;
    this.setPose('move');
    yield 0.6;
  }

  // ------------------------------------------------------------------------------------------ steam vent
  *atkSteam() {
    const s = this.scene, fx = s.fx, p = this.player;
    this.setPose('windup');
    this.pulse(0.8);
    Sfx.play('steam_hiss', { rate: 0.9 });
    const a = this.angleToPlayer();
    const ox = this.x, oy = this.y - 14;
    const c = (this.cone = { x: ox, y: oy, a, half: CONE_HALF, len: CONE_LEN, alpha: 0.08, color: 0xeaf2f8 });
    yield* this.hold(0.8, (e) => { c.alpha = 0.08 + 0.2 * (e / 0.8); });
    this.setPose('attack');
    Sfx.play('steam_hiss', { vol: 1, rate: 1.1 });
    fx.shake(0.005, 300);
    let tick = 0, puff = 0;
    yield* this.hold(1.0, (e) => {
      c.alpha = 0.5 + 0.08 * Math.sin(e * 40);
      if (e >= puff) { puff += 0.06; const r = this.rng.float(80, CONE_LEN), an = a + this.rng.float(-CONE_HALF, CONE_HALF) * 0.85; fx.smoke(ox + Math.cos(an) * r, oy + Math.sin(an) * r * 0.9, 1, true); }
      const dx = p.x - ox, dy = p.y - oy, d = Math.hypot(dx, dy);
      const pad = p.hurtRadius * 0.6;
      const inside = d < CONE_LEN + pad && (d < pad + 30 || Math.abs(angleDiff(a, Math.atan2(dy, dx))) < CONE_HALF + pad / Math.max(d, 1));
      if (inside) {
        const env = envOf(s);
        if (env && env.speedMult > 0.6) env.speedMult = 0.6;
        if (e >= tick) { tick += 0.5; p.damage(1, { x: ox, y: oy, kind: 'steam', enemy: this, enemyName: this.id }); }
      } else if (e >= tick) tick += 0.5;
    });
    this.cone = null;
    this.setPose('move');
    yield 0.5;
  }

  // ------------------------------------------------------------------------------------------ boiler charge
  *atkBoiler() {
    const fx = this.scene.fx, w = this.laneWidth();
    this.setPose('windup');
    this.pulse(0.5);
    Sfx.play('steam_hiss', { rate: 0.7, vol: 0.8 });
    let a = this.angleToPlayer();
    yield* this.hold(0.5, () => {
      a = this.angleToPlayer();
      this.lockLine(this.x, this.y, a, Math.min(700, this.rayLen(this.x, this.y, a)), w, 0.1);
    });
    a = this.angleToPlayer();
    this.clearLine();
    const len = Math.min(700, this.rayLen(this.x, this.y, a));
    this.track(fx.warnLine(this.x, this.y, this.x + Math.cos(a) * len, this.y + Math.sin(a) * len, w, 0.3, 0xd63a2a), 0.6);
    this.setPose('attack');
    Sfx.play('steam_hiss', { rate: 1.3, vol: 0.9 });
    yield 0.3;
    let puff = 0;
    yield* this.dash(a, 450, 700, { dmg: 2, each: () => { if (++puff % 3 === 0) fx.smoke(this.x - Math.cos(a) * 40, this.y + 20, 1, true); } });
    fx.shake(0.008, 200);
    Sfx.play('steam_hiss', { rate: 0.8, vol: 1 });
    this.stun(0.9); // venting: vulnerable
    this.setPose('windup');
    let v = 0;
    yield* this.hold(0.9, (e) => { if (e >= v) { v += 0.1; fx.smoke(this.x + this.rng.float(-20, 20), this.y - 30, 1, true); } });
    this.stunT = 0;
    this.setPose('move');
  }

  // ------------------------------------------------------------------------------------------ overpressure
  enterPhase2() {
    this.speed = this.baseSpeed * 1.3;
    this.grateT = 2.0;
    const s = this.scene;
    if (!this.grates.length) {
      for (const [c, r] of GRATES) {
        const x = ROOM.x + c * TILE + TILE / 2, y = ROOM.y + r * TILE + TILE / 2;
        const im = s.add.image(x, y, 'mini_grate').setDepth(DEPTHS.decals + 3).setAlpha(0.9);
        im.__noSnap = true;
        this.grates.push({ x, y, im });
      }
    }
    s.fx.flash(0xdfe8f0, 0.25);
    Sfx.play('steam_hiss', { vol: 1, rate: 0.8 });
  }
  onCancel() { if (this.p2) this.speed = this.baseSpeed * 1.3; }

  update(dt) {
    super.update(dt);
    if (this.p2 && this.active && !this.dying && this.sprite) {
      this.grateT -= dt;
      if (this.grateT <= 0) {
        this.grateT = 2.5;
        let i = this.rng.int(0, this.grates.length - 1);
        if (i === this.lastGrate) i = (i + 1 + this.rng.int(0, this.grates.length - 2)) % this.grates.length;
        this.lastGrate = i;
        const g = this.grates[i];
        this.zone(g.x, g.y, 80, {
          tell: 0.7, dmg: 1, kind: 'steam_burst', color: 0xdfe8f0, sfx: 'steam_hiss', decal: false, burstColors: [0xffffff, 0xd0d8e0, 0xa0a8b0],
          onLand: () => this.scene.fx.smoke(g.x, g.y - 20, 4, true),
        });
        g.im.setTint(0xff7a4a);
        this.scene.time.delayedCall(700, () => { if (g.im && g.im.scene) g.im.clearTint(); });
      }
    }
  }

  destroy() {
    for (const g of this.grates) if (g.im) g.im.destroy();
    this.grates.length = 0;
    super.destroy();
  }
}

registerBoss('stoker', Stoker, { foot: 30 });
