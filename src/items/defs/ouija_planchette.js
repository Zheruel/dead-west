import { registerItem } from '../registry.js';
import { Sfx } from '../../core/Audio.js';

const TIME = 3;

// Active (5 room clears): spirit form for 3 s. Untouchable (Player.spiritT is part of `invulnerable`, the sprite goes 55% alpha), +80 move speed,
// every shot is ghostly (ghostChance 1 = spectral, +1 pierce, x1.15 damage) and pierces one more foe. Walls and pits still stop you.
registerItem({
  id: 'ouija_planchette', name: 'Ouija Planchette', desc: 'Spirit form for 3 s: untouchable, quick, shots pass rocks', type: 'active', charges: 5, pool: ['boss', 'secret', 'c2'], weight: 0.5,
  icon: { sheet: 'items2_e', name: 'ouija_planchette' },
  tags: ['ghost'], tier: 3, gate: 'occult',
  lore: 'Ask nicely. It listens.',
  use(player, { scene }) {
    player.spiritT = TIME;
    player.addBuff('ouija_planchette', (s) => { s.moveSpeed += 80; s.ghostChance = 1; s.pierce += 1; }, TIME);
    Sfx.play('item_get', { vol: 0.5, rate: 0.6 });
    scene.fx.ringPulse(player.x, player.footY - 10, 0x8fe0c0, 110, 520, 0.8);
    scene.fx.text(player.x, player.y - 100, 'SPIRIT FORM', { color: '#8fe0c0', size: 24 });
    scene.fx.burst(player.x, player.y - 30, { color: [0x8fe0c0, 0xb8ffe0, 0xffffff], count: 18, speed: [40, 180], life: [400, 900], scale: [1.5, 3], gravity: -80, blend: 'ADD' });
    return true;
  },
});
