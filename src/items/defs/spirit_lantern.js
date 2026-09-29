import { registerItem } from '../registry.js';
import SpiritLantern from '../familiars/SpiritLantern.js';

// Each copy adds one orbiting ghost-flame (see familiars/SpiritLantern.js).
registerItem({
  id: 'spirit_lantern', name: 'Spirit Lantern', desc: 'A ghost-flame orbits you, burning foes and blocking bullets', type: 'passive', pool: ['treasure', 'boss'],
  icon: { sheet: 'items_passive_c', name: 'spirit_lantern' },
  onPickup(player) { player.addFamiliar(new SpiritLantern(player)); },
});
