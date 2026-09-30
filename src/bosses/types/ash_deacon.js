// MINI-BOSS 4 - THE ASH DEACON (burning deacon with a chained censer, floor 4, HP 340, EVENTS s4.3). Strip enemy_ash_deacon (0-3 drift, 4 raises the censer, 5 swings).
// Drifts at ~270 px (100 px/s) and strafes between attacks.
//  * censer_swing  - 0.6 s wind-up, then a ring of 12 orange bullets (280 px/s, dying at radius ~200) and 4 fire patches on that ring (red discs 0.7 s ahead).
//  * brimstone_rain - 5 red discs (r80) spread over 0.6 s, each lands 1.0 s after it appears: fire pillar (1 dmg) + a fire patch for 3.5 s.
//  * ash_step      - dissolves (invulnerable, gone 0.7 s), an ash mark shows where he returns: 300 px behind you; on return a ring of 8 bullets.
//  * phase 2 (< 50 %): the ring is 16 bullets and a fire pillar erupts on a random wall tile every 6 s.
import MiniBase, { ROOM, COLS, ROWS, TAU, clamp } from '../parts/MiniBase.js';
import { registerBoss } from '../registry.js';
import { Sfx } from '../../core/Audio.js';

const FIRE = 0xff7a1f;
const ASH = 0xb8aaa0;
const BULLET = { kind: 'enemy', tint: 0xffa040, damage: 1, lift: 24 };
const RING_R = 200;
const PERIMETER = []; // tile coords along the room edge, computed once
for (let c = 0; c < COLS; c++) { PERIMETER.push([c, 0], [c, ROWS - 1]); }
for (let r = 1; r < ROWS - 1; r++) { PERIMETER.push([0, r], [COLS - 1, r]); }

class AshDeacon extends MiniBase {
  build() {
    this.addAttack('censer_swing', this.atkCenser, { weight: 3 });
    this.addAttack('brimstone_rain', this.atkRain, { weight: 2 });
    this.addAttack('ash_step', this.atkAshStep, { weight: 1 });
    this.strafe = this.rng.sign();
    this.strafeT = 1.5;
    this.pillarT = 6;
  }

  moveBehaviour(dt) {
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = this.rng.float(1.4, 2.6); }
    this.keepDistance(270, 0.45 * this.strafe, this.speed, 50);
  }

  /** Fire pillar: red disc r80 for `tell` s, then 1 dmg and a fire patch. */
  pillar(x, y, tell = 1.0) {
    return this.zone(x, y, 80, {
      tell, dmg: 1, kind: 'fire_pillar', color: FIRE, sfx: 'fire_whoosh', fire: { r: 66, dur: 3.5 },
      burstColors: [0xff7a1f, 0xffd060, 0x8a1c1c],
    });
  }

  // ------------------------------------------------------------------------------------------ censer swing
  *atkCenser() {
    const s = this.scene, n = this.p2 ? 16 : 12;
    this.setPose('windup');
    this.pulse(0.6);
    Sfx.play('censer_swing');
    yield 0.6;
    this.setPose('attack');
    Sfx.play('fire_whoosh', { vol: 0.8, rate: 0.9 });
    s.fx.shake(0.006, 200);
    const ox = this.x, oy = this.y - 10;
    s.bullets.enemy.ring({ x: ox, y: oy, speed: 280, life: RING_R / 280, ...BULLET }, n, this.rng.float(0, 360));
    s.fx.ringPulse(ox, oy + 10, FIRE, RING_R, 700, 0.5);
    const a0 = this.rng.float(0, TAU);
    for (let i = 0; i < 4; i++) {
      const a = a0 + (i / 4) * TAU;
      const q = this.clampIn(ox + Math.cos(a) * RING_R, this.y + Math.sin(a) * RING_R, 60);
      this.zone(q.x, q.y, 52, { tell: 0.7, dmg: 0, color: FIRE, fire: { r: 50, dur: 3.5 }, fx: 'none', decal: false, shake: false });
    }
    yield 0.8;
    this.setPose('move');
    yield 0.5;
  }

  // ------------------------------------------------------------------------------------------ brimstone rain
  *atkRain() {
    const p = this.player;
    this.setPose('windup');
    this.pulse(0.5);
    Sfx.play('fire_whoosh', { rate: 0.7 });
    yield 0.5;
    this.setPose('attack');
    const placed = [];
    for (let i = 0; i < 5; i++) {
      let x = p.x, y = p.y;
      if (i > 0) { // near the player but never on top of another disc
        for (let k = 0; k < 8; k++) {
          const a = this.rng.float(0, TAU), d = this.rng.float(120, 340);
          const q = this.clampIn(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 90);
          x = q.x; y = q.y;
          if (placed.every((o) => Math.hypot(o.x - x, o.y - y) > 130)) break;
        }
      }
      placed.push({ x, y });
      this.pillar(x, y, 1.0);
      if (i < 4) yield 0.15;
    }
    yield 1.0;
    this.setPose('move');
    yield 0.4;
  }

  // ------------------------------------------------------------------------------------------ ash step
  *atkAshStep() {
    const s = this.scene, p = this.player, fx = s.fx;
    this.setPose('attack');
    this.pulse(0.6);
    Sfx.play('fire_whoosh', { rate: 1.2 });
    let dx = p.x - this.x, dy = p.y - this.y;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;
    const t = this.clampIn(p.x + dx * 300, p.y + dy * 300, 90); // behind the player, seen from the deacon
    fx.burst(this.x, this.y - 40, { color: [ASH, 0x6b5a48, FIRE], count: 20, speed: [40, 200], life: [400, 800], scale: [1.5, 3.5], gravity: -60 });
    this.invulnerable = true;
    this.contactDamage = 0;
    this.zone(t.x, t.y, 70, { tell: 0.7, dmg: 1, kind: 'ash_step', color: ASH, decal: false, burstColors: [ASH, 0x6b5a48], sfx: 'fire_whoosh' });
    let puff = 0;
    yield* this.hold(0.7, (e) => {
      const k = Math.max(0, 1 - e / 0.6);
      this.alphaOverride = k; // dissolve
      this.shadow.setAlpha(k);
      if (e >= 0.6) this.targetable = false;
      if (e >= puff) { puff += 0.12; fx.burst(t.x, t.y - 10, { color: [ASH, 0x6b5a48], count: 3, speed: [20, 90], life: [300, 600], scale: [1.5, 3], gravity: -30 }); }
    });
    this.x = t.x; this.y = t.y;
    this.alphaOverride = undefined;
    this.shadow.setAlpha(1);
    this.invulnerable = false;
    this.targetable = true;
    this.contactDamage = this.baseContact;
    fx.burst(t.x, t.y - 30, { color: [FIRE, 0xffd060, ASH], count: 22, speed: [80, 300], life: [300, 700], scale: [1.5, 3.5] });
    fx.shake(0.008, 200);
    this.setPose('windup');
    s.bullets.enemy.ring({ x: t.x, y: t.y - 10, speed: 260, life: 3, ...BULLET }, 8, this.rng.float(0, 360));
    Sfx.play('fire_whoosh', { vol: 0.9, rate: 0.9 });
    yield 0.7;
    this.setPose('move');
  }
  onCancel() { if (this.shadow) this.shadow.setAlpha(1); }

  // ------------------------------------------------------------------------------------------ phase 2
  enterPhase2() {
    this.pillarT = 4;
    this.scene.fx.flash(0xff7a1f, 0.25);
  }
  update(dt) {
    super.update(dt);
    if (this.p2 && this.active && !this.dying && this.sprite) {
      this.pillarT -= dt;
      if (this.pillarT <= 0) {
        this.pillarT = 6;
        this.wallPillar();
      }
    }
  }
  wallPillar() {
    const room = this.scene.room;
    const start = this.rng.int(0, PERIMETER.length - 1);
    for (let i = 0; i < PERIMETER.length; i++) {
      const [c, r] = PERIMETER[(start + i) % PERIMETER.length];
      const t = room && room.tiles[r] && room.tiles[r][c];
      if (t && !t.solid) { this.pillar(clamp(t.x, ROOM.x + 40, ROOM.right - 40), clamp(t.y, ROOM.y + 40, ROOM.bottom - 40), 1.0); return; }
    }
  }
}

registerBoss('ash_deacon', AshDeacon, { foot: 22 });
