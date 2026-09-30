// Shared helpers for hazards and room modifiers (FN-2): environment writes, damage wrappers, tile geometry, code-drawn textures.
// Everything here is allocation-free per frame except where noted.
import { ROOM, TILE, COLS, ROWS, DEPTH } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { bus } from '../../core/events.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;

/** Tile column / row containing a world point (may be out of range). */
export const colOf = (x) => Math.floor((x - ROOM.x) / TILE);
export const rowOf = (y) => Math.floor((y - ROOM.y) / TILE);
export const tileX = (c) => ROOM.x + c * TILE + TILE / 2;
export const tileY = (r) => ROOM.y + r * TILE + TILE / 2;
export const inGrid = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;

/** Circle (x,y,rad) overlaps the tile rect (c,r)? */
export function circleHitsTile(x, y, rad, c, r) {
  const rx = ROOM.x + c * TILE, ry = ROOM.y + r * TILE;
  const qx = x < rx ? rx : x > rx + TILE ? rx + TILE : x;
  const qy = y < ry ? ry : y > ry + TILE ? ry + TILE : y;
  const dx = x - qx, dy = y - qy;
  return dx * dx + dy * dy < rad * rad;
}

/** Depth used by warn overlays: above the LightMask in darkness rooms (fairness), under actors otherwise. */
export const warnDepth = (room) => (room && room.darkMask ? DEPTH.bullets + 2 : DEPTH.decals + 6);

// ------------------------------------------------------------------------------------------------ player environment
/**
 * Player environment record {speedMult, rollMult, push:{x,y}} (FN-4's Player consumes it, then resets it). Hazards and modifiers write it
 * during Room.update (after Player.update). The first caller each frame zeroes it (frame stamp) so nothing can accumulate or go stale.
 */
export function envOf(scene) {
  const p = scene.player;
  if (!p) return null;
  let e = p.env;
  if (!e) e = p.env = { speedMult: 1, rollMult: 1, push: { x: 0, y: 0 }, _shim: true }; // no env seam in Player yet: applyEnvShim applies it
  const f = scene.time.now; // scene clock: advances once per scene update (also under manual game.step)
  if (e._hzStamp !== f) { e._hzStamp = f; e.speedMult = 1; e.rollMult = 1; e.push.x = 0; e.push.y = 0; }
  return e;
}
/**
 * Stand-in until Player consumes `player.env` itself (FN-4 seam): applies push / speed / roll multipliers as extra displacement. A Player that defines
 * `env` in its constructor is never shimmed (the record has no `_shim` flag), so nothing is applied twice.
 */
export function applyEnvShim(scene, dt) {
  const p = scene.player, e = p && p.env;
  if (!e || !e._shim || p.dead || p.locked || dt <= 0) return;
  if (e.push.x || e.push.y) p.moveBy(e.push.x * dt, e.push.y * dt);
  const m = p.rolling ? e.rollMult : e.speedMult;
  if (m < 1) p.moveBy(-(1 - m) * p.vx * dt, -(1 - m) * p.vy * dt);
}
/** Neutral environment (room exit, dispose). */
export function resetEnv(scene) {
  const p = scene.player, e = p && p.env;
  if (e) { e.speedMult = 1; e.rollMult = 1; e.push.x = 0; e.push.y = 0; e._hzStamp = -1; }
}

// ------------------------------------------------------------------------------------------------ damage wrappers
/** Hurt the player with a hazard damage kind (string, see CHAPTER2 s2). Returns true when damage landed. */
export function hurtPlayer(scene, units, x, y, kind, extra) {
  const p = scene.player;
  if (!p || p.dead || !p.canBeHit()) return false;
  const src = { x, y, kind, hazard: kind };
  if (extra) Object.assign(src, extra);
  const ok = p.damage(units, src);
  if (ok) bus.emit('hazard:hurt', { type: kind });
  return ok;
}

/** True for enemies that shrug off fire / lava / vents (tag `fire`, elite affix `burning`, ghosts). */
export function fireproof(e) {
  if (e.id === 'ghost') return true;
  const t = e.tags;
  if (t && t.indexOf('fire') >= 0) return true;
  const a = e.affixes;
  return !!(a && a.indexOf('burning') >= 0);
}
/** Slow a walker without allocating (quicksand). Keeps the status alive for `t` s. */
export function slowEnemy(e, mult, t = 0.12) {
  const s = e.status && e.status.slow;
  if (s) { if (s.t < t) s.t = t; if (s.mult > mult) s.mult = mult; } else e.applyStatus('slow', { mult, t });
}
/** Ground walkers a hazard may hurt: alive, not flying, not a ghost, not a boss. */
export const groundFoe = (e) => e.alive && !e.flying && !e.ghost && !e.isBoss;

// ------------------------------------------------------------------------------------------------ code-drawn textures
/** Create a canvas texture once. draw(ctx, w, h). */
export function ensureTex(scene, key, w, h, draw) {
  const T = scene.textures;
  if (T.exists(key)) return key;
  const t = T.createCanvas(key, w, h);
  draw(t.getContext(), w, h);
  t.refresh();
  return key;
}

/** Real art available for this sheet + cell name? (Art keys may be missing or a sheet may lack the cell: then everything is code-drawn.) */
export const hasCell = (sheet, name) => Assets.has(sheet) && Assets.names(sheet).indexOf(name) >= 0;

/** Soft radial gradient with a fully opaque core (erased from the LightMask). ratio = inner radius / outer radius. */
export function lightTexKey(scene, ratio) {
  const q = Math.round(clamp(ratio, 0, 0.9) * 10);
  const key = `hz_light_${q}`;
  ensureTex(scene, key, 256, 256, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    const inner = q / 10;
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(inner, 'rgba(255,255,255,1)');
    const steps = 8;
    for (let i = 1; i <= steps; i++) { // smoothstep falloff
      const u = i / steps, a = 1 - u * u * (3 - 2 * u);
      g.addColorStop(inner + (1 - inner) * u, `rgba(255,255,255,${a.toFixed(3)})`);
    }
    c.fillStyle = g; c.fillRect(0, 0, w, w);
  });
  return key;
}

/** Textures shared by the code-drawn fallbacks; safe to call repeatedly. */
export function ensureHazTextures(scene) {
  ensureTex(scene, 'hz_tongue', 48, 96, (c, w, h) => { // flame tongue (white core -> tinted by code)
    const g = c.createRadialGradient(w / 2, h * 0.72, 2, w / 2, h * 0.62, h * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.65)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(w / 2, 2); c.bezierCurveTo(w * 0.95, h * 0.4, w * 0.9, h * 0.92, w / 2, h - 2); c.bezierCurveTo(w * 0.1, h * 0.92, w * 0.05, h * 0.4, w / 2, 2); c.fill();
  });
  ensureTex(scene, 'hz_rock', 96, 96, (c) => {
    c.fillStyle = '#6a5a4c'; c.strokeStyle = '#120c0a'; c.lineWidth = 4; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(18, 60); c.lineTo(30, 24); c.lineTo(58, 14); c.lineTo(82, 40); c.lineTo(74, 78); c.lineTo(38, 84); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#8a7a68'; c.beginPath(); c.moveTo(32, 30); c.lineTo(56, 22); c.lineTo(70, 40); c.lineTo(46, 44); c.closePath(); c.fill();
  });
}

/** Make the rock sprite for falling-rock hazards (real cell if present). */
export function makeRock(scene) {
  ensureHazTextures(scene);
  if (hasCell('props_small', 'rock_chunk')) return Assets.makeCell(scene, 0, 0, 'props_small', 'rock_chunk', 0.5);
  return scene.add.image(0, 0, 'hz_rock');
}
