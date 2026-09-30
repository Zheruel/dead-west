// Typewriter speech tag for the Dealer (STORY 11: 22 px Special Elite on a parchment tag, 40 cps, hold 2.8 s, wrap 520 px, <= 2 lines).
// Lines come from data/dealerLines.js; within a category a line never repeats back to back. Code-drawn parchment (no art needed).
import { DEPTH, FONT_BODY } from '../config.js';
import { RNG, hashStr } from '../core/rng.js';
import { Sfx } from '../core/Audio.js';
import { DEALER_LINES, DEALER_RIDER_GREET, DEALER_EXTRA } from '../data/dealerLines.js';

const CPS = 40;
const HOLD = 2.8;
const FADE = 0.3;
const WRAP = 520;
const PAD_X = 16, PAD_Y = 10;

export default class DealerSpeech {
  /** o: {x, y (bottom-centre of the tag), seed, track(obj)} */
  constructor(scene, o = {}) {
    this.scene = scene;
    this.x = o.x ?? 720; this.y = o.y ?? 260;
    this.rng = new RNG(hashStr(`dealer:${o.seed ?? 0}`));
    this.last = {};
    this.full = '';
    this.chars = 0;
    this.shown = 0;
    this.hold = 0;
    this.state = 'idle'; // idle | type | hold | fade
    this.alpha = 0;
    this.tag = scene.add.graphics().setDepth(DEPTH.fx + 30).setVisible(false);
    this.text = scene.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '22px', color: '#2a1a10', wordWrap: { width: WRAP }, align: 'left', lineSpacing: 2 })
      .setOrigin(0, 0).setDepth(DEPTH.fx + 31).setVisible(false);
    if (o.track) { o.track(this.tag); o.track(this.text); }
    this.destroyed = false;
  }

  /** Random line of a category, never the previous one of that category. */
  pick(cat) {
    const list = DEALER_LINES[cat];
    if (!list || !list.length) return '';
    let i = this.rng.int(0, list.length - 1);
    if (list.length > 1 && i === this.last[cat]) i = (i + 1 + this.rng.int(0, list.length - 2)) % list.length;
    this.last[cat] = i;
    return list[i];
  }

  /** Greeting with the rider / situational replacements (STORY 11.2). ctx: {char, floor, mode, deals} */
  pickGreet(ctx = {}) {
    const r = this.rng;
    if (ctx.mode === 'hell' && ctx.floor === 5 && !ctx.deals && r.chance(0.5)) return DEALER_EXTRA.cleanHell;
    if (ctx.char === 'gunslinger' && ctx.floor >= 4 && ctx.floor <= 5 && r.chance(0.3)) return DEALER_EXTRA.gunslingerLate;
    if (DEALER_RIDER_GREET[ctx.char] && r.chance(0.3)) return DEALER_RIDER_GREET[ctx.char];
    return this.pick('greet');
  }

  /** Say a category line (`greet` uses pickGreet; `refused` swaps in the "three times" lines from the third refusal on). */
  sayCategory(cat, ctx = {}) {
    let line;
    if (cat === 'greet') line = this.pickGreet(ctx);
    else if (cat === 'refused' && (ctx.refused || 0) >= 3 && this.rng.chance(0.6)) line = this.rng.pick(DEALER_EXTRA.refusedThrice);
    else line = this.pick(cat);
    this.say(line);
    return line;
  }

  say(line) {
    if (this.destroyed || !line) return;
    this.full = line;
    this.text.setText(line);
    const w = Math.ceil(this.text.width) + PAD_X * 2, h = Math.ceil(this.text.height) + PAD_Y * 2;
    const left = this.x - w / 2, top = this.y - h;
    const g = this.tag;
    g.clear();
    g.fillStyle(0x120c0a, 0.35); g.fillRoundedRect(left + 3, top + 4, w, h, 6);
    g.fillStyle(0xe6d2a0, 1); g.fillRoundedRect(left, top, w, h, 6);
    g.lineStyle(2, 0x6b4423, 1); g.strokeRoundedRect(left, top, w, h, 6);
    g.fillStyle(0xe6d2a0, 1); g.fillTriangle(this.x - 9, top + h - 1, this.x + 9, top + h - 1, this.x, top + h + 10); // little tail toward the speaker
    g.lineStyle(2, 0x6b4423, 1); g.beginPath(); g.moveTo(this.x - 9, top + h); g.lineTo(this.x, top + h + 10); g.lineTo(this.x + 9, top + h); g.strokePath();
    this.text.setPosition(left + PAD_X, top + PAD_Y).setText('');
    this.chars = 0; this.shown = 0; this.hold = HOLD;
    this.state = 'type';
    this.alpha = 1;
    g.setVisible(true).setAlpha(1);
    this.text.setVisible(true).setAlpha(1);
  }

  get busy() { return this.state === 'type'; }

  update(dt) {
    if (this.state === 'idle' || this.destroyed) return;
    if (this.state === 'type') {
      this.chars += CPS * dt;
      const n = Math.min(this.full.length, Math.floor(this.chars));
      if (n !== this.shown) {
        this.shown = n;
        this.text.setText(this.full.slice(0, n));
        if (n % 3 === 0) Sfx.play('dealer_mumble', { vol: 0.5, gap: 0.08 });
      }
      if (n >= this.full.length) { this.state = 'hold'; this.hold = HOLD; }
    } else if (this.state === 'hold') {
      this.hold -= dt;
      if (this.hold <= 0) { this.state = 'fade'; this.alpha = 1; }
    } else if (this.state === 'fade') {
      this.alpha -= dt / FADE;
      if (this.alpha <= 0) this.clear();
      else { this.tag.setAlpha(this.alpha); this.text.setAlpha(this.alpha); }
    }
  }

  clear() {
    this.state = 'idle';
    this.tag.setVisible(false); this.text.setVisible(false);
  }

  destroy() {
    this.destroyed = true;
    if (this.tag && this.tag.scene) this.tag.destroy();
    if (this.text && this.text.scene) this.text.destroy();
  }
}
