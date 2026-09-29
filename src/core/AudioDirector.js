// Audio director: turns game flow (bus events) into music / ambience / loading decisions. Installed once from installAudioHooks().
//   floor:changed -> load + play floor track and ambience (wind on floors 1-2, cave on 3), prefetch shop track
//   room:entered  -> shop => mus_shop (ambience off), uncleared boss room => boss track (mus_boss floors 1-2, mus_boss_final floor 3), else floor track;
//                    rooms next to the boss room prefetch the boss + next-floor tracks (lazy loading, nothing is downloaded before it is likely needed)
//   boss:intro / boss:defeated / player:died / run:ended -> boss track, back to floor track (crossfade), death / victory stingers
//   active:changed -> "ready" click when an active item finishes charging; footsteps (wood on floor 2, dirt elsewhere) while the player walks
// GameScene also calls playMusicFor(...) at the same moments; Music.play is idempotent so both paths agree.
import Phaser from 'phaser';
import { bus } from './events.js';
import { Sfx, Music, Ambience, playMusicFor } from './Audio.js';
import { AudioLoader } from './AudioLoader.js';
import { Assets } from './Assets.js';

const FLOOR_MUSIC = (n) => `mus_floor${Math.min(3, Math.max(1, n))}`;
const BOSS_MUSIC = (n) => (n >= 3 ? 'mus_boss_final' : 'mus_boss');
const AMB = (n) => (n >= 3 ? 'amb_cave' : 'amb_wind');
const STEP = (n) => (n === 2 ? 'step_wood' : 'step_dirt');

let floor = 1;
let hooked = new WeakSet();
let chargePrev = new Map();
let installed = false;

function roomMusic(type, cleared) {
  if (type === 'shop') { Ambience.stop(1200); playMusicFor('mus_shop'); return; }
  if (type === 'boss' && !cleared) { playMusicFor(BOSS_MUSIC(floor)); return; }
  playMusicFor(FLOOR_MUSIC(floor));
  Ambience.play(AMB(floor));
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
    if (dist > 64) { dist = 0; Sfx.play(STEP(floor), { vol: 0.9 + Math.random() * 0.2 }); }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once('shutdown', () => { scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate); hooked.delete(scene); });
}

export function installAudioDirector(game) {
  if (installed) return;
  installed = true;
  // menu track streams in right after boot (not part of the blocking load); then the first floor's bed
  AudioLoader.ensure('mus_menu').then(() => AudioLoader.prefetch(['mus_floor1', 'amb_wind']));

  bus.on('floor:changed', ({ floor: n }) => {
    floor = n;
    chargePrev = new Map();
    hookScene(game.scene.getScene('Game'));
    playMusicFor(FLOOR_MUSIC(n), { fade: 1500 });
    Ambience.play(AMB(n));
    // after the floor track is in, quietly fetch the shop track
    AudioLoader.ensure(FLOOR_MUSIC(n)).then(() => AudioLoader.prefetch(['mus_shop']));
  });

  bus.on('room:entered', ({ room, type }) => {
    const cleared = !!(room && room.state && room.state.cleared);
    roomMusic(type, cleared);
    // next to the boss room? fetch the boss track (+ next floor's track) now
    const doors = room && room.def && room.def.doors;
    if (doors && Object.values(doors).some((d) => d.kind === 'boss')) AudioLoader.prefetch([BOSS_MUSIC(floor), floor < 3 ? FLOOR_MUSIC(floor + 1) : null]);
  });

  bus.on('boss:intro', () => playMusicFor(BOSS_MUSIC(floor)));
  bus.on('boss:defeated', () => setTimeout(() => {
    // the player may have died / the run may have ended in the meantime: the death / victory music must not be replaced by the floor bed
    const gs = game.scene.getScene('Game');
    if (!(game.scene.isActive('Game') || game.scene.isPaused('Game')) || !gs || gs.ended || !gs.player || gs.player.dead) return;
    playMusicFor(FLOOR_MUSIC(floor), { fade: 1800 }); if (floor < 3) Ambience.play(AMB(floor));
  }, 1400));
  bus.on('player:died', () => { playMusicFor('death', { fade: 300 }); Ambience.stop(500); });
  bus.on('run:ended', ({ variant }) => { playMusicFor(variant === 'complete' ? 'victory' : 'death', { fade: 300 }); Ambience.stop(500); });

  // active item finished charging -> low cylinder click
  bus.on('active:changed', (a) => {
    if (!a) return;
    const prev = chargePrev.get(a.id);
    chargePrev.set(a.id, a.charge);
    if (prev !== undefined && prev < a.max && a.charge >= a.max) Sfx.play('sixth_bullet_ready', { vol: 1.2, rate: 0.75 });
  });
}
