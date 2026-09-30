// DealPedestal: one contract table of the Crossroads room (EVENTS 2.5). A stone slab with a burning candle (props_deals deal_table, or code-drawn)
// holding the offer's item icon / pact emblem, a bobbing glow and a rotating ring. Standing near it unrolls a parchment CONTRACT CARD (420x150):
// NAME, effect lines, PRICE row (charcoal hearts with a red slash, `12c`, key / dynamite / tin counts, a red rune for a curse).
// Signing itself is a HoldRing owned by CrossroadsRoom; this class only draws. rec = the offer object {id, kind, itemId?, pact?, cost, taken}.
import { DEPTH, FONT_BODY, actorDepth } from '../config.js';
import { Assets } from '../core/Assets.js';
import { getItem } from '../items/registry.js';
import { PACTS, price } from '../systems/Crossroads.js';

const ICON_Y = 66;
const CARD_W = 420, CARD_H = 150;
const CARD_DY = 84; // card top below the table's ground point
const TXT = (size, color) => ({ fontFamily: FONT_BODY, fontSize: `${size}px`, color, wordWrap: { width: CARD_W - 40 }, lineSpacing: 1 });

/** Small emblem per pact, drawn once into a Container (origin = centre). */
function pactEmblem(scene, id) {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.lineStyle(3, 0x120c0a, 1);
  const paper = () => { g.fillStyle(0xe6d2a0, 1); g.fillRoundedRect(-24, -30, 48, 60, 5); g.strokeRoundedRect(-24, -30, 48, 60, 5); };
  paper();
  const label = (t, col) => c.add(scene.add.text(0, 0, t, { fontFamily: FONT_BODY, fontSize: '30px', color: col, stroke: '#120c0a', strokeThickness: 2 }).setOrigin(0.5));
  c.add(g);
  switch (id) {
    case 'glass_cannon': g.lineStyle(3, 0xd63a2a, 1); g.beginPath(); g.moveTo(-14, -18); g.lineTo(-2, -2); g.lineTo(-10, 6); g.lineTo(4, 22); g.strokePath(); label('!', '#8a1c1c'); break;
    case 'devils_dollar': label('$', '#8a6a10'); break;
    case 'iron_hide': g.fillStyle(0x8a94a4, 1); g.fillPoints([{ x: -13, y: -16 }, { x: 13, y: -16 }, { x: 13, y: 2 }, { x: 0, y: 18 }, { x: -13, y: 2 }], true); g.strokePoints([{ x: -13, y: -16 }, { x: 13, y: -16 }, { x: 13, y: 2 }, { x: 0, y: 18 }, { x: -13, y: 2 }], true); break;
    case 'ace_in_hole': label('A', '#8a1c1c'); break;
    case 'absolution': g.fillStyle(0xf5f0e0, 1); g.fillRect(-4, -20, 8, 40); g.fillRect(-14, -8, 28, 8); g.lineStyle(2, 0x120c0a, 1); g.strokeRect(-4, -20, 8, 40); break;
    default: label('?', '#120c0a');
  }
  return c;
}

export default class DealPedestal {
  /** o: {x, y, track(obj)}. */
  constructor(scene, rec, room, o = {}) {
    this.scene = scene; this.rec = rec; this.room = room;
    this.x = o.x; this.y = o.y;
    this.track = o.track || (() => {});
    this.age = Math.random() * 3;
    this.nameK = 0;
    this.cardK = 0;
    this.sparkT = 0;
    this.priceKey = '';
    const dy = actorDepth(this.y + 34);

    // table
    if (Assets.has('props_deals')) {
      this.base = Assets.makeCell(scene, this.x, this.y + 36, 'props_deals', 'deal_table', 1).setDepth(dy);
    } else {
      const g = scene.add.graphics().setDepth(dy);
      g.fillStyle(0x0c0808, 0.5); g.fillEllipse(this.x, this.y + 30, 130, 34);
      g.fillStyle(0x3b3230, 1); g.fillRoundedRect(this.x - 48, this.y - 22, 96, 50, 6);
      g.fillStyle(0x504642, 1); g.fillRoundedRect(this.x - 52, this.y - 32, 104, 16, 5);
      g.lineStyle(3, 0x120c0a, 1); g.strokeRoundedRect(this.x - 52, this.y - 32, 104, 16, 5); g.strokeRoundedRect(this.x - 48, this.y - 16, 96, 44, 5);
      g.fillStyle(0xe6d2a0, 1); g.fillRect(this.x - 22, this.y - 30, 26, 12); // contract under a candle
      g.fillStyle(0xf0e0b0, 1); g.fillRect(this.x + 22, this.y - 46, 8, 16);
      g.fillStyle(0xff9a30, 1); g.fillCircle(this.x + 26, this.y - 52, 4);
      this.base = g;
    }
    this.track(this.base);
    this.glow = scene.add.image(this.x, this.y - ICON_Y, 'glow').setTint(0xff5a30).setAlpha(0.35).setScale(1.2).setBlendMode('ADD').setDepth(dy + 0.4);
    this.ring = scene.add.image(this.x, this.y + 14, 'ring').setTint(0xd63a2a).setAlpha(0.5).setScale(0.55, 0.22).setBlendMode('ADD').setDepth(DEPTH.floor + 4);
    this.candle = scene.add.image(this.x + 26, this.y - 54, 'glow').setTint(0xffb050).setAlpha(0.5).setScale(0.5).setBlendMode('ADD').setDepth(dy + 0.6);
    this.tag = scene.add.text(this.x, this.y - 130, '', { fontFamily: FONT_BODY, fontSize: '24px', color: '#f5d8c0', stroke: '#120c0a', strokeThickness: 6, align: 'center' }).setOrigin(0.5, 1).setDepth(DEPTH.pickups + 4).setAlpha(0);
    for (const o2 of [this.glow, this.ring, this.candle, this.tag]) this.track(o2);
    this.icon = null;
    this.buildIcon();
    this.buildCard();
    this.refresh();
  }

  get def() { return this.rec.itemId ? getItem(this.rec.itemId) : null; }
  get title() {
    const r = this.rec;
    if (r.kind === 'pity') return 'PITY FROM THE DEVIL';
    if (r.kind === 'pact') return PACTS[r.pact] ? PACTS[r.pact].name : 'PACT';
    const d = this.def;
    return d ? d.name.toUpperCase() : 'SOLD OUT';
  }
  get lines() {
    const r = this.rec;
    if (r.kind === 'pity') return ['A HEART CONTAINER, FREE OF CHARGE.'];
    if (r.kind === 'pact') return PACTS[r.pact] ? PACTS[r.pact].lines : [];
    const d = this.def;
    return d ? [d.desc] : [];
  }

  buildIcon() {
    const r = this.rec, scene = this.scene;
    const dy = actorDepth(this.y + 34) + 0.5;
    if (r.kind === 'pact') this.icon = pactEmblem(scene, r.pact);
    else if (r.kind === 'pity') this.icon = Assets.makeCell(scene, 0, 0, 'pickups', 'heart_full', 0.5).setScale(1.3).setTint(0xffe090);
    else if (this.def) {
      const ic = this.def.icon || { sheet: 'items_passive_a', name: this.def.id };
      this.icon = Assets.makeCell(scene, 0, 0, ic.sheet, ic.name, 0.5).setScale(0.9);
    } else this.icon = null;
    if (this.icon) { this.icon.setPosition(this.x, this.y - ICON_Y).setDepth(dy); this.track(this.icon); }
  }

  buildCard() {
    const scene = this.scene;
    const d = DEPTH.fx + 40;
    this.cardX = Math.min(1344 - CARD_W / 2 - 6, Math.max(96 + CARD_W / 2 + 6, this.x));
    this.cardY = this.y + CARD_DY;
    const left = this.cardX - CARD_W / 2, top = this.cardY;
    this.card = scene.add.graphics().setDepth(d).setVisible(false);
    this.card.fillStyle(0x120c0a, 0.4); this.card.fillRoundedRect(left + 4, top + 5, CARD_W, CARD_H, 8);
    this.card.fillStyle(0xe6d2a0, 1); this.card.fillRoundedRect(left, top, CARD_W, CARD_H, 8);
    this.card.lineStyle(3, 0x6b4423, 1); this.card.strokeRoundedRect(left, top, CARD_W, CARD_H, 8);
    this.card.lineStyle(1, 0x8a1c1c, 0.8); this.card.strokeRoundedRect(left + 6, top + 6, CARD_W - 12, CARD_H - 12, 5);
    this.cardTitle = scene.add.text(this.cardX, top + 12, '', { ...TXT(24, '#8a1c1c'), align: 'center', wordWrap: { width: CARD_W - 30 } }).setOrigin(0.5, 0).setDepth(d + 1).setVisible(false);
    this.cardBody = scene.add.text(this.cardX, top + 44, '', { ...TXT(18, '#2a1a10'), align: 'center' }).setOrigin(0.5, 0).setDepth(d + 1).setVisible(false);
    this.priceGfx = scene.add.graphics().setDepth(d + 1).setVisible(false);
    this.priceLabel = scene.add.text(left + 24, top + CARD_H - 40, 'PRICE:', TXT(20, '#2a1a10')).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false);
    this.priceText = scene.add.text(left + 24, top + CARD_H - 40, '', { ...TXT(22, '#7a1010'), wordWrap: { width: CARD_W } }).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false);
    this.foot = scene.add.text(this.cardX, top + CARD_H - 16, 'HOLD TO SIGN', TXT(13, '#6b4423')).setOrigin(0.5).setDepth(d + 1).setVisible(false);
    for (const o of [this.card, this.cardTitle, this.cardBody, this.priceGfx, this.priceLabel, this.priceText, this.foot]) this.track(o);
    this.cardObjs = [this.card, this.cardTitle, this.cardBody, this.priceGfx, this.priceLabel, this.priceText, this.foot];
  }

  /** Text parts of the price (everything but hearts, which are drawn). */
  costParts() {
    const c = this.rec.cost || {};
    const out = [];
    if (c.coins) out.push(`${price(this.scene.player, c.coins)}c`);
    if (c.keys) out.push(`${c.keys} ${c.keys === 1 ? 'KEY' : 'KEYS'}`);
    if (c.dynamite) out.push(`${c.dynamite} DYNAMITE`);
    if (c.tin) out.push(`${c.tin / 2} TIN`);
    if (c.curse) out.push('A CURSE');
    return out;
  }

  /** Redraw the price row (the coin price moves with curse_debt). */
  drawPrice() {
    const c = this.rec.cost || {};
    const parts = this.costParts();
    const key = `${c.hearts || 0}|${parts.join('+')}|${this.rec.taken ? 1 : 0}`;
    if (key === this.priceKey) return;
    this.priceKey = key;
    const g = this.priceGfx;
    g.clear();
    const left = this.cardX - CARD_W / 2, cy = this.cardY + CARD_H - 40;
    let x = left + 24 + this.priceLabel.width + 10;
    if (this.rec.taken) { this.priceText.setPosition(x, cy).setText('SIGNED'); return; }
    for (let i = 0; i < (c.hearts || 0); i++) { // charcoal hearts with a red slash
      const hx = x + 13, hy = cy;
      g.fillStyle(0x2a2224, 1); g.fillCircle(hx - 6, hy - 4, 7); g.fillCircle(hx + 6, hy - 4, 7); g.fillTriangle(hx - 13, hy - 1, hx + 13, hy - 1, hx, hy + 14);
      g.lineStyle(3, 0xd63a2a, 1); g.beginPath(); g.moveTo(hx - 12, hy + 12); g.lineTo(hx + 12, hy - 14); g.strokePath();
      x += 32;
    }
    if (c.curse) { // rune glyph before the text
      g.lineStyle(3, 0xa01818, 1); g.strokeCircle(x + 10, cy, 9); g.beginPath(); g.moveTo(x + 10, cy - 9); g.lineTo(x + 10, cy + 9); g.moveTo(x + 3, cy - 3); g.lineTo(x + 17, cy + 5); g.strokePath();
      x += 28;
    }
    this.priceText.setPosition(x, cy).setText(parts.length || c.hearts ? parts.join('  +  ') : 'FREE');
  }

  /** Item / pact taken: icon and card go away, the table goes dark. */
  refresh() {
    const taken = this.rec.taken;
    if (this.icon) this.icon.setVisible(!taken);
    this.glow.setVisible(!taken);
    this.ring.setVisible(!taken);
    this.candle.setVisible(true);
    this.tag.setText(taken ? '' : this.title);
    this.cardTitle.setText(this.title);
    this.cardBody.setText(this.lines.join('\n'));
    this.priceKey = '';
  }

  /** Player is close enough that the card should be open. */
  get near() {
    const p = this.scene.player;
    return !!p && !p.dead && Math.hypot(p.x - this.x, p.y - (this.y + 4)) < 92;
  }

  update(dt) {
    this.age += dt;
    const rec = this.rec;
    const p = this.scene.player;
    if (this.icon && !rec.taken) {
      const bob = Math.sin(this.age * 2.4 + this.x) * 5;
      this.icon.y = this.y - ICON_Y + bob;
      this.glow.y = this.icon.y;
      this.glow.setAlpha(0.3 + Math.sin(this.age * 3) * 0.08);
      this.ring.setRotation(this.age * 0.8).setAlpha(0.42 + Math.sin(this.age * 2) * 0.12);
      this.sparkT -= dt;
      if (this.sparkT <= 0) {
        this.sparkT = 0.35 + Math.random() * 0.3;
        this.scene.fx.burst(this.x + (Math.random() - 0.5) * 60, this.y - 20, { color: [0xff7a30, 0xd63a2a], count: 1, speed: [15, 45], life: [700, 1100], scale: [1.4, 2], angle: [255, 285] });
      }
      const nearTag = p && !p.dead ? Math.hypot(p.x - this.x, p.y - this.y) < 230 : false;
      this.nameK += ((nearTag ? 1 : 0) - this.nameK) * Math.min(1, dt * 8);
      this.tag.setAlpha(this.nameK).setY(this.y - ICON_Y - 50 - this.nameK * 8 + bob * 0.5);
    } else this.tag.setAlpha(0);
    this.candle.setAlpha(0.45 + Math.sin(this.age * 9) * 0.1 + Math.sin(this.age * 23) * 0.05);
    // contract card
    const want = this.near ? 1 : 0;
    this.cardK += (want - this.cardK) * Math.min(1, dt * 12);
    const show = this.cardK > 0.04;
    for (const o of this.cardObjs) if (o.visible !== show) o.setVisible(show);
    if (show) {
      for (const o of this.cardObjs) o.setAlpha(this.cardK);
      this.drawPrice();
    }
    this.foot.setVisible(show && !rec.taken);
  }

  destroy() {
    for (const o of [this.base, this.glow, this.ring, this.candle, this.tag, this.icon, ...(this.cardObjs || [])]) if (o && o.scene) o.destroy();
    this.icon = null;
  }
}
