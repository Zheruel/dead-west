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
import { RNG } from '../core/rng.js';
import { menuSubtitle, creditsRows, MUSIC_CREDITS_CH2 } from '../data/story/text.js';
import TitleLayers from './MenuTitle.js';

// Credits modal, page 1: the short list (round 1 + the chapter 2 tracks). Page 2 appends the STORY s14 rows (data/story/text.js CREDITS).
const CREDITS = [
  ['MUSIC', 'Kevin MacLeod (incompetech.com), CC BY 4.0\nSmoking Gun, Neo Western, Southern Gothic, Martian Cowboy, Witch Hunt, Final Count, Pale Rider, Darkness Speaks, Cowboy Sting\n' + MUSIC_CREDITS_CH2.join(' ')],
  ['SOUND EFFECTS', 'Freesound and Kenney contributors (CC0 / CC BY)\nfull list in assets/audio/CREDITS_sfx.md'],
  ['TYPEFACES', 'Rye and Special Elite (Google Fonts, SIL OFL)'],
  ['ENGINE', 'Phaser 3 + Vite'],
];
const CREDIT_ROW_SKIP = new Set(['MUSIC', 'SOUND', 'TYPEFACES', 'ENGINE']); // already on page 1

let launchSubtitle = null; // one subtitle per launch (per progress state), not per visit to the menu

export default class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.starting = false; // scene instance is reused after QUIT TO MENU
    this.modal = null;
    setOsCursor(this.game, ''); // in-game crosshair mode is switched off again
    this.cameras.main.fadeIn(400, 13, 8, 6);
    const won = (Save.get().stats.wins || 0) > 0 || !!Save.flag('ending_a');
    const trueEnding = !!Save.flag('ending_true');
    this.title = new TitleLayers(this, { won, trueEnding }); // sky / town / foreground / rider parallax; falls back to `title_bg`
    bus.scoped(this, 'title:hell', (p) => this.title.setHell(!!(p && p.on)));
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
    const key = `${won ? 1 : 0}${trueEnding ? 1 : 0}`;
    if (!launchSubtitle || launchSubtitle.key !== key) launchSubtitle = { key, text: menuSubtitle({ won, trueEnding }, new RNG(Date.now() >>> 0)) };
    this.add.text(W / 2, 398, launchSubtitle.text, body(30, CSS.amber, { strokeThickness: 5, fontStyle: 'italic' })).setOrigin(0.5);
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
    this.list.select(0, true); // CONTINUE (when a checkpoint exists) is item 0: one Enter must never abandon it (Q1-02)
    // lazy art (QA4-001): once the menu is up, fetch what the next actions need (first-ride cutscene, Hell intro reuse, codex book)
    this.time.delayedCall(1200, () => {
      if (!Save.flag('introSeen')) Assets.prefetch('intro');
      if (Meta.isModeUnlocked('hell')) Assets.prefetch(['cutscene_end_a_5', 'cutscene_intro_7']);
      Assets.prefetch(['cast', 'codex']);
    });

    // controls + credits line + mute state
    const controls = ['WASD  move          ARROWS / MOUSE  shoot', 'SPACE  dodge roll          E  dynamite          Q  item', 'ESC / P  pause          M  mute'];
    this.add.rectangle(28, 826, 640, 106, 0x0d0806, 0.6).setOrigin(0, 0).setDepth(1); // V-023: contrast plate under the hints
    controls.forEach((c, i) => this.add.text(40, 840 + i * 30, c, body(21, CSS.sand, { strokeThickness: 4 })).setOrigin(0, 0.5).setDepth(2));
    this.add.text(40, H - 28, 'Music: Kevin MacLeod (incompetech.com), CC BY 4.0   -   Sound: Freesound / Kenney (see Credits)', body(16, '#8a7350', { strokeThickness: 3 })).setOrigin(0, 0.5);
    this.muteText = this.add.text(W - 30, H - 30, '', body(20, CSS.sand)).setOrigin(1);
    this.refreshMute();
    bus.scoped(this, 'audio:changed', () => this.refreshMute());
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.refreshMute() });
    if (flag('debug')) this.add.text(30, 30, 'DEBUG MODE (F1-F7)', body(20, CSS.green));

    this.toasts = new AchievementToast(this, {});

    // ESC / Enter / click close a modal (the credits modal has pages: arrows / Enter / click turn them, the last page closes)
    this.input.keyboard.on('keydown', (e) => {
      const m = this.modal;
      if (!m || performance.now() < m.t0 + 200) return;
      if (m.go) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') m.go(-1);
        else if (['ArrowRight', 'KeyD', 'Enter', 'Space', 'NumpadEnter'].includes(e.code)) m.go(1);
        else if (e.code === 'Escape' || e.code === 'Backspace') this.closeModal();
      } else if (['Escape', 'Enter', 'Space', 'NumpadEnter', 'Backspace'].includes(e.code)) this.closeModal();
    });
    this.input.on('pointerdown', () => {
      const m = this.modal;
      if (!m || performance.now() < m.t0 + 200) return;
      if (m.go) m.go(1); else this.closeModal();
    });
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

  update(time, delta) { if (this.title) this.title.update(time, delta); }

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
    // CONTINUE into F4-F6: hold on black until that floor's lazy art is in (<= 8 s), so the first room never shows a placeholder floor
    const ready = scene === 'Game' && data && data.continue ? Assets.ensure(`f${data.floor || 1}`, { timeoutMs: 8000 }) : Promise.resolve(true);
    this.cameras.main.once('camerafadeoutcomplete', () => ready.then(() => { if (this.sys.isActive()) this.scene.start(scene, data); }));
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

  /** Credits modal: page 1 = the short list, page 2 = STORY s14 rows (design, art, words, riders, keepers, the House, thanks). */
  openCredits() {
    uiSfx.select();
    const add = this.beginModal();
    const pw = 1080;
    const panel = add(parchment(this, W / 2, H / 2, pw));
    const top = H / 2 - panel.displayHeight / 2;
    add(this.add.text(W / 2, top + 100, 'CREDITS', title(64, '#3a1a10', { stroke: '#e8d9b0', strokeThickness: 2 })).setOrigin(0.5));
    const sub = add(this.add.text(W / 2, top + 156, '', inkText(28, INK, { fontStyle: 'italic' })).setOrigin(0.5));
    const foot = add(this.add.text(W / 2, top + panel.displayHeight - 92, '', inkText(22, '#5a1a10')).setOrigin(0.5));
    const rows2 = creditsRows('a', MUSIC_CREDITS_CH2).filter((r) => r.kind === 'text' || (r.kind === 'line' && !CREDIT_ROW_SKIP.has(r.label)));
    const groups = [
      { sub: 'Chapters I and II', rows: CREDITS.map(([k, v]) => ({ kind: 'line', label: k, text: v })), fs: 21, gap: 22 },
      { sub: 'A Tale of Perdition County', rows: rows2, fs: 20, gap: 16 },
    ];
    const room = top + panel.displayHeight - 128;
    const y0 = top + 206;
    // paginate: a row that would cross the footer moves to the next page (measured once with a throwaway text)
    const rowH = (r, G, add2) => {
      if (r.kind === 'line') {
        const h = add2(this.add.text(0, 0, r.text, inkText(G.fs, INK, { align: 'center', wordWrap: { width: 800 } })));
        return 30 + h + G.gap;
      }
      return 6 + add2(this.add.text(0, 0, r.text, inkText(20, '#5a1a10', { align: 'center', fontStyle: 'italic', wordWrap: { width: 800 } }))) + 16;
    };
    const measure = (o) => { const h = o.height; o.destroy(); return h; };
    const pages = [];
    for (const G of groups) {
      let cur = [], y = y0;
      for (const r of G.rows) {
        const h = rowH(r, G, measure);
        if (cur.length && y + h > room) { pages.push({ sub: G.sub, rows: cur, G }); cur = []; y = y0; }
        cur.push(r); y += h;
      }
      if (cur.length) pages.push({ sub: G.sub, rows: cur, G });
    }
    let page = -1, objs = [];
    const show = (i) => {
      for (const o of objs) o.destroy();
      this.modal.objs = this.modal.objs.filter((o) => !objs.includes(o));
      objs = [];
      page = i;
      const P = pages[i], G = P.G;
      sub.setText(P.sub);
      let y = y0;
      const put = (o) => { o.setDepth(120 + objs.length); objs.push(o); this.modal.objs.push(o); return o; };
      for (const r of P.rows) {
        if (r.kind === 'line') {
          put(this.add.text(W / 2, y, r.label, title(22, '#5a1a10', { strokeThickness: 0 })).setOrigin(0.5, 0));
          const t = put(this.add.text(W / 2, y + 30, r.text, inkText(G.fs, INK, { align: 'center', wordWrap: { width: 800 } })).setOrigin(0.5, 0));
          y += 30 + t.height + G.gap;
        } else {
          const t = put(this.add.text(W / 2, y + 6, r.text, inkText(20, '#5a1a10', { align: 'center', fontStyle: 'italic', wordWrap: { width: 800 } })).setOrigin(0.5, 0));
          y += t.height + 22;
        }
      }
      foot.setText(i < pages.length - 1 ? `ESC  back      RIGHT / ENTER  more   ${i + 1}/${pages.length}` : `ESC  back      LEFT  previous   ${i + 1}/${pages.length}`);
    };
    this.modal.go = (d) => {
      const n = page + d;
      if (n >= pages.length) this.closeModal();
      else if (n >= 0) { uiSfx.move(); show(n); }
    };
    show(0);
  }
}
