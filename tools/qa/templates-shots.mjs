// FE-T2 visual pass: builds each new template as a room (patching a normal room's `template` in the live floor) and screenshots it into art/qa/t2-<id>.png.
//   node tools/qa/templates-shots.mjs [--ids=f6_n01,champion_f6] [--wait=1600] [--noassets]
import { launch } from './harness.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const ids = (opt('ids', '') || '').split(',').filter(Boolean);
const g = await launch({ query: `?debug=1&seed=42${args.includes('--noassets') ? '&noassets=1' : ''}`, name: 't2-shots', quiet: true });
await g.startRun();
await g.eval(() => { window.__dw.api.godMode(true); });
await g.wait(6500); // the floor-1 intro card runs on wall-clock tweens
const floorOf = (id) => (/^f(\d)_/.test(id) ? +id[1] : /^champion_f(\d)/.test(id) ? +id.slice(-1) : 0);
const list = ids.length ? ids : [
  ...Array.from({ length: 14 }, (_, i) => `f6_n${String(i + 1).padStart(2, '0')}`), 'f6_boss',
  'f1_17', 'f1_18', 'f2_17', 'f3_17', ...Array.from({ length: 6 }, (_, i) => `champion_f${i + 1}`),
  'event_card_sharp', 'event_wishing_well', 'event_gravedigger', 'event_preacher', 'event_snake_oil', 'event_quick_draw',
  'crossroads_a', 'vault_a', 'secret_hand', 'secret_cache', 'secret_shrine',
];
const kindOf = (id) => (/^champion/.test(id) ? 'champion' : /^event/.test(id) ? 'event' : /^crossroads/.test(id) ? 'crossroads' : /^vault/.test(id) ? 'supersecret' : /^secret/.test(id) ? 'secret' : /boss/.test(id) ? 'boss' : 'normal');
// fast-forward in game time (the headless render loop runs ~6 fps, so game seconds are stepped by hand); the last step is rendered for the screenshot
await g.eval(() => {
  window.__t = window.__game.loop.now;
  window.__ff = (sec) => {
    const game = window.__game, scs = game.scene.getScenes(false), vis = scs.map((s) => s.sys.settings.visible);
    game.loop.sleep();
    const n = Math.round(sec * 60);
    scs.forEach((s) => (s.sys.settings.visible = false));
    for (let i = 0; i < n; i++) {
      if (window.__dw && window.__dw.scene.fx) window.__dw.scene.fx.hitStopUntil = 0;
      if (i === n - 1) scs.forEach((s, k) => (s.sys.settings.visible = vis[k]));
      window.__t += 16.667; game.step(window.__t, 16.667);
    }
  };
  window.__wake = () => window.__game.loop.wake();
});
const FF = +opt('ff', 3.6);
let curFloor = 0;
for (const id of list) {
  const f = floorOf(id) || (/^(event|crossroads|vault|secret)/.test(id) ? 6 : 1);
  if (f !== curFloor) { await g.eval((f) => { window.__wake(); window.__dw.api.setFloor(f); }, f); await g.wait(400); await g.eval(() => window.__ff(4)); await g.wait(6500); curFloor = f; }
  const kind = kindOf(id);
  await g.eval((a) => {
    const sc = window.__dw.scene, m = sc.roomMgr;
    const def = m.floor.rooms.find((r) => (r._orig || r.type) === 'normal' && r.dist >= 2);
    def._orig = def._orig || 'normal';
    for (const k of ['template', 'mini', 'event', 'variant', 'pocket', 'mod']) delete def[k];
    const extra = a.kind === 'champion' ? { mini: ['ol_fury', 'hangman', 'motherlode', 'ash_deacon', 'stoker', 'head_bouncer'][+a.id.slice(-1) - 1] } : a.kind === 'event' ? { event: a.id.slice(6) } : a.kind === 'secret' ? { variant: { secret_hand: 'dead_mans_hand', secret_cache: 'cache', secret_shrine: 'shrine' }[a.id] } : {};
    Object.assign(def, { type: a.kind === 'normal' ? 'normal' : a.kind, template: a.id, ...extra });
    delete m.states[def.id];
    window.__dw.player.godMode = true;
    window.__wake();
    m.jump(def.id, null);
  }, { id, kind });
  await g.wait(300);
  await g.eval((ff) => window.__ff(ff), kind === 'normal' || kind === 'boss' ? FF : 1.5);
  await g.wait(250);
  await g.shot(`t2-${id}`);
}
console.log('errors:', g.errors.length, g.errors.slice(0, 5));
await g.close();
