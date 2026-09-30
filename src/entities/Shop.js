// Shared buy flow for shop pickups and shop pedestals, plus the shop price helpers.
import { bus } from '../core/events.js';
import { shopPrice } from '../items/baseStats.js';
import { RNG, hashStr, getSeed } from '../core/rng.js';
import { Sfx } from '../core/Audio.js';
import { PEDDLER, peddlerGreeting, pickLine } from '../data/story/dialogue.js';
import DealerSpeech from './DealerSpeech.js';

export { shopPrice };

/** Try to pay `price` (already discounted). Returns true and deducts coins on success. */
export function tryBuy(scene, player, price, at) {
  if (player.coins >= price) {
    player.coins -= price;
    bus.emit('shop:bought', { price, type: at && at.type ? at.type : 'item' });
    if (at) scene.fx.text(at.x, at.y - 60, `-${price}c`, { color: '#e8b83a' });
    return true;
  }
  bus.emit('pickup:denied', { price, type: at && at.type ? at.type : 'item' });
  if (at) scene.fx.text(at.x, at.y - 60, `NEED ${price}c`, { color: '#d63a2a', size: 22 });
  return false;
}
export const priceLabel = (p) => `${p}c`;

/** Base price of an item on a shop table: tier price (+2 active, +3 on floors 4-6). Player.price() applies mutators, discounts and curses. */
export const itemShopPrice = (def, floor = 1) => shopPrice(def, floor);
/** Base price of a red-heart offer: the room's number plus the difficulty surcharge (Hell +1). */
export const heartShopPrice = (base, diff) => base + (diff && diff.shopHeartPlus ? diff.shopHeartPlus : 0);

// ------------------------------------------------------------------------------------------------ the peddler talks (STORY 11.1)
/** DealerSpeech with its own (higher, quieter) typing voice for the skeleton huckster; same parchment tag, 40 cps, hold 2.8 s. */
class PeddlerSpeech extends DealerSpeech {
  update(dt) {
    if (this.state === 'idle' || this.destroyed) return;
    if (this.state === 'type') {
      this.chars += 40 * dt;
      const n = Math.min(this.full.length, Math.floor(this.chars));
      if (n !== this.shown) {
        this.shown = n;
        this.text.setText(this.full.slice(0, n));
        if (n % 4 === 0) Sfx.play('dealer_mumble', { vol: 0.35, gap: 0.09, detune: 700 });
      }
      if (n >= this.full.length) { this.state = 'hold'; this.hold = 2.8; }
    } else if (this.state === 'hold') {
      this.hold -= dt;
      if (this.hold <= 0) { this.state = 'fade'; this.alpha = 1; }
    } else if (this.state === 'fade') {
      this.alpha -= dt / 0.3;
      if (this.alpha <= 0) this.clear();
      else { this.tag.setAlpha(this.alpha); this.text.setAlpha(this.alpha); }
    }
  }
}

/**
 * Wires the 24 peddler lines (data/story/dialogue.js) to the shop room: greeting on entering (rider / floor / return variants), a line per purchase,
 * a refusal when a price cannot be paid, "sold out" once nothing is left, and a parting shot as the player slides out. One speech tag per shop visit,
 * tracked by the room (destroyed with it). Called once per GameScene by ItemSystem; listeners are scene-scoped.
 */
export function installPeddler(scene) {
  let sp = null, room = null, visits = 0, denyCd = 0, greetTimer = null;
  const rng = new RNG(hashStr(`peddler:${getSeed()}`));
  const last = {};
  const line = (cat) => { const l = pickLine(PEDDLER[cat], rng, last[cat]); last[cat] = l; return l; };
  const stock = (r) => {
    let n = 0;
    for (const p of r.pickups || []) if (p.alive && p.basePrice != null) n++;
    for (const d of r.pedestals || []) if (d.rec && d.rec.price != null && !d.rec.taken) n++;
    return n;
  };
  const active = () => (sp && room && !room.destroyed && scene.room === room && room.peddler ? sp : null);
  const say = (text, instant) => {
    const s = active();
    if (!s || !text) return;
    const ped = room.peddler;
    s.x = Math.max(300, Math.min(1140, ped.x));
    s.y = Math.max(230, ped.y - ped.displayHeight * (ped.originY ?? 1) - 4);
    s.say(text);
    if (instant) { s.chars = text.length; s.shown = text.length; s.text.setText(text); s.state = 'hold'; }
  };
  const drop = () => { if (greetTimer) { greetTimer.remove(false); greetTimer = null; } if (sp) { sp.destroy(); sp = null; } room = null; };
  bus.scoped(scene, 'room:entered', (p) => {
    drop();
    const r = p && p.room;
    if (!r || r.type !== 'shop' || !r.peddler) return;
    room = r; visits++; denyCd = 0;
    sp = new PeddlerSpeech(scene, { x: r.peddler.x, y: r.peddler.y - 120, seed: `${getSeed()}:${r.def && r.def.seed}`, track: (o) => r.track(o) });
    const soldOut = stock(r) === 0;
    const text = soldOut ? line('sold_out') : peddlerGreeting({ char: (scene.player && scene.player.char) || 'gunslinger', floor: scene.floorNum || 1, visits, rng, last: last.greet });
    if (!soldOut) last.greet = text;
    greetTimer = scene.time.delayedCall(450, () => { greetTimer = null; say(text); });
  });
  bus.scoped(scene, 'shop:bought', () => {
    if (!active()) return;
    scene.time.delayedCall(80, () => { if (active()) say(stock(room) === 0 ? line('sold_out') : line('buy')); }); // stock is updated a frame after the purchase
  });
  bus.scoped(scene, 'pickup:denied', (e) => {
    if (!active() || !e || e.price == null || denyCd > 0) return;
    denyCd = 2.5; say(line('deny'));
  });
  bus.scoped(scene, 'room:transition', (e) => {
    if (!active() || !e || e.from !== (room.def && room.def.id)) return;
    say(line('leave'), true); // drawn into the slide snapshot with the old room; gone one frame later
    const s = sp; sp = null;
    scene.time.delayedCall(0, () => s.destroy());
    drop();
  });
  const tick = (t, ms) => { const dt = Math.min(ms, 100) / 1000; if (denyCd > 0) denyCd -= dt; if (sp) sp.update(dt); };
  scene.events.on('update', tick);
  const off = () => { scene.events.off('update', tick); scene.events.off('shutdown', off); scene.events.off('destroy', off); drop(); };
  scene.events.once('shutdown', off);
  scene.events.once('destroy', off);
}
