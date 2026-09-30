// Boss base class (extends Enemy). Subclass in src/bosses/types/<id>.js and call registerBoss(id, Class, meta).
//
// Attacks are generator functions on the subclass, registered in init():
//     this.addAttack('fan', this.atkFan, { weight: 3, minPhase: 0 });
//     *atkFan() { this.setPose('windup'); yield 0.7; this.setPose('attack'); ...fire...; yield 0.5; }
//   `yield <seconds>` waits (respects slow-mo/stun-free boss time); `yield () => cond` waits until cond() is true.
// Phases: this.phases = [{ at: 0.5, name:'enrage', enter() {...} }] -> triggered when hp/maxHp <= at.
// Poses: 'move' (= idle loop), 'windup' (atk frame 0), 'attack' (atk frame 1); atkFrame(i) picks any of the 4 atk frames.
// `formKey` (default = id) picks the sheet pair `boss_<formKey>_idle/_atk` (Scratch swaps human -> true form). Attack picks use a seeded stream (`_brng`).
// Death: `boss:defeated {boss, id, floor, fightTime, noHit}` (fight clock and hit counter are tracked here: `_fT`, `_hurts`).
import Enemy from '../enemies/Enemy.js';
import { spawnEnemy } from '../enemies/index.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';
import { Save } from '../core/Save.js';
import { bus } from '../core/events.js';
import { subRng } from '../core/rng.js';
import { ROOM } from '../config.js';

const PHASE_GAP = 1.6;

export default class Boss extends Enemy {
  constructor(scene, x, y, opts = {}) {
    const meta = { noFloorScale: true, heavy: true, spawnTime: 0.01, flip: false, ...(opts.meta || {}) };
    super(scene, x, y, { ...opts, meta, spriteKey: `boss_${opts.id}_idle` });
    this.isBoss = true;
    this.homeRoom = scene.room; // the room this boss lives in (guards delayed death callbacks after a debug jump)
    this._fT = 0; // seconds of active fight (boss:defeated fightTime)
    this._hurts = 0; // hits the player took during the fight (boss:defeated noHit)
    this._phaseGap = 0; // spacing between two phase entries when one hit crossed several thresholds
    this._offHurt = bus.scoped(scene, 'player:hurt', () => { if (this.active && !this.dying) this._hurts++; });
  }

  /** Seeded stream for attack picks / delay jitter (never Math.random: fights are reproducible per seed). */
  get brng() { return this._brng || (this._brng = subRng('bossai', this.id, this.floor)); }

  init(opts) {
    this.name = this.meta.name || this.id.toUpperCase();
    this.title = this.meta.title || '';
    this.phase = 0;
    this.phases = []; // [{at, name, enter}]
    this.attacks = [];
    this.gen = null;
    this.wait = 0;
    this.idleT = 1.2;
    this.active = false; // set true when the intro card ends
    this.invulnerable = true;
    this.contactDamage = this.meta.contactDamage ?? 1;
    this.lastAttack = null;
    this.dying = false;
    this.bobT = 0;
    this.setState('intro');
    this.setup(opts);
  }

  /** Subclass hook: register attacks & phases here. */
  setup(opts) {
    // default generic behaviour so unimplemented bosses are still fightable
    this.addAttack('fan', this.atkFan, { weight: 3 });
    this.addAttack('ring', this.atkRing, { weight: 2 });
    this.phases = [{ at: 0.5, name: 'enrage', enter: () => { this.fireballScale = 1.4; } }];
  }

  addAttack(name, fn, o = {}) { this.attacks.push({ name, fn, weight: o.weight ?? 1, minPhase: o.minPhase ?? 0, maxPhase: o.maxPhase ?? 99 }); }
  attackDelay() { return [1.5, 1.1, 0.8, 0.6][Math.min(3, this.phase)]; }

  // ------------------------------------------------------------------------------------------ poses
  setPose(p) {
    if (this.pose === p || !this.sprite) return;
    this.pose = p;
    if (p === 'move' || p === 'idle') {
      const key = Assets.ensureAnim(this.scene, `boss_${this.formKey ?? this.id}_idle`, { start: 0, end: 3, fps: 6, name: 'idle' });
      this.sprite.play(key, true);
    } else this.atkFrame(p === 'windup' ? 0 : p === 'attack' ? 1 : 2);
  }
  atkFrame(i) {
    this.pose = `atk${i}`;
    this.sprite.anims.stop();
    const k = `boss_${this.formKey ?? this.id}_atk`;
    Assets.tex(this.scene, k);
    this.sprite.setTexture(k, i);
  }

  // ------------------------------------------------------------------------------------------ intro / lifecycle
  introData() { return { boss: this, name: this.name, title: this.title, portrait: this.meta.portrait || `portrait_${this.id}` }; }
  startFight() {
    this.active = true;
    this.invulnerable = false;
    this.setState('fight');
    bus.emit('boss:spawned', { boss: this, name: this.name, hp: this.hp, maxHp: this.maxHp });
    bus.emit('boss:hp', { hp: this.hp, maxHp: this.maxHp, boss: this });
  }

  onHit(dmg) {
    bus.emit('boss:hp', { hp: Math.max(0, this.hp), maxHp: this.maxHp, boss: this });
    this.advancePhase();
  }

  /**
   * Enter the next phase when hp crossed its threshold. One phase per call: a single hit that crosses two thresholds (debug hp jump) queues the
   * second one `PHASE_GAP` s later (ai() retries), so the second roar never replaces the first one's summons.
   */
  advancePhase() {
    if (this.dying || this.hp <= 0 || this.phase >= this.phases.length || this._phaseGap > 0) return;
    const ph = this.phases[this.phase];
    if (this.hp / this.maxHp > ph.at) return;
    this.phase++;
    this._phaseGap = PHASE_GAP;
    bus.emit('boss:phase', { phase: this.phase, boss: this });
    this.scene.fx.shake(0.01, 300);
    if (ph.enter) ph.enter.call(this);
  }

  // ------------------------------------------------------------------------------------------ AI scheduler
  ai(dt) {
    if (!this.active || this.dying) { this.stop(); this.idleBob(dt); return; }
    this._fT += dt;
    if (this._phaseGap > 0) { this._phaseGap -= dt; if (this._phaseGap <= 0) this.advancePhase(); }
    this.idleBob(dt);
    if (this.gen) {
      if (typeof this.wait === 'function') { if (!this.wait()) return; this.wait = 0; }
      else if (this.wait > 0) { this.wait -= dt; return; }
      let r;
      try { r = this.gen.next(); } catch (e) { console.error('[Boss attack]', e); this.gen = null; this.idleT = 1; return; }
      if (r.done) { this.gen = null; this.idleT = this.attackDelay(); this.setPose('move'); } else this.wait = r.value ?? 0;
      return;
    }
    this.idleT -= dt;
    this.moveBehaviour(dt);
    if (this.idleT <= 0) this.startAttack();
  }
  /** Subclass hook: movement between attacks (default: stationary). */
  moveBehaviour(dt) { this.stop(); }
  idleBob(dt) {
    this.bobT += dt;
    if (this.meta.speed === 0 || this.meta.bob) this.sprite.setScale(this.baseScale * (1 + Math.sin(this.bobT * 2) * 0.01), this.baseScale * (1 + Math.sin(this.bobT * 2 + 1) * 0.015));
  }

  startAttack() {
    const cands = this.attacks.filter((a) => a.minPhase <= this.phase && a.maxPhase >= this.phase);
    if (!cands.length) { this.idleT = 1; return; }
    let pool = cands.filter((a) => a.name !== this.lastAttack);
    if (!pool.length) pool = cands;
    const total = pool.reduce((s, a) => s + a.weight, 0);
    let r = this.brng.next() * total;
    let pick = pool[0];
    for (const a of pool) { r -= a.weight; if (r <= 0) { pick = a; break; } }
    this.lastAttack = pick.name;
    this.gen = pick.fn.call(this);
    this.wait = 0;
  }

  // ------------------------------------------------------------------------------------------ default attacks (generic)
  *atkFan() {
    this.setPose('windup'); this.pulse(0.7);
    yield 0.7;
    this.setPose('attack');
    const a = this.angleToPlayer();
    this.scene.bullets.enemy.fan({ x: this.x, y: this.y - 20, speed: 320 * (this.fireballScale || 1), damage: 1, kind: 'enemy' }, 5, 50, a);
    Sfx.play('snake_hiss', { vol: 0.8 });
    yield 0.5;
  }
  *atkRing() {
    this.atkFrame(2); this.pulse(0.8);
    this.scene.fx.shake(0.004, 800);
    yield 0.8;
    this.setPose('attack');
    this.scene.bullets.enemy.ring({ x: this.x, y: this.y - 20, speed: 240, damage: 1, kind: 'enemy' }, 12);
    yield 0.6;
  }

  // ------------------------------------------------------------------------------------------ helpers
  /** Spawn `n` enemies of `id` around the boss (instant spawn-in, with puff). */
  spawnAdds(id, n, { radius = 180, opts = {} } = {}) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.brng.next();
      let x = this.x + Math.cos(a) * radius, y = this.y + Math.sin(a) * radius * 0.7;
      x = Math.max(ROOM.x + 60, Math.min(ROOM.right - 60, x));
      y = Math.max(ROOM.y + 60, Math.min(ROOM.bottom - 60, y));
      this.scene.fx.spawn(x, y);
      const e = spawnEnemy(this.scene, id, x, y, { instant: true, floor: this.floor, ...opts });
      out.push(e);
    }
    return out;
  }

  // ------------------------------------------------------------------------------------------ death
  die(info = {}) {
    if (!this.alive || this.dying) return;
    this.dying = true;
    this.invulnerable = true;
    this.active = false;
    this.gen = null;
    this.contactDamage = 0;
    const s = this.scene;
    const i = s.enemies.indexOf(this);
    if (i >= 0) s.enemies.splice(i, 1); // stop being a target
    s.bullets.enemy.clear();
    for (const e of [...s.enemies]) if (e.alive) e.die({ silent: true });
    bus.emit('boss:hp', { hp: 0, maxHp: this.maxHp, boss: this });
    Sfx.play('boss_die');
    s.slowMo(0.25, 1.6);
    s.fx.hitStop(120);
    // chain of explosions across the body
    let n = 0;
    const ev = s.time.addEvent({
      delay: 140, repeat: 10,
      callback: () => {
        if (!this.sprite) return;
        n++;
        const ox = (Math.random() - 0.5) * this.radius * 1.6, oy = (Math.random() - 0.7) * this.radius * 1.6;
        s.fx.explosion(this.x + ox, this.y + oy, 70 + Math.random() * 40);
        s.fx.shake(0.012, 200);
        if (n % 2 === 0) Sfx.play('explosion', { vol: 0.5, rate: 0.85 + Math.random() * 0.3 });
        this.sprite.setTint(n % 2 ? 0xffffff : 0xff6a4a);
      },
    });
    s.time.delayedCall(1700, () => this.finishDeath(info));
  }

  finishDeath() {
    const s = this.scene;
    if (!this.sprite || (this.homeRoom && (this.homeRoom.destroyed || s.room !== this.homeRoom))) { this.destroy(); return; } // room was left/torn down mid-death
    s.fx.explosion(this.x, this.y - 20, 200);
    s.fx.flash(0xffffff, 0.5);
    s.fx.shake(0.02, 500);
    s.fx.hitStop(140);
    Sfx.play('explosion', { vol: 1, rate: 0.75 });
    s.fx.burst(this.x, this.y - 30, { color: [0xe8dcc0, 0xc9b98f, 0x8a1c1c], count: 26, speed: [160, 520], life: [600, 1200], scale: [2, 3.6], gravity: 520 });
    s.fx.decal(this.x, this.y, 'blood', 2.4);
    this.alive = false;
    this.destroy();
    bus.emit('enemy:died', { enemy: this, x: this.x, y: this.y, cursed: false, boss: true });
    bus.emit('boss:defeated', { boss: this, id: this.id, floor: this.floor, fightTime: this._fT, noHit: this._hurts === 0 });
    if (s.run) s.run.bossesKilled++;
    s.onBossDefeated(this);
  }

  destroy() {
    if (this._offHurt) { this._offHurt(); this._offHurt = null; }
    super.destroy();
  }
}
