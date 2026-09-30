// Asset system: manifest loading, real-or-placeholder sprite creation, grid-atlas name lookup, animation helper.
//
// The game runs with ANY subset of assets. Every visual goes through Assets.makeSprite / Assets.makeImage / Assets.tex,
// which return a real sprite when the manifest has the key and a generated placeholder (same frame size) otherwise.
import Phaser from 'phaser';
import { FLOORS } from '../config.js';
import { isLazyAudio } from './mix.js';

const strip = (fw, fh, n, a = 'bottom') => ({ fw, fh, cols: n, n, a });
const grid = (fw, fh, cols, rows, names, a = 'center') => ({ fw, fh, cols, n: cols * rows, a, names });

const ITEM_A = ['spurs', 'lucky_horseshoe', 'hollow_point', 'speed_loader', 'long_barrel', 'sawed_off', 'ricochet', 'dead_eye'];
const ITEM_B = ['bandolier', 'snake_oil', 'tin_star', 'liquid_courage', 'cursed_coin', 'rattler_fang', 'silver_bullets', 'dynamite_vest'];
const ITEM_C = ['spirit_lantern', 'crow_companion', 'voodoo_doll', 'duster_coat', 'prospectors_pan', 'hex_bag', 'fan_the_hammer', 'mezcal_worm'];
const OBST = ['block_a', 'block_b', 'breakable', 'breakable_broken', 'pit', 'spikes', 'decor_a', 'decor_b'];

/** Default sizes/names from ASSET_SPEC.md; used for placeholders and as fallback when the manifest lacks info. */
export const SPEC = {
  player_walk_down: strip(128, 128, 6),
  player_walk_up: strip(128, 128, 6),
  player_walk_side: strip(128, 128, 6),
  player_fire: strip(128, 128, 3),
  player_roll: strip(128, 128, 4, 'center'),
  player_death: strip(128, 128, 5),
  enemy_coyote: strip(128, 128, 6),
  enemy_rattlesnake: strip(128, 128, 6),
  enemy_tumbleweed: strip(128, 128, 6),
  enemy_tumbleweed_mini: strip(64, 64, 6),
  enemy_outlaw: strip(128, 128, 6),
  enemy_buzzard: strip(160, 160, 6),
  enemy_possessed: strip(128, 128, 6),
  enemy_skeleton: strip(128, 128, 6),
  enemy_dynamiter: strip(128, 128, 6),
  enemy_ghost: strip(128, 128, 6),
  enemy_scarecrow: strip(160, 160, 6),
  enemy_crow: strip(96, 96, 6),
  enemy_miner: strip(160, 160, 6),
  enemy_bat: strip(96, 96, 6),
  enemy_mole: strip(128, 128, 6),
  enemy_coffin: strip(160, 160, 6),
  enemy_grunt: strip(128, 128, 6),
  boss_cascabel_idle: strip(320, 320, 4),
  boss_cascabel_atk: strip(320, 320, 4),
  boss_grimm_idle: strip(320, 320, 4),
  boss_grimm_atk: strip(320, 320, 4),
  boss_undertaker_idle: strip(320, 320, 4),
  boss_undertaker_atk: strip(320, 320, 4),
  // chapter 2 bosses (bottom anchor; the engine's locomotive charge sheet is 512 wide)
  boss_toro_idle: strip(320, 320, 4),
  boss_toro_atk: strip(320, 320, 4),
  boss_engine_idle: strip(320, 320, 4),
  boss_engine_atk: strip(320, 320, 4),
  boss_engine_run: strip(512, 320, 4),
  boss_scratch_idle: strip(320, 320, 4),
  boss_scratch_atk: strip(320, 320, 4),
  boss_scratch_true_idle: strip(320, 320, 4),
  boss_scratch_true_atk: strip(320, 320, 4),
  doors: grid(192, 128, 3, 2, ['door_open', 'door_closed', 'door_treasure_open', 'door_treasure_locked', 'door_boss_open', 'door_boss_closed']),
  obst_f1: grid(96, 96, 4, 2, OBST, 'bottom'),
  obst_f2: grid(96, 96, 4, 2, OBST, 'bottom'),
  obst_f3: grid(96, 96, 4, 2, OBST, 'bottom'),
  pickups: grid(64, 64, 5, 2, ['heart_full', 'heart_half', 'heart_tin', 'coin', 'coin_nickel', 'key', 'dynamite', 'chest_wood', 'chest_gold', 'chest_open']),
  props: grid(128, 128, 3, 2, ['pedestal', 'pedestal_shop', 'trapdoor_closed', 'trapdoor_open', 'peddler', 'tombstone_marker'], 'bottom'),
  items_passive_a: grid(96, 96, 4, 2, ITEM_A),
  items_passive_b: grid(96, 96, 4, 2, ITEM_B),
  items_passive_c: grid(96, 96, 4, 2, ITEM_C),
  items_active: grid(96, 96, 4, 1, ['whiskey_bottle', 'pocket_watch', 'powder_keg', 'lucky_deck']),
  projectiles: grid(48, 48, 4, 2, ['bullet_player', 'bullet_crit', 'bullet_enemy', 'bullet_venom', 'bullet_nail', 'bullet_ghostfire', 'dynamite_stick', 'rock_debris']),
  fx_explosion: strip(192, 192, 6, 'center'),
  fx_muzzle: strip(96, 96, 4, 'center'),
  fx_impact: strip(64, 64, 4, 'center'),
  fx_death_puff: strip(128, 128, 5, 'center'),
  fx_dust: strip(64, 64, 4, 'center'),
  fx_spawn: strip(128, 128, 5, 'center'),
  fx_blood: grid(128, 128, 4, 1, ['blood_a', 'blood_b', 'blood_c', 'blood_d']),
  dynamite_placed: strip(64, 64, 3, 'bottom'),
  hud_icons: grid(64, 64, 5, 2, ['heart_full', 'heart_half', 'heart_empty', 'tin_full', 'tin_half', 'coin', 'key', 'dynamite', 'bullet_full', 'bullet_empty']),
  // meta / UI sheets (Silhouette.metaIcon draws its own icons when this sheet is missing; the rows keep plain makeCell callers on named frames)
  meta_icons: grid(96, 96, 4, 2, ['sermon_bible', 'hunters_ledger', 'gilded_pair', 'star_tin', 'star_silver', 'star_gold', 'padlock', 'rank_badge']),
  ach_cat: grid(96, 96, 4, 2, ['combat', 'boss', 'ride', 'skill', 'economy', 'relic', 'rider', 'secret']),
  icons_events: grid(96, 96, 4, 2, ['bless_steady', 'bless_grace', 'bless_iron', 'bless_fleet', 'curse_debt', 'curse_dark', 'curse_rot', 'curse_lead']),
  npc_dealer: strip(160, 160, 6),
};
export const IMAGE_SPEC = {
  title_logo: [1024, 400],
  title_bg: [1440, 960],
  ui_parchment: [1200, 760],
  ui_cursor: [64, 64],
  portrait_cascabel: [512, 512],
  portrait_grimm: [512, 512],
  portrait_undertaker: [512, 512],
  portrait_player: [512, 512],
  portrait_preacher: [512, 512],
  portrait_hunter: [512, 512],
  portrait_queen: [512, 512],
  portrait_toro: [512, 512],
  portrait_engine: [512, 512],
  portrait_scratch: [512, 512],
  ui_charselect_bg: [1440, 960],
  ui_codex_bg: [1440, 960],
  img_interlude_ch2: [1440, 960],
  bg_shop: [1440, 864],
  bg_treasure: [1440, 864],
};
for (const f of [1, 2, 3]) for (const v of ['a', 'b', 'boss']) IMAGE_SPEC[`bg_f${f}_${v}`] = [1440, 864];

const STAT = { failed: new Set(), stamp: Date.now() };

const NAME_COL = {
  heart_full: '#d63a2a', heart_half: '#d63a2a', heart_empty: '#4a2a2a', heart_tin: '#aab4bc', tin_full: '#aab4bc', tin_half: '#aab4bc',
  coin: '#e8b83a', coin_nickel: '#c8ccd0', key: '#e8c84a', dynamite: '#c0392b', bullet_full: '#d9b071', bullet_empty: '#3a2a20',
  chest_wood: '#8a5a2a', chest_gold: '#e8b83a', chest_open: '#5a3a1a',
  bullet_player: '#f5ecd0', bullet_crit: '#ffc040', bullet_enemy: '#ff5a2a', bullet_venom: '#8fc23f', bullet_nail: '#a86a3a', bullet_ghostfire: '#6fe0d0', dynamite_stick: '#c0392b', rock_debris: '#8a7a68',
};
function hashCol(str, s = 45, l = 45) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360},${s}%,${l}%)`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Placeholder drawing
// ---------------------------------------------------------------------------------------------------------------------
function heart(ctx, cx, cy, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.7, cy - s * 1.1, cx, cy - s * 0.3);
  ctx.bezierCurveTo(cx + s * 0.7, cy - s * 1.1, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#120c0a';
  ctx.stroke();
}
function label(ctx, txt, x, y, size = 11, col = '#fff') {
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#120c0a';
  ctx.strokeText(txt, x, y);
  ctx.fillStyle = col;
  ctx.fillText(txt, x, y);
}
function shortName(key) {
  return key.replace(/^(enemy_|boss_|player_|items_|obst_)/, '').replace(/_/g, ' ');
}

function drawGlyph(ctx, name, fw, fh, i, key) {
  const cx = fw / 2, cy = fh / 2, s = Math.min(fw, fh);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, s / 24);
  ctx.strokeStyle = '#120c0a';
  const col = NAME_COL[name] || hashCol(name, 40, 45);
  if (name.startsWith('heart') || name === 'tin_full' || name === 'tin_half') {
    heart(ctx, cx, cy, s * 0.28, col);
    if (name.endsWith('half')) { ctx.fillStyle = '#4a2a2a'; ctx.fillRect(cx, cy - s * 0.4, s * 0.4, s * 0.9); heart(ctx, cx, cy, s * 0.28, 'rgba(0,0,0,0)'); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, cx, fh); ctx.clip(); heart(ctx, cx, cy, s * 0.28, col); ctx.restore(); }
  } else if (name.startsWith('coin')) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, s * 0.26, 0, 7); ctx.fill(); ctx.stroke();
    label(ctx, name === 'coin' ? '1' : '5', cx, cy, s * 0.25, '#120c0a');
  } else if (name === 'key') {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx - s * 0.12, cy, s * 0.13, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillRect(cx - s * 0.02, cy - s * 0.04, s * 0.32, s * 0.08); ctx.strokeRect(cx - s * 0.02, cy - s * 0.04, s * 0.32, s * 0.08);
  } else if (name === 'dynamite' || name === 'dynamite_stick') {
    ctx.fillStyle = col; ctx.fillRect(cx - s * 0.22, cy - s * 0.09, s * 0.44, s * 0.18); ctx.strokeRect(cx - s * 0.22, cy - s * 0.09, s * 0.44, s * 0.18);
    ctx.strokeStyle = '#f0a640'; ctx.beginPath(); ctx.moveTo(cx + s * 0.22, cy); ctx.lineTo(cx + s * 0.32, cy - s * 0.12); ctx.stroke();
  } else if (name.startsWith('chest')) {
    ctx.fillStyle = col; ctx.fillRect(cx - s * 0.3, cy - s * 0.15, s * 0.6, s * 0.34); ctx.strokeRect(cx - s * 0.3, cy - s * 0.15, s * 0.6, s * 0.34);
    ctx.fillStyle = '#120c0a'; ctx.fillRect(cx - s * 0.04, cy - s * 0.05, s * 0.08, s * 0.12);
  } else if (name === 'bullet_full' || name === 'bullet_empty') {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, s * 0.22, 0, 7); ctx.fill(); ctx.stroke();
    if (name === 'bullet_full') { ctx.fillStyle = '#f5ecd0'; ctx.beginPath(); ctx.arc(cx - 3, cy - 3, s * 0.08, 0, 7); ctx.fill(); }
  } else if (name.startsWith('bullet_') || name === 'rock_debris') {
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, s * 0.4);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, s * 0.4, 0, 7); ctx.fill();
    const r = name === 'bullet_crit' ? s * 0.26 : s * 0.19;
    ctx.fillStyle = name === 'bullet_enemy' ? '#ff3a1a' : col;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = name === 'bullet_enemy' ? '#ffd080' : '#fff';
    ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.4, 0, 7); ctx.fill();
  } else if (name.startsWith('door')) {
    // top-wall door frame: 192x128, opening 96 wide centred
    ctx.fillStyle = '#2a1a12'; ctx.fillRect(0, 0, fw, fh);
    const open = name.endsWith('_open');
    ctx.fillStyle = open ? '#0d0806' : name.includes('boss') ? '#6a1a1a' : name.includes('treasure') ? '#b8901f' : '#6b4423';
    ctx.fillRect(48, 0, 96, fh - 30); ctx.strokeRect(48, 0, 96, fh - 30);
    ctx.fillStyle = '#4a3020'; ctx.fillRect(0, fh - 32, 48, 32); ctx.fillRect(144, fh - 32, 48, 32);
    if (!open) label(ctx, name.includes('boss') ? 'BOSS' : name.includes('treasure') ? 'LOCK' : 'X', cx, 40, 14);
  } else if (name === 'block_a' || name === 'block_b') {
    ctx.fillStyle = name === 'block_a' ? '#7a6a58' : '#6a5a4a'; ctx.beginPath(); ctx.roundRect(8, 16, fw - 16, fh - 24, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(18, 24, fw - 44, 12);
  } else if (name === 'breakable' || name === 'breakable_broken') {
    const b = name === 'breakable';
    ctx.fillStyle = '#8a5a2a'; ctx.fillRect(20, b ? 22 : 62, fw - 40, b ? fh - 30 : 26); ctx.strokeRect(20, b ? 22 : 62, fw - 40, b ? fh - 30 : 26);
    if (b) { ctx.beginPath(); ctx.moveTo(20, 46); ctx.lineTo(fw - 20, 46); ctx.moveTo(20, 70); ctx.lineTo(fw - 20, 70); ctx.stroke(); }
  } else if (name === 'pit') {
    ctx.fillStyle = '#050302'; ctx.fillRect(2, 2, fw - 4, fh - 4); ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, fw - 6, fh - 6);
  } else if (name === 'spikes') {
    ctx.fillStyle = '#d9d0b8';
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(18 + k * 28, 30 + j * 26 + 22); ctx.lineTo(32 + k * 28, 30 + j * 26 - 8); ctx.lineTo(46 + k * 28, 30 + j * 26 + 22); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  } else if (name === 'decor_a' || name === 'decor_b') {
    ctx.fillStyle = name === 'decor_a' ? '#e8dcc0' : '#4f7a3a'; ctx.beginPath(); ctx.ellipse(cx, fh - 26, 20, 12, 0, 0, 7); ctx.fill(); ctx.stroke();
  } else if (name === 'pedestal' || name === 'pedestal_shop') {
    ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.ellipse(cx, fh - 30, 46, 20, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a6a58'; ctx.fillRect(cx - 34, fh - 62, 68, 32); ctx.strokeRect(cx - 34, fh - 62, 68, 32);
    ctx.fillStyle = '#8a7a68'; ctx.beginPath(); ctx.ellipse(cx, fh - 62, 40, 14, 0, 0, 7); ctx.fill(); ctx.stroke();
  } else if (name.startsWith('trapdoor')) {
    ctx.fillStyle = name === 'trapdoor_open' ? '#050302' : '#6b4423'; ctx.fillRect(cx - 48, fh - 96, 96, 80); ctx.strokeRect(cx - 48, fh - 96, 96, 80);
    if (name === 'trapdoor_closed') { ctx.beginPath(); ctx.moveTo(cx, fh - 96); ctx.lineTo(cx, fh - 16); ctx.stroke(); }
  } else if (name === 'peddler') {
    ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(cx, fh - 70, 26, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2a20'; ctx.fillRect(cx - 34, fh - 96, 68, 14); ctx.fillRect(cx - 50, fh - 50, 100, 34); ctx.strokeRect(cx - 50, fh - 50, 100, 34);
  } else if (name === 'tombstone_marker') {
    ctx.fillStyle = '#7a7a78'; ctx.beginPath(); ctx.roundRect(cx - 24, fh - 90, 48, 74, [24, 24, 4, 4]); ctx.fill(); ctx.stroke();
  } else if (name.startsWith('blood')) {
    ctx.fillStyle = 'rgba(138,28,28,0.75)';
    for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(cx + Math.cos(k * 2.1 + i) * s * 0.18, cy + Math.sin(k * 1.7 + i) * s * 0.14, s * (0.06 + 0.03 * (k % 3)), 0, 7); ctx.fill(); }
  } else {
    // items and everything else: coloured rounded chip + label
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(s * 0.16, s * 0.16, s * 0.68, s * 0.68, s * 0.14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(s * 0.22, s * 0.22, s * 0.56, s * 0.14);
    const words = name.split('_');
    words.forEach((w, k) => label(ctx, w, cx, cy - (words.length - 1) * 6 + k * 12, Math.max(9, s / 8)));
  }
}

function drawCharacter(ctx, key, fw, fh, i, n) {
  const cat = key.startsWith('player') ? 'player' : key.startsWith('boss') ? 'boss' : 'enemy';
  const base = key.replace(/_(idle|atk|walk_down|walk_up|walk_side|fire|roll|death)$/, '');
  const col = cat === 'player' ? '#a02c24' : hashCol(base, 40, cat === 'boss' ? 32 : 42);
  const bob = Math.sin((i / Math.max(1, n)) * Math.PI * 2) * fh * 0.02;
  const cx = fw / 2;
  ctx.lineWidth = Math.max(3, fw / 40);
  ctx.strokeStyle = '#120c0a';
  ctx.lineJoin = 'round';
  const isAir = /buzzard|bat|crow|ghost/.test(key);
  if (key.includes('roll')) {
    ctx.save(); ctx.translate(cx, fh / 2); ctx.rotate((i / n) * Math.PI * 2);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, fw * 0.28, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2a20'; ctx.fillRect(-fw * 0.3, -fw * 0.05, fw * 0.6, fw * 0.1); ctx.restore(); return;
  }
  if (key.includes('death')) {
    const t = i / (n - 1);
    ctx.save(); ctx.translate(cx, fh - 18); ctx.rotate(t * 1.4 * (Math.PI / 2) * 0.9);
    ctx.fillStyle = col; ctx.fillRect(-fw * 0.18, -fh * 0.5, fw * 0.36, fh * 0.45); ctx.strokeRect(-fw * 0.18, -fh * 0.5, fw * 0.36, fh * 0.45);
    ctx.fillStyle = '#c9b8a0'; ctx.beginPath(); ctx.arc(0, -fh * 0.6, fw * 0.16, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); return;
  }
  const bodyW = fw * (cat === 'boss' ? 0.55 : 0.42), bodyH = fh * (cat === 'boss' ? 0.5 : 0.4);
  const y0 = fh - 10 + (isAir ? -fh * 0.25 : 0) + bob;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.roundRect(cx - bodyW / 2, y0 - bodyH, bodyW, bodyH, bodyW * 0.3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = cat === 'player' ? '#cdbfae' : hashCol(base + 'h', 30, 62);
  const hr = fw * (cat === 'boss' ? 0.2 : 0.17);
  ctx.beginPath(); ctx.arc(cx, y0 - bodyH - hr * 0.5, hr, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#120c0a';
  ctx.fillRect(cx - hr * 0.6, y0 - bodyH - hr * 0.7, hr * 0.35, hr * 0.35); ctx.fillRect(cx + hr * 0.25, y0 - bodyH - hr * 0.7, hr * 0.35, hr * 0.35);
  if (cat === 'player') { ctx.fillStyle = '#3a2a20'; ctx.fillRect(cx - hr * 1.5, y0 - bodyH - hr * 1.5, hr * 3, hr * 0.5); }
  // legs / wing flap
  ctx.strokeStyle = '#120c0a';
  const sw = Math.sin((i / Math.max(1, n)) * Math.PI * 2) * fw * 0.08;
  ctx.beginPath(); ctx.moveTo(cx - bodyW * 0.2, y0); ctx.lineTo(cx - bodyW * 0.2 + sw, y0 + 8); ctx.moveTo(cx + bodyW * 0.2, y0); ctx.lineTo(cx + bodyW * 0.2 - sw, y0 + 8); ctx.stroke();
  if (cat === 'enemy' && n === 6 && i >= 4) { ctx.strokeStyle = i === 4 ? '#f0a640' : '#d63a2a'; ctx.lineWidth = 5; ctx.strokeRect(cx - bodyW / 2 - 6, y0 - bodyH - hr * 1.6, bodyW + 12, bodyH + hr * 2 + 10); }
  const lbl = shortName(key);
  label(ctx, cat === 'enemy' && n === 6 ? `${lbl} ${i}` : lbl, cx, y0 - bodyH * 0.45, Math.max(9, Math.min(13, fw / 11)));
}

function drawFx(ctx, key, fw, fh, i, n) {
  const t = (i + 0.5) / n, cx = fw / 2, cy = fh / 2, s = Math.min(fw, fh);
  const rg = (r, c0, c1) => { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); };
  if (key === 'fx_explosion') rg(s * (0.15 + 0.35 * t), `rgba(255,${230 - 150 * t | 0},60,${1 - t * 0.6})`, `rgba(200,60,20,${0.8 - t * 0.7})`);
  else if (key === 'fx_muzzle') { ctx.fillStyle = `rgba(255,220,120,${1 - t * 0.7})`; ctx.beginPath(); ctx.moveTo(4, cy); ctx.lineTo(s * (0.5 + 0.2 * (1 - t)), cy - s * 0.14); ctx.lineTo(s * (0.6 + 0.25 * (1 - t)), cy); ctx.lineTo(s * (0.5 + 0.2 * (1 - t)), cy + s * 0.14); ctx.fill(); }
  else if (key === 'fx_impact') rg(s * (0.1 + 0.3 * t), `rgba(255,240,200,${1 - t * 0.7})`, 'rgba(255,200,120,0)');
  else if (key === 'fx_death_puff') rg(s * (0.15 + 0.32 * t), `rgba(190,170,140,${0.9 - t * 0.7})`, 'rgba(120,100,80,0)');
  else if (key === 'fx_dust') rg(s * (0.12 + 0.3 * t), `rgba(200,170,120,${0.7 - t * 0.6})`, 'rgba(160,130,90,0)');
  else if (key === 'fx_spawn') { ctx.strokeStyle = `rgba(214,58,42,${0.9 - t * 0.5})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, s * (0.4 - 0.25 * t), 0, 7); ctx.stroke(); rg(s * 0.3, `rgba(214,58,42,${0.15 + t * 0.35})`, 'rgba(214,58,42,0)'); }
  else if (key === 'dynamite_placed') {
    ctx.fillStyle = '#c0392b'; ctx.fillRect(cx - 14, fh - 40, 28, 30); ctx.strokeStyle = '#120c0a'; ctx.lineWidth = 3; ctx.strokeRect(cx - 14, fh - 40, 28, 30);
    ctx.fillStyle = i % 2 ? '#ffd060' : '#ff8030'; ctx.beginPath(); ctx.arc(cx + 4, fh - 46 - i * 2, 6, 0, 7); ctx.fill();
  } else rg(s * 0.3, 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)');
}

function drawImagePlaceholder(scene, key, w, h) {
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  if (key.startsWith('bg_')) {
    const m = key.match(/bg_f(\d)_?(\w+)?/);
    const f = m ? +m[1] : key === 'bg_shop' ? 1 : 0;
    const boss = key.endsWith('boss');
    const floorCol = key === 'bg_shop' ? '#6a4a30' : key === 'bg_treasure' ? '#5a4a30' : f === 1 ? '#a8783a' : f === 2 ? '#5c4a3c' : '#231a16';
    const wallCol = key === 'bg_shop' ? '#3a2418' : key === 'bg_treasure' ? '#4a3a1a' : f === 1 ? '#6a4020' : f === 2 ? '#3a2c26' : '#120c0a';
    ctx.fillStyle = wallCol; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = floorCol; ctx.fillRect(96, 96, w - 192, h - 192);
    // plank/grain lines
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 900; k++) { ctx.fillStyle = `rgba(0,0,0,${0.04 + rnd() * 0.06})`; ctx.fillRect(96 + rnd() * (w - 192), 96 + rnd() * (h - 192), 4 + rnd() * 18, 2); }
    for (let k = 0; k < 500; k++) { ctx.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.04})`; ctx.fillRect(96 + rnd() * (w - 192), 96 + rnd() * (h - 192), 3, 3); }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 6; ctx.strokeRect(96, 96, w - 192, h - 192);
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, boss ? 'rgba(60,0,0,0.6)' : 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    for (let x = 96 + 96; x < w - 96; x += 96) { ctx.beginPath(); ctx.moveTo(x, 96); ctx.lineTo(x, h - 96); ctx.stroke(); }
    for (let y = 96 + 96; y < h - 96; y += 96) { ctx.beginPath(); ctx.moveTo(96, y); ctx.lineTo(w - 96, y); ctx.stroke(); }
  } else if (key === 'title_bg') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a0a0a'); g.addColorStop(0.55, '#8a2a1a'); g.addColorStop(0.7, '#d9803a'); g.addColorStop(0.7, '#1a0e0a'); g.addColorStop(1, '#0d0806');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#120c0a';
    for (let k = 0; k < 9; k++) { const bx = 700 + k * 80, bh = 80 + ((k * 53) % 90); ctx.fillRect(bx, h * 0.7 - bh, 60, bh); }
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  } else if (key === 'ui_parchment') {
    ctx.fillStyle = '#d9c39a'; ctx.beginPath(); ctx.roundRect(12, 12, w - 24, h - 24, 28); ctx.fill();
    ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 14; ctx.stroke();
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.6); g.addColorStop(0, 'rgba(255,240,200,0.25)'); g.addColorStop(1, 'rgba(90,50,20,0.4)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(12, 12, w - 24, h - 24, 28); ctx.fill();
  } else if (key === 'ui_cursor') {
    ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(32, 32, 16, 0, 7); ctx.moveTo(32, 4); ctx.lineTo(32, 20); ctx.moveTo(32, 44); ctx.lineTo(32, 60); ctx.moveTo(4, 32); ctx.lineTo(20, 32); ctx.moveTo(44, 32); ctx.lineTo(60, 32); ctx.stroke();
  } else if (/^ui_.*_bg$|^img_/.test(key)) { // full-screen menu / card art: a dark dusk gradient with a vignette
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a0c0a'); g.addColorStop(1, '#3a1a12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  } else if (key.startsWith('portrait_')) {
    ctx.fillStyle = hashCol(key, 40, 35); ctx.beginPath(); ctx.arc(w / 2, h * 0.42, w * 0.26, 0, 7); ctx.fill();
    ctx.fillRect(w * 0.22, h * 0.6, w * 0.56, h * 0.4);
    ctx.fillStyle = '#120c0a'; ctx.fillRect(w * 0.38, h * 0.36, w * 0.06, w * 0.06); ctx.fillRect(w * 0.56, h * 0.36, w * 0.06, w * 0.06);
  } else {
    ctx.fillStyle = hashCol(key); ctx.fillRect(0, 0, w, h);
    label(ctx, key, w / 2, h / 2, 14);
  }
  tex.refresh();
  return tex;
}

// ---------------------------------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------------------------------
export const Assets = {
  manifest: { sprites: {}, images: {}, audio: {} },
  real: new Set(),
  placeholders: new Set(),
  realAudio: new Set(),
  loaded: false,

  async fetchManifest() {
    try {
      const res = await fetch(`assets/manifest.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const m = await res.json();
      this.manifest = { sprites: m.sprites || {}, images: m.images || {}, audio: m.audio || {} };
      if (m.version) STAT.stamp = m.version; // content hash from build_manifest.py -> assets stay HTTP-cached across visits until they change
      // Debug: ?noassets=1 -> placeholders only; ?dropassets=50 -> randomly drop ~50% of manifest entries (tests the missing-asset paths)
      const q = new URLSearchParams(location.search);
      if (q.get('noassets')) this.manifest = { sprites: {}, images: {}, audio: {} };
      else if (q.get('dropassets')) {
        const pct = Math.max(0, Math.min(100, +q.get('dropassets') || 50));
        for (const sec of ['sprites', 'images', 'audio']) for (const k of Object.keys(this.manifest[sec])) { let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0; if (h % 100 < pct) delete this.manifest[sec][k]; }
      }
    } catch (e) {
      console.warn('[Assets] manifest unavailable, using placeholders only', e.message || e);
      this.manifest = { sprites: {}, images: {}, audio: {} };
    }
    return this.manifest;
  },

  _url(file, dir) {
    if (/^https?:/.test(file)) return file;
    let f = file.replace(/^\/+/, '');
    if (f.startsWith('assets/')) f = f.slice(7);
    if (!/^(sprites|images|audio)\//.test(f)) f = `${dir}/${f}`;
    return `assets/${f}?v=${STAT.stamp}`;
  },

  /** Queue everything from the manifest onto a scene loader. */
  queue(scene) {
    const L = scene.load;
    const m = this.manifest;
    for (const [key, d] of Object.entries(m.sprites)) {
      const spec = SPEC[key] || {};
      const fw = d.frameWidth || spec.fw, fh = d.frameHeight || spec.fh;
      if (!d.file || !fw || !fh) continue;
      L.spritesheet(key, this._url(d.file, 'sprites'), { frameWidth: fw, frameHeight: fh });
    }
    for (const [key, d] of Object.entries(m.images)) {
      if (!d.file) continue;
      L.image(key, this._url(d.file, 'images'));
    }
    for (const [key, d] of Object.entries(m.audio)) {
      if (!d.file || isLazyAudio(key, d)) continue; // music + ambience stream in on demand (AudioLoader)
      L.audio(key, this._url(d.file, 'audio'));
    }
    L.on('loaderror', (file) => { STAT.failed.add(file.key); console.warn('[Assets] failed to load', file.key, file.url); });
  },

  /** Call after the loader completes. */
  finish(scene) {
    this.real.clear();
    this.realAudio.clear();
    for (const key of [...Object.keys(this.manifest.sprites), ...Object.keys(this.manifest.images)]) {
      if (!STAT.failed.has(key) && scene.textures.exists(key)) this.real.add(key);
    }
    for (const key of Object.keys(this.manifest.audio)) {
      if (!STAT.failed.has(key) && scene.cache.audio.exists(key)) this.realAudio.add(key);
    }
    this.loaded = true;
    this.makeGenerated(scene);
    console.info(`[Assets] real: ${this.real.size} textures, ${this.realAudio.size} sounds`);
  },

  has(key) { return this.real.has(key); },
  hasAudio(key) { return this.realAudio.has(key); },
  audioMeta(key) { return this.manifest.audio[key] || {}; },

  spec(key) {
    const m = this.manifest.sprites[key];
    const s = SPEC[key];
    if (!m && !s) return null;
    const fw = (m && m.frameWidth) || (s && s.fw);
    const fh = (m && m.frameHeight) || (s && s.fh);
    const names = (m && m.names && m.names.length ? m.names : s && s.names) || [];
    return {
      fw, fh,
      n: (m && m.frames) || (s && s.n) || 1,
      cols: (s && s.cols) || (m && m.frames) || 1,
      anchor: (m && m.anchor) || (s && s.a) || 'bottom',
      names,
    };
  },
  anchor(key) { const s = this.spec(key); return s ? s.anchor : 'center'; },
  names(key) { const s = this.spec(key); return s ? s.names : []; },
  frameSize(key) { const s = this.spec(key); return s ? { w: s.fw, h: s.fh } : { w: 64, h: 64 }; },
  /** Frame index for a named cell of a grid atlas (0 if unknown). */
  frame(sheet, name) {
    const i = this.names(sheet).indexOf(name);
    return i < 0 ? 0 : i;
  },
  frameCount(scene, key) {
    if (scene.textures.exists(key)) {
      const t = scene.textures.get(key);
      const n = t.getFrameNames().filter((f) => f !== '__BASE').length;
      return Math.max(1, n);
    }
    const s = this.spec(key);
    return s ? s.n : 1;
  },

  /** Makes sure a texture exists for `key` (real or placeholder) and returns the key. */
  tex(scene, key) {
    if (scene.textures.exists(key)) return key;
    const s = SPEC[key];
    if (s) {
      const rows = Math.ceil(s.n / s.cols);
      const tex = scene.textures.createCanvas(key, s.fw * s.cols, s.fh * rows);
      const ctx = tex.getContext();
      for (let i = 0; i < s.n; i++) {
        const x = (i % s.cols) * s.fw, y = Math.floor(i / s.cols) * s.fh;
        ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, s.fw, s.fh); ctx.clip();
        const name = s.names ? s.names[i] : null;
        if (/^(player|enemy|boss)_/.test(key)) drawCharacter(ctx, key, s.fw, s.fh, i, s.n);
        else if (/^fx_(?!blood)|^dynamite_placed/.test(key)) drawFx(ctx, key, s.fw, s.fh, i, s.n);
        else drawGlyph(ctx, name || key, s.fw, s.fh, i, key);
        ctx.restore();
        tex.add(i, 0, x, y, s.fw, s.fh);
      }
      tex.refresh();
      this.placeholders.add(key);
      return key;
    }
    const is = IMAGE_SPEC[key];
    drawImagePlaceholder(scene, key, is ? is[0] : 128, is ? is[1] : 128);
    this.placeholders.add(key);
    return key;
  },

  /** Sprite with correct origin for the asset's anchor. Real art if loaded, placeholder otherwise. */
  makeSprite(scene, x, y, key, frame = 0) {
    this.tex(scene, key);
    const s = scene.add.sprite(x, y, key, typeof frame === 'string' && this.names(key).includes(frame) ? this.frame(key, frame) : frame);
    s.setOrigin(0.5, this.anchor(key) === 'bottom' ? 1 : 0.5);
    return s;
  },
  /** Image from a grid atlas by cell name, e.g. makeCell(scene,x,y,'pickups','coin'). */
  makeCell(scene, x, y, sheet, name, originY) {
    this.tex(scene, sheet);
    const im = scene.add.image(x, y, sheet, this.frame(sheet, name));
    im.setOrigin(0.5, originY ?? (this.anchor(sheet) === 'bottom' ? 1 : 0.5));
    return im;
  },
  makeImage(scene, x, y, key) {
    this.tex(scene, key);
    return scene.add.image(x, y, key);
  },

  /**
   * Register (once) an animation over frames [start..end] of texture `key`; returns the anim key.
   * opts: {start=0, end=last, fps=10, repeat=-1, name='', frames:[...]}
   */
  ensureAnim(scene, key, opts = {}) {
    // fast path (called every frame by Player/Fx): a named anim that already exists needs no frame lookups/allocations
    if (opts.name) { const k = `${key}:${opts.name}`; if (scene.anims.exists(k)) return k; }
    this.tex(scene, key);
    const n = this.frameCount(scene, key);
    const start = Math.min(opts.start ?? 0, n - 1);
    const end = Math.min(opts.end ?? n - 1, n - 1);
    const fps = opts.fps ?? 10;
    const repeat = opts.repeat ?? -1;
    const animKey = `${key}:${opts.name || `${start}-${end}`}`;
    if (!scene.anims.exists(animKey)) {
      const frames = (opts.frames || Array.from({ length: end - start + 1 }, (_, i) => start + i)).map((f) => ({ key, frame: f }));
      scene.anims.create({ key: animKey, frames, frameRate: fps, repeat });
    }
    return animKey;
  },

  /** Shared procedural textures used across the game (all cheap, generated once). */
  makeGenerated(scene) {
    const T = scene.textures;
    const mk = (key, w, h, fn) => {
      if (T.exists(key)) return;
      const t = T.createCanvas(key, w, h);
      fn(t.getContext(), w, h);
      t.refresh();
    };
    mk('px', 4, 4, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 4, 4); });
    mk('shadow', 128, 64, (c, w, h) => {
      c.save(); c.translate(w / 2, h / 2); c.scale(1, 0.5);
      const g = c.createRadialGradient(0, 0, 2, 0, 0, w / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.6, 'rgba(0,0,0,0.32)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(-w / 2, -h, w, h * 2); c.restore();
    });
    mk('glow', 128, 128, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
    mk('vignette', 512, 512, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, w * 0.28, w / 2, h / 2, w * 0.72);
      g.addColorStop(0, 'rgba(180,10,10,0)'); g.addColorStop(1, 'rgba(180,10,10,0.95)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
    mk('ring', 128, 128, (c, w) => { c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 6, 0, 7); c.stroke(); });
    mk('disc', 128, 128, (c, w) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 1, 0, 7); c.fill(); });
    mk('hat', 64, 40, (c) => {
      c.fillStyle = '#5a3a1a'; c.strokeStyle = '#120c0a'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(32, 26, 28, 9, 0, 0, 7); c.fill(); c.stroke();
      c.beginPath(); c.roundRect(16, 6, 32, 20, 8); c.fill(); c.stroke();
    });
    mk('casing', 8, 4, (c) => { c.fillStyle = '#d9b071'; c.fillRect(0, 0, 8, 4); });
    mk('panel', 64, 64, (c, w, h) => { c.fillStyle = '#fff'; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 12); c.fill(); });
    mk('warn_line', 8, 8, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 8, 8); });
  },
};

export const floorInfo = (n) => FLOORS[n] || FLOORS[1];
export default Assets;
