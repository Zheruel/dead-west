// QA-3 v: meta UI screens. node tools/qa/qa3v-ui.mjs [sections: menu,charsel,daily,board,codex,end,pause] [query]
import { boot } from './qa3v-lib.mjs';
const secs = (process.argv[2] || 'menu,charsel,daily,board,codex').split(',');
const q = process.argv[3] || '?debug=1&seed=9&unlockall=1';
const tag = process.argv[4] || 'ui';
const g = await boot(q);
const key = async (k, ms = 400) => { await g.tap(k, 60); await g.wait(ms); };
if (secs.includes('menu')) {
  await g.wait(2500); await g.S(`${tag}_menu_a`);
  await g.wait(4000); await g.S(`${tag}_menu_b`);
  await g.eval(() => window.__game.scene.getScene('Menu').openOptions()); await g.wait(800); await g.S(`${tag}_menu_options`);
  await key('ArrowDown'); await key('ArrowDown'); await g.S(`${tag}_menu_options2`);
  await key('Escape', 600);
  await g.eval(() => { const m = window.__game.scene.getScene('Menu'); if (m.modal) m.closeModal && m.closeModal(); m.openCredits(); }); await g.wait(800); await g.S(`${tag}_menu_credits1`);
  await key('ArrowRight', 600); await g.S(`${tag}_menu_credits2`);
  await key('Escape', 600);
  await g.go('Menu'); await g.wait(2000);
  await key('ArrowDown'); await g.S(`${tag}_menu_sel2`);
}
if (secs.includes('charsel')) {
  await g.go('CharSelect'); await g.wait(1200);
  for (let i = 0; i < 4; i++) { await g.S(`${tag}_charsel_${i}`); await key('ArrowRight', 900); }
  await key('ArrowDown', 700); await g.S(`${tag}_charsel_mode2`);
}
if (secs.includes('daily')) { await g.go('Daily'); await g.wait(1000); await g.S(`${tag}_daily_a`); await key('ArrowRight', 700); await g.S(`${tag}_daily_b`); await key('ArrowRight', 700); await g.S(`${tag}_daily_c`); }
if (secs.includes('board')) { await g.go('Board'); await g.wait(1000); await g.S(`${tag}_board_a`); await key('ArrowRight', 700); await g.S(`${tag}_board_b`); await key('ArrowDown', 700); await g.S(`${tag}_board_c`); }
if (secs.includes('codex')) {
  for (const t of ['bestiary', 'relics', 'outlaws', 'lore', 'deeds', 'record']) {
    await g.go('Codex', { tab: t }); await g.wait(800); await g.S(`${tag}_codex_${t}_0`);
    if (t !== 'record') { await key('ArrowRight', 500); await key('ArrowDown', 500); await g.S(`${tag}_codex_${t}_1`); }
  }
}
console.log('errors', g.errors.slice(0, 5));
await g.close();
