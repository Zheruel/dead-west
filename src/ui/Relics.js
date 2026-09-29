// Collected passive relics strip (bottom-left, over the wall band): unique icons with an xN badge for stacks, a pop + glint when a new one is
// picked up, and a hover tooltip (name + description) driven by manual pointer hit-testing (no interactive objects, so the HUD never steals game clicks).
import Assets from '../core/Assets.js';
import { getItem } from '../items/registry.js';
import { FONT_TITLE, FONT_BODY, CSS } from '../config.js';

const X0 = 34, Y0 = 898, STEP = 40, ROW_H = 38, PER_ROW = 10, MAX = 20, SC = 0.38;

export default class Relics {
  constructor(hud) {
    this.hud = hud;
    this.objs = [];
    this.cells = [];
    this.sig = null;
    this.prevIds = new Set();
    this.tip = hud.add.container(0, 0).setDepth(200).setVisible(false);
    this.tipBg = hud.add.graphics();
    this.tipName = hud.add.text(0, 0, '', { fontFamily: FONT_TITLE, fontSize: '22px', color: CSS.amber, stroke: '#120c0a', strokeThickness: 4 });
    this.tipDesc = hud.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '18px', color: CSS.bone, wordWrap: { width: 360 } });
    this.tip.add([this.tipBg, this.tipName, this.tipDesc]);
    this.hover = null;
  }

  rebuild(uniq, counts) {
    const h = this.hud;
    for (const o of this.objs) o.destroy();
    this.objs = []; this.cells = [];
    const shown = uniq.slice(0, MAX);
    shown.forEach((id, i) => {
      const def = getItem(id);
      const ic = (def && def.icon) || { sheet: 'items_passive_a', name: id };
      const x = X0 + (i % PER_ROW) * STEP + STEP / 2 - 6, y = Y0 + Math.floor(i / PER_ROW) * ROW_H;
      const back = h.add.circle(x, y, 18, 0x120c0a, 0.62).setStrokeStyle(2, 0x6b4423, 0.9).setDepth(9);
      const im = Assets.makeCell(h, x, y, ic.sheet, ic.name, 0.5).setScale(SC).setDepth(10);
      this.objs.push(back, im);
      const n = counts.get(id);
      if (n > 1) this.objs.push(h.add.text(x + 15, y + 10, `x${n}`, { fontFamily: FONT_BODY, fontSize: '13px', color: CSS.bone, stroke: '#120c0a', strokeThickness: 4 }).setOrigin(1, 0.5).setDepth(11));
      this.cells.push({ x, y, id, def, n });
      if (!this.prevIds.has(id) && this.sig !== null) {
        im.setScale(0.9).setTintFill(0xffffff);
        h.time.delayedCall(120, () => im.clearTint());
        h.tweens.add({ targets: im, scale: SC, duration: 460, ease: 'Elastic.easeOut' });
        h.tweens.add({ targets: back, scale: { from: 1.7, to: 1 }, duration: 360, ease: 'Back.easeOut' });
      }
    });
    if (uniq.length > MAX) this.objs.push(h.add.text(X0 + PER_ROW * STEP, Y0 + ROW_H, `+${uniq.length - MAX}`, { fontFamily: FONT_BODY, fontSize: '16px', color: CSS.sand, stroke: '#120c0a', strokeThickness: 4 }).setOrigin(0, 0.5).setDepth(10));
    this.prevIds = new Set(uniq);
  }

  update(g) {
    const ids = g.player.items;
    const sig = ids.join(',');
    if (sig !== this.sig) {
      const counts = new Map();
      for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
      this.rebuild([...counts.keys()], counts);
      this.sig = sig;
    }
    // hover tooltip
    const p = this.hud.input.activePointer;
    let hit = null;
    if (this.cells.length) for (const c of this.cells) if (Math.abs(p.x - c.x) <= 19 && Math.abs(p.y - c.y) <= 19) { hit = c; break; }
    if (!hit) { this.tip.setVisible(false); this.hover = null; return; }
    if (hit !== this.hover) {
      this.hover = hit;
      this.tipName.setText(hit.def ? `${hit.def.name}${hit.n > 1 ? `  x${hit.n}` : ''}` : hit.id);
      this.tipDesc.setText(hit.def ? hit.def.desc || '' : '');
      const w = Math.max(this.tipName.width, this.tipDesc.width) + 28, hh = this.tipName.height + this.tipDesc.height + 22;
      this.tipName.setPosition(14, 8);
      this.tipDesc.setPosition(14, this.tipName.height + 12);
      this.tipBg.clear().fillStyle(0x0d0806, 0.95).fillRoundedRect(0, 0, w, hh, 8).lineStyle(3, 0x8a4b1f, 1).strokeRoundedRect(0, 0, w, hh, 8);
      this.tipW = w; this.tipH = hh;
    }
    this.tip.setPosition(Math.min(1440 - this.tipW - 8, hit.x - 14), hit.y - 24 - this.tipH).setVisible(true);
  }
  destroy() { for (const o of this.objs) o.destroy(); this.tip.destroy(); }
}
