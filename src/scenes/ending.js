// Story glue (STORY_PRESENTATION s5-s6, ARCH_V2 s6): endings, the Sixth Bullet finale, run-start story cards, and the runtime registration of the
// Cutscene / Credits scenes (main.js does not list them; flow.js loads this module eagerly through import.meta.glob).
//
//   runEnding(scene, payload)   flow.endGame hand-off after `game:ending`: end_a | end_true -> Credits -> scene.endRun('complete'). Daily / contract runs skip
//                               every cutscene. Any failure ends in endRun (never a soft lock).
//   trueFinale(scene)           flow.endGame hook (world already frozen): Hell + no deals -> the scripted Sixth Bullet finale (returns true), else false.
//   window.__game.story         { play(id, ctx), credits(ending), skip(), advance(), state(), ids, runStart(force) } for QA; ?cutscene=<id>&char=&clean=1&hell=1.
//   run:started shim            intro (first gunslinger ride) / intro_hell (each Hell ride) / ledger_<rider> (a rider's first two rides, or a skipped intro)
//                               as an overlay while the world is frozen, then the floor card is replayed. Never on CONTINUE, daily or contract.
import { W, H, DEPTH, FONT_TITLE, FONT_BODY, FLOORS } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx, Music, Ambience } from '../core/Audio.js';
import { bus } from '../core/events.js';
import { Save } from '../core/Save.js';
import { qs, flag } from '../core/util.js';
import { CUTSCENE_IDS } from '../data/story/cutscenes.js';
import CutsceneScene from './CutsceneScene.js';
import CreditsScene from './CreditsScene.js';

const storyMode = (run) => !!run && (run.mode === 'normal' || run.mode === 'hell');
const ctxOf = (run) => ({
  char: (run && run.char) || 'gunslinger',
  hell: !!run && run.mode === 'hell',
  clean: !!run && !(run.dealsMade > 0) && !(run.deals && run.deals.length),
});
const hasScene = (scene, key) => !!(scene && scene.scene && scene.scene.manager && scene.scene.manager.getScene(key));
const once = (fn) => { let d = false; return (...a) => { if (d) return; d = true; return fn(...a); }; };

// ==================================================================================================== endings
/**
 * `game:ending` hand-off. payload.ending: 'devil_defeated' (ending A) | 'true' (after the finale). Always finishes with scene.endRun('complete')
 * (or 'contract' for a contract run), whatever fails on the way.
 */
export function runEnding(scene, payload = {}) {
  const run = scene.run;
  const ending = payload.ending === 'true' ? 'true' : 'a';
  if (run) run.ending = ending; // GameScene.endRun / Meta read it
  const finish = once(() => { try { scene.endRun(run && run.mode === 'contract' ? 'contract' : 'complete'); } catch (e) { console.warn('[ending] endRun failed', e); } });
  if (!run || !storyMode(run)) { // daily / contract: results poster only, no story
    if (run && run.mode === 'contract') run.goalReached = true;
    finish();
    return;
  }
  scene.cutscene = true;
  scene.timeScale = 1;
  const g = scene;
  const toCredits = () => {
    if (!hasScene(g, 'Credits')) { finish(); return; }
    try { g.scene.launch('Credits', { ending, overlay: true, onDone: finish }); } catch (e) { console.warn('[ending] credits failed', e); finish(); }
  };
  if (!hasScene(g, 'Cutscene')) { toCredits(); return; }
  const cb = once(toCredits);
  try {
    g.scene.launch('Cutscene', { id: ending === 'true' ? 'end_true' : 'end_a', ctx: ctxOf(run), overlay: true, from: payload.fromWhite ? 'white' : undefined, onDone: cb, next: { callback: cb } });
  } catch (e) { console.warn('[ending] cutscene failed', e); toCredits(); return; }
  g.time.delayedCall(420000, finish); // last-resort fail-safe: cutscene + credits can never hold the run forever
}

// ==================================================================================================== the Sixth Bullet
const FIX = (o) => { o.setScrollFactor(0); o.__noSnap = true; return o; };
const PAGE = { x: 720, y: 520 }; // x is set in trueFinale: the page hangs on the far side of the room from the rider
const SHOTS = [1.0, 1.45, 1.9, 2.35, 2.8]; // seconds after the finale starts: five bullets that pass through the page
const SIXTH_AT = 3.7;

/** Scratch stand-in / the live boss: the sprite Scratch kneels on. */
function scratchActor(scene) {
  const live = (scene.enemies || []).find((e) => e && e.id === 'scratch' && e.alive && e.sprite);
  if (live) return { obj: live.sprite, live: true };
  const sp = Assets.makeSprite(scene, PAGE.x, PAGE.y + 110, 'boss_scratch_idle'); // bottom-anchored: crouches behind the page, head and horns above it
  FIX(sp).setDepth(DEPTH.actors + 20).setScale(1.6).setAlpha(0);
  return { obj: sp, live: false };
}

function makePage(scene) {
  const c = FIX(scene.add.container(PAGE.x, PAGE.y).setDepth(DEPTH.fx + 40).setAlpha(0));
  const glow = scene.textures.exists('glow') ? scene.add.image(0, 0, 'glow').setTint(0xff3a20).setAlpha(0.5).setScale(3.4).setBlendMode('ADD') : null;
  if (glow) c.add(glow);
  const g = scene.add.graphics();
  g.fillStyle(0x120c0a, 0.5); g.fillRoundedRect(-124, -158, 260, 340, 10);
  g.fillStyle(0xd9c39a, 1); g.fillRoundedRect(-130, -170, 260, 340, 10);
  g.lineStyle(4, 0x3a2418, 1); g.strokeRoundedRect(-130, -170, 260, 340, 10);
  g.lineStyle(3, 0x8a1c1c, 0.9); g.strokeRoundedRect(-116, -156, 232, 312, 6);
  for (let k = 0; k < 11; k++) { g.fillStyle(0x6b4423, 0.55); g.fillRect(-98, -104 + k * 19, 196 - ((k * 37) % 3) * 34, 4); }
  g.fillStyle(0x8a1c1c, 1); g.fillCircle(0, 128, 20);
  g.lineStyle(2, 0x120c0a, 0.7); g.strokeCircle(0, 128, 20);
  c.add(g);
  c.add(scene.add.text(0, -136, 'CONTRACT', { fontFamily: FONT_TITLE, fontSize: '26px', color: '#8a1c1c' }).setOrigin(0.5));
  c.setScale(1.05);
  return c;
}

/**
 * Sixth Bullet finale (s6.6): Scratch kneels behind the floating contract; five bullets pass through the page, the sixth (gold) tears it.
 * Eligible = Hell + no deals. Returns true when it took over (flow.endGame then does nothing more).
 */
export function trueFinale(scene) {
  const run = scene.run;
  if (!run || !run.trueEligible || scene.trueFinaleStarted) return false;
  scene.trueFinaleStarted = true;
  scene.cutscene = true;
  scene.timeScale = 1;
  const p = scene.player;
  PAGE.x = p.x < 720 ? 1000 : 440;
  bus.emit('story:trueFinale', {});
  try { Music.stop(500); } catch (e) { /* */ }
  Sfx.play('clock_tick', { vol: 0.8, gap: 0 });
  const t = scene.time;
  const cyl = p.cylinder;
  if (p.stats) p.stats.sixthEvery = 6; // the story counts six chambers, whatever the build
  if (cyl) { cyl.max = 6; cyl.loaded = 6; }

  const actor = scratchActor(scene);
  const page = makePage(scene);
  const bark = FIX(scene.add.text(PAGE.x, 222, 'Nobody hurts a man who holds the paper!', { fontFamily: FONT_BODY, fontSize: '30px', color: '#e8dcc0', stroke: '#120c0a', strokeThickness: 6 }).setOrigin(0.5).setDepth(DEPTH.ui - 30).setAlpha(0));
  const six = FIX(scene.add.text(PAGE.x, 800, 'SIX.', { fontFamily: FONT_TITLE, fontSize: '110px', color: '#e8dcc0', stroke: '#120c0a', strokeThickness: 14 }).setOrigin(0.5).setDepth(DEPTH.ui - 30).setAlpha(0));
  const gold = FIX(scene.add.rectangle(W / 2, H / 2, W, H, 0xffd060, 0).setDepth(DEPTH.ui - 5));
  const white = FIX(scene.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(DEPTH.ui - 4));

  // scene: page hovers, Scratch kneels, the barked line, the caption
  scene.tweens.add({ targets: page, alpha: 1, duration: 500 });
  scene.tweens.add({ targets: page, y: PAGE.y - 10, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  if (!actor.live) {
    scene.tweens.add({ targets: actor.obj, alpha: 1, duration: 600 });
    actor.obj.setTint(0x8a7060);
    scene.tweens.add({ targets: actor.obj, scaleY: actor.obj.scaleY * 0.93, duration: 900, ease: 'Sine.easeOut' });
  }
  scene.tweens.add({ targets: bark, alpha: 1, duration: 400, delay: 300 });
  scene.tweens.add({ targets: six, alpha: 1, duration: 500, delay: 200 });
  Sfx.play('piano_sting', { vol: 0.5, rate: 0.7, gap: 0 });

  const muzzle = () => ({ x: p.x + 26, y: p.y - 44 });
  const bullet = (sixth) => {
    const m = muzzle();
    const im = Assets.makeCell(scene, m.x, m.y, 'projectiles', sixth ? 'bullet_crit' : 'bullet_player');
    FIX(im).setDepth(DEPTH.fx + 60).setScale(sixth ? 1.7 : 1.15);
    if (sixth) im.setTint(0xffc040);
    const a = Math.atan2(PAGE.y - m.y, PAGE.x - m.x);
    im.setRotation(a);
    return { im, m, a };
  };
  const shoot = (sixth, onPage) => {
    const { im, m, a } = bullet(sixth);
    Sfx.play(sixth ? 'shoot_crit' : 'shoot', { vol: sixth ? 1 : 0.8, gap: 0 });
    if (scene.fx) { scene.fx.muzzle(m.x, m.y, a, sixth ? 1.5 : 1); scene.fx.smoke(m.x, m.y, sixth ? 3 : 1, sixth); scene.fx.shake(sixth ? 0.007 : 0.003, sixth ? 160 : 70); }
    const d1 = Math.hypot(PAGE.x - m.x, PAGE.y - m.y);
    scene.tweens.add({
      targets: im, x: PAGE.x, y: PAGE.y, duration: (d1 / (sixth ? 1100 : 1700)) * 1000, ease: 'Linear',
      onComplete: () => {
        onPage(im);
      },
    });
    // cylinder HUD: one chamber down per shot (no player:fired: the scripted shots must not count in the run's stats)
    if (cyl) cyl.loaded = Math.max(1, cyl.loaded - 1);
  };

  SHOTS.forEach((at, i) => {
    t.delayedCall(at * 1000, () => shoot(false, (im) => {
      Sfx.play('ricochet_ping', { vol: 0.55, rate: 1.7, gap: 0 }); // tin click: the page does not care
      if (scene.fx) scene.fx.burst(PAGE.x, PAGE.y, { color: [0xd9c39a, 0xffe090], count: 5, speed: [30, 110], life: [200, 380], scale: [1.2, 2] });
      scene.tweens.add({ targets: page, angle: (i % 2 ? -1 : 1) * 3, duration: 90, yoyo: true });
      scene.tweens.add({ targets: im, x: PAGE.x + Math.cos(im.rotation) * 700, y: PAGE.y + Math.sin(im.rotation) * 700, alpha: 0, duration: 380, onComplete: () => im.destroy() });
    }));
  });
  t.delayedCall(SIXTH_AT * 1000 - 700, () => { Sfx.play('heartbeat', { vol: 0.9, gap: 0 }); Sfx.play('clock_tick', { vol: 0.9, gap: 0 }); });
  t.delayedCall(SIXTH_AT * 1000, () => shoot(true, (im) => {
    im.destroy();
    // hit-stop 200 ms, then the page tears
    try { scene.tweens.pauseAll(); } catch (e) { /* */ }
    window.setTimeout(() => {
      try { scene.tweens.resumeAll(); } catch (e) { /* */ }
      tear();
    }, 200);
  }));

  let torn = false;
  const tear = () => {
    if (torn) return;
    torn = true;
    Sfx.play('contract_tear', { vol: 1, gap: 0 });
    Sfx.play('page_burn', { vol: 0.9, gap: 0 });
    page.setVisible(false);
    for (const dir of [-1, 1]) { // two halves fly apart and burn out
      const h = FIX(scene.add.rectangle(PAGE.x + dir * 54, PAGE.y, 140, 358, 0xd9c39a).setDepth(DEPTH.fx + 40).setStrokeStyle(4, 0x3a2418));
      scene.tweens.add({ targets: h, x: PAGE.x + dir * 420, y: PAGE.y - 160, angle: dir * 55, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => h.destroy() });
    }
    if (scene.fx) {
      scene.fx.burst(PAGE.x, PAGE.y, { color: [0xffe090, 0xffc040, 0xff5a20], count: 46, speed: [160, 620], life: [500, 1100], scale: [1.5, 3.4], gravity: 120, blend: 'ADD' });
      scene.fx.shake(0.02, 500);
    }
    scene.tweens.add({ targets: gold, alpha: 0.95, duration: 90, yoyo: true, hold: 120 }); // gold flash 300 ms
    scene.tweens.add({ targets: [bark, six], alpha: 0, duration: 200 });
    const hud = scene.scene.get && scene.scene.get('HUD');
    if (hud && hud.scene) hud.scene.setVisible(false);
    scene.tweens.add({ targets: actor.obj, alpha: 0, duration: 900, delay: 100 });
    t.delayedCall(350, () => scene.tweens.add({ targets: white, alpha: 1, duration: 1200, ease: 'Sine.easeIn', onComplete: () => conclude() })); // fade to white 1.2 s
  };

  const conclude = once(() => {
    const payload = { ending: 'true', run: run.toJSON(), character: run.char, difficulty: run.mode, seed: scene.seed, fromWhite: true };
    bus.emit('game:ending', payload);
    runEnding(scene, payload);
  });
  t.delayedCall(20000, () => { if (!torn) tear(); }); // fail-safe: the finale can never hang (no fail state, no input)
  t.delayedCall(30000, conclude);
  return true;
}

// ==================================================================================================== run-start story (intro / ledger)
/** Chain overlay cutscenes over the frozen Game scene; `done(results)` runs after the last one (or as soon as one cannot start). */
function playQueue(g, ids, ctx, done) {
  let i = 0;
  const results = [];
  const go = () => {
    if (i >= ids.length || !g.sys || !g.sys.isActive() || !hasScene(g, 'Cutscene')) { done(results); return; }
    const id = ids[i++];
    const fin = once((r) => {
      results.push({ id, skipped: !!(r && r.skipped) });
      if ((id === 'intro') && r && r.skipped && !ids.includes(`ledger_${ctx.char}`)) ids.splice(i, 0, `ledger_${ctx.char}`); // skipped intro -> the ledger card
      go();
    });
    try { g.scene.launch('Cutscene', { id, ctx, overlay: true, onDone: fin, next: { callback: fin } }); } catch (e) { console.warn('[story] cutscene failed', e); fin({ skipped: true }); }
  };
  go();
}

function afterRunStart(g, results) {
  if (!g.sys || !g.sys.isActive()) return;
  g.cutscene = false;
  try { Save.setFlag('introSeen', true); } catch (e) { /* */ }
  const floor = g.floorNum || 1;
  try { g.updateMusic({ fade: 1200 }); } catch (e) { /* */ }
  try { Ambience.play((FLOORS[floor] && FLOORS[floor].ambience) || (floor >= 3 ? 'amb_cave' : 'amb_wind')); } catch (e) { /* */ }
  const info = FLOORS[floor] || FLOORS[1];
  bus.emit('floor:intro', { floor, name: info.name, subtitle: info.subtitle, chapter: floor >= 4 ? 2 : 1 }); // the card played hidden under the overlay
}

/** Which story cards a fresh run gets. */
export function storyQueueFor({ char = 'gunslinger', mode = 'normal' } = {}) {
  if (mode === 'hell') return ['intro_hell'];
  if (char === 'gunslinger' && !Save.flag('introSeen')) return ['intro'];
  let runs = 99;
  try { runs = (Save.get().chars[char] || {}).runs || 99; } catch (e) { /* */ }
  return runs <= 2 ? [`ledger_${char}`] : [];
}

let prevFloor = 0;
/** F4 -> F5 descent: the black text card (s5.2), then the floor card that played hidden is shown again. */
function onFloorChanged({ floor } = {}) {
  const prev = prevFloor;
  prevFloor = floor || 0;
  if (!(prev === 4 && floor === 5)) return;
  const game = window.__game;
  const g = game && game.scene && game.scene.getScene('Game');
  if (!g || !g.sys || !g.sys.isActive() || g.ended || !storyMode(g.run) || !hasScene(g, 'Cutscene')) return;
  const prevCut = g.cutscene;
  g.cutscene = true;
  g.time.delayedCall(30, () => playQueue(g, ['card_f4_f5'], ctxOf(g.run), () => {
    if (!g.sys || !g.sys.isActive()) return;
    g.cutscene = prevCut;
    const info = FLOORS[5];
    bus.emit('floor:intro', { floor: 5, name: info.name, subtitle: info.subtitle, chapter: 2 });
  }));
}

function onRunStarted(p) {
  prevFloor = 0;
  if (!p || p.resume || p.daily || p.contract || (p.mode !== 'normal' && p.mode !== 'hell')) return;
  const game = window.__game;
  const g = game && game.scene && game.scene.getScene('Game');
  if (!g || g.storyIntro) return;
  const q = storyQueueFor({ char: p.char, mode: p.mode });
  if (!q.length) return;
  startRunStory(g, q);
}

function startRunStory(g, q) {
  g.storyIntro = true;
  g.cutscene = true; // frozen from the first frame (create() has already reset the flag)
  const run = g.run;
  const ctx = run ? ctxOf(run) : { char: 'gunslinger', hell: false, clean: true };
  g.time.delayedCall(60, () => playQueue(g, [...q], ctx, (r) => afterRunStart(g, r)));
}

// ==================================================================================================== registration + QA api
function makeApi(game) {
  const overlayActive = () => game.scene.isActive('Game') && !!game.scene.getScene('Game').player;
  const stopOthers = () => { for (const k of ['Menu', 'Codex', 'Board', 'CharSelect', 'Daily', 'End', 'Credits', 'Cutscene']) if (game.scene.isActive(k)) game.scene.stop(k); };
  return {
    ids: CUTSCENE_IDS,
    /** Play a cutscene: over the running Game scene when there is one, else standalone (back to the Menu afterwards). */
    play(id, ctx = {}) {
      const c = { char: ctx.char || 'gunslinger', hell: !!ctx.hell, clean: !!ctx.clean };
      if (game.scene.isActive('Cutscene')) game.scene.stop('Cutscene');
      if (overlayActive()) game.scene.run('Cutscene', { id, ctx: c, overlay: true, next: { callback() {} } });
      else { stopOthers(); game.scene.start('Cutscene', { id, ctx: c, next: { scene: 'Menu' } }); }
      return id;
    },
    credits(ending = 'a') {
      if (game.scene.isActive('Credits')) game.scene.stop('Credits');
      if (overlayActive()) game.scene.run('Credits', { ending, overlay: true, onDone() {} });
      else { stopOthers(); game.scene.start('Credits', { ending, next: { scene: 'Menu' } }); }
    },
    skip() { const s = game.__cutscene || game.__credits; if (s) s.skipAll(); return !!s; },
    advance() { const s = game.__cutscene; if (s) s.press(); return !!s; },
    state() { const s = game.__cutscene; const c = game.__credits; return s ? s.state() : c ? c.state() : null; },
    get current() { const s = game.__cutscene; return s ? s.id : null; },
    /** Force the run-start story (intro / ledger) on the current Game scene, even in debug runs (which never announce run:started). */
    runStart(force) {
      const g = game.scene.getScene('Game');
      if (!g || !g.run) return false;
      const q = force === true || !force ? storyQueueFor({ char: g.run.char, mode: g.run.mode }) : [].concat(force);
      if (!q.length) return false;
      g.storyIntro = false;
      startRunStory(g, q);
      return true;
    },
    trueFinale() { const g = game.scene.getScene('Game'); return !!g && trueFinale(g); },
  };
}

function urlHook(game) {
  const id = qs('cutscene');
  const credits = qs('credits');
  if (!id && !credits) return;
  let tries = 0;
  const iv = setInterval(() => {
    if (++tries > 600) { clearInterval(iv); return; }
    if (!game.scene.isActive('Menu')) return;
    clearInterval(iv);
    if (id) game.story.play(id, { char: qs('char') || 'gunslinger', clean: flag('clean'), hell: flag('hell') });
    else game.story.credits(credits === 'true' ? 'true' : 'a');
  }, 150);
}

function install(game) {
  if (!game || !game.scene) return false;
  if (game.__storyInstalled) return true;
  game.__storyInstalled = true;
  for (const [key, cls] of [['Cutscene', CutsceneScene], ['Credits', CreditsScene]]) {
    try { if (!game.scene.getScene(key)) game.scene.add(key, cls, false); } catch (e) { console.warn(`[story] could not register ${key}`, e); }
  }
  game.story = makeApi(game);
  urlHook(game);
  return true;
}

if (typeof window !== 'undefined' && !window.__dwStoryHooked) {
  window.__dwStoryHooked = true;
  bus.on('run:started', onRunStarted);
  bus.on('floor:changed', onFloorChanged);
  bus.on('run:ended', () => { prevFloor = 0; });
  let tries = 0;
  const attempt = () => {
    if (install(window.__game)) return;
    if (++tries < 200) setTimeout(attempt, 25);
  };
  queueMicrotask(attempt);
}
