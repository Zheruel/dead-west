// Story lore entries and deeds (STORY_PRESENTATION s13). Pure data. Same shape as src/meta/lore.js: {id, title, hint, unlock, text, reread?}.
// `unlock` uses the META condition grammar; `reread` is a cutscene id (CODEX > LORE shows a "Reread" button that plays it, CutsceneScene replay).
// src/meta/lore.js carries the same nine rows (FN-3 copied them); tools/qa/story-lint.mjs checks the two stay in step. Canon summary for writers at the end.
const L = (id, title, hint, unlock, text, reread) => ({ id, title, hint, unlock, text, ...(reread ? { reread } : {}) });

export const STORY_LORE = [
  L('lore_prologue', 'The Debt, Retold', 'Keep riding.', 'E run:started{char=gunslinger}', 'Eli read page one. The Devil counted on that. So does every contract in the county.', 'intro'),
  L('lore_page_two', 'Page Two', 'Keep riding.', 'E floor:changed{floor=4}', 'Every contract has a second page: something you love, held at the House until the account is settled.', 'interlude_ch1'),
  L('lore_toro', 'The Brand', 'Keep riding.', 'L.bk.toro >= 1', "Every soul in the county wears the House's mark. Toro applies it personally, and does not wait for consent."),
  L('lore_engine', "The Twelve O'Clock", 'Keep riding.', 'L.bk.engine >= 1', 'The Midnight Express has never been late. The station clock stopped at noon so nobody could prove otherwise.'),
  L('lore_scratch', 'The House', 'Keep riding.', 'L.bk.scratch >= 1', 'The Devil has never told a lie. He has simply never been asked the right question.'),
  L('lore_drive', 'Brand, Rail, Market', 'Keep riding.', 'E floor:changed{floor=6}', 'The county is a cattle drive. The Undertaker delivers, the bull brands, the train ships, the saloon sells.'),
  L('lore_shuffle', 'The Shuffle', 'Keep riding.', 'L.deaths >= 3', 'When a debtor dies, the Dealer collects, shuffles and deals them in again. It is not mercy. It is inventory.'),
  L('lore_chair', 'The Chair', 'Win a ride.', 'E run:ended{variant=complete,ending=a}', 'The velvet chair is warm. It is always warm. It has never been empty for long.', 'end_a'),
  L('lore_true', 'The Sixth Bullet', 'Win on Hell on Earth with clean hands.', 'E run:ended{variant=complete,ending=true}', 'The House takes every sixth bullet. Nobody thought to ask what happens if you give it back. On Hell on Earth, sign nothing.', 'end_true'),
];

/** Deeds appended to META achievements (s13.2); src/meta/achievements.js already carries them (lint compares ids). */
export const STORY_DEEDS = [
  { id: 'take_the_chair', name: 'Take the Chair', desc: 'Finish the story', cond: 'E run:ended{variant=complete,ending=a}', np: 20, reward: [] },
  { id: 'sixth_bullet', name: 'The Sixth Bullet', desc: 'See the true ending', cond: 'E run:ended{variant=complete,ending=true}', np: 250, reward: ['title:closer'] },
];

/** Cutscenes that have a Codex "Reread" button (ids in CUTSCENES). */
export const REREAD = ['intro', 'interlude_ch1', 'end_a', 'end_true'];
