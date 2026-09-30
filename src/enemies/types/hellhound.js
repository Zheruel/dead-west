// HELLHOUND (floor 4, CHAPTER2 s3 #1): mangy rusher that stalks at ~300 px, strafing (flips every 1.2-2.0 s). Every 2.6-3.4 s it attacks
// (room token 'hhAtk': at most 2 hounds mid-attack, attack starts staggered by `scene._hhNext`):
//   windup 0.6 s (crouch pose, pulse, growl, 60 degree x 340 px warning wedge that tracks you and LOCKS its aim for the last 0.2 s)
//   -> lunge 0.35 s at 520 px/s (~180 px, contact 1) -> at the lunge end a flame fan: 7 embers, 60 degree spread, speed 380, life 0.45 s
//   (~170 px) and a small fire patch under its paws -> recover 0.8 s (mouth open, vulnerable).
// Sidestep the lunge line and the flames miss. A stun during the windup / lunge cancels the attack. Fire-tagged: lava and fire do not hurt it.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { subRng } from '../../core/rng.js';
import { WedgeWarn } from '../parts/fe-e1/warn.js';

const KEEP = 300; // stalk distance
const WINDUP = 0.6, LOCK = 0.2; // aim locks 0.2 s before the lunge
const LUNGE_T = 0.35, LUNGE_SPEED = 520;
const RECOVER = 0.8;
const FAN = { n: 7, spread: 60 * Math.PI / 180, speed: 380, life: 0.45 };
const WEDGE_LEN = 340; // lunge (~180) + flame reach (~170)
const WARN = 0xff8a3a, WARN_LOCKED = 0xff4a2a;
const EMBER = 0xffa040;

class Hellhound extends Enemy {
  init() {
    this.rnd = subRng('hellhound', Math.round(this.x), Math.round(this.y), this.floor);
    this.setState('stalk');
    this.strafe = this.rnd.sign();
    this.strafeT = this.rnd.float(1.2, 2.0);
    this.atkCd = this.cd(this.rnd.float(1.6, 2.6)); // first attack a bit earlier than the steady 2.6-3.4 s cycle
    this.aim = 0;
    this.trailT = 0;
    this.wedge = null;
  }

  ai(dt) {
    const p = this.player;
    this.atkCd -= dt;
    switch (this.state) {
      case 'stalk': {
        this.setPose('move');
        this.faceToward(p.x);
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = this.rnd.float(1.2, 2.0); }
        if (this.hit) this.strafe = -this.strafe; // pinned against a rock / wall: swap sides
        this.keepDistance(KEEP, this.strafe, this.speed);
        if (this.atkCd <= 0) this.tryAttack();
        break;
      }
      case 'wind': {
        this.stop();
        this.faceToward(p.x);
        const locked = this.stateTime >= WINDUP - LOCK;
        if (!locked) this.aim = this.angleToPlayer();
        this.wedge.set(this.x, this.y, this.aim, WEDGE_LEN, this.stateTime / WINDUP, locked ? WARN_LOCKED : WARN);
        break;
      }
      case 'lunge': {
        this.moveAngle(this.aim, LUNGE_SPEED); // re-applied every frame so knockback cannot bend the lunge
        this.trailT -= dt;
        if (this.trailT <= 0) { this.trailT = 0.05; this.scene.fx.dust(this.x, this.footY, 0.45); }
        if (this.stateTime >= LUNGE_T) this.endLunge();
        break;
      }
      case 'recover': this.stop(); break;
      default: break;
    }
  }

  tryAttack() {
    const s = this.scene;
    if (this.distToPlayer() > 560) { this.atkCd = 0.25; return; }
    if (s.time.now < (s._hhNext || 0) || !this.takeToken('hhAtk', 2)) { this.atkCd = 0.25; return; }
    s._hhNext = s.time.now + 450; // stagger: no two hounds start a windup in the same instant
    this.atkCd = this.cd(this.rnd.float(2.6, 3.4));
    this.setState('wind');
    this.stop();
    this.aim = this.angleToPlayer();
    if (!this.wedge) this.wedge = new WedgeWarn(s);
    this.wedge.set(this.x, this.y, this.aim, WEDGE_LEN, 0, WARN);
    Sfx.play('hound_growl', { vol: 0.8, detune: (this.rnd.next() - 0.5) * 300 });
    this.telegraph(WINDUP, () => this.startLunge());
  }

  startLunge() {
    if (this.status.stun) { this.abort(); return; }
    this.wedge.hide();
    this.setState('lunge');
    this.setPose('attack');
    this.trailT = 0;
    this.moveAngle(this.aim, LUNGE_SPEED);
    this.faceToward(this.x + this.vx);
    this.scene.fx.dust(this.x, this.footY, 1.0);
    Sfx.play('whip_crack', { vol: 0.3, rate: 1.6 });
  }

  /** Lunge over (time or wall): flame fan + small fire patch, then recover. */
  endLunge() {
    this.stop();
    this.releaseToken('hhAtk');
    if (this.status.stun) { this.abort(); return; }
    this.setState('recover');
    this.setPose('attack');
    const s = this.scene, fx = s.fx;
    for (let i = 0; i < FAN.n; i++) {
      const a = this.aim + (i / (FAN.n - 1) - 0.5) * FAN.spread;
      this.shoot(a, { kind: 'ember', speed: FAN.speed, life: FAN.life, damage: 1, offset: this.radius, tint: EMBER });
    }
    fx.burst(this.x + Math.cos(this.aim) * 40, this.y - 14, { color: [0xff7a1f, 0xffd060], count: 12, speed: [160, 420], life: [180, 380], scale: [1.4, 3], blend: 'ADD', dir: this.aim, spread: 32 });
    fx.shake(0.004, 90);
    Sfx.play('fire_whoosh', { vol: 0.75, detune: (this.rnd.next() - 0.5) * 200 });
    if (s.room && s.room.addFire) s.room.addFire(this.x, this.y + 6, 42, 1.4, { dmg: 1, team: 'enemy' });
    this.after(RECOVER, () => this.resume());
  }

  abort() {
    this.stop();
    this.releaseToken('hhAtk');
    if (this.wedge) this.wedge.hide();
    this.resume();
  }

  resume() {
    this.setState('stalk');
    this.setPose('move');
  }

  onWallHit() {
    if (this.state === 'lunge' && this.stateTime > 0.05) this.endLunge(); // blocked: the fan fires where it stopped
  }

  onDeath() { if (this.wedge) this.wedge.hide(); }

  destroy() {
    if (this.wedge) { this.wedge.destroy(); this.wedge = null; }
    super.destroy();
  }
}

registerEnemy('hellhound', Hellhound, { knockback: 130, fps: 12 }); // hp / r / speed / weight / tags / affixBan come from ENEMY_META
