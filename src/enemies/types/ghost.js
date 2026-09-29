// GHOST (floors 2-3): drifts through obstacles toward the player and PHASES on a 1.5 s cycle:
//   solid 0.80 s (hittable, contact damage; opens with a brief lunge pose) -> fade out 0.15 s -> faded 0.35 s (alpha .28, INVULNERABLE,
//   harmless, drifts faster) -> wail 0.20 s (mouth-open pose, alpha ramps up, still invulnerable; 'ghost_wail' plays here) -> solid...
// Bullets pass through it while invulnerable. Undead (silver bullets x2).
// Boss adds: opts {deputy:true} (default when spawned inside a boss room, e.g. Marshal Grimm's "ghost deputies"): teal spirit aura, out-of-phase start, and it
// also flings one slow aimed ghost-fire wisp 0.3 s after each time it turns solid (wail = warning). Deputies drop no loot.
import Phaser from 'phaser';
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { DEPTH } from '../../config.js';

const SOLID = 0.8, FADEOUT = 0.15, FADED = 0.35, WAIL = 0.2, LOW = 0.28;

class Ghost extends Enemy {
  init(opts) {
    this.deputy = opts.deputy ?? (this.scene.room?.type === 'boss'); // boss-room ghosts are deputies unless opts.deputy === false
    this.baseContact = this.contactDamage;
    this.bob = Math.random() * 6;
    this.setState('solid');
    this.stateTime = Math.random() * 0.6; // desync several ghosts
    this.alphaOverride = 1;
    if (this.deputy) {
      this.glow = this.scene.add.image(this.x, this.y, 'glow').setTint(0x60ffd0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.shadows + 4).setAlpha(0.5);
      this.glow.setScale((this.radius * 4) / 128);
    }
  }

  ai(dt) {
    const p = this.player;
    this.bob += dt * 3;
    this.airHeight = 24 + Math.sin(this.bob) * 8;
    this.faceToward(p.x);
    const t = this.stateTime;
    switch (this.state) {
      case 'solid': {
        this.alphaOverride = 1;
        this.moveToward(p.x, p.y, this.speed);
        if (t > 0.25 && this.pose === 'attack') this.setPose('move');
        if (t >= SOLID) { this.setState('fadeout'); this.setPose('move'); }
        break;
      }
      case 'fadeout': {
        this.moveToward(p.x, p.y, this.speed);
        this.alphaOverride = 1 - (1 - LOW) * (t / FADEOUT);
        if (t >= FADEOUT) {
          this.setState('faded');
          this.invulnerable = true; this.contactDamage = 0;
          this.scene.fx.burst(this.x, this.y - 30, { color: [0xcfe8d8, 0x9fd8c0], count: 6, speed: [20, 90], life: [300, 600], scale: [1.5, 2.5], gravity: -60 });
        }
        break;
      }
      case 'faded': {
        this.alphaOverride = LOW + Math.sin(t * 18) * 0.04;
        this.moveToward(p.x, p.y, this.speed * 1.35);
        if (t >= FADED) {
          this.setState('wail'); this.setPose('windup');
          Sfx.play('ghost_wail', { vol: 0.5, rate: 0.9 + Math.random() * 0.25 });
        }
        break;
      }
      case 'wail': {
        this.alphaOverride = LOW + (1 - LOW) * (t / WAIL);
        this.moveToward(p.x, p.y, this.speed * 0.5);
        if (t >= WAIL) {
          this.setState('solid'); this.setPose('attack');
          this.invulnerable = false; this.contactDamage = this.baseContact;
          this.scene.fx.impact(this.x, this.y - 40, 0, 1.1);
          this.pulse(0.25);
          if (this.deputy) this.after(0.3, () => { if (this.state === 'solid') this.shoot(this.angleToPlayer(), { kind: 'ghostfire', speed: 240, up: 20, offset: 30 }); });
        }
        break;
      }
      default: break;
    }
  }

  syncVisual() {
    super.syncVisual();
    if (this.shadow) this.shadow.setAlpha(this.sprite ? this.sprite.alpha : 1);
    if (this.glow) this.glow.setPosition(this.x, this.footY - 40).setAlpha((this.sprite ? this.sprite.alpha : 1) * 0.5);
  }

  dropLoot() { if (!this.deputy) super.dropLoot(); }

  destroy() {
    if (this.glow) { this.glow.destroy(); this.glow = null; }
    super.destroy();
  }
}

registerEnemy('ghost', Ghost, { hp: 14, r: 30, speed: 80, floors: [2, 3], weight: 2, flying: true, ghost: true, air: 20, tags: ['undead'] });
