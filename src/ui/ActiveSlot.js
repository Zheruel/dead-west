// Active item slot (Q): framed box + icon, segmented charge bar underneath, gold pulse + "READY" ping when fully charged,
// charge-up pip flash on every room clear, and a flash when the item is used. Empty slot = faint frame.
import Assets from '../core/Assets.js';
import { getItem } from '../items/registry.js';
import { Sfx } from '../core/Audio.js';
import { FONT_BODY, CSS } from '../config.js';

const X = 1010, Y = 45, S = 62;

export default class ActiveSlot {
  constructor(hud) {
    this.hud = hud;
    this.glow = hud.add.image(X, Y, 'glow').setScale(1.5).setTint(0xf0a640).setAlpha(0).setDepth(9).setBlendMode('ADD');
    this.box = hud.add.graphics().setDepth(10);
    this.key = hud.add.text(X - S / 2 + 4, Y - S / 2 + 2, 'Q', { fontFamily: FONT_BODY, fontSize: '16px', color: CSS.sand, stroke: '#120c0a', strokeThickness: 4 }).setOrigin(0, 0).setDepth(13);
    this.icon = null;
    this.bar = hud.add.graphics().setDepth(11);
    this.ready = hud.add.text(X, Y + S / 2 + 12, 'READY', { fontFamily: FONT_BODY, fontSize: '13px', color: CSS.amber, stroke: '#120c0a', strokeThickness: 3 }).setOrigin(0.5).setDepth(12).setAlpha(0);
    this.sig = '';
    this.charge = -1; this.id = null; this.max = 0;
    this.draw(null);
  }

  draw(a) {
    const ready = a && a.charge >= a.max;
    const g = this.box;
    g.clear();
    g.fillStyle(0x1a100c, a ? 0.95 : 0.55).fillRoundedRect(X - S / 2, Y - S / 2, S, S, 10);
    g.lineStyle(4, ready ? 0xf0a640 : a ? 0x8a6a3a : 0x4a3420, 1).strokeRoundedRect(X - S / 2, Y - S / 2, S, S, 10);
    if (ready) g.lineStyle(2, 0xffe0a0, 0.7).strokeRoundedRect(X - S / 2 + 4, Y - S / 2 + 4, S - 8, S - 8, 7);
    this.key.setColor(ready ? CSS.amber : CSS.sand).setAlpha(a ? 1 : 0.5);
  }

  drawBar(a) {
    const b = this.bar;
    b.clear();
    if (!a) return;
    const w = S - 4, segW = w / a.max;
    for (let i = 0; i < a.max; i++) {
      const on = i < a.charge;
      b.fillStyle(on ? (a.charge >= a.max ? 0xffc050 : 0xf0a640) : 0x3a2418, 1).fillRect(X - S / 2 + 2 + i * segW + 1, Y + S / 2 + 4, segW - 2, 7);
      if (on) b.fillStyle(0xffffff, 0.3).fillRect(X - S / 2 + 2 + i * segW + 1, Y + S / 2 + 4, segW - 2, 2);
    }
  }

  update(g) {
    const a = g.player.active;
    const sig = a ? `${a.id}|${a.charge}|${a.max}` : '';
    const ready = !!a && a.charge >= a.max;
    if (sig !== this.sig) {
      const h = this.hud;
      const newItem = (a ? a.id : null) !== this.id;
      const gained = a && !newItem && a.charge > this.charge;
      const used = a && !newItem && a.charge < this.charge;
      const justReady = ready && (newItem || a.charge > this.charge) && this.charge < a.max;
      this.sig = sig;
      this.id = a ? a.id : null; this.charge = a ? a.charge : -1; this.max = a ? a.max : 0;
      if (this.icon) { this.icon.destroy(); this.icon = null; }
      this.draw(a);
      this.drawBar(a);
      if (a) {
        const def = getItem(a.id);
        const ic = (def && def.icon) || { sheet: 'items_active', name: a.id };
        this.icon = Assets.makeCell(h, X, Y, ic.sheet, ic.name, 0.5).setScale(0.6).setDepth(11);
        if (ready) this.icon.clearTint(); else this.icon.setTint(0x8a7a6a);
        if (newItem) h.tweens.add({ targets: this.icon, scale: { from: 1.1, to: 0.6 }, angle: { from: -20, to: 0 }, duration: 380, ease: 'Back.easeOut' });
        else if (used) h.tweens.add({ targets: this.icon, scale: { from: 0.85, to: 0.6 }, duration: 260, ease: 'Cubic.easeOut' });
        else if (gained) h.tweens.add({ targets: this.icon, scale: { from: 0.72, to: 0.6 }, duration: 200 });
        if (justReady && !newItem) {
          Sfx.play('gun_cock', { vol: 0.5, rate: 1.05 });
          this.ready.setAlpha(1).setScale(1.4);
          h.tweens.killTweensOf(this.ready);
          h.tweens.add({ targets: this.ready, scale: 1, duration: 200, ease: 'Back.easeOut' });
          h.tweens.add({ targets: this.ready, alpha: 0, delay: 1400, duration: 400 });
          h.tweens.add({ targets: this.icon, scale: { from: 1.0, to: 0.6 }, duration: 380, ease: 'Elastic.easeOut' });
        }
      }
    }
    // pulsing glow + icon bob while ready
    if (ready && this.icon) {
      const t = this.hud.time.now / 260;
      this.glow.setAlpha(0.3 + 0.2 * Math.sin(t));
      if (!this.hud.tweens.isTweening(this.icon)) this.icon.setScale(0.6 + Math.sin(t) * 0.025);
    } else this.glow.setAlpha(0);
  }
  destroy() { this.box.destroy(); this.key.destroy(); if (this.icon) this.icon.destroy(); this.bar.destroy(); this.glow.destroy(); this.ready.destroy(); }
}
