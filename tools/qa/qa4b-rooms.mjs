// QA-4b room enter/exit leak test: node tools/qa/qa4b-rooms.mjs [hops=200] [seed=42]
// Hops through every room type on floors 1-6 (normal/treasure/shop/secret/event/champion/vault/boss/mini + crossroads pocket), forcing every room modifier
// (darkness/fog/dust_storm/blood_moon use LightMask RenderTextures) and random clear/killAll. Reports GL texture/framebuffer, bus, scene child, tween, heap growth.
import { open, PROBE, fmt, sleep } from './qa4-lib.mjs';
const N = +(process.argv[2] || 200), seed = +(process.argv[3] || 42);
const g = await open(`?debug=1&seed=${seed}&char=gunslinger&unlockall=1`, { name: 'qa4b-rooms' });
await g.startRun(); await g.installFF();
await g.eval(() => { let a = 12345; window.__rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; window.__dw.api.godMode(true); window.__dw.api.give(50); });
const EXT = () => { const r = window.__game.renderer; const c = (o) => (o ? (Array.isArray(o) ? o.length : o.size != null ? o.size : Object.keys(o).length) : -1);
  const gs = window.__dw && window.__dw.scene; let rts = 0; if (gs) for (const o of gs.children.list) if (o.type === 'RenderTexture') rts++;
  return { glTex: c(r.glTextureWrappers), glFb: c(r.glFramebufferWrappers), glBuf: c(r.glBufferWrappers), rts, mask: gs ? gs.cameras.main.mask ? 1 : 0 : -1, tweensG: gs ? gs.tweens.getTweens().length : -1 }; };
const rows = []; const fail = []; const typeHits = {}; const modHits = {};
const sample = async (label) => { const heap = await g.heap(); const p = await g.eval(PROBE), e = await g.eval(EXT);
  const row = { label, heap, busTotal: p.busTotal, gev: p.gev, tex: p.tex, ...e, ch: p.scenes.Game ? p.scenes.Game.ch : -1, gev2: p.scenes.Game ? p.scenes.Game.ev : -1, tw: p.scenes.Game ? p.scenes.Game.tw : -1, timers: p.scenes.Game ? p.scenes.Game.timers : -1 };
  rows.push(row); console.log(label, fmt(heap), JSON.stringify({ ...row, heap: undefined, label: undefined })); return { row, p }; };
const first = await sample('start');
const keys0 = await g.eval(() => Object.keys(window.__game.textures.list));
let keys1 = keys0;
const MODS = ['darkness', 'fog', 'dust_storm', 'blood_moon', 'stampede', 'rockfall', 'hellfire', 'lurch'];
let hop = 0, floorIdx = 0;
while (hop < N) {
  const f = (floorIdx++ % 6) + 1;
  await g.eval((f) => { const a = window.__dw.api; a.godMode(true); a.heal(); a.setFloor(f); }, f); await g.eval(() => window.__wake()); await sleep(1500); await g.eval(() => window.__ff(20));
  const info = await g.eval(() => ({ rooms: window.__dw.floor.rooms.map((r) => ({ id: r.id, type: r.type })), x: !!window.__dw.floor.xroads }));
  for (let pass = 0; pass < 4 && hop < N; pass++) for (const r of info.rooms) {
    if (hop >= N) break;
    typeHits[r.type] = (typeHits[r.type] || 0) + 1;
    const res = await g.eval(async (id, mods) => {
      const { bus } = await import('/src/core/events.js');
      const CATCH = (fn) => { try { fn(); } catch (e) { throw e; } };
      const w = window.__dw, api = w.api, R = window.__rnd, out = {};
      try {
        const def = w.floor.byId[id]; const rm = w.scene.roomMgr;
        if (def && R() < 0.5 && def.type !== 'boss') { def.mod = mods[Math.floor(R() * mods.length)]; const st = rm.stateFor(id); st.cleared = false; out.mod = def.mod; }
        if (w.scene.room && w.scene.room.type === 'shop') bus.emit('room:transition', { from: w.scene.roomMgr.currentId, to: id, dir: 'up' }); // emulate the normal exit path (QA4-040: bare jump() from a talking shop throws every frame)
        api.godMode(true); api.teleport(id);
        w.__ffn = 40 + Math.floor(R() * 60); window.__ff(w.__ffn, (i) => { const s = w.scene; if (s.player && s.gameInput && i % 10 === 0) s.gameInput.override = { move: { x: R() < .5 ? 1 : -1, y: R() < .5 ? 1 : -1 }, aim: null }; });
        const k = R();
        if (k < 0.3) api.clearRoom(); else if (k < 0.45) api.killAll(); else if (k < 0.5) api.openAll();
        if (R() < 0.3) window.__ff(30);
        out.type = w.scene.room && w.scene.room.type; out.cur = w.scene.roomMgr.currentId; out.rmod = w.scene.room && w.scene.room._mod ? w.scene.room._mod.id : null;
        if (w.scene.room && w.scene.room.mod) out.actualMod = w.scene.room.mod;
      } catch (e) { out.err = String(e.stack || e).slice(0, 300); }
      return out;
    }, r.id, MODS).catch((e) => ({ err: 'eval ' + e.message.slice(0, 200) }));
    if (res.err) fail.push(`hop ${hop} F${f} ${r.id}(${r.type}) mod=${res.mod}: ${res.err}`);
    if (res.rmod) modHits[res.rmod] = (modHits[res.rmod] || 0) + 1;
    hop++;
    // pocket excursion once per few hops on boss rooms / when the floor has xroads
    if (info.x && r.type === 'boss' && pass % 2 === 0) {
      const pk = await g.eval(() => { const w = window.__dw, api = w.api; try { api.godMode(true); api.teleport('boss'); window.__ff(30); api.openGate(); const ok = api.enterCrossroads(); window.__wake(); return { ok, err: null }; } catch (e) { return { err: String(e.stack || e).slice(0, 300) }; } });
      let inP = false; for (let k = 0; k < 20 && !inP; k++) { await sleep(500); inP = await g.eval(() => window.__dw.scene.roomMgr.inPocket); } // fade swap needs real time (slow under load)
      typeHits.pocket = (typeHits.pocket || 0) + (inP ? 1 : 0);
      if (pk.err || !inP) fail.push(`pocket F${f} entry ${JSON.stringify(pk)} inPocket=${inP}`);
      const ffe = await g.eval(() => { try { window.__ff(120, (i) => { const s = window.__dw.scene; if (i % 20 === 0) s.gameInput.override = { move: { x: Math.sin(i), y: Math.cos(i) }, aim: null }; }); return null; } catch (e) { return String(e.stack).replace(/http:\/\/[^/]+/g, '').slice(0, 1500); } }); if (ffe) { fail.push('pocket ff threw: ' + ffe); console.log('POCKET-FF-THROW', ffe); }
      await g.eval(() => { window.__wake(); window.__dw.scene.roomMgr.leavePocket(); }); let still = true; for (let k = 0; k < 20 && still; k++) { await sleep(500); still = await g.eval(() => window.__dw.scene.roomMgr.inPocket); } if (still) fail.push(`pocket F${f} leave failed`);
      await g.eval(() => window.__ff(30)); hop++;
    }
    if (hop % 100 === 0) { keys1 = await g.eval(() => Object.keys(window.__game.textures.list)); }
    if (hop % 25 === 0) { await g.eval(() => window.__wake()); await sleep(200); await sample('hop' + hop); }
  }
}
await g.eval(() => window.__wake()); await sleep(1500);
const last = await sample('final'); const base = rows[2] || rows[0];
const pct = (a, b) => +(((b - a) / a) * 100).toFixed(1);
for (const [name, b] of [['start', first.row], ['hop50', base]]) console.log(`GROWTH ${name}->final`, JSON.stringify({ heapPct: pct(b.heap, last.row.heap), heapMB: +((last.row.heap - b.heap) / 1048576).toFixed(2), bus: last.row.busTotal - b.busTotal, gev: last.row.gev - b.gev, tex: last.row.tex - b.tex, glTex: last.row.glTex - b.glTex, glFb: last.row.glFb - b.glFb, glBuf: last.row.glBuf - b.glBuf, ch: last.row.ch - b.ch, tw: last.row.tw - b.tw, ev: last.row.gev2 - b.gev2 }));
const growers = Object.keys(last.p.busCounts).filter((k) => (last.p.busCounts[k] || 0) > (first.p.busCounts[k] || 0)).map((k) => `${k}:${first.p.busCounts[k] || 0}->${last.p.busCounts[k]}`);
console.log('bus growers', growers);
const kf = await g.eval(() => Object.keys(window.__game.textures.list)); const added = kf.filter((k) => !keys0.includes(k)); const norm = (k) => k.replace(/\d+/g, '#'); const grp = {}; for (const k of added) grp[norm(k)] = (grp[norm(k)] || 0) + 1; console.log('tex added', added.length, JSON.stringify(Object.entries(grp).sort((a, b) => b[1] - a[1]).slice(0, 25))); console.log('tex sample', added.slice(0, 40).join(',')); console.log('typeHits', JSON.stringify(typeHits), 'modHits', JSON.stringify(modHits));
console.log('fails', fail.slice(0, 20), 'nFail', fail.length);
console.log('errors', g.errors.filter((e) => !/favicon/.test(e)).slice(0, 5), 'rej', (await g.rejections()).slice(0, 3), 'warns', [...new Set(g.warns.filter((w) => !/GL Driver|GPU stall/.test(w)))].slice(0, 8));
await g.close();
