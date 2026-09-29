// Shared buy flow for shop pickups and shop pedestals.
import { bus } from '../core/events.js';

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
