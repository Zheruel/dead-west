// QA-3 v: ledger/text cards, floor/chapter cards, End scene (death/complete a/true, poster + ledger page).
import { boot } from './qa3v-lib.mjs';
const g = await boot('?debug=1&seed=13&unlockall=1');
// 1. ledger + text cards
for (const id of ['ledger_gunslinger', 'ledger_preacher', 'ledger_hunter', 'ledger_queen', 'card_f4_f5']) {
  await g.go('Menu'); await g.wait(800);
  await g.eval((id) => window.__game.story.play(id, { char: id.split('_')[1], clean: false, hell: false }), id);
  await g.wait(1200); await g.S(`cd_${id}_a`);
  await g.wait(2200); await g.S(`cd_${id}_b`);
  await g.eval(() => { try { window.__game.story.skip(); } catch {} }); await g.wait(600);
}
// 2. floor/chapter cards
await g.go('Menu'); await g.wait(800);
await g.play('gunslinger'); 
await g.eval(() => window.__dw.api.godMode(true));
for (const f of [1, 2, 3, 4, 5, 6]) {
  await g.eval((f) => { if (f === 1) return; window.__dw.api.setFloor(f); }, f);
  for (const t of [500, 1300, 2600]) { await g.wait(t === 500 ? 500 : 800); await g.S(`fc_f${f}_${t}`); }
  await g.settle();
}
console.log('errors card', JSON.stringify(g.errors));
// 3. End scene variants
async function end(tag, fn, pre) {
  await g.go('Menu'); await g.wait(800);
  await g.play('preacher');
  await g.eval(() => { const a = window.__dw.api; a.godMode(true); a.setFloor(4); a.setCoins(37); a.giveItems(['hex_bag', 'rattle_fang', 'bronco_boots']); });
  await g.wait(1200);
  if (pre) await g.eval(pre);
  await g.eval(fn);
  await g.wait(4500); await g.S(`end_${tag}_1`);
  await g.wait(3000); await g.S(`end_${tag}_1b`);
  await g.page.keyboard.press('Space'); await g.wait(2500); await g.S(`end_${tag}_2`);
  await g.page.keyboard.press('Space'); await g.wait(1500);
}
await end('death', () => { const s = window.__dw.scene; s.run.kills = 87; s.run.time = 754; window.__dw.api.die(); });
await end('death_boss', () => { const s = window.__dw.scene; s.run.kills = 240; s.run.time = 2201; s.endRun('death'); });
await end('complete_a', () => { const s = window.__dw.scene; s.run.kills = 300; s.run.time = 2900; s.run.ending = 'a'; s.endRun('complete'); });
await end('complete_true', () => { const s = window.__dw.scene; s.run.kills = 320; s.run.time = 3100; s.run.ending = 'true'; s.endRun('complete'); });
console.log('errors', JSON.stringify(g.errors));
await g.close();
