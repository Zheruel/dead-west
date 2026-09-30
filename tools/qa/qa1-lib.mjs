// QA-1 helpers: launch with an optional pre-seeded save, wait for scenes, tiny assertion log.
import { launch } from './harness.mjs';

export const results = [];
export function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);
  return !!ok;
}

export async function open(query = '', { save = undefined, v1 = undefined, raw = undefined, width = 1440, height = 960, storage = 'ok' } = {}) {
  const g = await launch({ query, name: 'qa1', quiet: true, width, height });
  g.warns = [];
  g.dialogs = [];
  g.page.on('console', (m) => { if (m.type() === 'warning') g.warns.push(m.text()); });
  g.page.on('dialog', async (d) => { g.dialogs.push({ type: d.type(), msg: d.message() }); if (g.dialogAnswer != null && d.type() === 'prompt') await d.accept(g.dialogAnswer); else await d.dismiss(); });
  if (save !== undefined || v1 !== undefined || raw !== undefined || storage !== 'ok') await reseed(g, query, { save, v1, raw, storage });
  return g;
}

/** Replace localStorage contents (without the old page's beforeunload overwriting them) and reload. */
export async function reseed(g, query, { save, v1, raw, storage = 'ok' } = {}) {
  await g.page.evaluate(async (save, v1, raw) => {
    const { Save } = await import('/src/core/Save.js');
    Save._drop();
    localStorage.clear();
    if (save !== undefined) localStorage.setItem('deadwest.save.v2', typeof save === 'string' ? save : JSON.stringify(save));
    if (v1 !== undefined) localStorage.setItem('deadwest.save.v1', typeof v1 === 'string' ? v1 : JSON.stringify(v1));
    if (raw !== undefined) for (const [k, v] of Object.entries(raw)) localStorage.setItem(k, v);
  }, save, v1, raw);
  if (storage === 'throw') {
    await g.page.evaluateOnNewDocument(() => {
      const boom = () => { throw new DOMException('denied', 'SecurityError'); };
      Object.defineProperty(window, 'localStorage', { get: boom, configurable: true });
    });
  } else if (storage === 'full') {
    await g.page.evaluateOnNewDocument(() => {
      Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); };
    });
  }
  await g.page.goto(g.base + (query || ''), { waitUntil: 'domcontentloaded' });
  await g.page.waitForFunction(() => window.__game && window.__game.scene.isActive('Menu'), { timeout: 120000 });
  await g.wait(600);
}

export const active = (g) => g.eval(() => window.__game.scene.getScenes(true).map((s) => s.sys.settings.key));
export async function waitScene(g, key, ms = 30000) {
  try { await g.page.waitForFunction((k) => window.__game.scene.isActive(k), { timeout: ms }, key); return true; } catch (e) { return false; }
}
export const saveOf = (g) => g.eval(async () => { const { Save } = await import('/src/core/Save.js'); return JSON.parse(JSON.stringify(Save.get())); });
export const storedOf = (g) => g.eval(() => { try { return JSON.parse(localStorage.getItem('deadwest.save.v2')); } catch (e) { return null; } });
export const done = (g) => { const bad = results.filter((r) => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} passed; console errors: ${g ? g.errors.length : '-'}`); for (const b of bad) console.log('FAILED:', b.name, b.detail); };
