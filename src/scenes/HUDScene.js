// Overlay scene: everything drawn on top of the game (hearts, counters, cylinder, minimap, banners, cards).
// Each widget lives in src/ui/*.js and exposes update(g) (g = GameScene). Add a widget by pushing it into this.widgets.
import Phaser from 'phaser';
import { W, H, FONT_TITLE, FONT_BODY, CSS } from '../config.js';
import { flag, fmtTime } from '../core/util.js';
import { FLOORS } from '../config.js';
import { bus } from '../core/events.js';
import Hearts from '../ui/Hearts.js';
import Counters from '../ui/Counters.js';
import Cylinder from '../ui/Cylinder.js';
import ActiveSlot from '../ui/ActiveSlot.js';
import BossBar from '../ui/BossBar.js';
import Minimap from '../ui/Minimap.js';
import Banner from '../ui/Banner.js';
import Cards from '../ui/Cards.js';
import Vignette from '../ui/Vignette.js';
import Relics from '../ui/Relics.js';
import Cursor from '../ui/Cursor.js';
import { Save } from '../core/Save.js';
import { MUTATORS } from '../data/difficulty.js';
import AchievementToast from '../ui/AchievementToast.js';
import { chip } from '../ui/Silhouette.js';

export default class HUDScene extends Phaser.Scene {
  constructor() { super('HUD'); }

  init(data) { this.g = data.game; }

  create() {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    // top strip
    const strip = this.add.graphics().setDepth(0);
    strip.fillStyle(0x0d0806, 0.92).fillRect(0, 0, W, 96);
    strip.fillStyle(0x3a2418, 1).fillRect(0, 92, W, 4);
    strip.fillStyle(0x120c0a, 1).fillRect(0, 96, W, 2);

    this.widgets = [
      new Vignette(this),
      new Hearts(this),
      new Counters(this),
      new Cylinder(this),
      new ActiveSlot(this),
      new BossBar(this),
      new Minimap(this),
      new Banner(this),
      new Cards(this),
      new Relics(this),
      new Cursor(this),
      new AchievementToast(this, { hold: true }),
    ];
    this.chips = null;
    this.lastSec = -1;

    this.floorText = this.add.text(W - 28, H - 62, '', { fontFamily: FONT_BODY, fontSize: '20px', color: CSS.sand, stroke: '#120c0a', strokeThickness: 4 }).setOrigin(1, 0.5).setDepth(5).setAlpha(0.85);
    this.timeText = this.add.text(W - 28, H - 34, '', { fontFamily: FONT_BODY, fontSize: '20px', color: CSS.sand, stroke: '#120c0a', strokeThickness: 4 }).setOrigin(1, 0.5).setDepth(5).setAlpha(0.85);
    this.toast = this.add.text(W / 2, 128, '', { fontFamily: FONT_TITLE, fontSize: '34px', color: CSS.amber, stroke: '#120c0a', strokeThickness: 7 }).setOrigin(0.5).setDepth(50).setAlpha(0);
    bus.scoped(this, 'ui:toast', (p) => this.showToast(p.text, p.color));
    if (flag('debug')) this.dbg = this.add.text(8, 100, '', { fontFamily: 'monospace', fontSize: '16px', color: '#8fc23f', backgroundColor: '#000000aa' }).setDepth(100);
    this.events.once('shutdown', () => { for (const w of this.widgets) if (w.destroy) w.destroy(); this.chips = null; });
  }

  /** HELL / DAILY / CONTRACT chip and one chip per active mutator, built once per run above the floor line (bottom right). */
  buildChips(run) {
    this.chips = [];
    const list = [];
    if (run.mode === 'hell') list.push(['HELL ON EARTH', 0xd63a2a, 0x4a0e0a]);
    else if (run.mode === 'daily') list.push(['DAILY', 0xf0a640, 0x2a1a12]);
    else if (run.mode === 'contract') list.push(['CONTRACT', 0xf0a640, 0x2a1a12]);
    for (const m of run.mutators || []) if (MUTATORS[m]) list.push([MUTATORS[m].name.toUpperCase(), 0x6b4423, 0x2a1a12]);
    let x = W - 28;
    for (const [label, stroke, fill] of list.reverse()) {
      const c = chip(this, 0, H - 100, label, { size: 15, stroke, fill, color: CSS.sand, pad: 9 });
      c.setPosition(x - c.w / 2, H - 100).setDepth(5).setAlpha(0.9);
      this.chips.push(c);
      x -= c.w + 6;
    }
  }

  showToast(text, color) {
    this.toast.setText(text).setColor(color || CSS.amber).setAlpha(1).setY(120);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, y: 140, alpha: 0, delay: 900, duration: 700 });
  }

  update(time, delta) {
    const g = this.g;
    if (!g || !g.player) return;
    for (const w of this.widgets) w.update(g, delta / 1000);
    const f = FLOORS[g.floorNum] || FLOORS[1];
    this.floorText.setText(`FLOOR ${f.n}  -  ${f.name}`);
    if (!this.chips) this.buildChips(g.run);
    const showT = Save.settings().runTimer !== false;
    if (this.timeText.visible !== showT) this.timeText.setVisible(showT);
    const sec = Math.floor(g.run.time);
    if (showT && sec !== this.lastSec) { this.lastSec = sec; this.timeText.setText(fmtTime(g.run.time)); }
    if (this.dbg) {
      const p = g.player;
      this.dbg.setText(`fps ${Math.round(this.game.loop.actualFps)}  bullets ${g.bullets.count}  enemies ${g.enemies.length}  room ${g.roomMgr.currentId} ${g.room ? g.room.type : ''}\nseed ${g.seed}  pos ${Math.round(p.x)},${Math.round(p.y)}  hp ${p.hp}/${p.maxHp} tin ${p.tin}${p.godMode ? '  GOD' : ''}`);
    }
  }
}
