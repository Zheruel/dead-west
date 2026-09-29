// DYNAMITER (floor 2): hunched bandit with a lit stick. Keeps ~440 px away (backs off fast if you get within ~280), and every
// ~2.6 s winds up (0.55 s) and LOBS dynamite at where you stand: the stick arcs for 0.9 s (a red ground circle marks the blast
// zone the whole time, filling in until it goes off), then a 1.0 s fuse, then a radius-150 explosion (2 dmg to the player,
// breaks crates/walls, never hurts enemies). Below 50% HP it panics: shorter cooldown.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import Dynamite from '../../entities/Dynamite.js';
import { ROOM, DEPTH } from '../../config.js';

/** Thrown stick + a ground warning (disc/ring that fills with the stick's own progress, so slow-mo / hit-stop stay in sync). */
class LobbedDynamite extends Dynamite {
  constructor(scene, x, y, o) {
    super(scene, x, y, o);
    const d = o.radius * 2;
    this.warn = [
      scene.add.image(x, y, 'disc').setTint(0xd63a2a).setAlpha(0.16).setDepth(DEPTH.decals + 6).setDisplaySize(d, d),
      scene.add.image(x, y, 'ring').setTint(0xff5a2a).setAlpha(0.85).setDepth(DEPTH.decals + 7).setDisplaySize(d, d),
      scene.add.image(x, y, 'disc').setTint(0xd63a2a).setAlpha(0.32).setDepth(DEPTH.decals + 6).setDisplaySize(4, 4),
    ];
    this.total = (o.flight ?? 0.8) + (o.fuse ?? 1.4);
    this.dia = d;
  }
  update(dt) {
    super.update(dt);
    if (!this.alive || !this.warn) return;
    const k = Math.min(1, (this.flightT + (this.maxFuse - this.fuse) * (this.flightT >= this.flight ? 1 : 0)) / this.total);
    this.warn[2].setDisplaySize(4 + (this.dia - 4) * k * k, 4 + (this.dia - 4) * k * k);
    const blink = this.fuse < 0.6 && this.flightT >= this.flight && Math.floor(this.fuse * 14) % 2 === 0;
    this.warn[1].setAlpha(blink ? 1 : 0.85);
    this.warn[0].setAlpha(blink ? 0.3 : 0.16);
  }
  killWarn() { if (this.warn) { this.warn.forEach((w) => w.destroy()); this.warn = null; } }
  explode() { this.killWarn(); super.explode(); }
  destroy() { this.killWarn(); super.destroy(); }
}

const BLAST_R = 150, FLIGHT = 0.9, FUSE = 1.0, WINDUP = 0.55;

class Dynamiter extends Enemy {
  init() {
    this.setState('move');
    this.throwCd = 0.9 + Math.random() * 0.8;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 1 + Math.random();
  }

  ai(dt) {
    const p = this.player;
    this.faceToward(p.x);
    switch (this.state) {
      case 'move': {
        this.setPose('move');
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = 1.2 + Math.random(); }
        const d = this.distToPlayer();
        if (d < 280) this.keepDistance(440, this.strafe * 0.4, this.speed * 1.5, 30); // panic retreat
        else this.keepDistance(440, this.strafe, this.speed, 70);
        this.throwCd -= dt;
        if (this.throwCd <= 0 && d < 760) this.throwDynamite();
        break;
      }
      default: this.stop(); break; // winding up / throwing
    }
  }

  throwDynamite() {
    this.setState('throw');
    this.stop();
    Sfx.play('spawn', { vol: 0.25, rate: 1.6 });
    this.telegraph(WINDUP, () => {
      const p = this.player;
      const tx = Math.max(ROOM.x + 50, Math.min(ROOM.right - 50, p.x));
      const ty = Math.max(ROOM.y + 50, Math.min(ROOM.bottom - 50, p.y));
      this.lob(tx, ty);
      this.setPose('attack');
      this.after(0.35, () => { this.setPose('move'); this.setState('move'); this.throwCd = (this.hp < this.maxHp * 0.5 ? 1.8 : 2.6) + Math.random() * 0.6; });
    });
  }

  lob(tx, ty) {
    const s = this.scene;
    Sfx.play('lasso_swish', { vol: 0.55, rate: 1.5 });
    new LobbedDynamite(s, tx, ty, {
      from: { x: this.x + (this.sprite.flipX ? -20 : 20), y: this.y - 20 }, flight: FLIGHT, fuse: FUSE,
      radius: BLAST_R, damage: 0, playerDamage: 2, hurtEnemies: false,
    });
  }
}

registerEnemy('dynamiter', Dynamiter, { hp: 20, r: 30, speed: 100, floors: [2], weight: 2 });
