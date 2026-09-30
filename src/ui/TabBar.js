// Horizontal tab strip for the Codex / Board / Daily screens: click a tab or press Q / E (previous / next).
//   const tabs = new TabBar(scene, { x, y, w, tabs: [{ id, label }], onChange: (id, i) => ..., depth });  tabs.select(i);  tabs.setCount(i, '14 / 22');
// Keys are bound with `scene.input.keyboard` and released on scene shutdown (or tabs.destroy()).
import { FONT_TITLE, FONT_BODY, CSS } from '../config.js';
import { uiSfx } from './UiKit.js';

export default class TabBar {
  constructor(scene, { x = 720, y = 60, w = 1000, tabs = [], onChange = () => {}, depth = 10, size = 26, keys = true, active = 0 } = {}) {
    this.scene = scene;
    this.tabs = tabs;
    this.onChange = onChange;
    this.sel = -1;
    this.objs = [];
    this.cells = [];
    const n = tabs.length, cw = w / n, x0 = x - w / 2;
    this.g = scene.add.graphics().setDepth(depth);
    this.objs.push(this.g);
    tabs.forEach((t, i) => {
      const cx = x0 + cw * (i + 0.5);
      const label = scene.add.text(cx, y - (t.count != null ? 6 : 0), t.label, { fontFamily: FONT_TITLE, fontSize: `${size}px`, color: CSS.sand, stroke: '#120c0a', strokeThickness: 4 }).setOrigin(0.5).setDepth(depth + 1);
      const count = scene.add.text(cx, y + size * 0.62, '', { fontFamily: FONT_BODY, fontSize: '15px', color: '#a48a5c', stroke: '#120c0a', strokeThickness: 3 }).setOrigin(0.5).setDepth(depth + 1);
      const zone = scene.add.zone(cx, y, cw - 6, size * 2 + 8).setInteractive({ useHandCursor: true }).setDepth(depth + 2);
      zone.on('pointerdown', () => this.select(i));
      zone.on('pointerover', () => { if (i !== this.sel) label.setColor(CSS.bone); });
      zone.on('pointerout', () => { if (i !== this.sel) label.setColor(CSS.sand); });
      this.cells.push({ x: cx, label, count, zone });
      this.objs.push(label, count, zone);
    });
    this.geo = { x0, cw, y, size, depth };
    if (keys) {
      this._key = (e) => {
        if (e.repeat) return;
        if (e.code === 'KeyQ') this.step(-1); else if (e.code === 'KeyE') this.step(1);
      };
      scene.input.keyboard.on('keydown', this._key);
    }
    scene.events.once('shutdown', () => this.destroy());
    this.select(Math.max(0, Math.min(n - 1, active)), true);
  }

  get id() { return this.tabs[this.sel] ? this.tabs[this.sel].id : null; }

  step(d) { this.select((this.sel + d + this.tabs.length) % this.tabs.length); }

  select(i, silent = false) {
    if (i === this.sel) return;
    this.sel = i;
    const { x0, cw, y, size } = this.geo;
    const g = this.g;
    g.clear();
    this.cells.forEach((c, k) => {
      const on = k === i;
      const h = size * 2 + 8;
      g.fillStyle(0x120c0a, on ? 0.86 : 0.5).fillRoundedRect(x0 + cw * k + 4, y - h / 2, cw - 8, h, { tl: 12, tr: 12, bl: 0, br: 0 });
      g.lineStyle(3, on ? 0xf0a640 : 0x4a3020, 1).strokeRoundedRect(x0 + cw * k + 4, y - h / 2, cw - 8, h, { tl: 12, tr: 12, bl: 0, br: 0 });
      c.label.setColor(on ? CSS.amber : CSS.sand);
    });
    if (!silent) { uiSfx.move(); }
    this.onChange(this.tabs[i].id, i, silent);
  }

  /** Small progress text under a tab label ("14 / 22"). */
  setCount(i, text) { if (this.cells[i]) this.cells[i].count.setText(text); }

  setVisible(v) { for (const o of this.objs) o.setVisible(v); for (const c of this.cells) if (c.zone.input) c.zone.input.enabled = v; }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    try { if (this._key) this.scene.input.keyboard.off('keydown', this._key); } catch (e) { /* scene gone */ }
  }
}
