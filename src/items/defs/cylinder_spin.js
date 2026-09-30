import { registerItem } from '../registry.js';
import { Sfx } from '../../core/Audio.js';

// Active (4 room clears): spin the cylinder. The next 3 shots are Sixth Bullets (queued ahead of the normal cylinder cycle, which is left
// untouched; the queue expires after 10 s in Player.update). Every Sixth modifier you own applies. The HUD cylinder glows while it is loaded.
registerItem({
  id: 'cylinder_spin', name: 'Cylinder Spin', desc: 'Spin the cylinder: the next 3 shots are Sixth Bullets', type: 'active', charges: 4, pool: ['treasure', 'boss'], weight: 0.7,
  icon: { sheet: 'items2_e', name: 'cylinder_spin' },
  tags: ['sixth'], tier: 2,
  lore: 'Let fate pick the chamber.',
  use(player, { scene }) {
    player.forceSixth = 0;
    player.grantSixth(3);
    Sfx.play('sixth_bullet_ready', { vol: 0.8, rate: 1.15 });
    scene.fx.ringPulse(player.x, player.footY - 20, 0xffc040, 70, 420, 0.8);
    scene.fx.text(player.x, player.y - 90, 'SIXTH x3', { color: '#ffc040', size: 26 });
    scene.fx.burst(player.x, player.y - 30, { color: [0xffc040, 0xfff0b0, 0xffffff], count: 12, speed: [60, 200], life: [250, 550], scale: [1, 2], blend: 'ADD' });
    return true;
  },
});
