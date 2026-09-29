// Hearts + tin hearts (icons from 'hud_icons'). Wraps after 6 per row and shrinks to fit the 96px strip (1 row big, 2 rows medium, 3 rows small).
// Slots are pooled: only the changed heart animates (damage = shake + white flash, heal / new container = green-gold pop).
// At <= 1 heart (incl. tin) the filled hearts throb with the heartbeat (hud.beat from Vignette).
import Assets from '../core/Assets.js';

const PER_ROW = 6, X0 = 24;

export default class Hearts {
  constructor(hud) {
    this.hud = hud;
    this.slots = []; // {img, name}
    this.sig = '';
    this.rows = 0;
    this.prevUnits = null;
  }

  layout(total) {
    const rows = Math.max(1, Math.ceil(total / PER_ROW));
    const rowH = rows === 1 ? 52 : rows === 2 ? 42 : 30;
    this.rows = rows;
    this.scale = rowH / 60;
    this.step = Math.min(50, Math.round(rowH * 0.9));
    this.rowH = rowH;
    this.y0 = 48 - (rows * rowH) / 2 + rowH / 2 + 1;
  }
  pos(i) { return { x: X0 + this.step / 2 + (i % PER_ROW) * this.step, y: this.y0 + Math.floor(i / PER_ROW) * this.rowH }; }

  names(p) {
    const out = [];
    const total = p.stats.maxHearts + Math.ceil(p.tin / 2);
    for (let i = 0; i < total; i++) {
      if (i < p.stats.maxHearts) {
        const units = Math.max(0, Math.min(2, p.hp - i * 2));
        out.push(units >= 2 ? 'heart_full' : units === 1 ? 'heart_half' : 'heart_empty');
      } else out.push(p.tin - (i - p.stats.maxHearts) * 2 >= 2 ? 'tin_full' : 'tin_half');
    }
    return out;
  }

  update(g) {
    const p = g.player;
    const units = p.hp + p.tin;
    const sig = `${p.hp}|${p.tin}|${p.stats.maxHearts}`;
    if (sig !== this.sig) {
      const names = this.names(p);
      const relayout = names.length !== this.slots.length;
      const dmg = this.prevUnits != null && units < this.prevUnits;
      if (relayout) this.layout(names.length);
      names.forEach((name, i) => {
        let s = this.slots[i];
        const isNew = !s;
        if (!s) { s = this.slots[i] = { img: Assets.makeCell(this.hud, 0, 0, 'hud_icons', name, 0.5).setDepth(10), name: '' }; }
        if (relayout || isNew) { const q = this.pos(i); s.img.setPosition(q.x, q.y); s.bx = q.x; }
        if (s.name !== name) {
          const first = s.name === '';
          s.img.setFrame(Assets.frame('hud_icons', name));
          const before = s.name;
          s.name = name;
          if (!first && this.prevUnits != null) this.animate(s, before, name, dmg);
        }
      });
      while (this.slots.length > names.length) this.slots.pop().img.destroy();
      this.sig = sig;
      this.prevUnits = units;
    }
    // low-health throb
    const b = this.hud.beat || 0;
    const sc = this.scale * (1 + b * 0.22);
    for (const s of this.slots) if (!s.busy) s.img.setScale(s.name === 'heart_empty' ? this.scale : sc);
  }

  animate(s, before, after, dmg) {
    const h = this.hud, im = s.img;
    s.busy = true;
    h.tweens.killTweensOf(im);
    const done = () => { s.busy = false; im.clearTint(); im.x = s.bx; };
    if (dmg) {
      im.setTintFill(0xffffff);
      h.time.delayedCall(90, () => im.clearTint());
      h.tweens.add({ targets: im, scale: { from: this.scale * 1.5, to: this.scale }, duration: 320, ease: 'Cubic.easeOut' });
      h.tweens.add({ targets: im, x: { from: s.bx - 6, to: s.bx }, duration: 320, ease: 'Elastic.easeOut', onComplete: done });
    } else {
      im.setTint(0xfff0a0);
      h.time.delayedCall(140, () => im.clearTint());
      h.tweens.add({ targets: im, scale: { from: this.scale * 0.5, to: this.scale }, duration: 380, ease: 'Back.easeOut', onComplete: done });
    }
  }
  destroy() { for (const s of this.slots) s.img.destroy(); this.slots.length = 0; }
}
