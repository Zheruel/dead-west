// QA-3 v: Codex with everything unlocked (Save seeded in-page, not persisted by hand).
import { boot } from './qa3v-lib.mjs';
const g = await boot('?debug=1&seed=9&unlockall=1');
const n = await g.eval(async () => {
  const { Save } = await import('/src/core/Save.js');
  const { ENEMY_META } = await import('/src/enemies/index.js');
  const { BOSS_META } = await import('/src/bosses/index.js');
  const { allItems } = await import('/src/items/index.js');
  const { LORE } = await import('/src/meta/lore.js');
  const c = Save.get().codex; let i = 0;
  for (const id of Object.keys(ENEMY_META)) c.enemies[id] = { seen: 1, kills: [0, 5, 20][i++ % 3] };
  i = 0; for (const id of Object.keys(BOSS_META)) c.bosses[id] = { seen: 1, killed: i % 3 ? 2 : 0, bestFight: 61.2, noHit: i++ % 2 };
  i = 0; for (const d of allItems()) c.items[d.id] = 1 + (i++ % 3);
  for (const l of LORE) c.lore[l.id] = Date.now();
  return { e: Object.keys(c.enemies).length, b: Object.keys(c.bosses).length, it: Object.keys(c.items).length, l: LORE.length };
});
console.log(JSON.stringify(n));
const key = async (k, ms = 350) => { await g.tap(k, 60); await g.wait(ms); };
for (const t of ['bestiary', 'relics', 'outlaws', 'lore', 'deeds', 'record']) {
  await g.go('Codex', { tab: t }); await g.wait(900); await g.S(`cx_${t}_0`);
  if (t === 'record' || t === 'deeds') continue;
  for (let i = 0; i < 5; i++) await key('ArrowRight', 150);
  await key('ArrowDown'); await g.S(`cx_${t}_1`);
  for (let i = 0; i < 2; i++) await key('ArrowDown', 200);
  await g.S(`cx_${t}_2`);
  await key('z', 700); await g.S(`cx_${t}_p2`);
  await key('ArrowDown'); await key('ArrowRight'); await g.S(`cx_${t}_p2b`);
}
console.log('errors', JSON.stringify(g.errors.slice(0, 5)));
await g.close();
