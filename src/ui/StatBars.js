// CharSelect stat bars (CHARACTERS_META A6): six 10-segment bars computed from startStats(id), a thin tick at the Gunslinger's value and a
// 40 ms segment stagger when the rider changes. `new StatBars(scene, {x, y, w, gap, depth})`; `.set(charId | null)` (null = "- - - -" for a locked rider).
import { CSS, FONT_BODY } from '../config.js';
import { BAR_DEFS, barSegments } from '../data/characters.js';

const SEG_GAP = 4;

export default class StatBars {
  constructor(scene, { x = 0, y = 0, w = 560, gap = 46, depth = 10, labelW = 250, ink = false } = {}) {
    this.scene = scene;
    this.o = { x, y, w, gap, depth, labelW };
    this.g = scene.add.graphics().setDepth(depth);
    const col = ink ? '#2a1810' : CSS.bone;
    this.labels = BAR_DEFS.map((d, i) => scene.add.text(x, y + i * gap, d.label, { fontFamily: FONT_BODY, fontSize: '19px', color: col }).setOrigin(0, 0.5).setDepth(depth));
    this.nums = BAR_DEFS.map((d, i) => scene.add.text(x + w, y + i * gap, '', { fontFamily: FONT_BODY, fontSize: '22px', color: ink ? '#5a1a10' : CSS.amber, fontStyle: 'bold' }).setOrigin(1, 0.5).setDepth(depth));
    this.base = BAR_DEFS.map((d) => barSegments('gunslinger', d.key));
    this.vals = BAR_DEFS.map(() => 0); // segments currently lit (animated)
    this.target = null;
    this.timer = null;
    this.ink = ink;
  }

  /** Show rider `id`, or the locked dashes when id is null. */
  set(id) {
    const sc = this.scene;
    if (this.timer) { this.timer.remove(false); this.timer = null; }
    if (!id) {
      this.target = null;
      this.vals.fill(0);
      this.nums.forEach((n) => n.setText('-'));
      this.draw();
      return;
    }
    this.target = BAR_DEFS.map((d) => barSegments(id, d.key));
    this.vals.fill(0);
    this.nums.forEach((n, i) => n.setText(String(this.target[i])));
    let k = 0;
    // one segment per bar per tick: every bar fills together, 40 ms apart
    this.timer = sc.time.addEvent({
      delay: 40, repeat: 9, callback: () => { k++; for (let i = 0; i < this.vals.length; i++) this.vals[i] = Math.min(this.target[i], k); this.draw(); },
    });
    this.draw();
  }

  draw() {
    const { x, y, w, gap, labelW } = this.o;
    const g = this.g;
    g.clear();
    const bx = x + labelW, bw = w - labelW - 44, sw = (bw - SEG_GAP * 9) / 10;
    for (let i = 0; i < BAR_DEFS.length; i++) {
      const cy = y + i * gap;
      for (let s = 0; s < 10; s++) {
        const sx = bx + s * (sw + SEG_GAP), on = s < this.vals[i];
        g.fillStyle(on ? 0xd63a2a : (this.ink ? 0x2a1810 : 0x0a0605), on ? 1 : this.ink ? 0.22 : 0.85).fillRect(sx, cy - 9, sw, 18);
        if (on) g.fillStyle(0xffffff, 0.16).fillRect(sx, cy - 9, sw, 5);
        g.lineStyle(2, this.ink ? 0x2a1810 : 0x120c0a, 1).strokeRect(sx, cy - 9, sw, 18);
      }
      if (this.target) { // tick at the Gunslinger's value (the reference rider)
        const tx = bx + this.base[i] * (sw + SEG_GAP) - SEG_GAP / 2;
        g.fillStyle(0xf0a640, 1).fillRect(tx - 1.5, cy - 15, 3, 30);
      }
    }
  }

  setVisible(v) { this.g.setVisible(v); for (const t of this.labels) t.setVisible(v); for (const t of this.nums) t.setVisible(v); }
  destroy() { if (this.timer) this.timer.remove(false); this.g.destroy(); for (const t of [...this.labels, ...this.nums]) t.destroy(); }
}
