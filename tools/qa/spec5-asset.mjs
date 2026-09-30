// QA-5 ASSET_SPEC_V2 audit (node, static): manifest keys, frame counts/sizes, file dims, meta files, image dims.
import fs from 'node:fs';
import { audit } from './spec5-lib.mjs';
const A = audit('ASSET_SPEC_V2');
const M = JSON.parse(fs.readFileSync('public/assets/manifest.json', 'utf8'));
const pub = (f) => 'public/assets/' + f;
function pngDims(f) { const b = fs.readFileSync(f); return b.toString('ascii', 1, 4) === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; }
function webpDims(f) {
  const b = fs.readFileSync(f); if (b.toString('ascii', 0, 4) !== 'RIFF') return null; const t = b.toString('ascii', 12, 16);
  if (t === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (t === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  return null;
}
const S = M.sprites, I = M.images;
// spec: key -> [frames, fw, fh, mode, anchor]
const spr = {};
const add = (k, frames, fw, fh, mode, anchor, ref) => { spr[k] = { frames, fw, fh, mode, anchor, ref }; };
for (const id of ['preacher', 'hunter', 'queen']) {
  for (const a of ['walk_down', 'walk_up', 'walk_side']) add(`player_${id}_${a}`, 6, 128, 128, 'strip', 'bottom', 's1');
  add(`player_${id}_fire`, 3, 128, 128, 'strip', 'bottom', 's1'); add(`player_${id}_roll`, 4, 128, 128, 'strip', 'bottom', 's1'); add(`player_${id}_death`, 5, 128, 128, 'strip', 'bottom', 's1');
}
const en = { hellhound: 128, sulfur_preacher: 128, hellsteer: 160, magma_golem: 160, cinder_skull: 96, magma_eel: 128, handcar_bandit: 160, steam_stoker: 160, signalman: 128, crate_mimic: 128, rail_rat: 64, chain_gang: 128, card_shark: 128, joker: 128, slot_fiend: 160, bouncer: 160, loaded_die: 128, waiter_imp: 96 };
for (const [k, s] of Object.entries(en)) add(`enemy_${k}`, 6, s, s, 'strip', 'bottom', 's3');
for (const k of ['ol_fury', 'hangman', 'motherlode', 'ash_deacon', 'stoker', 'head_bouncer']) add(`enemy_${k}`, 6, 192, 192, 'strip', 'bottom', 's3 minis');
for (const b of ['toro', 'engine', 'scratch', 'scratch_true']) { add(`boss_${b}_idle`, 4, 320, 320, 'strip', 'bottom', 's4'); add(`boss_${b}_atk`, 4, 320, 320, 'strip', 'bottom', 's4'); }
add('boss_engine_run', 4, 512, 320, 'grid|strip', 'bottom', 's4');
for (const f of ['f4', 'f5', 'f6']) add(`obst_${f}`, 8, 96, 96, 'grid', 'bottom', 's2.2');
add('haz_f4', 8, 96, 96, 'grid', 'center', 's2.3'); add('haz_f5', 8, 96, 96, 'grid', 'center', 's2.3');
add('haz_cart', 4, 192, 128, 'grid|strip', 'center', 's2.3'); add('prop_chandelier', 3, 192, 192, 'grid|strip', 'center', 's2.3');
add('fx_hellfire', 6, 128, 192, 'strip', 'bottom', 's2.3'); add('projectiles_c2', 8, 48, 48, 'grid', 'center', 's2.3');
add('npc_dealer', 6, 160, 160, 'strip', 'bottom', 's5'); add('props_deals', 8, 128, 128, 'grid', 'center', 's5'); add('props_events', 8, 192, 192, 'grid', 'center|bottom', 's5');
add('icons_events', 8, 96, 96, 'grid', 'center', 's5'); add('props_small', 8, 96, 96, 'grid', 'center', 's5'); add('obst_hazards', 8, 96, 96, 'grid', 'bottom', 's5');
for (const c of 'abcdef') add(`items2_${c}`, 8, 96, 96, 'grid', 'center', 's6');
add('familiars_v2', 8, 64, 64, 'grid', 'bottom', 's6'); add('fx_items', 8, 128, 128, 'grid', 'center', 's6'); add('projectiles_v2', 8, 48, 48, 'grid', 'center', 's6');
add('meta_icons', 8, 96, 96, 'grid', 'center', 's7'); add('ach_cat', 8, 96, 96, 'grid', 'center', 's7');
const names = {
  obst_f4: 'block_a,block_b,breakable,breakable_broken,pit,spikes,decor_a,decor_b', obst_f5: 'block_a,block_b,breakable,breakable_broken,pit,spikes,decor_a,decor_b', obst_f6: 'block_a,block_b,breakable,breakable_broken,pit,spikes,decor_a,decor_b',
  haz_f4: 'lava_a,lava_b,lava_c,lava_rim,vent_idle,vent_warn,vent_erupt,scorch_patch', haz_f5: 'rail_h,rail_v,rail_cross,rail_end,steam_pipe,signal_lamp_off,signal_lamp_on,coal_pile_decor',
  haz_cart: 'cart_h_0,cart_h_1,cart_v_0,cart_v_1', props_deals: 'hellgate_a,hellgate_b,deal_table,signpost,candelabra,dead_tree,skull_pile,ledger_book',
  props_events: 'card_table,well,wagon_oil,confessional,grave_mound,grave_open,duel_post,altar_shrine', icons_events: 'bless_steady,bless_grace,bless_iron,bless_fleet,curse_debt,curse_dark,curse_rot,curse_lead',
  props_small: 'potion_bottle,card_back,card_face,chip_stack,heart_container,wanted_poster,chalk_x,rock_chunk', obst_hazards: 'quicksand,gravestone,spikes_ret_down,spikes_ret_warn,spikes_ret_up,powder_barrel,rubble,scorch',
  items2_a: 'forked_tongue,widows_bone,lightning_rod,blast_caps,wraith_rounds,lodestone,blue_norther,brand_iron', items2_b: 'gila_gland,holy_water,wanted_poster,bronco_boots,hand_mirror,black_cat_bone,blood_bandana,banker_ledger',
  items2_c: 'hush_money,rabbits_foot,dowsing_rod,bone_hound,tumbleweed_pal,little_coffin,saints_halo,lit_cigar', items2_d: 'nitro_jelly,short_cylinder,hellfire_round,carousel_slug,widowmaker,ten_gauge_hammer,pawn_ticket,dynamite_crate',
  items2_e: 'gideons_bible,cylinder_spin,lasso_rope,ouija_planchette,devils_own_colt,cylinder_of_sin,bloodletter,reapers_bargain', items2_f: 'gold_fever,brimstone_bandolier,lazarus_pact,pact_of_ashes,devils_dice,leech_contract',
  familiars_v2: 'bone_hound_a,bone_hound_b,tumble_pal_a,tumble_pal_b,coffin_pal_a,coffin_pal_b,halo_a,halo_b', fx_items: 'fx_firepool,fx_holy_pillar,fx_shock_ring,fx_toxic_cloud,fx_dust_cloud,fx_mark,fx_ice_burst,fx_nova',
  projectiles_v2: 'bullet_bone,bullet_ghost,bullet_cap,bullet_orbit,bullet_ice,bullet_coin,bullet_mirror,bullet_child', projectiles_c2: 'bullet_ember,bullet_coal,bullet_steam,bullet_card,bullet_chip,bullet_shard,bullet_spade,bullet_spike',
  meta_icons: 'sermon_bible,hunters_ledger,gilded_pair,star_tin,star_silver,star_gold,padlock,rank_badge', ach_cat: 'combat,boss,ride,skill,economy,relic,rider,secret',
};
const opt = (k) => k.startsWith('player_') || k.startsWith('enemy_');
for (const [k, s] of Object.entries(spr)) {
  const e = S[k];
  if (!e) { A.chk(`sprite ${k} in manifest`, 'present', 'MISSING', false, { sev: 'P1', area: 'content', ref: `ASSET ${s.ref}` }); continue; }
  const png = pngDims(pub(e.file));
  const okFile = !!png;
  const grid = e.mode === 'grid';
  const fits = png && (e.mode === 'strip' ? png[0] === e.frameWidth * e.frames && png[1] === e.frameHeight : png[0] % e.frameWidth === 0 && png[1] % e.frameHeight === 0 && (png[0] / e.frameWidth) * (png[1] / e.frameHeight) >= e.frames);
  const exp = `${s.frames}f ${s.fw}x${s.fh} ${s.mode} ${s.anchor}`;
  const act = `${e.frames}f ${e.frameWidth}x${e.frameHeight} ${e.mode} ${e.anchor}${png ? ` png ${png.join('x')}` : ' NOFILE'}`;
  const anchorOk = s.anchor.split('|').includes(e.anchor);
  A.chk(`sprite ${k}`, exp, act, e.frames === s.frames && e.frameWidth === s.fw && e.frameHeight === s.fh && s.mode.split('|').includes(e.mode) && anchorOk && okFile && fits, { sev: 'P2', area: 'content', ref: `ASSET ${s.ref}` });
  if (names[k]) { const want = names[k].split(','); const got = e.names || []; A.chk(`sprite ${k} cell names/order`, want.join(','), got.join(','), want.every((n, i) => got[i] === n), { sev: 'P2', area: 'content', ref: `ASSET ${s.ref}` }); }
  const mf = pub(e.file.replace(/\.png$/, '.meta.json')); A.chk(`sprite ${k} .meta.json`, 'exists', fs.existsSync(mf) ? 'ok' : 'missing', fs.existsSync(mf), { sev: 'P3', area: 'content', ref: 'ASSET s0 pipeline' });
}
// images
const imgs = {}; const addI = (k, w, h, ref) => { imgs[k] = { w, h, ref }; };
for (const f of ['f4', 'f5', 'f6']) for (const v of ['a', 'b', 'c', 'boss']) addI(`bg_${f}_${v}`, 1440, 864, 's2.1');
addI('bg_crossroads', 1440, 864, 's5');
for (const p of ['preacher', 'hunter', 'queen', 'toro', 'engine', 'scratch']) addI(`portrait_${p}`, 512, 512, 's1/4');
addI('img_interlude_ch2', 1440, 960, 's2.3'); addI('ui_charselect_bg', 1440, 960, 's7'); addI('ui_codex_bg', 1440, 960, 's7');
for (const k of ['title_l0_sky', 'title_l1_town', 'title_l2_fg']) addI(k, 1440, 960, 's8'); addI('title_l3_rider', 512, 640, 's8');
const cs = ['intro_1', 'intro_2', 'intro_3', 'intro_4', 'intro_5', 'intro_6', 'intro_7', 'interlude_1', 'saloon_1', 'end_a_1', 'end_a_2', 'end_a_3', 'end_a_4', 'end_a_5', 'end_true_1', 'end_true_2', 'end_true_3', 'end_true_4', 'end_true_5', 'end_true_6'];
for (const c of cs) addI(`cutscene_${c}`, 1440, 960, 's8');
A.chk('cutscene_* count', 20, Object.keys(I).filter((k) => k.startsWith('cutscene_')).length, Object.keys(I).filter((k) => k.startsWith('cutscene_')).length === 20, { area: 'content', ref: 'ASSET s13' });
for (const [k, s] of Object.entries(imgs)) {
  const e = I[k];
  if (!e) { A.chk(`image ${k} in manifest`, 'present', 'MISSING', false, { sev: 'P1', area: 'content', ref: `ASSET ${s.ref}` }); continue; }
  const f = pub(e.file); const d = fs.existsSync(f) ? (f.endsWith('.webp') ? webpDims(f) : pngDims(f)) : null;
  A.chk(`image ${k}`, `${s.w}x${s.h}`, `manifest ${e.width}x${e.height}, file ${d ? d.join('x') : 'NOFILE'}`, e.width === s.w && e.height === s.h && d && d[0] === s.w && d[1] === s.h, { sev: 'P2', area: 'content', ref: `ASSET ${s.ref}` });
}
// mini/unique reuse: no fx_fire / ui_board_bg / ui_synergy_ribbon (cuts)
for (const k of ['fx_fire', 'ui_board_bg', 'ui_synergy_ribbon']) A.chk(`cut key ${k} absent`, 'absent', S[k] || I[k] ? 'present' : 'absent', !(S[k] || I[k]), { sev: 'P3', area: 'content', ref: 'ASSET s11' });
A.chk('enemy_bouncer (F6 grunt) and enemy_head_bouncer (mini) distinct 160/192', '160 / 192', `${S.enemy_bouncer?.frameWidth} / ${S.enemy_head_bouncer?.frameWidth}`, S.enemy_bouncer?.frameWidth === 160 && S.enemy_head_bouncer?.frameWidth === 192, { area: 'content', ref: 'ASSET s3/s11' });
// every manifest sprite/image file exists; every file on disk in manifest
let miss = [];
for (const [k, e] of [...Object.entries(S), ...Object.entries(I)]) if (!fs.existsSync(pub(e.file))) miss.push(k);
A.chk('every manifest file exists on disk', 0, miss.length + ' ' + miss.join(','), miss.length === 0, { sev: 'P1', area: 'content', ref: 'ASSET s13' });
const disk = fs.readdirSync('public/assets/sprites').filter((f) => f.endsWith('.png') && !f.endsWith('.preview.png')).map((f) => f.replace(/\.png$/, ''));
const orphan = disk.filter((k) => !S[k]);
A.chk('every sprite png on disk is in manifest', 0, orphan.length + ' ' + orphan.join(','), orphan.length === 0, { sev: 'P3', area: 'content', ref: 'ASSET s13' });
// optimized size
const big = [...Object.values(S), ...Object.values(I)].filter((e) => fs.statSync(pub(e.file)).size > 3.5e6).map((e) => e.file);
A.chk('no asset > 3.5 MB', 0, big.join(','), big.length === 0, { sev: 'P3', area: 'content', ref: 'ASSET s0 optimize' });
const total = [...Object.values(S), ...Object.values(I)].reduce((n, e) => n + fs.statSync(pub(e.file)).size, 0);
console.log('total visual asset MB', (total / 1e6).toFixed(1));
A.flush('manifest keys, frames, sizes (s1-s13)');
