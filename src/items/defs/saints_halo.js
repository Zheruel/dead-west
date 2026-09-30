import { registerItem } from '../registry.js';
import SaintsHalo from '../familiars/SaintsHalo.js';

// haloCharges +1 per copy: the next hit of ANY source is absorbed (Player.damage), a 200 px holy nova (3 x damage, wipes bullets) fires, and the charges come
// back on the next floor (floor:changed). The familiar is the floating halo that shows whether it is armed.
const has = (p) => p.familiars.some((f) => f instanceof SaintsHalo);

registerItem({
  id: 'saints_halo', name: "Saint's Halo", desc: 'A halo absorbs one hit per floor, then blasts', type: 'passive', pool: ['boss', 'c2'], weight: 0.4,
  icon: { sheet: 'items2_c', name: 'saints_halo' },
  tags: ['holy', 'armor', 'familiar'], tier: 3, gate: 'c2',
  lore: 'Borrowed. Do not ask from whom.',
  apply(player, { stats }) { stats.haloCharges += 1; },
  onPickup(player) { if (!has(player)) player.addFamiliar(new SaintsHalo(player)); },
  onRestore(player) { if (!has(player)) player.addFamiliar(new SaintsHalo(player)); },
});
