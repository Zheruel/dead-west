import { registerItem } from '../registry.js';

registerItem({
  id: 'speed_loader', name: 'Speed Loader', desc: 'Fire rate up (x0.8 delay)', type: 'passive', pool: ['treasure', 'shop', 'boss'],
  icon: { sheet: 'items_passive_a', name: 'speed_loader' },
  tags: ['rapid'], tier: 2,
  lore: 'Six in the time it takes the Devil to clear his throat.',
  apply(player, { stats }) { stats.fireDelay *= 0.8; },
});
