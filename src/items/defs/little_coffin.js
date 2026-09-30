import { registerItem } from '../registry.js';
import LittleCoffin from '../familiars/LittleCoffin.js';

// A tiny coffin (familiars/LittleCoffin.js) hops behind you and, while foes live, lets 2 bats loose every 5 s (+1 bat per extra copy, so only one coffin exists).
const has = (p) => p.familiars.some((f) => f instanceof LittleCoffin);

registerItem({
  id: 'little_coffin', name: 'Little Coffin', desc: 'A tiny coffin lets loose friendly bats', type: 'passive', pool: ['treasure', 'boss', 'c2'], weight: 0.7,
  icon: { sheet: 'items2_c', name: 'little_coffin' },
  tags: ['familiar'], tier: 2, gate: 'perdition',
  lore: 'Room for one more. Or a dozen bats.',
  onPickup(player) { if (!has(player)) player.addFamiliar(new LittleCoffin(player)); },
  onRestore(player) { if (!has(player)) player.addFamiliar(new LittleCoffin(player)); },
});
