import { registerItem } from '../registry.js';
import FaithMeter from '../familiars/FaithMeter.js';

// The Preacher's relic (character-only, never rolled). tinPlating caps each hit at 1 unit while tin lasts (Player.damage); FaithMeter is the Faith
// / Sanctified controller (familiars/FaithMeter.js). Faith lives in player.itemState.sermon_bible so checkpoints keep it.
registerItem({
  id: 'sermon_bible', name: 'Sermon Bible', desc: 'Tin plating, x1.5 vs the dead. Faith builds Sanctified power', type: 'passive', pool: [], charOnly: 'preacher',
  icon: { sheet: 'meta_icons', name: 'sermon_bible' }, tier: 3,
  lore: 'Josiah Thorne blessed every man Grimm hanged.',
  state: () => ({ faith: 0 }),
  apply(player, { stats }) { stats.tinPlating = 1; stats.undeadDamageMult *= 1.5; },
  onPickup(player) { if (!player.familiars.some((f) => f instanceof FaithMeter)) player.addFamiliar(new FaithMeter(player)); },
  onRestore(player) { if (!player.familiars.some((f) => f instanceof FaithMeter)) player.addFamiliar(new FaithMeter(player)); },
});
