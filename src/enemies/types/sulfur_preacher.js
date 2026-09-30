// SULFUR PREACHER (floor 4, support, kill-first; CHAPTER2 s3 no. 5). Holds ~380 px from the player (strafing a little) and backs away faster
// when pressed inside 260 px. Every 4.0 s he CHANTS: 0.6 s windup (arms up = frame 4, a yellow rune ring swells to r 260), then every OTHER enemy
// inside the ring gets SULFUR WARD 3.0 s (`wardT`: takeHit x0.5, yellow shimmer). A repeat ward adds time (capped at 6 s), never strength.
// The ward ends the instant he dies. With no ally in range he lobs one aimed ember every 2.5 s instead (0.4 s windup + aim line).
// Bosses are never warded (their damage windows stay per doc).
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { DEPTH, actorDepth } from '../../config.js';
import Phaser from 'phaser';
import { enemyRng, avoid, sfx, warnDepth } from '../parts/fe_e2/common.js';

const KEEP = 380, FLEE = 260, RANGE = 260;
const CHANT_CD = 4.0, CHANT_WIND = 0.6, WARD_T = 3.0, WARD_CAP = 6.0, SING = 0.5;
const EMBER_CD = 2.5, EMBER_WIND = 0.4, EMBER_SPEED = 260;
const YELLOW = 0xd8c43a, RUNES = 12, TAU = Math.PI * 2;

class SulfurPreacher extends Enemy {
  init() {
    this.rn = enemyRng(this);
    this.setState('move');
    this.chantCd = 1.6 + this.rn.float(0, 0.8);
    this.emberCd = 1.2 + this.rn.float(0, 0.6);
    this.strafe = this.rn.sign();
    this.strafeT = this.rn.float(1.2, 2.2);
    this.ringT = 0; // seconds the ring stays after a chant
    this.ringOn = false;
    this.spin = 0;
    this.aimA = 0;
    this.warded = []; // enemies carrying MY ward (shimmer + instant removal on death)
    this.glows = [];
    this.moteT = 0;
    this.g = null;
  }

  // ------------------------------------------------------------------------------------------ AI
  ai(dt) {
    const p = this.player;
    this.faceToward(p.x);
    this.chantCd -= dt;
    this.emberCd -= dt;
    if (this.state !== 'move') { this.stop(); return; }
    this.setPose('move');
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = this.rn.float(1.2, 2.2); }
    const d = this.distToPlayer();
    this.keepDistance(KEEP, this.strafe * 0.4, d < FLEE ? this.speed * 1.2 : this.speed, 50);
    avoid(this);
    if (this.chantCd <= 0 && this.alliesInRange() > 0) this.startChant();
    else if (this.emberCd <= 0 && d < 720 && this.alliesInRange() === 0) this.startEmber();
  }

  alliesInRange() {
    const list = this.scene.enemies;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === this || !e.alive || e.isBoss) continue;
      if ((e.x - this.x) ** 2 + (e.y - this.y) ** 2 <= RANGE * RANGE) n++;
    }
    return n;
  }

  // ------------------------------------------------------------------------------------------ chant / ward
  startChant() {
    this.setState('chant');
    this.stop();
    this.chantCd = this.cd(CHANT_CD);
    this.ringOn = true;
    this.ringT = CHANT_WIND + WARD_T;
    sfx('holy_chime', 'zombie_groan', { vol: 0.55, rate: 0.55 });
    this.telegraph(CHANT_WIND, () => this.endChant());
  }

  endChant() {
    if (!this.alive) return;
    this.setState('sing');
    this.setPose('attack');
    const list = this.scene.enemies, fx = this.scene.fx;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === this || !e.alive || e.isBoss) continue;
      if ((e.x - this.x) ** 2 + (e.y - this.y) ** 2 > RANGE * RANGE) continue;
      e.wardT = Math.min(WARD_CAP, (e.wardT || 0) + WARD_T);
      e._wardSrc = this;
      e.refreshTint();
      if (this.warded.indexOf(e) < 0) this.warded.push(e);
      fx.burst(e.x, e.y - e.radius, { color: [YELLOW, 0xfff0a0], count: 6, speed: [30, 110], life: [300, 600], scale: [1.4, 2.4], gravity: -40, blend: 'ADD' });
      n++;
    }
    fx.ringPulse(this.x, this.y, YELLOW, RANGE * 0.5, 420, 0.8);
    if (n) sfx('holy_chime', 'zombie_groan', { vol: 0.4, rate: 1.1 });
    this.after(SING, () => { if (this.state === 'sing') { this.setState('move'); this.setPose('move'); } });
  }

  /** The ward is his: it ends the instant he does. */
  endWard() {
    const w = this.warded;
    for (let i = 0; i < w.length; i++) {
      const e = w[i];
      if (e._wardSrc === this) { e._wardSrc = null; if (e.alive && e.wardT > 0) { e.wardT = 0; e.refreshTint(); } }
    }
    w.length = 0;
  }

  // ------------------------------------------------------------------------------------------ lone ember
  startEmber() {
    this.setState('aim');
    this.stop();
    this.emberCd = this.cd(EMBER_CD);
    const a = this.aimA = this.angleToPlayer();
    this.scene.fx.warnLine(this.x, this.y - 20, this.x + Math.cos(a) * 240, this.y - 20 + Math.sin(a) * 240, 22, EMBER_WIND, 0xe0c030);
    this.telegraph(EMBER_WIND, () => {
      if (!this.alive) return;
      this.setPose('attack');
      this.shoot(this.aimA, { kind: 'ember', speed: EMBER_SPEED, damage: 1, offset: 30, up: 34 });
      sfx('fire_whoosh', null, { vol: 0.45, rate: 1.2 });
      this.after(0.35, () => { if (this.state === 'aim') { this.setState('move'); this.setPose('move'); } });
    });
  }

  // ------------------------------------------------------------------------------------------ visuals
  update(dt) {
    super.update(dt);
    if (this.alive) this.tickVisuals(dt);
  }

  tickVisuals(dt) {
    this.spin += dt;
    if (this.ringOn) {
      this.ringT -= dt;
      if (this.ringT <= 0) { this.ringOn = false; if (this.g) this.g.clear(); } else this.drawRing();
    }
    // ward shimmer on every enemy still carrying my ward
    const w = this.warded;
    this.moteT -= dt;
    const mote = this.moteT <= 0;
    if (mote) this.moteT = 0.3;
    for (let i = w.length - 1; i >= 0; i--) {
      const e = w[i];
      if (!e.alive || !(e.wardT > 0) || e._wardSrc !== this) {
        if (this.glows[i]) this.glows[i].setVisible(false);
        w.splice(i, 1);
        continue;
      }
      let gl = this.glows[i];
      if (!gl || !gl.scene) gl = this.glows[i] = this.scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(YELLOW);
      gl.setVisible(true).setPosition(e.x, e.footY - e.radius * 0.9).setScale((e.radius * 3.4) / 128)
        .setAlpha(0.28 + 0.14 * Math.sin(this.spin * 7 + i)).setDepth(actorDepth(e.footY) + 0.005);
      if (mote) this.scene.fx.burst(e.x, e.y - e.radius, { color: [YELLOW, 0xfff0a0], count: 1, speed: [10, 40], life: [350, 600], scale: [1.2, 2], gravity: -60, blend: 'ADD' });
    }
    for (let i = w.length; i < this.glows.length; i++) if (this.glows[i]) this.glows[i].setVisible(false);
  }

  drawRing() {
    if (!this.g || !this.g.scene) { this.g = this.scene.add.graphics(); this.g.__noSnap = true; }
    const g = this.g, room = this.scene.room;
    g.setDepth(room && room.darkMask ? warnDepth(room) : DEPTH.decals + 5);
    g.clear();
    const winding = this.state === 'chant';
    const k = winding ? Math.min(1, this.stateTime / CHANT_WIND) : 1;
    const left = this.ringT;
    const fade = winding ? 1 : Math.min(1, left / 0.5);
    const r = RANGE * (0.25 + 0.75 * k * (2 - k)); // ease-out swell
    const x = this.x, y = this.y;
    g.fillStyle(YELLOW, (winding ? 0.06 + 0.1 * k : 0.08) * fade).fillCircle(x, y, r);
    g.lineStyle(4, YELLOW, (0.45 + 0.4 * k) * fade).strokeCircle(x, y, r);
    g.lineStyle(3, 0xfff0a0, 0.55 * fade);
    const ri = r - 14, a0 = this.spin * (winding ? 2.4 : 0.9);
    for (let i = 0; i < RUNES; i++) { // rotating rune dashes
      const a = a0 + (i / RUNES) * TAU;
      g.beginPath();
      g.arc(x, y, ri, a, a + 0.13, false);
      g.strokePath();
    }
  }

  destroy() {
    this.endWard();
    if (this.g) { this.g.destroy(); this.g = null; }
    for (const gl of this.glows) if (gl) gl.destroy();
    this.glows.length = 0;
    super.destroy();
  }
}

registerEnemy('sulfur_preacher', SulfurPreacher);
