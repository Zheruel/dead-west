// QA-3 helpers (test only). boot(query) -> g with g.play(char, mode) starting a Game run directly from the menu.
import { launch } from './harness.mjs';
export async function boot(query = '?debug=1&seed=7&char=gunslinger', opts = {}) {
  const g = await launch({ query, name: 'qa3', quiet: true, ...opts });
  g.play = async (char = 'gunslinger', mode = 'normal') => {
    await g.eval((c, m) => window.__game.scene.getScene('Menu').go('Game', { char: c, mode: m }), char, mode);
    await g.page.waitForFunction(() => window.__game.scene.isActive('Game') && window.__dw && window.__dw.player, { timeout: 60000 });
    await g.wait(1500);
    await g.settle();
  };
  g.settle = async () => { await g.page.waitForFunction(() => { const s = window.__dw && window.__dw.scene; return s && !s.cutscene && !s.transitioning; }, { timeout: 30000 }).catch(() => {}); await g.wait(400); };
  g.shotDir = 'v2/';
  return g;
}
