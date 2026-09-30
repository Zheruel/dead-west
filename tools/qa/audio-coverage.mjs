// AUDIO COVERAGE (static, node only): every SFX key of AUDIO_SPEC_V2 s4 and every key the round-2 code plays resolves to a manifest file OR a SFX_ALIAS
// chain ending in a round-1 file; every music / ambience key of s2-s3 has a MIX row and a fallback chain; every alias base exists; MIX has no dupes.
// `node tools/qa/audio-coverage.mjs`  (exit code 1 on failure)
import fs from 'node:fs';
import path from 'node:path';
import { SFX_ALIAS, MUSIC_FALLBACK, resolveChain } from '../../src/core/AudioAliases.js';
import { MIX, isLazyAudio } from '../../src/core/mix.js';

const manifest = JSON.parse(fs.readFileSync('public/assets/manifest.json', 'utf8')).audio;
const r1 = new Set(Object.keys(JSON.parse(fs.readFileSync('public/assets/audio/sfx.audio.json', 'utf8'))).concat(
  Object.keys(JSON.parse(fs.readFileSync('public/assets/audio/music.audio.json', 'utf8')))));
let fails = 0;
const fail = (m) => { fails++; console.log('FAIL', m); };
const ok = (m) => console.log('PASS', m);

// alias resolution with NO round-2 files (only round-1 keys exist)
const resolvesR1 = (key, depth = 0) => {
  if (r1.has(key)) return true;
  const a = SFX_ALIAS[key];
  return !!a && depth < 6 && resolvesR1(a.base, depth + 1) && (a.layers || []).every((l) => resolvesR1(l.base, depth + 1));
};

// 1. every alias resolves to round-1 files
const dead = Object.keys(SFX_ALIAS).filter((k) => !resolvesR1(k));
dead.length ? fail(`aliases that do not resolve with an empty new-audio directory: ${dead.join(' ')}`) : ok(`${Object.keys(SFX_ALIAS).length} aliases all resolve to round-1 files`);

// 2. spec section 4 keys
const spec = fs.readFileSync('docs/v2/AUDIO_SPEC_V2.md', 'utf8');
const sec = spec.slice(spec.indexOf('## 4. SFX keys'), spec.indexOf('## 5. MIX rows'));
const STOP = new Set(['sfx', 'loop', 'false', 'type', 'duck', 'db', 'vol', 'string', 'poly', 'gap', 'rand', 'saloon_arrival', 'intro', 'intro_hell']); // (cutscene ids, not keys)
const keys = new Set();
for (const m of sec.matchAll(/`([a-z][a-z0-9_]*)`/g)) if (!STOP.has(m[1]) && !m[1].startsWith('mus_') && !m[1].startsWith('amb_')) keys.add(m[1]);
const noPlay = [...keys].filter((k) => !manifest[k] && !resolvesR1(k));
noPlay.length ? fail(`spec s4 keys with neither a file nor an alias: ${noPlay.join(' ')}`) : ok(`${keys.size} spec s4 keys each have a file or an alias`);
const noRow = [...keys].filter((k) => !MIX[k] && !SFX_ALIAS[k]?.base?.startsWith?.('__') && !(r1.has(k)));
noRow.length ? fail(`spec s4 keys without a MIX row: ${noRow.join(' ')}`) : ok('every spec s4 key has a MIX row (or is a round-1 key)');

// 3. keys the code plays (Sfx.play('x') / sfx('x') / snd('x')) that are not in the manifest need an alias
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } })('src');
const used = new Set();
for (const f of files) {
  if (/src\/core\/(Audio|mix)/.test(f)) continue;
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/(?:Sfx\.(?:play|playVar|loop)|\bsfx|\bsnd|\buiSfx)\(\s*'([a-z0-9_]+)'/g)) used.add(m[1]);
}
const silent = [...used].filter((k) => !manifest[k] && !resolvesR1(k));
silent.length ? fail(`keys played by code with no file and no alias: ${silent.join(' ')}`) : ok(`${used.size} keys played by code all make a sound (file or alias)`);

// 4. music + ambience of s2 / s3: MIX row + fallback chain that ends on an existing round-1 track
const mus = new Set();
for (const m of spec.matchAll(/`((?:mus|amb)_[a-z0-9_]+)`/g)) mus.add(m[1]);
for (const k of ['mus_boss5', 'mus_boss6']) mus.delete(k);
const badMus = [...mus].filter((k) => !MIX[k] || !resolveChain(k, (x) => r1.has(x), MUSIC_FALLBACK));
badMus.length ? fail(`music/ambience without MIX row or fallback: ${badMus.join(' ')}`) : ok(`${mus.size} music/ambience keys have a MIX row and a fallback chain`);

// 5. manifest audio keys have a MIX row (or a documented default)
const noMix = Object.keys(manifest).map((k) => k.replace(/_\d+$/, '')).filter((k, i, a) => a.indexOf(k) === i).filter((k) => !MIX[k]);
noMix.length ? console.log('note: manifest keys using DEFAULT_DB (no MIX row):', noMix.join(' ')) : ok('every manifest key has a MIX row');

// 6. no duplicate keys in the MIX literal
const src = fs.readFileSync('src/core/mix.js', 'utf8');
const body = src.slice(src.indexOf('export const MIX = {'), src.indexOf('for (const k of CREATURE)'));
const seen = new Map();
for (const m of body.matchAll(/(?:^|[\s,{])([a-z][a-z0-9_]*):\s*\{\s*db:/gm)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
const dupes = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
dupes.length ? fail(`duplicate MIX rows: ${dupes.join(' ')}`) : ok('no duplicate MIX rows');

// 7. lazy audio classification
const lazyBad = Object.entries(manifest).filter(([k, m]) => (m.type === 'music' || k.startsWith('amb_')) !== isLazyAudio(k, m) && !['mus_death', 'mus_victory'].includes(k)).map(([k]) => k);
lazyBad.length ? fail(`lazy classification mismatch: ${lazyBad.join(' ')}`) : ok('music + amb_ lazy, sfx eager');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
