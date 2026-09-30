import { registerItem } from '../registry.js';
import BoneHound from '../familiars/BoneHound.js';

// A skeletal hound (familiars/BoneHound.js): bites the nearest foe, fetches pickups when the room is quiet. Each extra copy adds a hound, at most 2.
const MAX = 2;
const hounds = (p) => p.familiars.filter((f) => f instanceof BoneHound).length;

registerItem({
  id: 'bone_hound', name: 'Bone Hound', desc: 'A skeletal hound bites foes and fetches pickups', type: 'passive', pool: ['treasure', 'boss'], weight: 0.8,
  icon: { sheet: 'items2_c', name: 'bone_hound' },
  tags: ['familiar'], tier: 2,
  lore: 'Good boy. Bad news.',
  onPickup(player) { if (hounds(player) < MAX) player.addFamiliar(new BoneHound(player)); },
  onRestore(player, { count }) { for (let i = hounds(player); i < Math.min(MAX, count); i++) player.addFamiliar(new BoneHound(player)); },
});
