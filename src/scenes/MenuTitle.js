// Title screen stack for MenuScene (STORY_PRESENTATION s5.5): four painted layers with mouse parallax and a little code-drawn life.
//   title_l0_sky   opaque sky, drifts +/-20 px over 40 s, parallax 6 px
//   title_l1_town  ghost-town silhouette band, parallax 14 px, per-window additive glow flicker (window coordinates measured on the art, WINDOWS below)
//   title_l2_fg    foreground (road, cacti, lamp-post), parallax 30 px, lantern glow flickers 0.75-1.0 at ~9 Hz (smoothed noise) + warm light pool on the road
//   title_l3_rider the gunslinger from behind: breathing scaleY 1.000-1.014 (3.4 s) + 0.4 deg sway, hidden after the true ending
// Code extras: a tumbleweed rolls across the road every 22-38 s, two crow silhouettes cross the sun every ~40 s. Progress tints (tint only): first win sky 0xffc890,
// true ending 0xffe2b0; setHell(true) = sky 0xff6a5a + distant lightning (white flash 90 ms every 15-25 s). Every layer is optional: without `title_l0_sky` the
// scene falls back to the single `title_bg` image with its slow zoom. No per-frame allocation (fixed objects, plain numbers).
import Assets from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';
import { RNG } from '../core/rng.js';
import { W, H } from '../config.js';

const CX = W / 2, CY = H / 2;
const D = { sky: -30, crow: -29, town: -28, glow: -27, fg: -26, lamp: -25, weed: -24, rider: -23 }; // menu text sits at depth 0, above all of it
// measured on title_l1_town.png (1440x960): the five lit amber windows, the saloon's red windows and doorway
const WINDOWS = [[430, 758, 0.55], [590, 738, 0.7], [701, 755, 0.55], [945, 755, 0.6], [1049, 749, 0.55]];
const SALOON = [[1226, 620, 0.9], [1344, 632, 0.9], [1232, 728, 0.9], [1357, 738, 0.9], [1296, 728, 1.3]];
const LAMP = { x: 1220, y: 500 };
const PAR = { sky: 6, town: 14, fg: 30 }; // px of mouse parallax at the screen edge
const DRIFT = 20, DRIFT_S = 40;
const RIDER = { x: 1100, y: 862, scale: 0.72 };
const SKY_TINT = { won: 0xffc890, true: 0xffe2b0, hell: 0xff6a5a };

const lerpColor = (a, b, k) => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((ar + (br - ar) * k) << 16) | ((ag + (bg - ag) * k) << 8) | (ab + (bb - ab) * k);
};

export default class TitleLayers {
  /** opts: { won, trueEnding } from the save. */
  constructor(scene, { won = false, trueEnding = false } = {}) {
    this.s = scene;
    this.rng = new RNG((Date.now() >>> 0) ^ 0x51ed);
    this.t = 0;
    this.mx = 0; // smoothed mouse offset -1..1
    this.layered = Assets.has('title_l0_sky');
    this.baseTint = trueEnding ? SKY_TINT.true : won ? SKY_TINT.won : 0xffffff;
    this.hell = 0; this.hellTarget = 0;
    this.lightning = null;
    this.parts = [];
    this.noise = 0.9; this.noiseT = 0;
    this.lamp = null;
    if (!this.layered) {
      const bg = Assets.makeImage(scene, CX, CY, 'title_bg');
      bg.setDepth(D.sky);
      if (this.baseTint !== 0xffffff && bg.setTint) bg.setTint(this.baseTint);
      scene.tweens.add({ targets: bg, scale: 1.045, duration: 22000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.sky = null;
      this.flat = bg;
      return;
    }
    const mk = (key, depth, par) => {
      if (!Assets.has(key)) return null;
      const im = Assets.makeImage(scene, CX, CY, key).setDepth(depth);
      const sc = 1 + (2 * (par + (key === 'title_l0_sky' ? DRIFT : 0)) + 4) / W; // grown so the parallax never shows an edge
      im.setScale(sc);
      im.__sc = sc;
      return im;
    };
    this.sky = mk('title_l0_sky', D.sky, PAR.sky);
    this.sky.setTint(this.baseTint);
    this.town = mk('title_l1_town', D.town, PAR.town);
    this.fg = mk('title_l2_fg', D.fg, PAR.fg);
    this.buildGlows();
    this.buildRider(trueEnding);
    this.buildExtras();
    this.nextWeed = this.t + this.rng.float(6, 14) * 1000; // first tumbleweed arrives a little sooner than the 22-38 s cycle
    this.nextCrows = this.t + this.rng.float(10, 18) * 1000;
  }

  /** Position on screen of a point that lives on a layer scaled about the screen centre and shifted by `off`. */
  place(o, x, y, layer, off) {
    const sc = layer ? layer.__sc : 1;
    o.setPosition(CX + (x - CX) * sc + off, CY + (y - CY) * sc);
  }

  buildGlows() {
    const s = this.s;
    if (!s.textures.exists('glow')) return;
    this.win = [];
    if (this.town) {
      for (const [x, y, k] of WINDOWS) {
        const g = s.add.image(0, 0, 'glow').setDepth(D.glow).setBlendMode('ADD').setTint(0xffa030).setScale(k).setAlpha(0.5);
        this.win.push({ g, x, y, base: k, ph: this.rng.float(0, 6.28), sp: this.rng.float(0.7, 1.5), kind: 0 });
      }
      for (const [x, y, k] of SALOON) {
        const g = s.add.image(0, 0, 'glow').setDepth(D.glow).setBlendMode('ADD').setTint(0xff3a1a).setScale(k).setAlpha(0.4);
        this.win.push({ g, x, y, base: k, ph: this.rng.float(0, 6.28), sp: 0.5, kind: 1 });
      }
    }
    if (this.fg) {
      this.lampG = s.add.image(0, 0, 'glow').setDepth(D.lamp).setBlendMode('ADD').setTint(0xffb040).setScale(1.5).setAlpha(0.85);
      this.pool = s.add.ellipse(0, 0, 600, 90, 0xffa040, 0.16).setDepth(D.lamp).setBlendMode('ADD');
    }
  }

  buildRider(trueEnding) {
    const s = this.s;
    this.rider = null;
    if (trueEnding || !Assets.has('title_l3_rider')) return; // after the true ending the road is empty
    this.rider = Assets.makeImage(s, RIDER.x, RIDER.y, 'title_l3_rider').setOrigin(0.5, 1).setDepth(D.rider).setScale(RIDER.scale);
    this.rider.__sc = RIDER.scale;
  }

  buildExtras() {
    const s = this.s;
    this.weed = null; this.crows = [];
    if (Assets.has('enemy_tumbleweed')) {
      this.weed = s.add.sprite(-200, 912, 'enemy_tumbleweed', 0).setTint(0x3a2a1e).setScale(0.8).setDepth(D.weed).setVisible(false);
      this.weedX = 0; this.weedV = 0; this.weedOn = false; this.weedT = 0;
    }
    if (Assets.has('enemy_crow')) {
      for (let i = 0; i < 2; i++) {
        const c = s.add.sprite(-200, 500, 'enemy_crow', 0).setTint(0x000000).setScale(0.9).setDepth(D.crow).setVisible(false);
        c.on = false; c.t = 0; c.vx = 0; c.y0 = 0; c.ph = 0;
        this.crows.push(c);
      }
    }
  }

  /** Hell sky tint + lightning (a HELL ON EARTH chip hovered / selected somewhere on the title flow). */
  setHell(on) {
    this.hellTarget = on ? 1 : 0;
    this.lightningAt = on ? this.t + this.rng.float(2, 6) * 1000 : 0;
  }

  update(time, dt) {
    if (!this.layered) return;
    this.t += dt;
    const s = this.s, p = s.input.activePointer;
    const target = Math.max(-1, Math.min(1, ((p && p.x != null ? p.x : CX) - CX) / CX));
    this.mx += (target - this.mx) * Math.min(1, dt / 1000 * 3.5);
    const m = this.mx;
    const drift = Math.sin((this.t / (DRIFT_S * 1000)) * Math.PI * 2) * DRIFT;
    if (this.sky) this.sky.x = CX - m * PAR.sky + drift * 0.999;
    const townOff = -m * PAR.town, fgOff = -m * PAR.fg;
    if (this.town) this.town.x = CX + townOff;
    if (this.fg) this.fg.x = CX + fgOff;
    if (this.rider) {
      const k = (this.t / 3400) * Math.PI * 2;
      this.rider.setPosition(RIDER.x + fgOff, RIDER.y);
      this.rider.setScale(RIDER.scale, RIDER.scale * (1.007 + 0.007 * Math.sin(k)));
      this.rider.setAngle(0.4 * Math.sin(k * 0.5 + 1));
    }
    this.flicker(dt, townOff, fgOff);
    this.life(dt);
    this.weather(dt);
  }

  flicker(dt, townOff, fgOff) {
    // smoothed noise for the lantern: a new random target ~9 times a second, eased toward
    this.noiseT -= dt;
    if (this.noiseT <= 0) { this.noiseT = 1000 / 9; this.noiseTarget = 0.75 + this.rng.next() * 0.25; }
    this.noise += ((this.noiseTarget ?? 0.9) - this.noise) * Math.min(1, dt / 55);
    if (this.win) {
      for (const w of this.win) {
        const q = w.kind ? 0.55 + 0.25 * Math.sin(this.t / 1000 * w.sp + w.ph) : 0.5 + 0.22 * Math.sin(this.t / 1000 * w.sp * 2.3 + w.ph) * Math.sin(this.t / 1000 * w.sp * 0.7);
        w.g.setAlpha(q);
        this.place(w.g, w.x, w.y, this.town, townOff);
      }
    }
    if (this.lampG) {
      this.lampG.setAlpha(this.noise).setScale(1.35 + 0.25 * this.noise);
      this.place(this.lampG, LAMP.x, LAMP.y, this.fg, fgOff);
      this.pool.setAlpha(0.1 + 0.1 * this.noise);
      this.place(this.pool, LAMP.x + 30, 910, this.fg, fgOff);
    }
  }

  /** Tumbleweed and crows on their own timers. */
  life(dt) {
    const dts = dt / 1000;
    if (this.weed) {
      if (!this.weedOn && this.t >= this.nextWeed) {
        this.weedOn = true; this.weedX = -120; this.weedT = 0; this.weedV = this.rng.float(150, 210);
        this.weed.setVisible(true);
      }
      if (this.weedOn) {
        this.weedX += this.weedV * dts; this.weedT += dts;
        const bounce = Math.abs(Math.sin(this.weedT * 3.4)) * 26;
        this.weed.setPosition(this.weedX, 918 - bounce).setAngle(this.weedT * 260);
        this.weed.setFrame(Math.floor(this.weedT * 8) % 4);
        if (this.weedX > W + 140) { this.weedOn = false; this.weed.setVisible(false); this.nextWeed = this.t + this.rng.float(22, 38) * 1000; }
      }
    }
    if (this.crows.length) {
      if (this.t >= this.nextCrows && !this.crows[0].on) {
        const y0 = this.rng.float(470, 540), vx = this.rng.float(105, 140);
        this.crows.forEach((c, i) => { c.on = true; c.t = 0; c.vx = vx * (i ? 0.92 : 1); c.y0 = y0 + (i ? 42 : 0); c.ph = this.rng.float(0, 6); c.setPosition(-80 - i * 90, c.y0).setVisible(true); });
        this.nextCrows = this.t + this.rng.float(36, 46) * 1000;
      }
      for (const c of this.crows) {
        if (!c.on) continue;
        c.t += dts;
        c.x += c.vx * dts;
        c.y = c.y0 + Math.sin(c.t * 1.3 + c.ph) * 16;
        c.setFrame(Math.floor(c.t * 7) % 4);
        if (c.x > W + 100) { c.on = false; c.setVisible(false); }
      }
    }
  }

  /** Sky tint (progress + hell) and the distant lightning. */
  weather(dt) {
    if (!this.sky) return;
    if (this.hell !== this.hellTarget) {
      this.hell += Math.sign(this.hellTarget - this.hell) * Math.min(Math.abs(this.hellTarget - this.hell), dt / 600);
      this.sky.setTint(lerpColor(this.baseTint, SKY_TINT.hell, this.hell));
    }
    if (this.hellTarget && this.lightningAt && this.t >= this.lightningAt) {
      this.lightningAt = this.t + this.rng.float(15, 25) * 1000;
      this.strike();
    }
  }

  strike() {
    const s = this.s;
    if (!this.bolt) this.bolt = s.add.rectangle(CX, CY, W, H, 0xffffff, 0).setDepth(-20);
    this.bolt.setAlpha(0.55);
    s.tweens.add({ targets: this.bolt, alpha: 0, duration: 90 });
    Sfx.play('explosion', { vol: 0.15, rate: 0.4, gap: 0 });
  }

  destroy() { /* every object belongs to the scene's display list and dies with it */ }
}
