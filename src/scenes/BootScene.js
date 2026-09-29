// Boot / loading screen: waits for the western fonts, fetches the manifest, pre-loads the logo + brass round (tiny), then loads
// everything else with a real progress bar (bullet tip, file counter) while rotating flavour lines and gameplay tips.
import Phaser from 'phaser';
import { W, H, FONT_TITLE, FONT_BODY, CSS } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Audio } from '../core/Audio.js';
import { installAudioHooks } from '../core/AudioHooks.js';

const LINES = [
  'Digging up old debts...', 'Loading the six-shooter...', 'Sharpening the noose...', 'Waking the dead...', 'Counting the bullets...',
  'Feeding the buzzards...', 'Polishing the tin star...', 'Praying to a silent sky...', 'Reading the fine print of the contract...', 'Summoning the Devil\'s bookkeeper...',
];
const TIPS = [
  'Every sixth bullet hits twice as hard and pierces.',
  'Space rolls through bullets. The roll has a cooldown, so pick your moment.',
  'Dynamite hurts you too. It also opens secret rooms.',
  'Golden doors need a key. Somewhere on the floor, one is waiting.',
  'Tin hearts are lost before your red ones.',
  'Every attack is telegraphed. Watch for the wind-up pose.',
  'Cleared rooms recharge your active item.',
];

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  async create() {
    this.cameras.main.setBackgroundColor('#0d0806');
    this.pct = 0;
    this.shownPct = 0;
    const cx = W / 2;
    // Fonts + manifest in parallel (fonts: never block more than 1.5 s, fall back to Georgia/serif).
    const fonts = (async () => {
      try {
        if (document.fonts && document.fonts.load) {
          await Promise.race([
            Promise.all([document.fonts.load('32px "Rye"'), document.fonts.load('20px "Special Elite"')]),
            new Promise((r) => setTimeout(r, 1500)),
          ]);
        }
      } catch (e) { /* ignore */ }
    })();
    await Promise.all([Assets.fetchManifest(), fonts]);

    // phase 1: the two small assets the loading screen wants (skipped silently if missing)
    const m = Assets.manifest;
    if (m.images.title_logo && m.images.title_logo.file) this.load.image('title_logo', Assets._url(m.images.title_logo.file, 'images'));
    const hi = m.sprites.hud_icons;
    if (hi && hi.file) this.load.spritesheet('hud_icons', Assets._url(hi.file, 'sprites'), { frameWidth: hi.frameWidth || 64, frameHeight: hi.frameHeight || 64 });
    await new Promise((res) => {
      if (this.load.list.size === 0) { res(); return; }
      this.load.once('complete', res);
      this.load.start();
    });
    this.build(cx);
    this.startLoad();
  }

  build(cx) {
    const cy = H / 2;
    // soft red dusk glow + vignette so the screen is not a flat black void
    const glow = this.add.graphics();
    for (let i = 0; i < 9; i++) glow.fillStyle(0x6a1410, 0.045).fillEllipse(cx, cy + 140, 1500 - i * 130, 700 - i * 55);
    this.embers = [];
    for (let i = 0; i < 26; i++) {
      const e = this.add.rectangle(Math.random() * W, Math.random() * H, 3, 3, i % 3 ? 0xd63a2a : 0xf0a640, 0.5);
      e.vy = 18 + Math.random() * 40; e.vx = -10 + Math.random() * 20; e.ph = Math.random() * 6;
      this.embers.push(e);
    }
    if (this.textures.exists('title_logo')) {
      const logo = this.add.image(cx, cy - 170, 'title_logo');
      logo.setScale(Math.min(1, 860 / logo.width)).setAlpha(0);
      this.tweens.add({ targets: logo, alpha: 1, y: cy - 160, duration: 700, ease: 'Cubic.easeOut' });
      this.logo = logo;
    } else {
      this.logo = this.add.text(cx, cy - 170, 'DEAD WEST', { fontFamily: FONT_TITLE, fontSize: '130px', color: CSS.bone, stroke: '#120c0a', strokeThickness: 14 }).setOrigin(0.5);
      this.logo.setShadow(0, 8, '#8a1c1c', 0, true, true);
    }
    this.line = this.add.text(cx, cy + 40, LINES[Math.floor(Math.random() * LINES.length)], { fontFamily: FONT_BODY, fontSize: '28px', color: CSS.sand, stroke: '#120c0a', strokeThickness: 5 }).setOrigin(0.5);

    // progress bar: dark wooden trough, blood-red fill with a brass round leading the way
    const barW = 720, barH = 26, bx = cx - barW / 2, by = cy + 100;
    this.bar = { x: bx, y: by, w: barW, h: barH };
    this.add.rectangle(cx, by, barW + 14, barH + 14, 0x120c0a).setStrokeStyle(4, 0x6b4423);
    this.add.rectangle(cx, by, barW + 2, barH + 2, 0x2a1810);
    this.fill = this.add.graphics();
    this.tip = this.textures.exists('hud_icons') ? Assets.makeCell(this, bx, by, 'hud_icons', 'bullet_full', 0.5).setScale(0.62) : this.add.circle(bx, by, 10, 0xd9b071);
    this.tip.setDepth(5);
    this.tweens.add({ targets: this.tip, angle: 360, duration: 1400, repeat: -1 });
    this.pctText = this.add.text(cx, by + 46, '0%', { fontFamily: FONT_BODY, fontSize: '22px', color: CSS.amber, stroke: '#120c0a', strokeThickness: 4 }).setOrigin(0.5);
    this.tipText = this.add.text(cx, H - 90, `TIP  -  ${TIPS[Math.floor(Math.random() * TIPS.length)]}`, { fontFamily: FONT_BODY, fontSize: '22px', color: '#a48a5c', stroke: '#120c0a', strokeThickness: 4, align: 'center', wordWrap: { width: 1100 } }).setOrigin(0.5);

    // rotate flavour line + tip
    this.time.addEvent({ delay: 1500, loop: true, callback: () => this.swap(this.line, LINES, '') });
    this.time.addEvent({ delay: 3200, loop: true, callback: () => this.swap(this.tipText, TIPS, 'TIP  -  ') });
    this.cameras.main.fadeIn(250, 13, 8, 6);
  }

  swap(txt, arr, prefix) {
    if (this.done) return;
    let s;
    do { s = prefix + arr[Math.floor(Math.random() * arr.length)]; } while (s === txt.text && arr.length > 1);
    this.tweens.add({ targets: txt, alpha: 0, duration: 150, onComplete: () => { txt.setText(s); this.tweens.add({ targets: txt, alpha: 1, duration: 200 }); } });
  }

  startLoad() {
    const total = () => Math.max(1, this.load.totalToLoad);
    Assets.queue(this);
    this.load.on('progress', (p) => { this.pct = p; this.game.events.emit('boot:progress', p, this.load.totalComplete, this.load.totalToLoad); });
    this.load.on('filecomplete', () => { if (this.pctText) this.pctText.setText(`${Math.floor(this.pct * 100)}%   -   ${this.load.totalComplete} / ${total()}`); });
    this.load.once('complete', () => this.finish());
    if (this.load.list.size === 0) this.finish(); else this.load.start();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    Assets.finish(this);
    Audio.init(this.game);
    installAudioHooks(this.game);
    this.pct = 1;
    this.game.events.emit('boot:progress', 1, this.load.totalComplete, this.load.totalToLoad);
    this.game.events.emit('boot:done');
    if (this.line) { this.line.setText('Ready.'); this.line.setAlpha(1); }
    if (this.pctText) this.pctText.setText('100%');
    this.time.delayedCall(this.fill ? 260 : 0, () => {
      this.cameras.main.fadeOut(200, 13, 8, 6);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
      // fail-safe (fade callbacks do not fire in some hidden-tab situations)
      this.time.delayedCall(600, () => { if (this.scene.isActive('Boot')) this.scene.start('Menu'); });
    });
  }

  update(t, dt) {
    if (!this.bar || !this.fill) return;
    // ease the displayed value toward the real progress
    this.shownPct += (this.pct - this.shownPct) * Math.min(1, dt / 120);
    const b = this.bar, w = Math.max(6, b.w * this.shownPct);
    const g = this.fill;
    g.clear();
    g.fillStyle(0x8a1c1c, 1).fillRect(b.x, b.y - b.h / 2, w, b.h);
    g.fillStyle(0xd63a2a, 1).fillRect(b.x, b.y - b.h / 2, w, b.h * 0.34);
    g.fillStyle(0x000000, 0.22);
    for (let x = b.x + 18; x < b.x + w - 6; x += 36) g.fillRect(x, b.y - b.h / 2, 3, b.h); // rivet-ish ticks
    this.tip.setPosition(b.x + w, b.y);
    if (this.embers) for (const e of this.embers) {
      e.y -= e.vy * dt / 1000; e.x += (e.vx + Math.sin(t / 700 + e.ph) * 14) * dt / 1000;
      if (e.y < -10) { e.y = H + 10; e.x = Math.random() * W; }
    }
  }
}
