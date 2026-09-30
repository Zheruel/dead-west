import { registerItem } from '../registry.js';
import CrowCompanion from '../familiars/CrowCompanion.js';

// Each copy adds one crow (see familiars/CrowCompanion.js).
registerItem({
  id: 'crow_companion', name: 'Crow Companion', desc: 'A crow follows you and pecks the nearest foe (half damage)', type: 'passive', pool: ['treasure', 'boss', 'secret'],
  icon: { sheet: 'items_passive_c', name: 'crow_companion' },
  tags: ['familiar'], tier: 2,
  lore: 'He is not a pet. He is a witness who works for scraps.',
  onPickup(player) { player.addFamiliar(new CrowCompanion(player)); },
  onRestore(player, { count }) { for (let i = 0; i < count; i++) player.addFamiliar(new CrowCompanion(player)); },
});
