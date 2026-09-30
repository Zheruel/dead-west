// Credits roll (STORY_PRESENTATION s5.6): scroll 46 px/s, Special Elite 28, Rye 36 amber headings, over the last ending panel darkened 55 %.
// Launched by ending.js after end_a / end_true:  scene.launch('Credits', { ending: 'a' | 'true', ctx, onDone })  (overlay over the frozen Game scene)
// or standalone from the console / Codex:        scene.start('Credits', { ending, next: { scene: 'Menu' } }).
// ESC (hold 0.6 s, or one press once the credits were seen) skips. After the roll: the ending toast (first win / first true ending), the save flag,
// then onDone (GameScene.endRun('complete')). The scene keeps a black cover until the End scene has taken over, so no game frame flashes.
import Phaser from 'phaser';
import { W, H, FONT_TITLE, FONT_BODY } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx, Music } from '../core/Audio.js';
import { Save } from '../core/Save.js';
import { bus } from '../core/events.js';
import { creditsRows, ENDING_TOASTS, MUSIC_CREDITS_CH2 } from '../data/story/text.js';
import { CUTSCENES } from '../data/story/cutscenes.js';

const SPEED = 46; // px per second
const HOLD_SKIP = 0.6;
const BONE = '#e8dcc0', AMBER = '#f0a640', SAND = '#d9b071', INK = '#120c0a';

export default class CreditsScene extends Phaser.Scene {
  constructor() { super('Credits'); }

  init(data) { this.sd = data || {}; }

  create() {
    const d = this.sd;
    this.ending = d.ending === 'true' ? 'true' : 'a';
    this.finished = false;
    this.handed = false;
    this.holdKey = null;
    this.holdT = 0;
    this.scrollY = 0;
    this.tail = null;
    this.endT = -1; // set once the tail is centred
    this.born = this.time.now;
    this.game.__credits = this;
    this.scene.bringToTop();
    this.events.once('shutdown', () => this.cleanup());
    const cs = CUTSCENES[this.ending === 'true' ? 'end_true' : 'end_a'];
    const key = (cs && cs.endingImage) || 'cutscene_end_a_5';

    // backdrop: the last ending panel, darkened 55 %, slow push-in
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000).setDepth(0);
    const mkBg = () => {
      if (this.bg) this.bg.destroy();
      if (this.textures.exists(key)) {
        this.bg = this.add.image(W / 2, H / 2, key).setDepth(1);
        const s0 = Math.max(W / this.bg.width, H / this.bg.height);
        this.bg.setScale(s0);
        this.tweens.add({ targets: this.bg, scale: s0 * 1.06, duration: 90000, ease: 'Linear' });
      } else {
        this.bg = this.add.rectangle(W / 2, H / 2, W, H, 0x1a0f0b).setDepth(1);
      }
    };
    mkBg();
    if (!this.textures.exists(key) && Assets.pending(key).length) Assets.ensure(key, { timeoutMs: 10000 }).then((ok) => { if (ok && this.sys && this.sys.isActive() && this.textures.exists(key)) mkBg(); }); // lazy ending art
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(2);

    this.buildRoll();
    this.hint = this.add.text(W - 40, H - 34, Save.flag(this.ending === 'true' ? 'ending_true' : 'ending_a') ? 'ESC  SKIP' : 'HOLD ESC  SKIP', { fontFamily: FONT_BODY, fontSize: '16px', color: '#a9987a' }).setOrigin(1, 0.5).setDepth(20).setAlpha(0.6);
    this.ring = this.add.graphics().setDepth(21);
    this.cover = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setDepth(50);
    this.tweens.add({ targets: this.cover, alpha: 0, duration: 900 });

    try { Music.play('mus_credits', { fade: 900 }); } catch (e) { /* music is optional */ }

    const kb = this.input.keyboard;
    this._kd = (e) => {
      if (e.repeat || e.code !== 'Escape' || this.finished) return;
      if (Save.flag(this.ending === 'true' ? 'ending_true' : 'ending_a')) { this.finish(true); return; }
      this.holdKey = 'Escape'; this.holdT = 0;
    };
    this._ku = (e) => { if (e.code === this.holdKey) { this.holdKey = null; this.holdT = 0; this.drawRing(0); } };
    kb.on('keydown', this._kd);
    kb.on('keyup', this._ku);
    this.time.delayedCall(240000, () => this.finish(true)); // fail-safe
  }

  /** Lay out the rows top to bottom in a container at y = H (below the screen); the scroll moves the container up. */
  buildRoll() {
    const rows = creditsRows(this.ending, MUSIC_CREDITS_CH2);
    const c = (this.roll = this.add.container(W / 2, H).setDepth(10));
    let y = 0;
    const put = (text, style, gap) => {
      const t = this.add.text(0, y, text, { align: 'center', ...style }).setOrigin(0.5, 0);
      c.add(t);
      y += t.height + gap;
      return t;
    };
    const wrap = { wordWrap: { width: 1040 } };
    const body = { fontFamily: FONT_BODY, fontSize: '28px', color: BONE, stroke: INK, strokeThickness: 4, lineSpacing: 8, ...wrap };
    const head = { fontFamily: FONT_TITLE, fontSize: '36px', color: AMBER, stroke: INK, strokeThickness: 6 };
    for (const r of rows) {
      if (r.kind === 'title') put(r.text, { fontFamily: FONT_TITLE, fontSize: '96px', color: BONE, stroke: INK, strokeThickness: 12 }, 26);
      else if (r.kind === 'sub') put(r.text, { fontFamily: FONT_BODY, fontSize: '30px', color: SAND, stroke: INK, strokeThickness: 5 }, 70);
      else if (r.kind === 'rule') {
        const g = this.add.rectangle(0, y + 30, 360, 3, 0xd9b071, 0.55);
        c.add(g);
        y += 90;
      } else if (r.kind === 'line') { put(r.label, head, 12); put(r.text, body, 54); }
      else if (r.kind === 'text') put(r.text, { ...body, color: SAND, fontSize: '26px' }, 90);
      else if (r.kind === 'tail') {
        y += 140;
        this.tail = put(r.text, { fontFamily: FONT_TITLE, fontSize: '54px', color: this.ending === 'true' ? '#d9c39a' : AMBER, stroke: INK, strokeThickness: 8 }, 0);
        this.tailY = this.tail.y + this.tail.height / 2;
      }
    }
    this.rollH = y;
  }

  drawRing(p) {
    this.ring.clear();
    if (p <= 0.4) return;
    this.ring.lineStyle(5, 0xf0a640, 0.95);
    this.ring.beginPath();
    this.ring.arc(W - 70, H - 90, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p), false);
    this.ring.strokePath();
  }

  update(time, delta) {
    if (this.finished) return;
    const dt = Math.min(delta, 100) / 1000;
    if (this.holdKey) {
      this.holdT += dt;
      this.drawRing(this.holdT / HOLD_SKIP);
      if (this.holdT >= HOLD_SKIP) { this.holdKey = null; this.drawRing(0); this.finish(true); return; }
    }
    if (this.endT < 0) {
      this.scrollY += SPEED * dt;
      this.roll.y = H - this.scrollY;
      if (this.roll.y + this.tailY <= H / 2) { this.endT = 0; }
    } else {
      this.endT += dt;
      if (this.endT >= 3) this.finish(false);
    }
  }

  // ------------------------------------------------------------------------------------------------ end
  finish(skipped) {
    if (this.finished) return;
    this.finished = true;
    this.drawRing(0);
    const first = this.ending === 'true' ? !Save.flag('ending_true') : !Save.unlocked('mode:hell') && !Save.flag('ending_a');
    try { Save.setFlag(this.ending === 'true' ? 'ending_true' : 'ending_a', true); Save.flush(); } catch (e) { /* storage may be blocked */ }
    this.tweens.killTweensOf(this.cover);
    this.tweens.add({ targets: this.cover, alpha: 1, duration: skipped ? 250 : 900, onComplete: () => (first ? this.toast() : this.handoff(skipped)) });
    this.time.delayedCall(4000, () => this.handoff(skipped)); // if a tween never completes
  }

  /** One small plate over the black: MODE UNLOCKED / TRUE ENDING, name and quote. */
  toast() {
    const t = ENDING_TOASTS[this.ending];
    if (!t) { this.handoff(false); return; }
    const plate = Assets.makeImage(this, W / 2, H / 2, 'ui_parchment').setDepth(60).setAlpha(0);
    plate.setScale(760 / (plate.width || 1200)).setTint(0x5e4a3a);
    const k = this.add.text(W / 2, H / 2 - 70, t.kicker, { fontFamily: FONT_BODY, fontSize: '22px', color: SAND, stroke: INK, strokeThickness: 4 }).setOrigin(0.5).setDepth(61).setAlpha(0);
    const n = this.add.text(W / 2, H / 2 - 12, t.name, { fontFamily: FONT_TITLE, fontSize: '54px', color: AMBER, stroke: INK, strokeThickness: 8 }).setOrigin(0.5).setDepth(61).setAlpha(0);
    const q = this.add.text(W / 2, H / 2 + 56, `"${t.quote}"`, { fontFamily: FONT_BODY, fontSize: '28px', color: BONE, stroke: INK, strokeThickness: 4 }).setOrigin(0.5).setDepth(61).setAlpha(0);
    Sfx.play('menu_select', { vol: 0.9, gap: 0 });
    this.tweens.add({ targets: [plate, k, n, q], alpha: 1, duration: 350 });
    this.tweens.add({ targets: [plate, k, n, q], alpha: 0, duration: 400, delay: 2600, onComplete: () => this.handoff(false) });
    bus.emit('ui:toast', { text: `${t.kicker}: ${t.name}`, color: '#f0a640', silent: true });
  }

  handoff(skipped) {
    if (this.handed) return;
    this.handed = true;
    const d = this.sd, n = d.next || null;
    try { if (typeof d.onDone === 'function') d.onDone({ ending: this.ending, skipped: !!skipped }); } catch (e) { console.warn('[Credits] onDone failed', e); }
    if (n && typeof n.callback === 'function' && n.callback !== d.onDone) { try { n.callback({ ending: this.ending, skipped: !!skipped }); } catch (e) { console.warn('[Credits] next.callback failed', e); } }
    if (!d.overlay && n && n.scene) { this.scene.start(n.scene, n.data); return; }
    if (!d.overlay && !d.onDone && !(n && n.callback)) { this.scene.start('Menu'); return; }
    // overlay: stay black until the End scene has taken over, then stop
    const stop = () => { if (this.sys && this.sys.isActive()) this.scene.stop(); };
    this.time.addEvent({ delay: 100, loop: true, callback: () => { if (this.scene.isActive('End') && this.time.now - this.born > 500) { this.time.delayedCall(350, stop); } } });
    this.time.delayedCall(4500, stop);
  }

  cleanup() {
    if (this.game.__credits === this) this.game.__credits = null;
    try {
      const kb = this.input && this.input.keyboard;
      if (kb) { kb.off('keydown', this._kd); kb.off('keyup', this._ku); }
    } catch (e) { /* */ }
    this.tweens.killAll();
    if (!this.handed) { this.handed = true; const d = this.sd; try { if (typeof d.onDone === 'function') d.onDone({ ending: this.ending, skipped: true }); } catch (e) { /* */ } }
  }

  skipAll() { this.finish(true); }
  state() { return { ending: this.ending, scroll: Math.round(this.scrollY), rollH: this.rollH, finished: this.finished }; }
}
