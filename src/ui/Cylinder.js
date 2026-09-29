// Revolver cylinder (6 rounds, rotates 60deg per shot with a recoil kick) + dodge-roll cooldown pip.
// A brass notch marks the firing chamber; when the SIXTH bullet is up the ring glows gold and pulses, and firing it pops the whole cylinder.
// The roll pip fills while cooling down and flashes when the roll is ready again.
import Assets from '../core/Assets.js';
import { bus } from '../core/events.js';
import { FONT_BODY, CSS } from '../config.js';

const CX = 800, CY = 48, R = 26;

export default class Cylinder {
  constructor(hud) {
    this.hud = hud;
    this.glow = hud.add.image(CX, CY, 'glow').setScale(1.15).setTint(0xffb030).setAlpha(0).setDepth(9).setBlendMode('ADD');
    this.ring = hud.add.container(CX, CY).setDepth(10);
    this.ring.add(hud.add.circle(0, 0, 44, 0x1a100c, 0.92).setStrokeStyle(4, 0x6b4423));
    this.slots = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
      const im = Assets.makeCell(hud, Math.cos(a) * R, Math.sin(a) * R, 'hud_icons', 'bullet_full', 0.5).setScale(0.5);
      this.slots.push(im);
      this.ring.add(im);
    }
    this.hub = hud.add.circle(CX, CY, 7, 0x120c0a).setStrokeStyle(2, 0x6b4423).setDepth(11);
    // firing-chamber notch (does not rotate)
    this.notch = hud.add.triangle(CX, CY - 50, 0, 0, 14, 0, 7, 11, 0xd9b071).setStrokeStyle(2, 0x120c0a).setDepth(11);
    this.loaded = -1;
    this.rot = 0;
    this.pip = hud.add.graphics().setDepth(10);
    this.pipLabel = hud.add.text(CX + 96, CY + 30, 'SPACE', { fontFamily: FONT_BODY, fontSize: '12px', color: CSS.sand }).setOrigin(0.5).setDepth(10).setAlpha(0.7);
    this.wasReady = true;
    this.pipPop = 0;
    this._fn = (p) => {
      this.rot += Math.PI / 3;
      hud.tweens.add({ targets: this.ring, rotation: this.rot, duration: 110, ease: 'Cubic.easeOut' });
      const k = p && p.sixth ? 1.22 : 0.92;
      hud.tweens.add({ targets: this.ring, scale: { from: k, to: 1 }, duration: p && p.sixth ? 320 : 150, ease: p && p.sixth ? 'Back.easeOut' : 'Cubic.easeOut' });
    };
    bus.on('player:fired', this._fn);
    hud.events.once('shutdown', () => bus.off('player:fired', this._fn));
  }

  update(g) {
    const p = g.player;
    const loaded = p.cylinder.loaded;
    const sixth = loaded === 1;
    if (loaded !== this.loaded) {
      this.loaded = loaded;
      // the ring rotates 60deg per shot; the chamber fired k-th (from the top) is slot (-k mod 6)
      const fired = 6 - loaded;
      const empty = new Set();
      for (let m = 0; m < fired; m++) empty.add(((-m % 6) + 6) % 6);
      this.slots.forEach((im, i) => {
        const full = !empty.has(i);
        im.setFrame(Assets.frame('hud_icons', full ? 'bullet_full' : 'bullet_empty'));
        im.setAlpha(full ? 1 : 0.5);
        if (full && sixth) im.setTint(0xffc040); else im.clearTint(); // sixth bullet ready: gold
      });
    }
    // gold pulse while the sixth bullet is in the chamber
    this.glow.setAlpha(sixth ? 0.35 + 0.25 * Math.sin(this.hud.time.now / 130) : 0);
    this.notch.setFillStyle(sixth ? 0xffc040 : 0xd9b071);

    const g2 = this.pip;
    g2.clear();
    const x = CX + 96, y = CY;
    const ready = p.rollCd <= 0;
    if (ready && !this.wasReady) this.pipPop = 1; // roll came off cooldown
    this.wasReady = ready;
    this.pipPop = Math.max(0, this.pipPop - 0.06);
    const r = 17 + this.pipPop * 6;
    g2.fillStyle(0x1a100c, 0.92).fillCircle(x, y, r);
    if (this.pipPop > 0) g2.fillStyle(0x8fc23f, this.pipPop * 0.45).fillCircle(x, y, r + 4);
    g2.lineStyle(4, ready ? 0x8fc23f : 0xf0a640, 1);
    const prog = ready ? 1 : 1 - p.rollCd / p.stats.rollCooldown;
    g2.beginPath();
    g2.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, prog), false);
    g2.strokePath();
  }
  destroy() { this.ring.destroy(); this.pip.destroy(); this.hub.destroy(); this.pipLabel.destroy(); this.glow.destroy(); this.notch.destroy(); }
}
