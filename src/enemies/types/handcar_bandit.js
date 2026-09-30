// HANDCAR BANDIT (CHAPTER2 s4 #1, F5 rail-bound shooter).
// Lane version: when the room template has a rail lane (row / column) within 1 tile of the spawn point, the bandit locks to it and pumps along the axis
// toward the player's projected coordinate at 260 px/s (reverses for 0.7 s when an obstacle blocks the rail). Free version: strafing gunman like `outlaw`, 180 px/s.
// Attack every 2.4 s (start-to-start): stop, 0.5 s aim windup (pose 4, pulse; aim locks at 0.2 s and a warn line shows for the last 0.3 s, doc says 0.2 s but
// telegraphs must stay >= 0.3 s), then 2 `spike` bullets 0.18 s apart along the locked aim (speed 340, dmg 1). A lane cart hits it for 14 (LaneSweep does that).
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { rng } from '../../core/rng.js';
import { ROOM, TILE } from '../../config.js';

const EVERY = 2.4;
const WINDUP = 0.5;
const LOCK_AT = 0.2; // aim locks this long into the windup; the warn line shows from then to the shot
const LINE_LEN = 620;
const DEAD_ZONE = 18;
const REVERSE_T = 0.7;

class HandcarBandit extends Enemy {
  init() {
    this.setState('move');
    this.shotCd = rng.game.float(0.9, 1.7);
    this.strafe = rng.game.sign();
    this.strafeT = rng.game.float(1, 2);
    this.lane = this.findLane();
    this.revT = 0;
    this.revDir = 0;
    this.aim = 0;
    if (this.lane) { if (this.lane.h) this.y = this.lane.center; else this.x = this.lane.center; } // snap onto the rail
  }

  /** Template lane (rail row / column) within 1 tile of the bandit, or null (free-roam version). */
  findLane() {
    const room = this.scene.room, defs = room && room.tpl && room.tpl.lanes;
    if (!defs || !defs.length) return null;
    let best = null, bd = TILE + 1;
    for (const d of defs) {
      const h = d.axis !== 'v';
      const center = (h ? ROOM.y : ROOM.x) + (d.index | 0) * TILE + TILE / 2;
      const dist = Math.abs((h ? this.y : this.x) - center);
      if (dist < bd) { bd = dist; best = { h, center }; }
    }
    return best;
  }

  ai(dt) {
    const p = this.player;
    this.faceToward(p.x);
    this.shotCd -= dt; // start-to-start cycle: keeps counting through the windup
    if (this.state === 'aim' || this.state === 'recoil') { this.stop(); this.holdLane(dt); return; }
    this.setPose('move');
    if (this.lane) this.slide(dt); else this.roam(dt);
    if (this.shotCd <= 0 && this.distToPlayer() < 760) this.fire();
  }

  /** Lane movement: slide along the rail toward the player's projected coordinate; perpendicular position is held on the rail. */
  slide(dt) {
    const L = this.lane, p = this.player, speed = this.meta.laneSpeed ?? 260;
    const along = L.h ? this.x : this.y;
    let dir = 0;
    if (this.revT > 0) { this.revT -= dt; dir = this.revDir; }
    else {
      const d = (L.h ? p.x : p.y) - along;
      dir = Math.abs(d) < DEAD_ZONE ? 0 : Math.sign(d);
    }
    const perp = (L.center - (L.h ? this.y : this.x)) * 10;
    const pv = perp > 200 ? 200 : perp < -200 ? -200 : perp;
    if (L.h) { this.vx = dir * speed; this.vy = pv; } else { this.vy = dir * speed; this.vx = pv; }
    this.dir = dir;
  }

  holdLane(dt) {
    const L = this.lane;
    if (!L) return;
    const perp = (L.center - (L.h ? this.y : this.x)) * 10;
    if (L.h) this.vy = perp; else this.vx = perp;
  }

  roam(dt) {
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = rng.game.float(1.2, 2.4); }
    this.keepDistance(380, this.strafe, this.speed, 60);
  }

  fire() {
    this.shotCd = this.cd(EVERY);
    this.setState('aim');
    this.stop();
    this.after(LOCK_AT, () => {
      this.aim = this.angleToPlayer();
      const a = this.aim, ox = this.x + Math.cos(a) * 30, oy = this.y - 18 + Math.sin(a) * 30;
      this.scene.fx.warnLine(ox, oy, ox + Math.cos(a) * LINE_LEN, oy + Math.sin(a) * LINE_LEN, 26, WINDUP - LOCK_AT);
      Sfx.play('gun_cock', { vol: 0.5 });
    });
    this.telegraph(WINDUP, () => {
      this.volley();
      this.after(0.18, () => { if (this.alive) this.volley(); });
      this.after(0.18 + 0.3, () => { this.setPose('move'); this.setState('move'); });
    });
  }

  volley() {
    const a = this.aim;
    this.setPose('attack');
    this.setState('recoil');
    this.shoot(a, { speed: 340, damage: 1, kind: 'spike', offset: 40, up: 18, life: 2.4 });
    this.scene.fx.muzzle(this.x + Math.cos(a) * 46, this.y - 22 + Math.sin(a) * 20, a, 0.8);
    Sfx.play('shoot_2', { vol: 0.4, detune: -300 });
  }

  onWallHit() {
    if (!this.lane) { this.strafe *= -1; return; }
    if (this.revT <= 0 && this.dir) { this.revT = REVERSE_T; this.revDir = -this.dir; }
  }
}

registerEnemy('handcar_bandit', HandcarBandit, { fps: 10 });
