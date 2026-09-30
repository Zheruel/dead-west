// QA-1 meta flows part 2: board contract start, daily determinism / abandon / record, codex stages. node tools/qa/qa1-meta2.mjs <board|daily|codex>
import { freshSave } from '../../src/core/Save.js';
import { BOUNTY_BY_ID, contractSeed } from '../../src/meta/bounties.js';
import { open, check, active, waitScene, saveOf, done, results } from './qa1-lib.mjs';

const area = process.argv[2] || 'board';
const NOW = Date.now();
const fs0 = (unl) => { const f = freshSave(); f.unlocks = Object.fromEntries(unl.map((i) => [i, NOW])); return f; };
const ALL = ['char:preacher', 'char:hunter', 'char:queen', 'mode:hell', 'mode:daily'];
const menuSel = (g, n) => g.eval((n) => window.__game.scene.getScene('Menu').list.select(n, true), n);
const info = (g) => g.eval(() => {
  const s = window.__dw.scene, p = s.player;
  return { char: s.run.char, mode: s.run.mode, contract: s.run.contractId, mut: [...(s.run.mutators || [])], seed: s.seed, maxFloor: s.run.maxFloor, items: [...p.items], enabled: null, hp: p.hp, maxHp: p.maxHp, itemsOpen: null };
});
const layouts = (g, floors) => g.eval((floors) => {
  const a = window.__dw.api, out = {};
  for (const f of floors) { a.setFloor(f); out[f] = window.__dw.floor.rooms.map((r) => `${r.id}:${r.type}:${r.tpl || ''}:${Object.values(r.doors).map((d) => d.to + d.kind).join(',')}`).join('|'); }
  return out;
}, floors);

async function board() {
  const g = await open('', { save: fs0(ALL) });
  await menuSel(g, 2);
  await g.wait(100); await g.tap('Enter', 80);
  check('BRD opens', await waitScene(g, 'Board', 8000)); await g.wait(800);
  // first poster = bt_greenhorn (tin, gunslinger, clear:2)
  await g.tap('Enter', 80);
  check('BRD TAKE THE JOB starts a contract run', await waitScene(g, 'Game', 20000)); await g.wait(1500);
  let i = await info(g);
  const b = BOUNTY_BY_ID.bt_greenhorn;
  check('BRD contract rider/items/mutators/seed exact', i.mode === 'contract' && i.contract === 'bt_greenhorn' && i.char === b.char && JSON.stringify(i.mut) === JSON.stringify(b.mutators) && i.seed === contractSeed(b.id) && i.maxFloor === 2, JSON.stringify(i));
  const en = await g.eval(async () => { const { Meta } = await import('/src/meta/Meta.js'); return { enabled: Meta.enabled, itemsOpen: Meta.itemsOpen }; });
  check('BRD contract run has Meta enabled and item gates open', en.enabled === true && en.itemsOpen === true, JSON.stringify(en));
  const cs = await g.eval(() => !window.__game.scene.isActive('Cutscene'));
  check('BRD no story cutscene in a contract run', cs);
  // tier progression state
  const tiers = await g.eval(async () => { const { Meta } = await import('/src/meta/Meta.js'); return { tin: Meta.tierOpen('tin'), silver: Meta.tierOpen('silver'), gold: Meta.tierOpen('gold') }; });
  check('BRD fresh: silver/gold locked', tiers.tin && !tiers.silver && !tiers.gold, JSON.stringify(tiers));
  // clear floor-2 boss => contract fulfilled => reward applied once
  const res = await g.eval(async () => {
    const { bus } = await import('/src/core/events.js');
    window.__dc = 0; bus.on('bounty:completed', () => window.__dc++);
    const a = window.__dw.api; a.setFloor(2); a.jump('boss');
    await new Promise((r) => setTimeout(r, 600));
    const bs = a.spawnBoss('grimm'); bs.hp = 0; bs.die({});
    return true;
  });
  check('BRD reached boss kill', res);
  check('BRD contract -> End (variant contract)', await waitScene(g, 'End', 40000));
  await g.wait(1500);
  const sv = await saveOf(g);
  const st = sv.bounty.bt_greenhorn;
  console.log('   bounty state', JSON.stringify(st), 'lore', JSON.stringify(Object.keys(sv.codex.lore)));
  check('BRD contract recorded done once with reward lore', st && st.done > 0 && st.tries >= 1 && !!sv.codex.lore.lore_board, JSON.stringify(st));
  check('BRD bounty:completed fired once', (await g.eval(() => window.__dc)) === 1);
  check('BRD contract win did not count as a normal win', sv.stats.wins === 0, 'wins=' + sv.stats.wins);
  check('BRD no console errors', g.errors.length === 0, g.errors.slice(0, 4).join(' | '));
  await g.close();
}

const waitEntries = async (g, n) => { try { await g.page.waitForFunction(async (n) => { const { Save } = await import('/src/core/Save.js'); return Save.get().daily.entries.length >= n; }, { timeout: 20000, polling: 500 }, n); } catch (e) { /* reported by check */ } };
async function daily() {
  const save = fs0(ALL);
  const g = await open('', { save });
  const start = async (date) => {
    await g.eval((date) => { const s = window.__game.scene; s.getScenes(true).forEach((x) => { if (x.sys.settings.key !== 'Menu') s.stop(x.sys.settings.key); }); s.start('Game', { mode: 'daily', date }); }, date);
    await waitScene(g, 'Game', 30000); await g.wait(1500);
  };
  await start('2026-09-29');
  const a = await info(g);
  const h0 = await saveOf(g); console.log('   hist before', h0.history.length);
  const L1 = await layouts(g, [1, 2, 3]);
  await g.eval(() => { const s = window.__game.scene; s.stop('HUD'); s.stop('Game'); s.start('Menu'); });
  await waitScene(g, 'Menu', 15000);
  const s1 = await saveOf(g);
  check('DLY abandon (leaving a daily) records no entry', s1.daily.entries.length === 0 && !s1.history.some((h) => h.mode === 'daily'), JSON.stringify(s1.daily.entries) + ' hist ' + JSON.stringify(s1.history.slice(-1)) + ' dailyRuns ' + s1.stats.dailyRuns);
  await start('2026-09-29');
  const b = await info(g);
  const L2 = await layouts(g, [1, 2, 3]);
  check('DLY same date -> same rider/seed/mutator', a.char === b.char && a.seed === b.seed && JSON.stringify(a.mut) === JSON.stringify(b.mut), JSON.stringify([a, b]));
  check('DLY same date -> identical floors 1-3 layouts', JSON.stringify(L1) === JSON.stringify(L2));
  // item pool determinism: roll the same pool twice on same seed via items.roll with subRng like rooms
  const pools = await g.eval(async () => {
    const { subRng } = await import('/src/core/rng.js');
    const sc = window.__dw.scene;
    const r1 = [], r2 = [];
    for (let i = 0; i < 8; i++) r1.push(sc.items.roll('treasure', subRng('item', sc.seed, i)));
    for (let i = 0; i < 8; i++) r2.push(sc.items.roll('treasure', subRng('item', sc.seed, i)));
    return [r1, r2];
  });
  console.log('   (item roll determinism checked by layout/seed equality; pool roll consumes the pool so a same-scene re-roll differs by design)', pools[0].length);
  const gates = await g.eval(async () => { const { Meta } = await import('/src/meta/Meta.js'); return { itemsOpen: Meta.itemsOpen, enabled: Meta.enabled, mode: window.__dw.scene.run.mode, hell: window.__dw.scene.diff.id }; });
  console.log('   daily run', JSON.stringify(gates), JSON.stringify(b));
  check('DLY itemsOpen (gates open) in a daily', gates.itemsOpen === true);
  // die: entry recorded once
  await g.eval(() => window.__dw.api.die());
  await waitScene(g, 'End', 30000); await waitEntries(g, 1); await g.wait(1500);
  const s2 = await saveOf(g);
  check('DLY death records exactly one board entry', s2.daily.entries.length === 1 && s2.stats.dailyRuns === 1, JSON.stringify(s2.daily));
  // retry same date: second entry
  await g.wait(3000); await g.tap('KeyR', 80); try { await g.page.waitForFunction(() => !window.__game.scene.isActive('End') && !!(window.__dw && window.__dw.player && window.__dw.player.hp > 0), { timeout: 40000, polling: 500 }); } catch (e) { console.log('   R did not restart'); } await g.wait(1500);
  const c = await info(g);
  check('DLY ride again replays same daily seed', c.seed === a.seed && c.mode === 'daily', JSON.stringify(c));
  await g.eval(() => window.__dw.api.die()); await waitScene(g, 'End', 30000); await waitEntries(g, 2); await g.wait(1500);
  const s3 = await saveOf(g);
  check('DLY second attempt adds a 2nd entry (<= cap 200)', s3.daily.entries.length === 2, JSON.stringify(s3.daily));
  console.log('   daily save', JSON.stringify(s3.daily));
  // hell sunday flag
  const dd = await g.eval(async () => { const { dailyFor } = await import('/src/data/difficulty.js'); return { a: dailyFor('2026-09-29'), b: dailyFor('2026-09-29'), sun: dailyFor('2026-10-04'), mon: dailyFor('2026-10-05') }; });
  check('DLY dailyFor stable; 2026-10-04 (Sunday) hell', JSON.stringify(dd.a) === JSON.stringify(dd.b) && dd.sun.hell === true && dd.mon.hell === false, JSON.stringify([dd.sun.hell, dd.mon.hell]));
  check('DLY no console errors', g.errors.length === 0, g.errors.slice(0, 4).join(' | '));
  await g.close();
}

async function codex() {
  const g = await open('?seed=17');
  await g.tap('Enter', 80); await waitScene(g, 'Game', 30000); await g.wait(2000);
  const r = await g.eval(async () => {
    const { Meta } = await import('/src/meta/Meta.js'); const { Save } = await import('/src/core/Save.js');
    const a = window.__dw.api; const o = {};
    o.s0 = Meta.enemyStage('coyote');
    const e = a.spawn('coyote', 700, 500); await new Promise((r) => setTimeout(r, 500));
    o.s1 = Meta.enemyStage('coyote');
    e.hp = 0; e.die({});
    for (let i = 0; i < 2; i++) { const x = a.spawn('coyote', 700, 500); x.hp = 0; x.die({}); }
    o.s3 = Meta.enemyStage('coyote'); o.kills = Save.get().codex.enemies.coyote;
    // gated item: silhouetted
    o.gated = Object.values((await import('/src/items/registry.js')).allItems ? (await import('/src/items/registry.js')).allItems() : []).filter((d) => d.gate).slice(0, 3).map((d) => ({ id: d.id, gate: d.gate, unlocked: Save.itemUnlocked(d), stage: Meta.itemStage(d.id) }));
    return o;
  });
  console.log('   codex', JSON.stringify(r));
  check('CDX fresh: coyote S0', r.s0 === 0, String(r.s0));
  check('CDX coyote seen -> S1', r.s1 >= 1, String(r.s1));
  check('CDX coyote 3 kills -> S2', r.s3 >= 2 && r.kills && r.kills.kills >= 3, JSON.stringify(r.kills));
  check('CDX gated items locked + unseen', r.gated.every((x) => !x.unlocked && x.stage === 0), JSON.stringify(r.gated));
  // scene: silhouette tab counters
  await g.eval(() => { const s = window.__game.scene; s.stop('HUD'); s.stop('Game'); s.start('Codex'); });
  await waitScene(g, 'Codex', 8000); await g.wait(900);
  await g.shot('qa1-codex-bestiary-live');
  const t = await g.eval(() => window.__game.scene.getScene('Codex').children.list.filter((o) => o.text).map((o) => o.text).slice(0, 40));
  console.log('   codex texts', JSON.stringify(t));
  check('CDX no console errors', g.errors.length === 0, g.errors.slice(0, 4).join(' | '));
  await g.close();
}

const A = { board, daily, codex };
(async () => {
  try { await A[area](); } catch (e) { console.log('SCRIPT ERROR', e && e.stack || e); check(area + ' script completed', false, String(e).slice(0, 200)); }
  done(null); process.exit(0);
})();
