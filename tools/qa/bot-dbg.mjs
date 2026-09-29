// Debug: node tools/qa/bot-dbg.mjs <seed> <item|none> <simT0> [samples]   runs the human bot to simT0 then prints enemy/player state each ~10 s
import { launch } from './harness.mjs';
import fs from 'node:fs';
const [seed, item, t0, ns = 12] = process.argv.slice(2);
const src = fs.readFileSync(new URL('./bot-page.js', import.meta.url), 'utf8');
const g = await launch({ query: `?debug=1&seed=${seed}`, name: 'botdbg', quiet: true });
await g.startRun();
await g.eval((src, item) => { window.__game.sound.mute = true; window.__t = window.__game.loop.now; (0, eval)(src); const a = window.__dw.api; if (item !== 'none') a.giveItem(item); a.heal(); window.__botInstall({ aim: 'free', skill: 'human' }); }, src, item);
for (let i = 0; i < 400; i++) { const r = await g.eval((t0) => { window.__botRun(600); return window.__bot.simT >= t0 || !!window.__bot.result; }, +t0); if (r) break; }
for (let i = 0; i < +ns; i++) {
  console.log(JSON.stringify(await g.eval(() => { window.__botRun(600); const sc = window.__game.scene.getScene('Game'); const p = sc.player; return { t: Math.round(window.__bot.simT), p: [Math.round(p.x), Math.round(p.y), p.hp], goal: window.__bot.goal, en: sc.enemies.filter((e) => e.alive).map((e) => [e.id, Math.round(e.x), Math.round(e.y), Math.round(e.hp), e.state || '', e.fear ? 'fear' : '', e.frozen ? 'frz' : '']) }; })));
}
await g.close();
