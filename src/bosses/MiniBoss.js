// Mini-boss base class (champion rooms, EVENTS s4). A Boss whose art is a plain 6-frame enemy strip (`enemy_<id>`: 0-3 idle/move loop,
// 4 windup, 5 attack) instead of the two boss sheets, with a compact WANTED intro, a fixed phase change at 50 % HP and its own defeat event.
//   * hp is final (`noFloorScale`), heavy, never elite. Idle gap between attacks 1.4 s (1.0 s after the phase change).
//   * Phase 2 (< 50 %): roar 0.9 s, bullets cleared, then `enterPhase2()`.
//   * Death: `mini:defeated {id, flawless, time}` (NOT `boss:defeated`), then GameScene.onBossDefeated -> flow -> Room.onMiniDefeated.
// Subclass in src/bosses/types/<id>.js exactly like a boss: override `setup()` (addAttack / phases) and `enterPhase2()`.
import Boss from './Boss.js';
import Enemy from '../enemies/Enemy.js';
import { bus } from '../core/events.js';
import { Sfx } from '../core/Audio.js';

export default class MiniBoss extends Boss {
  constructor(scene, x, y, opts = {}) {
    const meta = { ...(opts.meta || {}), mini: true, noFloorScale: true, heavy: true };
    super(scene, x, y, { ...opts, meta });
    this.isMini = true;
    this.hitsTaken = 0; // damage events the player suffered during this fight (flawless = 0)
    this.fightTime = 0;
    this.offHurt = bus.scoped(scene, 'player:hurt', () => { if (this.active && !this.dying) this.hitsTaken++; });
    bus.emit('mini:spawned', { id: this.id });
  }

  // Boss forces `boss_<id>_idle`; minis use the enemy strip.
  get spriteKey() { return `enemy_${this.id}`; }
  set spriteKey(_) { /* fixed */ }

  /** Strip poses: 'move' loops 0-3, 'windup' = 4, 'attack' = 5. */
  setPose(p) { Enemy.prototype.setPose.call(this, p === 'idle' ? 'move' : p); }
  atkFrame(i) { this.setPose(i === 1 || i === 3 ? 'attack' : 'windup'); }

  /** Default kit (generic fan + ring) so a fresh mini is fightable; subclasses replace it. */
  setup(opts) {
    super.setup(opts);
    this.phases = [{ at: 0.5, name: 'phase2', enter: () => this.roar() }];
    this.idleT = 1.4;
  }

  attackDelay() { return this.phase > 0 ? 1.0 : 1.4; }

  /** Phase-change roar: shake, clear bullets, drop the running attack, pause, then the subclass hook. */
  roar() {
    const s = this.scene;
    s.bullets.enemy.clear();
    s.fx.shake(0.008, 500);
    Sfx.play('explosion', { vol: 0.5, rate: 0.6 });
    this.gen = null;
    this.wait = 0;
    this.idleT = 0.9 + 1.0; // roar 0.9 s, then the shorter phase-2 gap
    this.enterPhase2();
  }
  /** Subclass hook: what changes at 50 % HP (extra adds, chained attacks, faster patterns). */
  enterPhase2() { this.fireballScale = 1.25; }

  introData() {
    return { boss: this, name: this.name, title: this.title, portrait: null, mini: true, bounty: this.meta.bounty ?? 0, floor: this.floor };
  }

  update(dt) {
    if (this.active && !this.dying) this.fightTime += dt;
    super.update(dt);
  }

  /** Same as Boss.finishDeath but announces `mini:defeated`; the reward is Room.onMiniDefeated (via flow.js). */
  finishDeath() {
    const s = this.scene;
    if (!this.sprite || (this.homeRoom && (this.homeRoom.destroyed || s.room !== this.homeRoom))) { this.destroy(); return; }
    s.fx.explosion(this.x, this.y - 20, 150);
    s.fx.flash(0xffffff, 0.35);
    s.fx.shake(0.014, 350);
    s.fx.hitStop(110);
    Sfx.play('explosion', { vol: 0.9, rate: 0.85 });
    s.fx.burst(this.x, this.y - 30, { color: [0xe8dcc0, 0xc9b98f, 0x8a1c1c], count: 18, speed: [140, 420], life: [500, 1000], scale: [2, 3.2], gravity: 520 });
    s.fx.decal(this.x, this.y, 'blood', 2.0);
    this.alive = false;
    const info = { id: this.id, flawless: this.hitsTaken === 0, time: this.fightTime };
    const x = this.x, y = this.y;
    this.destroy();
    bus.emit('enemy:died', { enemy: this, x, y, cursed: false, boss: true, mini: true });
    bus.emit('mini:defeated', info);
    s.onBossDefeated(this);
  }

  destroy() {
    if (this.offHurt) { this.offHurt(); this.offHurt = null; }
    super.destroy();
  }
}
