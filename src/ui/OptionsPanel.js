// Options modal (dark parchment): music / sfx volume sliders, sound on/off, screenshake, fullscreen. Everything persists via Save.
// Used by MenuScene and PauseScene:  const opt = new OptionsPanel(scene, { cx, cy, onBack });  opt.open();  opt.isOpen;  opt.close();
// The host must ignore its own ESC handling while opt.isOpen (the panel handles ESC itself and calls onBack).
import { CSS } from '../config.js';
import { Save } from '../core/Save.js';
import { Audio, Music } from '../core/Audio.js';
import { bus } from '../core/events.js';
import { MenuList, parchment, title, body, uiSfx } from './UiKit.js';

export default class OptionsPanel {
  constructor(scene, { cx = 720, cy = 480, w = 1040, onBack = () => {}, depth = 100 } = {}) {
    this.scene = scene;
    this.isOpen = false;
    this.onBack = onBack;
    const d = depth;
    this.bg = parchment(scene, cx, cy, w, { dark: true }).setDepth(d);
    const ph = this.bg.displayHeight;
    this.head = scene.add.text(cx, cy - ph / 2 + 92, 'OPTIONS', title(66)).setOrigin(0.5).setDepth(d + 1);
    this.hint = scene.add.text(cx, cy + ph / 2 - 92, 'W / S  choose     A / D  adjust     ESC  back', body(21, CSS.sand)).setOrigin(0.5).setDepth(d + 1);
    const on = (b) => (b ? 'ON' : 'OFF');
    const items = [
      { label: 'MUSIC', kind: 'slider', get: () => Save.vol('music', 0.5), set: (v) => { Save.setSetting('music', v); Music.refreshVolume(); } },
      { label: 'SOUND FX', kind: 'slider', get: () => Save.vol('sfx', 1), set: (v) => { Save.setSetting('sfx', v); } },
      { label: 'SOUND', kind: 'toggle', value: () => on(!Audio.muted), act: () => Audio.toggleMute() },
      { label: 'SCREENSHAKE', kind: 'toggle', value: () => on(Save.settings().shake !== false), act: () => Save.setSetting('shake', Save.settings().shake === false) },
      { label: 'FULLSCREEN', kind: 'toggle', value: () => on(scene.scale.isFullscreen), act: () => { try { scene.scale.toggleFullscreen(); } catch (e) { /* not allowed */ } } },
      { label: 'BACK', kind: 'button', act: () => this.back() },
    ];
    const gap = 66;
    this.list = new MenuList(scene, items, { x: cx, y: cy - 150, gap, size: 38, mode: 'row', rowW: 800, depth: d + 2 });
    this.objs = [this.bg, this.head, this.hint];
    this._esc = (e) => { if (this.isOpen && this.list.live() && e.code === 'Escape') this.back(); };
    scene.input.keyboard.on('keydown', this._esc);
    this._refresh = () => { if (this.isOpen) this.list.refresh(); };
    bus.on('audio:changed', this._refresh);
    scene.scale.on('enterfullscreen', this._refresh);
    scene.scale.on('leavefullscreen', this._refresh);
    scene.events.once('shutdown', () => this.destroy());
    this.close(true);
  }

  open() {
    this.isOpen = true;
    for (const o of this.objs) o.setVisible(true);
    this.list.open();
    this.list.select(0, true);
    this.list.refresh();
  }
  close(silent) {
    this.isOpen = false;
    for (const o of this.objs) o.setVisible(false);
    this.list.close();
    if (!silent) this.scene.events.emit('options-closed');
  }
  back() { uiSfx.back(); this.close(); this.closedAt = performance.now(); this.onBack(); }
  /** True for 150 ms after Back/ESC closed the panel: hosts use it to ignore the same ESC keypress. */
  recentlyClosed() { return performance.now() - (this.closedAt || 0) < 150; }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    bus.off('audio:changed', this._refresh);
    try { this.scene.input.keyboard.off('keydown', this._esc); this.scene.scale.off('enterfullscreen', this._refresh); this.scene.scale.off('leavefullscreen', this._refresh); } catch (e) { /* ignore */ }
    this.list.destroy();
  }
}
