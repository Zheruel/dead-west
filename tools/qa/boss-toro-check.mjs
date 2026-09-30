// Toro phase-change fuzz + death/reward checks (god mode on, fast-forwarded).
//   node tools/qa/boss-toro-check.mjs [--query=?debug=1&seed=11] [--quick]
// For every attack (forced) and several offsets into it: cross the next phase threshold (hp set + onHit) and verify the cancel is clean (no telegraph /
// lane / GroundHaz / airborne / stun / alpha / contact leftovers, boss invulnerable only for the roar), then that the boss keeps attacking (no deadlock).
// Also: every phase reachable (api sets hp then onHit), death mid-attack (incl. airborne leap) leaves nothing behind and yields pedestal + heart + trapdoor,
// and a double threshold jump (100 % -> 20 %) ends in phase 2 with the boss still cycling.
import { boot, toBoss, hideCards } from './boss-toro-lib.mjs';
const quick = process.argv.includes('--quick');
const query = (process.argv.find((a) => a.startsWith('--query=')) || '').slice(8) || '?debug=1&seed=11';
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('FAIL', m); } };

const SETUP = () => {
  window.__T = {
    boss: () => window.__dw.scene.enemies.find((e) => e.isBoss),
    force(name, phase) {
      const b = this.b = this.boss(); b.stop(); b.resetState && b.resetState();
      b.hp = b.maxHp * (phase === 0 ? 0.99 : phase === 1 ? 0.6 : 0.3); b.phase = phase; b.invulnerable = false; b.active = true;
      const s = window.__dw.scene; s.bullets.enemy.clear();
      b.lastAttack = name; b.gen = b.attacks.find((a) => a.name === name).fn.call(b); b.wait = 0; b.idleT = 0;
    },
    state() {
      const b = this.b || this.boss(), s = window.__dw.scene, hz = s.room && s.room._hz;
      const lanes = hz && hz.lanes ? hz.lanes.lanes.filter((l) => l.state !== 'off').length : 0;
      const gh = s._groundHaz ? s._groundHaz.list.filter((h) => !h.done).length : 0;
      return { lanes, gh, tel: b.tel && b.tel.any, charging: !!b.charging, airborne: !!b.airborne, stunned: b.stunned, alpha: b.sprite ? b.sprite.alpha : 1, inv: b.invulnerable, contact: b.contactDamage, phase: b.phase, atk: b.lastAttack, air: b.airHeight || 0, hp: b.hp, dying: b.dying };
    },
  };
};

const g = await boot(query, { items: [], god: true });
try {
  await toBoss(g); await hideCards(g); await g.eval(SETUP);
  const attacks = [['charge', 0], ['fire_breath', 0], ['magma_stomp', 0], ['charge', 1], ['fire_breath', 1], ['magma_stomp', 1], ['herd_stampede', 1]];
  const offsets = quick ? [0.3, 1.2] : [0.15, 0.5, 0.9, 1.3, 1.8, 2.4];
  for (const [name, ph] of attacks) {
    for (const off of offsets) {
      const tag = `${name}@P${ph}+${off}s`;
      const r = await g.eval(([n, p, o]) => {
        const T = window.__T; T.force(n, p);
        window.__ff(Math.round(o * 60));
        const b = T.boss(); const before = T.state();
        b.hp = b.maxHp * (p === 0 ? 0.65 : 0.32); b.onHit(1);
        window.__ff(3);
        const after = T.state();
        window.__ff(130); // roar 1.1 s + change
        const mid = T.state();
        const atks = new Set(); let last = null;
        for (let i = 0; i < 12; i++) { window.__ff(60); const st = T.state(); atks.add(st.atk); last = st; }
        return { before, after, mid, atks: [...atks], last, hp: b.hp };
      }, [name, ph, off]);
      ok(r.after.phase === ph + 1, `${tag}: phase ${r.after.phase} != ${ph + 1}`);
      ok(!r.after.tel && r.after.lanes === 0 && !r.after.charging && !r.after.airborne && r.after.stunned <= 0 && r.after.air === 0, `${tag}: leftovers after change ${JSON.stringify(r.after)}`);
      ok(r.after.inv === true, `${tag}: not invulnerable during roar`);
      ok(r.mid.inv === false && r.mid.alpha === 1 && r.mid.contact > 0, `${tag}: still locked after roar ${JSON.stringify(r.mid)}`);
      ok(r.atks.length >= 1 && r.last.atk != null, `${tag}: no attacks resumed`);
      const bad = r.mid && (r.mid.phase < 0);
      if (bad) fails.push(tag);
    }
    process.stdout.write(`${name}@P${ph} done; fails so far ${fails.length}\n`);
  }

  // double jump 100 % -> 20 %
  await g.eval(() => window.__T.force('charge', 0));
  const dj = await g.eval(() => { const T = window.__T, b = T.boss(); window.__ff(40); b.hp = b.maxHp * 0.2; b.onHit(1); window.__ff(200); const s = T.state(); window.__ff(600); return { s, e: T.state() }; });
  ok(dj.s.phase === 2 && dj.e.phase === 2 && !dj.e.dying, `double jump: ${JSON.stringify(dj)}`);

  // every phase reachable through onHit; leap only at P2
  for (const [p, hpf] of [[1, 0.65], [2, 0.32]]) {
    await g.eval(() => window.__T.force('charge', 0));
    const r = await g.eval(([hf]) => { const b = window.__T.boss(); b.hp = b.maxHp * hf; b.onHit(1); window.__ff(300); return b.phase; }, [hpf]);
    ok(r === p, `phase ${p} not reachable (got ${r})`);
  }
  // hellhounds summoned by roar 1
  await g.eval(() => window.__T.force('charge', 0));
  const hounds = await g.eval(() => { const b = window.__T.boss(); b.hp = b.maxHp * 0.65; b.onHit(1); window.__ff(90); return window.__dw.scene.enemies.filter((e) => !e.isBoss && e.alive).length; });
  ok(hounds >= 1, `roar 1 summoned no adds (${hounds})`);

  await g.eval(() => window.__wake());
} finally {
  console.log('console errors', JSON.stringify(g.errors.slice(0, 8)));
  await g.close();
}

// death mid-attack (fresh boot per case): nothing left behind, reward flow = 1 pedestal + heart + trapdoor
const deaths = quick ? [['hellfire_leap', 3.3], ['charge', 0.6]] : [['hellfire_leap', 3.3], ['hellfire_leap', 4.2], ['charge', 0.6], ['herd_stampede', 1.0], ['fire_breath', 0.6], ['magma_stomp', 0.6]];
for (const [name, off] of deaths) {
  const g2 = await boot(query, { items: [], god: true });
  try {
    await toBoss(g2); await hideCards(g2); await g2.eval(SETUP);
    const r = await g2.eval(([n, o]) => {
      const T = window.__T; T.force(n, 2); window.__ff(Math.round(o * 60));
      const b = T.boss(), airborne = !!b.airborne; b.hp = 1; b.takeHit(9999, { x: b.x, y: b.y, angle: 0, kind: 'test' });
      window.__ff(20); const early = T.state();
      window.__ff(400);
      const s = window.__dw.scene, room = s.room, st = room.state;
      return { airborne, early, boss: !!T.boss(), ped: (st.pedestals || []).length, picks: (room.pickups || []).map((p) => p.type || p.id || p.kind || '?').join(','), trap: !!room.trapdoor, cleared: !!st.cleared, late: T.state(), lanes: window.__T.state().lanes, fires: room._hz && room._hz.fires ? room._hz.fires.order.length : 0 };
    }, [name, off]);
    const tag = `death ${name}+${off}s (airborne=${r.airborne})`;
    if (r.airborne) { ok(!r.early.dying && r.early.hp === 1, `${tag}: airborne boss took a hit`); console.log(tag, 'airborne: hit correctly ignored'); continue; }
    ok(r.early.dying && !r.early.tel && r.early.lanes === 0 && !r.early.charging && !r.early.airborne && r.early.air === 0, `${tag}: leftovers ${JSON.stringify(r.early)}`);
    ok(!r.boss && r.ped === 1 && r.trap && r.cleared, `${tag}: reward flow ${JSON.stringify({ boss: r.boss, ped: r.ped, picks: r.picks, trap: r.trap, cleared: r.cleared })}`);
    ok(/heart/.test(r.picks), `${tag}: no heart pickup (${r.picks})`);
    ok(r.late.lanes === 0 && r.late.gh === 0, `${tag}: hazards linger ${JSON.stringify(r.late)}`);
    console.log(tag, 'ok?', JSON.stringify({ ped: r.ped, picks: r.picks, trap: r.trap, fires: r.fires }));
    if (g2.errors.length) { console.log('errors', g2.errors.slice(0, 5)); fails.push(tag + ' console errors'); }
  } finally { await g2.close(); }
}
console.log(fails.length ? `FAILED ${fails.length}` : 'ALL OK');
process.exit(fails.length ? 1 : 0);
