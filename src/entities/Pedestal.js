// Item pedestal / shop table holding one item. Persisted via a state record: {x,y,itemId,price,group,taken}.
// Presentation: icon bobs & breathes above a rotating amber ring (magic circle) with a soft glow and rising sparks; the item name fades in
// when the player is near (plus "TAKE ONE" on pick-one pairs). Touching it picks the item up (shop pedestals charge first).
// Actives: picking one while holding another swaps - the old active stays on the pedestal (detached from any pick-one group).
// Round 2: tag chips under the name (coloured), a gold synergy spark + `SYNERGY!` line when the item would complete a synergy (setting synergyHints),
// and a red deal plate (`rec.deal`: true = the def's deal.pay, or a {container,coins,keys,tin,dynamite} object) paid through ItemSystem.canPay/pay.
import Phaser from 'phaser';
import { DEPTH, actorDepth, FONT_BODY } from '../config.js';
import { Assets } from '../core/Assets.js';
import { bus } from '../core/events.js';
import { Save } from '../core/Save.js';
import { getItem } from '../items/registry.js';
import { tagColor, tagLabel } from '../items/tags.js';
import { tryBuy } from './Shop.js';

const PAY_LABEL = { container: (n) => `-${n} HEART${n > 1 ? 'S' : ''}`, coins: (n) => `${n} COINS`, keys: (n) => `${n} KEY${n > 1 ? 'S' : ''}`, tin: (n) => `${n / 2} TIN`, dynamite: (n) => `${n} DYNAMITE` };
const payText = (pay) => Object.keys(pay).filter((k) => PAY_LABEL[k] && pay[k]).map((k) => PAY_LABEL[k](pay[k])).join('  ');
const hintsOn = () => { try { return Save.settings().synergyHints !== false; } catch (e) { return true; } };

const ICON_Y = 66; // icon centre above the pedestal's ground point (floats over the altar top)

export default class Pedestal {
  constructor(scene, rec, room) {
    this.scene = scene;
    this.rec = rec;
    this.room = room;
    this.x = rec.x; this.y = rec.y;
    this.age = 0;
    this.needsLeave = false; // after an active swap, require stepping away before re-pick
    this.denyCd = 0;
    this.sparkT = 0;
    this.nameK = 0;
    this.chips = [];
    this.chipN = 0;
    this.pulseT = 0;
    this.synergy = false;
    this.synT = 0;
    this.seen = false;
    this.plate = null;
    const shop = rec.price != null;
    this.base = Assets.makeCell(scene, this.x, this.y + 36, 'props', shop ? 'pedestal_shop' : 'pedestal', 1);
    this.base.setDepth(actorDepth(this.y + 34));
    this.glow = scene.add.image(this.x, this.y - ICON_Y, 'glow').setTint(0xffe090).setAlpha(0.35).setScale(1.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(actorDepth(this.y + 34) + 0.4);
    this.ring = scene.add.image(this.x, this.y + 14, 'ring').setTint(0xf0a640).setAlpha(0.5).setScale(0.55, 0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.floor + 4);
    this.ring2 = scene.add.image(this.x, this.y + 14, 'ring').setTint(0xffe090).setAlpha(0.3).setScale(0.4, 0.16).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.floor + 4);
    this.icon = null;
    this.label = null;
    this.tag = scene.add.text(this.x, this.y - 130, '', { fontFamily: FONT_BODY, fontSize: '24px', color: '#f5e6b8', stroke: '#120c0a', strokeThickness: 6, align: 'center' }).setOrigin(0.5, 1).setDepth(DEPTH.pickups + 4).setAlpha(0);
    if (shop) {
      this.label = scene.add.text(this.x, this.y + 52, '', { fontFamily: FONT_BODY, fontSize: '26px', color: '#f0d060', stroke: '#120c0a', strokeThickness: 5 }).setOrigin(0.5).setDepth(DEPTH.pickups + 2);
    }
    this.refresh();
  }

  get objs() { return [this.base, this.glow, this.ring, this.ring2, this.tag, this.icon, this.label, this.plate, ...this.chips].filter(Boolean); }

  /** The deal cost of this pedestal ({container,coins,keys,tin,dynamite}) or null. */
  get dealPay() {
    const d = this.rec.deal;
    if (!d) return null;
    if (typeof d === 'object') return d;
    const def = this.rec.itemId ? getItem(this.rec.itemId) : null;
    return def && def.deal ? def.deal.pay : null;
  }

  refresh() {
    const rec = this.rec;
    if (this.icon) { this.icon.destroy(); this.icon = null; }
    const def = rec.itemId ? getItem(rec.itemId) : null;
    if (def && !rec.taken) {
      const ic = def.icon || { sheet: 'items_passive_a', name: def.id };
      this.icon = Assets.makeCell(this.scene, this.x, this.y - ICON_Y, ic.sheet, ic.name, 0.5).setDepth(actorDepth(this.y + 34) + 0.5); // above the altar base (which is y-sorted)
      this.icon.setScale(0.9);
    } else if (rec.itemId && !def && !rec.taken) {
      // unknown id (item def missing): show placeholder chip so the pedestal is never blank
      this.icon = Assets.makeCell(this.scene, this.x, this.y - ICON_Y, 'items_passive_a', 'spurs', 0.5).setDepth(actorDepth(this.y + 34) + 0.5).setTint(0x888888);
    }
    this.glow.setVisible(!!this.icon);
    this.ring.setVisible(!!this.icon);
    this.ring2.setVisible(!!this.icon);
    if (this.label) this.label.setVisible(!!this.icon);
    this.syncSynergy();
    const nm = def && this.icon ? def.name.toUpperCase() : '';
    this.tag.setText(this.synergy && hintsOn() && nm ? 'SYNERGY!' : nm && rec.group != null ? `${nm}\n(TAKE ONE)` : nm);
    this.tag.setColor(this.synergy && hintsOn() ? '#ffd860' : '#f5e6b8');
    if (!this.icon) this.tag.setAlpha(0);
    this.refreshChips(def && this.icon ? def : null);
    this.refreshPlate();
  }

  /** Would taking this item complete a synergy? (spark ring + `SYNERGY!` in place of the name) */
  syncSynergy() {
    const rec = this.rec;
    this.synergy = !!(rec.itemId && !rec.taken && this.scene.items && this.scene.items.wouldComplete(rec.itemId));
  }

  /** Small coloured tag chips under the name (pooled Text objects, up to 3). */
  refreshChips(def) {
    const tags = def && def.tags ? def.tags.slice(0, 3) : [];
    for (let i = 0; i < 3; i++) {
      let c = this.chips[i];
      if (!c) {
        c = this.chips[i] = this.scene.add.text(this.x, this.y, '', { fontFamily: FONT_BODY, fontSize: '15px', color: '#e8dcc0', stroke: '#120c0a', strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(DEPTH.pickups + 4).setAlpha(0);
      }
      if (tags[i]) c.setText(tagLabel(tags[i])).setColor(tagColor(tags[i])); else c.setText('');
    }
    this.chipN = tags.length;
  }

  /** Red plate under a devil's-deal pedestal: what it costs. */
  refreshPlate() {
    const pay = this.dealPay;
    if (!pay || this.rec.taken || !this.icon) { if (this.plate) { this.plate.destroy(); this.plate = null; } return; }
    if (!this.plate) this.plate = this.scene.add.text(this.x, this.y + 58, '', { fontFamily: FONT_BODY, fontSize: '22px', color: '#ff8a7a', backgroundColor: '#3a0c10', padding: { x: 8, y: 3 }, stroke: '#120c0a', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH.pickups + 2);
    this.plate.setText(payText(pay));
  }

  update(dt) {
    this.age += dt;
    if (this.denyCd > 0) this.denyCd -= dt;
    const rec = this.rec;
    const p = this.scene.player;
    if (this.icon) {
      const bob = Math.sin(this.age * 2.4 + this.x) * 5;
      this.icon.y = this.y - ICON_Y + bob;
      this.icon.setScale(0.9 + Math.sin(this.age * 3.1 + this.x) * 0.025);
      this.glow.y = this.icon.y;
      this.glow.setAlpha(0.28 + Math.sin(this.age * 3) * 0.08);
      this.ring.setRotation(this.age * 0.8).setAlpha(0.42 + Math.sin(this.age * 2) * 0.12);
      this.ring2.setRotation(-this.age * 1.3);
      this.ring.setScale(0.55 + Math.sin(this.age * 2) * 0.02, 0.22);
      // rising sparks
      this.sparkT -= dt;
      if (this.sparkT <= 0) {
        this.sparkT = 0.35 + Math.random() * 0.3;
        this.scene.fx.burst(this.x + (Math.random() - 0.5) * 60, this.y - 20, { color: [0xffe090, 0xf0a640], count: 1, speed: [15, 45], life: [700, 1100], scale: [1.4, 2], angle: [255, 285] });
      }
      // name tag fades in when close
      const near = p && !p.dead ? Math.hypot(p.x - this.x, p.y - this.y) < 230 : false;
      this.nameK += ((near ? 1 : 0) - this.nameK) * Math.min(1, dt * 8);
      const ty = this.y - ICON_Y - 50 - this.nameK * 8 + bob * 0.5;
      this.tag.setAlpha(this.nameK).setY(ty);
      const n = this.chipN;
      for (let i = 0; i < n; i++) this.chips[i].setPosition(this.x + (i - (n - 1) / 2) * 74, ty + 6).setAlpha(this.nameK * 0.95);
      if (near && !this.seen) { this.seen = true; this.markSeen(); }
      if (near) { this.synT -= dt; if (this.synT <= 0) { this.synT = 0.6; const was = this.synergy; this.syncSynergy(); if (was !== this.synergy) this.refresh(); } }
      if (this.synergy && hintsOn()) { // gold spark ring
        const k = 0.5 + 0.5 * Math.sin(this.age * 6);
        this.ring2.setTint(0xffd860).setAlpha(0.35 + k * 0.4).setScale(0.4 + k * 0.12, 0.16 + k * 0.05);
        this.pulseT -= dt;
        if (this.pulseT <= 0) { this.pulseT = 1.4; this.scene.fx.ringPulse(this.x, this.y + 14, 0xffd860, 70, 600, 0.5); }
      } else this.ring2.setTint(0xffe090);
    }
    if (this.label && rec.price != null) {
      const pr = this.scene.player.price(rec.price);
      if (pr !== this._p) { this._p = pr; this.label.setText(`${pr}c`); }
    }
    if (!p || p.dead || !this.icon || rec.taken) return;
    const d = Math.hypot(p.x - this.x, p.y - (this.y + 4));
    if (this.needsLeave) { if (d > 90) this.needsLeave = false; return; }
    if (d < p.radius + 34 && this.age > 0.4) this.touch(p);
  }

  markSeen() {
    const id = this.rec.itemId;
    if (!id) return;
    try { Save.seeItem(id); } catch (e) { /* storage unavailable */ }
    bus.emit('item:seen', { id });
  }

  touch(p) {
    const rec = this.rec;
    const s = this.scene;
    const pay = this.dealPay;
    if (pay) { // devil's deal: pay first (ItemSystem.canPay / pay)
      if (this.denyCd > 0) return;
      const def = getItem(rec.itemId);
      const ok = s.items.canPay(p, { deal: { pay } });
      if (ok !== true) {
        this.denyCd = 1.2;
        s.fx.text(this.x, this.y - 60, ok === true ? '' : 'CANNOT PAY', { color: '#d63a2a', size: 22 });
        bus.emit('pickup:denied', { id: rec.itemId });
        return;
      }
      s.items.pay(p, { id: def ? def.id : rec.itemId, deal: { pay } }, { emit: true });
      rec.deal = null;
    }
    if (rec.price != null) {
      if (this.denyCd > 0) return;
      if (!tryBuy(s, p, p.price(rec.price), this)) { this.denyCd = 1.2; return; }
      rec.price = null; // bought: it is now a plain item
      if (this.label) { this.label.destroy(); this.label = null; }
    }
    const id = rec.itemId;
    const group = rec.group;
    const prev = s.items.pickup(p, id, rec.price != null ? 'shop' : 'pedestal');
    if (prev) { rec.itemId = prev; rec.group = null; this.needsLeave = true; this.refresh(); } // swapped active: the old one stays, free to take back
    else { rec.taken = true; rec.itemId = null; this.refresh(); }
    s.fx.burst(this.x, this.y - ICON_Y, { color: [0xffe090, 0xffffff], count: 14, speed: [60, 220] });
    // pick-one groups: the others vanish (also when an active was swapped)
    if (group != null) this.room.resolveGroup(group, this);
  }

  vanish() {
    if (this.rec.taken) return;
    if (this.rec.itemId) this.scene.items.release(this.rec.itemId);
    this.rec.taken = true; this.rec.itemId = null;
    this.scene.fx.deathPuff(this.x, this.y - 40, 0.9);
    this.scene.fx.burst(this.x, this.y - 40, { color: [0x8a7a68, 0xe8dcc0], count: 10, speed: [40, 160] });
    this.refresh();
  }

  destroy() {
    for (const o of this.objs) o.destroy();
    this.icon = null; this.label = null;
  }
}
