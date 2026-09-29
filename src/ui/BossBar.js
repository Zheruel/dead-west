// Boss health bar (bottom centre, in the wall band): riveted plate, skull, name, trailing "damage ghost", white hit flash, phase notches
// (from boss.phases[].at), red pulse below 25%, pop on phase change. Driven by 'boss:spawned' / 'boss:hp' / 'boss:phase' / 'boss:defeated' / 'room:transition'.
import { bus } from '../core/events.js';
import { FONT_TITLE, CSS } from '../config.js';

const BW = 680, PX = 720 - BW / 2 - 10, PY = 892, PW = BW + 20, PH = 58, X = 720 - BW / 2, Y = 922, BH = 18;

export default class BossBar {
  constructor(hud) {
    this.hud = hud;
    this.c = hud.add.container(0, 0).setDepth(20).setVisible(false);
    this.plate = hud.add.graphics();
    this.plate.fillStyle(0x0d0806, 0.94).fillRoundedRect(PX, PY, PW, PH, 10);
    this.plate.lineStyle(4, 0x6b4423, 1).strokeRoundedRect(PX, PY, PW, PH, 10);
    this.plate.fillStyle(0x8a4b1f, 1);
    for (const [rx, ry] of [[PX + 8, PY + 8], [PX + PW - 8, PY + 8], [PX + 8, PY + PH - 8], [PX + PW - 8, PY + PH - 8]]) this.plate.fillCircle(rx, ry, 2.5);
    this.back = hud.add.rectangle(X, Y, BW, BH, 0x2a1210).setOrigin(0, 0);
    this.ghost = hud.add.rectangle(X, Y, BW, BH, 0xf0a640, 0.75).setOrigin(0, 0);
    this.fill = hud.add.rectangle(X, Y, BW, BH, 0xa02018).setOrigin(0, 0);
    this.shine = hud.add.rectangle(X, Y, BW, 5, 0xff8a70, 0.55).setOrigin(0, 0);
    this.flash = hud.add.rectangle(X, Y, BW, BH, 0xffffff, 0).setOrigin(0, 0);
    this.notches = hud.add.graphics();
    this.frame = hud.add.graphics();
    this.frame.lineStyle(2, 0x120c0a, 1).strokeRect(X, Y, BW, BH);
    this.skull = hud.add.graphics(); // drawn (no font dependency): cranium, jaw, eye sockets, nose
    const kx = PX + 22, ky = PY + 16;
    this.skull.fillStyle(0xe8dcc0, 1).fillCircle(kx, ky - 2, 10).fillRect(kx - 6, ky + 3, 12, 8);
    this.skull.fillStyle(0x120c0a, 1).fillCircle(kx - 4, ky - 2, 3).fillCircle(kx + 4, ky - 2, 3).fillTriangle(kx, ky + 1, kx - 2, ky + 5, kx + 2, ky + 5).fillRect(kx - 3, ky + 8, 1.5, 3).fillRect(kx + 1.5, ky + 8, 1.5, 3);
    this.name = hud.add.text(PX + 44, PY + 15, '', { fontFamily: FONT_TITLE, fontSize: '22px', color: CSS.bone, stroke: '#120c0a', strokeThickness: 5 }).setOrigin(0, 0.5);
    this.pct = hud.add.text(PX + PW - 14, PY + 15, '', { fontFamily: FONT_TITLE, fontSize: '18px', color: CSS.sand, stroke: '#120c0a', strokeThickness: 4 }).setOrigin(1, 0.5);
    this.c.add([this.plate, this.back, this.ghost, this.fill, this.shine, this.flash, this.notches, this.frame, this.skull, this.name, this.pct]);
    this.ratio = 1;
    this.shownGhost = 1;
    this.lastRatio = 1;
    const on = (e, fn) => bus.scoped(hud, e, fn);
    on('boss:spawned', (p) => {
      this.name.setText(p.name);
      this.ratio = this.lastRatio = p.hp / p.maxHp;
      this.shownGhost = this.ratio;
      this.notches.clear();
      const ph = p.boss && p.boss.phases;
      if (ph) { this.notches.lineStyle(3, 0xe8dcc0, 0.85); for (const q of ph) if (q.at > 0 && q.at < 1) this.notches.lineBetween(X + BW * q.at, Y - 3, X + BW * q.at, Y + BH + 3); }
      hud.tweens.killTweensOf(this.c);
      this.c.setVisible(true).setAlpha(0).setY(30);
      hud.tweens.add({ targets: this.c, alpha: 1, y: 0, duration: 450, ease: 'Cubic.easeOut' });
    });
    on('boss:hp', (p) => { this.ratio = Math.max(0, p.hp / p.maxHp); });
    on('boss:phase', () => {
      this.flash.setAlpha(0.8);
      hud.tweens.add({ targets: this.c, y: { from: -6, to: 0 }, duration: 320, ease: 'Elastic.easeOut' });
      hud.tweens.add({ targets: this.name, scale: { from: 1.25, to: 1 }, duration: 320, ease: 'Back.easeOut' });
    });
    on('boss:defeated', () => {
      this.ratio = 0; this.flash.setAlpha(1);
      hud.tweens.add({ targets: this.c, alpha: 0, delay: 500, duration: 800, onComplete: () => this.c.setVisible(false) });
    });
    on('room:transition', () => this.c.setVisible(false));
  }

  update(g, dt) {
    if (!this.c.visible) return;
    const r = this.ratio;
    if (r < this.lastRatio - 0.0005) this.flash.setAlpha(Math.max(this.flash.alpha, 0.55)); // hit flash
    this.lastRatio = r;
    this.flash.setAlpha(Math.max(0, this.flash.alpha - dt * 5));
    this.fill.width = Math.max(0, BW * r);
    this.shine.width = this.fill.width;
    this.shownGhost = Math.max(r, this.shownGhost - dt * 0.3);
    this.ghost.width = BW * this.shownGhost;
    const low = r > 0 && r < 0.25;
    this.fill.setFillStyle(low ? (Math.sin(this.hud.time.now / 110) > 0 ? 0xd63a2a : 0x8a1c1c) : 0xa02018);
    this.pct.setText(`${Math.ceil(r * 100)}%`);
  }
  destroy() { this.c.destroy(); }
}
