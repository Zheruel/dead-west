// Item pickup banner (parchment): relic icon in a brass medallion, tag line (NEW RELIC / ACTIVE ITEM), NAME, description. Driven by 'item:picked'.
// Pickups that arrive while a banner is showing are queued (shown back to back, the earlier one is cut short when the queue is long).
// Round 2: a row of coloured tag chips under the description; devil's-deal items read `DEVIL'S DEAL` in hell red.
import Assets from '../core/Assets.js';
import { bus } from '../core/events.js';
import { FONT_TITLE, FONT_BODY } from '../config.js';
import { tagColor, tagLabel } from '../items/tags.js';
import SynergyToast from './SynergyToast.js';

const X = 720, Y = 262, HOLD = 2500;
/** Chip colours are tuned for dark backgrounds; halve them for the light parchment. */
const darken = (css) => { const n = parseInt(css.slice(1), 16); const f = (v) => Math.round(v * 0.55).toString(16).padStart(2, '0'); return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`; };

export default class Banner {
  constructor(hud) {
    this.hud = hud;
    this.c = hud.add.container(X, Y).setDepth(60).setAlpha(0);
    this.bg = Assets.makeImage(hud, 0, 0, 'ui_parchment');
    this.bg.setDisplaySize(920, 292);
    this.glow = hud.add.image(-350, 0, 'glow').setScale(2.2).setTint(0xf0a640).setAlpha(0.5).setBlendMode('ADD');
    this.medal = hud.add.graphics();
    this.medal.fillStyle(0x2a1810, 1).fillCircle(-350, 0, 60).lineStyle(6, 0x8a4b1f, 1).strokeCircle(-350, 0, 60).lineStyle(2, 0xf0a640, 1).strokeCircle(-350, 0, 52);
    this.icon = null;
    this.tag = hud.add.text(40, -68, '', { fontFamily: FONT_TITLE, fontSize: '20px', color: '#8a1c1c' }).setOrigin(0.5);
    this.name = hud.add.text(40, -22, '', { fontFamily: FONT_TITLE, fontSize: '44px', color: '#3a1a10', align: 'center', wordWrap: { width: 600 } }).setOrigin(0.5);
    this.desc = hud.add.text(40, 42, '', { fontFamily: FONT_BODY, fontSize: '25px', color: '#3a2418', align: 'center', wordWrap: { width: 600 } }).setOrigin(0.5, 0);
    this.chips = [];
    for (let i = 0; i < 4; i++) this.chips.push(hud.add.text(0, 112, '', { fontFamily: FONT_TITLE, fontSize: '18px', color: '#3a2418' }).setOrigin(0.5));
    this.c.add([this.bg, this.glow, this.medal, this.tag, this.name, this.desc, ...this.chips]);
    this.queue = [];
    this.busy = false;
    this.synergyToast = new SynergyToast(hud, this);
    bus.scoped(hud, 'item:picked', (p) => { if (p.def) this.queue.push(p.def); if (!this.busy) this.next(); });
  }

  next() {
    const def = this.queue.shift();
    if (!def) { this.busy = false; return; }
    this.busy = true;
    const h = this.hud;
    const hold = this.queue.length ? 1300 : HOLD;
    const deal = !!(def.pool && def.pool.includes('crossroads'));
    this.tag.setText(deal ? "DEVIL'S DEAL" : def.type === 'active' ? 'ACTIVE ITEM  -  PRESS Q' : 'NEW RELIC').setColor(deal ? '#a02c24' : '#8a1c1c');
    this.name.setText(def.name.toUpperCase());
    this.desc.setText(def.desc || '');
    this.name.setFontSize(def.name.length > 18 ? 36 : 44);
    this.desc.setY(this.name.y + this.name.height / 2 + 8);
    this.layoutChips(def);
    if (this.icon) { this.icon.destroy(); this.icon = null; }
    const ic = def.icon || { sheet: 'items_passive_a', name: def.id };
    this.icon = Assets.makeCell(h, -350, 0, ic.sheet, ic.name, 0.5).setScale(0.8);
    this.c.add(this.icon);
    h.tweens.killTweensOf([this.c, this.icon]);
    this.c.setAlpha(0).setY(Y - 40).setScale(0.9);
    h.tweens.add({ targets: this.c, alpha: 1, y: Y, scale: 1, duration: 260, ease: 'Back.easeOut' });
    h.tweens.add({ targets: this.icon, scale: { from: 1.5, to: 0.8 }, angle: { from: -25, to: 0 }, duration: 480, ease: 'Elastic.easeOut' });
    h.tweens.add({ targets: this.c, alpha: 0, y: Y - 22, delay: hold, duration: 380, onComplete: () => this.next() });
  }

  /** Tag chips centred on one row; colours from tags.js (darkened for the parchment). */
  layoutChips(def) {
    const tags = def.tags || [];
    let total = 0;
    for (let i = 0; i < this.chips.length; i++) {
      const c = this.chips[i], t = tags[i];
      if (t) { c.setText(tagLabel(t)).setColor(darken(tagColor(t))); total += c.width; } else c.setText('');
    }
    const gap = 26, cy = Math.min(112, this.desc.y + this.desc.height + 24);
    let x = 40 - (total + gap * (Math.min(tags.length, this.chips.length) - 1)) / 2;
    for (let i = 0; i < this.chips.length && tags[i]; i++) { const c = this.chips[i]; c.setPosition(x + c.width / 2, cy); x += c.width + gap; }
  }

  update() {
    if (this.busy && this.icon) this.icon.y = Math.sin(this.hud.time.now / 300) * 3;
    this.synergyToast.update();
  }
  destroy() { this.synergyToast.destroy(); this.c.destroy(); }
}
