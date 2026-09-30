// INT-3: Codex LORE REREAD hands off to the Cutscene scene and back. `node tools/qa/int3-reread.mjs`
import { launch } from './harness.mjs';
const g = await launch({ query: '?debug=1&seed=42', name: 'int3r' });
await g.eval(async () => { const { Save } = await import('/src/core/Save.js'); const c = Save.get().codex; c.lore.lore_prologue = 1; c.lore.lore_page_two = 1; window.__game.scene.start('Codex', { tab: 'lore' }); });
await g.wait(900);
await g.shot('int3r-lore');
await g.eval(() => { const c = window.__game.scene.getScene('Codex'); c.setSel(c.entries.findIndex((e) => e.stage >= 1)); });
await g.shot('int3r-sel');
await g.tap('Enter'); await g.wait(2500);
console.log('active', JSON.stringify(await g.eval(() => window.__game.scene.getScenes(true).map((s) => s.scene.key))));
await g.shot('int3r-cutscene');
await g.eval(() => window.__game.story && window.__game.story.skip && window.__game.story.skip());
await g.wait(2500);
console.log('after', JSON.stringify(await g.eval(() => { const c = window.__game.scene.getScene('Codex'); return { active: window.__game.scene.getScenes(true).map((s) => s.scene.key), tab: c && c.tabId }; })));
console.log('errors', g.errors.length, g.errors.slice(0, 5));
await g.close();
