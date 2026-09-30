// QA-4 leaks: node tools/qa/qa4-leaks.mjs retry|rooms|both [n] [flags]
//  retry: die -> End -> R, n times (default 50). rooms: jump between every room of floors 1-6 + pocket, n hops (default 200).
import { open, PROBE, fmt, sleep } from './qa4-lib.mjs';
const mode = process.argv[2] || 'both', N = +(process.argv[3] || (mode === 'retry' ? 50 : 200)), extra = process.argv[4] || '';
const g = await open(`?debug=1&seed=42&char=gunslinger${extra}`, { name: 'qa4-leaks' });
const EXT = () => {
  const r = window.__game.renderer, gl = r.gl;
  const cnt = (o) => (o ? (Array.isArray(o) ? o.length : o.size != null ? o.size : Object.keys(o).length) : -1);
  const gs = window.__dw && window.__dw.scene;
  let rts = 0, texts = 0, ims = 0, gfx = 0, emit = 0;
  if (gs) for (const c of gs.children.list) { if (c.type === 'RenderTexture') rts++; else if (c.type === 'Text') texts++; else if (c.type === 'Image' || c.type === 'Sprite') ims++; else if (c.type === 'Graphics') gfx++; else if (c.type === 'ParticleEmitter') emit++; }
  const all = window.__game.scene.getScenes(false).map((s) => s.sys.settings.key + ':' + (s.children ? s.children.length : 0) + '/' + (s.tweens ? s.tweens.getTweens().length : 0)).join(' ');
  return { glTex: cnt(r.glTextureWrappers), glFb: cnt(r.glFramebufferWrappers), glBuf: cnt(r.glBufferWrappers), rts, texts, ims, gfx, emit, all, snd: window.__game.sound.sounds ? window.__game.sound.sounds.length : -1, ctxSrc: -1 };
};
const rows = [];
const sample = async (label) => {
  const heap = await g.heap();
  const p = await g.eval(PROBE), e = await g.eval(EXT);
  const row = { label, heap: fmt(heap), heapRaw: heap, busTotal: p.busTotal, gev: p.gev, tex: p.tex, ...e, scenes: Object.fromEntries(Object.entries(p.scenes).map(([k, v]) => [k, `ev${v.ev}/ch${v.ch}/tw${v.tw}/t${v.timers}`])), pool: p.pool && `${p.pool.enemies}e ${p.pool.bulletsP}/${p.pool.freeP}p ${p.pool.bulletsE}/${p.pool.freeE}b` };
  rows.push(row); console.log(JSON.stringify({ ...row, heapRaw: undefined, busCounts: undefined }));
  return { p, row };
};
await g.startRun(); await g.installFF();
const first = await sample('start');
console.log('busCounts@start', JSON.stringify(first.p.busCounts));
let lastBus = first.p.busCounts;
const fail = [];
if (mode === 'retry' || mode === 'both') {
  for (let i = 1; i <= N; i++) {
    await g.eval(() => { const a = window.__dw.api; a.godMode(false); a.die(); });
    const okEnd = await g.page.waitForFunction(() => window.__game.scene.isActive('End'), { timeout: 30000 }).then(() => true).catch(() => false);
    if (!okEnd) { fail.push('retry ' + i + ': End scene never appeared'); break; }
    await g.eval(() => window.__wake && window.__wake()); await sleep(1800);
    await g.tap('KeyR', 80);
    const okG = await g.page.waitForFunction(() => window.__game.scene.isActive('Game') && window.__dw && window.__dw.player && !window.__dw.player.dead, { timeout: 30000 }).then(() => true).catch(() => false);
    if (!okG) { fail.push('retry ' + i + ': Game did not restart'); break; }
    await sleep(700);
    if (i % 10 === 0 || i === N) { const s = await sample('retry' + i); lastBus = s.p.busCounts; }
  }
}
if (mode === 'rooms' || mode === 'both') {
  await g.eval(() => { window.__dw.api.godMode(true); window.__dw.api.give(50); });
  let hop = 0;
  const floors = [1, 2, 3, 4, 5, 6];
  while (hop < N) {
    for (const f of floors) {
      await g.eval((f) => { const a = window.__dw.api; a.godMode(true); a.heal(); a.setFloor(f); }, f); await sleep(900);
      const ids = await g.eval(() => window.__dw.floor.rooms.map((r) => r.id));
      const hasX = await g.eval(() => !!window.__dw.floor.xroads);
      const list = [...ids, ...(hasX ? ['xroads'] : [])];
      for (let k = 0; k < 5; k++) for (const id of list) {
        try { await g.eval((id) => { const a = window.__dw.api; a.godMode(true); a.teleport(id); if (window.__ff) window.__ff(30); }, id); } catch (e) { fail.push(`hop F${f} ${id}: ${e.message.slice(0, 120)}`); }
        await sleep(120); hop++;
        if (await g.eval(() => window.__dw.scene.roomMgr.inPocket)) { await g.eval(() => window.__dw.scene.roomMgr.leavePocket()); await sleep(400); }
        if (hop % 50 === 0) await sample('hop' + hop);
        if (hop >= N) break;
      }
      if (hop >= N) break;
    }
  }
}
await sleep(1500);
const last = await sample('final');
const a = rows[0], b = rows[rows.length - 1];
const grow = { heapPct: +(((b.heapRaw - a.heapRaw) / a.heapRaw) * 100).toFixed(1), bus: b.busTotal - a.busTotal, gev: b.gev - a.gev, tex: b.tex - a.tex, glTex: b.glTex - a.glTex, glFb: b.glFb - a.glFb, glBuf: b.glBuf - a.glBuf };
console.log('GROWTH first->last', JSON.stringify(grow));
const growers = Object.keys(last.p.busCounts).filter((k) => (last.p.busCounts[k] || 0) > (first.p.busCounts[k] || 0)).map((k) => `${k}:${first.p.busCounts[k] || 0}->${last.p.busCounts[k]}`);
console.log('bus growers', growers);
console.log('fails', fail); console.log('errors', g.errors.filter((e) => !/favicon/.test(e)).slice(0, 5), 'rej', (await g.rejections()).slice(0, 3), 'warns', [...new Set(g.warns.filter((w) => !/GL Driver|GPU stall/.test(w)))].slice(0, 8));
await g.close();
