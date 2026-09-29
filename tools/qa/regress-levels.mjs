// REGRESSION (level content): wave-flow test: for a few templates, enter, then killAll wave after wave; records spawn distance to the player, flyer-over-pit spawns and
// verifies the room ends 'done' (doors unlocked, no leftovers). node tools/qa/regress-levels.mjs [floor=1|2|3]
import { launch } from './harness.mjs';
const floor = +(process.argv[2] || 1);
const ids = { 1: ['f1_16', 'f1_03', 'f1_12'], 2: ['f2_16', 'f2_05'], 3: ['f3_16', 'f3_04'] }[floor];
const g = await launch({ query: `?debug=1&seed=${20 + floor}`, name: 'waves', quiet: true });
await g.startRun();
await g.eval((f) => { const a = window.__dw.api; a.godMode(true); a.setFloor(f); }, floor);
await g.wait(2500);
for (const tid of ids) {
  await g.eval((tid) => {
    const m = window.__dw.scene.roomMgr;
    const def = m.floor.rooms.find((r) => r.type === 'normal' && r.dist >= 2);
    def.template = tid; delete m.states[def.id];
    window.__dw.player.godMode = true;
    m.jump(def.id, Object.keys(def.doors)[0]);
    // park the player in the middle so relocation of later waves is exercised
    window.__waveLog = [];
  }, tid);
  let last = -1;
  for (let i = 0; i < 40; i++) {
    await g.page.waitForFunction(() => { const sc = window.__dw.scene, r = sc.room; return r && (r.state.cleared || (r.mode === 'combat' && r.pending === 0 && sc.enemies.some((e) => e.alive))); }, { timeout: 60000 }).catch(() => {});
    const st = await g.eval(() => {
      const sc = window.__dw.scene, r = sc.room, p = sc.player;
      return { cleared: r.state.cleared, wave: r.waveIdx, n: sc.enemies.filter((e) => e.alive).length, flyOverPit: sc.enemies.filter((e) => e.alive && e.flying && r.tiles[Math.floor((e.y - 192) / 96)] && (r.tiles[Math.floor((e.y - 192) / 96)][Math.floor((e.x - 96) / 96)] || {}).type === 'pit').length,
        minD: Math.round(Math.min(...sc.enemies.filter((e) => e.alive).map((e) => Math.hypot(e.x - p.x, e.y - p.y)), 9999)), locked: r.locked, ids: sc.enemies.filter((e) => e.alive).map((e) => e.id || e.constructor.name).join(',') };
    });
    if (st.cleared) { console.log(tid, 'CLEARED, locked =', st.locked); break; }
    if (st.wave !== last) { console.log(tid, 'wave', st.wave + 1, 'enemies', st.n, 'min dist', st.minD, 'flyers over pit', st.flyOverPit, st.ids); last = st.wave; }
    await g.eval(() => { const p = window.__dw.scene.player; p.x = 720; p.y = 528; window.__dw.api.killAll(); });
    await g.wait(300);
  }
  const end = await g.eval(() => ({ enemies: window.__dw.scene.enemies.length, bullets: window.__dw.scene.bullets.enemy.list.filter((b) => b.active).length, locked: window.__dw.scene.room.locked, drops: window.__dw.scene.room.pickups.length }));
  console.log(tid, 'end', JSON.stringify(end));
}
console.log('errors', g.errors.length, g.errors.slice(0, 5));
await g.close();
