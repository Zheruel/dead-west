// MOLE (floor 3): surfaced it scurries at the player (contact 1). Then it dives (frame 4 mound, 0.35 s, still hittable) and travels
// UNDERGROUND: invulnerable, untargetable, sprite hidden, only a dirt mound + flying dirt shows. The mound homes on the player, then
// locks the player's position: warn ring (0.85 s) while the mound slides to it -> erupts (1 dmg dirt burst inside the ring) and the
// mole is STUNNED for 1 s (vulnerable, yellow tint, contact damage off). Then it scurries again and repeats.
import Phaser from 'phaser';
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { ROOM, DEPTH } from '../../config.js';
import { darkWarn, shockRing, WARN_DIRT } from '../f3fx.js';

const DIRT = [0x8a6238, 0x5a3d22, 0xb8843f];
const POP_R = 108; // eruption damage radius
const LOCK_T = 0.85; // eruption telegraph
const STUN = 1.0;

class Mole extends Enemy {
  init() {
    this.setState('surface');
    this.timer = 0.9 + Math.random() * 0.9;
    this.baseContact = this.contactDamage;
    this.mound = null; this.moundTop = null;
    this.warn = null;
    this.target = null;
    this.trailT = 0;
    this.bob = 0;
  }

  // ------------------------------------------------------------------------------------------ AI
  ai(dt) {
    const p = this.player;
    switch (this.state) {
      case 'surface': {
        this.setPose('move');
        this.steerToward(p.x, p.y, 100);
        this.faceToward(p.x);
        this.timer -= dt;
        if (this.timer <= 0) this.startDive();
        break;
      }
      case 'dive': this.stop(); break; // waiting on timer
      case 'under': {
        this.moveToward(p.x, p.y, 250);
        this.trailDirt(dt);
        this.timer -= dt;
        if (this.timer <= 0) this.lockTarget();
        break;
      }
      case 'lock': {
        // mound slides onto the ring centre and shivers
        const d = Math.hypot(this.target.x - this.x, this.target.y - this.y);
        if (d > 8) this.moveToward(this.target.x, this.target.y, Math.min(520, d / 0.12)); else { this.x = this.target.x; this.y = this.target.y; this.stop(); }
        this.trailDirt(dt, 0.05);
        break;
      }
      case 'stun': { // ai only runs once the stun status has expired
        this.contactDamage = this.baseContact;
        this.setPose('move');
        this.setState('surface');
        this.timer = 1.1 + Math.random() * 0.9;
        break;
      }
      default: break;
    }
  }

  startDive() {
    this.setState('dive');
    this.stop();
    this.setPose('windup');
    Sfx.play('dig', { vol: 0.8, rate: 1.0 + Math.random() * 0.2 });
    this.scene.fx.burst(this.x, this.y + 6, { color: DIRT, count: 10, speed: [60, 200], life: [250, 500], scale: [1.5, 3], gravity: 300, angle: [200, 340] });
    this.after(0.35, () => this.goUnder());
  }

  goUnder() {
    if (!this.alive) return;
    this.setState('under');
    this.invulnerable = true;
    this.targetable = false;
    this.contactDamage = 0;
    this.flying = true; // moves through obstacles/pits while burrowed
    this.alphaOverride = 0;
    this.sprite.setAlpha(0);
    this.shadow.setVisible(false);
    this.timer = 1.1 + Math.random() * 0.5;
    const s = this.scene;
    this.mound = s.add.image(this.x, this.y, 'disc').setTint(0x4a3220).setDepth(DEPTH.shadows + 4).setDisplaySize(84, 40);
    this.moundTop = s.add.image(this.x, this.y - 8, 'disc').setTint(0x9a7040).setDepth(DEPTH.shadows + 5).setDisplaySize(58, 28);
    s.fx._track(this.mound); s.fx._track(this.moundTop);
    Sfx.play('dig', { vol: 0.5, rate: 0.7 });
  }

  trailDirt(dt, every = 0.07) {
    this.trailT -= dt;
    if (this.trailT > 0) return;
    this.trailT = every;
    this.scene.fx.burst(this.x, this.y, { color: DIRT, count: 2, speed: [20, 90], life: [250, 450], scale: [1.4, 2.6], gravity: 260, angle: [210, 330] });
  }

  lockTarget() {
    const p = this.player;
    const x = Phaser.Math.Clamp(p.x, ROOM.x + 50, ROOM.right - 50), y = Phaser.Math.Clamp(p.y, ROOM.y + 50, ROOM.bottom - 50);
    this.target = { x, y };
    this.setState('lock');
    this.warn = darkWarn(this.scene, x, y, POP_R, LOCK_T, WARN_DIRT);
    Sfx.play('dig', { vol: 0.9, rate: 0.55 });
    this.after(LOCK_T, () => this.erupt());
  }

  erupt() {
    if (!this.alive) return;
    const s = this.scene, fx = s.fx, p = this.player;
    this.warn = null;
    this.x = this.target.x; this.y = this.target.y;
    this.stop();
    this.flying = !!this.meta.flying;
    this.moveBy(0, 0); // push out of anything solid
    this.invulnerable = false;
    this.targetable = true;
    this.alphaOverride = undefined;
    this.sprite.setAlpha(1);
    this.shadow.setVisible(true);
    this.killMound();
    this.setPose('attack');
    this.setState('stun');
    this.contactDamage = 0;
    this.applyStatus('stun', { t: STUN });
    Sfx.play('dig', { vol: 1, rate: 0.85 });
    Sfx.play('bullet_hit_wall', { vol: 0.8, rate: 0.6 });
    Sfx.play('zombie_groan', { vol: 0.5, rate: 1.3 });
    fx.shake(0.008, 200);
    fx.dust(this.x, this.y + 10, 1.8);
    shockRing(s, this.x, this.y, POP_R, 0xd8a060, 320);
    fx.burst(this.x, this.y, { color: DIRT, count: 26, speed: [140, 420], life: [350, 700], scale: [1.6, 3.4], gravity: 500, angle: [200, 340] });
    if (Math.hypot(p.x - this.x, p.y - this.y) < POP_R) p.damage(1, { x: this.x, y: this.y, enemy: this, enemyName: 'mole', kind: 'burst' });
  }

  killMound() {
    if (this.mound) { this.mound.destroy(); this.mound = null; }
    if (this.moundTop) { this.moundTop.destroy(); this.moundTop = null; }
  }

  // ------------------------------------------------------------------------------------------ overrides
  /** Poison/burn ticks bypass takeHit: keep the mole immune while burrowed. */
  hurt(dmg, info = {}) { if (this.invulnerable && !info.force) return; super.hurt(dmg, info); }

  syncVisual() {
    super.syncVisual();
    if (this.mound) {
      this.bob += 0.4;
      const w = 84 + Math.sin(this.bob) * 6;
      this.mound.setPosition(this.x, this.y + 14).setDisplaySize(w, 40);
      this.moundTop.setPosition(this.x, this.y + 6 + Math.sin(this.bob * 1.3) * 2).setDisplaySize(w * 0.68, 28);
      this.mound.setDepth(DEPTH.shadows + 4); // below actors
    }
  }

  onWallHit() { if (this.state === 'surface') this.timer = Math.min(this.timer, 0.2); }

  destroy() {
    if (this.warn) { this.warn.destroy(); this.warn = null; }
    this.killMound();
    super.destroy();
  }
}

registerEnemy('mole', Mole, { hp: 22, r: 30, speed: 130, floors: [3], weight: 2, fps: 9 });
