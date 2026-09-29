// Item registry (kept separate from index.js so def files can import it without circular-import TDZ problems).
const defs = new Map();

/**
 * registerItem({
 *   id, name, desc, type:'passive'|'active', pool:['treasure','shop','boss','secret'], weight?:1,
 *   icon:{sheet:'items_passive_a', name:'spurs'},
 *   apply(player, api)        // PURE stat modifier. Called on every recomputeStats for each copy owned. Mutate player.stats only.
 *   onPickup?(player, api)    // one-shot effect (heal, +hearts container, give familiar...). Called once per pickup.
 *   charges?: n               // actives: room clears to fully charge
 *   use?(player, api)         // actives: return false to cancel (charge not consumed)
 * })
 * api = { stats, count (copies owned incl. this), scene, player }
 */
export function registerItem(def) {
  if (!def || !def.id) throw new Error('registerItem: id required');
  defs.set(def.id, { type: 'passive', pool: ['treasure'], weight: 1, ...def });
}
export const getItem = (id) => defs.get(id);
export const allItems = () => [...defs.values()];
