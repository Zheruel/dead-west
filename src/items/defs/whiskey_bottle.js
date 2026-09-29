import { registerItem } from '../registry.js';
import { Sfx } from '../../core/Audio.js';

// Active (4 room clears): heal one heart (2 units). Refuses (charge kept) when already at full health.
registerItem({
  id: 'whiskey_bottle', name: 'Whiskey Bottle', desc: 'Heals one heart. Recharges by clearing rooms.', type: 'active', charges: 4, pool: ['treasure', 'shop', 'boss', 'secret'],
  icon: { sheet: 'items_active', name: 'whiskey_bottle' },
  use(player, { scene }) {
    if (player.hp >= player.maxHp) return false; // nothing to heal: don't spend the charge
    player.heal(2);
    Sfx.play('pickup_heart', { vol: 0.9, rate: 0.85 });
    scene.fx.text(player.x, player.y - 90, '+1 HEART', { color: '#ff8a7a', size: 24 });
    scene.fx.burst(player.x, player.y - 40, { color: [0xd63a2a, 0xffb0a0], count: 10, speed: [40, 160], gravity: -60 });
    return true;
  },
});
