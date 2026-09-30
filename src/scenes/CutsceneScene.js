// Data-driven cutscene player (STORY_PRESENTATION s5.1). Data: src/data/story/cutscenes.js. Registered at runtime by src/scenes/ending.js.
//
//   scene.start('Cutscene', { id, ctx: {char, clean, hell}, next: { scene, data } | { callback } })     standalone (Codex Reread, ?cutscene=)
//   scene.launch('Cutscene', { id, ctx, overlay: true, onDone, next: { callback } })                    over a running Game scene (flow.playCutscene)
//
// Every panel: full-screen image (Ken-Burns tween, optional tint), 96 px letterbox bars, typed caption (Special Elite 30 over a code-drawn gradient),
// timed sfx, optional parchment / stamp overlay, and a per-panel out transition (cut | fade | iris | ink | flash | slam).
// Input: Space/Enter/click complete the typing, then advance; hold Esc/Space 0.6 s skips everything (ring); an already seen cutscene skips on one Esc.
// `ledger` cutscenes are text-only rider cards. Missing images become a flagged placeholder panel; the caption still plays. The handoff (onDone /
// next) ALWAYS happens: skip, end, or a fail-safe timer of (estimated length + 10 s).
import Phaser from 'phaser';
import { W, H, FONT_TITLE, FONT_BODY } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx, Music, Ambience } from '../core/Audio.js';
import { bus } from '../core/events.js';
import { Save } from '../core/Save.js';
import { RNG, hashStr } from '../core/rng.js';
import { CUTSCENES, TINTS, panelCaption, panelAfter, overlayFor, autoDuration, estimateSeconds } from '../data/story/cutscenes.js';

const CPS = 42; // caption typewriter speed
const TICK_EVERY = 3; // one ui_type tick per 3 chars
const HOLD_SKIP = 0.6; // seconds of holding Esc / Space to skip the whole cutscene
const LB = 96; // letterbox bar height
const BONE = '#e8dcc0', INK = '#120c0a';
const D = { img: 0, grad: 10, cap: 20, ov: 30, bars: 40, hint: 45, fade: 50, flash: 55, iris: 60, ink: 62, ring: 70 };
const CAP_STYLE = { fontFamily: FONT_BODY, fontSize: '30px', color: BONE, stroke: INK, strokeThickness: 5 };
const LEDGER_CPS = 60;
const IRIS_R = Math.hypot(W, H) * 0.55;

export default class CutsceneScene extends Phaser.Scene {
  constructor() { super('Cutscene'); }

  init(data) { this.sd = data || {}; }

  create() {
    const d = this.sd;
    const c = d.ctx || {};
    this.id = d.id;
    this.cs = CUTSCENES[d.id] || null;
    this.ctx = { char: c.char || 'gunslinger', clean: !!c.clean, hell: !!c.hell };
    this.overlay = !!d.overlay;
    this.finished = false;
    this.handed = false;
    this.doneCalled = false;
    this.ledger = false;
    this.stampT = null;
    this.ov = null;
    this.ovd = null;
    this.timedI = 0;
    this.doneAt = 0;
    this.busy = false; // an out/in transition is running: no advancing
    this.pi = -1;
    this.pt = 0;
    this.holdKey = null;
    this.holdT = 0;
    this.texKeys = [];
    this.timed = [];
    this.ty = null;
    this.stage = 'idle';
    this.born = this.time.now;
    this.game.__cutscene = this;
    this.cameras.main.setBackgroundColor('#000000');
    this.scene.bringToTop();

    this.hookGame();
    this.events.once('shutdown', () => this.cleanup());
    if (!this.cs || (this.overlay && this.blockedMode())) { this.abort(); return; }
    bus.emit('story:cutscene', { id: this.id });

    this.build();
    this.bindInput();
    this.time.delayedCall((estimateSeconds(this.cs, this.ctx) + 10) * 1000, () => this.finish(true)); // fail-safe: the handoff always happens
    if (this.cs.kind === 'ledger' || this.cs.kind === 'card') this.startLedger(); else this.start();
  }

  // ------------------------------------------------------------------------------------------------ game hold (overlay mode)
  /** Daily / contract runs never play cutscenes (flow already checks; this guards ?cutscene= and direct launches). */
  blockedMode() {
    const g = this.scene.get('Game');
    const r = g && g.run;
    return !!(r && r.mode !== 'normal' && r.mode !== 'hell');
  }

  /** While an overlay plays over a live Game scene: no pause overlay (ESC / blur), the simulation stays frozen. */
  hookGame() {
    this.g = null;
    if (!this.overlay) return;
    const g = this.scene.get('Game');
    if (!g || !g.scene.isActive() || !g.player) return;
    this.g = g;
    this.prevPaused = g.paused;
    this.prevCutscene = g.cutscene;
    g.paused = true;
    g.cutscene = true;
  }

  releaseGame() {
    const g = this.g;
    if (!g) return;
    this.g = null;
    g.paused = !!this.prevPaused;
    g.cutscene = !!this.prevCutscene;
    if (g.gameInput && g.gameInput.reset) { try { g.gameInput.reset(); } catch (e) { /* */ } }
  }

  // ------------------------------------------------------------------------------------------------ build
  build() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000).setDepth(D.img - 1);
    this.img = this.add.image(W / 2, H / 2, '__DEFAULT').setDepth(D.img).setVisible(false);
    if (!this.textures.exists('cs_grad')) { // caption gradient: black 0 -> 0.7 over 260 px
      const t = this.textures.createCanvas('cs_grad', 4, 260);
      const ctx = t.getContext();
      const gr = ctx.createLinearGradient(0, 0, 0, 260);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, 4, 260);
      t.refresh();
    }
    this.grad = this.add.image(W / 2, H, 'cs_grad').setOrigin(0.5, 1).setDisplaySize(W, 260).setDepth(D.grad).setVisible(false);
    this.capT = [0, 1].map(() => this.add.text(0, 0, '', CAP_STYLE).setOrigin(0, 0.5).setDepth(D.cap));
    this.barT = this.add.rectangle(W / 2, -LB / 2, W, LB, 0x000000).setDepth(D.bars);
    this.barB = this.add.rectangle(W / 2, H + LB / 2, W, LB, 0x000000).setDepth(D.bars);
    this.hint = this.add.text(W - 40, H - LB / 2, Save.flag(`seen_${this.id}`) ? 'ESC  SKIP' : 'HOLD ESC  SKIP', { fontFamily: FONT_BODY, fontSize: '16px', color: '#a9987a' }).setOrigin(1, 0.5).setDepth(D.hint).setAlpha(0);
    this.fader = this.add.rectangle(W / 2, H / 2, W, H, this.sd.from === 'white' ? 0xffffff : 0x000000, 1).setDepth(D.fade); // from:'white' = the Sixth Bullet's fade to white
    this.flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(D.flash);
    this.ring = this.add.graphics().setDepth(D.ring);
    this.ringOn = false;
    this.irisRect = this.add.rectangle(W / 2, H / 2, W, H, 0x000000).setDepth(D.iris).setVisible(false);
    this.irisG = this.make.graphics({ add: false });
    this.irisMask = this.irisG.createGeometryMask();
    this.irisMask.setInvertAlpha(true);
    this.irisRect.setMask(this.irisMask);
    this.iris = { r: IRIS_R, x: W / 2, y: H / 2 };
    this.inkG = this.add.graphics().setDepth(D.ink);
    this.blobs = this.makeBlobs();
    this.ov = null; // overlay objects (parchment / stamp)
  }

  /** 24 seeded ink blobs (5-9 lobes each) covering the screen at t = 1. */
  makeBlobs() {
    const r = new RNG(hashStr(`cs:ink:${this.id}`));
    const out = [];
    for (let iy = 0; iy < 4; iy++) {
      for (let ix = 0; ix < 6; ix++) {
        const n = r.int(5, 9), lobes = [];
        for (let k = 0; k < n; k++) lobes.push(r.float(0.72, 1.18));
        out.push({ x: (ix + 0.5) * (W / 6) + r.float(-60, 60), y: (iy + 0.5) * (H / 4) + r.float(-60, 60), r: r.float(250, 330), n, lobes, a: r.float(0, 6.28), d: r.float(0, 0.35) });
      }
    }
    return out;
  }

  drawInk(t) {
    const g = this.inkG;
    g.clear();
    if (t <= 0) return;
    g.fillStyle(0x120c0a, 1);
    for (let i = 0; i < this.blobs.length; i++) {
      const b = this.blobs[i];
      const k = Phaser.Math.Clamp((t - b.d) / (1 - b.d), 0, 1);
      if (k <= 0) continue;
      const rr = b.r * (1 - Math.pow(1 - k, 2)) * 1.05;
      g.beginPath();
      for (let j = 0; j < b.n * 2; j++) { // two points per lobe: lobe peak and valley
        const a = b.a + (j / (b.n * 2)) * 6.2832;
        const m = j % 2 === 0 ? b.lobes[j >> 1] : b.lobes[j >> 1] * 0.72;
        const px = b.x + Math.cos(a) * rr * m, py = b.y + Math.sin(a) * rr * m;
        if (j === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillPath();
    }
  }

  drawIris() {
    const g = this.irisG;
    g.clear();
    g.fillStyle(0xffffff, 1);
    if (this.iris.r > 0.5) g.fillCircle(this.iris.x, this.iris.y, this.iris.r);
  }

  // ------------------------------------------------------------------------------------------------ input
  bindInput() {
    const kb = this.input.keyboard;
    this._kd = (e) => {
      if (e.repeat) return;
      if (e.code === 'Escape') {
        if (Save.flag(`seen_${this.id}`) || this.cs.kind === 'ledger' || this.cs.kind === 'card') { this.finish(true); return; } // seen before: one Esc skips
        this.holdKey = 'Escape'; this.holdT = 0;
      } else if (e.code === 'Space') { this.holdKey = 'Space'; this.holdT = 0; }
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') this.press();
    };
    this._ku = (e) => {
      if (e.code === this.holdKey) {
        const short = this.holdT < HOLD_SKIP;
        this.holdKey = null; this.holdT = 0; this.drawRing(0);
        if (short && e.code === 'Space') this.press();
      }
    };
    kb.on('keydown', this._kd);
    kb.on('keyup', this._ku);
    this._pd = () => this.press();
    this.input.on('pointerdown', this._pd);
  }

  drawRing(p) {
    const g = this.ring;
    if (!g) return;
    g.clear();
    if (p <= 0.25 / HOLD_SKIP) return; // appears after ~0.25 s of holding
    g.lineStyle(5, 0xf0a640, 0.95);
    g.beginPath();
    g.arc(W - 70, H - 150, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p), false);
    g.strokePath();
    g.lineStyle(2, 0xe8dcc0, 0.35);
    g.strokeCircle(W - 70, H - 150, 22);
  }

  /** Space / Enter / click: complete the typing, then advance. */
  press() {
    if (this.finished || this.busy) return;
    if (this.time.now - this.born < 350) return;
    if (this.ledger) { this.pressLedger(); return; }
    if (this.ty && !this.ty.done) { this.completeType(); return; }
    if (this.stage === 'ov') { this.pressOverlay(); return; }
    if (this.stage === 'ovwait') { this.pt = Math.max(this.pt, this.ovd.at); return; } // fast-forward to the page; never skip it
    if (this.stage === 'hold' && this.pt > 0.3) this.next();
  }

  // ------------------------------------------------------------------------------------------------ start / panels
  start() {
    const cs = this.cs;
    if (cs.music && !cs.keepMusic) Music.play(cs.music, { fade: 600 });
    this.tweens.add({ targets: [this.barT], y: LB / 2, duration: 450, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: [this.barB], y: H - LB / 2, duration: 450, ease: 'Cubic.easeOut' });
    this.grad.setVisible(true);
    this.tweens.add({ targets: this.hint, alpha: 0.6, duration: 600, delay: 900 });
    this.time.delayedCall(6500, () => { if (this.hint && this.hint.active) this.tweens.add({ targets: this.hint, alpha: 0.28, duration: 800 }); });
    this.showPanel(0, true);
    this.tweens.add({ targets: this.fader, alpha: 0, duration: this.sd.from === 'white' ? 900 : 450, onComplete: () => this.fader.setFillStyle(0x000000, 1) });
  }

  /** Texture key for an image: the real one, or a dark placeholder panel that names the missing key. */
  texFor(key) {
    if (this.textures.exists(key)) return key;
    const k = `cs_ph_${key}`;
    if (!this.textures.exists(k)) {
      const t = this.textures.createCanvas(k, 720, 480);
      const ctx = t.getContext();
      const g = ctx.createRadialGradient(360, 240, 60, 360, 240, 420);
      g.addColorStop(0, '#2a1a12'); g.addColorStop(1, '#0a0605');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 720, 480);
      ctx.strokeStyle = 'rgba(232,220,192,0.18)'; ctx.lineWidth = 2; ctx.strokeRect(24, 24, 672, 432);
      ctx.fillStyle = 'rgba(232,220,192,0.5)'; ctx.font = '22px "Special Elite", "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('PLACEHOLDER PANEL', 360, 220); ctx.fillText(key, 360, 254);
      t.refresh();
      this.texKeys.push(k);
    }
    return k;
  }

  showPanel(i, first = false) {
    const cs = this.cs, p = cs.panels[i];
    this.pi = i;
    this.pt = 0;
    this.stage = 'cap';
    this.cap = panelCaption(p, this.ctx);
    this.after = panelAfter(p, this.ctx);
    this.ovd = overlayFor(p, this.ctx);
    this.minDur = Math.max(p.duration ?? autoDuration(this.cap), this.ovd && this.ovd.type === 'stamp' ? this.ovd.at + this.ovd.hold : 0);
    // image + Ken-Burns
    const key = this.texFor(p.image);
    this.img.setTexture(key).setVisible(true).setAlpha(1);
    const s0 = Math.max(W / this.img.width, H / this.img.height);
    if (p.tint && TINTS[p.tint]) this.img.setTint(TINTS[p.tint]); else this.img.clearTint();
    this.tweens.killTweensOf(this.img);
    const life = (this.minDur + 3) * 1000;
    let sA = 1, sB = 1.08, xA = W / 2, xB = W / 2;
    if (p.kb === 'pull_out') { sA = 1.08; sB = 1.0; }
    else if (p.kb === 'pan_l') { sA = sB = 1.1; xA = W / 2 + 20; xB = W / 2 - 20; }
    else if (p.kb === 'pan_r') { sA = sB = 1.1; xA = W / 2 - 20; xB = W / 2 + 20; }
    else if (p.kb === 'still') { sA = sB = 1.0; }
    this.img.setScale(s0 * sA).setPosition(xA, H / 2);
    if (sA !== sB || xA !== xB) this.tweens.add({ targets: this.img, scale: s0 * sB, x: xB, duration: life, ease: 'Linear' });
    this.cameras.main.resetFX();
    if (p.shake) this.cameras.main.shake(life, p.shake / W, false);
    // timed sfx / stamp
    this.timed.length = 0;
    for (const s of p.sfx || []) this.timed.push(typeof s === 'string' ? { at: 0, key: s } : { at: s.at || 0, key: s.key });
    if (this.ovd && this.ovd.type === 'stamp') this.timed.push({ at: this.ovd.at, stamp: true });
    this.timed.sort((a, b) => a.at - b.at);
    this.timedI = 0;
    this.clearCaption();
    this.startType(this.cap, first ? 0.6 : 0.3);
  }

  playSfx(key) {
    if (/^amb_/.test(key)) { Ambience.play(key, { fade: 1200 }); return; }
    Sfx.play(key, { vol: 0.9, gap: 0 });
  }

  // ------------------------------------------------------------------------------------------------ caption typing
  clearCaption() {
    for (const t of this.capT) t.setText('').setAlpha(1);
    this.ty = null;
  }

  startType(lines, delay = 0.25) {
    const ty = { lines, len: [], off: [], total: 0, shown: 0, t: -delay, done: false, cnt: [0, 0] };
    const n = Math.min(2, lines.length);
    for (let i = 0; i < 2; i++) {
      const t = this.capT[i];
      if (i < n) {
        t.setText(lines[i]);
        const w = t.width;
        t.setPosition(W / 2 - w / 2, H - LB - 24 - (n - 1 - i) * 44); // bottom line at y 840; single lines sit on the same baseline
        t.setText('');
        ty.len[i] = lines[i].length; ty.off[i] = ty.total; ty.total += lines[i].length;
      } else { ty.len[i] = 0; ty.off[i] = ty.total; }
    }
    this.ty = ty;
    if (!ty.total) ty.done = true;
  }

  typeTick(dt) {
    const ty = this.ty;
    if (!ty || ty.done) return;
    ty.t += dt;
    const c = ty.t < 0 ? 0 : Math.min(ty.total, Math.floor(ty.t * CPS));
    if (c === ty.shown) return;
    if (Math.floor(c / TICK_EVERY) !== Math.floor(ty.shown / TICK_EVERY)) Sfx.play('ui_type', { vol: 0.5, gap: 0, rate: 0.95 + Math.random() * 0.1 });
    ty.shown = c;
    for (let i = 0; i < 2; i++) {
      if (!ty.len[i]) continue;
      const k = Phaser.Math.Clamp(c - ty.off[i], 0, ty.len[i]);
      if (k !== ty.cnt[i]) { ty.cnt[i] = k; this.capT[i].setText(ty.lines[i].slice(0, k)); }
    }
    if (c >= ty.total) { ty.done = true; this.onTyped(); }
  }

  completeType() {
    const ty = this.ty;
    if (!ty || ty.done) return;
    ty.t = ty.total / CPS + 1;
    this.typeTick(0);
  }

  /** The typed caption finished: continue with the overlay (parchment), or start holding. */
  onTyped() {
    if (this.stage === 'cap') {
      this.doneAt = this.pt;
      if (this.ovd && this.ovd.type === 'parchment') this.stage = 'ovwait';
      else this.stage = 'hold';
    } else if (this.stage === 'cap2') { this.doneAt = this.pt; this.stage = 'hold'; }
  }

  // ------------------------------------------------------------------------------------------------ parchment overlay
  startParchment() {
    const o = this.ovd;
    const im = Assets.makeImage(this, W / 2, 430, 'ui_parchment').setDepth(D.ov);
    im.setScale(900 / (im.width || 1200)).setAngle(-1.2).setAlpha(0);
    const txt = this.add.text(W / 2 - 350, 430, '', { fontFamily: FONT_BODY, fontSize: '27px', color: '#2a1810', lineSpacing: 6 }).setOrigin(0, 0.5).setDepth(D.ov + 1).setAlpha(0).setAngle(-1.2);
    txt.setWordWrapWidth(700);
    const lines = txt.getWrappedText(o.text);
    txt.setWordWrapWidth(null);
    const full = lines.join('\n');
    txt.setText(full);
    txt.setOrigin(0, 0).setPosition(W / 2 - 350, 430 - txt.height / 2 - 10); // fixed top edge: the block does not shift while it types
    txt.setText('');
    this.tweens.add({ targets: [im, txt], alpha: 1, duration: 300 });
    this.tweens.add({ targets: this.capT, alpha: 0, duration: 250 });
    Sfx.play('page_flip', { vol: 0.8, gap: 0 });
    this.ov = { im, txt, full, shown: 0, t: -0.3, phase: 1, hold: 0 };
    this.stage = 'ov';
  }

  ovUpdate(dt) {
    const o = this.ov, d = this.ovd;
    if (!o) return;
    if (o.phase === 1) {
      o.t += dt;
      const c = o.t < 0 ? 0 : Math.min(o.full.length, Math.floor((o.t * 1000) / d.ms));
      if (c !== o.shown) {
        if (Math.floor(c / 4) !== Math.floor(o.shown / 4)) Sfx.play('ui_type', { vol: 0.4, gap: 0, rate: 0.8 });
        o.shown = c;
        o.txt.setText(o.full.slice(0, c));
        if (c >= o.full.length) { o.phase = 2; o.hold = 0; }
      }
    } else if (o.phase === 2) {
      o.hold += dt;
      if (o.hold >= d.hold) this.endParchment();
    }
  }

  pressOverlay() {
    const o = this.ov;
    if (!o) return;
    if (o.phase === 1) { o.t = (o.full.length * this.ovd.ms) / 1000 + 1; this.ovUpdate(0); } else if (o.phase === 2) this.endParchment();
  }

  endParchment() {
    const o = this.ov;
    if (!o || o.phase === 3) return;
    o.phase = 3;
    this.tweens.add({
      targets: [o.im, o.txt], alpha: 0, duration: 300,
      onComplete: () => { o.im.destroy(); o.txt.destroy(); if (this.ov === o) this.ov = null; this.afterOverlay(); },
    });
  }

  afterOverlay() {
    for (const t of this.capT) t.setAlpha(1);
    if (this.after && this.after.length) { this.stage = 'cap2'; this.startType(this.after, 0.3); } else { this.doneAt = this.pt; this.stage = 'hold'; }
  }

  stamp() {
    const o = this.ovd;
    const t = this.add.text(W / 2, 470, o.text, { fontFamily: FONT_TITLE, fontSize: '54px', color: '#b3261e', stroke: INK, strokeThickness: 6 }).setOrigin(0.5).setDepth(D.ov).setAngle(-6).setAlpha(0).setScale(1.9);
    this.tweens.add({ targets: t, alpha: 0.95, scale: 1, duration: 130, ease: 'Cubic.easeIn' });
    this.time.delayedCall(130, () => { Sfx.play('ink_splat', { vol: 0.9, gap: 0 }); if (!this.finished) this.cameras.main.shake(140, 5 / W, false); });
    this.stampT = t;
  }

  // ------------------------------------------------------------------------------------------------ update
  update(time, delta) {
    if (this.finished) return;
    const dt = Math.min(delta, 100) / 1000;
    if (this.holdKey) {
      this.holdT += dt;
      this.drawRing(this.holdT / HOLD_SKIP);
      if (this.holdT >= HOLD_SKIP) { this.holdKey = null; this.drawRing(0); this.finish(true); return; }
    }
    if (this.ledger) { this.ledgerUpdate(dt); return; }
    if (this.pi < 0) return;
    this.pt += dt;
    while (this.timedI < this.timed.length && this.timed[this.timedI].at <= this.pt) {
      const e = this.timed[this.timedI++];
      if (e.stamp) this.stamp(); else this.playSfx(e.key);
    }
    this.typeTick(dt);
    if (this.stage === 'ovwait' && this.pt >= this.ovd.at && !this.busy) this.startParchment();
    else if (this.stage === 'ov') this.ovUpdate(dt);
    else if (this.stage === 'hold' && !this.busy && this.pt >= Math.max(this.minDur, this.doneAt + 0.9)) this.next();
  }

  // ------------------------------------------------------------------------------------------------ transitions
  next() {
    if (this.busy || this.finished) return;
    const last = this.pi >= this.cs.panels.length - 1;
    const mode = last ? 'fade' : this.cs.panels[this.pi].transition || 'fade';
    this.busy = true;
    this.stage = 'trans';
    this.transOut(mode, () => {
      if (this.finished) return;
      if (this.stampT) { this.stampT.destroy(); this.stampT = null; }
      if (last) { this.busy = false; this.finish(false, true); return; }
      this.showPanel(this.pi + 1);
      this.transIn(mode, () => { this.busy = false; });
    });
  }

  transOut(mode, cb) {
    switch (mode) {
      case 'flash': this.tweens.add({ targets: this.flash, alpha: 1, duration: 30, onComplete: cb }); break;
      case 'slam': this.cameras.main.shake(150, 6 / W, false); cb(); break;
      case 'iris': {
        const f = this.cs.panels[this.pi].focus;
        this.iris.x = f ? f[0] : W / 2; this.iris.y = f ? f[1] : H / 2; this.iris.r = IRIS_R;
        this.irisRect.setVisible(true);
        this.drawIris();
        this.tweens.add({ targets: this.iris, r: 0, duration: 300, ease: 'Cubic.easeIn', onUpdate: () => this.drawIris(), onComplete: cb });
        break;
      }
      case 'ink': {
        const o = { t: 0 };
        Sfx.play('ink_splat', { vol: 0.6, gap: 0 });
        this.tweens.add({ targets: o, t: 1, duration: 350, ease: 'Sine.easeIn', onUpdate: () => this.drawInk(o.t), onComplete: () => { this.drawInk(1); cb(); } });
        break;
      }
      case 'cut': cb(); break;
      default: this.tweens.add({ targets: this.fader, alpha: 1, duration: 225, onComplete: cb });
    }
  }

  transIn(mode, cb) {
    switch (mode) {
      case 'flash': this.tweens.add({ targets: this.flash, alpha: 0, duration: 90, onComplete: cb }); break;
      case 'iris': {
        const f = this.cs.panels[this.pi].focus;
        this.iris.x = f ? f[0] : W / 2; this.iris.y = f ? f[1] : H / 2;
        this.tweens.add({ targets: this.iris, r: IRIS_R, duration: 300, ease: 'Cubic.easeOut', onUpdate: () => this.drawIris(), onComplete: () => { this.irisRect.setVisible(false); cb(); } });
        break;
      }
      case 'ink': {
        const o = { t: 1 };
        this.tweens.add({ targets: o, t: 0, duration: 350, ease: 'Sine.easeOut', onUpdate: () => this.drawInk(o.t), onComplete: () => { this.inkG.clear(); cb(); } });
        break;
      }
      case 'cut': case 'slam': cb(); break;
      default: this.tweens.add({ targets: this.fader, alpha: 0, duration: 225, onComplete: cb });
    }
  }

  // ------------------------------------------------------------------------------------------------ ledger card (s6.3)
  startLedger() {
    const cs = this.cs, c = cs.char;
    this.ledger = true;
    this.lt = 0;
    const card = cs.kind === 'card';
    this.lcps = card ? 30 : LEDGER_CPS;
    this.lmax = cs.maxSeconds || 4.5;
    this.add.rectangle(W / 2, H / 2, W, H, card ? 0x000000 : 0x0d0806).setDepth(D.img - 1);
    if (card) { this.startCardBody(cs); return; }
    if (this.textures.exists('title_l0_sky')) {
      this.add.image(W / 2, H / 2, 'title_l0_sky').setDisplaySize(W, H).setDepth(D.img);
    }
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(D.img + 1);
    const pk = c === 'gunslinger' ? 'portrait_player' : `portrait_${c}`;
    const por = Assets.makeImage(this, 330, 470, pk).setDepth(D.img + 2);
    por.setScale(500 / (por.width || 512)).setAlpha(0);
    const fr = this.add.rectangle(330, 470, 500, 500).setStrokeStyle(3, 0xe8dcc0, 0.35).setDepth(D.img + 3).setAlpha(0);
    this.tweens.add({ targets: [por, fr], alpha: 1, duration: 500 });
    this.lt_lines = [];
    const st = { fontFamily: FONT_BODY, fontSize: '34px', color: BONE, stroke: INK, strokeThickness: 5, lineSpacing: 6 };
    let total = 0;
    const lines = cs.lines;
    for (let i = 0; i < lines.length; i++) {
      const t = this.add.text(640, 250 + i * 150, '', st).setDepth(D.img + 3);
      t.setWordWrapWidth(700);
      const wrapped = t.getWrappedText(lines[i]).join('\n');
      t.setWordWrapWidth(null);
      this.lt_lines.push({ t, full: wrapped, off: total, shown: 0 });
      total += wrapped.length + 10; // a beat between lines
    }
    this.lt_total = total;
    this.lt_done = false;
    this.lt_hint = this.add.text(W / 2, H - 60, 'CLICK to continue', { fontFamily: FONT_BODY, fontSize: '22px', color: '#d9b071', stroke: INK, strokeThickness: 4 }).setOrigin(0.5).setDepth(D.hint).setAlpha(0);
    Sfx.play('page_flip', { vol: 0.6, gap: 0 });
    this.tweens.add({ targets: this.fader, alpha: 0, duration: 350 });
  }

  /** Black text card (s5.2): centred lines typed at 30 cps, skippable. */
  startCardBody(cs) {
    const st = { fontFamily: FONT_BODY, fontSize: '38px', color: BONE, stroke: INK, strokeThickness: 5, align: 'center', lineSpacing: 8 };
    let total = 0;
    this.lt_lines = [];
    for (let i = 0; i < cs.lines.length; i++) {
      const t = this.add.text(W / 2, 400 + i * 110, '', st).setOrigin(0.5, 0).setDepth(D.img + 3);
      t.setWordWrapWidth(1100);
      const wrapped = t.getWrappedText(cs.lines[i]).join('\n');
      t.setWordWrapWidth(null);
      t.setText(wrapped); const w = t.width; t.setText('');
      t.setOrigin(0, 0).setX(W / 2 - w / 2);
      this.lt_lines.push({ t, full: wrapped, off: total, shown: 0 });
      total += wrapped.length + 8;
    }
    this.lt_total = total;
    this.lt_done = false;
    this.lt_hint = this.add.text(W / 2, H - 60, 'CLICK to continue', { fontFamily: FONT_BODY, fontSize: '22px', color: '#d9b071', stroke: INK, strokeThickness: 4 }).setOrigin(0.5).setDepth(D.hint).setAlpha(0);
    this.tweens.add({ targets: this.fader, alpha: 0, duration: 350 });
  }

  ledgerUpdate(dt) {
    this.lt += dt;
    if (!this.lt_done) {
      const c = Math.max(0, Math.floor((this.lt - 0.5) * this.lcps));
      for (const l of this.lt_lines) {
        const k = Phaser.Math.Clamp(c - l.off, 0, l.full.length);
        if (k !== l.shown) { if (Math.floor(k / 3) !== Math.floor(l.shown / 3)) Sfx.play('ui_type', { vol: 0.45, gap: 0 }); l.shown = k; l.t.setText(l.full.slice(0, k)); }
      }
      if (c >= this.lt_total) this.ledgerTyped();
    }
    if (this.lt_done) this.lt_hint.setAlpha(0.55 + 0.35 * Math.sin(this.lt * 5));
    if (this.lt >= this.lmax) this.finish(false);
  }

  ledgerTyped() {
    if (this.lt_done) return;
    this.lt_done = true;
    for (const l of this.lt_lines) { l.shown = l.full.length; l.t.setText(l.full); }
  }

  pressLedger() {
    if (!this.lt_done) this.ledgerTyped(); else this.finish(false);
  }

  // ------------------------------------------------------------------------------------------------ finish
  /** End the cutscene: fade to black, restore the game, then hand over (onDone / next). `blackAlready` = the last out-transition faded to black. */
  finish(skipped, blackAlready = false) {
    if (this.finished) return;
    this.finished = true;
    if (this.cameras && this.cameras.main) this.cameras.main.resetFX();
    this.drawRing(0);
    if (this.stampT) this.stampT.destroy();
    try { Save.setFlag(`seen_${this.id}`, true); } catch (e) { /* storage may be blocked */ }
    if (!this.fader || !this.fader.active) { this.handoff(skipped); return; }
    const go = () => this.handoff(skipped);
    if (blackAlready || this.fader.alpha >= 0.99) { this.fader.setAlpha(1); go(); return; }
    this.tweens.killTweensOf(this.fader);
    this.tweens.add({ targets: this.fader, alpha: 1, duration: 300, onComplete: go });
  }

  /** Unknown id / blocked mode: hand over at once (no visuals). */
  abort() {
    this.handed = true;
    this.finished = true;
    const n = this.sd.next || null;
    this.releaseGame();
    this.callDone(true);
    if (this.overlay || (n && n.callback && !n.scene)) this.scene.stop();
    else this.scene.start(n && n.scene ? n.scene : 'Menu', n && n.data);
  }

  /** Release the waiters (onDone / next.callback) exactly once. */
  callDone(skipped) {
    if (this.doneCalled) return;
    this.doneCalled = true;
    const d = this.sd, n = d.next || null;
    const res = { id: this.id, skipped: !!skipped };
    try { if (typeof d.onDone === 'function') d.onDone(res); } catch (e) { console.warn('[Cutscene] onDone failed', e); }
    if (n && typeof n.callback === 'function' && n.callback !== d.onDone) { try { n.callback(res); } catch (e) { console.warn('[Cutscene] next.callback failed', e); } }
  }

  handoff(skipped) {
    if (this.handed) return;
    this.handed = true;
    const n = this.sd.next || null;
    this.releaseGame();
    if (!this.overlay && this.cs && !this.cs.keepMusic) { try { Music.play('mus_menu', { fade: 800 }); } catch (e) { /* */ } }
    this.callDone(skipped);
    if (!this.overlay && n && n.scene) { // standalone: continue to the next scene
      try { this.scene.start(n.scene, n.data); } catch (e) { console.warn('[Cutscene] next scene failed', e); this.scene.start('Menu'); }
      return;
    }
    if (!this.overlay && !(n && n.callback)) { this.scene.start('Menu'); return; } // standalone with nowhere to go
    // overlay: reveal what is underneath (the game, or the next overlay), then stop
    const stop = () => { if (this.sys && this.sys.isActive()) this.scene.stop(); };
    if (this.fader && this.fader.active && this.sys.isActive()) {
      this.tweens.add({ targets: this.fader, alpha: 0, duration: 400, delay: 80, onComplete: stop });
      this.time.delayedCall(1500, stop);
    } else stop();
  }

  /** Console / QA: `__game.story.skip()`. */
  skipAll() { this.finish(true); }

  state() {
    return { id: this.id, panel: this.pi, panels: this.cs ? this.cs.panels.length : 0, stage: this.stage, ledger: !!this.ledger, finished: this.finished, typed: this.ty ? this.ty.done : true, pt: +this.pt.toFixed(2) };
  }

  cleanup() {
    if (this.game.__cutscene === this) this.game.__cutscene = null;
    this.releaseGame();
    try {
      const kb = this.input && this.input.keyboard;
      if (kb) { kb.off('keydown', this._kd); kb.off('keyup', this._ku); }
      if (this.input) this.input.off('pointerdown', this._pd);
    } catch (e) { /* scene input already torn down */ }
    this.tweens.killAll();
    if (this.irisMask) { try { this.irisMask.destroy(); } catch (e) { /* */ } }
    if (this.irisG) { try { this.irisG.destroy(); } catch (e) { /* */ } }
    for (const k of this.texKeys) { if (this.textures.exists(k)) this.textures.remove(k); }
    this.texKeys.length = 0;
    this.callDone(true); // a scene killed from outside must still release its waiters (once)
  }
}
