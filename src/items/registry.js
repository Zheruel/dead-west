// Item registry (kept separate from index.js so def files can import it without circular-import TDZ problems). Pure (node-safe).
import { isTag } from './tags.js';

const defs = new Map();

export const POOLS = ['treasure', 'shop', 'boss', 'secret', 'crossroads'];
export const GATES = ['gulch', 'perdition', 'mine', 'c2', 'sixth', 'pyro', 'holy', 'sniper', 'gambler', 'occult', 'bloodpact', 'chaos', 'ghost', 'lawman', 'undead', 'beast', 'scrap'];
const HOOKS = ['fire', 'sixthFired', 'hit', 'bulletEnd', 'kill', 'hurt', 'hurtPost', 'bounce', 'deathSave', 'roll', 'rollEnd', 'roomEnter', 'wave', 'roomClear', 'explosion', 'collect', 'coins', 'floor', 'update'];

/**
 * registerItem({
 *   id, name (<= 22 chars), desc (<= 70 chars), type:'passive'|'active', pool:['treasure','shop','boss','secret','crossroads'] (+ marker 'c2' = floor >= 4 only),
 *   weight?: 1, icon:{sheet, name}, tags?: [...26 tags], tier?: 1|2|3 (default 2), lore?: 'flavour line', gate?: '<gate id>' (unlock, see GATES),
 *   minFloor?: 1, charOnly?: 'preacher'|..., deal?: {pay:{container?, coins?, keys?, tin?, dynamite?}} (crossroads only),
 *   hooks?: { fire, sixthFired, hit, bulletEnd, kill, hurt, hurtPost, bounce, deathSave, roll, rollEnd, roomEnter, wave, roomClear, explosion,
 *             collect, coins, floor, update }  each (player, ctx, {scene, stats, count, state}) => result   (see items/hooks.js)
 *   state?: () => ({...})      per-run scratch, stored at player.itemState[id]; created on pickup, reset at run start
 *   apply(player, api)         // PURE stat modifier, called on every recomputeStats for each copy owned. Mutate player.stats only.
 *   applyLate?(player, api)    // stat modifier that needs the final stats (hp-dependent items), runs after every apply
 *   onPickup?(player, api)     // one-shot effect (heal, +hearts container, give familiar...). Called once per pickup.
 *   onRestore?(player, api)    // checkpoint restore: re-create runtime objects only (familiars), never re-run one-shot effects
 *   charges?: n                // actives: room clears to fully charge
 *   use?(player, api)          // actives: return false to cancel (charge not consumed)
 * })
 * api = { stats, count (copies owned incl. this), scene, player }
 */
export function registerItem(def) {
  if (!def || !def.id) throw new Error('registerItem: id required');
  const d = {
    type: 'passive', pool: ['treasure'], weight: 1, tags: [], tier: 2, lore: '', gate: null, minFloor: 1, deal: null, hooks: {}, state: null, charOnly: null,
    ...def,
  };
  const bad = d.tags.filter((t) => !isTag(t));
  if (bad.length) { console.error(`[items] ${d.id}: unknown tags ${bad.join(', ')} (dropped)`); d.tags = d.tags.filter((t) => isTag(t)); }
  defs.set(d.id, d);
  return d;
}
export const getItem = (id) => defs.get(id);
export const allItems = () => [...defs.values()];
export const itemCount = () => defs.size;

/** Static validation of one def -> array of problem strings (empty = fine). Used by items2-static.mjs and by the dev console. */
export function validateDef(d) {
  const p = [];
  if (!/^[a-z0-9_]+$/.test(d.id)) p.push('id must be snake_case');
  if (!d.name || d.name.length > 22) p.push(`name missing or > 22 chars (${d.name ? d.name.length : 0})`);
  if (!d.desc || d.desc.length > 70) p.push(`desc missing or > 70 chars (${d.desc ? d.desc.length : 0})`);
  if (d.type !== 'passive' && d.type !== 'active') p.push('type must be passive|active');
  if (!Array.isArray(d.pool)) p.push('pool must be an array');
  else for (const x of d.pool) if (x !== 'c2' && !POOLS.includes(x)) p.push(`unknown pool ${x}`);
  for (const t of d.tags || []) if (!isTag(t)) p.push(`unknown tag ${t}`);
  if (![1, 2, 3].includes(d.tier)) p.push('tier must be 1|2|3');
  if (d.gate != null && !GATES.includes(d.gate)) p.push(`unknown gate ${d.gate}`);
  if (!d.icon || !d.icon.sheet || !d.icon.name) p.push('icon {sheet,name} missing');
  for (const h of Object.keys(d.hooks || {})) if (!HOOKS.includes(h)) p.push(`unknown hook ${h}`);
  if (d.type === 'active' && !(d.charges > 0)) p.push('active needs charges');
  if (d.pool && d.pool.includes('crossroads')) {
    if (!d.deal || !d.deal.pay) p.push('crossroads item needs deal.pay');
    if (d.pool.some((x) => x !== 'crossroads' && x !== 'c2')) p.push('crossroads item may only use pool crossroads (+c2)');
  } else if (d.deal) p.push('deal only allowed on crossroads items');
  return p;
}
