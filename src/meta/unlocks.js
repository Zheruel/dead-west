// Unlock table (CHARACTERS_META B2, ARCH_V2 s10.7). ids: char:<id>, mode:<id>, gate:<name>, title:<id>. Pure data.
// `cond` (optional): an engine condition (cond.js grammar) that grants the unlock by itself; otherwise the unlock is granted as an
// achievement / contract `reward`. `hint` is shown on locked UI.
const U = (id, type, label, hint, source, cond) => ({ id, type, label, hint, source, cond: cond || null });

export const UNLOCKS = [
  U('char:preacher', 'char', 'The Preacher', 'Absolve the Marshal - defeat Marshal Grimm.', 'lawless'),
  U('char:hunter', 'char', 'The Bounty Hunter', 'Collect on the Undertaker - defeat the floor-3 boss.', 'last_rites'),
  U('char:queen', 'char', 'The Outlaw Queen', 'Cash out - win a run.', 'debt_paid'),
  U('mode:hell', 'mode', 'Hell on Earth', 'Win a run to unlock.', 'debt_paid'),
  U('mode:daily', 'mode', 'Daily Ride', 'Defeat the floor-3 boss to unlock.', 'last_rites'),
  U('gate:pyro', 'gate', 'Pyromaniac relics', 'Deed: Fire in the Hole', 'fire_in_the_hole'),
  U('gate:holy', 'gate', 'Blessed relics', 'Deed: Amen (win with the Preacher)', 'amen'),
  U('gate:sniper', 'gate', 'Sniper relics', 'Deed: Paid in Full (win with the Bounty Hunter)', 'paid_in_full'),
  U('gate:gambler', 'gate', 'Gambler relics', 'Deed: All In (win with the Outlaw Queen)', 'all_in'),
  U('gate:occult', 'gate', 'Occult relics', 'Deed: Wall Knocker', 'wall_knocker'),
  U('gate:bloodpact', 'gate', 'Blood Pact relics', 'Deed: Souls Sold', 'souls_sold'),
  U('gate:chaos', 'gate', 'Chaos relics', 'Deed: Combo Rider', 'combo_rider'),
  U('gate:lawman', 'gate', 'Lawman relics', 'Deed: Contract Killer', 'contract_killer'),
  U('gate:undead', 'gate', 'Undead relics', 'Contract: Glass Jaw', 'bt_glass_jaw'),
  U('gate:beast', 'gate', 'Beast relics', 'Contract: Stampede', 'bt_stampede'),
  U('gate:scrap', 'gate', 'Scrap relics', 'Contract: Rusty Iron', 'bt_rusty_iron'),
  U('gate:ghost', 'gate', 'Ghost relics', 'Contract: Everyone\'s Cursed', 'bt_all_cursed'),
  // the five extra gates of ARCH s10.7 (unlocked by their own conditions)
  U('gate:gulch', 'gate', 'Gulch relics', 'Beat El Cascabel', 'boss', 'L.bk.cascabel >= 1'),
  U('gate:perdition', 'gate', 'Perdition relics', 'Beat Marshal Grimm', 'boss', 'L.bk.grimm >= 1'),
  U('gate:mine', 'gate', 'Mine relics', 'Beat The Undertaker', 'boss', 'L.bk.undertaker >= 1'),
  U('gate:c2', 'gate', 'Chapter II relics', 'Reach floor 5', 'floor', 'L.bestFloor >= 5'),
  U('gate:sixth', 'gate', 'Sixth Bullet relics', 'Kill 100 enemies with the Sixth Bullet', 'kills', 'L.sixthKills >= 100'),
  U('title:gravedigger', 'title', 'Gravedigger', 'Deed: Mass Grave', 'mass_grave'),
  U('title:ghost_rider', 'title', 'Ghost Rider', 'Deed: Ghost Rider', 'ghost_rider'),
  U('title:quickdraw', 'title', 'Quickdraw', 'Deed: Quickdraw', 'quickdraw'),
  U('title:hellraiser', 'title', 'Hellraiser', 'Deed: Hell on Earth', 'hell_on_earth'),
  U('title:curator', 'title', 'Curator', 'Deed: Complete Set', 'complete_set'),
  U('title:legend', 'title', 'Legend', 'Deed: Full Deck', 'full_deck'),
  U('title:marshal', 'title', 'Marshal of the Board', 'Deed: Marshal of the Board', 'marshal_of_the_board'),
  U('title:last_breath', 'title', 'Last Breath', 'Contract: Last Breath', 'bt_last_breath'),
  U('title:devils_due', 'title', 'The Devil\'s Due', 'Contract: The Devil\'s Due', 'bt_devils_due'),
  U('title:closer', 'title', 'The Closer', 'Deed: The Sixth Bullet', 'sixth_bullet'),
];
export const UNLOCK_BY_ID = Object.fromEntries(UNLOCKS.map((u) => [u.id, u]));
export const GATES = UNLOCKS.filter((u) => u.type === 'gate').map((u) => u.id.slice(5));
export const TITLES = UNLOCKS.filter((u) => u.type === 'title').map((u) => ({ id: u.id.slice(6), label: u.label }));
export default UNLOCKS;
