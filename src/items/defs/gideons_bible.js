import { registerItem } from '../registry.js';
import { nova } from '../fx/Nova.js';

const RADIUS = 380, DAMAGE = 45, HEAL_KILLS = 3;

// Active (6 room clears): a holy nova. 45 damage to every enemy within 380 px (Enemy.takeHit applies `undeadDamageMult`, so silver_bullets and
// consecrated_ground make the dead suffer more), no obstacle damage, wipes enemy bullets in the radius; three or more kills heal one unit.
registerItem({
  id: 'gideons_bible', name: "Gideon's Bible", desc: 'Holy nova: 45 damage in 380 px, wipes bullets', type: 'active', charges: 6, pool: ['boss', 'treasure', 'c2'], weight: 0.5,
  icon: { sheet: 'items2_e', name: 'gideons_bible' },
  tags: ['holy', 'undead_slayer'], tier: 3, gate: 'holy',
  lore: 'Found in every motel. Not this one.',
  use(player, { scene }) {
    const kills = nova(scene, player.x, player.y - 10, { radius: RADIUS, damage: DAMAGE, wipe: true, color: 0xfff0b0, source: 'bible' });
    scene.fx.shake(0.012, 380);
    scene.fx.text(player.x, player.y - 100, kills >= HEAL_KILLS ? 'AMEN' : 'REPENT', { color: '#fff0b0', size: 28 });
    if (kills >= HEAL_KILLS) player.heal(1);
    return true;
  },
});
