import { registerItem } from '../registry.js';
import { rng } from '../../core/rng.js';
import { bus } from '../../core/events.js';
import { Sfx } from '../../core/Audio.js';

// Active (3 room clears): draw a card. +2 coins / heart / key / dynamite / +1.5 damage until you leave the room.
const CARDS = [
  { name: 'ACE OF DIAMONDS', txt: '+2 COINS', color: '#e8c84a', can: (p) => p.coins < 99, run: (p) => { p.collect('coin'); p.collect('coin'); } },
  { name: 'QUEEN OF HEARTS', txt: '+1 HEART', color: '#ff8a7a', can: (p) => p.hp < p.maxHp, run: (p) => { p.heal(2); } },
  { name: 'KING OF KEYS', txt: '+1 KEY', color: '#f0d060', can: (p) => p.keys < 99, run: (p) => { p.collect('key'); } },
  { name: 'JACK OF POWDER', txt: '+1 DYNAMITE', color: '#f0a640', can: (p) => p.dynamite < 99, run: (p) => { p.collect('dynamite'); } },
  {
    name: 'THE JOKER', txt: '+DAMAGE THIS ROOM', color: '#c8a0ff', can: () => true,
    run(p, scene) {
      p.addBuff('lucky_deck', (s) => { s.damage += 1.5; }, Infinity);
      const off = bus.scoped(scene, 'room:transition', () => { off(); if (scene.player) scene.player.removeBuff('lucky_deck'); }); // leaving the room (or floor) ends it
    },
  },
];

registerItem({
  id: 'lucky_deck', name: 'Lucky Deck', desc: 'Draw a card: coins, heart, key, dynamite or a damage boost.', type: 'active', charges: 3, pool: ['treasure', 'shop', 'secret'], weight: 0.7,
  icon: { sheet: 'items_active', name: 'lucky_deck' },
  tags: ['luck', 'gold'], tier: 2,
  lore: 'Fifty-two cards, all marked. By whom is the question.',
  use(player, { scene }) {
    const options = CARDS.filter((c) => c.can(player));
    const card = rng.game.pick(options);
    card.run(player, scene);
    Sfx.play('item_get', { vol: 0.45, rate: 1.3 });
    scene.fx.text(player.x, player.y - 100, card.name, { color: card.color, size: 24, time: 1300, rise: 40 });
    scene.fx.text(player.x, player.y - 70, card.txt, { color: '#e8dcc0', size: 20, time: 1300, rise: 40, delay: 120 });
    scene.fx.burst(player.x, player.y - 40, { color: [0xf0d060, 0xe8dcc0, 0xd63a2a], count: 18, speed: [80, 260], gravity: 200 });
    return true;
  },
});
