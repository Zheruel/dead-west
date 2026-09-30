// Data feeds for the Codex scene (ITEMS_V2 s7): every registered item and the 26 synergies with their seen / unlocked state.
// Pure over `save` (default: the Save singleton), so tests can pass a stub. The Codex draws unseen entries as a black icon and `???`.
import { allItems } from './registry.js';
import { SYNERGIES, synergiesFor, reqLabel } from './synergies.js';
import { Save } from '../core/Save.js';

const codexMap = (save, kind) => {
  try { const g = save.get(); return (g && g.codex && g.codex[kind]) || {}; } catch (e) { return {}; }
};

/** -> [{id, name, desc, lore, tags, type, tier, pools, unlocked, seen, synergyIds, icon, gate, charOnly}] in registry order. */
export function codexEntries(save = Save) {
  const seenMap = codexMap(save, 'items');
  return allItems().map((d) => {
    let unlocked = true;
    try { unlocked = typeof save.itemUnlocked === 'function' ? save.itemUnlocked(d.id) !== false : true; } catch (e) { unlocked = true; }
    return {
      id: d.id, name: d.name, desc: d.desc, lore: d.lore || '', tags: d.tags || [], type: d.type, tier: d.tier || 2,
      pools: (d.pool || []).filter((p) => p !== 'c2'), unlocked, seen: (seenMap[d.id] || 0) >= 1,
      synergyIds: synergiesFor(d.id).map((s) => s.id), icon: d.icon, gate: d.gate || null, charOnly: d.charOnly || null,
    };
  });
}

/** -> [{id, name, kind, reqLabel, desc, seen, cue}] in evaluation order (pairs, tag thresholds, capstones). */
export function synergyEntries(save = Save) {
  const seenMap = codexMap(save, 'synergies');
  return SYNERGIES.map((s) => ({ id: s.id, name: s.name, kind: s.kind, reqLabel: reqLabel(s), desc: s.desc, cue: s.cue, seen: !!seenMap[s.id] }));
}
