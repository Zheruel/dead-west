import { registerItem } from '../registry.js';

// Devil's deal (3 dynamite): every shot burns (burn chance 1) for 2.5x fire damage (7.5 dps), burning enemies spread it 120 px on death and
// burning kills leave an 80 px fire pool (Kill.js). Drawback: `burnPoolHurts` makes those pools enemy-team FirePatches, so they burn you too
// (1 unit per second while standing in them; `pyroImmune` / `explosionImmune` are immune).
registerItem({
  id: 'pact_of_ashes', name: 'Pact of Ashes', desc: 'All shots burn, 2.5x fire damage. Ash burns you too', type: 'passive', pool: ['crossroads'], weight: 1,
  icon: { sheet: 'items2_f', name: 'pact_of_ashes' },
  tags: ['fire', 'curse'], tier: 3, gate: 'chaos',
  deal: { pay: { dynamite: 3 } },
  lore: 'Read it and it reads you.',
  apply(player, { stats }) {
    stats.burn = 1;
    stats.burnDpsMult *= 2.5;
    stats.burnSpread = Math.max(stats.burnSpread, 120);
    stats.burnPoolR = Math.max(stats.burnPoolR, 80);
    stats.burnPoolHurts = 1;
  },
});
