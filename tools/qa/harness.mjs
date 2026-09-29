// Headless-Chrome QA harness (puppeteer-core + system Chrome, real 60 fps rAF — unlike the throttled in-app browser tab).
// Usage in a script (run from project root, dev server must be up on :5173 — `npm run dev &` or set QA_URL):
//   import { launch } from './tools/qa/harness.mjs';
//   const g = await launch({ query: '?debug=1&seed=42', name: 'my-test' });      // opens game, waits for boot
//   await g.startRun();                    // from menu → floor 1 start room (presses Enter, waits for GameScene)
//   await g.eval(() => window.__dw.api.giveItem('spurs'));   // run code in page
//   await g.hold('ArrowRight', 800);       // keyboard: hold key for ms;  g.tap('KeyE');  g.press/ release
//   await g.wait(500);  await g.shot('name');   // screenshot → art/qa/<name>.png  (view it with the Read tool)
//   g.errors  // array of console errors/pageerrors captured so far
//   await g.close();
// One Chrome per script → agents can run in parallel safely (each picks its own user-data-dir and, by default, its own Vite server).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';

const CHROME = process.env.QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.QA_URL || 'http://127.0.0.1:5173/';

const KEYS = { ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', Space: 'Space', Enter: 'Enter', Escape: 'Escape' };

// isolated (default): spins up a private Vite server (random port, HMR + file-watching OFF) so other people's edits/reloads can't
// reset your page mid-test; it serves the code as of launch time. Pass isolated:false to use the shared dev server (QA_URL / :5173).
export async function launch({ query = '?debug=1', name = 'qa', width = 1440, height = 960, headless = 'new', quiet = false, baseUrl = null, isolated = (process.env.QA_SHARED || baseUrl) ? false : true } = {}) {
  let vite = null, base = baseUrl || BASE; // baseUrl: test an already-running server, e.g. a `vite preview` of dist/ (see prod-check.mjs)
  if (isolated) {
    vite = await createServer({ server: { port: 0, host: '127.0.0.1', hmr: false, watch: null, strictPort: false }, logLevel: 'error', clearScreen: false });
    await vite.listen();
    base = `http://127.0.0.1:${vite.httpServer.address().port}/`;
  }
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-qa-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless, userDataDir,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', `--window-size=${width},${height}`],
    defaultViewport: { width, height, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  const errors = [], logs = [];
  page.on('console', (m) => { const t = m.text(); logs.push(`[${m.type()}] ${t}`); if (m.type() === 'error') errors.push(t); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + (e.stack || e.message)));
  page.on('requestfailed', (r) => { if (!/favicon/.test(r.url())) errors.push('REQFAIL ' + r.url()); });
  await page.goto(base + query, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Menu'), { timeout: 120000 }).catch(() => {});
  const shotDir = path.resolve('art/qa'); fs.mkdirSync(shotDir, { recursive: true });
  const g = {
    page, browser, errors, logs, base,
    eval: (fn, ...a) => page.evaluate(fn, ...a),
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    press: (k) => page.keyboard.down(k), release: (k) => page.keyboard.up(k),
    tap: async (k, ms = 60) => { await page.keyboard.down(k); await g.wait(ms); await page.keyboard.up(k); },
    hold: async (k, ms) => { await page.keyboard.down(k); await g.wait(ms); await page.keyboard.up(k); },
    holdMany: async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await g.wait(ms); for (const k of keys) await page.keyboard.up(k); },
    click: (x, y) => page.mouse.click(x, y),
    shot: async (n = name) => { const f = path.join(shotDir, `${n}.png`); await page.screenshot({ path: f }); if (!quiet) console.log('shot', f); return f; },
    // canvas-only (1440x960 logical) screenshot regardless of window size
    dw: () => page.evaluate(() => window.__dw && { scene: window.__dw.scene && window.__dw.scene.constructor.name, state: window.__dw.api.state && window.__dw.api.state() }),
    startRun: async () => {
      await g.tap('Enter', 80);
      await page.waitForFunction(() => window.__game.scene.isActive('Game'), { timeout: 60000 });
      await g.wait(1200);
    },
    close: async () => { await browser.close(); if (vite) await vite.close(); try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {} },
  };
  return g;
}
