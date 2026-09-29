// Robustness QA: player standing in a door pocket when the room locks / enemies alive / door closes under him.
import { launch } from './harness.mjs';
const g = await launch({ query: '?debug=1&seed=6', name: 'rb-door', quiet: true });
await g.startRun();
const r = await g.eval(async () => {
  const a = window.__dw.api, s = window.__dw.scene, p = s.player, out = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  a.godMode(true); a.openAll();
  for (const rm of s.roomMgr.floor.rooms.slice(0, 6)) {
    a.teleport(rm.id); await sleep(1500);
    const room = s.room; if (!room) continue;
    const dirs = Object.keys(room.doors);
    for (const dir of dirs) {
      const pos = { up: [720, 150], down: [720, 930], left: [70, 528], right: [1370, 528] }[dir];
      a.spawn('outlaw', 720, 500);
      p.x = pos[0]; p.y = pos[1]; p.vx = p.vy = 0;
      room.mode = 'idle'; room.state.cleared = false; room.startEncounter();
      await sleep(600);
      const inside = p.x >= 90 && p.x <= 1350 && p.y >= 190 && p.y <= 870;
      out.push({ room: rm.id, type: room.type, dir, locked: room.locked, inside, x: Math.round(p.x), y: Math.round(p.y) });
      a.killAll(); a.clearRoom(); await sleep(400);
    }
  }
  return out;
});
const bad = r.filter((x) => x.locked && !x.inside);
console.log('cases', r.length, 'player outside while locked:', bad.length, JSON.stringify(bad.slice(0, 5)));
console.log('sample', JSON.stringify(r.slice(0, 4)));
console.log('errors', g.errors.length, g.errors.slice(0, 4));
await g.close();
