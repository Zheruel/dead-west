import { registerItem } from '../registry.js';
import TumbleweedPal from '../familiars/TumbleweedPal.js';

// A friendly tumbleweed (familiars/TumbleweedPal.js) rolls around the room hurting whatever it touches. Each extra copy adds a pal, at most 2.
const MAX = 2;
const pals = (p) => p.familiars.filter((f) => f instanceof TumbleweedPal).length;

registerItem({
  id: 'tumbleweed_pal', name: 'Tumbleweed Pal', desc: 'A friendly tumbleweed bounces around wrecking things', type: 'passive', pool: ['treasure', 'shop'], weight: 1,
  icon: { sheet: 'items2_c', name: 'tumbleweed_pal' },
  tags: ['familiar'], tier: 1, gate: 'beast',
  lore: 'Nobody is lonelier. Nobody is faster.',
  onPickup(player) { if (pals(player) < MAX) player.addFamiliar(new TumbleweedPal(player)); },
  onRestore(player, { count }) { for (let i = pals(player); i < Math.min(MAX, count); i++) player.addFamiliar(new TumbleweedPal(player)); },
});
