import { registerItem } from '../registry.js';

// Blasts reach 20 % farther and every player-owned explosion (dynamite, keg, cluster...) leaves a fire pool of 0.5 x the blast radius for 3 s
// (Explosions.playerBlast -> FirePatch team 'player': 6 dps to foes, never hurts you). Fireworks (with Lit Cigar) adds clusters, Hellstorm extends the fire.
registerItem({
  id: 'nitro_jelly', name: 'Nitro Jelly', desc: 'Blasts leave burning ground and reach 20% farther', type: 'passive', pool: ['treasure', 'secret'], weight: 0.7,
  icon: { sheet: 'items2_d', name: 'nitro_jelly' },
  tags: ['explosive', 'fire', 'dynamite'], tier: 2, gate: 'pyro',
  lore: 'Do not shake. Do not look at.',
  apply(player, { stats }) { stats.dynamiteRadius *= 1.2; stats.dynamiteFirePool = 1; },
});
