import { registerItem } from '../registry.js';
import ShieldPip from '../familiars/ShieldPip.js';

// Ignore the first hit in every room: roomShield shields are refilled by Player.onRoomEntered and consumed in Player.damage.
registerItem({
  id: 'duster_coat', name: 'Duster Coat', desc: 'Ignore the first hit in every room', type: 'passive', pool: ['treasure', 'shop', 'boss'],
  icon: { sheet: 'items_passive_c', name: 'duster_coat' },
  apply(player, { stats }) { stats.roomShield += 1; },
  onPickup(player, { stats }) {
    player.shieldLeft = Math.max(player.shieldLeft, stats.roomShield); // active immediately, not only from the next room
    if (!player.familiars.some((f) => f instanceof ShieldPip)) player.addFamiliar(new ShieldPip(player));
  },
});
