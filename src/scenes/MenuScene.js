// Main menu: logo over the dusk art, RIDE OUT / OPTIONS / BOUNTY BOARD / CREDITS (keyboard + mouse, menu sfx), drifting embers, controls, credits line.
// Options = OptionsPanel (persisted volume sliders, mute, screenshake, fullscreen). Bounty Board + Credits are parchment modals (ESC / Enter / click closes).
import Phaser from 'phaser';
import { W, H, FONT_TITLE, FONT_BODY, CSS, FLOORS } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx, playMusicFor, Audio } from '../core/Audio.js';
import { Save } from '../core/Save.js';
import { bus } from '../core/events.js';
import { fmtTime, flag } from '../core/util.js';
import { allItems } from '../items/index.js'; // importing the index registers every item def (the Bounty Board lists them)
import { MenuList, parchment, title, body, inkText, INK, uiSfx, setOsCursor } from '../ui/UiKit.js';
import OptionsPanel from '../ui/OptionsPanel.js';

const CREDITS = [
  ['MUSIC', 'Kevin MacLeod (incompetech.com), CC BY 4.0\nSmoking Gun, Neo Western, Southern Gothic, Martian Cowboy, Witch Hunt, Final Count, Pale Rider, Darkness Speaks, Cowboy Sting'],
  ['SOUND EFFECTS', 'Freesound and Kenney contributors (CC0 / CC BY)\nfull list in assets/audio/CREDITS_sfx.md'],
  ['TYPEFACES', 'Rye and Special Elite (Google Fonts, SIL OFL)'],
  ['ENGINE', 'Phaser 3 + Vite'],
];

export default class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.starting = false; // scene instance is reused after QUIT TO MENU
    this.modal = null;
    setOsCursor(this.game, ''); // in-game crosshair mode is switched off again
    this.cameras.main.fadeIn(400, 13, 8, 6);
    const bg = Assets.makeImage(this, W / 2, H / 2, 'title_bg');
    this.tweens.add({ targets: bg, scale: 1.045, duration: 22000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setTint(0x000000).setAlpha(0.28);
    playMusicFor('menu');
    this.embers();

    // logo + chapter line
    if (Assets.has('title_logo')) {
      const logo = Assets.makeImage(this, W / 2, 240, 'title_logo');
      logo.setScale(Math.min(1, 1000 / logo.width));
      this.tweens.add({ targets: logo, y: 248, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      logo.setAlpha(0); this.tweens.add({ targets: logo, alpha: 1, duration: 600 });
    } else {
      const t = this.add.text(W / 2, 240, 'DEAD WEST', { fontFamily: FONT_TITLE, fontSize: '190px', color: CSS.bone, stroke: '#120c0a', strokeThickness: 18 }).setOrigin(0.5);
      t.setShadow(0, 10, '#8a1c1c', 0, true, true);
      this.tweens.add({ targets: t, y: 248, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.add.text(W / 2, 398, 'CHAPTER I  -  PERDITION COUNTY', body(28, CSS.amber, { strokeThickness: 5 })).setOrigin(0.5);
    const s = Save.get();
    if (s.runs > 0) {
      const f = FLOORS[s.bestFloor];
      this.add.text(W / 2, 436, `BEST: FLOOR ${s.bestFloor}${f ? ` - ${f.name}` : ''}   |   RUNS ${s.runs}   |   KILLS ${s.kills}`, body(20, '#b89a68', { strokeThickness: 4 })).setOrigin(0.5);
    }

    // menu list
    this.opt = new OptionsPanel(this, { cx: W / 2, cy: H / 2, onBack: () => { this.dim.setVisible(false); this.list.setEnabled(true); this.list.refresh(); } });
    this.dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.82).setDepth(90).setVisible(false);
    this.list = new MenuList(this, [
      { label: 'RIDE OUT', act: () => this.start() },
      { label: 'OPTIONS', act: () => this.openOptions() },
      { label: 'BOUNTY BOARD', act: () => this.openBoard() },
      { label: 'CREDITS', act: () => this.openCredits() },
    ], { x: 560, y: 520, gap: 72, size: 50, hitW: 520 });
    const hint = this.add.text(560, 520 + 4 * 72 - 10, 'W / S  choose        ENTER  select', body(20, '#a48a5c')).setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // controls + credits line + mute state
    const controls = ['WASD  move          ARROWS / MOUSE  shoot', 'SPACE  dodge roll          E  dynamite          Q  item', 'ESC / P  pause          M  mute'];
    controls.forEach((c, i) => this.add.text(40, 840 + i * 30, c, body(21, CSS.sand, { strokeThickness: 4 })).setOrigin(0, 0.5));
    this.add.text(40, H - 28, 'Music: Kevin MacLeod (incompetech.com), CC BY 4.0   -   Sound: Freesound / Kenney (see Credits)', body(16, '#8a7350', { strokeThickness: 3 })).setOrigin(0, 0.5);
    this.muteText = this.add.text(W - 30, H - 30, '', body(20, CSS.sand)).setOrigin(1);
    this.refreshMute();
    bus.scoped(this, 'audio:changed', () => this.refreshMute());
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.refreshMute() });
    if (flag('debug')) this.add.text(30, 30, 'DEBUG MODE (F1-F7)', body(20, CSS.green));

    // ESC / Enter / click close a modal
    const closeModal = () => { if (this.modal && performance.now() > this.modal.t0 + 200) this.closeModal(); };
    this.input.keyboard.on('keydown', (e) => { if (['Escape', 'Enter', 'Space', 'NumpadEnter', 'Backspace'].includes(e.code)) closeModal(); });
    this.input.on('pointerdown', () => closeModal());
    this.input.on('pointermove', (p) => { if (this.modal && this.modal.hover) this.modal.hover(p); });
  }

  refreshMute() { this.muteText.setText(Audio.muted ? '[M] SOUND: OFF' : '[M] SOUND: ON'); }

  embers() {
    if (!this.textures.exists('px')) return;
    this.add.particles(0, 0, 'px', {
      x: { min: 0, max: W }, y: H + 10, lifespan: { min: 6000, max: 11000 }, speedY: { min: -70, max: -25 }, speedX: { min: -25, max: 25 },
      scale: { start: 1.6, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: [0xf0a640, 0xd63a2a, 0xe8dcc0], frequency: 260, blendMode: 'ADD',
    }).setDepth(2);
  }

  start() {
    if (this.starting) return;
    this.starting = true;
    Sfx.play('gun_cock', { vol: 0.7 });
    this.cameras.main.fadeOut(320, 13, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
  }

  // ---------------------------------------------------------------------------------------------- modals
  openOptions() { this.list.setEnabled(false); this.dim.setVisible(true); this.opt.open(); }

  beginModal(hover) {
    this.list.setEnabled(false);
    this.dim.setVisible(true);
    const objs = [];
    this.modal = { objs, t0: performance.now(), hover };
    return (o) => { o.setDepth(100 + objs.length); objs.push(o); return o; };
  }
  closeModal() {
    if (!this.modal) return;
    for (const o of this.modal.objs) o.destroy();
    this.modal = null;
    this.dim.setVisible(false);
    this.list.setEnabled(true);
    uiSfx.back();
  }

  openCredits() {
    uiSfx.select();
    const add = this.beginModal();
    const pw = 1080;
    const panel = add(parchment(this, W / 2, H / 2, pw));
    const top = H / 2 - panel.displayHeight / 2;
    add(this.add.text(W / 2, top + 100, 'CREDITS', title(64, '#3a1a10', { stroke: '#e8d9b0', strokeThickness: 2 })).setOrigin(0.5));
    add(this.add.text(W / 2, top + 156, 'Chapter I: Perdition County', inkText(28, INK, { fontStyle: 'italic' })).setOrigin(0.5));
    let y = top + 214;
    for (const [k, v] of CREDITS) {
      add(this.add.text(W / 2, y, k, title(22, '#5a1a10', { strokeThickness: 0 })).setOrigin(0.5, 0));
      const t = add(this.add.text(W / 2, y + 30, v, inkText(21, INK, { align: 'center', wordWrap: { width: 780 } })).setOrigin(0.5, 0));
      y += 30 + t.height + 22;
    }
    add(this.add.text(W / 2, top + panel.displayHeight - 92, 'ESC  -  back', inkText(22, '#5a1a10')).setOrigin(0.5));
  }

  openBoard() {
    uiSfx.select();
    const seenSet = new Set(Save.get().itemsSeen);
    const items = allItems();
    const tip = { txt: null };
    const add = this.beginModal((p) => {
      let hit = null;
      for (const c of cells) if (Math.abs(p.x - c.x) < 30 && Math.abs(p.y - c.y) < 30) { hit = c; break; }
      tip.txt.setText(hit ? (hit.seen ? `${hit.def.name}  -  ${hit.def.desc || ''}` : '???  not yet discovered') : '');
    });
    const cells = [];
    const s = Save.get();
    const panel = add(parchment(this, W / 2, H / 2, 1180));
    const top = H / 2 - panel.displayHeight / 2, left = W / 2 - 1180 / 2;
    add(this.add.text(W / 2, top + 88, 'BOUNTY BOARD', title(60, '#3a1a10', { stroke: '#e8d9b0', strokeThickness: 2 })).setOrigin(0.5));
    add(this.add.text(W / 2, top + 142, 'The recorded crimes of one cursed gunslinger', inkText(22, INK, { fontStyle: 'italic' })).setOrigin(0.5));
    const f = FLOORS[s.bestFloor];
    const stats = [
      ['Deepest floor', s.bestFloor ? `${s.bestFloor} - ${f ? f.name : ''}` : '-'],
      ['Fastest clear', s.bestTime ? fmtTime(s.bestTime) : '-'],
      ['Chapters cleared', String(s.wins)],
      ['Rides started', String(s.runs)],
      ['Times hanged', String(s.deaths)],
      ['Enemies slain', String(s.kills)],
      ['Most kills in a run', String(s.bestKills || 0)],
      ['Time in the saddle', fmtTime(s.playTime || 0)],
    ];
    stats.forEach(([k, v], i) => {
      const col = i % 2, r = Math.floor(i / 2);
      const x0 = left + 150 + col * 480, y = top + 208 + r * 40;
      add(this.add.text(x0, y, k, inkText(24)).setOrigin(0, 0.5));
      add(this.add.text(x0 + 420, y, v, inkText(24, '#5a1a10', { fontStyle: 'bold' })).setOrigin(1, 0.5));
    });
    const gy = top + 208 + 4 * 40 + 20;
    const g = add(this.add.graphics());
    g.lineStyle(2, 0x2a1810, 0.6).lineBetween(left + 150, gy, left + 1180 - 150, gy);
    const seen = items.filter((d) => seenSet.has(d.id)).length;
    add(this.add.text(W / 2, gy + 30, `RELICS DISCOVERED   ${seen} / ${items.length}`, title(26, '#3a1a10', { stroke: '#e8d9b0', strokeThickness: 1 })).setOrigin(0.5));
    const perRow = 14, step = 62;
    items.forEach((def, i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      const inRow = Math.min(perRow, items.length - row * perRow);
      const x = W / 2 - ((inRow - 1) * step) / 2 + col * step, y = gy + 88 + row * step;
      const ic = def.icon || { sheet: 'items_passive_a', name: def.id };
      const im = add(Assets.makeCell(this, x, y, ic.sheet, ic.name, 0.5)).setScale(0.6);
      const isSeen = seenSet.has(def.id);
      if (!isSeen) im.setTintFill(0x2a1810).setAlpha(0.3);
      cells.push({ x, y, def, seen: isSeen });
    });
    tip.txt = add(this.add.text(W / 2, top + panel.displayHeight - 96, '', inkText(22, '#5a1a10', { align: 'center' })).setOrigin(0.5));
    if (!cells.length) tip.txt.setText('No relics registered yet.');
  }
}
