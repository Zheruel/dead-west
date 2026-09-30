// Full-screen cards.
//  * Floor intro ("FLOOR 1" / DRY GULCH / typed subtitle): dark band with accent rules that draw out from the centre, name slams in. Non-blocking (play continues).
//  * Boss intro (2.1 s cutscene): dim + cinematic letterbox bars slide in, portrait rises from the left over a red glow, name slams in with a screen jolt,
//    title fades in under a red rule, everything exits just before the fight starts. Driven by 'floor:intro' / 'boss:intro'.
//    Mini bosses (introData.mini) get the same card with a WANTED poster instead of a portrait and a shorter timeline (payload `ms`).
//  * Chapter card ('chapter:intro', blocks input while it shows): CHAPTER II / HELL'S FRONTIER slam + typed tagline over the darkened sky.
//  * Interlude card ('interlude:show', D12): painted panel + typed lines + chapter title between the floor-3 trapdoor and floor 4; skippable after
//    `skipAfter` ms; emits 'interlude:done' when it has faded out (flow.js waits for it, with its own fail-safe timer).
import Assets from '../core/Assets.js';
import { bus } from '../core/events.js';
import { Sfx } from '../core/Audio.js';
import { Save } from '../core/Save.js';
import { FONT_TITLE, FONT_BODY, CSS, W, H, FLOORS } from '../config.js';

const accent = (n) => (FLOORS[n] && FLOORS[n].accent) || 0xd9a04a; // per-floor rule colour lives in FLOORS[n].accent
const BAR_H = 128;
const BOSS_MS = 2100; // GameScene holds the boss cutscene this long (minis: payload.ms)
const TYPE_CPS = 30; // interlude / chapter typing speed

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
    this.bName = hud.add.text(940, 462, '', { fontFamily: FONT_TITLE, fontSize: '80px', color: CSS.bone, stroke: '#120c0a', strokeThickness: 11, align: 'center', wordWrap: { width: 800 } }).setOrigin(0.5);
    this.bRule = hud.add.rectangle(940, 526, 560, 4, 0xb01810).setScale(0, 1);
    this.bTitle = hud.add.text(940, 566, '', { fontFamily: FONT_BODY, fontSize: '34px', color: CSS.hell, stroke: '#120c0a', strokeThickness: 6, fontStyle: 'italic' }).setOrigin(0.5);
    this.boss.add([this.bDim, this.bTint, this.bGlow, this.bBarT, this.bBarB, this.bRedT, this.bRedB, this.bTag, this.bName, this.bRule, this.bTitle]);
    this.bSmall = hud.add.text(940, 612, '', { fontFamily: FONT_BODY, fontSize: '22px', color: CSS.sand, stroke: '#120c0a', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setAlpha(0);
    this.boss.add(this.bSmall);
    this.typeTimer = null;
    this.buildChapter();
    this.buildInterlude();
    bus.scoped(hud, 'floor:intro', (p) => this.showFloor(p));
    bus.scoped(hud, 'boss:intro', (p) => this.showBoss(p));
    bus.scoped(hud, 'chapter:intro', (p) => this.showChapter(p));
    bus.scoped(hud, 'interlude:show', (p) => this.showInterlude(p));
    bus.scoped(hud, 'room:transition', () => this.hideBoss()); // leaving mid-card (debug jump) must not leave the boss card stuck
  }

  hideBoss() {
    const h = this.hud;
    h.tweens.killTweensOf([this.boss, this.bPortrait, this.bName, this.bTitle, this.bRule, this.bBarT, this.bBarB, this.bRedT, this.bRedB, this.bGlow].filter(Boolean));
    this.boss.setAlpha(0).setVisible(false);
  }

  showFloor(p) {
    const h = this.hud;
    const col = accent(p.floor);
    this.fRuleT.setFillStyle(col); this.fRuleB.setFillStyle(col);
    this.fLine.setText(`FLOOR ${p.floor}`);
    this.fName.setText(p.name);
    this.fSub.setText('');
    h.tweens.killTweensOf([this.floor, this.fName, this.fRuleT, this.fRuleB, this.fLine]);
    if (this.typeTimer) { this.typeTimer.remove(false); this.typeTimer = null; }
    this.floor.setAlpha(0);
    this.fRuleT.setScale(0, 1); this.fRuleB.setScale(0, 1);
    this.fName.setScale(1.45).setAlpha(0);
    this.fLine.setAlpha(0).setY(430);
    h.tweens.add({ targets: this.floor, alpha: 1, duration: 260 });
    h.tweens.add({ targets: [this.fRuleT, this.fRuleB], scaleX: 1, duration: 520, ease: 'Cubic.easeOut' });
    h.tweens.add({ targets: this.fLine, alpha: 1, y: 416, duration: 380, delay: 120, ease: 'Cubic.easeOut' });
    h.tweens.add({ targets: this.fName, scale: 1, alpha: 1, duration: 420, delay: 220, ease: 'Cubic.easeOut' });
    Sfx.play('spawn', { vol: 0.45, rate: 0.7, gap: 0 });
    // typed subtitle
    const sub = p.subtitle || '';
    let n = 0;
    this.typeTimer = h.time.addEvent({ delay: 34, startAt: -600, repeat: sub.length, callback: () => { n++; this.fSub.setText(sub.slice(0, n)); } });
    h.tweens.add({ targets: this.floor, alpha: 0, delay: 2500, duration: 600 });
  }

  /** WANTED poster for mini bosses: parchment, the mini's sprite (placeholder when the art is missing), small print. Container sized like a portrait. */
  makePoster(p) {
    const h = this.hud;
    const c = h.add.container(330, 470).setSize(400, 520);
    const paper = h.add.rectangle(0, 0, 380, 500, 0xd8c39a, 0.97).setStrokeStyle(6, 0x6b4423);
    const inner = h.add.rectangle(0, 0, 340, 460).setStrokeStyle(2, 0x6b4423, 0.7);
    const head = h.add.text(0, -200, 'WANTED', { fontFamily: FONT_TITLE, fontSize: '62px', color: '#3a1c10' }).setOrigin(0.5);
    const id = (p.boss && p.boss.id) || '';
    const pic = Assets.makeImage(h, 0, -25, `enemy_${id}`);
    pic.setScale(260 / Math.max(pic.width, pic.height, 1));
    const foot = h.add.text(0, 178, 'DEAD OR ALIVE', { fontFamily: FONT_BODY, fontSize: '28px', color: '#3a1c10' }).setOrigin(0.5);
    const rew = h.add.text(0, 214, `REWARD  ${p.bounty || 0} COINS`, { fontFamily: FONT_BODY, fontSize: '22px', color: '#6b4423' }).setOrigin(0.5);
    c.add([paper, inner, head, pic, foot, rew]);
    return c;
  }

  showBoss(p) {
    const h = this.hud;
    this.hideBoss();
    h.tweens.killTweensOf([this.floor, this.fName, this.fRuleT, this.fRuleB, this.fLine]); // a lingering floor card must not show through
    if (this.typeTimer) { this.typeTimer.remove(false); this.typeTimer = null; }
    this.floor.setAlpha(0);
    if (this.bPortrait) { this.bPortrait.destroy(); this.bPortrait = null; }
    const mini = !!p.mini;
    const ms = p.ms || BOSS_MS;
    const k = ms / BOSS_MS; // minis run a shorter timeline: every delay scales with it
    this.bPortrait = mini ? this.makePoster(p) : Assets.makeImage(h, 330, 470, p.portrait || 'portrait_player');
    const sc = 600 / Math.max(this.bPortrait.height, 1);
    this.bPortrait.setScale(sc).setAlpha(0);
    this.boss.add(this.bPortrait);
    this.boss.bringToTop(this.bTag); this.boss.bringToTop(this.bName); this.boss.bringToTop(this.bTitle); this.boss.bringToTop(this.bSmall);
    this.bTag.setText(mini ? 'MINI BOSS' : 'BOSS');
    this.bName.setText(p.name);
    this.bTitle.setText(p.title);
    this.bSmall.setText(mini ? (p.wantedFor || `WANTED FOR DISTURBING THE PEACE. BOUNTY ${p.bounty || 0} COINS.`) : '').setAlpha(0);
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
    h.tweens.add({
      targets: this.bName, scale: 1, alpha: 1, duration: d(320), delay: d(480), ease: 'Cubic.easeIn',
      onStart: () => { bus.emit('hud:flash', { color: 0xd63a2a, alpha: mini ? 0.35 : 0.6 }); if (Save.settings().shake !== false) h.cameras.main.shake(260, mini ? 0.003 : 0.006); },
    });
    h.tweens.add({ targets: this.bRule, scaleX: 1, duration: d(420), delay: d(760), ease: 'Cubic.easeOut' });
    h.tweens.add({ targets: this.bTitle, alpha: 1, duration: d(420), delay: d(880) });
    if (mini) h.tweens.add({ targets: this.bSmall, alpha: 1, duration: d(420), delay: d(1000) });
    // exit shortly before the fight starts (GameScene holds the cutscene for `ms`)
    h.tweens.add({ targets: [this.bBarT, this.bRedT], y: 0, duration: 260, delay: ms - 310, ease: 'Cubic.easeIn' });
    h.tweens.add({ targets: [this.bBarB, this.bRedB], y: H, duration: 260, delay: ms - 310, ease: 'Cubic.easeIn' });
    h.tweens.add({ targets: this.boss, alpha: 0, delay: ms - 350, duration: 330, onComplete: () => this.boss.setVisible(false) });
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
    const roman = ['', 'I', 'II', 'III'][p.chapter] || String(p.chapter);
    h.tweens.killTweensOf([this.chapter, this.cName, this.cRule]);
    if (this.chapTimer) { this.chapTimer.remove(false); this.chapTimer = null; }
    this.cLine.setText(`CHAPTER ${roman}`).setAlpha(0);
    this.cName.setText(p.name || '').setAlpha(0).setScale(1.4);
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
    this.chapTimer = this.typeText(this.cTag, p.tagline || '', 1500);
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

  update() {}
  destroy() {
    if (this.typeTimer) this.typeTimer.remove(false);
    if (this.chapTimer) this.chapTimer.remove(false);
    this.stopInterlude();
    this.floor.destroy(); this.boss.destroy(); this.chapter.destroy(); this.inter.destroy();
  }
}
