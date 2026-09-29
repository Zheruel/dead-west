// BAT (floor 3): erratic fast flyer, comes in swarms of 3-4 (template slots / released by coffins). Flutters around the player on a
// wobbling orbit, then dives: screech + warn line (0.4 s), straight dash through the player's position, then breaks away.
// Dives are staggered swarm-wide (scene._batNext) so a pack never dives in the same instant. Contact damage is light (1 unit).
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { darkLine } from '../f3fx.js';

const FLUTTER = 190;
const DIVE_SPEED = 470;
const AIM = 0.4; // dive telegraph
const DIVE_T = 0.6;

class Bat extends Enemy {
  init(opts) {
    this.setState('flutter');
    this.t = Math.random() * 10;
    this.orbitA = Math.random() * 6.28;
    this.orbitDir = Math.random() < 0.5 ? -1 : 1;
    this.orbitR = 170 + Math.random() * 150;
    this.jitter = 0;
    this.diveCd = (opts.released ? 0.7 : 1.0) + Math.random() * 1.6;
    this.diveA = 0;
    this.warn = null;
    this.baseAir = this.meta.air ?? 50;
    if (opts.released) { const a = Math.random() * 6.28; this.vx = Math.cos(a) * 240; this.vy = Math.sin(a) * 240; }
  }

  ai(dt) {
    const p = this.player, s = this.scene;
    this.t += dt;
    this.airHeight = this.baseAir + Math.sin(this.t * 9) * 7;
    switch (this.state) {
      case 'flutter': {
        this.setPose('move');
        this.orbitA += dt * this.orbitDir * 1.7;
        const tx = p.x + Math.cos(this.orbitA) * this.orbitR, ty = p.y + Math.sin(this.orbitA) * this.orbitR * 0.75;
        this.jitter += (Math.random() - 0.5) * dt * 26;
        this.jitter *= Math.exp(-dt * 2.2);
        const ang = Math.atan2(ty - this.y, tx - this.x) + this.jitter + Math.sin(this.t * 6.5 + this.orbitR) * 0.55;
        const k = Math.min(1, dt * 5);
        this.vx += (Math.cos(ang) * FLUTTER - this.vx) * k;
        this.vy += (Math.sin(ang) * FLUTTER - this.vy) * k;
        if (Math.random() < dt * 0.6) this.orbitDir *= -1;
        this.diveCd -= dt;
        if (this.diveCd <= 0 && this.distToPlayer() < 720 && s.time.now >= (s._batNext || 0)) this.startDive();
        break;
      }
      case 'aim': { // hover in place, screeching, while the line fills
        this.vx *= Math.exp(-dt * 8); this.vy *= Math.exp(-dt * 8);
        this.airHeight = this.baseAir + Math.sin(this.t * 40) * 3;
        break;
      }
      case 'dive': {
        if (this.stateTime > DIVE_T) this.endDive();
        break;
      }
      default: break;
    }
    this.faceToward(p.x);
  }

  startDive() {
    const s = this.scene;
    s._batNext = s.time.now + 380; // stagger swarm dives
    this.setState('aim');
    this.diveA = this.angleToPlayer();
    const len = Math.min(560, this.distToPlayer() + 220);
    this.warn = darkLine(s, this.x, this.y, this.x + Math.cos(this.diveA) * len, this.y + Math.sin(this.diveA) * len, 40, AIM);
    Sfx.play('bat_screech', { vol: 0.65, rate: 0.9 + Math.random() * 0.4 });
    this.telegraph(AIM, () => {
      this.warn = null;
      this.setState('dive');
      this.setPose('attack');
      this.moveAngle(this.diveA, DIVE_SPEED);
      s.fx.dust(this.x, this.y + 10, 0.5);
    });
  }

  endDive() {
    this.setPose('move');
    this.setState('flutter');
    this.diveCd = 1.4 + Math.random() * 1.8;
    this.orbitA = Math.atan2(this.y - this.player.y, this.x - this.player.x); // fly off from where it ended up
  }

  onWallHit(nx, ny) {
    if (this.state === 'dive') { this.endDive(); return; }
    const d = this.vx * nx + this.vy * ny;
    if (d < 0) { this.vx -= 2 * d * nx; this.vy -= 2 * d * ny; }
    this.orbitDir *= -1;
  }

  destroy() {
    if (this.warn) { this.warn.destroy(); this.warn = null; }
    super.destroy();
  }
}

registerEnemy('bat', Bat, { hp: 8, r: 22, hitR: 30, speed: 260, floors: [3], weight: 2, flying: true, air: 50, fps: 14 });
