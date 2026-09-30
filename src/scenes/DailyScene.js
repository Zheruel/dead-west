// Daily Ride (CHARACTERS_META C2): today's rider, mutator and seed on the left poster, the local board (TODAY / THIS WEEK / ALL TIME) on the right.
// UTC date, reset countdown, streak. Enter rides out (scene 'Game' with {mode:'daily', date}); Esc goes back. Local only: no network.
import Phaser from 'phaser';
import { W, H, FONT_TITLE, CSS } from '../config.js';
import { Sfx } from '../core/Audio.js';
import { Save } from '../core/Save.js';
import { fmtTime } from '../core/util.js';
import { Meta } from '../meta/index.js';
import { charDef } from '../data/characters.js';
import { MUTATORS, dailyFor, utcDate, addDays, msToReset } from '../data/difficulty.js';
import { title, body, inkText, INK, uiSfx, setOsCursor } from '../ui/UiKit.js';
import TabBar from '../ui/TabBar.js';
import AchievementToast from '../ui/AchievementToast.js';
import { backdrop, panel, riderToken, chip } from '../ui/Silhouette.js';

const TABS = [{ id: 'today', label: 'TODAY' }, { id: 'week', label: 'THIS WEEK' }, { id: 'all', label: 'ALL TIME' }];
const ROWS = 10;
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const INITIAL = { gunslinger: 'G', preacher: 'P', hunter: 'H', queen: 'Q' };

export default class DailyScene extends Phaser.Scene {
  constructor() { super('Daily'); }

  init(data) { this.leaving = false; this.today = (data && data.date) || utcDate(); }

  create() {
    setOsCursor(this.game, '');
    this.cameras.main.fadeIn(300, 13, 8, 6);
    backdrop(this, 'ui_charselect_bg', { dim: 0.4 });
    const day = this.day = dailyFor(this.today);
    const c = charDef(day.char), mut = MUTATORS[day.mutator];
    const locked = !Meta.isModeUnlocked('daily');

    // ---- left poster
    const px = 380;
    panel(this, px, 496, 560, 800); // taller poster: heading and last line clear of the torn edges (Q1-06, V-021)
    this.add.text(px, 212, 'DAILY RIDE', title(52, '#2a1810', { stroke: '#e8d9b0', strokeThickness: 2 })).setOrigin(0.5);
    this.add.text(px, 256, this.today, inkText(30, '#5a1a10', { fontStyle: 'bold' })).setOrigin(0.5);
    if (day.hell) {
      const rb = this.add.graphics();
      rb.fillStyle(0x8a1c1c, 1).fillRect(px - 190, 282, 380, 34).lineStyle(3, 0x2a1810, 1).strokeRect(px - 190, 282, 380, 34);
      this.add.text(px, 299, 'HELL SUNDAY  -  x1.5 REWARD', title(20, CSS.bone, { strokeThickness: 3 })).setOrigin(0.5);
    }
    const pic = riderToken(this, px, 402, day.char, 180);
    pic.highlight(true);
    this.add.text(px, 518, c.name.toUpperCase(), title(28, '#2a1810', { strokeThickness: 0 })).setOrigin(0.5);
    this.add.text(px, 548, Meta.isCharUnlocked(day.char) ? 'your rider for the day' : 'borrowed for the day (locked rider)', inkText(17, INK, { fontStyle: 'italic' })).setOrigin(0.5);
    const mc = chip(this, px, 596, mut.name.toUpperCase(), { size: 24, pad: 20, fill: 0x2a1a12, stroke: 0x8a1c1c, font: FONT_TITLE });
    this.add.text(px, 634, mut.desc, inkText(19, INK, { align: 'center', wordWrap: { width: 470 } })).setOrigin(0.5, 0);
    this.add.text(px, 730, `SEED CODE   ${day.code}`, inkText(22, '#5a1a10', { fontStyle: 'bold' })).setOrigin(0.5);
    const d = Save.get().daily;
    const streak = d.lastDate === this.today || d.lastDate === addDays(this.today, -1) ? d.streak : 0;
    this.add.text(px, 766, `STREAK  ${streak}   (best ${d.bestStreak || 0})`, inkText(21, INK)).setOrigin(0.5);
    this.resetT = this.add.text(px, 798, '', inkText(18, '#6b4423')).setOrigin(0.5);
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickReset() });
    this.tickReset();

    // ---- right board
    const bx = 1050;
    panel(this, bx, 496, 640, 800, { dark: true });
    this.add.text(bx, 200, 'THE LOCAL BOARD', title(36, CSS.bone)).setOrigin(0.5);
    this.rowObjs = [];
    this.empty = this.add.text(bx, 500, 'No rides yet - be the first', body(24, CSS.sand)).setOrigin(0.5).setVisible(false);
    this.tabs = new TabBar(this, { x: bx, y: 252, w: 560, tabs: TABS, onChange: (id) => this.fill(id), size: 22, depth: 20 });
    this.key = (e) => {
      if (this.leaving || e.repeat) return;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.tabs.step(-1);
      else if (e.code === 'KeyD' || e.code === 'ArrowRight') this.tabs.step(1);
      else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') this.go();
      else if (e.code === 'Escape' || e.code === 'Backspace') this.back();
    };
    this.input.keyboard.on('keydown', this.key);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.key));

    // ---- footer
    const plq = this.add.container(W / 2 + 330, 924);
    const g = this.add.graphics();
    g.fillStyle(locked ? 0x3a2a20 : 0x8a1c1c, 1).fillRoundedRect(-140, -24, 280, 48, 10).lineStyle(3, 0xf0a640, 1).strokeRoundedRect(-140, -24, 280, 48, 10);
    plq.add([g, this.add.text(0, 0, locked ? 'LOCKED' : 'RIDE OUT', title(28, CSS.bone)).setOrigin(0.5)]);
    plq.setSize(280, 48).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.go());
    this.add.text(60, 924, 'A / D  board     ENTER  ride out     ESC  back', body(17, '#8a7350', { strokeThickness: 3 })).setOrigin(0, 0.5);
    this.toasts = new AchievementToast(this, { hold: false });
    this.locked = locked;
  }

  tickReset() {
    const ms = msToReset(), h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    this.resetT.setText(`RESETS IN ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} (UTC)`);
  }

  fill(scope) {
    for (const o of this.rowObjs) o.destroy();
    this.rowObjs = [];
    const rows = Meta.dailyBoard(scope, this.today).slice(0, ROWS);
    this.empty.setVisible(!rows.length);
    const bx = 1050, x0 = bx - 290, y0 = 334, step = 46;
    const hdr = (x, s, ox = 0) => this.rowObjs.push(this.add.text(x, y0 - 30, s, body(14, '#a48a5c')).setOrigin(ox, 0.5));
    if (rows.length) { hdr(x0 + 8, '#'); hdr(x0 + 50, 'DATE'); hdr(x0 + 190, 'RIDER'); hdr(x0 + 300, 'REWARD', 1); hdr(x0 + 400, 'TIME', 1); hdr(x0 + 578, 'RESULT', 1); }
    const best = new Map();
    for (const r of Meta.dailyBoard('all', this.today)) if (!best.has(r.date) || r.score > best.get(r.date)) best.set(r.date, r.score);
    rows.forEach((r, i) => {
      const y = y0 + i * step, top = r.score === best.get(r.date);
      const bg = this.add.rectangle(bx, y, 600, step - 6, top ? 0x4a2a12 : 0x120c0a, top ? 0.85 : 0.5).setStrokeStyle(2, top ? 0xf0a640 : 0x3a2418, 1);
      const col = top ? CSS.amber : CSS.bone;
      const t = (x, s, ox = 0, sz = 20) => this.add.text(x, y, s, body(sz, col, { strokeThickness: 3 })).setOrigin(ox, 0.5);
      const dot = this.add.circle(x0 + 224, y, 15, 0x1c130e).setStrokeStyle(2, 0x6b4423);
      this.rowObjs.push(bg, dot, t(x0 + 8, String(i + 1)), t(x0 + 50, r.date.slice(5), 0, 19), t(x0 + 224, INITIAL[r.char] || '?', 0.5, 17), t(x0 + 300, money(r.score), 1),
        t(x0 + 400, fmtTime(r.time), 1, 18), t(x0 + 578, r.won ? 'WIN' : `F${r.floor}`, 1));
    });
  }

  go() {
    if (this.leaving) return;
    if (this.locked) { Sfx.play('shop_deny', { vol: 0.7 }); return; }
    this.leaving = true;
    Sfx.play('gun_cock', { vol: 0.7 });
    this.cameras.main.fadeOut(320, 13, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { mode: 'daily', date: this.today }));
  }

  back() {
    if (this.leaving) return;
    this.leaving = true;
    uiSfx.back();
    this.cameras.main.fadeOut(220, 13, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
  }
}
