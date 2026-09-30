// Rider select (CHARACTERS_META A6): poster with the rider portrait, stat bars computed from startStats(), relic + starting kit, a roster of tokens,
// NORMAL / HELL mode chips. A / D / arrows / 1-4 choose a rider, W / S toggle the mode, Enter starts, Esc goes back. A locked rider never starts.
import Phaser from 'phaser';
import { W, H, FONT_TITLE, FONT_BODY, CSS } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';
import { Save } from '../core/Save.js';
import { Meta } from '../meta/index.js';
import { nextRank } from '../meta/ranks.js';
import { CHAR_ORDER, CHARACTERS, charDef } from '../data/characters.js';
import { getItem } from '../items/registry.js';
import '../items/index.js'; // registers every item def (relic + starting item names)
import { title, body, inkText, INK, uiSfx, setOsCursor } from '../ui/UiKit.js';
import StatBars from '../ui/StatBars.js';
import AchievementToast from '../ui/AchievementToast.js';
import { backdrop, panel, riderToken, silhouette, starIcon, itemIcon, chip, padlock } from '../ui/Silhouette.js';

const PORTRAIT = (id) => `portrait_${id === 'gunslinger' ? 'player' : id}`;
const MODES = [['normal', 'NORMAL'], ['hell', 'HELL ON EARTH']];
const MARK_TIERS = [['undertaker', 'tin', 'FLOOR 3'], ['final', 'silver', 'WIN'], ['hell', 'gold', 'HELL']];

export default class CharSelectScene extends Phaser.Scene {
  constructor() { super('CharSelect'); }

  init(data) { this.data0 = data || {}; this.leaving = false; }

  create() {
    setOsCursor(this.game, '');
    this.cameras.main.fadeIn(300, 13, 8, 6);
    backdrop(this, 'ui_charselect_bg', { dim: 0.35 });
    const st = Save.settings();
    let start = CHAR_ORDER.indexOf(this.data0.char || st.lastChar);
    if (start < 0 || !Meta.isCharUnlocked(CHAR_ORDER[start])) start = 0;
    this.idx = start;
    this.mode = (this.data0.mode || st.lastMode) === 'hell' && Meta.isModeUnlocked('hell') ? 1 : 0;

    // header: title, rank, NP bar
    this.add.text(W / 2, 62, 'CHOOSE YOUR RIDER', title(60)).setOrigin(0.5);
    this.rankLine = this.add.text(W / 2, 118, '', body(22, CSS.amber)).setOrigin(0.5);
    this.npBar = this.add.graphics();
    this.drawRank();

    // left poster
    this.posterCx = 400;
    this.poster = this.add.container(0, 0);
    this.poster.add(panel(this, this.posterCx, 430, 720, 540));
    this.pic = null;
    this.picHolder = this.add.container(0, 0);
    this.poster.add(this.picHolder);
    this.nameT = this.add.text(this.posterCx, 548, '', title(38, '#2a1810', { stroke: '#e8d9b0', strokeThickness: 1 })).setOrigin(0.5);
    this.aliasT = this.add.text(this.posterCx, 590, '', inkText(24, INK, { fontStyle: 'italic' })).setOrigin(0.5);
    this.poster.add([this.nameT, this.aliasT]);
    this.starObjs = [];
    MARK_TIERS.forEach(([key, tier, lab], i) => {
      const x = this.posterCx - 150 + i * 150;
      const s = starIcon(this, x, 624, tier, 0.5);
      const t = this.add.text(x, 652, lab, inkText(14, '#5a1a10')).setOrigin(0.5);
      this.poster.add([s, t]);
      this.starObjs.push({ s, key });
    });

    // right sheet
    const rx = 1050;
    this.poster2 = this.add.container(0, 0);
    this.poster2.add(panel(this, rx, 430, 640, 540, { dark: true }));
    this.roleT = this.add.text(rx, 232, '', title(40, CSS.amber)).setOrigin(0.5);
    this.tagT = this.add.text(rx, 278, '', body(20, CSS.sand, { align: 'center', wordWrap: { width: 560 } })).setOrigin(0.5);
    this.bars = new StatBars(this, { x: rx - 290, y: 328, w: 580, gap: 38 });
    this.relicIcon = null;
    this.relicHolder = this.add.container(0, 0);
    this.relicName = this.add.text(rx - 215, 556, '', title(24, CSS.bone)).setOrigin(0, 0.5);
    this.relicDesc = this.add.text(rx - 215, 580, '', body(17, CSS.sand, { wordWrap: { width: 470 } })).setOrigin(0, 0);
    this.kitT = this.add.text(rx - 290, 646, '', body(18, CSS.sand)).setOrigin(0, 0.5);
    this.lockT = this.add.text(rx, 440, '', title(30, CSS.amber, { align: 'center', wordWrap: { width: 520 } })).setOrigin(0.5).setVisible(false);
    this.kitIcons = [];

    // roster
    this.tokens = [];
    const n = CHAR_ORDER.length;
    CHAR_ORDER.forEach((id, i) => {
      const x = W / 2 + (i - (n - 1) / 2) * 170, y = 790;
      const locked = !Meta.isCharUnlocked(id);
      const tok = riderToken(this, x, y, id, 108, { locked });
      const hit = this.add.zone(x, y, 116, 116).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.pick(i));
      const key = this.add.text(x, y + 68, String(i + 1), body(16, '#a48a5c')).setOrigin(0.5);
      const pips = MARK_TIERS.map(([k], j) => this.add.circle(x - 16 + j * 16, y + 90, 5, Save.get().chars[id] && Save.get().chars[id].marks[k] ? 0xf0a640 : 0x3a2a20).setStrokeStyle(1, 0x120c0a));
      this.tokens.push({ tok, x, y, locked, id, key, pips });
    });

    // arrows
    const arrow = (x, dir) => {
      const t = this.add.text(x, 420, dir < 0 ? '<' : '>', title(96, CSS.sand)).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor(CSS.amber)); t.on('pointerout', () => t.setColor(CSS.sand));
      t.on('pointerdown', () => this.step(dir));
    };
    arrow(50, -1); arrow(W - 50, 1);

    // mode chips
    this.chips = MODES.map(([id, label], i) => {
      const x = i ? W - 200 : 200, y = 790;
      const lock = !Meta.isModeUnlocked(id);
      const c = chip(this, x, y, lock ? `${label}` : label, { size: 24, pad: 24, fill: 0x1c130e, stroke: 0x6b4423, color: CSS.sand, font: FONT_TITLE });
      const zone = this.add.zone(x, y, c.w + 8, c.h + 8).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.setMode(i));
      const pl = lock ? padlock(this, x - c.w / 2 - 22, y, 0.36) : null;
      return { id, c, lock, pl, x, y };
    });
    this.modeHint = this.add.text(W / 2, 906, '', body(18, CSS.amber)).setOrigin(0.5);

    // ride-out plaque + footer
    const plq = this.add.container(W / 2, 934);
    const pg = this.add.graphics();
    pg.fillStyle(0x8a1c1c, 1).fillRoundedRect(-130, -22, 260, 44, 10).lineStyle(3, 0xf0a640, 1).strokeRoundedRect(-130, -22, 260, 44, 10);
    const pt = this.add.text(0, 0, 'RIDE OUT', title(26, CSS.bone)).setOrigin(0.5);
    plq.add([pg, pt]);
    plq.setSize(260, 44).setInteractive({ useHandCursor: true });
    plq.on('pointerdown', () => this.go());
    this.plaque = plq;
    this.add.text(30, H - 24, 'A / D  rider     W / S  mode     ENTER  ride out     ESC  back', body(15, '#8a7350', { strokeThickness: 3 })).setOrigin(0, 0.5);

    // input
    const kb = this.input.keyboard;
    this._key = (e) => {
      if (this.leaving || e.repeat) return;
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this.step(-1); break;
        case 'ArrowRight': case 'KeyD': this.step(1); break;
        case 'ArrowUp': case 'KeyW': case 'ArrowDown': case 'KeyS': this.setMode(this.mode ? 0 : 1); break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': this.pick(+e.code.slice(5) - 1); break;
        case 'Enter': case 'Space': case 'NumpadEnter': this.go(); break;
        case 'Escape': case 'Backspace': this.back(); break;
        default: break;
      }
    };
    kb.on('keydown', this._key);
    this.events.once('shutdown', () => { kb.off('keydown', this._key); this.bars.destroy(); });
    this.toasts = new AchievementToast(this, { hold: false });

    this.show(this.idx, true);
    this.refreshModes();
  }

  drawRank() {
    const np = Meta.np(), r = Meta.rank(), nx = nextRank(np);
    this.rankLine.setText(`${Meta.titleLabel().toUpperCase()}   -   NP ${np.toLocaleString('en-US')}${nx ? ` / ${nx.np.toLocaleString('en-US')}` : '  (MAX)'}`);
    const g = this.npBar, bw = 360, x = W / 2 - bw / 2, y = 142;
    g.clear().fillStyle(0x0a0605, 0.9).fillRect(x, y, bw, 10).lineStyle(2, 0x6b4423, 1).strokeRect(x, y, bw, 10);
    const frac = nx ? (np - r.np) / (nx.np - r.np) : 1;
    g.fillStyle(0xf0a640, 1).fillRect(x + 1, y + 1, Math.max(0, (bw - 2) * Math.min(1, frac)), 8);
  }

  step(d) { this.pick((this.idx + d + CHAR_ORDER.length) % CHAR_ORDER.length); }

  pick(i) {
    if (i < 0 || i >= CHAR_ORDER.length || i === this.idx) return;
    uiSfx.move();
    this.show(i, false);
  }

  show(i, first) {
    this.idx = i;
    const id = CHAR_ORDER[i], c = charDef(id), locked = !Meta.isCharUnlocked(id);
    this.tokens.forEach((t, k) => t.tok.highlight(k === i));
    // portrait
    if (this.pic) { this.pic.destroy(); this.pic = null; }
    const key = PORTRAIT(id);
    const im = Assets.makeImage(this, this.posterCx, 340, key).setDisplaySize(300, 300).setAngle(-2);
    if (locked) silhouette(im, 1);
    else if (!Assets.has(key)) im.setAlpha(0.9);
    const frame = this.add.graphics();
    frame.fillStyle(0x6b4423, 0.25).fillRect(this.posterCx - 158, 340 - 158, 316, 316).lineStyle(5, 0x2a1810, 1).strokeRect(this.posterCx - 158, 340 - 158, 316, 316);
    this.picHolder.removeAll(true);
    this.picHolder.add([frame, im]);
    this.pic = null;
    frame.setAngle(-2);
    if (!first) { this.picHolder.setAlpha(0.2); this.tweens.add({ targets: this.picHolder, alpha: 1, duration: 180 }); }
    this.nameT.setText(locked ? '???' : c.name.toUpperCase());
    this.aliasT.setText(locked ? '' : `"${c.alias}"`);
    const save = Save.get().chars[id];
    this.starObjs.forEach((s) => { const on = !locked && save && save.marks[s.key]; s.s.setAlpha(on ? 1 : 0.25); if (!on) s.s.setTint(0x555555); else s.s.clearTint(); });
    // right sheet
    this.roleT.setText(locked ? 'LOCKED' : c.role);
    this.tagT.setText(locked ? '' : c.tagline);
    this.lockT.setVisible(locked).setText(locked ? c.hint : '');
    this.bars.set(locked ? null : id);
    this.relicHolder.removeAll(true);
    for (const o of this.kitIcons) o.destroy();
    this.kitIcons = [];
    for (const o of [this.relicName, this.relicDesc, this.kitT]) o.setVisible(!locked);
    if (!locked) {
      const relic = c.relic ? getItem(c.relic) : null;
      const rx = 1050;
      if (relic) {
        const ic = itemIcon(this, rx - 262, 588, relic, 0.62);
        this.relicHolder.add(ic);
        this.relicName.setText(relic.name.toUpperCase());
        this.relicDesc.setText(relic.desc);
      } else {
        this.relicName.setText('NO RELIC');
        this.relicDesc.setText('The Sixth Bullet is all the help he asks for.');
      }
      this.relicName.setX(relic ? rx - 215 : rx - 290); this.relicDesc.setX(relic ? rx - 215 : rx - 290);
      const bits = [];
      if (c.start.coins) bits.push(`${c.start.coins} coins`);
      bits.push(`${c.start.dynamite} dynamite`);
      if (c.start.tin) bits.push(`${c.start.tin / 2} tin hearts`);
      const extra = c.start.items.filter((x) => x !== c.relic).map((x) => getItem(x)).filter(Boolean);
      this.kitT.setText(`STARTS WITH   ${extra.map((d) => d.name).concat(bits).join(', ')}`);
      this.kitT.setWordWrapWidth(580);
    }
    this.plaque.setAlpha(locked ? 0.45 : 1);
  }

  setMode(i) {
    if (i === this.mode) return;
    if (!Meta.isModeUnlocked(MODES[i][0])) {
      this.deny(MODES[i][0] === 'hell' ? 'Win a run to unlock Hell on Earth.' : '');
      return;
    }
    this.mode = i;
    uiSfx.move();
    this.refreshModes();
  }

  refreshModes() {
    this.chips.forEach((m, i) => {
      const on = i === this.mode && !m.lock;
      m.c.label.setColor(m.lock ? '#7a6a58' : on ? CSS.amber : CSS.sand);
      m.c.setAlpha(m.lock ? 0.7 : 1).setScale(on ? 1.1 : 1);
      m.c.first.clear().fillStyle(on ? 0x3a1a12 : 0x1c130e, 0.95).fillRoundedRect(-m.c.w / 2, -m.c.h / 2, m.c.w, m.c.h, 8).lineStyle(on ? 4 : 2, on ? 0xf0a640 : 0x6b4423, 1).strokeRoundedRect(-m.c.w / 2, -m.c.h / 2, m.c.w, m.c.h, 8);
    });
    this.modeHint.setText(this.mode ? 'Hell on Earth: tougher foes, 1.5x reward.' : '');
  }

  deny(msg) {
    Sfx.play('shop_deny', { vol: 0.7 });
    if (msg) { this.modeHint.setText(msg).setAlpha(1); this.tweens.killTweensOf(this.modeHint); this.tweens.add({ targets: this.modeHint, alpha: 0.4, duration: 250, yoyo: true, repeat: 2 }); }
    this.tweens.add({ targets: this.poster, x: { from: -6, to: 6 }, duration: 55, yoyo: true, repeat: 3, onComplete: () => this.poster.setX(0) });
    this.tweens.add({ targets: this.lockT, alpha: { from: 0.3, to: 1 }, duration: 160, yoyo: true, repeat: 2 });
  }

  go() {
    if (this.leaving) return;
    const id = CHAR_ORDER[this.idx];
    if (!Meta.isCharUnlocked(id)) { this.deny(''); return; }
    const mode = MODES[this.mode][0];
    if (!Meta.isModeUnlocked(mode)) { this.deny(''); return; }
    this.leaving = true;
    Save.setSetting('lastChar', id);
    Save.setSetting('lastMode', mode);
    Sfx.play('gun_cock', { vol: 0.7 });
    this.cameras.main.fadeOut(320, 13, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { char: id, mode }));
  }

  back() {
    if (this.leaving) return;
    this.leaving = true;
    uiSfx.back();
    this.cameras.main.fadeOut(220, 13, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
  }
}
