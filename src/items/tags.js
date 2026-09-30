// Item tags (ITEMS_V2 s3). Pure data + helpers (node-safe; registry.js is Phaser-free).
// Count rule: a tag count = number of UNIQUE owned item defs (passives + the active) carrying the tag; extra copies count once.
import { getItem, allItems } from './registry.js';

const T = (id, label, css) => ({ id, label, css });
export const TAG_LIST = [
  T('fire', 'FIRE', '#ff8a40'), T('poison', 'POISON', '#9be060'), T('frost', 'FROST', '#9fd8ff'), T('shock', 'SHOCK', '#ffe070'),
  T('holy', 'HOLY', '#fff0b0'), T('explosive', 'EXPLOSIVE', '#f0a640'), T('dynamite', 'DYNAMITE', '#d9b071'), T('ghost', 'GHOST', '#8fe0c0'),
  T('luck', 'LUCK', '#8fc23f'), T('gold', 'GOLD', '#e8c84a'), T('undead_slayer', 'UNDEAD SLAYER', '#e8dcc0'), T('familiar', 'FAMILIAR', '#b8a0ff'),
  T('sixth', 'SIXTH', '#ffc040'), T('crit', 'CRIT', '#ffb0a0'), T('armor', 'ARMOR', '#b0b8c0'), T('speed', 'SPEED', '#f0d090'),
  T('rapid', 'RAPID', '#f0d090'), T('spread', 'SPREAD', '#d9b071'), T('bounce', 'BOUNCE', '#c0c0ff'), T('pierce', 'PIERCE', '#e0e0e0'),
  T('blood', 'BLOOD', '#d63a2a'), T('roll', 'ROLL', '#c8a878'), T('curse', 'CURSE', '#a02c24'), T('hex', 'HEX', '#b070ff'),
  T('ammo', 'AMMO', '#e8dcc0'), T('heal', 'HEAL', '#ff8a7a'),
];
/** id -> {id, label, css}. */
export const TAGS = Object.fromEntries(TAG_LIST.map((t) => [t.id, t]));
export const TAG_IDS = TAG_LIST.map((t) => t.id);
export const isTag = (id) => Object.prototype.hasOwnProperty.call(TAGS, id);
export const tagColor = (id) => (TAGS[id] ? TAGS[id].css : '#e8dcc0');
export const tagLabel = (id) => (TAGS[id] ? TAGS[id].label : String(id).toUpperCase());

/** Unique owned item ids of a player (passives + active) as an array. */
export function ownedIds(player) {
  const out = [];
  const seen = new Set();
  for (const id of player.items) if (!seen.has(id)) { seen.add(id); out.push(id); }
  if (player.active && !seen.has(player.active.id)) out.push(player.active.id);
  return out;
}

/** Tag counts for a list of unique item ids -> {tag: n} (only tags with n >= 1). */
export function countTags(ids, out = {}) {
  for (const k in out) delete out[k];
  for (let i = 0; i < ids.length; i++) {
    const def = getItem(ids[i]);
    if (!def || !def.tags) continue;
    for (let j = 0; j < def.tags.length; j++) { const t = def.tags[j]; out[t] = (out[t] || 0) + 1; }
  }
  return out;
}
/** Tag counts of a player: {tag: n} of UNIQUE owned defs. */
export const tagCounts = (player) => countTags(ownedIds(player));
/** All registered defs carrying `tag`. */
export const itemsWithTag = (tag) => allItems().filter((d) => d.tags && d.tags.includes(tag));
