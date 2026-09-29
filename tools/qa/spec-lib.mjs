// Spec-audit helpers: launch + fixed-step sim (window.__step(n, ms)) so long scenarios don't depend on headless fps.
import { launch } from './harness.mjs';
export async function boot(query = '?debug=1&seed=42', opts = {}) {
  const g = await launch({ query, name: 'spec', quiet: true, ...opts });
  await g.startRun();
  await g.eval(() => {
    window.__step = (n = 1, ms = 33.3) => {
      const sc = window.__dw.scene;
      let now = performance.now();
      for (let i = 0; i < n; i++) { sc.fx.hitStopUntil = 0; sc.update(now += ms, ms); }
    };
    // wait until the current room has finished its scripted entry (onEntered) using real time; helper just checks flags
  });
  return g;
}
