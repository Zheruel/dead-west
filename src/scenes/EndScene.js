// Run-end screen. Death = "WANTED - DEAD OR ALIVE" poster (cause of death, floor, time, kills, relic icons, YOU DIED stamp slams in);
// chapter-complete = the same poster in victory dress (sunrise art, green stamp, TO BE CONTINUED). Page 2 = THE LEDGER (Space / click, or on its own after a
// few seconds): Notoriety bar + breakdown, unlocks, codex discoveries, contract / daily result, floor times, damage sources, seed (C copies it).
// R / Enter = ride again (same rider and mode; a Daily replays the same date), ESC = menu, Left = back to the poster.
// Scene instances are reused: per-visit state is reset in init().
import Phaser from 'phaser';
import { W, H, FONT_TITLE, FONT_BODY, CSS, FLOORS } from '../config.js';
import Assets from '../core/Assets.js';
import { Sfx, playMusicFor } from '../core/Audio.js';
import { fmtTime, clamp } from '../core/util.js';
import { getItem } from '../items/registry.js';
import { Save } from '../core/Save.js';
import { Meta } from '../meta/index.js';
import { rankFor, nextRank } from '../meta/ranks.js';
import { computeReward } from '../meta/score.js';
import { prettyId } from '../meta/codexText.js';
import { charDef } from '../data/characters.js';
import { MUTATORS } from '../data/difficulty.js';
import { title, body, inkText, INK, parchment, uiSfx, setOsCursor } from '../ui/UiKit.js';
import { chip, riderToken, starIcon, itemIcon } from '../ui/Silhouette.js';

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

  init(data) { this.data0 = data; this.leaving = false; this.ready = false; this.page = 1; this.paging = false; this.ledgerBuilt = false; this.autoT = null; } // scene instances are reused: per-visit flags must be reset here

  create() {
    const { variant, run, items } = this.data0;
    const led = this.data0.ledger || null;
    const sum = (led && led.summary) || Meta.lastSummary || null;
    this.led = led; this.sum = sum;
    this.char = (led && led.char) || run.char || this.data0.char || 'gunslinger';
    this.mode = (led && led.mode) || run.mode || this.data0.mode || 'normal';
    const won = variant === 'complete' || variant === 'contract';
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
    const h1 = T(cx, 176, variant === 'complete' ? 'CHAPTER I' : variant === 'contract' ? 'CONTRACT' : 'WANTED', title(won ? 96 : 116, '#2a1810', { stroke: '#c9a56a', strokeThickness: 3 }));
    h1.setShadow(3, 4, '#00000055', 0, false, true);
    const h2 = T(cx, 250, variant === 'complete' ? '-  PERDITION COUNTY  -' : variant === 'contract' ? '-  PAID  IN  FULL  -' : '-  DEAD  OR  ALIVE  -', inkText(38, red, { fontStyle: 'bold' }));
    const rule = this.add.graphics(); rule.lineStyle(3, 0x2a1810, 0.85).lineBetween(cx - 470, 284, cx + 470, 284).lineStyle(1, 0x2a1810, 0.7).lineBetween(cx - 470, 290, cx + 470, 290);
    poster.add(rule);
    const sub = variant === 'contract' ? 'The board pays out. The Devil still keeps the change.' : won ? 'The Devil\'s saloon lies just beyond the last door...' : DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)];
    T(cx, 320, sub, inkText(27, ink, { fontStyle: 'italic' }));
    this.ribbon(poster);

    // portrait "photograph"
    const px = 345, py = 522, ps = 280;
    const frame = this.add.graphics();
    frame.fillStyle(0x6b4423, 0.28).fillRect(px - ps / 2, py - ps / 2, ps, ps);
    frame.lineStyle(6, 0x2a1810, 1).strokeRect(px - ps / 2, py - ps / 2, ps, ps).lineStyle(2, 0x2a1810, 0.9).strokeRect(px - ps / 2 - 9, py - ps / 2 - 9, ps + 18, ps + 18);
    poster.add(frame);
    const pkey = this.char === 'gunslinger' ? 'portrait_player' : `portrait_${this.char}`;
    if (Assets.has(pkey)) {
      const pic = this.add.image(px, py + 6, pkey).setDisplaySize(ps - 6, ps - 6);
      if (!won) pic.setTint(0xb09878).setAlpha(0.92);
      poster.add(pic);
    } else poster.add(riderToken(this, px, py, this.char, ps - 30, { mask: false }));
    const cdef = charDef(this.char);
    T(px, 702, `THE  ${String(cdef.name).replace(/^THE /i, '').toUpperCase()}`, title(26, '#2a1810', { strokeThickness: 0 }));
    T(px, 728, Meta.titleLabel().toUpperCase(), inkText(17, '#6b4423', { fontStyle: 'italic' }));
    const reward = sum && sum.reward != null ? sum.reward : computeReward(run, { won: variant === 'complete', mode: this.mode });
    this.reward = reward;
    T(px, 756, won ? `BOUNTY COLLECTED   ${money(reward)}` : `REWARD   ${money(reward)}`, inkText(23, red, { fontStyle: 'bold' }));

    // stat rows
    const f = FLOORS[run.floor] || FLOORS[1];
    const rows = [
      [sum && sum.newBest.floor ? 'Deepest yet!' : 'Floor reached', `${run.floor} - ${f.name}`],
      [sum && sum.newBest.time ? 'Fastest yet!' : 'Time', fmtTime(run.time)],
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
      const x = (rx0 + rx1) / 2 - ((Math.min(uniq.length, 14) - 1) * step) / 2 + i * step, y = relY + 42;
      const im = itemIcon(this, x, y, def || { id }, 0).setInteractive({ useHandCursor: true });
      im.on('pointerover', () => { tip.setText(def ? `${def.name}${n > 1 ? ` x${n}` : ''}` : id); im.setScale(sc * 1.18); });
      im.on('pointerout', () => { tip.setText(''); im.setScale(sc); });
      poster.add(im);
      if (n > 1) { const t = T(x + step * 0.36, y + 22, `x${n}`, inkText(16, red, { fontStyle: 'bold' }), 1, 0.5); t.setAlpha(0); im.badge = t; }
      this.relicIcons.push({ im, sc });
    });
    T(rx1, 776, `seed ${this.code()}`, inkText(15, '#6b4423'), 1, 0.5).setAlpha(0.7);

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
    const again = () => { if (this.leaving || !this.ready) return; this.leaving = true; Sfx.play('gun_cock', { vol: 0.7 }); this.cameras.main.fadeOut(300, 13, 8, 6); this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', this.rideData())); };
    const menu = () => { if (this.leaving || !this.ready) return; this.leaving = true; uiSfx.back(); this.cameras.main.fadeOut(300, 13, 8, 6); this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu')); };
    const btn = (x, y, label, fn, style) => {
      const t = this.add.text(x, y, label, style).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });
      const col = style.color;
      t.on('pointerdown', fn); t.on('pointerover', () => t.setColor(CSS.amber)); t.on('pointerout', () => t.setColor(col));
      return t;
    };
    const prompt = won
      ? this.add.text(W / 2, 888, variant === 'complete' ? 'TO BE CONTINUED...' : 'CONTRACT SETTLED', title(46, CSS.bone, { strokeThickness: 8 })).setOrigin(0.5).setAlpha(0)
      : btn(W / 2, 888, 'Press R to ride again', again, title(40, CSS.bone, { strokeThickness: 7 }));
    this.pageBtn = btn(W / 2 - 300, 928, 'SPACE  THE LEDGER', () => this.flip(), body(22, CSS.sand));
    const sec = won
      ? [this.pageBtn, btn(W / 2, 928, 'R  RIDE AGAIN', again, body(22, CSS.sand)), btn(W / 2 + 300, 928, 'ESC  MENU', menu, body(22, CSS.sand))]
      : [this.pageBtn, btn(W / 2 + 200, 928, 'ESC  MENU', menu, body(22, CSS.sand))];
    if (!won) this.pageBtn.setX(W / 2 - 200);
    const kb = this.input.keyboard;
    this.onKey = (e) => {
      if (e.repeat) return;
      if (e.code === 'KeyR' || e.code === 'Enter' || e.code === 'NumpadEnter') again();
      else if (e.code === 'Escape') menu();
      else if (e.code === 'Space') this.flip();
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (this.page === 2) this.flip(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (this.page === 1) this.flip(); }
      else if (e.code === 'KeyC') this.copySeed();
    };
    kb.on('keydown', this.onKey);
    this.events.once('shutdown', () => kb.off('keydown', this.onKey));
    this.poster = poster;

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
      this.autoT = this.time.delayedCall(4000, () => { if (this.page === 1 && !this.leaving) this.flip(); });
    });
    // let impatient players skip straight to the prompts
    this.time.delayedCall(450, () => { this.ready = true; });
  }

  /** Count a numeric stat up from 0 (value text keeps its original formatting). */
  count(txt, n, final) {
    const o = { v: 0 };
    this.tweens.add({ targets: o, v: n, duration: Math.min(700, 200 + n * 12), ease: 'Cubic.easeOut', onUpdate: () => txt.setText(String(Math.round(o.v))), onComplete: () => txt.setText(final) });
  }

  // ------------------------------------------------------------------------------------------------ helpers
  /** Seed code shown on both pages: DW1-<seed>-<char>-<mode>. */
  code() { return `DW1-${(this.data0.run && this.data0.run.seed) ?? this.data0.seed ?? 0}-${this.char}-${this.mode}`; }

  copySeed() {
    const code = this.code();
    try { navigator.clipboard.writeText(code).then(() => this.note('COPIED'), () => this.note(code)); } catch (e) { this.note(code); }
  }

  note(msg) {
    if (!this.noteT) this.noteT = this.add.text(W / 2, 852, '', body(22, CSS.amber)).setOrigin(0.5).setDepth(50);
    this.noteT.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.noteT);
    this.tweens.add({ targets: this.noteT, alpha: 0, duration: 400, delay: 1400 });
  }

  /** Start data for RIDE AGAIN: same rider and mode; a Daily replays the same date, a contract the same job. */
  rideData() {
    const led = this.led || {};
    const d = { char: this.char, mode: this.mode };
    if (this.mode === 'daily') d.date = (led.daily && led.daily.date) || (this.sum && this.sum.daily && this.sum.daily.date) || undefined;
    if (this.mode === 'contract') d.contract = led.contract || undefined;
    return d;
  }

  /** Mode ribbon + mutator chips on the poster (top-left corner). */
  ribbon(poster) {
    const led = this.led || {};
    let label = null, col = 0xf0a640;
    if (this.mode === 'hell' || led.hell) { label = 'HELL ON EARTH'; col = 0xd63a2a; }
    else if (this.mode === 'daily') label = `DAILY  ${(led.daily && led.daily.date) || ''}`;
    else if (this.mode === 'contract') label = 'CONTRACT';
    let y = 176;
    if (label) { poster.add(chip(this, 290, y, label, { size: 20, stroke: col, fill: col === 0xd63a2a ? 0x4a0e0a : 0x2a1a12 })); y += 42; }
    for (const m of (led.mutators || []).slice(0, 3)) {
      const md = MUTATORS[m];
      if (md) { poster.add(chip(this, 290, y, md.name.toUpperCase(), { size: 16, stroke: 0x6b4423 })); y += 36; }
    }
  }

  flip() {
    if (this.paging || this.leaving || !this.ready) return;
    this.paging = true;
    if (this.autoT) { this.autoT.remove(false); this.autoT = null; }
    uiSfx.move();
    const to = this.page === 1 ? 2 : 1;
    if (to === 2 && !this.ledgerBuilt) this.buildLedger();
    const from = to === 2 ? this.poster : this.ledgerC, into = to === 2 ? this.ledgerC : this.poster;
    this.tweens.add({ targets: from, alpha: 0, duration: 140, onComplete: () => {
      from.setVisible(false);
      into.setVisible(true).setAlpha(0);
      this.tweens.add({ targets: into, alpha: 1, duration: 200, onComplete: () => { this.paging = false; } });
      this.page = to;
      this.pageBtn.setText(to === 2 ? 'SPACE  THE POSTER' : 'SPACE  THE LEDGER');
      if (to === 2) this.animateLedger();
    } });
  }

  // ------------------------------------------------------------------------------------------------ page 2: the ledger
  buildLedger() {
    this.ledgerBuilt = true;
    const cx = W / 2, cy = 462, sum = this.sum, run = this.data0.run, led = this.led || {};
    const L = this.ledgerC = this.add.container(0, 0).setVisible(false);
    L.add(parchment(this, cx, cy, 1250));
    const T = (x, y, str, style, ox = 0.5, oy = 0.5) => { const t = this.add.text(x, y, str, style).setOrigin(ox, oy); L.add(t); return t; };
    const red = '#6a1410';
    const H2 = (x, y, str) => T(x, y, str, title(22, '#5a1a10', { strokeThickness: 0 }), 0, 0.5);
    T(cx, 166, 'THE  LEDGER', title(58, '#2a1810', { stroke: '#c9a56a', strokeThickness: 2 }));
    const rule = this.add.graphics(); rule.lineStyle(3, 0x2a1810, 0.85).lineBetween(cx - 500, 206, cx + 500, 206); L.add(rule);
    if (!sum) { T(cx, 480, 'The books are closed for this ride.', inkText(28, INK, { fontStyle: 'italic' })); return; }

    // ---- left: notoriety
    const lx = 225, lw = 440;
    H2(lx, 240, 'NOTORIETY');
    this.rankT = T(lx + lw, 240, rankFor(sum.oldNp).title.toUpperCase(), inkText(24, red, { fontStyle: 'bold' }), 1, 0.5);
    this.npBar = this.add.graphics(); L.add(this.npBar);
    this.npBar.setPosition(lx, 268);
    this.npTxt = T(lx + lw / 2, 306, '', inkText(18, INK));
    this.barW = lw;
    this.drawNp(sum.oldNp);
    const parts = [['This ride', sum.np.run], ['Deeds', sum.np.ach], ['Contract', sum.np.contract]].filter((r) => r[1]);
    let y = 342;
    for (const [k, v] of parts) {
      const a = T(lx, y, k, inkText(21, INK), 0, 0.5), b = T(lx + lw, y, `+${v} NP`, inkText(21, '#2a5a10', { fontStyle: 'bold' }), 1, 0.5);
      const g = this.add.graphics(); g.fillStyle(0x2a1810, 0.45); for (let x = lx + a.width + 12; x < lx + lw - b.width - 12; x += 9) g.fillRect(x, y + 8, 2.5, 2.5); L.add(g);
      y += 32;
    }
    if (!parts.length) { T(lx, y, 'No notoriety earned.', inkText(20, '#7a6a58', { fontStyle: 'italic' }), 0, 0.5); y += 32; }
    // rank-up stamp
    const st = this.add.container(lx + lw - 80, 404).setAngle(-9).setAlpha(0);
    const stt = this.add.text(0, 0, 'RANK UP', { fontFamily: FONT_TITLE, fontSize: '34px', color: '#2a5a10' }).setOrigin(0.5);
    const sb = this.add.graphics(); sb.lineStyle(5, 0x2a5a10, 1).strokeRoundedRect(-stt.width / 2 - 14, -26, stt.width + 28, 52, 8);
    st.add([sb, stt]); L.add(st);
    this.rankStamp = sum.rankUp ? st : null;

    y = 440;
    H2(lx, y, 'NEW ON THE BOARD'); y += 34;
    const ul = sum.unlocked.slice(0, Math.max(0, 5 - Math.min(3, sum.achievements.length)));
    if (!ul.length && !sum.achievements.length) T(lx, y, 'Nothing new this ride.', inkText(19, '#7a6a58', { fontStyle: 'italic' }), 0, 0.5);
    for (const a of sum.achievements.slice(0, 3)) { L.add(starIcon(this, lx + 16, y, 'tin', 0.24)); T(lx + 40, y, a.name, inkText(20, INK, { fontStyle: 'bold' }), 0, 0.5); T(lx + lw, y, `+${a.np} NP`, inkText(17, '#2a5a10'), 1, 0.5); y += 28; }
    for (const u of ul) { T(lx + 6, y, '+', inkText(22, red, { fontStyle: 'bold' }), 0, 0.5); T(lx + 40, y, `${u.label}`, inkText(20, INK), 0, 0.5); y += 28; }

    // ---- right: contract / daily, floor times, damage, codex
    const rx = 740, rw = 490;
    y = 240;
    const c = sum.contract, d = sum.daily;
    if (c) {
      H2(rx, y, 'CONTRACT');
      T(rx + rw, y, c.completed ? 'COMPLETED' : 'FAILED', inkText(22, c.completed ? '#2a5a10' : '#8a1c14', { fontStyle: 'bold' }), 1, 0.5);
      T(rx, y + 30, `${c.name}${c.first ? '  - first clear!' : ''}${c.hitsOk === false ? '  - too many hits' : ''}`, inkText(19, INK), 0, 0.5);
      y += 64;
    } else if (d) {
      H2(rx, y, `DAILY  ${d.date}`);
      T(rx + rw, y, `SCORE  $${Math.round(d.score).toLocaleString('en-US')}`, inkText(22, red, { fontStyle: 'bold' }), 1, 0.5);
      T(rx, y + 30, `Rank #${d.rank} on this machine   -   streak ${d.streak}`, inkText(19, INK), 0, 0.5);
      y += 64;
    }
    H2(rx, y, 'FLOOR TIMES'); y += 30;
    const ft = (run.floorTimes || []).slice(0, 6), fmax = Math.max(1, ...ft);
    const bars = this.add.graphics(); L.add(bars);
    if (!ft.length) T(rx, y + 8, 'No floors cleared.', inkText(19, '#7a6a58', { fontStyle: 'italic' }), 0, 0.5), y += 30;
    ft.forEach((t, i) => {
      const yy = y + i * 26;
      T(rx, yy, `F${i + 1}`, inkText(17, INK), 0, 0.5);
      bars.fillStyle(0x2a1810, 0.22).fillRect(rx + 34, yy - 8, rw - 110, 16).fillStyle(0x8a1c14, 0.9).fillRect(rx + 34, yy - 8, (rw - 110) * clamp(t / fmax, 0.02, 1), 16).lineStyle(2, 0x2a1810, 0.8).strokeRect(rx + 34, yy - 8, rw - 110, 16);
      T(rx + rw, yy, fmtTime(t), inkText(17, INK), 1, 0.5);
    });
    y += Math.max(1, ft.length) * 26 + 16;
    H2(rx, y, 'HURT BY'); y += 28;
    const dmg = Object.entries(run.damageBySource || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (!dmg.length) T(rx, y, 'Not a scratch.', inkText(19, '#7a6a58', { fontStyle: 'italic' }), 0, 0.5), y += 28;
    for (const [k, v] of dmg) { T(rx, y, causeOf(k), inkText(19, INK), 0, 0.5); T(rx + rw, y, `${v / 2} hearts`, inkText(19, red, { fontStyle: 'bold' }), 1, 0.5); y += 26; }
    y += 10;
    const cn = sum.codexNew.slice(0, 8);
    H2(rx, y, cn.length ? `CODEX  +${sum.codexNew.length}` : 'CODEX'); y += 30;
    if (!cn.length) T(rx, y, 'No new entries.', inkText(19, '#7a6a58', { fontStyle: 'italic' }), 0, 0.5);
    let x = rx, rowY = y;
    for (const e of cn) {
      const ch = chip(this, x, rowY, prettyId(e.id).slice(0, 16), { size: 15, stroke: 0x6b4423, origin: 0, color: CSS.sand });
      if (x > rx && x + ch.w > rx + rw) { x = rx; rowY += 34; ch.setPosition(x + ch.w / 2, rowY); }
      L.add(ch);
      x += ch.w + 8;
    }
    // relics (compact strip)
    const held = new Map();
    for (const id of this.data0.items || []) held.set(id, (held.get(id) || 0) + 1);
    if (held.size) {
      const list = [...held.keys()].slice(0, 18), step = Math.min(56, 1000 / list.length);
      H2(lx, 640, 'RELICS');
      list.forEach((id, i) => {
        L.add(itemIcon(this, lx + 24 + i * step, 696, getItem(id) || { id }, 0.5));
      });
    }
    // seed
    T(cx + 500, 752, `${this.code()}    [C] copy`, inkText(16, '#6b4423'), 1, 0.5);
    this.ledgerC.setDepth(1);
  }

  /** NP bar for a value (drawn for the rank that value belongs to). */
  drawNp(v) {
    const r = rankFor(v), nx = nextRank(v), g = this.npBar, w = this.barW;
    const f = nx ? (v - r.np) / (nx.np - r.np) : 1;
    g.clear();
    g.fillStyle(0x120c0a, 0.75).fillRect(0, 0, w, 18).fillStyle(0xd63a2a, 1).fillRect(1, 1, (w - 2) * clamp(f, 0, 1), 16).lineStyle(2, 0x2a1810, 1).strokeRect(0, 0, w, 18);
    this.rankT.setText(r.title.toUpperCase());
    this.npTxt.setText(`${Math.round(v).toLocaleString('en-US')} NP${nx ? `   -   next: ${nx.title} at ${nx.np.toLocaleString('en-US')}` : '   -   MAX RANK'}`);
    return r.rank;
  }

  animateLedger() {
    const sum = this.sum;
    if (!sum || this.animated) return;
    this.animated = true;
    const o = { v: sum.oldNp };
    let rank = rankFor(sum.oldNp).rank;
    if (sum.newNp <= sum.oldNp) return;
    this.tweens.add({
      targets: o, v: sum.newNp, duration: clamp(500 + (sum.newNp - sum.oldNp) * 1.4, 700, 2400), ease: 'Cubic.easeOut', delay: 250,
      onUpdate: () => { const r = this.drawNp(o.v); if (r > rank) { rank = r; Sfx.play('room_clear', { vol: 0.7 }); } },
      onComplete: () => {
        this.drawNp(sum.newNp);
        if (this.rankStamp) {
          this.rankStamp.setScale(2.4).setAlpha(0);
          this.tweens.add({ targets: this.rankStamp, scale: 1, alpha: 0.9, duration: 160, ease: 'Cubic.easeIn', onComplete: () => { if (Save.settings().shake !== false) this.cameras.main.shake(160, 0.005); Sfx.play('door_close', { vol: 0.8 }); } });
        }
      },
    });
  }
}
