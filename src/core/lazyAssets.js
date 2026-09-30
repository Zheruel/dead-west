// Lazy asset table (QA4-001): everything NOT needed to reach the Menu + a first Chapter-1 ride is loaded after boot by Assets (see Assets._loadLazy).
// A key belongs to one group; groups are prefetched one floor ahead (floor:changed N -> f{N+1}, f{N+2}) or on demand (Assets.tex self-heals: placeholder
// first, real art swapped in place when it arrives). Pure data + one classifier, no imports (also used by tools/tests).
//
// Groups: 'intro' (first-ride cutscene), 'f1'..'f6' (floor N: backgrounds, obstacles, hazards, enemies, boss art/portrait, chapter cutscenes; f1 = the
// boss arena + Cascabel, the rest of floor 1 is boot-eager), 'end' (ending cutscenes + the true-finale Scratch), 'codex' (codex book art),
// 'cast' (rider portraits + select/daily backdrop).

// ENEMY_META floors -> the sprite that first needs the art. Chapter-1 sprites (floors 1-3 pool) and Ol' Fury (F1 champion) stay eager.
const ENEMY_GROUP = {
  ol_fury: 'f1', hangman: 'f2', motherlode: 'f3',
  hellhound: 'f4', hellsteer: 'f4', cinder_skull: 'f4', magma_eel: 'f4', sulfur_preacher: 'f4', magma_golem: 'f4', ash_deacon: 'f4',
  handcar_bandit: 'f5', signalman: 'f5', steam_stoker: 'f5', crate_mimic: 'f5', rail_rat: 'f5', chain_gang: 'f5', stoker: 'f5',
  card_shark: 'f6', loaded_die: 'f6', slot_fiend: 'f6', waiter_imp: 'f6', bouncer: 'f6', joker: 'f6', head_bouncer: 'f6',
};
const BOSS_GROUP = { cascabel: 'f1', grimm: 'f2', undertaker: 'f3', toro: 'f4', engine: 'f5', scratch: 'f6' };
export const isGroupId = (k) => /^(f[1-6]|intro|end|codex|cast)$/.test(k);

/** Group id of a manifest key, or null when it must load before the Menu. kind: 'sprite' | 'image'. */
export function lazyGroup(key, kind) {
  let m;
  if (kind === 'image') {
    if (key.startsWith('cutscene_intro_')) return 'intro';
    if (key.startsWith('cutscene_interlude_') || key === 'img_interlude_ch2') return 'f4';
    if (key.startsWith('cutscene_saloon_')) return 'f6';
    if (key.startsWith('cutscene_')) return 'end';
    if ((m = /^bg_f([1-6])_(a|b|c|boss)$/.exec(key))) return m[2] === 'boss' || m[1] !== '1' ? `f${m[1]}` : null; // F1 a/b are boot-eager, its boss arena is not
    if ((m = /^portrait_(cascabel|grimm|undertaker|toro|engine|scratch)$/.exec(key))) return BOSS_GROUP[m[1]];
    if (/^portrait_(preacher|hunter|queen)$/.test(key) || key === 'ui_charselect_bg') return 'cast'; // rider select / daily backdrop
    if (key === 'ui_codex_bg') return 'codex';
    return null;
  }
  if (key.startsWith('boss_scratch_true_')) return 'end'; // before the generic boss rule (same prefix)
  if ((m = /^boss_(cascabel|grimm|undertaker|toro|engine|scratch)_/.exec(key))) return BOSS_GROUP[m[1]];
  if ((m = /^obst_f([4-6])$/.exec(key))) return `f${m[1]}`;
  if (key === 'haz_f4') return 'f4';
  if (key === 'haz_f5' || key === 'haz_cart') return 'f5';
  if (key === 'prop_chandelier') return 'f6';
  if ((m = /^enemy_(.+)$/.exec(key))) return ENEMY_GROUP[m[1]] || null;
  return null;
}

/** Groups to prefetch when floor `n` starts (the next two floors; the endings from floor 5 on). */
export function groupsAfter(n) {
  const out = [`f${n + 1}`, `f${n + 2}`].filter((g) => /^f[2-6]$/.test(g));
  if (n >= 5) out.push('end');
  return out;
}
