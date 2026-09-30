import { registerItem } from '../registry.js';
import Dynamite from '../../entities/Dynamite.js';
import { ROOM } from '../../config.js';
import { Sfx } from '../../core/Audio.js';

const COUNT = 5, RING = 110, FLIGHT = 0.2, FUSE = 0.8; // toss 0.2 s + fuse 0.8 s = the ring goes off 1.0 s after use

// Active (4 room clears): toss a ring of 5 lit sticks around you. They do not use your dynamite, blast with your normal dynamite radius / damage
// stats (so lit_cigar, nitro_jelly, brimstone... all apply) and cannot hurt you. (The toss `from` also keeps Room.onExplosion from leaving the
// enemy-team fire patches that ordinary placed dynamite leaves, which would have burned you.)
registerItem({
  id: 'dynamite_crate', name: 'Dynamite Crate', desc: 'Drops a ring of 5 lit sticks; you are immune', type: 'active', charges: 4, pool: ['treasure', 'secret'], weight: 0.7,
  icon: { sheet: 'items2_d', name: 'dynamite_crate' },
  tags: ['dynamite', 'explosive'], tier: 2, gate: 'pyro',
  lore: 'This side up. Stand far.',
  use(player, { scene }) {
    const room = scene.room;
    const a0 = -Math.PI / 2;
    for (let i = 0; i < COUNT; i++) {
      const a = a0 + (i / COUNT) * Math.PI * 2;
      let x = Math.min(ROOM.right - 60, Math.max(ROOM.x + 60, player.x + Math.cos(a) * RING));
      let y = Math.min(ROOM.bottom - 60, Math.max(ROOM.y + 60, player.y + Math.sin(a) * RING));
      if (room && room.walkableNear) ({ x, y } = room.walkableNear(x, y));
      new Dynamite(scene, x, y, { fuse: FUSE, flight: FLIGHT, from: { x: player.x, y: player.y }, playerDamage: 0, hurtPlayer: false, owner: 'player' });
    }
    Sfx.play('gun_cock', { vol: 0.7, rate: 0.8 });
    scene.fx.ringPulse(player.x, player.footY, 0xf0a640, RING + 40, 380, 0.7);
    scene.fx.burst(player.x, player.y - 30, { color: [0xf0a640, 0xffe090, 0xd9b071], count: 12, speed: [60, 200], life: [250, 500], gravity: 200 });
    return true;
  },
});
