// CARD SHARK (floor 6, CHAPTER2 s5 enemy 1): dapper demon gambler. Holds ~340 px and strafes. Every volley: windup 0.5 s (arm raised;
// the last 0.2 s draws the locked aim line plus the two curving side arcs), then 3 `card` bullets 0.12 s apart at 360 px/s, curving
// -40 / 0 / +40 deg/s (the outer two start slightly off-axis so the cluster crosses the aim line and then fans out). After the deal it
// stands still to shuffle for 1.0 s (frame 3, cards flying; takes x1.25 damage). Volley cadence: 2.2 s after the last card.
// Death: 6 harmless cosmetic cards (normal coin drop, 15 % of which is a nickel).
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { DEPTH } from '../../config.js';
import { enemyRng, bulletK, holdFrame } from '../parts/FE-E5/common.js';

const HOLD = 340, TOL = 50, WINDUP = 0.5, LINE_T = 0.2, CARDS = 3, CARD_GAP = 0.12, CARD_SPEED = 360, CARD_LIFE = 1.9;
const CURVES = [-40, 0, 40]; // deg/s per card
const SHUFFLE = 1.0, COOLDOWN = 2.2, SHUFFLE_VULN = 1.25, MAX_RANGE = 760;
const CONVERGE = 0.6; // how much of the arc the side cards pre-compensate (1 = all three cross exactly at the locked point)
const DEG = Math.PI / 180;

class CardShark extends Enemy {
  init() {
    this.rnd = enemyRng(this);
    this.setState('move');
    this.cdT = 0.9 + this.rnd.float(0, 1.1); // first volley soon after spawning
    this.strafe = this.rnd.sign();
    this.strafeT = this.rnd.float(1, 2);
    this.t = 0; // seconds in the current phase (real, not swift-scaled)
    this.dealt = 0;
    this.aimA = 0;
    this.aimT = 0;
    this.lineOn = false;
    this.gfx = null;
  }

  ai(dt) {
    const p = this.player;
    const raw = dt / (this.aiScale || 1); // telegraph / windup lengths ignore the swift affix
    this.faceToward(p.x);
    this.cdT -= dt; // the volley cooldown also runs through the deal and the shuffle
    switch (this.state) {
      case 'move': {
        holdMove(this);
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = this.rnd.float(1.2, 2.4); }
        this.keepDistance(HOLD, this.strafe, this.speed, TOL);
        if (this.cdT <= 0 && this.distToPlayer() < MAX_RANGE) this.startWindup();
        break;
      }
      case 'windup': {
        this.stop();
        this.t += raw;
        if (!this.lineOn && this.t >= WINDUP - LINE_T) this.lockAim();
        if (this.lineOn) this.gfx.setAlpha(0.65 + 0.35 * Math.sin(this.t * 60));
        if (this.t >= WINDUP) this.startDeal();
        break;
      }
      case 'deal': {
        this.stop();
        this.t += raw;
        while (this.dealt < CARDS && this.t >= this.dealt * CARD_GAP) this.throwCard(this.dealt++);
        if (this.dealt >= CARDS && this.t >= (CARDS - 1) * CARD_GAP + 0.14) this.startShuffle();
        break;
      }
      case 'shuffle': {
        this.stop();
        this.t += raw;
        if (this.t >= SHUFFLE) { this.setState('move'); this.t = 0; holdMove(this); }
        break;
      }
      default: break;
    }
  }

  startWindup() {
    this.setState('windup');
    this.t = 0;
    this.stop();
    holdFrame(this, 4, 'windup');
    this.pulse(WINDUP);
    Sfx.play('card_shuffle', { vol: 0.35, rate: 1.5 });
  }

  /** Lock the aim and draw the centre line + the two arcs the side cards will follow (they are the real paths, integrated the same way). */
  lockAim() {
    this.lineOn = true;
    this.aimA = this.angleToPlayer();
    this.aimT = Math.min(this.distToPlayer(), 520) / CARD_SPEED; // flight time to the locked point
    if (!this.gfx) this.gfx = this.scene.add.graphics().setDepth(DEPTH.decals + 8);
    const g = this.gfx;
    g.clear().setAlpha(1);
    const k = bulletK(this.scene), v = CARD_SPEED * k;
    const ox = this.x + Math.cos(this.aimA) * 30, oy = this.y + Math.sin(this.aimA) * 30 - 4;
    for (let i = 0; i < CARDS; i++) {
      const w = CURVES[i] * DEG;
      let h = this.cardHeading(i), x = ox, y = oy;
      g.lineStyle(i === 1 ? 5 : 3, 0xfff0c8, i === 1 ? 0.55 : 0.4);
      g.beginPath().moveTo(x, y);
      const steps = 12, dts = Math.min(CARD_LIFE, 500 / v) / steps;
      for (let s = 0; s < steps; s++) { x += Math.cos(h) * v * dts; y += Math.sin(h) * v * dts; h += w * dts; g.lineTo(x, y); }
      g.strokePath();
    }
  }

  /** Initial heading of card i: the side cards start off-axis so their arcs cross the aim line near the locked target. */
  cardHeading(i) {
    const w = CURVES[i] * DEG;
    return this.aimA - w * this.aimT * 0.5 * CONVERGE;
  }

  startDeal() {
    this.setState('deal');
    this.t = 0;
    this.dealt = 0;
    this.lineOn = false;
    if (this.gfx) this.gfx.clear();
    holdFrame(this, 5, 'attack');
  }

  throwCard(i) {
    const a = this.cardHeading(i);
    this.shoot(a, { speed: CARD_SPEED, damage: 1, kind: 'card', radius: 12, curve: CURVES[i], life: CARD_LIFE, offset: 30, up: 4, lift: 40, rotate: true });
    Sfx.play('card_throw', { vol: 0.5, detune: (i - 1) * 120 });
  }

  startShuffle() {
    this.setState('shuffle');
    this.t = 0;
    this.cdT = this.cd(COOLDOWN);
    holdFrame(this, 3, 'shuffle'); // cards flying around the hand
    Sfx.play('card_shuffle', { vol: 0.6 });
    this.scene.fx.burst(this.x, this.y - 44, { color: [0xf4ecd8, 0xd63a2a], count: 6, speed: [40, 150], life: [300, 600], scale: [1.5, 2.6], gravity: 260 });
  }

  damageMultiplier() { return this.state === 'shuffle' ? SHUFFLE_VULN : 1; }

  onWallHit() { this.strafe = -this.strafe; }

  onDeath() {
    if (this.gfx) { this.gfx.destroy(); this.gfx = null; }
    const s = this.scene;
    Sfx.play('card_flip', { vol: 0.5 });
    // 6 cosmetic cards: white rect + red pip, flung out, spun, faded
    const n = 6, base = this.rnd.float(0, 6.28);
    for (let i = 0; i < n; i++) {
      const a = base + (i / n) * 6.283 + this.rnd.float(-0.25, 0.25), d = this.rnd.float(50, 120);
      const c = s.add.image(this.x, this.y - 40, 'px').setTint(0xf6eedb).setDepth(DEPTH.fx).setDisplaySize(13, 19).setAngle(this.rnd.float(0, 360));
      s.fx._track(c);
      s.tweens.add({ targets: c, x: this.x + Math.cos(a) * d, y: { value: this.y + Math.sin(a) * d * 0.5 + 8, ease: 'Bounce.easeOut' }, angle: c.angle + this.rnd.float(-360, 360), duration: 640, onComplete: () => {
        s.tweens.add({ targets: c, alpha: 0, delay: 500, duration: 500, onComplete: () => { if (c.scene) c.destroy(); } });
      } });
    }
  }

  destroy() {
    if (this.gfx) { this.gfx.destroy(); this.gfx = null; }
    super.destroy();
  }
}

function holdMove(e) { e.setPose('move'); }

registerEnemy('card_shark', CardShark, { hp: 18, r: 30, speed: 100, floors: [6], weight: 3, threat: 2, frame: 128 });
