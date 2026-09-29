// TUMBLEWEED (floor 1) + TUMBLEWEED_MINI: spiky rolling ball. Rolls in straight lines, bouncing off walls and obstacles
// (reflection with a small random deflection so it never gets stuck in a loop). Every ~3.5 s it stops and REARS (0.5 s: maw wide, shudder),
// then re-aims at the player and rolls off fast. On death the big one splits into 2 minis (5 HP, fast, no split). Contact damage only.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { spawnEnemy } from '../index.js';
import { Sfx } from '../../core/Audio.js';

class Tumbleweed extends Enemy {
  init() {
    this.mini = this.id === 'tumbleweed_mini';
    this.setState('roll');
    this.rollSp = this.speed;
    const a = this.angleToPlayer() + (Math.random() - 0.5) * 1.2;
    this.heading = a;
    this.revT = (this.mini ? 4 : 2.6) + Math.random() * 2;
    this.moveAngle(this.heading, this.rollSp);
  }

  ai(dt) {
    if (this.state === 'roll') {
      this.setPose('move');
      this.sprite.anims.timeScale = Math.max(0.5, Math.hypot(this.vx, this.vy) / 120);
      this.revT -= dt;
      if (Math.abs(this.vx) + Math.abs(this.vy) < 20) this.moveAngle(this.heading, this.rollSp); // safety: never stall
      this.dustT = (this.dustT || 0) - dt;
      if (this.dustT <= 0) { this.dustT = 0.18; this.scene.fx.dust(this.x, this.footY, this.mini ? 0.35 : 0.5); }
      if (this.revT <= 0 && !this.mini) this.rev();
    } else if (this.state === 'rev') {
      this.stop();
      this.jit = Math.sin(this.stateTime * 80) * 3;
    }
  }

  syncVisual() { super.syncVisual(); if (this.jit && this.sprite) this.sprite.x += this.jit; }

  rev() {
    this.setState('rev');
    this.stop();
    this.sprite.anims.timeScale = 1;
    Sfx.play('whip_crack', { vol: 0.4, rate: 0.7 });
    const a = this.angleToPlayer();
    this.warn = this.scene.fx.warnLine(this.x, this.y, this.x + Math.cos(a) * 420, this.y + Math.sin(a) * 420, 50, 0.5, 0xd8a030);
    this.telegraph(0.5, () => {
      this.jit = 0;
      this.heading = a;
      this.setState('roll');
      this.moveAngle(a, this.rollSp * 1.35);
      this.revT = 3 + Math.random() * 1.5;
      this.scene.fx.dust(this.x, this.footY, 1);
    });
  }

  onWallHit(nx, ny) {
    if (this.state !== 'roll') return;
    const dot = this.vx * nx + this.vy * ny;
    if (dot >= 0) return;
    let vx = this.vx - 2 * dot * nx, vy = this.vy - 2 * dot * ny;
    // small random deflection + avoid perfectly axis-aligned ping-pong
    const sp = Math.hypot(vx, vy) || 1, a = Math.atan2(vy, vx) + (Math.random() - 0.5) * 0.35;
    const cur = Math.min(sp, this.rollSp * 1.35);
    this.heading = a;
    this.vx = Math.cos(a) * Math.max(cur, this.rollSp); this.vy = Math.sin(a) * Math.max(cur, this.rollSp);
    Sfx.play('bullet_hit_wall', { vol: 0.25, detune: 400, gap: 0.15 });
    this.scene.fx.burst(this.x - nx * this.radius, this.y - 20, { color: [0xd8a848, 0xa87a30], count: 4, speed: [40, 130], life: [200, 350], scale: [1.2, 2] });
  }

  onDeath(info) {
    if (this.warn) this.warn.destroy();
    if (this.mini || (info && info.silent)) return; // silent removal (boss cleanup / room clear) must not spawn new minis behind the sweep
    const s = this.scene;
    Sfx.play('whip_crack', { vol: 0.5, rate: 1.2 });
    const base = Math.random() * 6.28;
    for (let i = 0; i < 2; i++) {
      const a = base + i * Math.PI;
      const m = spawnEnemy(s, 'tumbleweed_mini', this.x + Math.cos(a) * 22, this.y + Math.sin(a) * 22, { floor: this.floor, instant: true, cursed: false });
      m.heading = a; m.moveAngle(a, m.rollSp);
      m.knock.x = Math.cos(a) * 240; m.knock.y = Math.sin(a) * 240;
    }
    s.fx.burst(this.x, this.y - 30, { color: [0xd8a848, 0xa87a30, 0xe8c878], count: 12, speed: [80, 260], life: [300, 600], scale: [1.5, 3] });
  }
}

registerEnemy('tumbleweed', Tumbleweed, { hp: 10, r: 30, speed: 190, floors: [1], weight: 2, knockback: 60, fps: 10, flip: false });
registerEnemy('tumbleweed_mini', Tumbleweed, { hp: 5, r: 18, speed: 250, floors: [], weight: 0, knockback: 90, fps: 12, flip: false });
