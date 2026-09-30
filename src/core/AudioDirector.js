// Audio director: turns game flow (bus events) into music / ambience / loading decisions. Installed once from installAudioHooks().
// Data-driven (AUDIO_SPEC_V2 s6): FLOORS[n].music / .ambience, BOSS_META[id].music / .stems, ROOM_TYPES[type].music. No floor literals except the
// footstep / chapter-1 ambience tables below.
//
// ROUTER. GameScene.updateMusic, flow.js and this file all ask for tracks by the plain names ("the floor track", "the boss track"). Every request goes
// through `route()` (installed with Music.setRouter), which turns it into what really plays, so the callers can never fight each other:
//   floor track  -> mus_crossroads inside the crossroads pocket / supersecret vault, mus_miniboss in an uncleared champion room
//   boss track   -> the stem of the current boss phase (Engine a/b/c, Scratch a..d); the floor track once that boss is dead
// and `amb()` decides the ambience bed (floor bed, amb_crossroads in the pocket, off in shops and during boss fights).
//
// EVENTS. floor:changed (floor track + bed + prefetch), room:entered (prefetch next to boss / champion doors, footsteps hook),
//   boss:intro / boss:phase (stem crossfade 1.0 s, equal power, same loop position for Engine) / boss:defeated + mini:defeated (back to the floor track),
//   pocket:entered / pocket:left, player:died / run:ended (stingers), game:ending (fade out 1.0 s, no victory sting before the ending scenes),
//   active:changed ("ready" click). Codex / Board scenes lower the menu music to 0.7; the quick_draw duel wait dips the music to 0.25.
import Phaser from 'phaser';
import { bus } from './events.js';
import { Sfx, Music, Ambience, musicKeyFor } from './Audio.js';
import { AudioLoader } from './AudioLoader.js';
import { Assets } from './Assets.js';
import { FLOORS, ROOM_TYPES, INTERLUDE_AFTER, MAX_FLOOR } from '../config.js';
import { BOSS_META, bossMeta } from '../bosses/registry.js';

const XROADS = 'mus_crossroads';
const FLOOR_KEY = /^mus_floor(\d+)$/;
const BOSS_KEY = /^mus_boss/; // mus_boss, mus_boss_final, mus_boss4.., stems mus_boss5_a..
const STEP = { 1: { key: 'step_dirt' }, 2: { key: 'step_wood' }, 3: { key: 'step_dirt' }, 4: { key: 'step_dirt' }, 5: { key: 'step_dirt', rate: 0.85 }, 6: { key: 'step_wood' } };
const AMB_CH1 = { 1: { key: 'amb_wind', vol: 1 }, 2: { key: 'amb_wind', vol: 0.8 }, 3: { key: 'amb_cave', vol: 1 } }; // FLOORS[n].ambience wins when set
const EXTRA_ROOM_MUSIC = { supersecret: XROADS }; // the vault shares the pocket's track
const KEEP_POS = new Set(['engine']); // stems of these bosses share a bar layout: crossfade at the same loop position
const HELL_AMB = 1.122; // +1 dB in Hell on Earth
const MENU_SCENES = ['Codex', 'Board'];
const MENU_LEVEL = 0.7;
const DUEL_LEVEL = 0.25;

let game = null;
let floor = 1;
let hooked = new WeakSet();
let chargePrev = new Map();
let installed = false;
let bossPhase = 0; // phase index of the boss being fought (0..3), reset on boss:intro
let bossId = null;
let doneRoom = null; // room id whose boss / mini-boss died this visit (state.cleared may lag the event)
let ending = false;

const liveGame = () => {
  if (!game) return null;
  const on = game.scene.isActive('Game') || game.scene.isPaused('Game');
  return on ? game.scene.getScene('Game') : null;
};
const curFloor = () => { const s = liveGame(); return s && s.floorNum ? s.floorNum : floor; };
const floorTrack = (n) => (FLOORS[n] || FLOORS[1]).music || `mus_floor${n}`;
const exists = (key) => !!key && !!Assets.manifest.audio[key];
const prefetch = (keys) => AudioLoader.prefetch(keys.filter(exists));

/** Track of boss `id` for phase index `phase` (stems clamp to the last one). */
function bossTrack(id, phase) {
  const m = bossMeta(id);
  if (!m) return null;
  if (m.stems && m.stems.length) return m.stems[Math.max(0, Math.min(m.stems.length - 1, phase | 0))];
  return musicKeyFor(m.music || 'boss');
}
/** Boss id a boss-track request belongs to: `mus_boss5` -> engine, a stem key -> its boss, null for the shared mus_boss. */
function bossOfKey(key) {
  for (const id of Object.keys(BOSS_META)) {
    const m = BOSS_META[id];
    if (m.mini) continue;
    if (m.stems ? m.stems.includes(key) || key === musicKeyFor(m.music) : (m.music !== 'boss' && key === musicKeyFor(m.music))) return id;
  }
  return null;
}
const isCleared = (room) => !!(room && ((room.state && room.state.cleared) || (doneRoom && room.def && room.def.id === doneRoom)));

// ------------------------------------------------------------------------------------------------ router
function route(key) {
  const isFloor = FLOOR_KEY.test(key), isBoss = BOSS_KEY.test(key);
  if (!isFloor && !isBoss) return key;
  const s = liveGame();
  if (!s) return key;
  const room = s.room, mgr = s.roomMgr;
  if ((mgr && mgr.inPocket) || (room && room.type === 'crossroads')) return XROADS;
  if (room) {
    const extra = EXTRA_ROOM_MUSIC[room.type];
    if (extra) return extra;
    if (isFloor && room.type === 'champion' && !isCleared(room)) return (ROOM_TYPES.champion && ROOM_TYPES.champion.music) || 'mus_miniboss';
    if (isBoss) {
      if (room.type === 'boss' && isCleared(room)) return floorTrack(s.floorNum || floor); // the boss is dead: floor track
      const id = bossOfKey(key);
      if (id) { const m = bossMeta(id); if (m && m.stems) return bossTrack(id, bossId === id ? bossPhase : 0); }
    }
  }
  return key;
}

/** Ambience decision for the effective music key: undefined = Music.play default, null = off, {key, vol} = that bed. */
function ambFor(key) {
  const s = liveGame();
  const type = s && s.room ? s.room.type : null;
  if ((key === 'mus_shop' && type === 'shop') || (BOSS_KEY.test(key) && type === 'boss')) return null; // shops keep it off; boss fights are dense enough
  const hell = s && s.diff && s.diff.id === 'hell' ? HELL_AMB : 1;
  if (key === XROADS) return { key: 'amb_crossroads', vol: hell };
  const m = FLOOR_KEY.exec(key);
  const n = m ? +m[1] : key === 'mus_miniboss' ? curFloor() : 0;
  if (!n) return undefined;
  const info = FLOORS[n];
  const bed = info && info.ambience ? { key: info.ambience, vol: 1 } : AMB_CH1[n] || AMB_CH1[3];
  return { key: bed.key, vol: bed.vol * hell };
}

// ------------------------------------------------------------------------------------------------ requests
/** The track the current room wants (the router then refines it: champion / pocket / vault / stems). */
function roomMusic(room, opts) {
  if (!room) return;
  if (room.type === 'shop') { Music.play('mus_shop', opts); return; }
  if (room.type === 'boss' && !isCleared(room)) {
    const m = bossMeta(room.tpl && room.tpl.boss);
    Music.play(musicKeyFor((m && m.music) || 'boss'), opts);
    return;
  }
  Music.play(floorTrack(curFloor()), opts);
}

function restoreFloor(fade) {
  Music.play(floorTrack(curFloor()), { fade });
}

function hookScene(scene) {
  if (!scene || hooked.has(scene)) return;
  hooked.add(scene);
  let dist = 0;
  const onUpdate = (time, delta) => {
    const p = scene.player;
    if (!p || p.dead || p.rolling || scene.transitioning || scene.cutscene || scene.paused) { dist = 0; return; }
    const sp = Math.hypot(p.vx, p.vy);
    if (sp < 70) return;
    dist += sp * Math.min(delta, 50) / 1000;
    if (dist > 64) {
      dist = 0;
      const st = STEP[floor] || STEP[3];
      Sfx.play(st.key, { vol: 0.9 + Math.random() * 0.2, rate: st.rate });
    }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once('shutdown', () => { scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate); hooked.delete(scene); });
}

/** Lazy prefetch: the tracks the player is about to need (one at a time, low priority, see AudioLoader). */
function prefetchAhead(n, { boss = false, champion = false } = {}) {
  const keys = [];
  if (boss) {
    const id = FLOORS[n] && FLOORS[n].boss, m = bossMeta(id);
    if (m) { if (m.stems) keys.push(...m.stems); else keys.push(musicKeyFor(m.music || 'boss')); }
    if (n === INTERLUDE_AFTER) keys.push('mus_interlude');
    if (n < MAX_FLOOR) keys.push(floorTrack(n + 1), (FLOORS[n + 1] && FLOORS[n + 1].ambience) || null);
    if (n < 6) keys.push(XROADS);
  }
  if (champion) keys.push('mus_miniboss');
  prefetch(keys);
}

/** Codex / Board lower the menu music (calm text reading). Those scenes are registered after boot, so poll the manager a few times a second. */
function watchMenuScenes() {
  let frame = 0, on = false;
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    if (++frame % 12) return;
    let now = false;
    for (let i = 0; i < MENU_SCENES.length && !now; i++) now = game.scene.isActive(MENU_SCENES[i]);
    if (now !== on) { on = now; Music.level('menu', now ? MENU_LEVEL : 1, 600); }
  });
}

export function installAudioDirector(g) {
  if (installed) return;
  installed = true;
  game = g;
  Music.setRouter({ route, amb: ambFor });
  // menu track streams in right after boot (not part of the blocking load); then the first floor's bed
  AudioLoader.ensure('mus_menu').then(() => prefetch([floorTrack(1), FLOORS[1].ambience || AMB_CH1[1].key]));
  watchMenuScenes();

  bus.on('floor:changed', ({ floor: n }) => {
    floor = n;
    chargePrev = new Map();
    doneRoom = null; bossId = null; bossPhase = 0; ending = false;
    Music.level('duel', 1, 300);
    hookScene(game.scene.getScene('Game'));
    Music.play(floorTrack(n), { fade: 1500 }); // the router picks the bed
    // after the floor track is in, quietly fetch the shop, champion and crossroads tracks
    AudioLoader.ensure(floorTrack(n)).then(() => prefetch(['mus_shop', 'mus_miniboss', n < 6 ? XROADS : null]));
  });

  bus.on('room:entered', ({ room, type }) => {
    if (!room) return;
    if (!(room.def && room.def.id === doneRoom)) doneRoom = null;
    Music.level('duel', 1, 400);
    roomMusic(room);
    // next to the boss / champion room? fetch its tracks (+ the next floor's, the interlude) now
    const doors = room.def && room.def.doors;
    if (doors) {
      const kinds = Object.values(doors).map((d) => d.kind);
      if (kinds.includes('boss') || kinds.includes('champion')) prefetchAhead(curFloor(), { boss: kinds.includes('boss'), champion: kinds.includes('champion') });
    }
  });

  bus.on('boss:intro', (p) => {
    const b = p && p.boss;
    if (!b) return;
    bossId = b.id; bossPhase = 0;
    Music.play(musicKeyFor((b.meta && b.meta.music) || 'boss'));
  });
  bus.on('boss:phase', (p) => {
    const id = (p && (p.id || (p.boss && p.boss.id))) || null;
    const m = bossMeta(id);
    bossId = id; bossPhase = (p && p.phase) | 0;
    if (!m || !m.stems) return;
    const s = liveGame();
    if (!s || !s.room || s.room.type !== 'boss') return;
    Music.play(bossTrack(id, bossPhase), { fade: 1000, crossfade: true, keepPos: KEEP_POS.has(id) });
    if (m.final && bossPhase >= 2) prefetch(['mus_ending_a', 'mus_ending_true']); // the finale is near
  });
  bus.on('gate:opened', () => prefetch([XROADS]));

  const defeatedHere = () => { const s = liveGame(); doneRoom = s && s.room && s.room.def ? s.room.def.id : null; };
  bus.on('boss:defeated', (p) => {
    defeatedHere();
    const m = bossMeta(p && ((p.boss && p.boss.id) || p.id));
    if (m && m.final) return; // the ending owns the music
    setTimeout(() => {
      // the player may have died / the run may have ended in the meantime: the death / victory music must not be replaced by the floor bed
      const gs = game.scene.getScene('Game');
      if (ending || !(game.scene.isActive('Game') || game.scene.isPaused('Game')) || !gs || gs.ended || !gs.player || gs.player.dead) return;
      restoreFloor(1800);
    }, 1400);
  });
  bus.on('mini:defeated', () => {
    defeatedHere();
    const gs = game.scene.getScene('Game');
    if (ending || !gs || gs.ended || !gs.player || gs.player.dead) return;
    restoreFloor(1200);
  });

  bus.on('pocket:entered', () => Music.play(XROADS, { fade: 1200 }));
  bus.on('pocket:left', () => restoreFloor(1200));

  bus.on('player:died', () => { Music.play('mus_death', { fade: 300 }); Ambience.stop(500); });
  bus.on('run:ended', ({ variant }) => { Music.play(variant === 'complete' || variant === 'contract' ? 'mus_victory' : 'mus_death', { fade: 300 }); Ambience.stop(500); });
  // Ol' Scratch fell: fade everything out; the ending scenes bring their own music, mus_victory only plays after the credits
  bus.on('game:ending', () => { ending = true; Music.stop(1000); Ambience.stop(1000); });

  // quick_draw duel: the music dips while the duelists wait for DRAW (QuickDraw emits duel:start at the bell and duel:end at DRAW)
  bus.on('duel:start', () => Music.level('duel', DUEL_LEVEL, 500));
  bus.on('duel:end', () => Music.level('duel', 1, 600));
  bus.on('player:died', () => Music.level('duel', 1, 300));

  // active item finished charging -> low cylinder click
  bus.on('active:changed', (a) => {
    if (!a) return;
    const prev = chargePrev.get(a.id);
    chargePrev.set(a.id, a.charge);
    if (prev !== undefined && prev < a.max && a.charge >= a.max) Sfx.play('sixth_bullet_ready', { vol: 1.2, rate: 0.75 });
  });
}
