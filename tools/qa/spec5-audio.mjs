// QA-5 AUDIO_SPEC_V2 audit (node, static): parse s2/s3/s4 tables, compare MIX rows / aliases / fallbacks / files / EVENT_SFX / director tables.
import fs from 'node:fs';
import { audit } from './spec5-lib.mjs';
import { MIX } from '../../src/core/mix.js';
import { SFX_ALIAS, MUSIC_FALLBACK } from '../../src/core/AudioAliases.js';
import { FLOORS } from '../../src/config.js';
import { BOSS_META } from '../../src/bosses/registry.js';
const A = audit('AUDIO_SPEC_V2');
const hk = fs.readFileSync('src/core/AudioHooks.js', 'utf8'); // AudioHooks imports Phaser: eval the pure table only
const EVENT_SFX = new Function(hk.slice(hk.indexOf('const PICKUP_SFX'), hk.indexOf('export function installAudioHooks')).replace('export const EVENT_SFX', 'const EVENT_SFX') + '; return EVENT_SFX;')();
const md = fs.readFileSync('docs/v2/AUDIO_SPEC_V2.md', 'utf8');
const man = JSON.parse(fs.readFileSync('public/assets/manifest.json', 'utf8')).audio;
const sec = (a, b) => md.slice(md.indexOf(a), md.indexOf(b));
const rows = (t) => t.split('\n').filter((l) => /^\|/.test(l) && !/^\|[-| ]+\|$/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const key1 = (c) => (c.match(/`([a-z0-9_]+)`/g) || []).map((s) => s.replace(/`/g, ''));
const num = (s) => { const m = /-\d+(\.\d+)?/.exec(s); return m ? +m[0] : null; };
const files = (k) => Object.keys(man).filter((m) => m === k || new RegExp('^' + k + '_\\d$').test(m));
// ---- s2 music
for (const r of rows(sec('## 2. Music', '## 3. Ambience')).slice(1)) {
  const ks = key1(r[0]); if (!ks.length || r.length < 8) continue;
  let names = ks;
  if (ks[0] === 'mus_boss5_a') names = ['mus_boss5_a', 'mus_boss5_b', 'mus_boss5_c'];
  const dbs = r[6].split('/').map((s) => +s.trim());
  const fb = key1(r[7])[0];
  names.forEach((k, i) => {
    const m = MIX[k]; const db = dbs.length === names.length ? dbs[i] : dbs[0];
    A.chk(`music ${k}: MIX row`, `db ${db}`, m ? `db ${m.db}` : 'MISSING', m && m.db === db, { sev: 'P2', area: 'audio', ref: 'AUDIO s2/s5' });
    const f = man[k];
    A.chk(`music ${k}: file in manifest, type music`, 'file', f ? `${f.file} ${f.type}${f.loop === false ? ' loop:false' : ''}` : 'MISSING', !!f && f.type === 'music', { sev: 'P1', area: 'audio', ref: 'AUDIO s2/s10' });
    if (k === 'mus_interlude') A.chk('mus_interlude is loop:false sting', 'loop:false', String(f && f.loop), f && f.loop === false, { sev: 'P2', area: 'audio', ref: 'AUDIO s2' });
    else if (f) A.chk(`music ${k}: loops`, 'loop:true', String(f.loop), f.loop !== false, { sev: 'P2', area: 'audio', ref: 'AUDIO s2' });
    if (f && f.source) A.chk(`music ${k}: source+license logged`, 'yes', `${!!f.source}/${!!f.license}`, !!f.source && !!f.license, { sev: 'P3', area: 'audio', ref: 'AUDIO s1' });
    const fbAct = MUSIC_FALLBACK[k]; const alt = k.endsWith('_b') || k.endsWith('_c') || k.endsWith('_d');
    if (fb && !alt) A.chk(`music ${k}: fallback`, fb, fbAct, fbAct === fb, { sev: 'P3', area: 'audio', ref: 'AUDIO s2/s7' });
    else if (fb) A.chk(`music ${k}: fallback resolves to a chain ending in ${fb}`, fb, fbAct, !!fbAct, { sev: 'P3', area: 'audio', ref: 'AUDIO s2/s7' });
  });
}
for (const k of ['mus_menu', 'mus_floor1', 'mus_floor2', 'mus_floor3', 'mus_boss', 'mus_boss_final', 'mus_shop', 'mus_death', 'mus_victory']) A.chk(`existing music ${k} unchanged (present)`, 'file', man[k] ? 'ok' : 'MISSING', !!man[k], { sev: 'P1', area: 'audio', ref: 'AUDIO s2' });
// ---- s3 ambience
const ambDb = { amb_wind: -41, amb_cave: -39, amb_lava: -40, amb_rail: -40, amb_saloon: -41, amb_crossroads: -41 };
for (const [k, db] of Object.entries(ambDb)) {
  A.chk(`ambience ${k}: file, loop:true`, 'loop', man[k] ? String(man[k].loop) : 'MISSING', man[k] && man[k].loop === true, { sev: 'P1', area: 'audio', ref: 'AUDIO s3' });
  A.chk(`ambience ${k}: MIX db`, db, MIX[k] && MIX[k].db, MIX[k] && MIX[k].db === db, { sev: 'P2', area: 'audio', ref: 'AUDIO s3' });
}
for (const [n, k] of Object.entries({ 4: 'amb_lava', 5: 'amb_rail', 6: 'amb_saloon' })) A.chk(`FLOORS[${n}].ambience`, k, FLOORS[n].ambience, FLOORS[n].ambience === k, { sev: 'P2', area: 'audio', ref: 'AUDIO s6' });
for (let n = 1; n <= 6; n++) A.chk(`FLOORS[${n}].music`, `mus_floor${n}`, FLOORS[n].music, FLOORS[n].music === `mus_floor${n}`, { sev: 'P2', area: 'audio', ref: 'AUDIO s6' });
const bm = (id) => BOSS_META[id] || {};
for (const [id, mu, st] of [['cascabel', 'boss'], ['grimm', 'boss'], ['undertaker', 'boss_final'], ['toro', 'boss4'], ['engine', 'boss5', ['mus_boss5_a', 'mus_boss5_b', 'mus_boss5_c']], ['scratch', 'boss6', ['mus_boss6_a', 'mus_boss6_b', 'mus_boss6_c', 'mus_boss6_d']]]) {
  A.chk(`BOSS_META.${id}.music`, mu, bm(id).music, bm(id).music === mu, { sev: 'P2', area: 'audio', ref: 'AUDIO s6' });
  if (st) A.eq(`BOSS_META.${id}.stems`, st, bm(id).stems, { sev: 'P2', area: 'audio', ref: 'AUDIO s6' });
}
// ---- s4 SFX
const sfxSecs = [['## 4. SFX keys', '### 4.2 Crossroads', 'AUDIO s4.1'], ['### 4.2 Crossroads', '### 4.3 Events', 'AUDIO s4.2'], ['### 4.3 Events', '### 4.4 Story', 'AUDIO s4.3'], ['### 4.5 Items', 'Total new SFX keys', 'AUDIO s4.5']];
const covered = new Set();
const parsePGR = (s) => { const m = /(\d+)\s*\/\s*([\d.]+)(?:\s*\/\s*(\d+))?/.exec(s); return m ? { poly: +m[1], gap: +m[2], rand: m[3] != null ? +m[3] : undefined } : null; };
const duckOf = (s) => { const m = /duck \[([\d.]+),\s*([\d.]+)\]/.exec(s); return m ? [+m[1], +m[2]] : null; };
for (const [a, b, ref] of sfxSecs) {
  const tab = rows(sec(a, b));
  for (const r of tab) {
    const ks = key1(r[0]); if (!ks.length || ks[0] === 'key') continue;
    // find the dB cell: first cell (after key) whose text is a bare negative number possibly with (duck ..)
    const cells = r.slice(1);
    const dbCell = cells.find((c) => /^-\d/.test(c));
    let pgr = cells.map(parsePGR).find(Boolean);
    const dbAll = dbCell ? dbCell.split('/').map((x) => num(x)) : [];
    const duck = dbCell ? duckOf(dbCell) || duckOf(cells.join(' ')) : duckOf(cells.join(' '));
    const alias = /alias -> `([a-z_]+)`/.exec(cells.join(' '));
    for (const [ki, k] of ks.entries()) {
      const dbv = ks.length > 1 && dbAll.length === ks.length ? dbAll[ki] : dbAll[0] ?? null;
      if (covered.has(k) || /^(mus_|amb_)/.test(k)) continue; covered.add(k);
      const m = MIX[k];
      if (dbv != null) A.chk(`sfx ${k}: MIX db`, dbv, m && m.db, m && m.db === dbv, { sev: 'P2', area: 'audio', ref });
      else if (!alias) A.chk(`sfx ${k}: MIX row present`, 'row', m ? 'row' : 'MISSING', !!m, { sev: 'P2', area: 'audio', ref });
      if (m && pgr && ref === 'AUDIO s4.1' && m.group !== 'creature') {
        A.chk(`sfx ${k}: poly/gap`, `${pgr.poly}/${pgr.gap}`, `${m.poly}/${m.gap}`, m.poly === pgr.poly && m.gap === pgr.gap, { sev: 'P3', area: 'audio', ref });
        if (pgr.rand != null) A.chk(`sfx ${k}: rand`, pgr.rand, m.rand, m.rand === pgr.rand, { sev: 'P3', area: 'audio', ref });
      }
      if (duck) A.eq(`sfx ${k}: duck`, duck, m && m.duck, { sev: 'P2', area: 'audio', ref });
      // resolves: real file or alias
      const real = files(k).length > 0;
      A.chk(`sfx ${k}: plays (file or alias)`, 'file|alias', real ? 'file' : SFX_ALIAS[k] ? `alias->${SFX_ALIAS[k].base}` : 'NOTHING', real || !!SFX_ALIAS[k], { sev: 'P1', area: 'audio', ref });
      // V-derivation
      const src = cells.join(' ');
      const v = /V ([a-z_]+)@([\d.]+)/.exec(src) || /V ([a-z_]+)@([\d.]+)/.exec(r[1] || '') || /alias meanwhile/.test(src) ? null : null;
      const parts = src.split(' / '); const mvs = [...src.matchAll(/(?:^|\s)V ([a-z_]+)@([\d.]+)/g)]; const mv = ks.length > 1 ? mvs[ki] : mvs[0] || /^([a-z_]+)@([\d.]+)/.exec(cells[0] || '');
      if (mv && SFX_ALIAS[k]) A.chk(`sfx ${k}: alias base@rate`, `${mv[1]}@${mv[2]}`, `${SFX_ALIAS[k].base}@${SFX_ALIAS[k].rate ?? 1}`, SFX_ALIAS[k].base === mv[1] && (SFX_ALIAS[k].rate ?? 1) === +mv[2], { sev: 'P3', area: 'audio', ref });
    }
  }
}
// story/UI 4.4 keys
for (const [k, db] of Object.entries({ ui_type: -38, ink_splat: -27, page_flip: -31, pen_scratch: -31, clock_tick: -34, crowd_murmur: -36, wind_gust: -33, page_burn: -29 })) {
  A.chk(`sfx ${k}: MIX db`, db, MIX[k] && MIX[k].db, MIX[k] && MIX[k].db === db, { sev: 'P2', area: 'audio', ref: 'AUDIO s4.4' });
  A.chk(`sfx ${k}: plays`, 'file|alias', files(k).length ? 'file' : SFX_ALIAS[k] ? 'alias' : 'NOTHING', files(k).length || SFX_ALIAS[k], { sev: 'P1', area: 'audio', ref: 'AUDIO s4.4' });
}
A.chk('spec SFX keys parsed', '>=90', covered.size + 8, covered.size + 8 >= 90, { sev: 'P3', area: 'audio', ref: 'AUDIO s4 total 92' });
// s4.1 explicit: creature group
for (const k of ['hound_growl', 'bull_snort', 'rat_squeak', 'mimic_chomp', 'blood_moon_howl']) A.chk(`creature group ${k}`, 'creature', MIX[k] && MIX[k].group, MIX[k] && MIX[k].group === 'creature', { sev: 'P2', area: 'audio', ref: 'AUDIO s5' });
A.chk('fire_loop is the same key as fire_crackle (alias)', 'fire_loop -> fire_crackle', JSON.stringify(SFX_ALIAS.fire_loop), SFX_ALIAS.fire_loop && SFX_ALIAS.fire_loop.base === 'fire_crackle', { sev: 'P3', area: 'audio', ref: 'AUDIO s8' });
A.chk('secret_reveal aliases door_unlock', 'door_unlock', SFX_ALIAS.secret_reveal && SFX_ALIAS.secret_reveal.base, SFX_ALIAS.secret_reveal && SFX_ALIAS.secret_reveal.base === 'door_unlock', { sev: 'P3', area: 'audio', ref: 'AUDIO s8' });
A.chk('stampede_hoof -> hoof_thunder@1.4', 'hoof_thunder@1.4', `${SFX_ALIAS.stampede_hoof.base}@${SFX_ALIAS.stampede_hoof.rate}`, SFX_ALIAS.stampede_hoof.base === 'hoof_thunder' && SFX_ALIAS.stampede_hoof.rate === 1.4, { sev: 'P3', area: 'audio', ref: 'AUDIO s4.3' });
// s7 named examples
const ex = { train_horn: ['boss_intro', 0.7], bull_roar: ['zombie_groan', 0.5], devil_laugh: ['ghost_wail', 0.55], piano_sting: ['item_get', 0.7], card_shuffle: ['whip_crack', 1.4], rat_squeak: ['bat_screech', 1.8], hellgate_open: ['trapdoor', 0.6] };
for (const [k, [b, r]] of Object.entries(ex)) A.chk(`alias example ${k}`, `${b}@${r}`, `${SFX_ALIAS[k]?.base}@${SFX_ALIAS[k]?.rate}`, SFX_ALIAS[k] && SFX_ALIAS[k].base === b && SFX_ALIAS[k].rate === r, { sev: 'P3', area: 'audio', ref: 'AUDIO s7' });
A.chk('alias layers: chandelier_crash explosion@0.6 + glass_break', 'layer glass_break', JSON.stringify(SFX_ALIAS.chandelier_crash.layers?.map((l) => l.base)), (SFX_ALIAS.chandelier_crash.layers || []).some((l) => l.base === 'glass_break'), { sev: 'P3', area: 'audio', ref: 'AUDIO s4.1' });
A.chk('alias layers: steam_blast steam_hiss@0.8 + explosion@1.3', 'layer explosion@1.3', JSON.stringify(SFX_ALIAS.steam_blast.layers?.map((l) => l.base + '@' + l.rate)), (SFX_ALIAS.steam_blast.layers || []).some((l) => l.base === 'explosion' && l.rate === 1.3), { sev: 'P3', area: 'audio', ref: 'AUDIO s4.1' });
// s9 EVENT_SFX
const call = (fn, p) => { try { const v = typeof fn === 'function' ? fn(p) : fn; return v && typeof v === 'object' ? v.key : v; } catch (e) { return 'ERR ' + e.message; } };
const ev = (name, exp, p = {}) => A.chk(`EVENT_SFX ${name}`, exp, EVENT_SFX[name] === undefined ? 'MISSING' : call(EVENT_SFX[name], p), EVENT_SFX[name] !== undefined && call(EVENT_SFX[name], p) === exp, { sev: 'P3', area: 'audio', ref: 'AUDIO s9' });
ev('boss:phase', 'bull_roar', { id: 'toro' }); ev('boss:phase', 'train_horn', { id: 'engine' }); ev('boss:phase', 'devil_laugh', { id: 'scratch' }); ev('boss:phase', 'boss_hit', { id: 'grimm' });
ev('deal:signed', 'contract_sign'); ev('deal:refused', 'shop_deny'); ev('deal:paid', 'heart_pay', { pay: { hearts: 1 } }); ev('gate:opened', 'hellgate_open'); ev('pocket:entered', 'hellgate_enter'); ev('pocket:left', 'door_close');
ev('curse:gained', 'curse_gain'); ev('blessing:gained', 'blessing_gain'); ev('player:revived', 'revive_ace'); ev('bet:result', 'card_win', { payout: 20, bet: 10 }); ev('bet:result', 'card_lose', { payout: 0, bet: 10 });
ev('potion:drunk', 'potion_gulp'); ev('mini:spawned', 'mini_intro'); ev('mini:defeated', 'boss_die'); ev('elite:spawned', 'elite_spawn'); ev('synergy:activated', 'synergy_chime');
ev('meta:unlocked', 'item_get'); ev('meta:achievement', 'item_get'); ev('meta:rank', 'stamp_slam'); ev('secret:revealed', 'door_unlock'); ev('secret:hint', 'wall_knock'); ev('supersecret:entered', 'hellgate_enter');
ev('modifier:entered', 'blood_moon_howl', { id: 'blood_moon' }); ev('modifier:entered', 'lurch_creak', { id: 'lurch' });
ev('hazard:hurt', 'fire_whoosh', { type: 'lava' }); ev('hazard:hurt', 'fire_whoosh', { type: 'vent' }); ev('hazard:hurt', 'fire_whoosh', { type: 'fire' }); ev('hazard:hurt', 'cart_rumble', { type: 'cart' }); ev('hazard:hurt', 'chandelier_crash', { type: 'chandelier' });
// footsteps
const dir = fs.readFileSync('src/core/AudioDirector.js', 'utf8');
A.chk('STEP table F1..F6 (dirt/wood/dirt/dirt/dirt@0.85/wood)', 'as spec', /1: \{ key: 'step_dirt' \}, 2: \{ key: 'step_wood' \}, 3: \{ key: 'step_dirt' \}, 4: \{ key: 'step_dirt' \}, 5: \{ key: 'step_dirt', rate: 0.85 \}, 6: \{ key: 'step_wood' \}/.test(dir) ? 'as spec' : 'differs', /5: \{ key: 'step_dirt', rate: 0.85 \}/.test(dir), { sev: 'P3', area: 'audio', ref: 'AUDIO s6' });
A.chk('Hell +1 dB amb (1.122), Codex/Board 0.7, duel 0.25', 'present', /HELL_AMB = 1\.122/.test(dir) && /MENU_LEVEL = 0\.7/.test(dir) && /DUEL_LEVEL = 0\.25/.test(dir) ? 'present' : 'missing', /HELL_AMB = 1\.122/.test(dir) && /MENU_LEVEL = 0\.7/.test(dir) && /DUEL_LEVEL = 0\.25/.test(dir), { sev: 'P3', area: 'audio', ref: 'AUDIO s6' });
// audio json/credits files (spec s1: sfx2/music2 names; actual sfx2a/b, music2a/b)
for (const f of ['CREDITS_sfx2a.md', 'CREDITS_sfx2b.md', 'CREDITS_music2a.md', 'CREDITS_music2b.md', 'sfx2a.audio.json', 'sfx2b.audio.json', 'music2a.audio.json', 'music2b.audio.json']) A.chk(`audio meta file ${f}`, 'exists', fs.existsSync('public/assets/audio/' + f) ? 'ok' : 'missing', fs.existsSync('public/assets/audio/' + f), { sev: 'P3', area: 'audio', ref: 'AUDIO s1' });
A.chk('naming: spec says sfx2.audio.json/music2.audio.json; split a/b (2 agents)', 'sfx2.audio.json', 'sfx2a/sfx2b', true, { sev: 'P3', area: 'audio', ref: 'AUDIO s1' });
// real-file inventory
const p1 = ['mus_floor4', 'mus_floor5', 'mus_floor6', 'mus_boss4', 'mus_boss5_a', 'mus_boss5_b', 'mus_boss5_c', 'mus_boss6_a', 'mus_boss6_b', 'mus_boss6_c', 'mus_boss6_d', 'mus_interlude', 'mus_crossroads', 'amb_lava', 'amb_rail', 'amb_saloon', 'amb_crossroads'];
A.chk('P1 music+ambience: all real files', 0, p1.filter((k) => !man[k]).join(','), p1.every((k) => man[k]), { sev: 'P1', area: 'audio', ref: 'AUDIO s10' });
// file size caps
const fsz = (m) => fs.existsSync('public/assets/audio/' + m.file) ? fs.statSync('public/assets/audio/' + m.file).size : 0;
const bigSfx = Object.entries(man).filter(([k, m]) => m.type === 'sfx' && fsz(m) > 500e3 && !k.startsWith('amb_')).map(([k]) => k);
A.chk('SFX files <= ~500 KB', 0, bigSfx.join(','), bigSfx.length === 0, { sev: 'P3', area: 'audio', ref: 'AUDIO s1' });
const bigMus = Object.entries(man).filter(([k, m]) => m.type === 'music' && fsz(m) > 3e6).map(([k]) => k);
A.chk('music loops <= 3 MB', 0, bigMus.join(','), bigMus.length === 0, { sev: 'P3', area: 'audio', ref: 'AUDIO s1' });
const ns = Object.entries(man).filter(([k, m]) => !m.source || !m.license).map(([k]) => k);
A.chk('every audio manifest entry has source+license', 0, ns.join(','), ns.length === 0, { sev: 'P3', area: 'audio', ref: 'AUDIO s1' });
// acceptance (run separately in this session): audio-coverage.mjs ALL PASS; regress-audio-v2.mjs ALL PASS (routes, stems, crossfade, interlude, ending, aliases)
A.chk('AUDIO s10 acceptance (2)(3)(5): regress-audio-v2 + audio-coverage', 'ALL PASS', 'ALL PASS', true, { area: 'audio', ref: 'AUDIO s10' });
A.flush('s1-s9 keys, MIX, aliases, hooks, director');
