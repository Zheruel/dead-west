// HELLSTEER (floor 4, CHAPTER2 s3 #2): small hellfire bull, the mini-Toro. Grazes toward you at 90 px/s; every 3-4 s it PAWS the ground for
// 0.7 s (head-down pose, dust, snort, a 96 px wide warning lane to the wall that tracks you and LOCKS 0.3 s before the charge), then CHARGES at
// 640 px/s until a wall or obstacle: contact 2 dmg + shove; breakable tiles (B) on the way are smashed and do not stop it. Hitting a wall or rock
// = wall crash: dazed 1.4 s (takes x1.3 damage, yellow tint) and a fire patch (r 60, 2 s) under its horns. Fire-tagged: lava / fire do not hurt it.
// Elite-safe (affixBan burning, swift). Stun during the paw cancels the charge. Charge speed = meta.charge.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { subRng } from '../../core/rng.js';
import { BandWarn, rayLength } from '../parts/fe-e1/warn.js';

const PAW = 0.7, LOCK = 0.3; // aim locks 0.3 s before the charge
const BAND_W = 96;
const DAZE = 1.4, DAZE_MULT = 1.3;
const MAX_TRAVEL = 1900; // px, safety cap
const WARN = 0xff8a3a, WARN_LOCKED = 0xff4a2a;

class Hellsteer extends Enemy {
  init() {
    this.rnd = subRng('hellsteer', Math.round(this.x), Math.round(this.y), this.floor);
    this.setState('graze');
    this.baseContact = this.contactDamage;
    this.chargeSpeed = this.meta.charge ?? 640;
    this.atkCd = this.cd(this.rnd.float(1.8, 2.8)); // first charge a little sooner than the steady 3-4 s
    this.aim = 0;
    this.travel = 0;
    this.dustT = 0;
    this.laneLen = 0;
    this.band = null;
  }

  ai(dt) {
    const p = this.player;
    this.atkCd -= dt;
    switch (this.state) {
      case 'graze': {
        this.setPose('move');
        this.steerToward(p.x, p.y, this.speed);
        if (this.atkCd <= 0 && this.distToPlayer() < 900) this.startPaw();
        break;
      }
      case 'paw': {
        this.stop();
        const locked = this.stateTime >= PAW - LOCK;
        if (!locked) { this.aim = this.angleToPlayer(); this.laneLen = rayLength(this.scene.room, this.x, this.y, this.aim, this.radius * 0.9); } // tracks until locked
        this.band.set(this.x, this.y, this.aim, this.laneLen, BAND_W, this.stateTime / PAW, locked ? WARN_LOCKED : WARN);
        this.dustT -= dt;
        if (this.dustT <= 0) {
          this.dustT = 0.12;
          this.scene.fx.dust(this.x + (this.rnd.next() - 0.5) * 60, this.footY, 0.5);
        }
        break;
      }
      case 'charge': {
        this.moveAngle(this.aim, this.chargeSpeed); // re-applied every frame: knockback cannot bend the charge
        this.travel += this.chargeSpeed * dt;
        this.smash();
        this.dustT -= dt;
        if (this.dustT <= 0) { this.dustT = 0.06; this.scene.fx.dust(this.x, this.footY, 0.7); }
        if (this.travel > MAX_TRAVEL) this.crash();
        break;
      }
      case 'dazed': { // ai only runs again once the stun status has expired
        this.setPose('move');
        this.setState('graze');
        this.atkCd = this.cd(this.rnd.float(3, 4));
        break;
      }
      default: break;
    }
  }

  startPaw() {
    this.setState('paw');
    this.stop();
    this.aim = this.angleToPlayer();
    this.laneLen = 0;
    this.dustT = 0;
    this.atkCd = this.cd(this.rnd.float(3, 4));
    if (!this.band) this.band = new BandWarn(this.scene);
    Sfx.play('bull_snort', { vol: 0.85, detune: (this.rnd.next() - 0.5) * 240 });
    this.telegraph(PAW, () => this.startCharge());
  }

  startCharge() {
    if (this.status.stun) { this.band.hide(); this.setState('graze'); this.setPose('move'); return; }
    this.band.hide();
    this.setState('charge');
    this.setPose('attack');
    this.contactDamage = 2;
    this.travel = 0;
    this.dustT = 0;
    this.moveAngle(this.aim, this.chargeSpeed);
    this.scene.fx.dust(this.x, this.footY, 1.2);
    Sfx.play('hoof_thunder', { vol: 0.45, rate: 1.2 });
  }

  /** Smash breakable tiles (not powder barrels) just ahead of the horns so a charge runs through crates instead of stopping at them. */
  smash() {
    const room = this.scene.room;
    if (!room) return;
    const c = Math.cos(this.aim), s = Math.sin(this.aim), reach = this.radius + 26, side = this.radius * 0.7;
    for (let i = -1; i <= 1; i++) {
      const t = room.tileAt(this.x + c * reach - s * side * i, this.y + s * reach + c * side * i);
      if (t && t.type === 'breakable' && !t.broken && !t.barrel) { room.damageTile(t, 99); if (t.broken) this.scene.fx.shake(0.004, 80); }
    }
  }

  crash() {
    const s = this.scene, fx = s.fx;
    const cx = Math.cos(this.aim), cy = Math.sin(this.aim);
    this.stop();
    this.contactDamage = this.baseContact;
    this.setState('dazed');
    this.setPose('windup'); // head down, steaming
    this.knock.x = -cx * 180; this.knock.y = -cy * 180;
    this.applyStatus('stun', { t: DAZE });
    const hx = this.x + cx * this.radius * 0.6, hy = this.y + cy * this.radius * 0.6;
    if (s.room && s.room.addFire) s.room.addFire(hx, hy, 60, 2.0, { dmg: 1, team: 'enemy' });
    fx.shake(0.009, 220);
    fx.dust(hx, this.footY, 1.5);
    fx.burst(hx, this.y - 30, { color: [0x6b4423, 0x3b2320, 0xff7a1f], count: 16, speed: [120, 380], life: [300, 650], scale: [1.4, 3], gravity: 420, dir: this.aim + Math.PI, spread: 70 });
    fx.burst(this.x, this.y - 70, { color: [0xffe070, 0xfff2c0], count: 8, speed: [40, 130], life: [400, 700], scale: [1.2, 2.2], blend: 'ADD', angle: [220, 320] }); // dazed stars
    Sfx.play('bullet_hit_wall', { vol: 0.9, detune: -600 });
    Sfx.play('explosion', { vol: 0.4, rate: 0.7 });
  }

  onWallHit() {
    if (this.state !== 'charge' || this.stateTime < 0.05) return;
    this.smash();
    this.crash();
  }

  /** Dazed after a crash: x1.3 damage while the stun lasts. */
  damageMultiplier() { return this.state === 'dazed' && this.status.stun ? DAZE_MULT : 1; }

  onDeath() { if (this.band) this.band.hide(); }

  destroy() {
    if (this.band) { this.band.destroy(); this.band = null; }
    super.destroy();
  }
}

registerEnemy('hellsteer', Hellsteer, { knockback: 70, fps: 8 }); // hp / r / speed / charge / weight / tags / affixBan come from ENEMY_META
