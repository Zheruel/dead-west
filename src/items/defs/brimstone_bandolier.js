import { registerItem } from '../registry.js';

// Devil's deal (1 heart container): dynamite regrows (1 stick per 6 s up to 3), blasts are twice as strong and 60 px wider. Drawback:
// `explosionVuln` cancels explosion immunity (dynamite_vest) and every blast that hits you costs one extra unit (Player.damage / recomputeStats).
registerItem({
  id: 'brimstone_bandolier', name: 'Brimstone Bandolier', desc: 'Dynamite regrows and hits x2. Blasts hurt you', type: 'passive', pool: ['crossroads', 'c2'], weight: 1,
  icon: { sheet: 'items2_f', name: 'brimstone_bandolier' },
  tags: ['dynamite', 'explosive', 'curse'], tier: 3, gate: 'bloodpact',
  deal: { pay: { container: 1 } },
  lore: 'Smells of eggs and regret.',
  apply(player, { stats }) {
    stats.dynamiteRegen = 6;
    stats.dynamiteRegenCap = Math.max(stats.dynamiteRegenCap, 3);
    stats.dynamiteDamage *= 2;
    stats.dynamiteRadius += 60;
    stats.explosionVuln = 1;
  },
});
