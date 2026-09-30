import { registerItem } from '../registry.js';
import WantedMark from '../familiars/WantedMark.js';

// The Bounty Hunter's relic (character-only, never rolled). markMult / markBossMult are read by Enemy.takeHit for the WANTED enemy that
// WantedMark picks at every wave (familiars/WantedMark.js).
registerItem({
  id: 'hunters_ledger', name: "Hunter's Ledger", desc: 'Mark the toughest foe each wave: x1.5 damage, pays a bounty', type: 'passive', pool: [], charOnly: 'hunter',
  icon: { sheet: 'meta_icons', name: 'hunters_ledger' }, tier: 3,
  lore: 'Dead or alive. He settled for dead.',
  apply(player, { stats }) { stats.markMult = 1.5; stats.markBossMult = 1.2; },
  onPickup(player) { if (!player.familiars.some((f) => f instanceof WantedMark)) player.addFamiliar(new WantedMark(player)); },
  onRestore(player) { if (!player.familiars.some((f) => f instanceof WantedMark)) player.addFamiliar(new WantedMark(player)); },
});
