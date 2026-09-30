// Code-drawn floor tiles (placeholders when the real `haz_f4` / `haz_f5` / `obst_hazards` cells are missing, and always for roulette).
// Each texture is a 96x96 canvas created once per game (textures.exists check), so entering rooms never leaks or redraws.
import { TILE } from '../../config.js';
import { ensureTex, hasCell } from './common.js';
import { Assets } from '../../core/Assets.js';

const S = TILE;

/** Tiny deterministic pseudo-random for stable drawings (not gameplay). */
function lcg(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

function ink(c, w = 4) { c.strokeStyle = '#120c0a'; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; }

export const TEX = {
  lava(scene, i) {
    return ensureTex(scene, `hz_lava_${i}`, S, S, (c) => {
      c.fillStyle = '#2a0f0c'; c.fillRect(0, 0, S, S);
      const r = lcg(77); // same blobs every frame, phase shifted so the flow loops
      for (let n = 0; n < 9; n++) {
        const bx = r() * S, by = r() * S, br = 14 + r() * 16, ph = i / 3 * Math.PI * 2 + n;
        const ox = Math.cos(ph) * 6, oy = Math.sin(ph) * 6;
        for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
          const x = bx + ox + dx, y = by + oy + dy;
          if (x < -40 || y < -40 || x > S + 40 || y > S + 40) continue;
          const g = c.createRadialGradient(x, y, 1, x, y, br);
          g.addColorStop(0, 'rgba(255,208,96,0.95)'); g.addColorStop(0.45, 'rgba(255,122,31,0.85)'); g.addColorStop(1, 'rgba(120,30,10,0)');
          c.fillStyle = g; c.fillRect(x - br, y - br, br * 2, br * 2);
        }
      }
      c.strokeStyle = 'rgba(40,10,6,0.75)'; c.lineWidth = 3; c.lineCap = 'round';
      for (let n = 0; n < 7; n++) { // dark crust cracks
        const x = r() * S, y = r() * S, a = r() * 6.28;
        for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { c.beginPath(); c.moveTo(x + dx, y + dy); c.lineTo(x + dx + Math.cos(a) * 26, y + dy + Math.sin(a) * 26); c.stroke(); }
      }
    });
  },

  /** vent state 0 idle (grey grate), 1 warn (glowing yellow), 2 erupt (open, glowing). */
  vent(scene, st) {
    return ensureTex(scene, `hz_vent_${st}`, S, S, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(S / 2, S / 2, 36, 0, 7); c.fill();
      ink(c, 4);
      const rim = st === 0 ? '#6a6660' : st === 1 ? '#d8c43a' : '#ffa030';
      c.fillStyle = '#1a1210'; c.beginPath(); c.arc(S / 2, S / 2, 32, 0, 7); c.fill(); c.strokeStyle = rim; c.lineWidth = 6; c.stroke();
      if (st) { const g = c.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, 30); g.addColorStop(0, st === 1 ? 'rgba(255,240,120,0.9)' : 'rgba(255,220,120,1)'); g.addColorStop(1, st === 1 ? 'rgba(216,196,58,0.15)' : 'rgba(255,120,30,0.5)'); c.fillStyle = g; c.beginPath(); c.arc(S / 2, S / 2, 28, 0, 7); c.fill(); }
      c.strokeStyle = st === 0 ? '#3a3632' : '#120c0a'; c.lineWidth = 4;
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(S / 2 + k * 11, S / 2 - 26 + Math.abs(k) * 4); c.lineTo(S / 2 + k * 11, S / 2 + 26 - Math.abs(k) * 4); c.stroke(); }
    });
  },

  rail(scene, dir) {
    return ensureTex(scene, `hz_rail_${dir}`, S, S, (c) => {
      const h = dir === 'h';
      c.save(); if (!h) { c.translate(S, 0); c.rotate(Math.PI / 2); }
      c.fillStyle = '#4a3220'; ink(c, 3); // sleepers
      for (const x of [10, 34, 58, 82]) { c.beginPath(); c.roundRect(x - 7, 14, 14, 68, 2); c.fill(); c.stroke(); }
      for (const y of [30, 66]) { // rails
        c.fillStyle = '#8a4b1f'; c.beginPath(); c.roundRect(0, y - 5, S, 10, 2); c.fill(); c.stroke();
        c.fillStyle = 'rgba(232,220,192,0.35)'; c.fillRect(0, y - 3, S, 2);
      }
      c.restore();
    });
  },

  /** Roulette tile, colour 'r' | 'k': felt diamond with gold trim and a suit glyph. */
  roulette(scene, col) {
    return ensureTex(scene, `hz_roul_${col}`, S, S, (c) => {
      const red = col === 'r';
      c.fillStyle = red ? '#7a1420' : '#17110f'; c.fillRect(2, 2, S - 4, S - 4);
      c.strokeStyle = '#d4a537'; c.lineWidth = 4; c.strokeRect(5, 5, S - 10, S - 10);
      c.strokeStyle = 'rgba(212,165,55,0.45)'; c.lineWidth = 2; c.strokeRect(11, 11, S - 22, S - 22);
      ink(c, 3); c.fillStyle = red ? '#d63a2a' : '#c9c2b0';
      const x = S / 2, y = S / 2;
      c.beginPath();
      if (red) { c.moveTo(x, y + 20); c.bezierCurveTo(x - 30, y - 2, x - 18, y - 24, x, y - 8); c.bezierCurveTo(x + 18, y - 24, x + 30, y - 2, x, y + 20); } // heart
      else { c.moveTo(x, y - 22); c.bezierCurveTo(x + 30, y + 2, x + 20, y + 22, x + 4, y + 14); c.lineTo(x + 10, y + 26); c.lineTo(x - 10, y + 26); c.lineTo(x - 4, y + 14); c.bezierCurveTo(x - 20, y + 22, x - 30, y + 2, x, y - 22); } // spade
      c.fill(); c.stroke();
    });
  },

  quicksand(scene) {
    return ensureTex(scene, 'hz_quicksand', S, S, (c) => {
      c.fillStyle = '#b8955a'; c.fillRect(0, 0, S, S);
      const r = lcg(31);
      c.strokeStyle = 'rgba(90,64,32,0.55)'; c.lineWidth = 3;
      for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(S / 2 + (r() - 0.5) * 8, S / 2 + (r() - 0.5) * 8, 10 + k * 9, r() * 2, r() * 2 + 4.6); c.stroke(); }
      c.fillStyle = 'rgba(232,210,160,0.5)';
      for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(8 + r() * 80, 8 + r() * 80, 2 + r() * 3, 0, 7); c.fill(); }
    });
  },

  /** retractable spikes: 0 down, 1 warn, 2 up. */
  rspikes(scene, st) {
    return ensureTex(scene, `hz_rspike_${st}`, S, S, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(8, 8, S - 16, S - 16);
      ink(c, 3);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const x = 20 + i * 28, y = 22 + j * 26;
        c.fillStyle = '#2a2320'; c.beginPath(); c.arc(x, y + 8, 7, 0, 7); c.fill();
        if (st === 0) continue;
        const up = st === 2 ? 20 : 8; // warn = tips shiver just above the plate
        c.fillStyle = '#c9c2b0'; c.beginPath(); c.moveTo(x - 6, y + 8); c.lineTo(x, y + 8 - up); c.lineTo(x + 6, y + 8); c.closePath(); c.fill(); c.stroke();
      }
    });
  },

  pipe(scene) {
    return ensureTex(scene, 'hz_pipe', S, S, (c) => {
      ink(c, 4);
      c.fillStyle = '#5a5d66'; c.beginPath(); c.roundRect(8, 30, 62, 36, 6); c.fill(); c.stroke();
      c.fillStyle = '#7a7d86'; c.fillRect(12, 34, 54, 6);
      c.fillStyle = '#3a3d44'; c.beginPath(); c.roundRect(64, 24, 22, 48, 5); c.fill(); c.stroke();
      c.fillStyle = '#8a4b1f'; c.beginPath(); c.arc(38, 30, 9, 0, 7); c.fill(); c.stroke(); // valve
      c.strokeStyle = '#d63a2a'; c.lineWidth = 4; c.beginPath(); c.moveTo(38, 21); c.lineTo(38, 39); c.stroke();
    });
  },

  /** Falling chandelier body (top-down-ish ring of candles). */
  chandelier(scene) {
    return ensureTex(scene, 'hz_chandelier', 192, 160, (c) => {
      ink(c, 5);
      c.strokeStyle = '#3a2a10'; c.lineWidth = 6; c.beginPath(); c.moveTo(96, 0); c.lineTo(96, 40); c.stroke();
      c.strokeStyle = '#120c0a'; c.lineWidth = 5;
      c.fillStyle = '#d4a537'; c.beginPath(); c.ellipse(96, 100, 84, 30, 0, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#5a4210'; c.beginPath(); c.ellipse(96, 100, 60, 20, 0, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#d4a537'; c.beginPath(); c.roundRect(82, 34, 28, 44, 8); c.fill(); c.stroke();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2, x = 96 + Math.cos(a) * 66, y = 96 + Math.sin(a) * 22;
        c.fillStyle = '#e8dcc0'; c.beginPath(); c.roundRect(x - 5, y - 20, 10, 22, 3); c.fill(); c.stroke();
        c.fillStyle = '#ffb030'; c.beginPath(); c.ellipse(x, y - 26, 5, 8, 0, 0, 7); c.fill();
      }
    });
  },

  gravestone(scene) {
    return ensureTex(scene, 'hz_gravestone', S, S, (c) => {
      ink(c, 4); c.fillStyle = '#6a6660';
      c.beginPath(); c.moveTo(24, 88); c.lineTo(24, 36); c.quadraticCurveTo(48, 6, 72, 36); c.lineTo(72, 88); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#3a3632'; c.lineWidth = 4; c.beginPath(); c.moveTo(48, 34); c.lineTo(48, 62); c.moveTo(38, 44); c.lineTo(58, 44); c.stroke();
    });
  },

  rubble(scene) {
    return ensureTex(scene, 'hz_rubble', S, S, (c) => {
      ink(c, 3); const r = lcg(9);
      for (let k = 0; k < 9; k++) { c.fillStyle = k % 2 ? '#6a6660' : '#8a8478'; const x = 14 + r() * 68, y = 44 + r() * 40, w = 8 + r() * 14; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + 3); c.lineTo(x + w * 0.7, y + w * 0.7); c.lineTo(x - 3, y + w * 0.6); c.closePath(); c.fill(); c.stroke(); }
    });
  },
};

/**
 * Image for a floor tile: real cell of `sheet` if the art exists, else the code texture `fallback(scene)`.
 * `origin` 0.5 (centred). Returns the image (caller sets position and depth).
 */
export function tileImage(scene, x, y, sheet, cell, fallback) {
  if (cell && hasCell(sheet, cell)) return Assets.makeCell(scene, x, y, sheet, cell, 0.5);
  return scene.add.image(x, y, fallback());
}
