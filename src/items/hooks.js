// Hook dispatcher (ITEMS_V2 s2.2). Items and active synergies declare `hooks: { name(player, ctx, api) {...} }`.
//
//   runHooks(player, name, ctx)   iterates unique owned items, then active synergies. Skipped (one array lookup) when nothing owned defines the hook.
//   api = { player, scene, stats, count, state }   `state` = player.itemState[id] (per-run scratch, see def.state)
//
// Hook       fired from                                   ctx                                                           return
//   fire        end of Player.fire                          {aim, bullets[], sixth, dead, luckCrit}                       -
//   sixthFired  Player.fire when the shot is a Sixth        as `fire`                                                     -
//   hit         Bullets.update after a landed hit           {b, enemy, dealt, sixth, killed}   (skipped for child bullets) -
//   bulletEnd   Bullets.kill (player bullets)               {b, reason}                                                   -
//   kill        Enemy.die (before destroy)                  {enemy, info, st}  st = statuses at death {burn,poison,chill,frozen,mark}   -
//   hurt        Player.damage after room shield/halo        {units, source}                                               {cancel:true} | {units}
//   hurtPost    Player.damage after damage was applied      {units, source, hp}                                           -
//   bounce      Bullets wall / obstacle ricochet            {b}                                                           -
//   deathSave   Player.tryRevive (after the built-ins)      {source}                                                      true = revived
//   roll        Player.startRoll                            {dir}                                                         -
//   rollEnd     roll timeout                                {dir}                                                         -
//   roomEnter   room:entered                                {room}                                                        -
//   wave        room:wave                                   {room, enemies}                                               -
//   roomClear   room:cleared                                {room, perfect}  perfect = no damage taken in the room        -
//   explosion   end of explode()                            {x, y, radius, source, owner, kills}                          -
//   collect     Player.collect before applying              {type}                                                        false = swallowed | {type, amount} = converted
//   coins       any coin change (player.recomputeStats follows) {coins}                                                   -
//   floor       floor:changed                               {floor}                                                       -
//   update      Player.update                               {dt}                                                          -
//
// Rules for hook code: never allocate per call in `update`/`fire`/`hit`/`bulletEnd`; never keep `ctx` (the objects are shared and reused).
// roomEnter / wave / roomClear are fired from the bus by ItemSystem AND may be called directly by Room; a same-frame duplicate is dropped.
import { getItem } from './registry.js';
import { SYN_BY_ID } from './synergies.js';

export const HOOK_NAMES = ['fire', 'sixthFired', 'hit', 'bulletEnd', 'kill', 'hurt', 'hurtPost', 'bounce', 'deathSave', 'roll', 'rollEnd', 'roomEnter', 'wave', 'roomClear', 'explosion', 'collect', 'coins', 'floor', 'update'];

/** Shared, reused context objects. Callers fill the fields and pass the object; hooks must not retain it. */
export const CTX = {
  fire: { aim: null, bullets: [], sixth: false, dead: false, luckCrit: false },
  hit: { b: null, enemy: null, dealt: 0, sixth: false, killed: false },
  bulletEnd: { b: null, reason: '' },
  kill: { enemy: null, info: null, st: null },
  hurt: { units: 0, source: null },
  hurtPost: { units: 0, source: null, hp: 0 },
  bounce: { b: null },
  deathSave: { source: null },
  roll: { dir: null },
  explosion: { x: 0, y: 0, radius: 0, source: null, owner: 'player', kills: 0 },
  collect: { type: '' },
  coins: { coins: 0 },
  floor: { floor: 1 },
  update: { dt: 0 },
  room: { room: null, perfect: false, enemies: 0 },
};

const dedupe = { roomEnter: null, wave: null, roomClear: null };
const dedupeFrame = { roomEnter: -1, wave: -1, roomClear: -1 };

/** Rebuild the per-hook lists of `player` (call when items, the active or the synergy set change). */
export function rebuildHooks(player) {
  const lists = player._hooks || (player._hooks = {});
  for (const n of HOOK_NAMES) { if (lists[n]) lists[n].length = 0; }
  const counts = new Map();
  for (const id of player.items) counts.set(id, (counts.get(id) || 0) + 1);
  if (player.active) counts.set(player.active.id, (counts.get(player.active.id) || 0) + 1);
  const add = (def, count, state) => {
    const h = def && def.hooks;
    if (!h) return;
    for (const n of HOOK_NAMES) {
      const fn = h[n];
      if (typeof fn !== 'function') continue;
      (lists[n] || (lists[n] = [])).push({ fn, api: { player, scene: player.scene, stats: player.stats, count, state, def } });
    }
  };
  for (const [id, count] of counts) add(getItem(id), count, player.itemState[id]);
  if (player.synergies) for (const id of player.synergies) add(SYN_BY_ID[id], 1, player.itemState['syn:' + id] || (player.itemState['syn:' + id] = {}));
  return lists;
}

/** True when any owned item / active synergy defines hook `name`. */
export function hasHook(player, name) {
  const l = player._hooks && player._hooks[name];
  return !!(l && l.length);
}

/** Run hook `name`. Returns the last non-undefined result (`hurt`: a cancel result wins; `deathSave`: true wins). */
export function runHooks(player, name, ctx) {
  const list = player._hooks && player._hooks[name];
  if (!list || !list.length) return undefined;
  if (name in dedupe) {
    const room = ctx && ctx.room;
    const frame = player.scene && player.scene.game ? player.scene.game.loop.frame : 0;
    const key = name === 'wave' && room ? room.waveIdx : 0;
    if (dedupe[name] === room && dedupeFrame[name] === frame && (name !== 'wave' || dedupe.waveKey === key)) return undefined;
    dedupe[name] = room; dedupeFrame[name] = frame; if (name === 'wave') dedupe.waveKey = key;
  }
  let ret;
  for (let i = 0; i < list.length; i++) {
    const h = list[i];
    let r;
    try { r = h.fn(player, ctx, h.api); } catch (e) { if (!h.warned) { h.warned = true; console.error(`[hooks] ${name}`, e); } continue; }
    if (r === undefined) continue;
    ret = r;
    if ((name === 'hurt' && r && r.cancel) || (name === 'deathSave' && r === true) || (name === 'collect' && r === false)) break;
  }
  return ret;
}
