import { registerItem } from '../registry.js';

// Devil's deal (1 heart container): rise twice from death. The revive itself lives in Player.tryRevive (ARCH D7 order black_cat_bone,
// ace_in_hole, lazarus_pact): 2 hp, a 260 px blast, bullets wiped, one heart container lost per rise (heartDebt), the item removed after the
// second rise. The two charges live in itemState.lazarus_pact. No `deathSave` hook on purpose (it would revive a second time in the same hit).
registerItem({
  id: 'lazarus_pact', name: 'Lazarus Pact', desc: 'Rise twice from death, weaker each time', type: 'passive', pool: ['crossroads', 'c2'], weight: 1,
  icon: { sheet: 'items2_f', name: 'lazarus_pact' },
  tags: ['heal', 'curse'], tier: 3, gate: 'bloodpact',
  deal: { pay: { container: 1 } },
  state: () => ({ charges: 2 }),
  lore: 'Terms: you rise. Ours to keep.',
});
