// Run flow across bosses, floors and chapters (ARCH_V2 s6). GameScene / RoomManager call in; every step has a fail-safe so a missing or
// broken presentation module can never soft-lock the run.
//
//   onBossDefeated(scene, boss)          minis -> champion reward; floors 1-5 reward + trapdoor (F3 adds the CHAPTER I banner); scratch -> ending
//   beforeDescend(scene, from, to, go)   trapdoor chain: F3 -> interlude card -> cutscene 'interlude_ch1'; F5 -> cutscene 'saloon_arrival'; then go()
//   afterFloorIntro(scene, {from,floor}) chapter card (after the interlude), floor card, Hell's Welcome, checkpoint (F4-F6)
//   playCutscene(scene, id, ctx, next)   overlay cutscene via the 'Cutscene' scene when it exists and the mode allows it, else next() at once
//   trueFinale(scene)                    hook for the Sixth Bullet finale (ending.js); returns true when it took over
//   endGame(scene, boss)                 game:ending (once) -> runEnding() from ending.js, else the chapter-complete poster + endRun('complete')
import { MAX_FLOOR, INTERLUDE_AFTER, CHAPTER_OF, FLOORS, PLAYER, ROOM } from '../config.js';
import { bossMeta, FINAL_BOSS } from '../bosses/registry.js';
import { bus } from '../core/events.js';
import { Save } from '../core/Save.js';
import { Music, playMusicFor } from '../core/Audio.js';
import Trapdoor from '../entities/Trapdoor.js';
import { playBanner, playFinale } from './finale.js';

// Optional modules from other jobs (absent in Foundation): resolved at build time, so a missing file is just an empty record.
const ENDING = import.meta.glob('./ending.js', { eager: true });
const endingModule = () => Object.values(ENDING)[0] || null;

export const CHAPTER_CARD_MS = 3600;
export const INTERLUDE_MS = 6500;
const INTERLUDE_SAFETY_MS = 4000; // added to the card duration before the chain moves on by itself
const CUTSCENE_SAFETY_MS = 150000;
const HELL_WELCOME = { heal: 2, dynamite: 2, toast: 'THE HEAT WELCOMES YOU', color: '#ff7a1f' };
const CHECKPOINT_TOAST = { text: 'CHECKPOINT - THE HOUSE KEEPS YOUR PLACE', color: '#d8c39a' };
export const INTERLUDE = {
  key: 'img_interlude_ch2',
  lines: ["The shaft doesn't end in rock.", 'It ends in brimstone. Something down there is holding the other end of your debt.'],
  title: "CHAPTER II - HELL'S FRONTIER",
  music: 'mus_interlude',
};

/** Wrap `fn` so it runs at most once (chains are guarded by both the normal completion and a fail-safe timer). */
const once = (fn) => { let done = false; return (...a) => { if (done) return; done = true; fn(...a); }; };
const alive = (scene) => !!scene && !scene.ended && !!scene.player && scene.sys && scene.sys.isActive();

/** Cutscenes and story cards never play in daily or contract runs. */
export const storyAllowed = (scene) => !!scene.run && (scene.run.mode === 'normal' || scene.run.mode === 'hell');

export function cutsceneCtx(scene) {
  const r = scene.run || {};
  return { char: r.char || 'gunslinger', hell: r.mode === 'hell', clean: !(r.dealsMade > 0) && !(r.deals && r.deals.length) };
}

// -------------------------------------------------------------------------------------------------------- boss routing
export function onBossDefeated(scene, boss) {
  if (scene.ended || (scene.player && scene.player.dead)) return; // the death screen wins over any finale / floor music
  const meta = boss.meta || bossMeta(boss.id) || {};
  const room = scene.room;
  if (meta.mini) { onMiniDefeated(scene, boss, room); return; }
  if (meta.final || boss.id === FINAL_BOSS || scene.floorNum >= MAX_FLOOR) { endGame(scene, boss); return; }
  if (room) {
    room.onBossDefeated(boss); // reward pedestal, heart, crossroads gate roll (FN-5)
    ensureTrapdoor(room);
  }
  if (scene.floorNum === INTERLUDE_AFTER) playBanner(scene, 'CHAPTER I COMPLETE', 'Perdition County is quiet. For now.');
  scene.updateMusic({ fade: 1500 });
}

/** Champion-room mini boss: FN-6's Room.onMiniDefeated pays out; without it the room just clears. */
function onMiniDefeated(scene, boss, room) {
  if (room) {
    if (typeof room.onMiniDefeated === 'function') room.onMiniDefeated(boss);
    else {
      for (const e of [...scene.enemies]) if (e !== boss && e.alive) { e.hp = 0; e.die({ silent: true }); }
      scene.bullets.enemy.clear();
      room.clearRoom();
    }
  }
  scene.updateMusic({ fade: 1200 });
}

/** Floors below MAX_FLOOR always get a trapdoor after the boss (older Room.onBossDefeated only made one for floors 1-2). */
function ensureTrapdoor(room) {
  if (room.floor >= MAX_FLOOR || room.state.trapdoor || room.trapdoor) return;
  room.state.trapdoor = { x: ROOM.cx, y: ROOM.cy + 40 };
  room.trapdoor = new Trapdoor(room.scene, room.state.trapdoor, room);
  room.props.push(room.trapdoor);
}

// -------------------------------------------------------------------------------------------------------- endings
/** Sixth Bullet finale hook: ending.js may export `trueFinale(scene)` and return true when it runs the finale (eligibility is its business). */
export function trueFinale(scene) {
  const m = endingModule();
  if (!m || typeof m.trueFinale !== 'function') return false;
  try { return !!m.trueFinale(scene); } catch (e) { console.warn('[flow] trueFinale failed', e); return false; }
}

export function endGame(scene, boss) {
  if (scene.endingStarted) return;
  scene.endingStarted = true;
  const room = scene.room;
  const run = scene.run;
  if (room) { room.state.cleared = true; room.mode = 'done'; }
  if (run) { run.roomsCleared++; run.won = true; run.chapter = 2; run.completedChapter2 = true; }
  scene.cutscene = true; // freeze the simulation
  scene.timeScale = 1;
  const p = scene.player;
  p.vx = p.vy = 0;
  p.setEntryInvuln(60);
  p.syncVisual();
  scene.bullets.clear();
  if (trueFinale(scene)) return;
  const payload = { ending: 'devil_defeated', run: run.toJSON(), character: run.char, difficulty: run.mode, seed: scene.seed };
  bus.emit('game:ending', payload);
  const m = endingModule();
  if (m && typeof m.runEnding === 'function') {
    try { m.runEnding(scene, payload); return; } catch (e) { console.warn('[flow] runEnding failed, falling back to the poster', e); }
  }
  playFinale(scene, { title: 'OLD SCRATCH FALLS', sub: 'The contract is void. The county is quiet.' });
}

// -------------------------------------------------------------------------------------------------------- descent chain
/** Trapdoor chain between floors. `go()` loads the next floor; it is called exactly once, whatever happens in between. */
export function beforeDescend(scene, from, to, go) {
  const next = once(go);
  if (!alive(scene) || !storyAllowed(scene)) { // daily / contract runs (and a dead scene) go straight down
    if (from === INTERLUDE_AFTER && alive(scene)) playInterlude(scene, next); else next();
    return;
  }
  const ctx = cutsceneCtx(scene);
  if (from === INTERLUDE_AFTER) playInterlude(scene, () => playCutscene(scene, 'interlude_ch1', ctx, next));
  else if (from === 5) playCutscene(scene, 'saloon_arrival', ctx, next);
  else next();
}

/** D12: black -> typed `img_interlude_ch2` card (drawn by Cards on the HUD scene, skippable after 1.2 s) -> next. */
function playInterlude(scene, next) {
  const done = once(() => { bus.off('interlude:done', done); next(); });
  bus.on('interlude:done', done);
  playMusicFor(INTERLUDE.music, { fade: 600 });
  bus.emit('interlude:show', { ...INTERLUDE, ms: INTERLUDE_MS, skipAfter: 1200 });
  scene.time.delayedCall(INTERLUDE_MS + INTERLUDE_SAFETY_MS, done);
}

export function playCutscene(scene, id, ctx, next) {
  const fin = once(next);
  const cs = storyAllowed(scene) && scene.scene && scene.scene.manager ? scene.scene.manager.getScene('Cutscene') : null;
  if (!cs) { fin(); return false; }
  try {
    scene.scene.launch('Cutscene', { id, ctx, overlay: true, onDone: fin, next: { callback: fin } });
    scene.time.delayedCall(CUTSCENE_SAFETY_MS, fin);
    return true;
  } catch (e) {
    console.warn(`[flow] cutscene '${id}' failed`, e);
    fin();
    return false;
  }
}

// -------------------------------------------------------------------------------------------------------- arrival
/**
 * A floor just loaded (RoomManager.descend / debug). `from` = previous floor (0 = run start or debug jump, no ceremony).
 * Order: chapter card (chapter change only, blocks input) -> floor card; Hell's Welcome + checkpoint on a real descent to F4-F6.
 */
export function afterFloorIntro(scene, { from = 0, floor = scene.floorNum } = {}) {
  if (!alive(scene)) return;
  const info = FLOORS[floor];
  const descended = from > 0 && from < floor;
  const chapter = CHAPTER_OF(floor);
  const show = () => {
    if (!alive(scene)) return;
    bus.emit('floor:intro', { floor, name: info.name, subtitle: info.subtitle, chapter });
    if (descended && floor === INTERLUDE_AFTER + 1) hellsWelcome(scene);
  };
  if (descended && floor >= 4) saveCheckpoint(scene);
  if (descended && chapter > CHAPTER_OF(from)) {
    scene.cutscene = true;
    bus.emit('chapter:intro', { chapter, name: "HELL'S FRONTIER", tagline: "The Devil's Own Country", ms: CHAPTER_CARD_MS });
    scene.time.delayedCall(CHAPTER_CARD_MS, () => { scene.cutscene = false; show(); });
  } else show();
}

function hellsWelcome(scene) {
  const p = scene.player, run = scene.run;
  if (run.hellsWelcome) return;
  run.hellsWelcome = true; // once per run
  p.heal(HELL_WELCOME.heal);
  p.dynamite = Math.min(PLAYER.maxPickups, p.dynamite + HELL_WELCOME.dynamite);
  bus.emit('ui:toast', { text: HELL_WELCOME.toast, color: HELL_WELCOME.color });
  if (run.checkpointSaved) scene.time.delayedCall(1900, () => bus.emit('ui:toast', CHECKPOINT_TOAST));
}

/** D10: normal / hell runs only (Save refuses the rest and debug runs). The floor regenerates from seed + floor on CONTINUE. */
function saveCheckpoint(scene) {
  const run = scene.run;
  let ok = false;
  try { ok = Save.saveCheckpoint(run, scene.player); } catch (e) { ok = false; }
  run.checkpointSaved = !!ok;
  if (ok) bus.emit('checkpoint:saved', { floor: scene.floorNum });
}

/** Current music track key (debug / QA). */
export const musicKey = () => Music.current();
