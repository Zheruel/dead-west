// Options modal (dark parchment), two pages (Q / E): AUDIO & DISPLAY (music / sfx sliders, sound, screenshake amount, screen flash, fullscreen) and
// GAMEPLAY & DATA (bullet outline, damage numbers, run timer, auto-pause, export / import save, reset progress = hold ENTER 1.5 s). Everything persists via Save.
// Used by MenuScene and PauseScene:  const opt = new OptionsPanel(scene, { cx, cy, onBack, inRun });  opt.open();  opt.isOpen;  opt.close();
// The host must ignore its own ESC handling while opt.isOpen (the panel handles ESC itself and calls onBack). `inRun` locks import / reset (menu only).
import { CSS } from '../config.js';
import { Save } from '../core/Save.js';
import { Audio, Music, Sfx } from '../core/Audio.js';
import { bus } from '../core/events.js';
import { MenuList, parchment, title, body, uiSfx } from './UiKit.js';

const HOLD_MS = 1500;
const PAGES = ['AUDIO & DISPLAY', 'GAMEPLAY & DATA'];

export default class OptionsPanel {
  constructor(scene, { cx = 720, cy = 480, w = 1180, onBack = () => {}, depth = 100, inRun = false } = {}) {
    this.scene = scene;
    this.isOpen = false;
    this.onBack = onBack;
    this.inRun = inRun;
    this.page = 0;
    this.holdAt = 0;
    this.holdRow = -1;
    const d = depth;
    this.bg = parchment(scene, cx, cy, w, { dark: true }).setDepth(d);
    const ph = this.bg.displayHeight;
    this.head = scene.add.text(cx, cy - ph / 2 + 86, 'OPTIONS', title(60)).setOrigin(0.5).setDepth(d + 1);
    this.pageT = scene.add.text(cx, cy - ph / 2 + 142, '', body(24, CSS.amber)).setOrigin(0.5).setDepth(d + 1);
    this.status = scene.add.text(cx, cy + ph / 2 - 106, '', body(20, CSS.amber)).setOrigin(0.5).setDepth(d + 1);
    this.hint = scene.add.text(cx, cy + ph / 2 - 64, 'W / S  choose     A / D  adjust     Q / E  page     ESC  back', body(21, CSS.sand)).setOrigin(0.5).setDepth(d + 1);
    const on = (b) => (b ? 'ON' : 'OFF');
    const flip = (k) => () => Save.setSetting(k, !Save.settings()[k]);
    const tog = (label, k) => ({ label, kind: 'toggle', value: () => on(Save.settings()[k] !== false && !!Save.settings()[k]), act: flip(k) });
    const back = { label: 'BACK', kind: 'button', act: () => this.back() };
    const p1 = [
      { label: 'MUSIC', kind: 'slider', get: () => Save.vol('music', 0.5), set: (v) => { Save.setSetting('music', v); Music.refreshVolume(); } },
      { label: 'SOUND FX', kind: 'slider', get: () => Save.vol('sfx', 1), set: (v) => { Save.setSetting('sfx', v); } },
      { label: 'SOUND', kind: 'toggle', value: () => on(!Audio.muted), act: () => Audio.toggleMute() },
      { label: 'SCREENSHAKE', kind: 'slider', step: 0.25, get: () => (Save.settings().shake === false ? 0 : Save.vol('shakeAmt', 1)), set: (v) => { Save.setSetting('shakeAmt', v); Save.setSetting('shake', v > 0); } },
      { label: 'SCREEN FLASH', kind: 'toggle', value: () => on(Save.settings().flash !== false), act: () => Save.setSetting('flash', Save.settings().flash === false) },
      { label: 'FULLSCREEN', kind: 'toggle', value: () => on(scene.scale.isFullscreen), act: () => { try { scene.scale.toggleFullscreen(); } catch (e) { /* not allowed */ } } },
      back,
    ];
    const lock = () => { this.say('MAIN MENU ONLY'); Sfx.play('shop_deny', { vol: 0.6 }); };
    const p2 = [
      tog('BULLET OUTLINE', 'bulletOutline'),
      tog('DAMAGE NUMBERS', 'dmgNumbers'),
      { label: 'RUN TIMER', kind: 'toggle', value: () => on(Save.settings().runTimer !== false), act: () => Save.setSetting('runTimer', Save.settings().runTimer === false) },
      { label: 'AUTO-PAUSE', kind: 'toggle', value: () => on(Save.settings().autoPause !== false), act: () => Save.setSetting('autoPause', Save.settings().autoPause === false) },
      { label: 'EXPORT SAVE', kind: 'button', value: () => 'COPY', act: () => this.exportSave() },
      { label: 'IMPORT SAVE', kind: 'button', value: () => (inRun ? 'MENU ONLY' : 'PASTE'), act: () => (inRun ? lock() : this.importSave()) },
      { label: 'RESET PROGRESS', kind: 'button', value: () => (inRun ? 'MENU ONLY' : this.holdRow === 6 && this.holdAt ? `HOLD  ${Math.min(100, Math.round(((performance.now() - this.holdAt) / HOLD_MS) * 100))}%` : 'HOLD ENTER'), act: () => { if (inRun) lock(); } },
      back,
    ];
    const gap = 56, y0 = cy - ph / 2 + 208;
    this.lists = [p1, p2].map((items) => new MenuList(scene, items, { x: cx, y: y0, gap, size: 34, mode: 'row', rowW: 800, depth: d + 2 }));
    this.list = this.lists[0];
    this.objs = [this.bg, this.head, this.pageT, this.status, this.hint];
    this._esc = (e) => {
      if (!this.isOpen || !this.list.live()) return;
      if (e.code === 'Escape') this.back();
      else if (e.code === 'KeyQ' && !e.repeat) this.setPage(this.page - 1);
      else if (e.code === 'KeyE' && !e.repeat) this.setPage(this.page + 1);
      else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) this.startHold();
    };
    this._up = (e) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') this.stopHold(); };
    scene.input.keyboard.on('keydown', this._esc);
    scene.input.keyboard.on('keyup', this._up);
    // mouse: pressing and holding the reset row works too
    this.lists[1].rows[6].zone.on('pointerdown', () => { if (this.isOpen && this.page === 1) this.startHold(6); });
    this._pup = () => this.stopHold();
    scene.input.on('pointerup', this._pup);
    this._tick = () => { if (this.holdAt) this.holdTick(); };
    scene.events.on('update', this._tick);
    this._refresh = () => { if (this.isOpen) this.list.refresh(); };
    bus.on('audio:changed', this._refresh);
    scene.scale.on('enterfullscreen', this._refresh);
    scene.scale.on('leavefullscreen', this._refresh);
    scene.events.once('shutdown', () => this.destroy());
    this.close(true);
  }

  say(msg) {
    this.status.setText(msg);
    if (this.statusT) this.statusT.remove(false);
    this.statusT = this.scene.time.delayedCall(2600, () => this.status.setText(''));
  }

  setPage(i) {
    const n = (i + PAGES.length) % PAGES.length;
    if (n === this.page && this.pageT.text) return;
    this.page = n;
    this.lists.forEach((l, k) => { if (k === n) { l.open(); l.select(0, true); l.refresh(); } else l.close(); });
    this.list = this.lists[n];
    this.pageT.setText(`${n + 1} / ${PAGES.length}   ${PAGES[n]}`);
    this.stopHold();
    uiSfx.move();
  }

  exportSave() {
    let str = '';
    try { str = Save.export(); } catch (e) { this.say('EXPORT FAILED'); return; }
    const fallback = () => { try { window.prompt('Copy your save code:', str); this.say('SAVE CODE SHOWN'); } catch (e) { this.say('COPY NOT AVAILABLE'); } };
    try { navigator.clipboard.writeText(str).then(() => this.say('SAVE COPIED TO CLIPBOARD'), fallback); } catch (e) { fallback(); }
  }

  importSave() {
    let str = null;
    try { str = window.prompt('Paste a save code to load (this replaces your current progress):', ''); } catch (e) { str = null; }
    if (!str) return;
    const ok = Save.import(str);
    this.say(ok ? 'SAVE LOADED' : 'THAT IS NOT A DEAD WEST SAVE');
    Sfx.play(ok ? 'menu_select' : 'shop_deny', { vol: 0.8 });
    this.list.refresh();
  }

  startHold(row) {
    const r = row == null ? this.list.sel : row;
    if (this.page !== 1 || r !== 6 || this.inRun) return;
    this.holdAt = performance.now(); this.holdRow = 6;
  }

  stopHold() {
    if (!this.holdAt) return;
    this.holdAt = 0; this.holdRow = -1;
    if (this.isOpen) this.list.refresh();
  }

  holdTick() {
    if (!this.isOpen) { this.stopHold(); return; }
    if (performance.now() - this.holdAt >= HOLD_MS) {
      this.holdAt = 0; this.holdRow = -1;
      Save.resetProgress();
      this.say('PROGRESS ERASED (SETTINGS KEPT)');
      Sfx.play('door_close', { vol: 0.9, rate: 0.8 });
    }
    this.list.refresh();
  }

  open() {
    this.isOpen = true;
    for (const o of this.objs) o.setVisible(true);
    this.page = -1;
    this.pageT.setText('');
    this.setPage(0);
  }
  close(silent) {
    this.isOpen = false;
    this.stopHold();
    for (const o of this.objs) o.setVisible(false);
    for (const l of this.lists) l.close();
    if (!silent) this.scene.events.emit('options-closed');
  }
  back() { uiSfx.back(); this.close(); this.closedAt = performance.now(); this.onBack(); }
  /** True for 150 ms after Back/ESC closed the panel: hosts use it to ignore the same ESC keypress. */
  recentlyClosed() { return performance.now() - (this.closedAt || 0) < 150; }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    bus.off('audio:changed', this._refresh);
    try { this.scene.events.off('update', this._tick); this.scene.input.off('pointerup', this._pup); this.scene.input.keyboard.off('keyup', this._up); this.scene.input.keyboard.off('keydown', this._esc); this.scene.scale.off('enterfullscreen', this._refresh); this.scene.scale.off('leavefullscreen', this._refresh); } catch (e) { /* ignore */ }
    for (const l of this.lists) l.destroy();
  }
}
