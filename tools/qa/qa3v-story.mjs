// QA-3 v: cutscene panels + captions. node tools/qa/qa3v-story.mjs [ids] [char]   -> art/qa/v2/cs_<id>_<panel>.png (A/B pair sheet)
import { boot, sheet } from './qa3v-lib.mjs';
const g = await boot('?debug=1&seed=9&unlockall=1');
const all = await g.eval(async () => (await import('/src/data/story/cutscenes.js')).CUTSCENE_IDS);
const ids = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : all;
const char = process.argv[3] || 'gunslinger';
console.log('ids', all.join(','));
for (const id of ids) {
  await g.go('Menu'); await g.wait(1200);
  await g.eval((id, char) => window.__game.story.play(id, { char, clean: false, hell: false }), id, char);
  await g.wait(1500);
  let last = -1, guard = 0, shots = 0;
  while (guard++ < 400) {
    const st = await g.eval(() => window.__game.story.state());
    if (!st || st.finished) break;
    if (st.panel !== last) {
      last = st.panel; const t0 = Date.now();
      await g.wait(900);
      const a = `art/qa/v2/tmp_cs_${id}_${last}_a.png`; await g.page.screenshot({ path: a });
      // second shot when typing is done (or 3.5 s), still inside the panel
      for (let i = 0; i < 14; i++) { const s2 = await g.eval(() => window.__game.story.state()); if (!s2 || s2.panel !== last || s2.typed) break; await g.wait(250); }
      const b = `art/qa/v2/tmp_cs_${id}_${last}_b.png`; await g.page.screenshot({ path: b });
      sheet(`cs_${id}_${last}`, [a, b], 2, 720); shots++;
      await g.eval(() => window.__game.story.advance()); await g.wait(300);
    } else { await g.wait(500); if (guard % 12 === 0) await g.eval(() => window.__game.story.advance()); }
  }
  console.log(id, 'panels shot', shots, 'errors', g.errors.length);
}
console.log('errors', g.errors.slice(0, 5));
await g.close();
