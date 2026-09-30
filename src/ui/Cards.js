// Full-screen cards.
//  * Floor intro ("FLOOR 1" / DRY GULCH / typed subtitle): dark band with accent rules that draw out from the centre, name slams in. Non-blocking (play continues).
//  * Boss intro (2.1 s cutscene): dim + cinematic letterbox bars slide in, portrait rises from the left over a red glow, name slams in with a screen jolt,
//    title fades in under a red rule, everything exits just before the fight starts. Driven by 'floor:intro' / 'boss:intro'.
//    Mini bosses (introData.mini) get the same card with a WANTED poster instead of a portrait and a shorter timeline (payload `ms`).
//    Round 2 (STORY s5.2-5.3): the card types the boss's spoken line under the title (rider overrides from data/story/bosslines.js), runs 2.9 s (Scratch 4.6 s, five
//    Dead Man's Hand cards slam onto the table), any key skips it after 0.8 s; the WANTED poster carries `WANTED FOR: <crime>` and `BOUNTY $n`.
//    Extras on the HUD scene: phase banners ('boss:phase', UPPERCASE 1.2 s), death quips typed over the corpse, floor-start whispers, checkpoint toast (F5/F6; F4's
//    comes from flow.js), and the trapdoor iris / death ink wipe (ui/Transitions.js HudTransitions).
//  * Chapter card ('chapter:intro', blocks input while it shows): CHAPTER II / HELL'S FRONTIER slam + typed tagline over the darkened sky.
//  * Interlude card ('interlude:show', D12): painted panel + typed lines + chapter title between the floor-3 trapdoor and floor 4; skippable after
//    `skipAfter` ms; emits 'interlude:done' when it has faded out (flow.js waits for it, with its own fail-safe timer).
import Assets from '../core/Assets.js';
import { bus } from '../core/events.js';
import { Sfx } from '../core/Audio.js';
import { Save } from '../core/Save.js';
import { subRng } from '../core/rng.js';
import { FONT_TITLE, FONT_BODY, CSS, W, H, FLOORS } from '../config.js';
import { floorSubtitle, pickWhisper, CHAPTER_CARDS, CHECKPOINT_TOAST } from '../data/story/text.js';
import { bossIntro, bossDeath, phaseBanner, miniLines, WANTED_FALLBACK } from '../data/story/bosslines.js';
import { drawSuit, SUIT_COLOR, CARD_SLAM } from '../bosses/parts/scratch/deadMansHand.js';
import { HudTransitions } from './Transitions.js';

const accent = (n) => (FLOORS[n] && FLOORS[n].accent) || 0xd9a04a; // per-floor rule colour lives in FLOORS[n].accent
const BAR_H = 128;
const BOSS_MS = 2100; // GameScene holds the boss cutscene this long (minis: payload.ms)
const BOSS_CARD_MS = 2900; // STORY s5.3: bosses 2.9 s (the card extends GameScene's hold when it is shorter), Scratch 4.6 s
const SCRATCH_CARD_MS = 4600;
const TYPE_CPS = 30; // interlude / chapter typing speed
const LINE_MS = 30; // boss card spoken line: ms per character (faster when the card is short)
const BANNER_HOLD = 1200; // phase banner
const CH1_BOSSES = new Set(['cascabel', 'grimm', 'undertaker']); // their banner keys count phases from 1 (P2 = first change); chapter 2 keys are the emitted phase
const SELF_BANNER = new Set(['toro', 'scratch']); // these bosses announce their own phases (Room.banner / fx.text bark)
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
/** Shrink a text object's font until it fits `maxW` (long names such as THE LAST CHANCE SALOON). */
const fit = (txt, maxW, size, min = 44) => { txt.setFontSize(size); while (txt.width > maxW && size > min) txt.setFontSize(size -= 4); };

export default class Cards {
  constructor(hud) {
    this.hud = hud;
    // ---- floor card
    this.floor = hud.add.container(0, 0).setDepth(80).setAlpha(0);
    this.fBand = hud.add.rectangle(W / 2, 470, W, 210, 0x0d0806, 0.82);
    this.fRuleT = hud.add.rectangle(W / 2, 365, W, 3, 0xd9a04a).setScale(0, 1);
    this.fRuleB = hud.add.rectangle(W / 2, 575, W, 3, 0xd9a04a).setScale(0, 1);
    this.fLine = hud.add.text(W / 2, 416, '', { fontFamily: FONT_BODY, fontSize: '28px', color: CSS.amber, stroke: '#120c0a', strokeThickness: 5 }).setOrigin(0.5);
    this.fLine.setLetterSpacing(10);
    this.fName = hud.add.text(W / 2, 486, '', { fontFamily: FONT_TITLE, fontSize: '92px', color: CSS.bone, stroke: '#120c0a', strokeThickness: 12 }).setOrigin(0.5);
    this.fSub = hud.add.text(W / 2, 550, '', { fontFamily: FONT_BODY, fontSize: '27px', color: CSS.sand, stroke: '#120c0a', strokeThickness: 5, fontStyle: 'italic' }).setOrigin(0.5);
    this.floor.add([this.fBand, this.fRuleT, this.fRuleB, this.fLine, this.fName, this.fSub]);
    // ---- boss card
    this.boss = hud.add.container(0, 0).setDepth(90).setAlpha(0).setVisible(false);
    this.bDim = hud.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6);
    this.bTint = hud.add.rectangle(W / 2, H / 2, W, H, 0x5a0808, 0.22);
    this.bBarT = hud.add.rectangle(W / 2, 0, W, BAR_H, 0x000000, 1).setOrigin(0.5, 1);
    this.bBarB = hud.add.rectangle(W / 2, H, W, BAR_H, 0x000000, 1).setOrigin(0.5, 0);
    this.bRedT = hud.add.rectangle(W / 2, 0, W, 4, 0x8a1c1c).setOrigin(0.5, 1);
    this.bRedB = hud.add.rectangle(W / 2, H, W, 4, 0x8a1c1c).setOrigin(0.5, 0);
    this.bGlow = hud.add.image(330, 480, 'glow').setScale(7).setTint(0xb01810).setAlpha(0.55).setBlendMode('ADD');
    this.bPortrait = null;
    this.bTag = hud.add.text(940, 388, 'BOSS', { fontFamily: FONT_BODY, fontSize: '26px', color: CSS.amber, stroke: '#120c0a', strokeThickness: 5 }).setOrigin(0.5);
    this.bTag.setLetterSpacing(14);
    this.bName = hud.add.text(940, 462, '', { fontFamily: FONT_TITLE, fontSize: '80px', color: CSS.bone, stroke: '#120c0a', strokeThickness: 11, align: 'center' }).setOrigin(0.5);
    this.bRule = hud.add.rectangle(940, 526, 560, 4, 0xb01810).setScale(0, 1);
    this.bTitle = hud.add.text(940, 566, '', { fontFamily: FONT_BODY, fontSize: '34px', color: CSS.hell, stroke: '#120c0a', strokeThickness: 6, fontStyle: 'italic' }).setOrigin(0.5);
    this.boss.add([this.bDim, this.bTint, this.bGlow, this.bBarT, this.bBarB, this.bRedT, this.bRedB, this.bTag, this.bName, this.bRule, this.bTitle]);
    this.bSmall = hud.add.text(940, 612, '', { fontFamily: FONT_BODY, fontSize: '22px', color: CSS.sand, stroke: '#120c0a', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setAlpha(0);
    this.boss.add(this.bSmall);
    // spoken lines (typed under the title; the second row is Scratch's rider line on a clean Hell ride)
    this.bSpeak = hud.add.text(940, 606, '', { fontFamily: FONT_BODY, fontSize: '26px', color: CSS.bone, stroke: '#120c0a', strokeThickness: 5, align: 'center', wordWrap: { width: 800 }, fontStyle: 'italic' }).setOrigin(0.5, 0);
    this.bSpeak2 = hud.add.text(940, 700, '', { fontFamily: FONT_BODY, fontSize: '26px', color: CSS.sand, stroke: '#120c0a', strokeThickness: 5, align: 'center', wordWrap: { width: 800 }, fontStyle: 'italic' }).setOrigin(0.5, 0);
    this.boss.add([this.bSpeak, this.bSpeak2]);
    this.slam = null; // Scratch's five cards (built on first use)
    this.bossTimers = [];
    this.bossLive = false;
    this.bossBorn = 0;
    this.bossMs0 = 0;
    this.holdFrom = 0; this.holdUntil = 0; this.holdSet = false;
    this.typeTimer = null;
    this.buildChapter();
    this.buildInterlude();
    this.buildExtras();
    this.tr = new HudTransitions(hud);
    bus.scoped(hud, 'floor:intro', (p) => this.showFloor(p));
    bus.scoped(hud, 'boss:intro', (p) => this.showBoss(p));
    bus.scoped(hud, 'chapter:intro', (p) => this.showChapter(p));
    bus.scoped(hud, 'interlude:show', (p) => this.showInterlude(p));
    bus.scoped(hud, 'room:transition', () => this.hideBoss()); // leaving mid-card (debug jump) must not leave the boss card stuck
    bus.scoped(hud, 'boss:phase', (p) => this.onPhase(p));
    bus.scoped(hud, 'boss:spawned', (p) => this.onBossSpawned(p));
    bus.scoped(hud, 'enemy:died', (p) => { if (p && p.mini) this.miniPos = { x: p.x, y: p.y }; });
    bus.scoped(hud, 'boss:defeated', (p) => this.onBossDefeated(p));
    bus.scoped(hud, 'mini:defeated', (p) => this.onMiniDefeated(p));
    bus.scoped(hud, 'checkpoint:saved', (p) => this.onCheckpoint(p));
    this._skip = () => this.skipBoss();
    hud.input.keyboard.on('keydown', this._skip);
    hud.input.on('pointerdown', this._skip);
  }

  get g() { return this.hud.g; }

  hideBoss() {
    const h = this.hud;
    h.tweens.killTweensOf([this.boss, this.bPortrait, this.bName, this.bTitle, this.bRule, this.bBarT, this.bBarB, this.bRedT, this.bRedB, this.bGlow].filter(Boolean));
    this.clearBossTimers();
    if (this.slam) for (const c of this.slam.cards) { h.tweens.killTweensOf(c); c.setVisible(false); }
    this.boss.setAlpha(0).setVisible(false);
    this.bossLive = false;
    this.releaseHold();
  }

  clearBossTimers() {
    this.bossTimers.length = 0; // entries are plain {at, fn} / {txt, str, t0, per, n}: dropping them cancels them
  }

  /** Type `str` into `txt`, `per` ms per character after `delay` ms. Driven from update() on the scene clock (like the tweens), so it stays in step on a slow machine; hideBoss / skip cancel it. */
  typeBoss(txt, str, delay, per) {
    const t = { txt, str, t0: this.hud.time.now + delay, per, n: 0 };
    this.bossTimers.push(t);
    return t;
  }

  stepType(e, now) {
    if (!e || now < e.t0) return;
    const n = Math.min(e.str.length, 1 + Math.floor((now - e.t0) / e.per));
    if (n !== e.n) { e.n = n; e.txt.setText(e.str.slice(0, n)); }
  }

  // -------------------------------------------------------------------------------------------------------- floor card
  showFloor(p) {
    if (this.bossLive) return;
    const h = this.hud;
    const g = this.g;
    const col = accent(p.floor);
    this.fRuleT.setFillStyle(col); this.fRuleB.setFillStyle(col);
    this.fLine.setText(`FLOOR ${p.floor}`).setColor(hex(col));
    this.fName.setText(p.name);
    fit(this.fName, W - 200, 92);
    this.fSub.setText('');
    h.tweens.killTweensOf([this.floor, this.fName, this.fRuleT, this.fRuleB, this.fLine]);
    this.typeTimer = null;
    this.floor.setAlpha(0);
    this.fRuleT.setScale(0, 1); this.fRuleB.setScale(0, 1);
    this.fName.setScale(1.45).setAlpha(0);
    this.fLine.setAlpha(0).setY(430);
    h.tweens.add({ targets: this.floor, alpha: 1, duration: 260 });
    h.tweens.add({ targets: [this.fRuleT, this.fRuleB], scaleX: 1, duration: 520, ease: 'Cubic.easeOut' });
    h.tweens.add({ targets: this.fLine, alpha: 1, y: 416, duration: 380, delay: 120, ease: 'Cubic.easeOut' });
    h.tweens.add({ targets: this.fName, scale: 1, alpha: 1, duration: 420, delay: 220, ease: 'Cubic.easeOut' });
    Sfx.play('spawn', { vol: 0.45, rate: 0.7, gap: 0 });
    // typed subtitle: primary, or the alt line on rides >= 3 (seeded per floor, never the gameplay stream), or the Hell line
    let sub = p.subtitle || '';
    try {
      const runs = (Save.get().stats && Save.get().stats.runs) || 0;
      sub = floorSubtitle(p.floor, { hell: !!(g && g.run && g.run.mode === 'hell'), runs, rng: subRng('floorcard', p.floor) }) || sub;
    } catch (e) { /* the FLOORS subtitle stays */ }
    this.typeTimer = { txt: this.fSub, str: sub, t0: h.time.now + 600, per: 34, n: 0 };
    h.tweens.add({ targets: this.floor, alpha: 0, delay: 2500, duration: 600 });
  }

  /** WANTED poster for mini bosses: parchment, the mini's sprite (placeholder when the art is missing), WANTED FOR small print, bounty. Sized like a portrait. */
  makePoster(p) {
    const h = this.hud;
    const c = h.add.container(330, 470).setSize(400, 520);
    const paper = h.add.rectangle(0, 0, 380, 500, 0xd8c39a, 0.97).setStrokeStyle(6, 0x6b4423);
    const inner = h.add.rectangle(0, 0, 340, 460).setStrokeStyle(2, 0x6b4423, 0.7);
    const head = h.add.text(0, -200, 'WANTED', { fontFamily: FONT_TITLE, fontSize: '62px', color: '#3a1c10' }).setOrigin(0.5);
    const id = (p.boss && p.boss.id) || '';
    const pic = Assets.makeImage(h, 0, -50, `enemy_${id}`);
    pic.setScale(230 / Math.max(pic.width, pic.height, 1));
    const crime = p.wantedFor || (miniLines(id) && miniLines(id).wantedFor) || WANTED_FALLBACK;
    const small = h.add.text(0, 96, `WANTED FOR: ${crime}`, { fontFamily: FONT_BODY, fontSize: '20px', color: '#3a1c10', align: 'center', wordWrap: { width: 318 } }).setOrigin(0.5, 0);
    const foot = h.add.text(0, 190, 'DEAD OR ALIVE', { fontFamily: FONT_BODY, fontSize: '24px', color: '#3a1c10' }).setOrigin(0.5);
    const rew = h.add.text(0, 220, `BOUNTY $${p.bounty || 0}`, { fontFamily: FONT_TITLE, fontSize: '22px', color: '#6b1a12' }).setOrigin(0.5);
    c.add([paper, inner, head, pic, small, foot, rew]);
    return c;
  }

  /** Scratch's five-card slam (STORY s5.3): built once, code-drawn 60x84 rounded rects with a suit glyph, the fifth face-down. */
  buildSlam(cfg) {
    const h = this.hud;
    const cw = cfg.w || 60, ch = cfg.h || 84;
    const felt = h.add.ellipse(W / 2, 792, 560, 96, 0x143020, 0.75).setVisible(false);
    this.boss.add(felt);
    const cards = [];
    for (let i = 0; i < cfg.cards.length; i++) {
      const def = cfg.cards[i];
      const c = h.add.container(0, 0).setVisible(false);
      const g = h.add.graphics();
      g.fillStyle(0x000000, 0.35).fillRoundedRect(-cw / 2 + 3, -ch / 2 + 5, cw, ch, 7);
      if (def.faceDown) {
        g.fillStyle(0x7a1a14, 1).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 7);
        g.lineStyle(2, 0xe8dcc0, 0.9).strokeRoundedRect(-cw / 2 + 5, -ch / 2 + 5, cw - 10, ch - 10, 4);
        g.lineStyle(2, 0xe8dcc0, 0.55);
        for (let k = -3; k <= 3; k++) { g.lineBetween(-cw / 2 + 5, k * 11 - 14, cw / 2 - 5, k * 11 + 14); }
        g.lineStyle(3, 0x120c0a, 1).strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 7);
        c.add(g);
      } else {
        g.fillStyle(0xe8dcc0, 1).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 7);
        g.lineStyle(3, 0x120c0a, 1).strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 7);
        drawSuit(g, def.suit, 0, 8, 15, SUIT_COLOR[def.suit] || 0x1a1418);
        drawSuit(g, def.suit, -cw / 2 + 12, -ch / 2 + 32, 5, SUIT_COLOR[def.suit] || 0x1a1418);
        const rk = h.add.text(-cw / 2 + 12, -ch / 2 + 15, def.rank, { fontFamily: FONT_TITLE, fontSize: '22px', color: '#1a1418' }).setOrigin(0.5);
        c.add([g, rk]);
      }
      this.boss.add(c);
      cards.push(c);
    }
    this.slam = { cards, felt, cfg };
  }

  showBoss(p) {
    const h = this.hud;
    this.hideBoss();
    h.tweens.killTweensOf([this.floor, this.fName, this.fRuleT, this.fRuleB, this.fLine]); // a lingering floor card must not show through
    this.typeTimer = null;
    this.floor.setAlpha(0);
    if (this.bPortrait) { this.bPortrait.destroy(); this.bPortrait = null; }
    const g = this.g;
    const mini = !!p.mini;
    const ms0 = p.ms || BOSS_MS;
    const ms = mini ? ms0 : Math.max(ms0, p.slam ? SCRATCH_CARD_MS : BOSS_CARD_MS);
    const k = ms / BOSS_MS; // minis run a shorter timeline: every delay scales with it
    const id = (p.boss && p.boss.id) || '';
    this.bossLive = true;
    this.bossBorn = h.time.now;
    this.bossMs0 = ms0;
    if (ms > ms0 && g) { this.holdFrom = h.time.now + ms0 - 40; this.holdUntil = h.time.now + ms; } // GameScene's hold is shorter than the card: keep the world frozen
    else { this.holdFrom = this.holdUntil = 0; }
    this.bPortrait = mini ? this.makePoster(p) : Assets.makeImage(h, 330, 470, p.portrait || 'portrait_player');
    const sc = 600 / Math.max(this.bPortrait.height, 1);
    this.bPortrait.setScale(sc).setAlpha(0);
    this.boss.add(this.bPortrait);
    for (const t of [this.bTag, this.bName, this.bTitle, this.bSmall, this.bSpeak, this.bSpeak2]) this.boss.bringToTop(t);
    this.bTag.setText(mini ? 'MINI BOSS' : 'BOSS');
    this.bName.setText(p.name);
    fit(this.bName, 740, 80, 44); // one line always: EL TORO INFERNAL / THE UNDERTAKER shrink instead of wrapping over the rule
    this.bTitle.setText(p.title);
    this.bSmall.setText('').setAlpha(0);
    this.bSpeak.setText(''); this.bSpeak2.setText('');
    this.boss.setVisible(true).setAlpha(0);
    this.bBarT.setY(0); this.bBarB.setY(H); this.bRedT.setY(0); this.bRedB.setY(H);
    this.bRule.setScale(0, 1);
    this.bName.setAlpha(0).setScale(1.7);
    this.bTitle.setAlpha(0); this.bTag.setAlpha(0);
    this.bPortrait.x = 130;
    this.bGlow.setAlpha(0);
    const d = (t) => t * k;
    h.tweens.add({ targets: this.boss, alpha: 1, duration: 220 * k });
    h.tweens.add({ targets: [this.bBarT, this.bRedT], y: BAR_H, duration: 320 * k, ease: 'Cubic.easeOut' });
    h.tweens.add({ targets: [this.bBarB, this.bRedB], y: H - BAR_H, duration: 320 * k, ease: 'Cubic.easeOut' });
    h.tweens.add({ targets: this.bPortrait, x: 330, alpha: 1, duration: d(620), delay: d(120), ease: 'Cubic.easeOut' });
    h.tweens.add({ targets: this.bPortrait, scale: { from: sc * 1.12, to: sc }, duration: d(1800), delay: d(120), ease: 'Sine.easeOut' });
    h.tweens.add({ targets: this.bGlow, alpha: 0.55, duration: d(700), delay: d(100) });
    h.tweens.add({ targets: this.bTag, alpha: 1, duration: d(300), delay: d(420) });
    // the name slam and rule stay on the classic 2.1 s timeline whatever the card length (long cards spend the extra time on the spoken line)
    const kn = mini ? k : 1;
    h.tweens.add({
      targets: this.bName, scale: 1, alpha: 1, duration: 320 * kn, delay: 480 * kn, ease: 'Cubic.easeIn',
      onStart: () => { bus.emit('hud:flash', { color: 0xd63a2a, alpha: mini ? 0.35 : 0.6 }); if (Save.settings().shake !== false) h.cameras.main.shake(260, mini ? 0.003 : 0.006); },
    });
    h.tweens.add({ targets: this.bRule, scaleX: 1, duration: 420 * kn, delay: 760 * kn, ease: 'Cubic.easeOut' });
    h.tweens.add({ targets: this.bTitle, alpha: 1, duration: 420 * kn, delay: 880 * kn });
    const exit = ms - 350; // the card leaves shortly before the fight starts
    if (!mini) this.speakLines(p, id, exit);
    if (!mini && p.slam) this.slamCards(p.slam || CARD_SLAM);
    h.tweens.add({ targets: [this.bBarT, this.bRedT], y: 0, duration: 260, delay: ms - 310, ease: 'Cubic.easeIn' });
    h.tweens.add({ targets: [this.bBarB, this.bRedB], y: H, duration: 260, delay: ms - 310, ease: 'Cubic.easeIn' });
    h.tweens.add({ targets: this.boss, alpha: 0, delay: exit, duration: 330, onComplete: () => { this.boss.setVisible(false); this.bossLive = false; } });
  }

  /** The boss's spoken line(s) under the title: rider override / true-eligible Scratch, typed at up to 30 ms per character but always finished before the exit. */
  speakLines(p, id, exit) {
    const g = this.g, run = g && g.run;
    const char = p.char || (run && run.char) || 'gunslinger';
    const trueEligible = p.trueEligible ?? !!(run && run.trueEligible);
    const t = bossIntro(id, { char, trueEligible });
    if (!t || !t.line) return;
    const start = p.slam ? 1900 : 1000;
    const per = (str, from) => Math.min(LINE_MS, Math.max(8, (exit - 250 - from) / Math.max(1, str.length)));
    this.typeBoss(this.bSpeak, t.line, start, per(t.line, start));
    if (t.extra) {
      const at = start + (t.extraDelay || 1400);
      this.bSpeak2.setY(this.bSpeak.y + 42 + (t.line.length > 62 ? 30 : 0));
      this.typeBoss(this.bSpeak2, t.extra, at, per(t.extra, at));
    }
  }

  /** Five cards slam onto the table 0.28 s apart (card_flip each), bottom-centre above the letterbox bar. */
  slamCards(cfg) {
    const h = this.hud;
    if (!this.slam || this.slam.cfg.cards.length !== cfg.cards.length) {
      if (this.slam) { for (const c of this.slam.cards) c.destroy(); this.slam.felt.destroy(); }
      this.buildSlam(cfg);
    }
    const { cards, felt } = this.slam;
    const gap = 78, y0 = 786, tilt = [-5, 3, -2, 5, -3];
    felt.setVisible(true).setAlpha(0);
    h.tweens.add({ targets: felt, alpha: 0.75, duration: 300, delay: 700 });
    cards.forEach((c, i) => {
      c.setVisible(false).setPosition(W / 2 + (i - (cards.length - 1) / 2) * gap, y0).setAngle(tilt[i % tilt.length]).setScale(1).setAlpha(1);
      const at = 900 + i * (cfg.gap || 0.28) * 1000;
      this.bossTimers.push({ at: h.time.now + at, fn: () => {
        if (!this.bossLive) return;
        c.setVisible(true).setScale(1.9).setAlpha(0).setY(y0 - 70);
        h.tweens.add({
          targets: c, scale: 1, alpha: 1, y: y0, duration: 120, ease: 'Cubic.easeIn',
          onComplete: () => { if (Save.settings().shake !== false) h.cameras.main.shake(90, 0.0035); },
        });
        Sfx.play(cfg.sfx || 'card_flip', { vol: 0.8, rate: 0.9 + i * 0.05, gap: 0 });
      } });
    });
  }

  /** Any key / click ends the card early (after 0.8 s). The fight itself still starts on GameScene's clock, so the freeze only shortens when we extended it. */
  skipBoss() {
    const h = this.hud;
    if (!this.bossLive || h.time.now - this.bossBorn < 800) return;
    this.bossLive = false;
    h.tweens.killTweensOf([this.boss, this.bBarT, this.bBarB, this.bRedT, this.bRedB]);
    this.clearBossTimers();
    if (this.holdUntil && h.time.now >= this.bossMs0) this.releaseHold(); // GameScene has already started the fight: do not keep it frozen
    else if (this.holdUntil) this.holdUntil = this.bossBorn + this.bossMs0; // shorten our extension to GameScene's own hold
    h.tweens.add({ targets: [this.bBarT, this.bRedT], y: 0, duration: 180, ease: 'Cubic.easeIn' });
    h.tweens.add({ targets: [this.bBarB, this.bRedB], y: H, duration: 180, ease: 'Cubic.easeIn' });
    h.tweens.add({ targets: this.boss, alpha: 0, duration: 200, onComplete: () => this.boss.setVisible(false) });
  }

  /** Release the extended world freeze (only if this card set it). */
  releaseHold() {
    if (this.holdSet && this.g && !this.g.ended) this.g.cutscene = false;
    this.holdSet = false;
    this.holdFrom = this.holdUntil = 0;
  }

  // -------------------------------------------------------------------------------------------------------- chapter card
  buildChapter() {
    const h = this.hud;
    this.chapter = h.add.container(0, 0).setDepth(95).setAlpha(0).setVisible(false);
    // painted sky when the art exists, else a flat ember-red field (no placeholder label on a title card)
    this.cSky = Assets.has('title_l0_sky') ? Assets.makeImage(h, W / 2, H / 2, 'title_l0_sky').setDisplaySize(W, H).setTint(0xff5a2a) : h.add.rectangle(W / 2, H / 2, W, H, 0x4a1408, 1);
    this.cDim = h.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55);
    this.cLine = h.add.text(W / 2, 360, '', { fontFamily: FONT_BODY, fontSize: '34px', color: CSS.amber, stroke: '#120c0a', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(16);
    this.cName = h.add.text(W / 2, 470, '', { fontFamily: FONT_TITLE, fontSize: '84px', color: CSS.bone, stroke: '#120c0a', strokeThickness: 12, align: 'center' }).setOrigin(0.5);
    this.cRule = h.add.rectangle(W / 2, 546, 620, 4, 0xd63a2a).setScale(0, 1);
    this.cTag = h.add.text(W / 2, 596, '', { fontFamily: FONT_BODY, fontSize: '30px', color: CSS.sand, stroke: '#120c0a', strokeThickness: 5, fontStyle: 'italic' }).setOrigin(0.5);
    this.chapter.add([this.cSky, this.cDim, this.cLine, this.cName, this.cRule, this.cTag]);
    this.chapTimer = null;
  }

  showChapter(p) {
    const h = this.hud;
    const ms = p.ms || 3600;
    const cc = CHAPTER_CARDS[p.chapter] || {};
    const roman = ['', 'I', 'II', 'III'][p.chapter] || String(p.chapter);
    h.tweens.killTweensOf([this.chapter, this.cName, this.cRule]);
    if (this.chapTimer) { this.chapTimer.remove(false); this.chapTimer = null; }
    if (cc.tint != null && typeof this.cSky.setTint === 'function') this.cSky.setTint(cc.tint);
    this.cLine.setText(cc.line || `CHAPTER ${roman}`).setAlpha(0);
    this.cName.setText(p.name || cc.name || '').setAlpha(0).setScale(1.4);
    fit(this.cName, W - 160, 84);
    this.cTag.setText('');
    this.cRule.setScale(0, 1);
    this.chapter.setVisible(true).setAlpha(0);
    h.tweens.add({ targets: this.chapter, alpha: 1, duration: 500 });
    h.tweens.add({ targets: this.cLine, alpha: 1, duration: 500, delay: 250 });
    h.tweens.add({
      targets: this.cName, alpha: 1, scale: 1, duration: 340, delay: 900, ease: 'Cubic.easeIn',
      onStart: () => { Sfx.play('boss_intro', { vol: 0.6, rate: 0.8, gap: 0 }); if (Save.settings().shake !== false) h.cameras.main.shake(220, 0.004); },
    });
    h.tweens.add({ targets: this.cRule, scaleX: 1, duration: 420, delay: 1300, ease: 'Cubic.easeOut' });
    this.chapTimer = this.typeText(this.cTag, p.tagline || cc.tagline || '', 1500);
    h.tweens.add({ targets: this.chapter, alpha: 0, duration: 500, delay: ms - 500, onComplete: () => this.chapter.setVisible(false) });
  }

  /** Type `str` into `txt` at TYPE_CPS after `delay` ms; returns the timer (call .remove to stop). `onDone` runs after the last character. */
  typeText(txt, str, delay = 0, onDone) {
    let n = 0;
    const cps = 1000 / TYPE_CPS;
    return this.hud.time.addEvent({
      delay: cps, startAt: -delay, repeat: str.length,
      callback: () => { n++; txt.setText(str.slice(0, n)); if (n >= str.length && onDone) onDone(); },
    });
  }

  // -------------------------------------------------------------------------------------------------------- interlude card
  buildInterlude() {
    const h = this.hud;
    this.inter = h.add.container(0, 0).setDepth(100).setAlpha(0).setVisible(false);
    this.iBack = h.add.rectangle(W / 2, H / 2, W, H, 0x050302, 1);
    this.iArt = Assets.has('img_interlude_ch2') ? Assets.makeImage(h, W / 2, H / 2, 'img_interlude_ch2').setDisplaySize(W, H) : h.add.rectangle(W / 2, H / 2 - 120, W, H - 240, 0x2a0d08, 1);
    this.iShade = h.add.rectangle(W / 2, 800, W, 320, 0x000000, 0.55);
    this.iText = h.add.text(W / 2, 730, '', { fontFamily: FONT_BODY, fontSize: '32px', color: CSS.amber, stroke: '#120c0a', strokeThickness: 5, align: 'center', wordWrap: { width: 1100 }, lineSpacing: 10 }).setOrigin(0.5);
    this.iTitle = h.add.text(W / 2, 866, '', { fontFamily: FONT_TITLE, fontSize: '64px', color: CSS.bone, stroke: '#120c0a', strokeThickness: 10 }).setOrigin(0.5).setAlpha(0);
    this.inter.add([this.iBack, this.iArt, this.iShade, this.iText, this.iTitle]);
    this.interState = null;
  }

  showInterlude(p) {
    const h = this.hud;
    this.stopInterlude();
    const text = (p.lines || []).join('\n');
    const st = this.interState = { born: h.time.now, skipAt: p.skipAfter ?? 1200, finished: false, timers: [] };
    this.iText.setText('');
    this.iTitle.setText(p.title || '').setAlpha(0);
    this.inter.setVisible(true).setAlpha(0);
    h.tweens.add({ targets: this.inter, alpha: 1, duration: 700 });
    st.timers.push(this.typeText(this.iText, text, 900));
    st.timers.push(h.time.delayedCall(900 + (text.length / TYPE_CPS) * 1000 + 400, () => h.tweens.add({ targets: this.iTitle, alpha: 1, duration: 600 })));
    st.timers.push(h.time.delayedCall(p.ms || 6500, () => this.endInterlude(true)));
    const skip = () => { if (this.interState === st && h.time.now - st.born >= st.skipAt) { this.iText.setText(text); this.iTitle.setAlpha(1); this.endInterlude(true, 250); } };
    st.skip = skip;
    h.input.keyboard.on('keydown', skip);
    h.input.on('pointerdown', skip);
  }

  /** Stop the interlude's timers and input listeners (no tweens: safe while the HUD scene shuts down). */
  stopInterlude() {
    const st = this.interState;
    if (!st || st.finished) return null;
    st.finished = true;
    for (const t of st.timers) t.remove(false);
    this.hud.input.keyboard.off('keydown', st.skip);
    this.hud.input.off('pointerdown', st.skip);
    return st;
  }

  /** Fade the interlude out; `announce` fires 'interlude:done' (flow.js continues with the cutscene / floor load) after the fade. */
  endInterlude(announce, wait = 0) {
    if (!this.stopInterlude()) return;
    this.hud.tweens.add({
      targets: this.inter, alpha: 0, duration: 500, delay: wait,
      onComplete: () => { this.inter.setVisible(false); this.interState = null; if (announce) bus.emit('interlude:done', {}); },
    });
  }

  // -------------------------------------------------------------------------------------------------------- phase banners, quips, whispers, toast
  buildExtras() {
    const h = this.hud;
    const txt = (size, color, extra = {}) => h.add.text(W / 2, 0, '', { fontFamily: FONT_BODY, fontSize: `${size}px`, color, stroke: '#120c0a', strokeThickness: 5, align: 'center', ...extra }).setOrigin(0.5).setAlpha(0);
    this.pBanner = h.add.text(W / 2, 262, '', { fontFamily: FONT_TITLE, fontSize: '44px', color: CSS.bone, stroke: '#120c0a', strokeThickness: 8, align: 'center' }).setOrigin(0.5).setDepth(84).setAlpha(0);
    this.quip = txt(32, CSS.bone, { fontStyle: 'italic', wordWrap: { width: 720 }, strokeThickness: 6 }).setDepth(85);
    this.quipTimer = null;
    this.whisper = txt(26, CSS.sand, { fontStyle: 'italic', wordWrap: { width: 1000 } }).setDepth(60).setPosition(W / 2, 900);
    this.cpToast = txt(26, '#d8c39a').setDepth(61).setPosition(W / 2, 176);
    this.whispered = new Set(); // floors that already whispered this ride
    this.lastRoom = null;
    this.whisperTimer = null;
    this.miniPos = null;
  }

  /** Fade a pooled text in, hold, fade out. */
  flashText(t, text, { hold = 2000, color, y } = {}) {
    const h = this.hud;
    h.tweens.killTweensOf(t);
    t.setText(text).setAlpha(0);
    if (color) t.setColor(color);
    if (y != null) t.setY(y);
    h.tweens.add({ targets: t, alpha: 1, duration: 220, onComplete: () => { h.tweens.add({ targets: t, alpha: 0, delay: hold, duration: 420 }); } });
  }

  showPhaseBanner(text, color = CSS.bone) {
    if (!text) return;
    const t = this.pBanner;
    t.setFontSize(text.length > 20 ? 38 : 44);
    this.flashText(t, text, { hold: BANNER_HOLD, color });
  }

  /** boss:phase {phase, boss}: Chapter 1 bosses and Engine No. 666 get their STORY s7.3 banner; minis get theirs (7.4). Toro / Scratch announce themselves. */
  onPhase(p) {
    const b = p && p.boss;
    if (!b || b.selfBanner || SELF_BANNER.has(b.id)) return;
    const n = p.phase | 0;
    let text = null;
    if (b.meta && b.meta.mini) { const m = miniLines(b.id); text = m && m.banner; } // one phase change, 50 %
    else if (CH1_BOSSES.has(b.id)) text = phaseBanner(b.id, n + 1);
    else if (b.id === 'engine') text = n === 2 ? phaseBanner('engine', 2) : null; // P1 "ALL ABOARD THE DEAD" is the fight-start bark (onBossSpawned)
    else text = phaseBanner(b.id, n);
    this.showPhaseBanner(text, b.meta && b.meta.mini ? CSS.amber : CSS.hell);
  }

  onBossSpawned(p) {
    const b = p && p.boss;
    if (b && b.id === 'engine' && !b.selfBanner) this.showPhaseBanner(phaseBanner('engine', 1), CSS.hell);
  }

  /** Death quip typed over the corpse: bone italic 32 px, gone after `hold` ms. Returns the typed length in ms (0 when there is none). */
  showQuip(text, x, y, hold = 3000) {
    if (!text) return 0;
    const h = this.hud;
    this.quipTimer = null;
    h.tweens.killTweensOf(this.quip);
    const cx = Math.max(400, Math.min(W - 400, x)), cy = Math.max(190, Math.min(H - 220, y - 130));
    this.quip.setText('').setAlpha(1).setPosition(cx, cy);
    const per = 30;
    this.quipTimer = { txt: this.quip, str: text, t0: h.time.now + 300, per, n: 0 };
    h.tweens.add({ targets: this.quip, alpha: 0, delay: hold, duration: 500 });
    bus.emit('boss:quip', { text, ms: hold + 500 }); // ending.js may hold the finale until it has been read
    return hold + 500;
  }

  onBossDefeated(p) {
    const b = p && p.boss;
    if (!b) return;
    const run = this.g && this.g.run;
    const t = bossDeath(b.id || p.id, { char: (run && run.char) || 'gunslinger', trueEligible: !!(run && run.trueEligible) });
    this.showQuip(t, b.x || W / 2, b.y || H / 2, 3000);
  }

  onMiniDefeated(p) {
    const m = miniLines(p && p.id);
    if (!m) return;
    const pos = this.miniPos || { x: W / 2, y: H / 2 };
    this.showQuip(m.death, pos.x, pos.y, 2000);
  }

  /** Checkpoint toast for F5 / F6 (F4's is flow.js's `ui:toast`, shown with THE HEAT WELCOMES YOU). */
  onCheckpoint(p) {
    if (!p || p.floor < 5) return;
    this.hud.time.delayedCall(1500, () => this.flashText(this.cpToast, CHECKPOINT_TOAST, { hold: 1000 }));
  }

  /** One whisper on the first entry to each floor's Start room (seeded, never the gameplay stream), non-blocking. */
  checkWhisper(g) {
    const room = g.room;
    if (room === this.lastRoom) return;
    this.lastRoom = room;
    if (!room || room.type !== 'start' || this.whispered.has(g.floorNum) || (g.roomMgr && g.roomMgr.inPocket)) return;
    this.whispered.add(g.floorNum);
    const floor = g.floorNum;
    if (this.whisperTimer) this.whisperTimer.remove(false);
    this.whisperTimer = this.hud.time.delayedCall(1300, () => {
      this.whisperTimer = null;
      if (this.g.floorNum !== floor || this.g.ended) return;
      const text = pickWhisper(floor, (this.g.run && this.g.run.char) || 'gunslinger', subRng('whisper', floor));
      if (text) this.flashText(this.whisper, text, { hold: 2500 });
    });
  }

  update(g) {
    if (!g) return;
    this.checkWhisper(g);
    this.tr.update(g);
    const now = this.hud.time.now;
    this.stepType(this.typeTimer, now);
    this.stepType(this.quipTimer, now);
    const bt = this.bossTimers;
    for (let i = 0; i < bt.length; i++) {
      const e = bt[i];
      if (e.fn) { if (now >= e.at) { e.at = Infinity; e.fn(); } } else this.stepType(e, now);
    }
    if (this.holdUntil) { // keep the world frozen while a long boss card is still up (GameScene's own hold ended at the shorter time)
      const now = this.hud.time.now;
      if (now >= this.holdUntil) this.releaseHold();
      else if (now >= this.holdFrom && !g.ended && g.player && !g.player.dead) { if (!g.cutscene) { g.cutscene = true; this.holdSet = true; } }
    }
  }

  destroy() {
    if (this.chapTimer) this.chapTimer.remove(false);
    if (this.whisperTimer) this.whisperTimer.remove(false);
    this.clearBossTimers();
    this.releaseHold();
    this.stopInterlude();
    this.hud.input.keyboard.off('keydown', this._skip);
    this.hud.input.off('pointerdown', this._skip);
    this.tr.destroy();
    this.floor.destroy(); this.boss.destroy(); this.chapter.destroy(); this.inter.destroy();
    this.pBanner.destroy(); this.quip.destroy(); this.whisper.destroy(); this.cpToast.destroy();
  }
}
