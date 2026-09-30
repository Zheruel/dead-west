// QA-3 v: HUD variants, curse chips, toasts, synergy toast, elite nameplates, pedestal chips, pause BUILD panel.
import { boot } from './qa3v-lib.mjs';
const g = await boot('?debug=1&seed=19&unlockall=1');
await g.play('gunslinger');
const A = (fn, ...a) => g.api(fn, ...a);
await A(() => { const a = window.__dw.api; a.godMode(true); a.give(25); });
await g.wait(1500);
await g.S('hud_0_base');
// cylinder 3..8
for (const n of [3, 4, 5, 7, 8]) {
  await A((n) => { const p = window.__dw.player; p.stats.sixthEvery = n; }, n);
  await g.wait(500);
  await g.page.screenshot({ path: `art/qa/v2/hud_cyl${n}.png`, clip: { x: 0, y: 0, width: 1440, height: 130 } });
}
// hearts: many, tin
await A(() => { const p = window.__dw.player; p.maxHp = 24; p.hp = 19; p.tin = 5; if (p.recomputeStats) p.recomputeStats(); p.hp = 19; });
await g.wait(600);
await g.page.screenshot({ path: 'art/qa/v2/hud_hearts_many.png', clip: { x: 0, y: 0, width: 1440, height: 130 } });
await A(() => { const p = window.__dw.player; p.maxHp = 6; p.hp = 6; p.tin = 0; p.recomputeStats && p.recomputeStats(); p.hp = 2; });
// curses
for (const c of ['curse_debt', 'curse_dark', 'curse_rot', 'curse_lead']) await A((c) => window.__dw.api.giveCurse(c), c);
await g.wait(800);
await g.S('hud_1_curses');
await g.page.screenshot({ path: 'art/qa/v2/hud_curses_top.png', clip: { x: 0, y: 0, width: 1440, height: 260 } });
// ui toast + item banner + synergy
await A(() => window.__dw.api.giveItems(['hex_bag']));
await g.wait(900); await g.S('hud_2_item_banner');
await A(() => window.__dw.api.giveItems(['rattler_fang']));
await g.wait(1000); await g.S('hud_3_synergy_a');
await g.wait(3000); await g.S('hud_3_synergy_b');
await A(() => window.__dw.api.giveItems(['bronco_boots', 'spurs']));
await g.wait(4500); await g.S('hud_3_synergy_c');
console.log(await A(() => window.__dw.api.synergies().join(',')));
// pedestals: treasure room + shop
await A(() => { window.__dw.api.godMode(true); window.__dw.api.setFloor(2); });
await g.wait(4000);
for (const t of ['treasure', 'shop']) {
  await A((t) => window.__dw.api.jump(t), t); await g.wait(2500);
  await A(() => { const r = window.__dw.scene.room; const p = r.state.pedestals && r.state.pedestals[0]; window.__dw.player.teleport(720, 700); });
  await g.wait(800); await g.S(`hud_4_${t}_room`);
  await A(() => { const ped = (window.__dw.scene.room.pedestals || [])[0]; if (ped) window.__dw.player.teleport(ped.x, ped.y + 90); });
  await g.wait(1200); await g.S(`hud_4_${t}_near`);
}
// elite nameplates + affixes on F4
await A(() => { const a = window.__dw.api; a.setFloor(4); a.godMode(true); a.teleport('start'); });
await g.wait(4000);
await A(() => { const a = window.__dw.api; window.__dw.player.teleport(300, 620); let x = 620; for (const af of ['cursed', 'armored', 'swift', 'volatile', 'shielded', 'splitting', 'burning', 'vampiric']) { a.spawn('hellhound', x, 420 + (x % 3) * 60, { affixes: [af] }); x += 110; } });
await g.wait(1800); await g.S('hud_5_elites');
await A(() => { window.__dw.api.killAll(); window.__dw.api.spawn('hellsteer', 900, 480, { affixes: ['cursed', 'armored'] }); });
await g.wait(1500); await g.S('hud_5_elite2');
// hell mode toggle, pause + build
await A(() => window.__dw.api.killAll());
await A(() => { window.__dw.scene.pauseGame && window.__dw.scene.pauseGame(); });
await g.wait(1200); await g.S('hud_6_pause');
await g.tap('Tab', 80); await g.wait(1000); await g.S('hud_6_pause_build');
await g.tap('Tab', 80); await g.tap('Escape', 80); await g.wait(600);
console.log('errors', g.errors.slice(0, 5));
await g.close();
