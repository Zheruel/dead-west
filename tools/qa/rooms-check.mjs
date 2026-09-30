// FN-6 room-type check: every room type builds from a debug jump (placeholders welcome), state persists across revisits (no duplicate
// rewards), champion / vault / event / barrel flows, pocket room, minimap redraw. node tools/qa/rooms-check.mjs [query]
import { launch } from './harness.mjs';
const g = await launch({ query: process.argv[2] || '?debug=1&seed=77', name: 'rooms', quiet: true });
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
await g.startRun();
await g.eval(() => { window.__dw.api.godMode(true); });
await g.wait(800);

// helper installed in the page: jump to a synthesized room (mutating an existing def of the floor)
await g.eval(() => {
  window.__mk = (type, extra = {}, keep = false) => {
    const sc = window.__dw.scene, m = sc.roomMgr;
    const def = m.floor.rooms.find((r) => (r._orig || r.type) === 'normal' && r.dist >= 2);
    def._orig = def._orig || 'normal';
    for (const k of ['template', 'mini', 'event', 'variant', 'pocket']) delete def[k];
    Object.assign(def, { type, ...extra });
    if (!keep) delete m.states[def.id];
    window.__dw.player.godMode = true;
    m.jump(def.id, null);
    return def.id;
  };
  window.__room = () => window.__dw.scene.room;
});

for (let f = 1; f <= 6; f++) {
  await g.eval((f) => window.__dw.api.setFloor(f), f);
  await g.wait(1800);
  const kinds = await g.eval(() => {
    const m = window.__dw.scene.roomMgr; const out = [];
    for (const d of m.floor.rooms) { m.jump(d.id, null); const r = window.__room(); out.push(`${d.type}:${r.tiles.length}`); }
    return out.join(' ');
  });
  await g.wait(300);
  ok(g.errors.length === 0, `floor ${f}: all ${kinds.split(' ').length} generated rooms build (${kinds.slice(0, 60)}...) errors=${g.errors.length}`);
}

// champion, all six minis
for (let f = 1; f <= 6; f++) {
  await g.eval((f) => { window.__dw.api.setFloor(f); }, f);
  await g.wait(1500);
  const mini = ['ol_fury', 'hangman', 'motherlode', 'ash_deacon', 'stoker', 'head_bouncer'][f - 1];
  const id = await g.eval((a) => window.__mk('champion', { template: `champion_f${a.f}`, mini: a.mini }), { mini, f });
  await g.wait(3500);
  const st = await g.eval(() => { const r = window.__room(); return { mode: r.mode, boss: !!r.boss, alive: r.boss && r.boss.alive, locked: r.locked, ctl: !!r.controller('champion'), active: r.boss && r.boss.active }; });
  ok(st.mode === 'combat' && st.boss && st.locked && st.ctl, `F${f} champion ${mini} fight started ${JSON.stringify(st)}`);
  if (f === 1 || f === 4) {
    await g.eval(() => { const r = window.__room(); r.boss.hp = 1; r.boss.hurt(9999, {}); });
    await g.wait(2500);
    const rw = await g.eval(() => { const r = window.__room(); return { cleared: r.state.cleared, chests: r.chests.length, ped: r.pedestals.length, pk: r.pickups.map((p) => p.type).join(','), locked: r.locked, done: r.state.ctl && r.state.ctl.done }; });
    console.log('  reward', JSON.stringify(rw));
    ok(rw.cleared && !rw.locked && rw.chests === 1 && rw.done, `F${f} champion defeated: cleared, unlocked, 1 free chest, done flag`);
    const before = JSON.stringify(rw);
    await g.eval((id) => { const m = window.__dw.scene.roomMgr; m.jump(m.floor.rooms[0].id); }, id);
    await g.wait(300);
    await g.eval((id) => { const m = window.__dw.scene.roomMgr; m.jump(id); }, id);
    await g.wait(1500);
    const after = await g.eval(() => { const r = window.__room(); return { cleared: r.state.cleared, chests: r.chests.length, ped: r.pedestals.length, pk: r.pickups.map((p) => p.type).join(','), locked: r.locked, done: r.state.ctl && r.state.ctl.done, mode: r.mode, boss: !!r.boss }; });
    ok(after.cleared && after.chests === 1 && after.ped === rw.ped && !after.locked && after.mode === 'idle' && !after.boss, `F${f} champion revisit: no refight, no duplicate rewards ${JSON.stringify(after)}`);
  }
}

// events
for (const ev of ['card_sharp', 'wishing_well', 'gravedigger', 'snake_oil', 'preacher', 'quick_draw']) {
  await g.eval((ev) => window.__mk('event', { template: `event_${ev}`, event: ev }), ev);
  await g.wait(700);
  const st = await g.eval(() => { const r = window.__room(); const c = r.controller('event'); return { cleared: r.state.cleared, mode: r.mode, ev: r.state.event && r.state.event.id, prop: !!(c && c.prop), sub: !!(c && c.sub) }; });
  ok(st.cleared && st.mode === 'idle' && st.prop, `event ${ev} builds (sub controller ${st.sub})`);
}

// vault
{
  const id = await g.eval(() => { const i = window.__mk('supersecret', { template: 'vault_a' }); window.__dw.scene.player.teleport(150, 250); return i; });
  await g.wait(800);
  const a = await g.eval(() => { const r = window.__room(); return { ped: r.pedestals.filter((p) => !p.rec.taken).length, coins: r.pickups.filter((p) => p.type === 'coin').length, rec: r.state.pedestals.length }; });
  ok(a.ped === 2 && a.coins === 12, `vault: 2 pedestals + 12 coins ${JSON.stringify(a)}`);
  await g.eval((id) => { const m = window.__dw.scene.roomMgr; m.jump(m.floor.rooms[0].id); m.jump(id); const p = window.__dw.scene.player; p.teleport(150, 250); }, id);
  await g.wait(800);
  const b = await g.eval(() => { const r = window.__room(); return { ped: r.pedestals.filter((p) => !p.rec.taken).length, coins: r.pickups.filter((p) => p.type === 'coin').length }; });
  ok(b.ped === 2 && b.coins === 12, `vault revisit restores exactly the same stock ${JSON.stringify(b)}`);
}

// pocket / crossroads
{
  await g.eval(() => window.__mk('crossroads', { template: 'crossroads_a', pocket: true }));
  await g.wait(900);
  const st = await g.eval(() => { const r = window.__room(); return { cleared: r.state.cleared, ctl: !!r.controller('xroads'), locked: r.locked, tables: r.controller('xroads') && r.controller('xroads').tables && r.controller('xroads').tables.length }; });
  ok(st.cleared && st.ctl && !st.locked, `crossroads pocket builds ${JSON.stringify(st)}`);
}

// secret variants + tells must not crash with the controllers absent
for (const v of ['stash', 'dead_mans_hand', 'cache', 'shrine']) {
  await g.eval((v) => window.__mk('secret', { variant: v }), v);
  await g.wait(500);
}
ok(g.errors.length === 0, `secret variants build, errors=${g.errors.length}`);

// barrels: inject Z / G / T / lava tiles into a template, shoot / blow one up, chain-detonate
{
  const res = await g.eval(async () => {
    const T = (await import('/src/gen/Templates.js')).default;
    const m = window.__dw.scene.roomMgr;
    const def = m.floor.rooms.find((r) => (r._orig || r.type) === 'normal' && r.dist >= 2);
    def.template = 'f1_03';
    const tpl = T.get(def.template);
    const rows = tpl.grid.map((r) => r.slice());
    const set = (c, r, ch) => { tpl.grid[r][c] = ch; };
    set(3, 1, 'Z'); set(4, 1, 'Z'); set(9, 5, 'G'); set(2, 5, 'T'); set(6, 5, 'L'); set(7, 5, 'Q'); set(8, 5, 's');
    delete m.states[def.id]; def.type = 'normal';
    m.jump(def.id, null);
    const r = window.__room();
    const out = { z: r.tiles[1][3].type + '/' + !!r.tiles[1][3].barrel, g: r.tiles[5][9].type, t: r.tiles[5][2].type, l: r.tiles[5][6].type, q: r.tiles[5][7].type, s: r.tiles[5][8].type, solidZ: r.tiles[1][3].solid };
    window.__z = [r.tiles[1][3], r.tiles[1][4]];
    r.damageTile(r.tiles[1][3], 1);
    out.broke = r.tiles[1][3].broken;
    tpl.grid.forEach((row, i) => { tpl.grid[i] = rows[i]; });
    return out;
  });
  console.log('  tiles', JSON.stringify(res));
  ok(res.z === 'breakable/true' && res.g === 'block' && res.t === 'block' && res.l === 'lava' && res.q === 'quicksand' && res.s === 'rspikes' && res.solidZ && res.broke, 'hazard tiles register; barrel breaks in one hit');
  await g.wait(900);
  const chain = await g.eval(() => window.__z[1].broken);
  ok(chain, 'neighbouring barrel chain-detonated');
}

// elite roll uses its own stream; extra enemy: deterministic composition per seed
{
  const a = await g.eval(() => { const id = window.__mk('normal', { template: 'f1_03' }); return JSON.stringify(window.__room().waves.map((w) => w.map((e) => e.id))); });
  const b = await g.eval(() => { const id = window.__mk('normal', { template: 'f1_03' }); return JSON.stringify(window.__room().waves.map((w) => w.map((e) => e.id))); });
  ok(a === b, 'wave composition deterministic per room seed');
}

await g.eval(() => { const m = window.__dw.scene.roomMgr; m.jump(m.floor.startId); });
await g.wait(600);
await g.shot('rooms-check-end');
ok(g.errors.length === 0, `no console errors (${g.errors.length}) ${JSON.stringify(g.errors.slice(0, 4))}`);
console.log(fails ? `${fails} FAILED` : 'ALL OK');
await g.close();
process.exit(fails ? 1 : 0);
