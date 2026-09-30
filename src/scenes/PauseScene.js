// Pause overlay on a dark parchment panel: RESUME / OPTIONS / QUIT TO MENU (confirm), run summary and a relic strip with hover names.
// Shows the rider, mode, mutator chips, seed and the Notoriety this ride is worth so far; quitting counts as an abandon (Meta.abandonRun).
// Launched by GameScene (which pauses itself + HUD). ESC / P resume (ESC inside Options goes back one level).
import Phaser from 'phaser';
import { W, H, CSS, FLOORS } from '../config.js';
import { Sfx, Music } from '../core/Audio.js';
import { fmtTime } from '../core/util.js';
import { Meta } from '../meta/index.js';
import { computeReward, runNp } from '../meta/score.js';
import { charDef } from '../data/characters.js';
import { MUTATORS } from '../data/difficulty.js';
import { chip, itemIcon } from '../ui/Silhouette.js';
import { getItem } from '../items/registry.js';
import { MenuList, parchment, title, body, uiSfx, setOsCursor } from '../ui/UiKit.js';
import OptionsPanel from '../ui/OptionsPanel.js';

export default class PauseScene extends Phaser.Scene {
  constructor() { super('Pause'); }

  create() {
    Music.duck(0.3);
    Sfx.play('pause');
    setOsCursor(this.game, ''); // show the real cursor for the menu
    this.confirm = false;
    const g = this.scene.get('Game');
    const cx = W / 2, cy = 400;
    this.dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setAlpha(0);
    this.tweens.add({ targets: this.dim, alpha: 1, duration: 160 });
    this.panel = parchment(this, cx, cy, 940, { dark: true });
    this.panel.y = cy - 60; this.panel.setAlpha(0);
    this.tweens.add({ targets: this.panel, y: cy, alpha: 1, duration: 220, ease: 'Cubic.easeOut' });
    const top = cy - this.panel.displayHeight / 2;
    this.head = this.add.text(cx, top + 96, 'PAUSED', title(92)).setOrigin(0.5);
    const f = FLOORS[g && g.floorNum] || FLOORS[1];
    this.sum = this.add.text(cx, top + 168, `FLOOR ${f.n}  -  ${f.name}      ${g && g.run ? fmtTime(g.run.time) : ''}`, body(22, '#c9ac78')).setOrigin(0.5);
    this.meta = this.runInfo(g, cx, top + 204);
    this.opt = new OptionsPanel(this, { cx, cy, inRun: true, onBack: () => this.showMain(true) });
    this.list = new MenuList(this, [
      { label: 'RESUME', act: () => this.resume() },
      { label: 'OPTIONS', act: () => { this.showMain(false); this.opt.open(); } },
      { label: () => (this.confirm ? 'REALLY QUIT?  ENTER' : 'QUIT TO MENU'), act: () => this.quitPress() },
    ], { x: cx, y: top + 288, gap: 70, size: 44, hitW: 600 });
    this.hint = this.add.text(cx, top + this.panel.displayHeight - 82, 'W / S  choose     ENTER  select     ESC  resume', body(20, CSS.sand)).setOrigin(0.5);
    this.relics(g);

    const kb = this.input.keyboard;
    const esc = () => { if (this.opt.isOpen || this.opt.recentlyClosed() || !this.list.live()) return; this.resume(); };
    kb.on('keydown-ESC', esc);
    kb.on('keydown-P', esc);
  }

  /** Show / hide the main pause widgets (hidden while the options modal replaces them). */
  showMain(on) {
    for (const o of [this.head, this.sum, this.hint, ...this.meta]) o.setVisible(on);
    this.panel.setVisible(on);
    this.list.setVisible(on);
    if (on) { this.list.setEnabled(true); this.list.refresh(); }
    else this.list.setEnabled(false);
    if (this.relicObjs) for (const o of this.relicObjs) o.setVisible(on);
  }

  /** Rider, mode and mutator chips + seed and NP-so-far under the summary line. Returns the objects (hidden while Options is open). */
  runInfo(g, cx, y) {
    const out = [];
    const run = g && g.run;
    if (!run) return out;
    const chips = [charDef(run.char).name.toUpperCase()];
    if (run.mode === 'hell') chips.push('HELL ON EARTH');
    else if (run.mode === 'daily') chips.push(`DAILY ${run.daily ? run.daily.date : ''}`);
    else if (run.mode === 'contract') chips.push('CONTRACT');
    for (const m of run.mutators || []) if (MUTATORS[m]) chips.push(MUTATORS[m].name.toUpperCase());
    const made = chips.slice(0, 5).map((t, i) => chip(this, 0, y, t, { size: 16, stroke: i === 1 && run.mode === 'hell' ? 0xd63a2a : 0x6b4423, color: CSS.sand }));
    let total = made.reduce((a, c) => a + c.w + 8, -8), x = cx - total / 2;
    for (const c of made) { c.setX(x + c.w / 2); x += c.w + 8; out.push(c); }
    const hell = run.mode === 'hell' || !!(run.daily && run.daily.hell);
    const np = Meta.enabled === false ? 0 : (Meta.summary.np.ach || 0) + runNp(computeReward(run, { mode: run.mode, hell }), run.mode, hell);
    out.push(this.add.text(cx, y + 36, `${Meta.enabled === false ? 'PRACTICE RIDE - NOTHING IS RECORDED' : `NOTORIETY THIS RIDE  +${np}`}      SEED  ${run.seed}`, body(17, '#a48a5c', { strokeThickness: 3 })).setOrigin(0.5));
    return out;
  }

  /** Collected relic strip under the panel (hover for name + description). */
  relics(g) {
    this.relicObjs = [];
    const p = g && g.player;
    if (!p) return;
    const ids = [...p.items, ...(p.active ? [p.active.id] : [])];
    const counts = new Map();
    for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
    const y = 786;
    const plate = this.add.rectangle(W / 2, y, 940, 150, 0x120c0a, 0.82).setStrokeStyle(3, 0x6b4423);
    const cap = this.add.text(W / 2, y - 54, ids.length ? 'RELICS' : 'NO RELICS YET', title(24, CSS.amber, { strokeThickness: 4 })).setOrigin(0.5);
    const tip = this.add.text(W / 2, y + 56, '', body(20, CSS.bone, { align: 'center', wordWrap: { width: 880 } })).setOrigin(0.5);
    this.relicObjs.push(plate, cap, tip);
    const list = [...counts.entries()].slice(0, 16);
    const step = 56;
    list.forEach(([id, n], i) => {
      const def = getItem(id);
      const x = W / 2 - ((list.length - 1) * step) / 2 + i * step;
      const im = itemIcon(this, x, y + 2, def || { id }, 0.5).setInteractive({ useHandCursor: true });
      im.on('pointerover', () => { im.setScale(0.58); tip.setText(def ? `${def.name}${n > 1 ? ` x${n}` : ''}  -  ${def.desc || ''}` : id); });
      im.on('pointerout', () => { im.setScale(0.5); tip.setText(''); });
      this.relicObjs.push(im);
      if (n > 1) this.relicObjs.push(this.add.text(x + 20, y + 22, `x${n}`, body(16, CSS.bone, { strokeThickness: 4 })).setOrigin(1, 0.5));
    });
  }

  quitPress() {
    if (!this.confirm) {
      this.confirm = true;
      this.time.delayedCall(2600, () => { this.confirm = false; if (this.list) this.list.refresh(); });
      return;
    }
    this.quit();
  }

  resume() {
    Music.duck(1);
    uiSfx.back();
    const g = this.scene.get('Game');
    setOsCursor(this.game, 'none');
    this.scene.stop();
    g.resumeGame();
  }
  quit() {
    const g = this.scene.get('Game');
    if (g && g.run && !g.ended) { g.ended = true; try { Meta.abandonRun(g.run); } catch (e) { console.warn('[Pause] abandon failed', e); } } // a run you rode out of counts as an abandon, not a death
    Music.duck(1);
    this.scene.stop('HUD');
    this.scene.stop('Game');
    this.scene.stop();
    this.scene.start('Menu');
  }
}
