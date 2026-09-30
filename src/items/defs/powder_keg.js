import { registerItem } from '../registry.js';
import { explode } from '../../systems/Explosions.js';
import { Sfx } from '../../core/Audio.js';

const RADIUS = 320, DAMAGE = 80;

// Active (5 room clears): a huge blast at your feet. Heavy damage to enemies (a large multiple of a dynamite stick's radius),
// breaks obstacles and secret walls, wipes enemy bullets; you take 1 unit unless immune (dynamite vest) or rolling / invulnerable.
registerItem({
  id: 'powder_keg', name: 'Powder Keg', desc: 'A colossal blast at your feet. Costs a half heart.', type: 'active', charges: 5, pool: ['treasure', 'boss', 'secret'], weight: 0.7,
  icon: { sheet: 'items_active', name: 'powder_keg' },
  tags: ['explosive', 'dynamite'], tier: 3,
  lore: 'Subtle it is not. Neither is the crater.',
  use(player, { scene }) {
    const { x, y } = player;
    scene.bullets.enemy.clearRadius(x, y, RADIUS);
    explode(scene, x, y, { radius: RADIUS, damage: DAMAGE, playerDamage: player.stats.explosionImmune ? 0 : 1, source: 'powder_keg', owner: 'player' });
    scene.fx.shake(0.03, 520);
    scene.fx.flash(0xffa040, 0.6);
    // rolling secondary blasts for drama (visual only)
    for (let i = 0; i < 3; i++) {
      scene.time.delayedCall(90 + i * 110, () => {
        if (!scene.player || scene.player.dead) return;
        const a = Math.random() * 6.28, r = 60 + Math.random() * 130;
        scene.fx.explosion(x + Math.cos(a) * r, y + Math.sin(a) * r, 110);
        Sfx.play('explosion', { vol: 0.6, rate: 1.1 + Math.random() * 0.3, gap: 0.05 });
      });
    }
    return true;
  },
});
