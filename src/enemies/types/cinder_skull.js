// CINDER SKULL (floor 4, CHAPTER2 s3 #3): flaming horned skull, a suicide flyer (ignores rocks / pits / lava, still bound by walls).
// Chases at 190 px/s with a sine wobble (amp 60 px, 2.2 Hz). Within 140 px it ARMS (room token 'skullArm': only one skull arms at a time): stops, flickers
// red and shrieks for 0.5 s while a 110 px ground circle fills in, then detonates: 1 dmg (2 if cursed) inside r 110 + a fire patch (r 70, 2 s), and the
// skull is gone. Shoot it before the circle lands: it just dies (harmless puff, normal loot). A skull that cannot get the token hovers ~220 px away
// and circles instead of touching you. No contact damage: the blast is the attack. The arming circle is a GroundHaz, so it stays visible in dark rooms.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { subRng } from '../../core/rng.js';
import { GroundHaz } from '../../systems/GroundHaz.js';

const TAU = Math.PI * 2;
const ARM_DIST = 140, BLAST_R = 110, SHRIEK = 0.5;
const WOB_AMP = 60, WOB_HZ = 2.2;
const FIRE = { r: 70, dur: 2.0 };
const WARN = 0xff6a3a;

class CinderSkull extends Enemy {
  init() {
    this.rnd = subRng('cinder_skull', Math.round(this.x), Math.round(this.y), this.floor);
    this.setState('chase');
    this.wob = this.rnd.float(0, TAU);
    this.bob = this.rnd.float(0, TAU);
    this.baseAir = this.meta.air ?? 50;
    this.airHeight = this.baseAir;
    this.strafe = this.rnd.sign();
    this.strafeT = this.rnd.float(1.2, 2.0);
    this.trailT = 0;
    this.haz = null;
    this.holding = false;
    this.holdT = 0;
  }

  ai(dt) {
    const p = this.player;
    this.bob += dt * 5;
    switch (this.state) {
      case 'chase': {
        this.setPose('move');
        this.faceToward(p.x);
        this.airHeight = this.baseAir + Math.sin(this.bob) * 6;
        const d = this.distToPlayer();
        const near = d < ARM_DIST;
        if (near && this.takeToken('skullArm', 1)) { this.arm(); break; }
        if (near || this.holding) { // no free token: back off to ~220 px and circle instead of touching the player
          if (near) this.holdT = 1.2; // keep backing off, then try to close in again (the token may be free by then)
          this.holdT -= dt;
          this.holding = this.holdT > 0;
          this.strafeT -= dt;
          if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = this.rnd.float(1.2, 2.0); }
          this.keepDistance(ARM_DIST + 80, this.strafe, this.speed * 0.8, 30);
        } else {
          // homing + sine weave: the lateral velocity is the derivative of a 60 px amplitude offset, so the path really swings +-60 px
          this.wob += dt * WOB_HZ * TAU;
          const a = this.angleToPlayer(), lat = WOB_AMP * WOB_HZ * TAU * Math.cos(this.wob);
          const cx = Math.cos(a), cy = Math.sin(a);
          this.vx = cx * this.speed - cy * lat;
          this.vy = cy * this.speed + cx * lat;
        }
        this.trailT -= dt;
        if (this.trailT <= 0) {
          this.trailT = 0.1;
          this.scene.fx.burst(this.x, this.footY - this.airHeight + 4, { color: [0xff7a1f, 0xffd060], count: 1, speed: [10, 45], life: [260, 420], scale: [1.2, 2.4], blend: 'ADD', gravity: -70 });
        }
        break;
      }
      case 'arm': {
        this.stop();
        this.airHeight = this.baseAir + 10 + Math.sin(this.stateTime * 45) * 3; // rears up, trembling
        this.sprite.setTint(Math.floor(this.stateTime * 18) % 2 === 0 ? 0xff3a2a : 0xffffff);
        break;
      }
      default: break;
    }
  }

  /** Stop, flash red and shriek; the ground circle counts down the 0.5 s and detonates the skull when it lands. */
  arm() {
    const s = this.scene;
    this.setState('arm');
    this.stop();
    this.setPose('windup');
    this.haz = GroundHaz.of(s).circle({
      x: this.x, y: this.y, r: BLAST_R, tell: SHRIEK, active: 0.2, dmg: this.cursed ? 2 : 1, kind: 'explosion', color: WARN,
      source: { explosion: true, enemyName: this.id }, fx: 'none', shake: false, decal: false,
      fire: { r: FIRE.r, dur: FIRE.dur, team: 'enemy' },
      onLand: () => this.detonate(),
    });
    Sfx.play('ghost_wail', { vol: 0.6, rate: 1.5 });
    Sfx.play('bat_screech', { vol: 0.5, rate: 0.85 });
  }

  detonate() {
    if (!this.alive) return;
    const s = this.scene;
    this.setPose('attack');
    s.fx.explosion(this.x, this.y, BLAST_R);
    s.fx.burst(this.x, this.y - 30, { color: [0xff7a1f, 0xffd060, 0xe8dcc0], count: 16, speed: [160, 460], life: [300, 650], scale: [1.4, 3], blend: 'ADD' });
    this.noLoot = true; // a suicide pays nothing: the reward is shooting it first
    this.die({ silent: true, suicide: true });
  }

  onDeath() {
    if (this.haz && !this.haz.fired) this.haz.cancel(); // shot before it landed: harmless puff
    this.haz = null;
  }

  destroy() {
    if (this.haz && !this.haz.fired) this.haz.cancel();
    this.haz = null;
    super.destroy();
  }
}

registerEnemy('cinder_skull', CinderSkull, { contactDamage: 0, knockback: 160, fps: 9 }); // hp / r / speed / flying / air / tags / affixBan come from ENEMY_META
