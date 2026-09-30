// Main menu: logo over the dusk art, then CONTINUE (checkpoint) / RIDE OUT / DAILY RIDE / BOUNTY BOARD / CODEX / OPTIONS / CREDITS (keyboard + mouse, menu sfx),
// drifting embers, controls, a Notoriety chip. RIDE OUT goes through CharSelect once a second rider or Hell on Earth is unlocked (or straight in for a fresh save
// / ?char=). The meta scenes (CharSelect, Daily, Board, Codex) are registered at runtime here. Credits is a parchment modal (ESC / Enter / click closes).
import Phaser from 'phaser';
import { W, H, FONT_TITLE, CSS, FLOORS } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx, playMusicFor, Audio } from '../core/Audio.js';
import { Save } from '../core/Save.js';
import { bus } from '../core/events.js';
import { flag, qs } from '../core/util.js';
import { Meta } from '../meta/index.js';
import { registerMetaScenes } from '../meta/scenes.js';
import AchievementToast from '../ui/AchievementToast.js';
import { chip } from '../ui/Silhouette.js';
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
    if (s.stats.runs > 0) {
      const f = FLOORS[s.best.floor];
      this.add.text(W / 2, 436, `BEST: FLOOR ${s.best.floor}${f ? ` - ${f.name}` : ''}   |   RUNS ${s.stats.runs}   |   KILLS ${s.stats.kills}`, body(20, '#b89a68', { strokeThickness: 4 })).setOrigin(0.5);
      chip(this, W / 2, 476, `${Meta.titleLabel().toUpperCase()}  -  ${s.notoriety.np.toLocaleString('en-US')} NP`, { size: 18, color: CSS.amber });
    }

    // menu list
    this.opt = new OptionsPanel(this, { cx: W / 2, cy: H / 2, onBack: () => { this.dim.setVisible(false); this.list.setEnabled(true); this.list.refresh(); } });
    this.dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.82).setDepth(90).setVisible(false);
    registerMetaScenes(this.game);
    const cp = this.checkpoint();
    const dailyOk = Meta.isModeUnlocked('daily');
    const items = [];
    if (cp) items.push({ label: `CONTINUE - FLOOR ${cp.floor}`, act: () => this.go('Game', { continue: true, floor: cp.floor }) });
    items.push({ label: 'RIDE OUT', act: () => this.rideOut() });
    items.push({ label: dailyOk ? 'DAILY RIDE' : 'DAILY RIDE (LOCKED)', act: () => (dailyOk ? this.go('Daily') : Sfx.play('shop_deny', { vol: 0.7 })) });
    items.push({ label: 'BOUNTY BOARD', act: () => this.go('Board') });
    items.push({ label: 'CODEX', act: () => this.go('Codex') });
    items.push({ label: 'OPTIONS', act: () => this.openOptions() });
    items.push({ label: 'CREDITS', act: () => this.openCredits() });
    this.list = new MenuList(this, items, { x: 560, y: cp ? 512 : 528, gap: 54, size: 40, hitW: 520 });
    this.list.select(cp ? 1 : 0, true);

    // controls + credits line + mute state
    const controls = ['WASD  move          ARROWS / MOUSE  shoot', 'SPACE  dodge roll          E  dynamite          Q  item', 'ESC / P  pause          M  mute'];
    controls.forEach((c, i) => this.add.text(40, 840 + i * 30, c, body(21, CSS.sand, { strokeThickness: 4 })).setOrigin(0, 0.5));
    this.add.text(40, H - 28, 'Music: Kevin MacLeod (incompetech.com), CC BY 4.0   -   Sound: Freesound / Kenney (see Credits)', body(16, '#8a7350', { strokeThickness: 3 })).setOrigin(0, 0.5);
    this.muteText = this.add.text(W - 30, H - 30, '', body(20, CSS.sand)).setOrigin(1);
    this.refreshMute();
    bus.scoped(this, 'audio:changed', () => this.refreshMute());
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.refreshMute() });
    if (flag('debug')) this.add.text(30, 30, 'DEBUG MODE (F1-F7)', body(20, CSS.green));

    this.toasts = new AchievementToast(this, {});

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

  /** Saved checkpoint (normal / hell runs only) or null. */
  checkpoint() {
    try { return Save.loadCheckpoint(); } catch (e) { return null; }
  }

  /** RIDE OUT: CharSelect once there is a choice to make, otherwise straight into a normal Gunslinger run. */
  rideOut() {
    const choice = !qs('char') && (Meta.isCharUnlocked('preacher') || Meta.isCharUnlocked('hunter') || Meta.isCharUnlocked('queen') || Meta.isModeUnlocked('hell'));
    if (choice) this.go('CharSelect');
    else this.go('Game', { char: 'gunslinger', mode: 'normal' });
  }

  go(scene, data) {
    if (this.starting) return;
    this.starting = true;
    if (scene === 'Game') Sfx.play('gun_cock', { vol: 0.7 }); else uiSfx.select();
    this.cameras.main.fadeOut(scene === 'Game' ? 320 : 220, 13, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene, data));
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
}
