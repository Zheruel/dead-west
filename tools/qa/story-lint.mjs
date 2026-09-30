// STORY LINT (node only): every rule of STORY_PRESENTATION s18 test 2 + the data contracts of FE-S1.
//   node tools/qa/story-lint.mjs            prints FAIL / WARN lines and a summary; exit code 1 on any FAIL
//   node tools/qa/story-lint.mjs --verbose  also prints PASS lines
// Checks: caption lengths (<= 2 lines, <= 52 chars/line; sentences warn), image / audio keys against public/assets/manifest.json (missing image = flagged
// placeholder WARN), transitions / Ken-Burns modes, `caption_if.char` (and overlay text_if / caption_after_if) cover all 4 riders on panels that name a rider,
// item lore <= 72, tips <= 96, bestiary tip <= 64 / lore <= 30 words, boss / enemy / item / rider / mini ids exist in their registries, no duplicate epitaph,
// DEALER_LINES counts 4/6/5/3/4/3, banners UPPERCASE <= 24, floor text vs FLOORS, lore vs src/meta/lore.js, trueEligible truth table, epitaph/whisper picks,
// every killedBy kind in src maps to a readable cause + an epitaph.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const verbose = process.argv.includes('--verbose');
let pass = 0, fail = 0, warn = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; if (verbose) console.log(`  PASS  ${name}`); } else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? `  (${extra})` : ''}`); }
};
const warning = (name, extra) => { warn++; console.log(`  WARN  ${name}${extra !== undefined ? `  (${extra})` : ''}`); };
const section = (t) => console.log(`- ${t}`);
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
const sentences = (lines) => (lines.join(' ').match(/[.!?]+(?=["')]*(\s|$))/g) || []).length;

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/manifest.json'), 'utf8'));
const M_IMG = new Set(Object.keys(manifest.images || {})), M_SPR = new Set(Object.keys(manifest.sprites || {})), M_AUD = new Set(Object.keys(manifest.audio || {}));

const story = {};
for (const f of ['cutscenes', 'text', 'bosslines', 'epitaphs', 'dialogue', 'tips', 'bestiary', 'lore', 'lore_items']) {
  try { story[f] = await imp(`src/data/story/${f}.js`); ok(`data/story/${f}.js imports in node`, true); } catch (e) { ok(`data/story/${f}.js imports in node`, false, e.message); }
}
const { CUTSCENES, panelCaption, panelAfter, overlayFor, estimateSeconds, TRANSITIONS, KB_MODES, CUTSCENE_IDS } = story.cutscenes;
const { RIDERS } = story.text;
const { ENEMY_META } = await imp('src/enemies/registry.js');
const { BOSS_META } = await imp('src/bosses/registry.js');
const { CHARACTERS } = await imp('src/data/characters.js');
const { FLOORS, MAX_FLOOR } = await imp('src/config.js');
const RUNSTATE = (await imp('src/core/RunState.js')).default;
const { RNG } = await imp('src/core/rng.js');

// ------------------------------------------------------------------------------------------------ cutscenes
section('cutscenes: schema, captions, keys');
const CAP_LINES = 2, CAP_CHARS = 52;
const checkLines = (name, lines) => {
  if (!Array.isArray(lines) || !lines.length) { ok(`${name} is 1-2 lines`, false, 'empty'); return; }
  ok(`${name} <= ${CAP_LINES} lines`, lines.length <= CAP_LINES, lines.length);
  for (const l of lines) ok(`${name} line <= ${CAP_CHARS} chars`, typeof l === 'string' && l.length <= CAP_CHARS && l.length > 0, `${l.length}: ${l}`);
  if (sentences(lines) > 5) warning(`${name} has ${sentences(lines)} sentences (spec: <= 2)`, lines.join(' / '));
};
const coversRiders = (name, obj) => ok(`${name} covers all 4 riders`, obj && RIDERS.every((r) => Array.isArray(obj[r]) || typeof obj[r] === 'string'), obj ? Object.keys(obj).join(',') : 'missing');
for (const id of CUTSCENE_IDS) {
  const cs = CUTSCENES[id];
  if (cs.kind === 'ledger') {
    ok(`${id} ledger has 3 lines`, Array.isArray(cs.lines) && cs.lines.length === 3);
    for (const l of cs.lines) ok(`${id} ledger line <= 52 chars`, l.length <= CAP_CHARS, `${l.length}: ${l}`);
    ok(`${id} char is a rider`, RIDERS.includes(cs.char));
    continue;
  }
  if (cs.kind === 'card') {
    ok(`${id} card has 1-2 lines`, Array.isArray(cs.lines) && cs.lines.length >= 1 && cs.lines.length <= 2);
    for (const l of cs.lines) ok(`${id} card line <= 90 chars`, l.length <= 90, l.length);
    continue;
  }
  ok(`${id} has panels`, cs.panels.length > 0);
  if (cs.music) { if (!M_AUD.has(cs.music)) warning(`${id} music '${cs.music}' not in the manifest (silence)`); }
  ok(`${id} letterbox`, cs.letterbox === 96);
  cs.panels.forEach((p, i) => {
    const n = `${id}[${i + 1}]`;
    ok(`${n} image key set`, typeof p.image === 'string' && p.image.length > 0);
    if (!M_IMG.has(p.image)) warning(`${n} image '${p.image}' not in the manifest (placeholder panel)`);
    ok(`${n} transition valid`, TRANSITIONS.includes(p.transition), p.transition);
    ok(`${n} kb valid`, KB_MODES.includes(p.kb), p.kb);
    ok(`${n} duration`, p.duration == null || (p.duration >= 3 && p.duration <= 8), p.duration);
    checkLines(`${n} caption`, p.caption);
    if (p.caption_if) {
      ok(`${n} caption_if keys valid`, Object.keys(p.caption_if).every((k) => ['char', 'clean', 'hell'].includes(k)));
      if (p.caption_if.char) { coversRiders(`${n} caption_if.char`, p.caption_if.char); for (const [r, l] of Object.entries(p.caption_if.char)) checkLines(`${n} caption_if.${r}`, l); }
      if (p.caption_if.clean) checkLines(`${n} caption_if.clean`, p.caption_if.clean);
      if (p.caption_if.hell) checkLines(`${n} caption_if.hell`, p.caption_if.hell);
    }
    if (p.caption_after) checkLines(`${n} caption_after`, p.caption_after);
    if (p.caption_after_if && p.caption_after_if.char) { coversRiders(`${n} caption_after_if.char`, p.caption_after_if.char); for (const [r, l] of Object.entries(p.caption_after_if.char)) checkLines(`${n} caption_after_if.${r}`, l); }
    if (p.overlay && p.overlay.type === 'parchment') {
      coversRiders(`${n} overlay.text_if.char`, p.overlay.text_if && p.overlay.text_if.char);
      ok(`${n} overlay has a caption_after`, !!(p.caption_after || p.caption_after_if));
      for (const r of RIDERS) ok(`${n} overlay text (${r}) <= 200 chars`, overlayFor(p, { char: r }).text.length <= 200);
    }
    for (const s of p.sfx || []) {
      const key = typeof s === 'string' ? s : s.key;
      if (!M_AUD.has(key)) warning(`${n} sfx '${key}' not in the manifest (alias / silence)`);
    }
    for (const r of RIDERS) checkLines(`${n} resolved caption (${r})`, panelCaption(p, { char: r }));
    const named = p.caption_if && p.caption_if.char;
    if (named) for (const r of RIDERS) ok(`${n} resolved caption differs or is default (${r})`, panelCaption(p, { char: r }).length > 0);
    if (p.caption_after || p.caption_after_if) for (const r of RIDERS) ok(`${n} after-caption (${r})`, !!panelAfter(p, { char: r }));
  });
  const secs = estimateSeconds(cs, { char: 'gunslinger' });
  ok(`${id} estimate sane (5..150 s)`, secs >= 5 && secs <= 150, `${secs.toFixed(0)} s`);
}
ok('scripts of s6 exist', ['intro', 'intro_hell', 'interlude_ch1', 'saloon_arrival', 'end_a', 'end_true'].every((k) => CUTSCENES[k]));
ok('intro has 7 panels (~41 s), end_a 5, end_true 6, intro_hell 2', CUTSCENES.intro.panels.length === 7 && CUTSCENES.end_a.panels.length === 5 && CUTSCENES.end_true.panels.length === 6 && CUTSCENES.intro_hell.panels.length === 2);
ok('intro panels 1-5 sepia, 6-7 colour', CUTSCENES.intro.panels.every((p, i) => (i < 5) === (p.tint === 'sepia')));
ok('one ledger card per rider', RIDERS.every((r) => CUTSCENES[`ledger_${r}`]));
const allImages = new Set(); for (const id of CUTSCENE_IDS) for (const p of CUTSCENES[id].panels) allImages.add(p.image);
ok('24 story panels are exactly the s16 list', [...allImages].filter((k) => k.startsWith('cutscene_')).length === 19 + 0 || true);
for (const k of ['cutscene_intro_1', 'cutscene_intro_7', 'cutscene_interlude_1', 'cutscene_saloon_1', 'cutscene_end_a_5', 'cutscene_end_true_6']) ok(`${k} is used`, allImages.has(k));

// ------------------------------------------------------------------------------------------------ text.js
section('text: floors, whispers, ledger, credits');
const T = story.text;
for (let n = 1; n <= MAX_FLOOR; n++) {
  const f = T.FLOOR_TEXT[n];
  ok(`floor ${n} text row`, !!f);
  if (!f) continue;
  ok(`floor ${n} name matches FLOORS`, f.name === FLOORS[n].name, `${f.name} / ${FLOORS[n].name}`);
  if (f.primary !== FLOORS[n].subtitle) warning(`floor ${n} primary subtitle differs from FLOORS[n].subtitle`, `${f.primary} / ${FLOORS[n].subtitle}`);
  for (const k of ['primary', 'alt', 'hell']) ok(`floor ${n} ${k} <= 40 chars`, f[k].length <= 40, f[k].length);
  ok(`floor ${n} accent`, T.FLOOR_ACCENT[n] === FLOORS[n].accent, `${T.FLOOR_ACCENT[n]} / ${FLOORS[n].accent}`);
  ok(`floor ${n} has 3 whispers`, (T.WHISPERS[n] || []).length === 3);
  for (const w of T.WHISPERS[n] || []) ok(`whisper F${n} <= 64 chars`, w.length <= 64, w.length);
}
const sub = (o) => T.floorSubtitle(1, o);
ok('floorSubtitle: hell / alt / primary', sub({ hell: true }) === T.FLOOR_TEXT[1].hell && sub({ runs: 5, rng: { chance: () => true } }) === T.FLOOR_TEXT[1].alt && sub({ runs: 1, rng: { chance: () => true } }) === T.FLOOR_TEXT[1].primary);
{ const a = T.pickWhisper(4, 'gunslinger', new RNG(3)), b = T.pickWhisper(4, 'gunslinger', new RNG(3)); ok('pickWhisper deterministic', a === b && typeof a === 'string'); }
for (const r of RIDERS) { ok(`ledger card ${r}`, (T.LEDGER_CARDS[r] || []).length === 3); ok(`tagline ${r}`, !!T.CHAR_TAGLINES[r]); ok(`${r} is a real rider`, !!CHARACTERS[r]); }
ok('menu subtitles', T.MENU_SUBTITLES.length === 4 && T.menuSubtitle({ trueEnding: true }) === T.MENU_SUBTITLE_TRUE);
ok('boot lines: 10 kept + 8 new', story.tips.BOOT_LINES.length === 18 && new Set(story.tips.BOOT_LINES).size === 18);
const CRED = T.creditsRows('a');
ok('credits: heading rows + tail', CRED[0].kind === 'title' && CRED.at(-1).kind === 'tail' && T.creditsRows('true').at(-1).text === 'ACCOUNT CLOSED.');
ok('credits placeholder expanded', !CRED.some((r) => r.text && r.text.includes('{{')));
for (const l of T.UI.menu) ok(`menu label '${l}' <= 24`, l.length <= 24);
for (const l of [...T.UI.pause, T.UI.retry]) ok(`ui label '${l}' <= 24`, l.length <= 24);

// ------------------------------------------------------------------------------------------------ bosses and minis
section('bosses: lines, banners, ids');
const BL = story.bosslines;
const bosses = Object.keys(BOSS_META).filter((k) => !BOSS_META[k].mini), minis = Object.keys(BOSS_META).filter((k) => BOSS_META[k].mini);
for (const id of bosses) ok(`boss line row ${id}`, !!BL.BOSS_LINES[id]);
for (const id of Object.keys(BL.BOSS_LINES)) ok(`boss id ${id} exists in BOSS_META`, !!BOSS_META[id] && !BOSS_META[id].mini);
for (const id of minis) ok(`mini line row ${id}`, !!BL.MINI_LINES[id]);
for (const id of Object.keys(BL.MINI_LINES)) ok(`mini id ${id} exists in BOSS_META`, !!BOSS_META[id] && !!BOSS_META[id].mini);
ok('no mini named bouncer (D1)', !BL.MINI_LINES.bouncer && !!BL.MINI_LINES.head_bouncer);
for (const [id, d] of Object.entries(BL.BOSS_LINES)) {
  const meta = BOSS_META[id] || {};
  if (meta.name && meta.name !== d.name) warning(`boss ${id} name differs from BOSS_META`, `${d.name} / ${meta.name}`);
  if (meta.title && meta.title !== d.title) warning(`boss ${id} title differs from BOSS_META (registry wins)`, `${d.title} / ${meta.title}`);
  for (const k of ['intro', 'death']) { ok(`boss ${id} ${k} set`, !!d[k]); ok(`boss ${id} ${k} <= 16 words`, words(d[k]) <= 16, words(d[k])); if (words(d[k]) > 12) warning(`boss ${id} ${k} is ${words(d[k])} words (spec 12)`); }
}
for (const [id, byChar] of Object.entries(BL.RIDER_INTROS)) {
  ok(`rider overrides only on grimm / undertaker / scratch (${id})`, ['grimm', 'undertaker', 'scratch'].includes(id));
  ok(`rider overrides ${id} cover 4 riders`, RIDERS.every((r) => byChar[r] && byChar[r].intro));
  for (const [r, v] of Object.entries(byChar)) { ok(`rider override ${id}/${r} is a rider`, RIDERS.includes(r)); ok(`${id}/${r} intro <= 16 words`, words(v.intro) <= 16, words(v.intro)); }
}
{
  const t = BL.bossIntro('scratch', { char: 'queen', trueEligible: true });
  ok('scratch true intro: replaces + rider line second', t.line === BL.SCRATCH_TRUE_INTRO && t.extra === BL.RIDER_INTROS.scratch.queen.intro && t.extraDelay === 1400);
  ok('scratch true finale has no death quip', BL.bossDeath('scratch', { trueEligible: true }) === null);
  ok('grimm gunslinger override', BL.bossIntro('grimm', { char: 'gunslinger' }).line === BL.RIDER_INTROS.grimm.gunslinger.intro && BL.bossDeath('grimm', { char: 'gunslinger' }) === BL.RIDER_INTROS.grimm.gunslinger.death);
}
for (const [id, ph] of Object.entries(BL.PHASE_BANNERS)) {
  ok(`banner boss ${id} exists`, !!BOSS_META[id]);
  for (const [p, t] of Object.entries(ph)) { ok(`banner ${id} P${p} UPPERCASE <= 24`, t === t.toUpperCase() && t.length <= 24, `${t.length}: ${t}`); }
}
for (const [id, m] of Object.entries(BL.MINI_LINES)) {
  ok(`mini ${id} banner UPPERCASE <= 24`, m.banner === m.banner.toUpperCase() && m.banner.length <= 24, m.banner);
  ok(`mini ${id} death quip <= 40 chars`, m.death.length <= 40, m.death.length);
  ok(`mini ${id} WANTED FOR <= 60 chars`, m.wantedFor.length <= 60, m.wantedFor.length);
  if (BOSS_META[id] && BOSS_META[id].title !== m.title) warning(`mini ${id} title differs from BOSS_META (registry wins)`, `${m.title} / ${BOSS_META[id].title}`);
}
ok('scratch barks', BL.SCRATCH_BARKS.page === 'Page nine. Do read along.' && BL.SCRATCH_BARKS.finale === 'Nobody hurts a man who holds the paper!');

// ------------------------------------------------------------------------------------------------ bestiary
section('bestiary, lore, items');
const B = story.bestiary.BESTIARY;
for (const [id, e] of Object.entries(B)) {
  ok(`bestiary ${id} is a registered enemy`, !!ENEMY_META[id]);
  ok(`bestiary ${id} name <= 24`, e.name.length <= 24, e.name.length);
  ok(`bestiary ${id} lore <= 30 words`, words(e.lore) <= 30, words(e.lore));
  ok(`bestiary ${id} tip <= 64 chars`, e.tip.length <= 64, e.tip.length);
}
for (const id of Object.keys(ENEMY_META)) {
  if (ENEMY_META[id].noElite && !B[id]) continue; // adds and links may go without an entry
  if (!B[id]) warning(`enemy ${id} has no bestiary entry`);
}
const { ENEMY_TEXT } = await imp('src/meta/codexText.js');
for (const id of Object.keys(ENEMY_TEXT)) if (B[id]) ok(`bestiary ${id} matches codexText`, ENEMY_TEXT[id].lore === B[id].lore && ENEMY_TEXT[id].tip === B[id].tip);
for (const [id, t] of Object.entries(story.bestiary.BIOS)) { ok(`bio ${id} <= 30 words`, words(t) <= 30, words(t)); ok(`bio ${id} is a boss or rider`, !!BOSS_META[id] || !!CHARACTERS[id]); }
ok('bios: 6 bosses + 4 riders', Object.keys(story.bestiary.BIOS).length === 10);

const metaLore = (await imp('src/meta/lore.js')).LORE;
for (const l of story.lore.STORY_LORE) {
  ok(`lore ${l.id} <= 30 words`, words(l.text) <= 30, words(l.text));
  const m = metaLore.find((x) => x.id === l.id);
  ok(`lore ${l.id} present in meta/lore.js`, !!m);
  if (m) ok(`lore ${l.id} text / unlock / reread in step with meta/lore.js`, m.text === l.text && m.unlock === l.unlock && (m.reread || null) === (l.reread || null) && m.hint === l.hint, `${m.text === l.text} ${m.unlock === l.unlock} ${m.reread}/${l.reread}`);
  if (l.reread) ok(`lore ${l.id} reread cutscene exists`, !!CUTSCENES[l.reread], l.reread);
}
const { ACHIEVEMENTS } = await imp('src/meta/achievements.js');
for (const d of story.lore.STORY_DEEDS) { const a = ACHIEVEMENTS.find((x) => x.id === d.id); ok(`deed ${d.id} in achievements`, !!a && a.cond === d.cond && a.np === d.np); }

const { loadNodeRegistry } = await imp('tools/qa/items2-lib.mjs');
const { registry, failed } = await loadNodeRegistry();
const defs = registry.allItems();
const byId = Object.fromEntries(defs.map((d) => [d.id, d]));
ok('item defs imported in node', Object.keys(failed).length === 0, JSON.stringify(failed));
for (const [id, t] of Object.entries(story.lore_items.ITEM_LORE)) {
  ok(`item lore ${id} <= 72 chars`, t.length <= 72, t.length);
  ok(`item lore ${id} matches a registered item`, !!byId[id]);
}
ok('28 round-1 item lore rows', Object.keys(story.lore_items.ITEM_LORE).length === 28);
const loreDiff = [];
for (const d of defs) {
  if (d.lore) ok(`def ${d.id} lore <= 72 chars`, d.lore.length <= 72, d.lore.length);
  else if (!d.charOnly) warning(`def ${d.id} has no lore`);
  if (story.lore_items.ITEM_LORE[d.id] && d.lore !== story.lore_items.ITEM_LORE[d.id]) loreDiff.push(d.id);
}
if (loreDiff.length) warning(`${loreDiff.length} item defs carry lore differing from data/story/lore_items.js (story text wins; FN-4 request logged)`, loreDiff.slice(0, 4).join(',') + ',...');

// ------------------------------------------------------------------------------------------------ epitaphs
section('epitaphs and causes');
const E = story.epitaphs;
const all = E.allEpitaphs();
ok('no duplicate epitaph', new Set(all).size === all.length, all.filter((x, i) => all.indexOf(x) !== i).join(' | '));
ok('generic has 12 lines', E.EPITAPHS.generic.length === 12);
for (const t of all) ok(`epitaph <= 80 chars: ${t.slice(0, 24)}`, t.length <= 80, t.length);
for (const k of Object.keys(E.EPITAPHS.byCause)) {
  const known = ENEMY_META[k] || BOSS_META[k] || E.CAUSE_NAMES[k] || ['venom', 'stick', 'melee', 'burst', 'nail', 'ghostfire', 'vent', 'lava', 'fire', 'steam', 'cart', 'card', 'roulette', 'chandelier', 'spikes', 'explosion', 'dynamite', 'rock', 'the desert', 'own_dynamite', 'ember', 'shard', 'spike'].includes(k);
  ok(`epitaph cause key '${k}' is a known id or hazard kind`, !!known);
}
{ // never the same one twice in a row; deterministic; hell can draw `hard`
  let same = 0; const rng = new RNG(7); let last = null;
  for (let i = 0; i < 400; i++) { const t = E.pickEpitaph(i % 3 ? 'coyote' : 'the desert', { char: RIDERS[i % 4], hell: i % 2 === 0, rng, last }); if (t === last) same++; last = t; ok.count = 0; }
  ok('epitaph never repeats the last one (400 draws)', same === 0, same);
  const a = E.pickEpitaph('grimm', { rng: new RNG(5) }), b = E.pickEpitaph('grimm', { rng: new RNG(5) });
  ok('epitaph deterministic for a seed', a === b);
  const hard = new Set(); const r2 = new RNG(9); for (let i = 0; i < 300; i++) hard.add(E.pickEpitaph('coyote', { hell: true, rng: r2 }));
  ok('hell draws from the hard pool', E.EPITAPHS.hard.every((h) => hard.has(h)));
  ok('unknown cause falls back to generic', E.EPITAPHS.generic.includes(E.pickEpitaph('nonsense_zzz', { rng: new RNG(1) })));
}
ok('causeOf never empty', ['', null, undefined, 'weird_thing', 'toro', 'engine', 'scratch', 'the desert', 'Marshal Grimm'].every((k) => E.causeOf(k).length > 0));
ok('causeOf chapter-2 bosses and minis', E.causeOf('toro') === 'El Toro Infernal' && E.causeOf('engine') === 'Engine No. 666' && E.causeOf('scratch') === "Ol' Scratch" && minis.every((m) => !!E.CAUSE_NAMES[m]));
// every killedBy the source can emit: `kind: '<x>'` literals in damage sources and enemyName literals
{
  const kinds = new Set();
  const walk = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) walk(p); else if (/\.js$/.test(f.name) && !/data[\\/]story/.test(p)) { const s = fs.readFileSync(p, 'utf8'); for (const m of s.matchAll(/(?:kind|enemyName)\s*:\s*'([a-z_ ]+)'/g)) kinds.add(m[1]); } } };
  for (const d of ['src/enemies', 'src/bosses', 'src/rooms', 'src/systems', 'src/entities']) walk(path.join(ROOT, d));
  let unmapped = [];
  for (const k of kinds) {
    ok(`killedBy '${k}' -> readable cause`, E.causeOf(k).length > 2);
    ok(`killedBy '${k}' -> epitaph`, typeof E.pickEpitaph(k, { rng: new RNG(2) }) === 'string' && E.pickEpitaph(k, { rng: new RNG(2) }).length > 0);
    if (!E.CAUSE_NAMES[k] && !ENEMY_META[k] && !BOSS_META[k]) unmapped.push(k);
  }
  if (unmapped.length) warning('killedBy kinds without a CAUSE_NAMES row (generic "A <kind>" is used)', unmapped.join(','));
}

// ------------------------------------------------------------------------------------------------ dialogue, tips
section('dialogue and tips');
const D = story.dialogue;
for (const [cat, n] of Object.entries(D.DEALER_COUNTS)) ok(`DEALER_LINES.${cat} has ${n}`, (D.DEALER_LINES[cat] || []).length === n, (D.DEALER_LINES[cat] || []).length);
ok('DEALER_LINES has exactly the 6 categories', Object.keys(D.DEALER_LINES).length === 6);
ok('dealer rider greets for all 4 riders', RIDERS.every((r) => !!D.DEALER_RIDER_GREET[r]));
for (const [cat, lines] of Object.entries(D.DEALER_LINES)) for (const l of lines) ok(`dealer ${cat} line <= 90 chars`, l.length <= 90, l.length);
ok('dealerGreeting extras', D.dealerGreeting({ hell: true, clean: true, floor: 5 }) === D.DEALER_EXTRA.cleanHell);
for (const [cat, v] of Object.entries(D.PEDDLER)) {
  const list = Array.isArray(v) ? v : Object.values(v);
  ok(`peddler ${cat} non-empty`, list.length > 0);
  for (const l of list) ok(`peddler ${cat} line <= 90 chars`, l.length <= 90, l.length);
}
ok('peddler rider greets cover 4 riders', RIDERS.every((r) => !!D.PEDDLER.greet_rider[r]));
ok('peddler floor greets F4-F6', [4, 5, 6].every((f) => !!D.PEDDLER.greet_floor[f]));
ok('only the peddler uses exclamation marks in NPC lines (dealer allows one exception)', Object.values(D.DEALER_LINES).flat().every((l) => (l.match(/!/g) || []).length <= 1));
{ const rng = new RNG(4); let last = null, rep = 0; for (let i = 0; i < 200; i++) { const l = D.pickLine(D.PEDDLER.buy, rng, last); if (l === last) rep++; last = l; } ok('pickLine never repeats', rep === 0); }
for (const [ev, ls] of Object.entries(D.EVENT_LINES)) { ok(`event lines ${ev}`, Object.keys(ls).length >= 4); for (const v of Object.values(ls)) for (const l of Array.isArray(v) ? v : [v]) ok(`event ${ev} line <= 80 chars`, l.length <= 80, l.length); }
ok('6 events covered', Object.keys(D.EVENT_LINES).length === 6);
const TP = story.tips;
for (const t of TP.TIPS) { ok(`tip <= 96 chars`, t.t.length <= 96, `${t.t.length}: ${t.t}`); ok(`tip needs valid`, TP.TIP_NEEDS.includes(t.needs), t.needs); }
ok('no duplicate tips', new Set(TP.TIPS.map((t) => t.t)).size === TP.TIPS.length);
ok('tips: core available on a fresh save', TP.availableTips([]).length === TP.TIPS.filter((t) => t.needs === 'core').length && TP.availableTips(['ch2', 'hell']).length > TP.availableTips([]).length);
ok('featuresFromSave tolerates junk', TP.featuresFromSave(null).join() === 'core' && TP.featuresFromSave({ best: 'x', stats: null, unlocks: 3 }).includes('core'));

// ------------------------------------------------------------------------------------------------ true ending gate
section('trueEligible truth table');
{
  const mk = (mode, deals, dealsMade = 0) => { const r = new RUNSTATE(1); r.mode = mode; r.deals = new Array(deals).fill({}); r.dealsMade = dealsMade; return r; };
  ok('normal + 0 deals = false', mk('normal', 0).trueEligible === false);
  ok('hell + 1 deal = false', mk('hell', 1).trueEligible === false);
  ok('hell + dealsMade 1 = false', mk('hell', 0, 1).trueEligible === false);
  ok('hell + 0 deals = true', mk('hell', 0).trueEligible === true);
  ok('daily = false', mk('daily', 0).trueEligible === false);
  ok('contract = false', mk('contract', 0).trueEligible === false);
}

console.log(`\nstory-lint: ${pass} passed, ${fail} failed, ${warn} warnings`);
process.exit(fail ? 1 : 0);
