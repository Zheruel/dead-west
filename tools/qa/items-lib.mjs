// Items QA helper: launch and start a run without depending on the (in flux) menu UI.
import { launch } from './harness.mjs';
export async function boot(name, query = '?debug=1&seed=42') {
  const g = await launch({ query, name, quiet: true });
  g.page.on('framenavigated', (f) => { if (f === g.page.mainFrame()) console.log('NAV', f.url()); });
  g.page.on('error', (e) => console.log('PAGE CRASH', e.message));
  await g.page.waitForFunction(() => window.__game && window.__game.scene.isActive('Menu'), { timeout: 60000 });
  await g.eval(() => { window.__game.scene.stop('Menu'); window.__game.scene.start('Game'); });
  await g.page.waitForFunction(() => window.__dw && window.__dw.player, { timeout: 60000 });
  await g.wait(1500);
  return g;
}
