// JOKER (floor 6, blinker): a harlequin imp that strafes at ~320 px (120 px/s) and every 2.4 s: laughs 0.4 s (pose 4, vulnerable) -> vanishes in a puff
// (invulnerable 0.4 s; a small ring shows where he will reappear) -> reappears 260-520 px from you on a walkable tile, and a JACK-IN-THE-BOX pops up
// 40-80 px from you: purple Dynamite subclass, r 110 ring filling over a 1.5 s fuse, then 1 dmg + 6 confetti shard bullets (speed 240). Max 2 boxes per
// joker; boxes never hurt enemies; killing the joker defuses his boxes. The box drops beside the player (not the joker) so it is the threat, and the
// 1.5 s ring is the telegraph.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { rng } from '../../core/rng.js';
import { JackBox, pickBlinkSpot } from '../parts/e6/props.js';

const PERIOD = 2.4;
const LAUGH = 0.4;
const VANISH = 0.4;
const MAX_BOXES = 2;
const HOLD = 320;
const PUFF = [0xd63a2a, 0x1a1414, 0xf2e6c8, 0xffd23a];
let uid = 0;
const SPOT = { x: 0, y: 0 };

class Joker extends Enemy {
  init(opts) {
    this.rnd = rng.game.fork(`joker:${++uid}`);
    const r = this.rnd;
    this.setState('strafe');
    this.strafe = r.sign();
    this.strafeT = 1 + r.next();
    this.blinkCd = (opts && opts.instant ? 0.9 : 1.1) + r.next() * 0.9;
    this.boxes = [];
    this.baseContact = this.contactDamage;
    this.dest = { x: 0, y: 0, ok: false };
  }

  ai(dt) {
    const p = this.player;
    this.faceToward(p.x);
    switch (this.state) {
      case 'strafe': {
        this.setPose('move');
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = 1.2 + this.rnd.next() * 1.2; }
        this.keepDistance(HOLD, this.strafe, this.speed, 50);
        this.blinkCd -= dt;
        if (this.blinkCd <= 0) this.laugh();
        break;
      }
      case 'laugh': case 'vanish': this.stop(); break;
      default: break;
    }
  }

  laugh() {
    this.setState('laugh');
    this.stop();
    Sfx.play('devil_laugh', { vol: 0.45, rate: 1.6, gap: 0.3 });
    this.telegraph(LAUGH, () => this.vanish());
  }

  vanish() {
    const s = this.scene, fx = s.fx;
    this.setState('vanish');
    this.invulnerable = true;
    this.contactDamage = 0;
    this.alphaOverride = 0;
    if (this.shadow) this.shadow.setAlpha(0);
    this.puff();
    Sfx.play('spawn', { vol: 0.4, rate: 1.5, gap: 0.1 });
    const d = this.dest;
    d.ok = s.room ? pickBlinkSpot(s.room, this, this.player.x, this.player.y, this.rnd, SPOT) : false;
    if (d.ok) { d.x = SPOT.x; d.y = SPOT.y; fx.ringPulse(d.x, d.y, 0xb070ff, 60, VANISH * 1000, 0.7); }
    this.after(VANISH, () => this.appear());
  }

  appear() {
    const s = this.scene;
    const d = this.dest;
    if (d.ok) { this.x = d.x; this.y = d.y; this.vx = this.vy = 0; this.moveBy(0, 0); }
    this.alphaOverride = undefined;
    if (this.shadow) this.shadow.setAlpha(1);
    this.invulnerable = false;
    this.puff();
    this.setState('strafe');
    this.setPose('move');
    this.blinkCd = this.cd(PERIOD - LAUGH - VANISH);
    this.after(0.35, () => { this.contactDamage = this.baseContact; }); // never punish a blink that lands next to you
    this.dropBox();
  }

  dropBox() {
    const s = this.scene, p = this.player;
    for (let i = this.boxes.length - 1; i >= 0; i--) if (!this.boxes[i].alive) this.boxes.splice(i, 1);
    if (this.boxes.length >= MAX_BOXES || !s.room || p.dead) return;
    const a = this.rnd.next() * 6.283, off = 40 + this.rnd.next() * 40;
    const w = s.room.walkableNear(p.x + Math.cos(a) * off, p.y + Math.sin(a) * off);
    this.boxes.push(new JackBox(s, w.x, w.y, { owner: this, fuse: 1.5, radius: 110, angle0: this.rnd.next() * 6.283 }));
  }

  puff() {
    const fx = this.scene.fx;
    fx.burst(this.x, this.footY - 30, { color: PUFF, count: 14, speed: [60, 220], life: [300, 650], scale: [1.4, 2.8], gravity: 120 });
    fx.dust(this.x, this.footY, 0.9);
  }

  onWallHit() { this.strafe = -this.strafe; }

  onDeath() {
    for (const b of this.boxes) if (b.alive) b.defuse();
    this.boxes.length = 0;
    this.scene.fx.burst(this.x, this.footY - 30, { color: PUFF, count: 12, speed: [80, 260], life: [350, 800], scale: [1.4, 2.8], gravity: 300 });
  }
}

registerEnemy('joker', Joker);
