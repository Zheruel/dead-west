// BOUNCER (floor 6, tank): a huge tuxedoed demon who never uncrosses his arms. FRONTAL BLOCK: hits from inside +-70 deg of where he faces are
// consumed (a pierce or boomerang ends on him) and deal x0.5; sides, back, explosions and DoT deal x1. The block is drawn as a pale gold arc.
// Every 5.0 s: knuckle-crack windup 0.9 s (pose 4, red arrow band 4 tiles long that tracks you, then LOCKS 0.3 s before the rush) ->
// shoulder rush 0.5 s at 560 px/s (~280 px; contact 2 dmg and throws you back; a roll passes through; a wall ends it early) ->
// recover 1.0 s (pose 5, front block OFF, the moment to shoot him). Rush timers run on real time so a swift elite keeps the full telegraph.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { rng } from '../../core/rng.js';
import { DEPTH, TILE } from '../../config.js';

const PERIOD = 5.0;
const WINDUP = 0.9;
const LOCK = 0.3; // arrow band frozen for the last 0.3 s of the windup
const RUSH_T = 0.5;
const RUSH_V = 560;
const RECOVER = 1.0;
const BAND_LEN = TILE * 4;
const ARC = (70 * Math.PI) / 180;
const THROW = 520; // knockback impulse of the shoulder (Player.knock decays e^-9t: ~58 px)
const TAU = Math.PI * 2;
let uid = 0;

const wrapPi = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; };

class Bouncer extends Enemy {
  init(opts) {
    this.rnd = rng.game.fork(`bouncer:${++uid}`);
    this.setState('walk');
    this.face = this.player ? this.angleToPlayer() : Math.PI / 2;
    this.blockOn = true;
    this.atkCd = (opts && opts.instant ? 1.4 : 1.6) + this.rnd.next() * 0.9;
    this.baseContact = this.contactDamage;
    this.lockA = 0;
    this.hitDone = false;
    this.dustT = 0;
    this.g = this.scene.add.graphics().setDepth(DEPTH.decals + 6);
    this.g.__noSnap = true;
    this.band = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
  }

  ai(dt) {
    const p = this.player;
    const rdt = dt / (this.aiScale || 1); // real seconds: rush / recover keep their exact lengths under swift
    switch (this.state) {
      case 'walk': {
        this.setPose('move');
        this.face = this.angleToPlayer();
        this.faceToward(p.x);
        this.steerToward(p.x, p.y, this.speed);
        this.atkCd -= dt;
        if (this.atkCd <= 0 && this.distToPlayer() < 400) this.windup();
        break;
      }
      case 'windup': {
        this.stop();
        if (this.stateTime < WINDUP - LOCK) { this.face = this.angleToPlayer(); this.lockA = this.face; }
        this.faceToward(this.x + Math.cos(this.lockA));
        break;
      }
      case 'rush': {
        this.dustT -= rdt;
        if (this.dustT <= 0) { this.dustT = 0.06; this.scene.fx.dust(this.x, this.footY, 0.7); }
        if (!this.hitDone) this.rushHit(p);
        if (this.stateTime >= RUSH_T) this.recover(false);
        break;
      }
      case 'recover': {
        this.stop();
        if (this.stateTime >= RECOVER) this.resume();
        break;
      }
      default: break;
    }
  }

  windup() {
    this.setState('windup');
    this.stop();
    this.blockOn = true;
    this.lockA = this.face;
    this.hitDone = false;
    this.pulse(WINDUP);
    this.setPose('windup');
    Sfx.play('whip_crack', { vol: 0.55, rate: 1.5 });
    Sfx.play('bull_snort', { vol: 0.5, rate: 0.7, gap: 0.3 });
    // the state flips to 'rush' from a timer so a stun during the windup cannot skip the telegraph but the band always finishes
    this.after(WINDUP, () => { if (this.alive && this.state === 'windup') this.rush(); });
  }

  rush() {
    this.setState('rush');
    this.setPose('attack');
    this.contactDamage = 0; // the rush has its own (2 dmg) contact
    this.hitDone = false;
    this.dustT = 0;
    this.moveAngle(this.lockA, RUSH_V);
    this.faceToward(this.x + Math.cos(this.lockA));
    Sfx.play('hoof_thunder', { vol: 0.45, rate: 1.2, gap: 0.2 });
    this.scene.fx.dust(this.x, this.footY, 1.1);
  }

  rushHit(p) {
    if (!p || p.dead) return;
    const rr = p.hurtRadius + this.radius * 0.9;
    if ((p.x - this.x) ** 2 + (p.y - this.y) ** 2 >= rr * rr) return;
    const c = Math.cos(this.lockA), s = Math.sin(this.lockA);
    // knock direction = along the rush (source is placed behind the player on that line)
    if (p.damage(2, { x: p.x - c * 100, y: p.y - s * 100, enemy: this, enemyName: 'bouncer', kind: 'contact' })) {
      this.hitDone = true;
      p.knock.x = c * THROW; p.knock.y = s * THROW;
      Sfx.play('stamp_slam', { vol: 0.8, gap: 0.1 });
      this.scene.fx.ringPulse(p.x, p.y, 0xffd070, 60, 300, 0.8);
    }
  }

  recover(crash) {
    this.setState('recover');
    this.stop();
    this.setPose('attack');
    this.blockOn = false;
    this.contactDamage = this.baseContact;
    const fx = this.scene.fx;
    fx.dust(this.x, this.footY, 1.3);
    if (crash) { fx.shake(0.008, 160); Sfx.play('stamp_slam', { vol: 0.7, rate: 0.8, gap: 0.1 }); }
  }

  resume() {
    this.setState('walk');
    this.setPose('move');
    this.blockOn = true;
    this.atkCd = this.cd(PERIOD - WINDUP - RUSH_T - RECOVER);
  }

  onWallHit() { if (this.state === 'rush' && this.stateTime > 0.08) this.recover(true); }

  /** Frontal arc block: bullets from inside +-70 deg of the facing deal x0.5 and are consumed; explosions and DoT ignore it. */
  damageMultiplier(info) {
    if (!this.blockOn || info.explosion || info.dot || info.hazard) return 1;
    let a;
    if (info.x != null && info.y != null && (info.bullet || info.angle != null)) a = Math.atan2(info.y - this.y, info.x - this.x);
    else if (info.angle != null) a = info.angle + Math.PI;
    else return 1;
    if (Math.abs(wrapPi(a - this.face)) > ARC) return 1;
    info.knock = 0; // a tank holds its ground
    const b = info.bullet;
    if (b && !(b.m && b.m.orbit)) b.pierce = 0; // consumed
    const fx = this.scene.fx;
    fx.spark(info.x ?? this.x, (info.y ?? this.y) - 22, this.face, false);
    Sfx.play('ricochet_ping', { vol: 0.4, rate: 0.75, gap: 0.07 });
    return 0.5;
  }

  /** Redraw the block arc (pale gold, ground plane) and, during the windup, the red rush band. */
  syncVisual() {
    super.syncVisual();
    const g = this.g;
    if (!g || !g.scene) return;
    g.clear();
    if (this.spawnT > 0) return;
    const cy = this.y + 8;
    if (this.blockOn) {
      const R = this.radius + 22;
      g.fillStyle(0xffd070, 0.09).slice(this.x, cy, R, this.face - ARC, this.face + ARC, false).fillPath();
      g.lineStyle(5, 0xffe6a0, 0.55).beginPath().arc(this.x, cy, R, this.face - ARC, this.face + ARC, false).strokePath();
    }
    if (this.state === 'windup') {
      const locked = this.stateTime >= WINDUP - LOCK;
      const a = this.lockA, c = Math.cos(a), s = Math.sin(a), hw = this.radius, b = this.band;
      const nx = -s * hw, ny = c * hw, ex = this.x + c * BAND_LEN, ey = cy + s * BAND_LEN;
      b[0].x = this.x + nx; b[0].y = cy + ny; b[1].x = ex + nx; b[1].y = ey + ny; b[2].x = ex - nx; b[2].y = ey - ny; b[3].x = this.x - nx; b[3].y = cy - ny;
      const k = Math.min(1, this.stateTime / WINDUP);
      g.fillStyle(0xd63a2a, locked ? 0.42 : 0.16 + 0.1 * k).fillPoints(b, true);
      g.lineStyle(locked ? 5 : 3, locked ? 0xff5a3a : 0xd63a2a, locked ? 0.95 : 0.6).strokePoints(b, true);
    }
  }

  onDeath() { this.cleanupG(); }
  cleanupG() { if (this.g) { this.g.destroy(); this.g = null; } }
  destroy() { this.cleanupG(); super.destroy(); }
}

registerEnemy('bouncer', Bouncer, { heavy: true });
