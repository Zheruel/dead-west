// QA-3 visual helpers (test only): boot game, jump helpers, screenshots to art/qa/v2/.
import { launch } from './harness.mjs';
export async function boot(query = '?debug=1&seed=7&unlockall=1', opts = {}) {
  const g = await launch({ query, name: 'qa3v', quiet: true, ...opts });
  g.S = async (n, clip) => { const f = `art/qa/v2/${n}.png`; await g.page.screenshot({ path: f, ...(clip ? { clip } : {}) }); console.log('shot', f); return f; };
  g.play = async (char = 'gunslinger', mode = 'normal', extra = {}) => {
    await g.eval((c, m, e) => window.__game.scene.getScene('Menu').go('Game', { char: c, mode: m, ...e }), char, mode, extra);
    await g.page.waitForFunction(() => window.__game.scene.isActive('Game') && window.__dw && window.__dw.player, { timeout: 60000 });
    await g.wait(1200); await g.settle();
  };
  g.settle = async () => { await g.page.waitForFunction(() => { const s = window.__dw && window.__dw.scene; return s && !s.cutscene && !s.transitioning; }, { timeout: 30000 }).catch(() => {}); await g.wait(400); };
  g.api = (fn, ...a) => g.eval(fn, ...a);
  g.go = async (scene, data) => { await g.eval((s, d) => { const gm = window.__game; for (const x of gm.scene.getScenes(true)) gm.scene.stop(x.sys.settings.key); gm.scene.start(s, d); }, scene, data); await g.wait(1600); };
  return g;
}

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
/** Sequence of full-frame shots -> contact sheet art/qa/v2/<name>.png (cols x, cell w). */
export async function seq(g, name, n, dt, { cols = 3, w = 720, pre } = {}) {
  const files = [];
  for (let i = 0; i < n; i++) {
    if (pre) await pre(i);
    const f = `art/qa/v2/tmp_${name}_${i}.png`;
    await g.page.screenshot({ path: f });
    files.push(f);
    await g.wait(dt);
  }
  sheet(name, files, cols, w);
  return files.length;
}
export function sheet(name, files, cols = 3, w = 720) {
  const h = Math.round(w * 960 / 1440);
  execFileSync('tools/qa/qa3v-sheet.sh', [`art/qa/v2/${name}.png`, String(cols), String(w), String(h), ...files]);
  for (const f of files) try { fs.unlinkSync(f); } catch {}
}
/** Crops around the first enemy matching sel() -> strip. */
export async function track(g, name, n, dt, size = 260, sel = 'window.__dw.scene.enemies[0]') {
  const files = [], log = [];
  for (let i = 0; i < n; i++) {
    await g.wait(dt);
    const st = await g.eval(new Function(`const e=${sel}; if(!e) return null; return {x:e.x,y:e.y,s:e.state,fr:e.sprite&&e.sprite.frame?e.sprite.frame.name:null};`));
    if (!st) { log.push('gone'); break; }
    log.push(`${st.s}/${st.fr}`);
    const x = Math.max(0, Math.min(1440 - size, Math.round(st.x - size / 2))), y = Math.max(0, Math.min(960 - size, Math.round(st.y - size * 0.62)));
    const f = `art/qa/v2/tmp_${name}_${i}.png`;
    await g.page.screenshot({ path: f, clip: { x, y, width: size, height: size } });
    files.push(f);
  }
  if (files.length) {
    const rows = [];
    for (let i = 0; i < files.length; i += 6) { const r = `art/qa/v2/tmp_${name}_row${i}.png`; execFileSync('magick', [...files.slice(i, i + 6), '+append', r]); rows.push(r); }
    execFileSync('magick', [...rows, '-append', `art/qa/v2/${name}.png`]);
    for (const f of [...files, ...rows]) try { fs.unlinkSync(f); } catch {}
  }
  return log;
}
