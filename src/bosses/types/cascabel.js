// BOSS 1 - EL CASCABEL (colossal demonic rattlesnake, HP 260). Sprites: boss_cascabel_idle / _atk (0 windup, 1 spit, 2 rattle, 3 dive).
// Stationary coil in the room's back-centre (drifts slowly back "home" after a dive). Three telegraphed attacks:
//  * venomFan   - rears back (0.75 s, hiss + tint pulse, green aim line for the last 0.25 s), spits a 5-shot aimed fan. P2: 7 shots, faster, 2 volleys.
//  * rattleRing - tail shakes 0.9 s (rattle sound, screen tremble, warning disc), then a 12-bullet ring expands. P2: second ring offset 15 deg.
//  * burrowDive - dives (dirt burst), invulnerable; a shadow/mound chases the player, then LOCKS onto the spot (red floor disc, 0.9 s),
//                 pops up there (radius-150 dirt burst = 1 dmg + shove) and sits stunned/vulnerable ~1 s. P2: two dives in a row.
// Phase 2 (<50% HP): roar, clears bullets, spawns 3 baby rattlesnakes, shorter delays, faster/wider patterns.
// Death (Boss base = slow-mo + blasts, reward/trapdoor via Room.onBossDefeated): writhes between poses and bursts into bones.
import Boss from '../Boss.js';
import { registerBoss } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { ROOM } from '../../config.js';

const TOP_Y = 356; // min ground y: the 320 px sprite's horns would otherwise slide under the HUD strip
const MARGIN = 145; // boss centre stays this far from the walls (keeps the player from being pinned inside the body)
const BONES = [0xe8dcc0, 0xc9b98f, 0x8a7a55];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class Cascabel extends Boss {
  setup() {
    this.addAttack('venomFan', this.atkVenomFan, { weight: 3 });
    this.addAttack('rattleRing', this.atkRattleRing, { weight: 2 });
    this.addAttack('burrowDive', this.atkBurrowDive, { weight: 2 });
    this.phases = [{ at: 0.5, name: 'babies', enter() { this.enterPhase2(); } }];
    this.burrow = null; // {mode:'track'|'lock', tx, ty, t, sfxT, dustT} while underground
    this.homeX = this.x; this.homeY = this.y;
    this.baseShadow = this.shadowScale;
    this.idleT = 1.6;
  }

  get p2() { return this.phase >= 1; }
  attackDelay() { return this.p2 ? 0.8 : 1.5; }

  startFight() {
    super.startFight();
    Sfx.play('snake_rattle', { vol: 0.7 });
  }

  // ------------------------------------------------------------------------------------------ movement / update
  ai(dt) {
    if (this.burrow) this.updateBurrow(dt);
    super.ai(dt);
  }
  startAttack() { this.stop(); super.startAttack(); } // no drifting while an attack runs
  /** Between attacks: slither back towards the home coil (slow), otherwise sway in place. */
  moveBehaviour(dt) {
    const dx = this.homeX - this.x, dy = this.homeY - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 40 && this.contactDamage > 0) this.moveToward(this.homeX, this.homeY, 70); else this.stop();
  }
  hurt(dmg, info = {}) {
    if (this.invulnerable && info.dot) return; // poison/burn must not tick through the intro or a dive
    super.hurt(dmg, info);
  }
  faceTarget() { this.sprite.setFlipX(this.player.x < this.x); }
  /** Mouth position on the ground plane (bullets get a visual lift). */
  mouth(a) { return { x: this.x + Math.cos(a) * 70, y: this.y - 35 + Math.sin(a) * 30 }; }
  ground(o = {}) { return { damage: 1, kind: 'venom', lift: 50, ...o }; }

  // ------------------------------------------------------------------------------------------ (a) venom fan
  *atkVenomFan() {
    const p2 = this.p2;
    const B = this.scene.bullets.enemy;
    const volleys = p2 ? 2 : 1;
    for (let v = 0; v < volleys; v++) {
      this.faceTarget(); this.setPose('windup');
      const wind = p2 ? 0.6 : 0.75;
      this.pulse(wind);
      Sfx.play('snake_hiss', { rate: p2 ? 1.1 : 1 });
      yield wind - 0.28;
      // lock the aim 0.28 s before firing and show it
      const a = this.angleToPlayer();
      const m = this.mouth(a);
      this.scene.fx.warnLine(m.x, m.y, m.x + Math.cos(a) * 520, m.y + Math.sin(a) * 520, 34, 0.28, 0x8fc23f);
      this.faceTarget();
      yield 0.28;
      this.setPose('attack');
      const n = p2 ? 7 : 5;
      B.fan({ x: m.x, y: m.y, ...this.ground({ speed: p2 ? 340 : 300, radius: 13 }) }, n, p2 ? 66 : 50, a);
      this.scene.fx.shake(0.005, 120);
      this.scene.fx.burst(m.x, m.y - 50, { color: [0x8fc23f, 0xc7f06a], count: 10, speed: [60, 220], life: [200, 400], scale: [1.5, 3], gravity: 200 });
      Sfx.play('snake_hiss', { vol: 0.9, rate: 1.35 });
      yield p2 ? 0.4 : 0.55;
    }
    this.sprite.setFlipX(false);
    yield 0.2;
  }

  // ------------------------------------------------------------------------------------------ (b) rattle shockwave
  *atkRattleRing() {
    const p2 = this.p2;
    const B = this.scene.bullets.enemy;
    const fx = this.scene.fx;
    this.sprite.setFlipX(false);
    this.atkFrame(2);
    const wind = p2 ? 0.7 : 0.9;
    this.pulse(wind);
    Sfx.play('snake_rattle', { rate: p2 ? 1.1 : 1 });
    fx.warnCircle(this.x, this.y, 300, wind, 0xd8b04a);
    fx.shake(0.004, wind * 1000);
    yield wind;
    const ring = (off) => {
      B.ring({ x: this.x, y: this.y - 20, ...this.ground({ kind: 'enemy', speed: p2 ? 260 : 240, lift: 30 }) }, 12, off);
      fx.shake(0.008, 180);
      fx.dust(this.x, this.y + 20, 1.6);
      Sfx.play('snake_hiss', { vol: 0.8, rate: 0.8 });
    };
    this.setPose('attack');
    ring(0);
    if (p2) {
      yield 0.5;
      this.atkFrame(2);
      ring(15);
    }
    yield 0.6;
  }

  // ------------------------------------------------------------------------------------------ (c) burrow dive
  *atkBurrowDive() {
    const p2 = this.p2;
    const fx = this.scene.fx;
    const dives = p2 ? 2 : 1;
    for (let i = 0; i < dives; i++) {
      // dive down
      this.sprite.setFlipX(false);
      this.atkFrame(3); this.pulse(0.4);
      Sfx.play('dig', { rate: 0.8 });
      fx.dust(this.x, this.y + 30, 2.2);
      fx.burst(this.x, this.y + 20, { color: [0x8a6a44, 0x6b4423, 0xb08a55], count: 22, speed: [100, 340], life: [300, 650], scale: [1.5, 3.5], gravity: 500, angle: [200, 340] });
      fx.shake(0.008, 300);
      this.contactDamage = 0;
      yield 0.45;
      this.goUnderground();
      // chase the player under the floor, then lock on
      this.burrow = { mode: 'track', tx: 0, ty: 0, t: 0, sfxT: 0, dustT: 0 };
      yield p2 ? 0.85 : 1.25;
      const tx = clamp(this.player.x, ROOM.x + MARGIN, ROOM.right - MARGIN), ty = clamp(this.player.y, TOP_Y, ROOM.bottom - MARGIN);
      this.burrow.mode = 'lock'; this.burrow.tx = tx; this.burrow.ty = ty; this.burrow.t = 0.9;
      fx.warnCircle(tx, ty, 150, 0.9, 0xd63a2a);
      Sfx.play('snake_rattle', { vol: 0.6, rate: 1.3 });
      yield 0.9;
      // pop up
      this.x = tx; this.y = ty;
      this.surface();
      this.atkFrame(3);
      this.popBurst(tx, ty);
      yield 0.4;
      this.setPose('move');
      this.contactDamage = this.meta.contactDamage ?? 1;
      yield i < dives - 1 ? 0.35 : (p2 ? 0.9 : 1.2); // stunned + vulnerable
    }
    this.sprite.setFlipX(false);
  }

  goUnderground() {
    this.invulnerable = true;
    this.flying = true; // slides under rocks
    this.alphaOverride = 0;
    this.shadowScale = this.baseShadow * 0.5;
    this.stop();
  }
  surface() {
    this.burrow = null;
    if (!this.sprite) return;
    this.invulnerable = false;
    this.flying = false;
    this.alphaOverride = undefined;
    this.shadowScale = this.baseShadow;
    this.sprite.setAlpha(1);
  }
  updateBurrow(dt) {
    const b = this.burrow;
    if (!b || !this.sprite) return;
    const p = this.player;
    if (b.mode === 'track') {
      const a = Math.atan2(p.y - this.y, p.x - this.x), d = Math.hypot(p.x - this.x, p.y - this.y);
      const sp = Math.min(d / dt, 400);
      this.x += Math.cos(a) * sp * dt; this.y += Math.sin(a) * sp * dt;
    } else {
      b.t -= dt;
      const k = Math.min(1, dt / Math.max(0.05, b.t));
      this.x += (b.tx - this.x) * k; this.y += (b.ty - this.y) * k;
    }
    this.x = clamp(this.x, ROOM.x + MARGIN, ROOM.right - MARGIN);
    this.y = clamp(this.y, TOP_Y, ROOM.bottom - MARGIN);
    b.dustT -= dt; b.sfxT -= dt;
    if (b.dustT <= 0) { b.dustT = 0.1; this.scene.fx.burst(this.x, this.y + 40, { color: [0x8a6a44, 0xb08a55], count: 3, speed: [20, 90], life: [250, 450], scale: [1.5, 3], gravity: 200, angle: [220, 320] }); }
    if (b.sfxT <= 0) { b.sfxT = 0.35; Sfx.play('dig', { vol: 0.5, rate: 0.9 + Math.random() * 0.3 }); }
  }
  /** Pop-up impact: dirt burst, 1 dmg + shove if the player is in the marked disc, never leave the player inside the body. */
  popBurst(tx, ty) {
    const s = this.scene, fx = s.fx, p = this.player;
    fx.hitStop(70);
    fx.shake(0.016, 380);
    fx.dust(tx, ty + 30, 3);
    fx.burst(tx, ty + 10, { color: [0x8a6a44, 0x6b4423, 0xb08a55, 0xe8dcc0], count: 40, speed: [160, 520], life: [400, 800], scale: [1.5, 4], gravity: 600, angle: [200, 340] });
    fx.decal(tx, ty + 20, 'scorch', 1);
    Sfx.play('explosion', { vol: 0.55, rate: 1.1 });
    Sfx.play('dig', { vol: 1, rate: 0.7 });
    const d = Math.hypot(p.x - tx, p.y - ty);
    if (d < 156) p.damage(1, { x: tx, y: ty, enemy: this, enemyName: this.id, kind: 'dive' });
    const body = this.radius * 0.85 + p.hurtRadius + 14;
    if (d < body) { // shove out of the body
      const a = d > 1 ? Math.atan2(p.y - ty, p.x - tx) : Math.random() * Math.PI * 2;
      p.x = tx + Math.cos(a) * body; p.y = ty + Math.sin(a) * body;
      if (s.room) s.room.resolve(p);
    }
  }

  // ------------------------------------------------------------------------------------------ phase 2
  cancelAttack() {
    this.stop();
    if (this.gen) { try { this.gen.return(); } catch (e) { /* */ } this.gen = null; }
    this.surface();
    this.contactDamage = this.meta.contactDamage ?? 1;
    this.wait = 0;
  }
  enterPhase2() {
    this.cancelAttack();
    this.gen = this.phaseRoar();
  }
  *phaseRoar() {
    const s = this.scene, fx = s.fx;
    s.bullets.enemy.clear();
    this.sprite.setFlipX(false);
    this.atkFrame(0); this.pulse(1.0);
    Sfx.play('snake_hiss', { vol: 1, rate: 0.75 });
    fx.shake(0.012, 900);
    fx.flash(0x8fc23f, 0.25);
    yield 0.55;
    this.atkFrame(2);
    Sfx.play('snake_rattle', { vol: 1 });
    fx.warnCircle(this.x, this.y, 280, 0.6, 0x8fc23f);
    yield 0.6;
    this.setPose('attack');
    fx.dust(this.x, this.y + 20, 2.4);
    fx.shake(0.01, 300);
    Sfx.play('boss_intro_2', { vol: 0.6, rate: 1.2 });
    this.spawnAdds('rattlesnake', 3, { radius: 250 });
    yield 0.8;
  }

  // ------------------------------------------------------------------------------------------ death
  die(info = {}) {
    if (!this.alive || this.dying) return;
    this.surface();
    super.die(info);
    if (!this.sprite) return;
    const s = this.scene;
    Sfx.play('snake_hiss', { vol: 1, rate: 0.6 });
    Sfx.play('snake_rattle', { vol: 0.9 });
    this.sprite.setFlipX(false);
    let n = 0;
    const bx = this.x, by = this.y;
    // writhe: thrash between poses, wobble, spit bones
    this.writhe = s.time.addEvent({
      delay: 70, repeat: 24,
      callback: () => {
        if (!this.sprite) return;
        n++;
        this.atkFrame([2, 0, 1, 3][n % 4]);
        this.sprite.setAngle(Math.sin(n * 1.7) * 6);
        this.sprite.setScale(1 + Math.sin(n * 2.3) * 0.04, 1 + Math.cos(n * 1.9) * 0.05);
        this.sprite.setFlipX(n % 3 === 0);
        if (n % 3 === 0) s.fx.burst(bx + (Math.random() - 0.5) * 120, by - 30 - Math.random() * 90, { color: BONES, count: 8, speed: [120, 380], life: [400, 900], scale: [2, 4], gravity: 700, angle: [200, 340] });
        if (n % 5 === 0) Sfx.play('snake_rattle', { vol: 0.5, rate: 0.9 + Math.random() * 0.4 });
      },
    });
  }
  finishDeath(info) {
    if (this.writhe) { this.writhe.remove(); this.writhe = null; }
    if (this.sprite) {
      const s = this.scene;
      for (let i = 0; i < 3; i++) s.fx.burst(this.x, this.y - 60, { color: BONES, count: 26, speed: [160, 640], life: [500, 1200], scale: [2.5, 5], gravity: 800, angle: [180, 360] });
      s.fx.shake(0.02, 500);
      s.fx.decal(this.x, this.y + 20, 'blood', 2.6);
    }
    super.finishDeath(info);
  }
}

registerBoss('cascabel', Cascabel, { hp: 260, r: 105, name: 'EL CASCABEL', title: 'The Rattle Before The Bite' });
