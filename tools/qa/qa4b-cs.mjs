// QA-4b: verify 'cutscene scene still active after onDone' flags (intro, end_a). Measures time between onDone and Cutscene scene stop, in the browser at real speed.
import { open, sleep } from './qa4-lib.mjs';
const g = await open('?debug=1&seed=42&char=gunslinger', { name: 'qa4b-cs' });
await g.startRun();
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['intro', 'end_a', 'saloon_arrival'];
for (const id of ids) {
  await g.eval((id) => { const s = window.__dw.scene; s.run.mode = 'normal'; window.__cs = { done: null, stopped: null, act: [] }; const t0 = performance.now();
    import('/src/scenes/flow.js').then((f) => f.playCutscene(s, id, f.cutsceneCtx(s), () => { window.__cs.done = performance.now(); window.__cs.paused = s.paused; window.__cs.cut = s.cutscene; window.__cs.fader = window.__game.__cutscene && window.__game.__cutscene.fader ? window.__game.__cutscene.fader.alpha : null; }));
    const iv = setInterval(() => { const act = window.__game.scene.isActive('Cutscene'); if (window.__cs.done && !act && !window.__cs.stopped) { window.__cs.stopped = performance.now(); clearInterval(iv); } }, 5); }, id);
  await sleep(1500); await g.tap('Escape'); // first Esc: hold-skip or (seen) skip
  for (let i = 0; i < 40; i++) { const st = await g.eval(() => window.__cs.done); if (st) break; await g.press('Escape'); await sleep(750); await g.release('Escape'); await g.tap('Enter', 40); await sleep(300); }
  await sleep(2500);
  const r = await g.eval(() => ({ ...window.__cs, gap: window.__cs.stopped && window.__cs.done ? Math.round(window.__cs.stopped - window.__cs.done) : null, active: window.__game.scene.isActive('Cutscene'), gamePaused: window.__dw.scene.paused, gameCut: window.__dw.scene.cutscene }));
  console.log(id, JSON.stringify(r));
}
console.log('errors', g.errors.filter((e) => !/favicon/.test(e)));
await g.close();
