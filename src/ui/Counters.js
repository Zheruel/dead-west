// Coin / key / dynamite counters. On change the icon hops and the number pops (green when it goes up, red when it goes down);
// a counter at zero is dimmed so a missing key / dynamite reads at a glance.
import Assets from '../core/Assets.js';
import { FONT_BODY, CSS } from '../config.js';

const BASE = 0.75;

export default class Counters {
  constructor(hud) {
    this.hud = hud;
    this.items = [
      { name: 'coin', key: 'coins', x: 350 },
      { name: 'key', key: 'keys', x: 470 },
      { name: 'dynamite', key: 'dynamite', x: 590 },
    ].map((c) => ({
      ...c,
      icon: Assets.makeCell(hud, c.x, 48, 'hud_icons', c.name, 0.5).setScale(BASE).setDepth(10),
      text: hud.add.text(c.x + 28, 48, '00', { fontFamily: FONT_BODY, fontSize: '32px', color: CSS.bone, stroke: '#120c0a', strokeThickness: 5 }).setOrigin(0, 0.5).setDepth(10),
      val: -1,
    }));
  }
  update(g) {
    for (const c of this.items) {
      const v = g.player[c.key];
      if (v === c.val) continue;
      const first = c.val < 0, up = v > c.val;
      c.val = v;
      c.text.setText(String(v).padStart(2, '0'));
      const dim = v === 0;
      c.icon.setAlpha(dim ? 0.45 : 1);
      if (first) { c.text.setAlpha(dim ? 0.55 : 1); continue; }
      const h = this.hud;
      h.tweens.killTweensOf([c.icon, c.text]);
      c.text.setAlpha(dim ? 0.55 : 1);
      c.text.setColor(up ? CSS.green : '#ff6a50');
      h.time.delayedCall(320, () => c.text.setColor(CSS.bone));
      h.tweens.add({ targets: c.icon, scale: { from: BASE * 1.45, to: BASE }, angle: { from: up ? -14 : 14, to: 0 }, duration: 320, ease: 'Back.easeOut' });
      h.tweens.add({ targets: c.text, scale: { from: up ? 1.5 : 0.75, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    }
  }
  destroy() { for (const c of this.items) { c.icon.destroy(); c.text.destroy(); } }
}
