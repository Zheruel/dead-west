// Engine No. 666 art helpers: placeholder specs for the three boss sheets (the static SPEC table has no rows for the chapter-2 bosses yet) and a
// code-drawn side-view locomotive for `boss_engine_run` when that sheet is missing (?noassets=1, ?dropassets=N). Real art always wins.
import { Assets, SPEC } from '../../core/Assets.js';

const strip = (fw, fh, n) => ({ fw, fh, cols: n, n, a: 'bottom' });
if (!SPEC.boss_engine_idle) SPEC.boss_engine_idle = strip(320, 320, 4);
if (!SPEC.boss_engine_atk) SPEC.boss_engine_atk = strip(320, 320, 4);
if (!SPEC.boss_engine_run) SPEC.boss_engine_run = strip(512, 320, 4);

const PH_KEY = 'engine_run_ph';

/** Texture key to use for the side-view charging locomotive (real sheet when loaded, else a 4-frame canvas). */
export function runTexKey(scene) {
  if (Assets.has('boss_engine_run')) return 'boss_engine_run';
  if (scene.textures.exists(PH_KEY)) return PH_KEY;
  const t = scene.textures.createCanvas(PH_KEY, 2048, 320);
  const c = t.getContext();
  c.lineJoin = 'round'; c.strokeStyle = '#120c0a'; c.lineWidth = 5;
  const box = (x, y, w, h, fill, r = 4) => { c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); c.stroke(); };
  const disc = (x, y, r, fill) => { c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke(); };
  for (let i = 0; i < 4; i++) {
    c.save(); c.translate(i * 512, 0); c.beginPath(); c.rect(0, 0, 512, 320); c.clip();
    // two coal cars + tender
    for (const x of [10, 110]) { box(x, 190, 90, 60, '#7a3a26'); box(x + 6, 168, 78, 26, '#241c18', 12); disc(x + 22, 262, 14, '#2a2320'); disc(x + 68, 262, 14, '#2a2320'); }
    box(210, 176, 110, 76, '#6a3428'); box(216, 150, 98, 34, '#241c18', 14);
    // locomotive: boiler, cab, chimney, cowcatcher, headlight
    box(330, 120, 130, 96, '#22262c', 30); box(300, 96, 58, 130, '#8a4b1f'); box(420, 62, 34, 62, '#22262c');
    box(410, 50, 54, 16, '#c9a04a', 6); box(320, 216, 170, 34, '#5a2a1c');
    c.fillStyle = '#c9a04a'; c.beginPath(); c.moveTo(480, 210); c.lineTo(506, 256); c.lineTo(470, 256); c.closePath(); c.fill(); c.stroke();
    disc(468, 158, 14, '#ffe58a');
    for (const x of [352, 412]) {
      disc(x, 262, 30, '#a02c24');
      c.strokeStyle = '#120c0a'; c.lineWidth = 4; c.beginPath();
      for (let k = 0; k < 3; k++) { const a = i * 0.5 + (k * Math.PI) / 3; c.moveTo(x + Math.cos(a) * 26, 262 + Math.sin(a) * 26); c.lineTo(x - Math.cos(a) * 26, 262 - Math.sin(a) * 26); }
      c.stroke(); c.lineWidth = 5;
    }
    c.fillStyle = 'rgba(70,66,64,0.9)';
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(360 - k * 64 - i * 8, 40 + (k % 2) * 12 - i * 3, 22 + k * 5, 0, 7); c.fill(); }
    c.restore();
    t.add(i, 0, i * 512, 0, 512, 320);
  }
  t.refresh();
  Assets.placeholders.add(PH_KEY);
  return PH_KEY;
}
