import { registerItem } from '../registry.js';
import DeadEyeSight from '../familiars/DeadEyeSight.js';

// First shot after 2 s without shooting: x3 damage (+1 per extra copy) and pierces (Player.fire). +1 luck. DeadEyeSight shows the charge.
registerItem({
  id: 'dead_eye', name: 'Dead Eye', desc: 'First shot after 2 s of patience: x3 damage, pierces. +1 luck', type: 'passive', pool: ['treasure', 'boss'],
  icon: { sheet: 'items_passive_a', name: 'dead_eye' },
  tags: ['crit', 'luck'], tier: 3,
  lore: "Patience is a bullet that has not left yet.",
  apply(player, { stats, count }) { stats.deadEye = Math.max(stats.deadEye, 2 + count); stats.luck += 1; },
  onPickup(player) { if (!player.familiars.some((f) => f instanceof DeadEyeSight)) player.addFamiliar(new DeadEyeSight(player)); },
  onRestore(player) { if (!player.familiars.some((f) => f instanceof DeadEyeSight)) player.addFamiliar(new DeadEyeSight(player)); },
});
