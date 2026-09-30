// Meta toasts (CHARACTERS_META D5): a parchment strip that slides up at bottom centre for a deed / unlock / rank-up / contract / daily result,
// plus a small "NEW CODEX ENTRY" chip bottom-left. One reusable container per kind (no per-toast display objects), a queue of at most 3, and
// toasts wait while a boss is alive (released on boss:defeated / player:died). Self-driven via the scene's `update` event, so the same widget
// works in HUDScene, MenuScene and EndScene:  const toasts = new AchievementToast(scene, { hold: false });  (HUDScene also calls .update(g, dt), a no-op)
import { W, H, FONT_TITLE, FONT_BODY } from '../config.js';
import { bus } from '../core/events.js';
import { Sfx } from '../core/Audio.js';
import { BOUNTY_BY_ID } from '../meta/bounties.js';
import { metaIcon, riderToken } from './Silhouette.js';

const CW = 560, CH = 88, HOLD = 3.2, SLIDE = 0.26, QMAX = 3;
const CODEX_W = 340, CODEX_H = 46, CODEX_HOLD = 2;
const KIND_LABEL = { enemy: 'BESTIARY', item: 'RELIC', boss: 'OUTLAW', lore: 'LORE' };

export default class AchievementToast {
  constructor(scene, { y = H - 84, depth = 300, hold = true } = {}) {
    this.scene = scene;
    this.baseY = y;
    this.holdForBoss = hold;
    this.bossAlive = false;
    this.queue = [];
    this.cur = null;
    this.t = 0;
    this.phase = 'idle'; // idle | in | hold | out
    this.codexQ = [];
    this.cx = null; this.cPhase = 'idle'; this.cT = 0;

    // ---- main strip
    const c = scene.add.container(W / 2, H + CH).setDepth(depth).setScrollFactor(0).setVisible(false);
    const g = scene.add.graphics();
    g.fillStyle(0x120c0a, 0.5).fillRoundedRect(-CW / 2 + 4, -CH / 2 + 6, CW, CH, 12);
    g.fillStyle(0xd9c39a, 1).fillRoundedRect(-CW / 2, -CH / 2, CW, CH, 12);
    g.fillStyle(0x8a4b1f, 0.16).fillRoundedRect(-CW / 2 + 6, -CH / 2 + 6, CW - 12, CH - 12, 8);
    g.lineStyle(4, 0x3a2418, 1).strokeRoundedRect(-CW / 2, -CH / 2, CW, CH, 12);
    this.badgeSlot = scene.add.container(-CW / 2 + 52, 0);
    this.kicker = scene.add.text(-CW / 2 + 104, -26, '', { fontFamily: FONT_BODY, fontSize: '15px', color: '#8a4b1f', fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.name = scene.add.text(-CW / 2 + 104, 0, '', { fontFamily: FONT_TITLE, fontSize: '26px', color: '#2a1810' }).setOrigin(0, 0.5);
    this.sub = scene.add.text(-CW / 2 + 104, 27, '', { fontFamily: FONT_BODY, fontSize: '16px', color: '#5a1a10' }).setOrigin(0, 0.5);
    this.np = scene.add.text(CW / 2 - 18, -24, '', { fontFamily: FONT_TITLE, fontSize: '22px', color: '#8a1c14' }).setOrigin(1, 0.5);
    c.add([g, this.badgeSlot, this.kicker, this.name, this.sub, this.np]);
    this.c = c;
    this.badges = {}; // cache: key -> game object living in badgeSlot

    // ---- codex chip
    const k = scene.add.container(-CODEX_W, H - 150).setDepth(depth).setScrollFactor(0).setVisible(false);
    const kg = scene.add.graphics();
    kg.fillStyle(0xd9c39a, 1).fillRoundedRect(0, -CODEX_H / 2, CODEX_W, CODEX_H, 10).lineStyle(3, 0x3a2418, 1).strokeRoundedRect(0, -CODEX_H / 2, CODEX_W, CODEX_H, 10);
    this.kText = scene.add.text(14, -9, 'NEW CODEX ENTRY', { fontFamily: FONT_BODY, fontSize: '13px', color: '#8a4b1f', fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.kName = scene.add.text(14, 10, '', { fontFamily: FONT_TITLE, fontSize: '17px', color: '#2a1810' }).setOrigin(0, 0.5);
    k.add([kg, this.kText, this.kName]);
    this.k = k;
    this.kY = H - 150;

    this.offs = [
      bus.scoped(scene, 'meta:achievement', (p) => this.push({ kind: 'deed', id: p.id, name: p.name, np: p.np, sub: p.desc })),
      bus.scoped(scene, 'meta:unlocked', (p) => this.onUnlocked(p)),
      bus.scoped(scene, 'meta:rank', (p) => this.push({ kind: 'rank', name: p.title, sub: `RANK ${p.rank}`, rank: p.rank })),
      bus.scoped(scene, 'bounty:completed', (p) => { const b = BOUNTY_BY_ID[p.id]; this.push({ kind: 'bounty', name: b ? b.name : p.id, tier: p.tier, sub: 'CONTRACT COLLECTED' }); }),
      bus.scoped(scene, 'daily:finished', (p) => this.push({ kind: 'daily', name: `$${Math.round(p.score).toLocaleString('en-US')}`, sub: `Rank ${p.rank} on today's board` })),
      bus.scoped(scene, 'codex:discovered', (p) => this.codexQ.length < 6 && this.codexQ.push(p)),
    ];
    if (hold) {
      this.offs.push(bus.scoped(scene, 'boss:spawned', () => { this.bossAlive = true; }));
      this.offs.push(bus.scoped(scene, 'boss:defeated', () => { this.bossAlive = false; }));
      this.offs.push(bus.scoped(scene, 'player:died', () => { this.bossAlive = false; }));
    }
    this._upd = (time, delta) => this.tick(Math.min(delta / 1000, 0.05));
    scene.events.on('update', this._upd);
    scene.events.once('shutdown', () => this.destroy());
  }

  update() { /* driven by the scene's update event */ }

  onUnlocked(p) {
    if (p.kind === 'char') this.push({ kind: 'char', id: p.id.slice(5), name: p.label, sub: 'NEW RIDER UNLOCKED' });
    else if (p.kind === 'mode') this.push({ kind: 'mode', name: p.label, sub: 'NEW MODE UNLOCKED' });
    else if (p.kind === 'title') this.push({ kind: 'title', name: p.label, sub: 'NEW TITLE' });
    else if (p.kind === 'gate') this.push({ kind: 'gate', name: p.label, sub: 'NEW RELICS IN THE POOL' });
  }

  push(t) {
    if (this.queue.length >= QMAX) this.queue.shift();
    this.queue.push(t);
  }

  badgeFor(t) {
    const sc = this.scene;
    let key = 'star_tin', mk = null;
    if (t.kind === 'deed') { const np = t.np || 0; key = np >= 60 ? 'star_gold' : np >= 25 ? 'star_silver' : 'star_tin'; }
    else if (t.kind === 'bounty') key = `star_${t.tier || 'tin'}`;
    else if (t.kind === 'rank') key = 'rank_badge';
    else if (t.kind === 'gate') key = 'padlock';
    else if (t.kind === 'char') mk = `rider:${t.id}`;
    else key = 'star_gold';
    const id = mk || key;
    let o = this.badges[id];
    if (!o) {
      o = mk ? riderToken(sc, 0, 0, t.id, 64, { mask: false }) : metaIcon(sc, 0, 0, key, 0.72);
      this.badgeSlot.add(o);
      this.badges[id] = o;
    }
    for (const k of Object.keys(this.badges)) this.badges[k].setVisible(k === id);
  }

  show(t) {
    this.cur = t;
    this.badgeFor(t);
    this.kicker.setText(t.kind === 'deed' ? 'DEED EARNED' : t.kind === 'rank' ? 'RANK UP' : t.kind === 'bounty' ? 'CONTRACT' : t.kind === 'daily' ? 'DAILY RIDE' : (t.sub || '').toUpperCase());
    this.name.setText(t.name || '');
    this.name.setScale(Math.min(1, (CW - 220) / Math.max(1, this.name.width)));
    this.sub.setText(t.kind === 'deed' || t.kind === 'daily' || t.kind === 'rank' ? t.sub || '' : '');
    this.np.setText(t.np ? `+${t.np} NP` : '');
    this.c.setVisible(true).setY(H + CH);
    this.phase = 'in'; this.t = 0;
    Sfx.play(t.kind === 'rank' ? 'stamp_slam' : 'item_get', { vol: 0.6, rate: 1 });
  }

  tick(dt) {
    // main strip
    if (this.phase === 'idle') {
      if (this.queue.length && !(this.holdForBoss && this.bossAlive)) this.show(this.queue.shift());
    } else {
      this.t += dt;
      const ty = this.baseY;
      if (this.phase === 'in') {
        const k = Math.min(1, this.t / SLIDE);
        this.c.setY(H + CH + (ty - H - CH) * (1 - (1 - k) * (1 - k)));
        if (k >= 1) { this.phase = 'hold'; this.t = 0; }
      } else if (this.phase === 'hold') {
        if (this.t >= HOLD) { this.phase = 'out'; this.t = 0; }
      } else {
        const k = Math.min(1, this.t / SLIDE);
        this.c.setY(ty + (H + CH - ty) * k * k);
        if (k >= 1) { this.phase = 'idle'; this.c.setVisible(false); this.cur = null; }
      }
    }
    // codex chip (never blocks; runs beside the main strip)
    if (this.cPhase === 'idle') {
      if (this.codexQ.length) {
        const p = this.codexQ.shift();
        this.kText.setText(`NEW CODEX ENTRY  -  ${KIND_LABEL[p.kind] || 'CODEX'}`);
        this.kName.setText(this.codexName(p));
        this.k.setVisible(true).setX(-CODEX_W);
        this.cPhase = 'in'; this.cT = 0;
      }
    } else {
      this.cT += dt;
      if (this.cPhase === 'in') { const k = Math.min(1, this.cT / 0.22); this.k.setX(-CODEX_W + (CODEX_W + 20) * (1 - (1 - k) * (1 - k))); if (k >= 1) { this.cPhase = 'hold'; this.cT = 0; } }
      else if (this.cPhase === 'hold') { if (this.cT >= CODEX_HOLD) { this.cPhase = 'out'; this.cT = 0; } }
      else { const k = Math.min(1, this.cT / 0.22); this.k.setX(20 - (CODEX_W + 20) * k * k); if (k >= 1) { this.cPhase = 'idle'; this.k.setVisible(false); } }
    }
  }

  codexName(p) {
    const id = String(p.id || '');
    let n = id.replace(/_/g, ' ');
    n = n.charAt(0).toUpperCase() + n.slice(1);
    return n.length > 26 ? `${n.slice(0, 25)}.` : n;
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    for (const o of this.offs) o();
    try { this.scene.events.off('update', this._upd); } catch (e) { /* scene gone */ }
    this.c.destroy(); this.k.destroy();
  }
}

