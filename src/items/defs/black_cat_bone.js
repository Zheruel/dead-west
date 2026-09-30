import { registerItem } from '../registry.js';

// Cheat death once. The revive itself lives in Player.tryRevive (ARCH D7: order black_cat_bone, ace_in_hole, lazarus_pact): hp 2, the bone is
// removed, 2 s of grace, a 260 px blast and the enemy bullets wiped. No hook here on purpose (a `deathSave` hook would revive a second time).
registerItem({
  id: 'black_cat_bone', name: 'Black Cat Bone', desc: 'Cheat death once', type: 'passive', pool: ['boss', 'secret'], weight: 0.4,
  icon: { sheet: 'items2_b', name: 'black_cat_bone' },
  tags: ['luck'], tier: 3, gate: 'undead',
  lore: 'Landed on its feet. Again.',
});
