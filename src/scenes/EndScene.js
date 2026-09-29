// Run-end screen. Death = "WANTED - DEAD OR ALIVE" poster (cause of death, floor, time, kills, relic icons, YOU DIED stamp slams in);
// chapter-complete = the same poster in victory dress (sunrise art, green stamp, TO BE CONTINUED). R / Enter = ride again, ESC = menu.
// Scene instances are reused: per-visit state is reset in init().
import Phaser from 'phaser';
import { W, H, FONT_TITLE, FONT_BODY, CSS, FLOORS } from '../config.js';
import Assets from '../core/Assets.js';
import { Sfx, playMusicFor } from '../core/Audio.js';
import { fmtTime } from '../core/util.js';
import { getItem } from '../items/registry.js';
import { Save } from '../core/Save.js';
import { title, body, inkText, INK, parchment, uiSfx, setOsCursor } from '../ui/UiKit.js';

const DEATH_LINES = [
  'Hanged by the Devil\'s own noose.',
  'Buried without a headstone. Again.',
  'The vultures thank you for your service.',
  'The debt remains unpaid.',
  'Perdition County claims another soul.',
  'Six feet under, and no whiskey.',
  'Your boots were sold before you hit the dirt.',
  'The Devil keeps very good books.',
];
// how the run ended -> what the poster says. Sources come from Player.die: enemyName || bullet/attack kind || 'dynamite' | 'the desert'
const CAUSE = {
  spikes: 'Rusty spikes', explosion: 'Dynamite', dynamite: 'Dynamite', 'the desert': 'The desert itself', enemy: 'A stray bullet', venom: 'Snake venom',
  nail: 'A coffin nail', ghostfire: 'Ghostfire', rock: 'A falling rock', stick: 'A stick of dynamite', contact: 'A close encounter', dive: 'El Cascabel',
  burst: 'A very angry mole', melee: 'A pickaxe', slam: 'Marshal Grimm', cascabel: 'El Cascabel', grimm: 'Marshal Grimm', undertaker: 'The Undertaker',
  tumbleweed_mini: 'A tumbleweed', crow: 'A murder of crows',
};
function causeOf(k) {
  if (!k) return 'Unknown causes';
  if (CAUSE[k]) return CAUSE[k];
  if (/[A-Z ]/.test(k)) return k; // already a proper name ("Marshal Grimm")
  const w = k.replace(/_/g, ' ');
  return `${/^[aeiou]/i.test(w) ? 'An' : 'A'} ${w.charAt(0).toUpperCase()}${w.slice(1)}`;
}
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

export default class EndScene extends Phaser.Scene {
  constructor() { super('End'); }

  init(data) { this.data0 = data; this.leaving = false; this.ready = false; } // scene instances are reused: per-visit flags must be reset here

  create() {
    const { variant, run, items } = this.data0;
    const won = variant === 'complete';
    setOsCursor(this.game, '');
    this.cameras.main.fadeIn(500, 13, 8, 6);
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d0806);
    if (Assets.has('title_bg')) {
      const bg = this.add.image(W / 2, H / 2, 'title_bg').setAlpha(won ? 0.62 : 0.3);
      if (won) bg.setTint(0xffd8a0);
      this.tweens.add({ targets: bg, scale: 1.05, duration: 16000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setTint(0x000000).setAlpha(0.55);
    if (won && this.textures.exists('glow')) {
      const sun = this.add.image(W / 2, H / 2 - 40, 'glow').setScale(11).setTint(0xffb040).setAlpha(0.32).setBlendMode('ADD');
      this.tweens.add({ targets: sun, alpha: 0.5, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    if (this.textures.exists('px')) {
      this.add.particles(0, 0, 'px', {
        x: { min: 0, max: W }, y: H + 10, lifespan: { min: 6000, max: 11000 }, speedY: { min: -60, max: -20 }, speedX: { min: -20, max: 20 },
        scale: { start: 1.6, end: 0 }, alpha: { start: 0.7, end: 0 }, tint: won ? [0xffd070, 0xf0a640, 0xe8dcc0] : [0xd63a2a, 0x8a1c1c, 0xf0a640], frequency: 280, blendMode: 'ADD',
      });
    }
    playMusicFor(won ? 'victory' : 'death', { fade: 300 });

    // ------------------------------------------------------------------ poster
    const cx = W / 2, cy = 462;
    const poster = this.add.container(0, 0);
    const panel = parchment(this, cx, cy, 1250);
    poster.add(panel);
    const T = (x, y, s, style, ox = 0.5, oy = 0.5) => { const t = this.add.text(x, y, s, style).setOrigin(ox, oy); poster.add(t); return t; };
    const ink = INK, red = '#6a1410';
    const h1 = T(cx, 176, won ? 'CHAPTER I' : 'WANTED', title(won ? 96 : 116, '#2a1810', { stroke: '#c9a56a', strokeThickness: 3 }));
    h1.setShadow(3, 4, '#00000055', 0, false, true);
    const h2 = T(cx, 250, won ? '-  PERDITION COUNTY  -' : '-  DEAD  OR  ALIVE  -', inkText(38, red, { fontStyle: 'bold' }));
    const rule = this.add.graphics(); rule.lineStyle(3, 0x2a1810, 0.85).lineBetween(cx - 470, 284, cx + 470, 284).lineStyle(1, 0x2a1810, 0.7).lineBetween(cx - 470, 290, cx + 470, 290);
    poster.add(rule);
    const sub = won ? 'The Devil\'s saloon lies just beyond the last door...' : DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)];
    T(cx, 320, sub, inkText(27, ink, { fontStyle: 'italic' }));

    // portrait "photograph"
    const px = 345, py = 522, ps = 280;
    const frame = this.add.graphics();
    frame.fillStyle(0x6b4423, 0.28).fillRect(px - ps / 2, py - ps / 2, ps, ps);
    frame.lineStyle(6, 0x2a1810, 1).strokeRect(px - ps / 2, py - ps / 2, ps, ps).lineStyle(2, 0x2a1810, 0.9).strokeRect(px - ps / 2 - 9, py - ps / 2 - 9, ps + 18, ps + 18);
    poster.add(frame);
    if (Assets.has('portrait_player')) {
      const pic = this.add.image(px, py + 6, 'portrait_player').setDisplaySize(ps - 6, ps - 6);
      if (!won) pic.setTint(0xb09878).setAlpha(0.92);
      poster.add(pic);
    }
    T(px, 702, 'THE  GUNSLINGER', title(26, '#2a1810', { strokeThickness: 0 }));
    const reward = run.kills * 25 + run.bossesKilled * 500 + (run.floor - 1) * 250 + (won ? 2000 : 0);
    T(px, 738, won ? `BOUNTY COLLECTED   ${money(reward)}` : `REWARD   ${money(reward)}`, inkText(23, red, { fontStyle: 'bold' }));

    // stat rows
    const f = FLOORS[run.floor] || FLOORS[1];
    const rows = [
      ['Floor reached', `${run.floor} - ${f.name}`],
      ['Time', fmtTime(run.time) + (won && this.data0.best ? (this.data0.best.isNew ? '  - NEW BEST!' : `  - best ${fmtTime(this.data0.best.time)}`) : '')],
      ['Enemies slain', String(run.kills), run.kills],
      ['Rooms cleared', String(run.roomsCleared), run.roomsCleared],
      ['Bosses felled', String(run.bossesKilled), run.bossesKilled],
      ['Damage taken', `${run.damageTaken / 2} hearts`],
    ];
    if (!won) rows.unshift(['Killed by', causeOf(run.killedBy)]);
    const rx0 = 590, rx1 = 1245, ry = 374, rstep = 43;
    this.rowObjs = [];
    rows.forEach(([k, v, n], i) => {
      const y = ry + i * rstep;
      const lab = T(rx0, y, k, inkText(28, ink), 0, 0.5);
      const val = T(rx1, y, v, inkText(28, i === 0 && !won ? '#8a1c1c' : '#5a1a10', { fontStyle: 'bold' }), 1, 0.5);
      const dots = this.add.graphics(); poster.add(dots);
      const a = rx0 + lab.width + 12, b = rx1 - val.width - 12;
      dots.fillStyle(0x2a1810, 0.45); for (let x = a; x < b; x += 9) dots.fillRect(x, y + 8, 2.5, 2.5);
      const grp = [lab, val, dots];
      grp.forEach((o) => o.setAlpha(0));
      this.rowObjs.push({ grp, val, n, v });
    });

    // relics
    const ids = items || [];
    const counts = new Map();
    for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
    const uniq = [...counts.entries()];
    const relY = ry + rows.length * rstep + 32;
    T((rx0 + rx1) / 2, relY, uniq.length ? 'RELICS  COLLECTED' : 'NO  RELICS  FOUND', title(24, '#2a1810', { strokeThickness: 0 }));
    this.relicIcons = [];
    const step = Math.min(62, (rx1 - rx0) / Math.max(1, uniq.length)), sc = Math.min(0.6, step / 100);
    const tip = T((rx0 + rx1) / 2, relY + 82, '', inkText(19, red), 0.5, 0.5);
    uniq.slice(0, 14).forEach(([id, n], i) => {
      const def = getItem(id);
      const ic = (def && def.icon) || { sheet: 'items_passive_a', name: id };
      const x = (rx0 + rx1) / 2 - ((Math.min(uniq.length, 14) - 1) * step) / 2 + i * step, y = relY + 42;
      const im = Assets.makeCell(this, x, y, ic.sheet, ic.name, 0.5).setScale(0).setInteractive({ useHandCursor: true });
      im.on('pointerover', () => { tip.setText(def ? `${def.name}${n > 1 ? ` x${n}` : ''}` : id); im.setScale(sc * 1.18); });
      im.on('pointerout', () => { tip.setText(''); im.setScale(sc); });
      poster.add(im);
      if (n > 1) { const t = T(x + step * 0.36, y + 22, `x${n}`, inkText(16, red, { fontStyle: 'bold' }), 1, 0.5); t.setAlpha(0); im.badge = t; }
      this.relicIcons.push({ im, sc });
    });
    T(rx1, 796, `seed ${run.seed}`, inkText(15, '#6b4423'), 1, 0.5).setAlpha(0.7);

    // stamp (slams in last)
    const stamp = this.add.container(px, py + 30).setAlpha(0).setAngle(-16);
    const stampCol = won ? 0x2a5a10 : 0x9a1414;
    const st = this.add.text(0, 0, won ? 'COMPLETE' : 'YOU DIED', { fontFamily: FONT_TITLE, fontSize: won ? '54px' : '64px', color: won ? '#2a5a10' : '#9a1414' }).setOrigin(0.5);
    const sb = this.add.graphics();
    sb.lineStyle(7, stampCol, 1).strokeRoundedRect(-st.width / 2 - 18, -st.height / 2 - 8, st.width + 36, st.height + 16, 8);
    sb.lineStyle(2, stampCol, 1).strokeRoundedRect(-st.width / 2 - 28, -st.height / 2 - 18, st.width + 56, st.height + 36, 12);
    stamp.add([sb, st]);
    // (normal blend: MULTIPLY made the dark-red letters vanish over the dark portrait, leaving 'YO..IED' / 'CO..ETE')
    poster.add(stamp);

    // ------------------------------------------------------------------ prompts
    const again = () => { if (this.leaving || !this.ready) return; this.leaving = true; Sfx.play('gun_cock', { vol: 0.7 }); this.cameras.main.fadeOut(300, 13, 8, 6); this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game')); };
    const menu = () => { if (this.leaving || !this.ready) return; this.leaving = true; uiSfx.back(); this.cameras.main.fadeOut(300, 13, 8, 6); this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu')); };
    const btn = (x, y, label, fn, style) => {
      const t = this.add.text(x, y, label, style).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });
      const col = style.color;
      t.on('pointerdown', fn); t.on('pointerover', () => t.setColor(CSS.amber)); t.on('pointerout', () => t.setColor(col));
      return t;
    };
    const prompt = won
      ? this.add.text(W / 2, 888, 'TO BE CONTINUED...', title(46, CSS.bone, { strokeThickness: 8 })).setOrigin(0.5).setAlpha(0)
      : btn(W / 2, 888, 'Press R to ride again', again, title(40, CSS.bone, { strokeThickness: 7 }));
    const sec = won
      ? [btn(W / 2 - 170, 928, 'R  RIDE AGAIN', again, body(22, CSS.sand)), btn(W / 2 + 170, 928, 'ESC  MENU', menu, body(22, CSS.sand))]
      : [btn(W / 2, 928, 'ESC  MENU', menu, body(22, CSS.sand))];
    this.input.keyboard.on('keydown-R', again);
    this.input.keyboard.on('keydown-ENTER', again);
    this.input.keyboard.on('keydown-ESC', menu);

    // ------------------------------------------------------------------ timeline
    poster.setY(-260).setAngle(0);
    panel.setAngle(0);
    this.tweens.add({ targets: poster, y: 0, duration: 520, ease: 'Back.easeOut', onStart: () => Sfx.play('door_close', { vol: 0.6, rate: 1.1 }) });
    h1.setScale(0.6).setAlpha(0); h2.setAlpha(0);
    this.tweens.add({ targets: h1, scale: 1, alpha: 1, duration: 320, delay: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: h2, alpha: 1, duration: 300, delay: 600 });
    this.rowObjs.forEach((r, i) => {
      this.time.delayedCall(800 + i * 110, () => {
        this.tweens.add({ targets: r.grp, alpha: 1, duration: 200 });
        if (r.n > 0) this.count(r.val, r.n, r.v);
        Sfx.play('menu_move', { vol: 0.35, rate: 0.9 + i * 0.05, gap: 0.05 });
      });
    });
    const relT0 = 800 + rows.length * 110 + 150;
    this.relicIcons.forEach((r, i) => {
      this.time.delayedCall(relT0 + i * 80, () => {
        this.tweens.add({ targets: r.im, scale: r.sc, duration: 220, ease: 'Back.easeOut' });
        if (r.im.badge) this.tweens.add({ targets: r.im.badge, alpha: 1, duration: 200 });
        Sfx.play('pickup_coin', { vol: 0.35, rate: 1 + i * 0.06, gap: 0.05 });
      });
    });
    const stampT = relT0 + this.relicIcons.length * 80 + 250;
    this.time.delayedCall(stampT, () => {
      stamp.setScale(2.6).setAlpha(0);
      this.tweens.add({
        targets: stamp, scale: 1, alpha: 0.86, duration: 150, ease: 'Cubic.easeIn',
        onComplete: () => { if (Save.settings().shake !== false) this.cameras.main.shake(220, 0.008); Sfx.play(won ? 'room_clear' : 'door_close', { vol: 0.9, rate: won ? 1 : 0.85 }); if (!won) Sfx.play('boss_hit', { vol: 0.5, rate: 0.8 }); },
      });
    });
    this.time.delayedCall(stampT + 350, () => {
      this.ready = true;
      this.tweens.add({ targets: [prompt, ...sec], alpha: 1, duration: 400 });
      this.tweens.add({ targets: prompt, alpha: 0.55, duration: 850, yoyo: true, repeat: -1, delay: 500 });
    });
    // let impatient players skip straight to the prompts
    this.time.delayedCall(450, () => { this.ready = true; });
  }

  /** Count a numeric stat up from 0 (value text keeps its original formatting). */
  count(txt, n, final) {
    const o = { v: 0 };
    this.tweens.add({ targets: o, v: n, duration: Math.min(700, 200 + n * 12), ease: 'Cubic.easeOut', onUpdate: () => txt.setText(String(Math.round(o.v))), onComplete: () => txt.setText(final) });
  }
}
