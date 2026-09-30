// Lore entries for the Codex LORE tab (CHARACTERS_META D6 + STORY_PRESENTATION 13.1). Pure data.
// {id, title, hint (always visible while locked), unlock (cond grammar), text (<= 30 words), reread?: cutscene id}.
const L = (id, title, hint, unlock, text, reread) => ({ id, title, hint, unlock, text, ...(reread ? { reread } : {}) });

export const LORE = [
  L('lore_debt', 'The Debt', 'Ride out for the first time.', 'E run:started{}', 'You signed in blood at a crossroads that no longer exists. The Devil keeps the receipt in a saloon at the end of the world.'),
  L('lore_board', 'The Board', 'Finish the Greenhorn contract.', 'E bounty:completed{id=bt_greenhorn}', 'Every job on the board pays in coin and notoriety. The board never asks who you are, only whom you can bury.'),
  L('lore_perdition', 'Perdition County', 'Reach Perdition.', 'E floor:changed{floor=2}', 'The town forgot to die. Its lamps still burn for customers who stopped breathing long ago.'),
  L('lore_cascabel', 'The Rattle', 'Defeat El Cascabel.', 'L.bk.cascabel >= 1', 'Old ranchers say the snake ate a preacher\'s bell and has rung ever since.'),
  L('lore_grimm', 'The Law', 'Defeat Marshal Grimm.', 'L.bk.grimm >= 1', 'Marshal Grimm hanged fifty men for the Devil. The noose went around his own neck at the fifty-first.'),
  L('lore_undertaker', 'The Undertaker', 'Defeat The Undertaker.', 'L.bk.undertaker >= 1', 'He never stopped measuring. Every coffin in the mine was cut to fit someone still walking.'),
  L('lore_peddler', 'The Peddler', 'Buy something from a shop.', 'L.shopBuys >= 1', 'One eye, one wagon, no customers who complain. Skeletons make excellent shopkeepers: they never take a day off.'),
  L('lore_tin', 'Tin Hearts', 'Find a tin heart.', 'E pickup:collected{type=heart_tin}', 'Tin is what a town gives its deputies when it cannot afford to give them mercy.'),
  L('lore_sixth', 'The Sixth Bullet', 'Fire 50 Sixth Bullets.', 'L.sixthShots >= 50', 'Five for the living, one for the debt. The cylinder remembers what the shooter tries to forget.'),
  L('lore_coffins', 'Hollow Boxes', 'Smash 10 coffins.', 'L.k.coffin >= 10', 'Nothing in the mine was buried by mistake.'),
  L('lore_ghosts', 'Ghost Light', 'Lay 30 ghosts to rest.', 'L.k.ghost >= 30', 'Prospectors who died owing money keep looking for the vein. Green light means they think they found it.'),
  L('lore_cursed', 'The Cursed', 'Slay an elite enemy.', 'L.elites >= 1', 'Some bandits sold twice. The Devil collects on both.'),
  L('lore_secret', 'Behind the Wall', 'Find a secret room.', 'L.secrets >= 1', 'Every county hides what it cannot bury. Dynamite is a polite way to ask.'),
  L('lore_preacher', 'The Hangman\'s Chaplain', 'Unlock the Preacher.', 'E meta:unlocked{id=char:preacher}', 'Josiah Thorne blessed every man Grimm hanged. The Marshal\'s ghost still owes him a sermon.'),
  L('lore_hunter', 'Paid in Full', 'Unlock the Bounty Hunter.', 'E meta:unlocked{id=char:hunter}', 'Cormac Rook has never missed a payday, and the only bounty he cannot collect is his own.'),
  L('lore_queen', 'Queen of Spades', 'Unlock the Outlaw Queen.', 'E meta:unlocked{id=char:queen}', 'Maude Marlowe cheated the Devil at cards once. He let her win, so he could see what it would cost her.'),
  L('lore_hell', 'Hell on Earth', 'Unlock Hell on Earth.', 'E meta:unlocked{id=mode:hell}', 'The Devil does not cheat. He simply changes what counts as fair.'),
  L('lore_daily', 'Same Sun, Same Road', 'Ride a Daily Ride.', 'L.dailyRuns >= 1', 'Every dawn, the county resets itself and dares one rider to walk the same road again.'),
  L('lore_deal', 'Crossroads', 'Sign a deal at the Crossroads.', 'L.deals >= 1', 'The Devil never asks for your soul. Only what you like best about yourself.'),
  // STORY 13.1
  L('lore_prologue', 'The Debt, Retold', 'Keep riding.', 'E run:started{char=gunslinger}', 'Eli read page one. The Devil counted on that. So does every contract in the county.', 'intro'),
  L('lore_page_two', 'Page Two', 'Keep riding.', 'E floor:changed{floor=4}', 'Every contract has a second page: something you love, held at the House until the account is settled.', 'interlude_ch1'),
  L('lore_toro', 'The Brand', 'Keep riding.', 'L.bk.toro >= 1', 'Every soul in the county wears the House\'s mark. Toro applies it personally, and does not wait for consent.'),
  L('lore_engine', 'The Twelve O\'Clock', 'Keep riding.', 'L.bk.engine >= 1', 'The Midnight Express has never been late. The station clock stopped at noon so nobody could prove otherwise.'),
  L('lore_scratch', 'The House', 'Keep riding.', 'L.bk.scratch >= 1', 'The Devil has never told a lie. He has simply never been asked the right question.'),
  L('lore_drive', 'Brand, Rail, Market', 'Keep riding.', 'E floor:changed{floor=6}', 'The county is a cattle drive. The Undertaker delivers, the bull brands, the train ships, the saloon sells.'),
  L('lore_shuffle', 'The Shuffle', 'Keep riding.', 'L.deaths >= 3', 'When a debtor dies, the Dealer collects, shuffles and deals them in again. It is not mercy. It is inventory.'),
  L('lore_chair', 'The Chair', 'Win a ride.', 'E run:ended{variant=complete,ending=a}', 'The velvet chair is warm. It is always warm. It has never been empty for long.', 'end_a'),
  L('lore_true', 'The Sixth Bullet', 'Win on Hell on Earth with clean hands.', 'E run:ended{variant=complete,ending=true}', 'The House takes every sixth bullet. Nobody thought to ask what happens if you give it back. On Hell on Earth, sign nothing.', 'end_true'),
];
export const LORE_BY_ID = Object.fromEntries(LORE.map((l) => [l.id, l]));
export default LORE;
