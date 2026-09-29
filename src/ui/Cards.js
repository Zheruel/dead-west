// Full-screen cards.
//  * Floor intro ("FLOOR 1" / DRY GULCH / typed subtitle): dark band with accent rules that draw out from the centre, name slams in. Non-blocking (play continues).
//  * Boss intro (2.1 s cutscene): dim + cinematic letterbox bars slide in, portrait rises from the left over a red glow, name slams in with a screen jolt,
//    title fades in under a red rule, everything exits just before the fight starts. Driven by 'floor:intro' / 'boss:intro'.
import Assets from '../core/Assets.js';
import { bus } from '../core/events.js';
import { Sfx } from '../core/Audio.js';
import { Save } from '../core/Save.js';
import { FONT_TITLE, FONT_BODY, CSS, W, H } from '../config.js';

const ACCENT = { 1: 0xd9a04a, 2: 0xa07ad0, 3: 0x8fc23f }; // floor 1 ochre, 2 dusk purple, 3 mine green
const BAR_H = 128;

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
    this.typeTimer = null;
    bus.scoped(hud, 'floor:intro', (p) => this.showFloor(p));
    bus.scoped(hud, 'boss:intro', (p) => this.showBoss(p));
    bus.scoped(hud, 'room:transition', () => this.hideBoss()); // leaving mid-card (debug jump) must not leave the boss card stuck
  }

  hideBoss() {
    const h = this.hud;
    h.tweens.killTweensOf([this.boss, this.bPortrait, this.bName, this.bTitle, this.bRule, this.bBarT, this.bBarB, this.bRedT, this.bRedB, this.bGlow].filter(Boolean));
    this.boss.setAlpha(0).setVisible(false);
  }

  showFloor(p) {
    const h = this.hud;
    const col = ACCENT[p.floor] || ACCENT[1];
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

  showBoss(p) {
    const h = this.hud;
    this.hideBoss();
    h.tweens.killTweensOf([this.floor, this.fName, this.fRuleT, this.fRuleB, this.fLine]); // a lingering floor card must not show through
    if (this.typeTimer) { this.typeTimer.remove(false); this.typeTimer = null; }
    this.floor.setAlpha(0);
    if (this.bPortrait) { this.bPortrait.destroy(); this.bPortrait = null; }
    const key = p.portrait || 'portrait_player';
    this.bPortrait = Assets.makeImage(h, 330, 470, key);
    const sc = 600 / Math.max(this.bPortrait.height, 1);
    this.bPortrait.setScale(sc).setAlpha(0);
    this.boss.add(this.bPortrait);
    this.boss.bringToTop(this.bTag); this.boss.bringToTop(this.bName); this.boss.bringToTop(this.bTitle);
    this.bName.setText(p.name);
    this.bTitle.setText(p.title);
    this.boss.setVisible(true).setAlpha(0);
    this.bBarT.setY(0); this.bBarB.setY(H); this.bRedT.setY(0); this.bRedB.setY(H);
    this.bRule.setScale(0, 1);
    this.bName.setAlpha(0).setScale(1.7);
    this.bTitle.setAlpha(0); this.bTag.setAlpha(0);
    this.bPortrait.x = 130;
    this.bGlow.setAlpha(0);
    h.tweens.add({ targets: this.boss, alpha: 1, duration: 220 });
    h.tweens.add({ targets: [this.bBarT, this.bRedT], y: BAR_H, duration: 320, ease: 'Cubic.easeOut' });
    h.tweens.add({ targets: [this.bBarB, this.bRedB], y: H - BAR_H, duration: 320, ease: 'Cubic.easeOut' });
    h.tweens.add({ targets: this.bPortrait, x: 330, alpha: 1, duration: 620, delay: 120, ease: 'Cubic.easeOut' });
    h.tweens.add({ targets: this.bPortrait, scale: { from: sc * 1.12, to: sc }, duration: 1800, delay: 120, ease: 'Sine.easeOut' });
    h.tweens.add({ targets: this.bGlow, alpha: 0.55, duration: 700, delay: 100 });
    h.tweens.add({ targets: this.bTag, alpha: 1, duration: 300, delay: 420 });
    h.tweens.add({
      targets: this.bName, scale: 1, alpha: 1, duration: 320, delay: 480, ease: 'Cubic.easeIn',
      onStart: () => { bus.emit('hud:flash', { color: 0xd63a2a, alpha: 0.6 }); if (Save.settings().shake !== false) h.cameras.main.shake(260, 0.006); },
    });
    h.tweens.add({ targets: this.bRule, scaleX: 1, duration: 420, delay: 760, ease: 'Cubic.easeOut' });
    h.tweens.add({ targets: this.bTitle, alpha: 1, duration: 420, delay: 880 });
    // exit shortly before the fight starts (GameScene holds the cutscene for 2100 ms)
    h.tweens.add({ targets: [this.bBarT, this.bRedT], y: 0, duration: 260, delay: 1790, ease: 'Cubic.easeIn' });
    h.tweens.add({ targets: [this.bBarB, this.bRedB], y: H, duration: 260, delay: 1790, ease: 'Cubic.easeIn' });
    h.tweens.add({ targets: this.boss, alpha: 0, delay: 1750, duration: 330, onComplete: () => this.boss.setVisible(false) });
  }
  update() {}
  destroy() { if (this.typeTimer) this.typeTimer.remove(false); this.floor.destroy(); this.boss.destroy(); }
}
