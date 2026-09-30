// Round-2 item art keys (ITEMS_V2 s8, ASSET_SPEC_V2 s6). Registering the grid layouts in Assets.SPEC gives every icon a coloured-chip placeholder
// (Assets.tex) and lets Assets.frame() resolve cell names whether or not the real sheet is in the manifest. Imported once by items/index.js.
import { SPEC } from '../../core/Assets.js';

const grid = (fw, fh, cols, rows, names, a = 'center') => ({ fw, fh, cols, n: cols * rows, a, names });

export const ITEM_SHEETS = {
  items2_a: ['forked_tongue', 'widows_bone', 'lightning_rod', 'blast_caps', 'wraith_rounds', 'lodestone', 'blue_norther', 'brand_iron'],
  items2_b: ['gila_gland', 'holy_water', 'wanted_poster', 'bronco_boots', 'hand_mirror', 'black_cat_bone', 'blood_bandana', 'banker_ledger'],
  items2_c: ['hush_money', 'rabbits_foot', 'dowsing_rod', 'bone_hound', 'tumbleweed_pal', 'little_coffin', 'saints_halo', 'lit_cigar'],
  items2_d: ['nitro_jelly', 'short_cylinder', 'hellfire_round', 'carousel_slug', 'widowmaker', 'ten_gauge_hammer', 'pawn_ticket', 'dynamite_crate'],
  items2_e: ['gideons_bible', 'cylinder_spin', 'lasso_rope', 'ouija_planchette', 'devils_own_colt', 'cylinder_of_sin', 'bloodletter', 'reapers_bargain'],
  items2_f: ['gold_fever', 'brimstone_bandolier', 'lazarus_pact', 'pact_of_ashes', 'devils_dice', 'leech_contract', 'empty_a', 'empty_b'],
};
export const V2_BULLET_FRAMES = ['bullet_bone', 'bullet_ghost', 'bullet_cap', 'bullet_orbit', 'bullet_ice', 'bullet_coin', 'bullet_mirror', 'bullet_child'];
export const FX_ITEM_FRAMES = ['fx_firepool', 'fx_holy_pillar', 'fx_shock_ring', 'fx_toxic_cloud', 'fx_dust_cloud', 'fx_mark', 'fx_ice_burst', 'fx_nova'];
export const FAMILIAR_FRAMES = ['bone_hound_a', 'bone_hound_b', 'tumble_pal_a', 'tumble_pal_b', 'coffin_pal_a', 'coffin_pal_b', 'halo_a', 'halo_b'];

for (const [k, names] of Object.entries(ITEM_SHEETS)) if (!SPEC[k]) SPEC[k] = grid(96, 96, 4, 2, names);
if (!SPEC.familiars_v2) SPEC.familiars_v2 = grid(64, 64, 4, 2, FAMILIAR_FRAMES, 'bottom');
if (!SPEC.projectiles_v2) SPEC.projectiles_v2 = grid(48, 48, 4, 2, V2_BULLET_FRAMES);
if (!SPEC.fx_items) SPEC.fx_items = grid(128, 128, 4, 2, FX_ITEM_FRAMES);
