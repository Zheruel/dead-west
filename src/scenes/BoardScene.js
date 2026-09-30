// Bounty Board (CHARACTERS_META D2, B5): 30 fixed contracts in three tiers (TIN / SILVER / GOLD, Q / E), each a preset challenge run with a
// fixed rider, start items and mutators. The wooden board is code-drawn. Arrows / WASD move, Enter takes the job, Esc goes back.
import Phaser from 'phaser';
import { W, H, FONT_TITLE, CSS } from '../config.js';
import { Sfx } from '../core/Audio.js';
import { Meta } from '../meta/index.js';
import { BOUNTIES, TIERS, TIER_NP, TIER_LABEL, TIER_UNLOCK_AFTER, byTier, goalText } from '../meta/bounties.js';
import { UNLOCK_BY_ID } from '../meta/unlocks.js';
import { LORE_BY_ID } from '../meta/lore.js';
import { MUTATORS } from '../data/difficulty.js';
import { charDef } from '../data/characters.js';
import { getItem } from '../items/registry.js';
import '../items/index.js';
import { fmtTime } from '../core/util.js';
import { title, body, inkText, INK, uiSfx, setOsCursor } from '../ui/UiKit.js';
import TabBar from '../ui/TabBar.js';
import AchievementToast from '../ui/AchievementToast.js';
import { panel, riderToken, chip, padlock, itemIcon } from '../ui/Silhouette.js';

const COLS = 5, PW = 226, PH = 206, GX = 244, GY = 226, X0 = 720 - GX * 2, Y0 = 318;

function rewardLabel(r) {
  if (r.startsWith('lore:')) { const l = LORE_BY_ID[r.slice(5)]; return `Lore: ${l ? l.title : r.slice(5)}`; }
  const u = UNLOCK_BY_ID[r];
  return u ? u.label : r;
}

export default class BoardScene extends Phaser.Scene {
  constructor() { super('Board'); }

  init() { this.leaving = false; this.sel = 0; }

  create() {
    setOsCursor(this.game, '');
    this.cameras.main.fadeIn(300, 13, 8, 6);
    this.drawBoard();
    this.add.text(W / 2, 46, 'BOUNTY BOARD', title(56, '#f0e0c0')).setOrigin(0.5).setDepth(5);
    this.count = this.add.text(W / 2, 96, '', body(20, CSS.sand)).setOrigin(0.5).setDepth(5);
    this.posters = [];
    this.detail = [];
    this.tabs = new TabBar(this, { x: W / 2, y: 150, w: 720, tabs: TIERS.map((t) => ({ id: t, label: TIER_LABEL[t], count: '' })), onChange: (id, i) => { this.tierId = id; this.sel = 0; this.build(); }, depth: 20, size: 26 });
    this.refreshTabs();
    this.key = (e) => {
      if (this.leaving || e.repeat) return;
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this.move(-1, 0); break;
        case 'ArrowRight': case 'KeyD': this.move(1, 0); break;
        case 'ArrowUp': case 'KeyW': this.move(0, -1); break;
        case 'ArrowDown': case 'KeyS': this.move(0, 1); break;
        case 'Enter': case 'Space': case 'NumpadEnter': this.take(); break;
        case 'Escape': case 'Backspace': this.back(); break;
        default: break;
      }
    };
    this.input.keyboard.on('keydown', this.key);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.key));
    this.toasts = new AchievementToast(this, { hold: false });
  }

  /** Code-drawn wooden board: planks with grain, a darker frame and iron nails. */
  drawBoard() {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(0x2a1a10, 1).fillRect(0, 0, W, H);
    const pw = 120;
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < W / pw + 1; i++) {
      const c = [0x6b4a2c, 0x5e4026, 0x74512f, 0x64442a][i % 4];
      g.fillStyle(c, 1).fillRect(i * pw + 2, 0, pw - 4, H);
      for (let k = 0; k < 26; k++) {
        const x = i * pw + 8 + rnd() * (pw - 16), y0 = rnd() * H, l = 40 + rnd() * 160;
        g.lineStyle(1.5, 0x2a1a10, 0.16 + rnd() * 0.16).lineBetween(x, y0, x + (rnd() - 0.5) * 6, y0 + l);
      }
      g.lineStyle(3, 0x1a100a, 0.8).lineBetween(i * pw, 0, i * pw, H);
    }
    g.lineStyle(26, 0x1a100a, 1).strokeRect(0, 0, W, H);
    g.lineStyle(6, 0x3a2418, 1).strokeRect(14, 14, W - 28, H - 28);
    for (const [x, y] of [[36, 36], [W - 36, 36], [36, H - 36], [W - 36, H - 36]]) g.fillStyle(0x8a8f96, 1).fillCircle(x, y, 8).lineStyle(2, 0x120c0a, 1).strokeCircle(x, y, 8);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setTint(0x000000).setAlpha(0.5).setDepth(-9);
  }

  tierList() { return byTier(this.tierId || 'tin'); }

  refreshTabs() {
    TIERS.forEach((t, i) => {
      const done = Meta.tierDone(t);
      this.tabs.setCount(i, `${done} / 10${Meta.tierOpen(t) ? '' : '   LOCKED'}`);
    });
    const total = BOUNTIES.filter((b) => Meta.contractState(b.id).done).length;
    this.count.setText(`Contracts ${total} / ${BOUNTIES.length}`);
  }

  build() {
    for (const p of this.posters) p.destroy();
    for (const o of this.detail) o.destroy();
    this.posters = []; this.detail = [];
    const list = this.tierList(), open = Meta.tierOpen(this.tierId);
    list.forEach((b, i) => {
      const x = X0 + (i % COLS) * GX, y = Y0 + Math.floor(i / COLS) * GY;
      const st = Meta.contractState(b.id);
      const c = this.add.container(x, y).setDepth(2);
      const rot = ((i * 37) % 7 - 3) * 0.5;
      const bg = panel(this, 0, 0, PW, PH);
      c.add(bg);
      const nail = this.add.circle(0, -PH / 2 + 12, 6, 0x8a8f96).setStrokeStyle(2, 0x120c0a);
      const sel = this.add.rectangle(0, 0, PW + 14, PH + 14).setStrokeStyle(6, 0xf0a640).setVisible(false);
      const tok = riderToken(this, -PW / 2 + 40, -PH / 2 + 48, b.char, 52, { mask: false });
      const name = this.add.text(-PW / 2 + 72, -PH / 2 + 46, b.name, title(19, '#2a1810', { strokeThickness: 0, wordWrap: { width: PW - 88 }, lineSpacing: -2 })).setOrigin(0, 0.5);
      const goal = this.add.text(0, 6, goalText(b.goal), inkText(14, INK, { align: 'center', wordWrap: { width: PW - 24 } })).setOrigin(0.5, 0);
      c.add([nail, tok, name, goal]);
      // mutator chips (tag badges)
      b.mutators.forEach((m, k) => { const mm = MUTATORS[m]; const cc = chip(this, -PW / 2 + 32 + k * 52, PH / 2 - 44, mm ? mm.tag : '?', { size: 15, pad: 8, fill: 0x2a1a12, stroke: 0x8a1c1c }); c.add(cc); });
      const rw = this.add.text(PW / 2 - 10, PH / 2 - 16, `${TIER_NP[b.tier]} NP`, inkText(15, '#5a1a10', { fontStyle: 'bold' })).setOrigin(1, 0.5);
      c.add(rw);
      if (st.done) {
        const s = this.add.text(0, 22, 'COLLECTED', { fontFamily: FONT_TITLE, fontSize: '26px', color: '#2a5a10' }).setOrigin(0.5).setAngle(-12).setAlpha(0.9);
        const sb = this.add.graphics().lineStyle(4, 0x2a5a10, 0.9).strokeRoundedRect(-s.width / 2 - 10, 22 - 20, s.width + 20, 40, 6).setAngle(-12);
        c.add([sb, s]);
      }
      if (!open) { bg.setTint(0x6a5a4a); c.add(padlock(this, 0, 20, 0.7)); }
      c.add(sel);
      c.setAngle(rot);
      c.sel = sel;
      const zone = this.add.zone(x, y, PW, PH).setInteractive({ useHandCursor: true }).setDepth(3);
      zone.on('pointerover', () => this.setSel(i, true));
      zone.on('pointerdown', () => { if (this.sel === i) this.take(); else this.setSel(i); });
      c.zone = zone;
      c.once('destroy', () => zone.destroy());
      this.posters.push(c);
    });
    this.setSel(Math.min(this.sel, list.length - 1), true);
  }

  move(dx, dy) {
    const n = this.tierList().length;
    let i = this.sel + dx + dy * COLS;
    if (dx && Math.floor(i / COLS) !== Math.floor(this.sel / COLS)) i = this.sel; // no row wrap
    if (i < 0 || i >= n) return;
    this.setSel(i);
  }

  setSel(i, silent) {
    if (!silent && i !== this.sel) uiSfx.move();
    this.sel = i;
    this.posters.forEach((p, k) => { p.sel.setVisible(k === i); p.setDepth(k === i ? 4 : 2).setScale(k === i ? 1.04 : 1); });
    this.drawDetail();
  }

  drawDetail() {
    for (const o of this.detail) o.destroy();
    this.detail = [];
    const b = this.tierList()[this.sel];
    if (!b) return;
    const A = (o) => { this.detail.push(o); return o.setDepth(6); };
    const cx = W / 2, cy = 822, open = Meta.tierOpen(b.tier), st = Meta.contractState(b.id), ch = charDef(b.char);
    A(panel(this, cx, cy, 1300, 250, { dark: true }));
    A(this.add.text(120, 726, b.name.toUpperCase(), title(32, CSS.amber))).setOrigin(0, 0.5);
    A(this.add.text(120, 764, `${ch.name}  -  ${goalText(b.goal)}`, body(18, CSS.bone))).setOrigin(0, 0.5);
    // rules (mutators) + start items
    let y = 796;
    if (!b.mutators.length) A(this.add.text(120, y, 'No mutators. A clean ride.', body(17, CSS.sand))).setOrigin(0, 0.5);
    b.mutators.forEach((m) => { const mm = MUTATORS[m]; if (mm) { A(this.add.text(120, y, `${mm.name}: ${mm.desc}`, body(16, CSS.sand, { wordWrap: { width: 760 } }))).setOrigin(0, 0.5); y += 26; } });
    if (b.items.length) {
      A(this.add.text(120, y + 6, 'START ITEMS', body(15, '#a48a5c'))).setOrigin(0, 0.5);
      b.items.forEach((id, k) => { const d = getItem(id); if (d) A(itemIcon(this, 268 + k * 46, y + 6, d, 0.42)); });
    }
    // right column: rewards + best
    const rx = 960;
    A(this.add.text(rx, 736, 'REWARD', body(15, '#a48a5c'))).setOrigin(0, 0.5);
    const rew = [`${TIER_NP[b.tier]} Notoriety`, ...b.reward.map(rewardLabel)];
    A(this.add.text(rx, 758, rew.join('\n'), body(17, CSS.bone, { lineSpacing: 2 }))).setOrigin(0, 0);
    A(this.add.text(rx, 838, st.tries ? `Tries ${st.tries}${st.best.time ? `   Best ${fmtTime(st.best.time)}` : ''}` : 'Not yet attempted', body(16, CSS.sand))).setOrigin(0, 0.5);
    // plaque
    const label = !open ? `COMPLETE ${TIER_UNLOCK_AFTER} ${TIER_LABEL[TIERS[TIERS.indexOf(b.tier) - 1]]} CONTRACTS` : 'TAKE THE JOB';
    const plq = A(this.add.container(cx + 420, 920));
    const g = this.add.graphics();
    g.fillStyle(open ? 0x8a1c1c : 0x3a2a20, 1).fillRoundedRect(-200, -22, 400, 44, 10).lineStyle(3, 0xf0a640, 1).strokeRoundedRect(-200, -22, 400, 44, 10);
    plq.add([g, this.add.text(0, 0, label, title(open ? 26 : 18, CSS.bone)).setOrigin(0.5)]);
    plq.setSize(400, 44).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.take());
    A(this.add.text(60, 924, 'ARROWS  choose     Q / E  tier     ENTER  take the job     ESC  back', body(16, '#c9b48a', { strokeThickness: 3 }))).setOrigin(0, 0.5);
  }

  take() {
    if (this.leaving) return;
    const b = this.tierList()[this.sel];
    if (!b) return;
    if (!Meta.tierOpen(b.tier)) { Sfx.play('shop_deny', { vol: 0.7 }); this.tweens.add({ targets: this.posters[this.sel], x: '+=8', duration: 50, yoyo: true, repeat: 3 }); return; }
    this.leaving = true;
    Sfx.play('gun_cock', { vol: 0.7 });
    this.cameras.main.fadeOut(320, 13, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { char: b.char, mode: 'contract', contract: b.id }));
  }

  back() {
    if (this.leaving) return;
    this.leaving = true;
    uiSfx.back();
    this.cameras.main.fadeOut(220, 13, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
  }
}
