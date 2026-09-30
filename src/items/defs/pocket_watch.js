import { registerItem } from '../registry.js';
import { startBulletTime } from '../fx/BulletTime.js';

// Active (4 room clears): bullet-time for 4 s. Enemies, enemy bullets and boss scripts run at 40% (scene.enemyTimeScale), the player at full speed.
registerItem({
  id: 'pocket_watch', name: 'Pocket Watch', desc: 'Bullet-time for 4 s: foes and their bullets crawl at 40% speed.', type: 'active', charges: 4, pool: ['treasure', 'shop', 'boss', 'secret'], weight: 0.7,
  icon: { sheet: 'items_active', name: 'pocket_watch' },
  tags: ['speed'], tier: 2,
  lore: 'Time waits for no man. This one asked nicely.',
  use(player, { scene }) {
    if (scene._bulletTime) return false; // already running: do not waste the charge
    startBulletTime(scene, 4, 0.4);
    return true;
  },
});
