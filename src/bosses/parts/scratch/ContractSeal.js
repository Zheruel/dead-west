// `contract_seal` (CHAPTER2 boss 6, P3): a red wax seal with a gold sigil that orbits Ol' Scratch at r 150, 90 deg/s. Fixed HP (60 the first time,
// 45 when the seals return), shootable, no contact damage; every 1.6 s it fires one slow aimed `ember` (speed 200). Art is code-drawn
// (`scratch_seal`). When all three are destroyed the boss tears the contract (see scratch.js). Owned by the boss: never spawned by rooms.
import Enemy from '../../../enemies/Enemy.js';
import { Sfx } from '../../../core/Audio.js';
import { ROOM } from '../../../config.js';
import { ensureScratchTextures } from './zones.js';

export const SEAL = { r: 150, deg: 90, every: 1.6, speed: 200, hp: 60, hpBack: 45, flash: 0.35 };
const RAD = Math.PI / 180;

export class ContractSeal extends Enemy {
  /** opts: { boss, index, count, hp } */
  constructor(scene, x, y, opts = {}) {
    ensureScratchTextures(scene);
    super(scene, x, y, { instant: true, ...opts, id: 'contract_seal', spriteKey: 'scratch_seal', noLoot: true, meta: { hp: opts.hp ?? SEAL.hp, r: 26, hitR: 36, speed: 0, air: 46, foot: 0, noFloorScale: true, spawnTime: 0.3, contactDamage: 0, flip: false } });
  }

  init(opts) {
    this.boss = opts.boss;
    this.idx = opts.index ?? 0;
    this.ang = ((opts.index ?? 0) / (opts.count ?? 3)) * Math.PI * 2 - Math.PI / 2;
    this.maxHp = this.hp = opts.hp ?? SEAL.hp; // fixed: no floor / difficulty scaling
    this.contactDamage = 0;
    this.noClear = true;
    this.fireT = 0.6 + this.idx * 0.5; // staggered first shots
    this.spin = 0;
    this.baseScale = 0.62;
    this.sprite.setScale(this.baseScale);
    this.hitRadius = 36;
    this.place();
  }

  // scripted position: never resolved against walls / obstacles; no fear / stun / freeze
  moveBy() { this.hit = false; }
  applyStatus(name, o) { if (name === 'fear' || name === 'stun' || name === 'frozen' || name === 'chill') return; super.applyStatus(name, o); }
  setPose() {}
  refreshTint() { if (this.sprite) { if (this.flashT > 0) this.sprite.setTint(0xffffff); else this.sprite.clearTint(); } }

  place() {
    const b = this.boss;
    if (!b) return;
    this.x = Math.max(ROOM.x + 30, Math.min(ROOM.right - 30, b.x + Math.cos(this.ang) * SEAL.r));
    this.y = Math.max(ROOM.y + 30, Math.min(ROOM.bottom - 30, b.y + 20 + Math.sin(this.ang) * SEAL.r));
  }

  ai(dt) {
    const b = this.boss;
    if (!b || !b.alive || b.dying) return;
    this.ang += SEAL.deg * RAD * dt;
    this.place();
    this.spin += dt;
    const k = this.fireT < SEAL.flash ? 1 - this.fireT / SEAL.flash : 0; // pulse in the last 0.35 s before a shot
    this.sprite.setRotation(Math.sin(this.spin * 2 + this.idx) * 0.12);
    this.sprite.setScale(this.baseScale * (1 + 0.28 * k));
    this.airHeight = 46 + Math.sin(this.spin * 3 + this.idx * 2) * 4;
    this.fireT -= dt;
    if (this.fireT <= 0) { this.fireT += SEAL.every; this.shoot1(); }
  }

  shoot1() {
    const p = this.player, s = this.scene;
    if (!p || p.dead) return;
    s.bullets.enemy.fire({ x: this.x, y: this.y, angle: Math.atan2(p.y - this.y, p.x - this.x), speed: SEAL.speed, damage: 1, kind: 'ember', radius: 14, tint: 0xff5a4a, life: 4, owner: this });
    Sfx.play('fire_whoosh', { vol: 0.4, rate: 1.3, gap: 0.1 });
    s.fx.burst(this.x, this.y - 30, { color: [0xff5a4a, 0xd4a537], count: 4, speed: [40, 140], life: [200, 380], scale: [1.2, 2.2], blend: 'ADD' });
  }

  /** Seals never bleed, drop, count as kills or emit `enemy:died`: a small wax burst, then the boss is told. */
  die() {
    if (!this.alive) return;
    this.alive = false;
    const s = this.scene, fx = s.fx;
    fx.burst(this.x, this.y - 40, { color: [0xd63a2a, 0x8a1c1c, 0xd4a537], count: 16, speed: [80, 320], life: [300, 700], scale: [1.5, 3], gravity: 300 });
    fx.ringPulse(this.x, this.y - 40, 0xd4a537, 50, 360, 0.8);
    fx.hitStop(30);
    Sfx.play('glass_break', { vol: 0.6, rate: 1.4, gap: 0.05 });
    const boss = this.boss;
    this.destroy();
    if (boss && boss.sealDown) boss.sealDown(this);
  }
}

export default ContractSeal;
