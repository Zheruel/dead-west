// Shared UI toolkit for the menu-like scenes (Menu, Pause, End): text styles, parchment panels, OS-cursor control, menu sfx,
// and MenuList - a keyboard + mouse driven vertical list of buttons / toggles / sliders with a revolver-bullet selector.
//   const list = new MenuList(scene, [{ label: 'START', act: () => ... }, { label: 'MUSIC', kind: 'slider', get, set }], { x, y, gap, size, mode: 'center'|'row' });
// Item fields: label (string|fn), value (fn -> right-hand text in row mode), kind 'button'|'toggle'|'slider', act(), get()/set(v) for sliders (0..1), step.
// Keys: W/S/arrows move, Enter/Space activate, A/D/arrows adjust sliders and toggles. Mouse: hover selects, click activates, drag sliders.
import { FONT_TITLE, FONT_BODY, CSS } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';

export const INK = '#2a1810'; // text colour on light parchment
export const title = (size, color = CSS.bone, extra = {}) => ({ fontFamily: FONT_TITLE, fontSize: `${size}px`, color, stroke: '#120c0a', strokeThickness: Math.max(3, Math.round(size / 8)), ...extra });
export const body = (size, color = CSS.sand, extra = {}) => ({ fontFamily: FONT_BODY, fontSize: `${size}px`, color, stroke: '#120c0a', strokeThickness: Math.max(2, Math.round(size / 8)), ...extra });
/** Body style without outline (for text on light parchment). */
export const inkText = (size, color = INK, extra = {}) => ({ fontFamily: FONT_BODY, fontSize: `${size}px`, color, ...extra });

export const uiSfx = {
  move() { Sfx.play('menu_move', { vol: 0.7, rate: 0.95 + Math.random() * 0.12, gap: 0.05 }); },
  select() { Sfx.play('menu_select', { vol: 0.85, rate: 0.97 + Math.random() * 0.06, gap: 0.05 }); },
  back() { Sfx.play('menu_move', { vol: 0.6, rate: 0.75, gap: 0.05 }); },
};

/** Set the canvas cursor via Phaser (survives hover changes). css: 'none' | 'default' | '' */
export function setOsCursor(game, css) { try { game.input.setDefaultCursor(css); } catch (e) { /* ignore */ } }

/** Parchment panel (real art; falls back to a generated placeholder). dark=true tints it to a burnt sepia so light text reads. */
export function parchment(scene, x, y, w, { dark = false, alpha = 1, depth } = {}) {
  const im = Assets.makeImage(scene, x, y, 'ui_parchment');
  im.setScale(w / (im.width || 1200)).setAlpha(alpha);
  if (dark) im.setTint(0x5e4a3a);
  if (depth != null) im.setDepth(depth);
  return im;
}

const IDLE = CSS.sand, SEL = CSS.amber;

export class MenuList {
  constructor(scene, items, o = {}) {
    this.scene = scene;
    this.items = items;
    this.o = { x: 720, y: 500, gap: 80, size: 52, mode: 'center', rowW: 760, idle: IDLE, sel: SEL, hitW: 620, ...o };
    this.sel = 0;
    this.enabled = true;
    this.visible = true;
    this.lockUntil = 0;
    this.drag = -1;
    this.rows = [];
    this.build();
    const kb = scene.input.keyboard;
    this._key = (e) => this.onKey(e);
    kb.on('keydown', this._key);
    this._move = (p) => { if (this.drag >= 0) this.dragTo(this.drag, p); };
    this._up = () => { this.drag = -1; };
    scene.input.on('pointermove', this._move);
    scene.input.on('pointerup', this._up);
    scene.events.once('shutdown', () => this.destroy());
    this.select(0, true);
  }

  build() {
    const { scene, o } = this;
    const row = o.mode === 'row';
    // selector: a pair of brass rounds that ride next to the selected row
    this.markL = Assets.makeCell(scene, 0, 0, 'hud_icons', 'bullet_full', 0.5).setScale(row ? 0.62 : 0.8).setDepth(o.depth ?? 5);
    this.markR = row ? null : Assets.makeCell(scene, 0, 0, 'hud_icons', 'bullet_full', 0.5).setScale(0.8).setDepth(o.depth ?? 5);
    scene.tweens.add({ targets: [this.markL, this.markR].filter(Boolean), angle: 360, duration: 5200, repeat: -1 });
    this.items.forEach((it, i) => {
      const y = o.y + i * o.gap;
      const r = { it, y, objs: [] };
      const d = o.depth ?? 5;
      if (row) {
        const x0 = o.x - o.rowW / 2;
        r.bg = scene.add.rectangle(o.x, y, o.rowW + 24, o.gap - 8, 0x120c0a, 0).setStrokeStyle(2, 0xf0a640, 0).setDepth(d - 1);
        r.label = scene.add.text(x0 + 28, y, '', title(o.size, o.idle, { strokeThickness: Math.max(2, Math.round(o.size / 10)) })).setOrigin(0, 0.5).setDepth(d);
        if (it.kind === 'slider') {
          r.tx0 = o.x + o.rowW / 2 - 340; r.tx1 = o.x + o.rowW / 2 - 100;
          r.g = scene.add.graphics().setDepth(d);
          r.val = scene.add.text(o.x + o.rowW / 2 - 8, y, '', body(Math.round(o.size * 0.6), CSS.bone)).setOrigin(1, 0.5).setDepth(d);
        } else {
          r.val = scene.add.text(o.x + o.rowW / 2 - 8, y, '', body(Math.round(o.size * 0.72), CSS.bone)).setOrigin(1, 0.5).setDepth(d);
        }
        r.objs.push(r.bg, r.label, r.val);
        if (r.g) r.objs.push(r.g);
        r.zone = scene.add.zone(o.x, y, o.rowW + 24, o.gap - 4).setInteractive({ useHandCursor: true });
      } else {
        r.label = scene.add.text(o.x, y, '', title(o.size, o.idle)).setOrigin(0.5).setDepth(d);
        r.objs.push(r.label);
        r.zone = scene.add.zone(o.x, y, o.hitW, o.gap - 6).setInteractive({ useHandCursor: true });
      }
      r.zone.on('pointerover', () => { if (this.live()) this.select(i); });
      r.zone.on('pointerdown', (p) => {
        if (!this.live()) return;
        this.select(i, true);
        if (it.kind === 'slider') { if (p.x >= r.tx0 - 24) { this.drag = i; this.dragTo(i, p); } else this.activate(i); } else this.activate(i);
      });
      this.rows.push(r);
    });
    this.refresh();
  }

  live() { return this.enabled && this.visible && performance.now() >= this.lockUntil; }

  label(it) { return typeof it.label === 'function' ? it.label() : it.label; }

  refresh() {
    const { o } = this;
    this.rows.forEach((r, i) => {
      const it = r.it, sel = i === this.sel && this.visible;
      r.label.setText(this.label(it)).setColor(sel ? o.sel : o.idle);
      if (o.mode === 'row') {
        r.bg.setFillStyle(0x120c0a, sel ? 0.55 : 0).setStrokeStyle(2, 0xf0a640, sel ? 0.8 : 0);
        if (it.kind === 'slider') this.drawSlider(r, sel); else r.val.setText(it.value ? it.value() : '').setColor(sel ? CSS.bone : CSS.sand);
      }
    });
  }

  drawSlider(r, sel) {
    const v = this.items[this.rows.indexOf(r)].get();
    const g = r.g, w = r.tx1 - r.tx0, y = r.y;
    g.clear();
    g.fillStyle(0x0a0605, 0.9).fillRoundedRect(r.tx0 - 3, y - 11, w + 6, 22, 8);
    g.fillStyle(0x3a2418, 1).fillRoundedRect(r.tx0, y - 8, w, 16, 6);
    if (v > 0.01) g.fillStyle(sel ? 0xd63a2a : 0x8a1c1c, 1).fillRoundedRect(r.tx0, y - 8, Math.max(12, w * v), 16, 6);
    g.fillStyle(0xffffff, 0.12).fillRoundedRect(r.tx0 + 3, y - 7, Math.max(6, w * v - 6), 4, 2);
    for (let k = 0; k <= 10; k++) g.fillStyle(0x120c0a, 0.55).fillRect(r.tx0 + (w * k) / 10 - 1, y - 8, 2, 16);
    g.lineStyle(2, sel ? 0xf0a640 : 0x6b4423, 1).strokeRoundedRect(r.tx0 - 3, y - 11, w + 6, 22, 8);
    // handle = brass round
    g.fillStyle(0xd9b071, 1).fillCircle(r.tx0 + w * v, y, 13).lineStyle(3, 0x120c0a, 1).strokeCircle(r.tx0 + w * v, y, 13);
    g.fillStyle(0x8a4b1f, 1).fillCircle(r.tx0 + w * v, y, 5);
    r.val.setText(`${Math.round(v * 100)}%`);
  }

  select(i, silent) {
    if (i === this.sel && this.placed) return;
    const changed = i !== this.sel;
    this.sel = i;
    if (changed && !silent) uiSfx.move();
    const r = this.rows[i], o = this.o, sc = this.scene;
    const tx = o.mode === 'row' ? o.x - o.rowW / 2 - 6 : o.x - Math.max(150, r.label.width / 2 + 56);
    const tx2 = o.x + Math.max(150, r.label.width / 2 + 56);
    if (!this.placed) { this.markL.setPosition(tx, r.y); if (this.markR) this.markR.setPosition(tx2, r.y); this.placed = true; }
    else sc.tweens.add({ targets: this.markL, x: tx, y: r.y, duration: 110, ease: 'Cubic.easeOut' });
    if (this.markR) sc.tweens.add({ targets: this.markR, x: tx2, y: r.y, duration: 110, ease: 'Cubic.easeOut' });
    this.refresh();
    this.rows.forEach((rr, k) => sc.tweens.add({ targets: rr.label, scale: k === i && o.mode === 'center' ? 1.07 : 1, duration: 120 }));
  }

  activate(i) {
    const it = this.items[i];
    if (!it || it.disabled) return;
    if (it.kind !== 'slider') uiSfx.select();
    if (it.act) it.act();
    this.refresh();
  }

  adjust(i, dir) {
    const it = this.items[i];
    if (it.kind === 'slider') {
      const step = it.step ?? 0.1;
      const v = Math.max(0, Math.min(1, Math.round((it.get() + dir * step) * 100) / 100));
      if (v !== it.get()) { it.set(v); uiSfx.select(); }
    } else if (it.kind === 'toggle') { if (it.act) { uiSfx.select(); it.act(dir); } }
    this.refresh();
  }

  dragTo(i, p) {
    const r = this.rows[i], it = this.items[i];
    const v = Math.max(0, Math.min(1, Math.round(((p.x - r.tx0) / (r.tx1 - r.tx0)) * 20) / 20));
    if (v !== it.get()) { it.set(v); Sfx.play('menu_move', { vol: 0.5, rate: 0.8 + v * 0.5, gap: 0.09 }); this.refresh(); }
  }

  onKey(e) {
    if (e === this.lastEvt) return; // Phaser 3.90 can re-dispatch the same DOM event when a tap spans one frame
    this.lastEvt = e;
    if (!this.live()) return;
    const n = this.items.length;
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': this.select((this.sel - 1 + n) % n); break;
      case 'ArrowDown': case 'KeyS': this.select((this.sel + 1) % n); break;
      case 'ArrowLeft': case 'KeyA': if (this.o.mode === 'row') this.adjust(this.sel, -1); break;
      case 'ArrowRight': case 'KeyD': if (this.o.mode === 'row') this.adjust(this.sel, 1); break;
      case 'Enter': case 'Space': case 'NumpadEnter': if (!e.repeat) { const it = this.items[this.sel]; if (it.kind === 'slider') this.adjust(this.sel, 1); else this.activate(this.sel); } break;
      default: break;
    }
  }

  setVisible(v) {
    this.visible = v;
    this.markL.setVisible(v); if (this.markR) this.markR.setVisible(v);
    for (const r of this.rows) { for (const ob of r.objs) ob.setVisible(v); if (r.zone.input) r.zone.input.enabled = v; }
    this.refresh();
  }
  /** Enable/disable input (visible stays). Enabling locks input for 150 ms so the keypress that opened this list is not reused. */
  setEnabled(b) { this.enabled = b; if (b) this.lockUntil = performance.now() + 150; }
  /** Show + enable in one go. */
  open() { this.setVisible(true); this.setEnabled(true); }
  close() { this.setEnabled(false); this.setVisible(false); this.drag = -1; }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    try { this.scene.input.keyboard.off('keydown', this._key); this.scene.input.off('pointermove', this._move); this.scene.input.off('pointerup', this._up); } catch (e) { /* scene already gone */ }
  }
}
