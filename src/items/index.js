// Importing this module registers every item in src/items/defs/*.js (Vite import.meta.glob, eager) and the item asset specs.
import './fx/assetSpecs.js';
import './registry.js';
import.meta.glob('./defs/*.js', { eager: true });
export { registerItem, getItem, allItems, itemCount, validateDef, POOLS, GATES } from './registry.js';
export { default as ItemSystem, canPay, payDeal } from './ItemSystem.js';
export { TAGS, TAG_LIST, TAG_IDS, isTag, tagColor, tagLabel, tagCounts, itemsWithTag, ownedIds, countTags } from './tags.js';
export { HOOK_NAMES, runHooks, hasHook, rebuildHooks, CTX } from './hooks.js';
export { SYNERGIES, SYN_BY_ID, SYN_IDS, evaluateSynergies, wouldComplete, synergiesFor, reqLabel } from './synergies.js';
export { codexEntries, synergyEntries } from './codexData.js';
export { ITEM_BASE_V2, ITEM_CAPS, applyCaps, shopPrice, tierMult } from './baseStats.js';
export { itemFx } from './fx/ItemFx.js';
export { firePool } from './fx/FirePool.js';
export { nova } from './fx/Nova.js';
