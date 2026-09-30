// Fallback layer for audio keys that have no real file yet (AUDIO_SPEC_V2 s2, s7). Pure data, node-importable.
//
//   SFX_ALIAS[key] = { base, rate = 1, vol = 1, layers?: [{ base, rate, vol, delay(ms) }] }
//     Sfx.play(key) uses the manifest file when it exists (real files always win, no code change needed when one lands); otherwise it plays
//     `base` (a real file, or another alias: chains are followed) at rate * caller rate, vol * caller vol, plus the layers. The loudness is
//     normalised to the MIX row of `key` (not of the base), so `vol` is only a trim on top of the target level.
//   MUSIC_FALLBACK[key] = closest existing track / ambience bed; chains are followed (mus_boss5_c -> mus_boss5_b -> mus_boss5_a -> mus_boss).
//   NEW_AUDIO = every key this file covers (debug: ?hideaudio=new hides them all, proving the game works with an empty new-audio directory).
// Bases are round-1 keys wherever possible so the aliases work with zero round-2 audio.

const L = (base, rate = 1, vol = 0.7, delay = 0) => ({ base, rate, vol, delay });

export const SFX_ALIAS = {
  // --- 4.1 chapter 2 world
  lava_bubble: { base: 'fuse', rate: 0.55, vol: 0.9 },
  lava_burst: { base: 'explosion', rate: 0.75 },
  vent_hiss: { base: 'steam_hiss', rate: 0.9 },
  vent_erupt: { base: 'fire_whoosh', rate: 0.9, layers: [L('explosion', 1.3, 0.55, 40)] },
  fire_whoosh: { base: 'lasso_swish', rate: 0.6, vol: 1.3, layers: [L('fuse', 0.5, 0.7)] },
  fire_crackle: { base: 'fuse', rate: 0.8, vol: 0.9 },
  fire_loop: { base: 'fire_crackle' },
  bull_snort: { base: 'zombie_groan', rate: 0.75, vol: 0.8 },
  bull_roar: { base: 'zombie_groan', rate: 0.5 },
  hoof_thunder: { base: 'explosion', rate: 0.5, vol: 0.8 },
  hound_growl: { base: 'zombie_groan', rate: 1.15, vol: 0.8 },
  train_horn: { base: 'boss_intro', rate: 0.7 },
  train_bell: { base: 'pickup_key', rate: 0.7, vol: 0.9 },
  rail_clatter: { base: 'skeleton_rattle', rate: 0.6, vol: 0.9 },
  cart_rumble: { base: 'explosion', rate: 0.4, vol: 0.8 },
  steam_hiss: { base: 'snake_hiss', rate: 0.6 },
  steam_blast: { base: 'steam_hiss', rate: 0.8, layers: [L('explosion', 1.3, 0.6)] },
  coal_thud: { base: 'bullet_hit_wall', rate: 0.5 },
  mimic_chomp: { base: 'door_close', rate: 1.5 },
  rat_squeak: { base: 'bat_screech', rate: 1.8, vol: 0.5 },
  chain_rattle: { base: 'skeleton_rattle', rate: 0.7 },
  card_throw: { base: 'lasso_swish', rate: 1.6 },
  card_shuffle: { base: 'whip_crack', rate: 1.4, vol: 0.5 },
  chip_clatter: { base: 'pickup_coin', rate: 1.3, vol: 0.85 },
  dice_roll: { base: 'pickup_coin', rate: 0.75, vol: 0.9 },
  slot_spin: { base: 'dodge_roll', rate: 0.6 },
  slot_ding: { base: 'pickup_coin', rate: 1.6, vol: 0.9 },
  slot_jam: { base: 'shop_deny', rate: 0.7 },
  glass_break: { base: 'bullet_hit_wall', rate: 1.7, vol: 1.2, layers: [L('pickup_key', 2, 0.35, 30)] },
  chandelier_creak: { base: 'coffin_open', rate: 0.6 },
  chandelier_crash: { base: 'explosion', rate: 0.6, layers: [L('glass_break', 1, 0.8, 30)] },
  roulette_tick: { base: 'menu_move', rate: 1.3 },
  roulette_zap: { base: 'shoot_crit', rate: 1.5, vol: 0.7 },
  piano_sting: { base: 'item_get', rate: 0.7 },
  devil_laugh: { base: 'ghost_wail', rate: 0.55 },
  contract_tear: { base: 'whip_crack', rate: 0.7, layers: [L('ghost_wail', 0.7, 0.5, 60)] },
  seal_break: { base: 'glass_break', rate: 1.2 },
  // --- 4.2 crossroads
  hellgate_open: { base: 'trapdoor', rate: 0.6, layers: [L('explosion', 0.5, 0.7)] },
  hellgate_enter: { base: 'trapdoor', rate: 0.7 },
  dealer_laugh: { base: 'ghost_wail', rate: 0.85, vol: 0.85 },
  dealer_mumble: { base: 'menu_move', rate: 0.5, vol: 0.8 },
  contract_hover: { base: 'page_flip', rate: 1 },
  contract_sign: { base: 'door_close', rate: 0.6, layers: [L('whip_crack', 1.2, 0.6, 50)] },
  heart_pay: { base: 'player_hurt', rate: 0.6, vol: 0.8 },
  curse_gain: { base: 'ghost_wail', rate: 0.5, vol: 0.8 },
  blessing_gain: { base: 'item_get', rate: 1.25, layers: [L('item_get', 2, 0.3, 60)] },
  revive_ace: { base: 'item_get', rate: 0.7, layers: [L('room_clear', 0.8, 0.7, 120)] },
  // --- 4.3 events, minis, elites, hazards, modifiers
  card_flip: { base: 'lasso_swish', rate: 1.8, vol: 0.5 },
  card_win: { base: 'item_get', rate: 1.4, vol: 0.6 },
  card_lose: { base: 'shop_deny', rate: 0.8 },
  chip_place: { base: 'chip_clatter', rate: 1.2 },
  well_plink: { base: 'pickup_coin', rate: 1.8, vol: 0.6 },
  well_wish: { base: 'item_get', rate: 0.8 },
  shovel_dig: { base: 'dig', rate: 1 },
  grave_crack: { base: 'coffin_open', rate: 0.8 },
  grave_open: { base: 'coffin_open', rate: 0.6 },
  bottle_pop: { base: 'whip_crack', rate: 1.2, vol: 0.8 },
  potion_gulp: { base: 'pickup_heart', rate: 0.7, vol: 0.8 },
  bell_toll: { base: 'pickup_key', rate: 0.35 },
  duel_draw: { base: 'whip_crack', rate: 0.9, layers: [L('lasso_swish', 1, 0.7)] },
  duel_start: { base: 'bell_toll' },
  quick_draw_ding: { base: 'pickup_key', rate: 1.5 },
  mini_intro: { base: 'boss_intro', rate: 1.1, vol: 0.85 },
  chain_whirl: { base: 'lasso_swish', rate: 0.7 },
  rock_crumble: { base: 'bullet_hit_wall', rate: 0.4 },
  censer_swing: { base: 'lasso_swish', rate: 0.5 },
  elite_spawn: { base: 'spawn', rate: 0.6, layers: [L('ghost_wail', 1.4, 0.4)] },
  elite_ting: { base: 'enemy_hit', rate: 1.6 },
  elite_pop: { base: 'fuse', rate: 1 },
  quicksand_bubble: { base: 'lava_bubble', rate: 0.7 },
  spikes_ret: { base: 'door_open', rate: 1.6 },
  rock_warn: { base: 'dig', rate: 0.8 },
  rock_impact: { base: 'bullet_hit_wall', rate: 0.4 },
  lurch_creak: { base: 'coffin_open', rate: 0.5 },
  blood_moon_howl: { base: 'coyote_howl', rate: 0.7 },
  wall_knock: { base: 'bullet_hit_wall', rate: 0.5 },
  stampede_rumble: { base: 'hoof_thunder' },
  stampede_hoof: { base: 'hoof_thunder', rate: 1.4 },
  secret_reveal: { base: 'door_unlock' },
  // --- 4.4 story / UI
  ui_type: { base: 'menu_move', rate: 1.6, vol: 0.5 },
  ink_splat: { base: 'bullet_hit_wall', rate: 0.6 },
  page_flip: { base: 'whip_crack', rate: 1.8, vol: 0.4 },
  pen_scratch: { base: 'lasso_swish', rate: 1.4, vol: 0.4 },
  clock_tick: { base: 'menu_move', rate: 0.8 },
  crowd_murmur: { base: 'amb_wind', rate: 1.4 },
  wind_gust: { base: 'lasso_swish', rate: 0.35, vol: 0.8 },
  page_burn: { base: 'fuse', rate: 1.3 },
  // --- 4.5 items / meta / character polish
  synergy_chime: { base: 'item_get', rate: 1.4 },
  shock_zap: { base: 'roulette_zap', rate: 1.2 },
  freeze_shatter: { base: 'glass_break', rate: 1.3 },
  holy_chime: { base: 'item_get', rate: 1.1 },
  mark_lock: { base: 'gun_cock', rate: 1.3 },
  ricochet_ping: { base: 'bullet_hit_wall', rate: 1.6 },
  stamp_slam: { base: 'door_close', rate: 0.8 },
  shoot_scatter: { base: 'shoot', rate: 0.8, vol: 1.4 },
  shoot_rifle: { base: 'shoot', rate: 0.7 },
  shoot_twin: { base: 'shoot', rate: 1.15 },
  // --- keys the round-2 code calls that no doc lists
  signal_lamp_on: { base: 'menu_select', rate: 0.8 },
  card_burn: { base: 'fuse', rate: 1.5 },
  ember_warn: { base: 'fuse', rate: 1.5, vol: 0.9 },
  curse: { base: 'curse_gain' },
};

/** Music + ambience fallbacks (AUDIO_SPEC_V2 s2, s3). `mus_boss5` / `mus_boss6` are the logical names GameScene requests (the director maps them to stems). */
export const MUSIC_FALLBACK = {
  mus_floor4: 'mus_floor3', mus_floor5: 'mus_floor2', mus_floor6: 'mus_floor2',
  mus_boss4: 'mus_boss',
  mus_boss5: 'mus_boss5_a', mus_boss5_a: 'mus_boss', mus_boss5_b: 'mus_boss5_a', mus_boss5_c: 'mus_boss5_b',
  mus_boss6: 'mus_boss6_a', mus_boss6_a: 'mus_boss_final', mus_boss6_b: 'mus_boss6_a', mus_boss6_c: 'mus_boss6_b', mus_boss6_d: 'mus_boss6_a',
  mus_interlude: 'mus_floor3', mus_crossroads: 'mus_shop', mus_miniboss: 'mus_boss',
  mus_cutscene_intro: 'mus_menu', mus_ending_a: 'mus_menu', mus_ending_true: 'mus_menu', mus_credits: 'mus_menu',
  amb_lava: 'amb_cave', amb_rail: 'amb_wind', amb_saloon: 'amb_wind', amb_crossroads: 'amb_wind',
};

export const NEW_AUDIO = new Set([...Object.keys(SFX_ALIAS), ...Object.keys(MUSIC_FALLBACK)]);

/** Follow `table` from `key` until `has(k)` is true (max 6 hops). Returns the key that exists, or null. */
export function resolveChain(key, has, table = MUSIC_FALLBACK) {
  for (let i = 0; key && i < 6; i++) {
    if (has(key)) return key;
    key = table[key];
  }
  return null;
}
