import { registerItem } from '../registry.js';

// Devil's deal (4 tin): every shot is a ghost bullet (spectral, +1 pierce, x1.15) with +2 pierce and a little homing, at 75% damage, and the
// Hunted curse marks you (cursed-elite chance x2.5, Room / Affixes read `curseHunted`). Copies of Hunted from other deals do not stack.
registerItem({
  id: 'reapers_bargain', name: "Reaper's Bargain", desc: 'All shots ghostly and piercing. You are hunted', type: 'passive', pool: ['crossroads', 'c2'], weight: 1,
  icon: { sheet: 'items2_e', name: 'reapers_bargain' },
  tags: ['ghost', 'pierce', 'curse'], tier: 3, gate: 'ghost',
  deal: { pay: { tin: 4 } },
  lore: 'He does not haggle.',
  apply(player, { stats }) {
    stats.ghostChance = 1;
    stats.pierce += 2;
    stats.homing += 0.15;
    stats.bulletDamageMult *= 0.75;
    stats.curseHunted = Math.max(stats.curseHunted, 1);
  },
});
