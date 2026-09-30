// Shared buy flow for shop pickups and shop pedestals, plus the shop price helpers.
import { bus } from '../core/events.js';
import { shopPrice } from '../items/baseStats.js';

export { shopPrice };

/** Try to pay `price` (already discounted). Returns true and deducts coins on success. */
export function tryBuy(scene, player, price, at) {
  if (player.coins >= price) {
    player.coins -= price;
    bus.emit('shop:bought', { price });
    if (at) scene.fx.text(at.x, at.y - 60, `-${price}c`, { color: '#e8b83a' });
    return true;
  }
  bus.emit('pickup:denied', { price });
  if (at) scene.fx.text(at.x, at.y - 60, `NEED ${price}c`, { color: '#d63a2a', size: 22 });
  return false;
}
export const priceLabel = (p) => `${p}c`;

/** Base price of an item on a shop table: tier price (+2 active, +3 on floors 4-6). Player.price() applies mutators, discounts and curses. */
export const itemShopPrice = (def, floor = 1) => shopPrice(def, floor);
/** Base price of a red-heart offer: the room's number plus the difficulty surcharge (Hell +1). */
export const heartShopPrice = (base, diff) => base + (diff && diff.shopHeartPlus ? diff.shopHeartPlus : 0);
