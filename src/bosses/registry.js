// Boss registry + design metadata (no class imports -> safe for type files to import).
export const BOSS_META = {
  cascabel: { name: 'EL CASCABEL', title: 'The Rattle Before The Bite', hp: 260, r: 105, floor: 1, portrait: 'portrait_cascabel', music: 'boss', speed: 0 },
  grimm: { name: 'MARSHAL GRIMM', title: 'The Law Never Sleeps', hp: 420, r: 62, floor: 2, portrait: 'portrait_grimm', music: 'boss', speed: 110 },
  undertaker: { name: 'THE UNDERTAKER', title: 'Last Rites For The Living', hp: 650, r: 70, floor: 3, portrait: 'portrait_undertaker', music: 'boss_final', speed: 90 },
  // chapter 2 (CHAPTER2 s3-s5). `music` = MUSIC_FOR name (ARCH D14); `stems` = phase-crossfade tracks (AudioDirector).
  toro: { name: 'EL TORO INFERNAL', title: 'Horns of the Furnace', hp: 800, r: 92, floor: 4, portrait: 'portrait_toro', music: 'boss4', speed: 0, bob: true },
  engine: { name: 'ENGINE NO. 666', title: 'The Midnight Express', hp: 980, r: 100, floor: 5, portrait: 'portrait_engine', music: 'boss5', stems: ['mus_boss5_a', 'mus_boss5_b', 'mus_boss5_c'], speed: 0, bob: true },
  scratch: { name: "OL' SCRATCH", title: 'The House Always Wins', hp: 1500, r: 62, floor: 6, portrait: 'portrait_scratch', music: 'boss6', stems: ['mus_boss6_a', 'mus_boss6_b', 'mus_boss6_c', 'mus_boss6_d'], speed: 0, final: true },
  // mini-bosses (EVENTS s4.3): champion rooms, `mini: true`, hp is final (no floor scale), bounty = 10 + 5 * floor coins
  ol_fury: { mini: true, name: "OL' FURY", title: "The Bull That Wouldn't Stay Buried", hp: 120, r: 62, floor: 1, bounty: 15, music: 'miniboss', speed: 0 },
  hangman: { mini: true, name: 'THE HANGMAN', title: 'Drop Is Just Rope', hp: 190, r: 56, floor: 2, bounty: 20, music: 'miniboss', speed: 90 },
  motherlode: { mini: true, name: 'THE MOTHERLODE', title: 'All That Glitters', hp: 280, r: 70, floor: 3, bounty: 25, music: 'miniboss', speed: 50 },
  ash_deacon: { mini: true, name: 'THE ASH DEACON', title: 'Dust Thou Art', hp: 340, r: 54, floor: 4, bounty: 30, music: 'miniboss', speed: 100 },
  stoker: { mini: true, name: 'STOKER JACK', title: 'Full Steam Ahead', hp: 400, r: 66, floor: 5, bounty: 35, music: 'miniboss', speed: 80 },
  head_bouncer: { mini: true, name: 'THE HEAD BOUNCER', title: 'Last Call', hp: 480, r: 64, floor: 6, bounty: 40, music: 'miniboss', speed: 100 },
};
/** Mini-boss ids in floor order (one per floor, `champion_f<n>` templates). */
export const MINI_IDS = Object.keys(BOSS_META).filter((id) => BOSS_META[id].mini);
/** Final boss id (its death ends the run through `game:ending`). */
export const FINAL_BOSS = 'scratch';
const reg = new Map();

/** registerBoss('cascabel', CascabelClass, { name, title, hp, r, portrait, music, ... }) */
export function registerBoss(id, Class, meta = {}) {
  reg.set(id, { Class, meta: { ...(BOSS_META[id] || {}), ...meta } });
}
export const getBoss = (id) => reg.get(id);
export const bossMeta = (id) => (reg.get(id) ? reg.get(id).meta : BOSS_META[id]) || null;
