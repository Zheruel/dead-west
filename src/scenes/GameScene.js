// Main gameplay scene: owns player, systems and the room manager; runs the fixed simulation order each frame.
import Phaser from 'phaser';
import { ROOM, FLOORS, MAX_FLOOR, FEEL, DEPTH, W, H } from '../config.js';
import { initSeed, getSeed } from '../core/rng.js';
import { bossMeta } from '../bosses/registry.js';
import { bus } from '../core/events.js';
import { Sfx, Music, Audio, playMusicFor, MUSIC_FOR } from '../core/Audio.js';
import { Save } from '../core/Save.js';
import { flag, qs, clamp } from '../core/util.js';
import RunState from '../core/RunState.js';
import GameInput from '../core/Input.js';
import Fx from '../systems/Fx.js';
import Bullets from '../systems/Bullets.js';
import Player from '../entities/Player.js';
import Dynamite from '../entities/Dynamite.js';
import RoomManager from '../rooms/RoomManager.js';
import { ItemSystem, getItem, allItems } from '../items/index.js';
import { spawnEnemy } from '../enemies/index.js';
import { installDebug } from '../core/Debug.js';
import * as flow from './flow.js';

// Optional run setup from the meta layer (FN-3): applyRunSetup(scene, data) picks rider / mode / difficulty / mutators, finishRun(scene, payload) adds the ledger.
const SETUP = Object.values(import.meta.glob('../meta/runSetup.js', { eager: true }))[0] || null;
const RIDERS = ['gunslinger', 'preacher', 'hunter', 'queen'];

const BOSS_INTRO_MS = { boss: 2900, final: 4600, mini: 1500 }; // fallbacks when a boss's introData() has no `ms` (same numbers Cards uses)
const track = (k) => MUSIC_FOR[k] || (String(k).startsWith('mus_') ? k : `mus_${k}`); // 'boss4' -> 'mus_boss4'

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) { this.startData = data || {}; }

  get room() { return this.roomMgr ? this.roomMgr.room : null; }

  create() {
    this.cameras.main.setBackgroundColor('#0d0806');
    this.cameras.main.setScroll(0, 0);
    this.seed = initSeed(this.startData.seed); // checkpoint continue passes the saved seed; otherwise ?seed= or random
    this.run = new RunState(this.seed);
    this.endingStarted = false;
    this._introRelease = null;
    this.chapter = 1;
    this.enemies = [];
    this.dynamites = [];
    this.floorNum = 1;
    this.transitioning = false;
    this.cutscene = false;
    this.ended = false;
    this.timeScale = 1;
    this.enemyTimeScale = 1;
    this.paused = false;

    this.fx = new Fx(this);
    this.bullets = new Bullets(this);
    this.items = new ItemSystem(this);
    this.gameInput = new GameInput(this);
    this.player = new Player(this, ROOM.cx, ROOM.cy);
    this.player.dynamite = 1;
    this.roomMgr = new RoomManager(this);
    this.fx.startMotes();
    this._look = { x: 0, y: 0 };
    if (FEEL.vignette > 0) {
      this.vig = this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setTint(0x000000).setAlpha(FEEL.vignette).setDepth(DEPTH.overlay - 20).setScrollFactor(0);
      this.vig.__noSnap = true;
    }

    this.scene.launch('HUD', { game: this });
    bus.scoped(this, 'room:cleared', () => { this.player.addCharge(1); });
    bus.scoped(this, 'room:entered', () => this.updateMusic());
    bus.scoped(this, 'boss:intro:skip', () => { if (this._introRelease) this._introRelease(); });

    // pause
    const pause = () => this.pauseGame();
    this.input.keyboard.on('keydown-ESC', pause);
    this.input.keyboard.on('keydown-P', pause);
    this.input.keyboard.on('keydown-TAB', (e) => e.preventDefault());

    // pause when the window loses focus (alt-tab must never get you killed)
    this._onBlur = () => { if (Save.settings().autoPause === false) return; if (!this.ended && this.player && !this.player.dead) this.pauseGame(); };
    this.game.events.on('blur', this._onBlur);

    this.applyRunSetup();
    const start = this.startFloor();
    this.roomMgr.loadFloor(start);
    this.time.delayedCall(250, () => flow.afterFloorIntro(this, { from: 0, floor: start }));
    installDebug(this);

    this.events.once('shutdown', () => this.onShutdown());
    this.cameras.main.fadeIn(350, 13, 8, 6);
  }

  /** Rider / mode: the meta layer's runSetup when present, else the ?char= / ?mode= flags (validated). */
  applyRunSetup() {
    const d = this.startData;
    if (SETUP && typeof SETUP.applyRunSetup === 'function') {
      try { SETUP.applyRunSetup(this, { char: qs('char') || d.char, mode: qs('mode') || d.mode, ...d }); return; } catch (e) { console.warn('[GameScene] runSetup failed', e); }
    }
    const char = qs('char') || d.char, mode = qs('mode') || d.mode;
    if (RIDERS.includes(char)) this.run.char = char;
    if (mode === 'hell' || mode === 'normal') this.run.mode = mode;
  }

  /** First floor: ?floor=N (1..MAX_FLOOR) or the start data (checkpoint continue). */
  startFloor() {
    const n = parseInt(qs('floor') || this.startData.floor, 10);
    return Number.isFinite(n) ? clamp(n, 1, MAX_FLOOR) : 1;
  }

  /** Story overlays (Cutscene launched over the game) never outlive the run: stop them before End / shutdown (Q1-08). */
  stopOverlays() {
    try { if (this.scene.manager.isActive('Cutscene')) this.scene.stop('Cutscene'); } catch (e) { /* */ }
  }

  onShutdown() {
    this.stopOverlays();
    Audio.heartbeat(false);
    for (const d of [...(this.dynamites || [])]) d.destroy(); // stops looping fuse sounds (they are game-level, not scene-level)
    if (this.dynamites) this.dynamites.length = 0;
    this.game.events.off('blur', this._onBlur);
    this.scene.stop('HUD');
    if (window.__dw && window.__dw.scene === this) window.__dw = null;
  }

  // -------------------------------------------------------------------------------------------- frame loop
  update(time, delta) {
    if (!this.player) return;
    const real = Math.min(delta / 1000, 1 / 30);
    if (this.fx.frozen) return;
    const dt = real * this.timeScale;
    if (this.transitioning) { this._look.x = this._look.y = 0; return; }
    this.updateCamera(real);
    if (this.cutscene) { this.player.syncVisual(); return; }
    const edt = dt * this.enemyTimeScale;
    if (!this.player.dead || this.player.deathT < 5) this.run.time += real;

    this.player.update(dt, this.gameInput);
    const room = this.room;
    if (room) room.update(dt);
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) { const e = list[i]; if (e && e.alive) e.update(edt); }
    this.bullets.player.update(dt);
    this.bullets.enemy.update(edt);
    this.fx.update(dt);
    for (const d of [...this.dynamites]) d.update(dt);
    Audio.heartbeat(!this.player.dead && this.player.hp + this.player.tin <= 2);
  }

  /** Subtle camera lookahead (<= FEEL.lookahead px) toward the aim direction, else the movement direction. HUD is its own camera and is unaffected. */
  updateCamera(dt) {
    const p = this.player, L = this._look, cam = this.cameras.main;
    let tx = 0, ty = 0;
    if (!this.cutscene && !p.dead && !p.locked && !p.forced) {
      const aim = this.gameInput.aim(p);
      if (aim) { tx = aim.x; ty = aim.y; } else { const m = this.gameInput.move; tx = m.x * 0.6; ty = m.y * 0.6; }
    }
    const k = 1 - Math.exp(-FEEL.lookaheadRate * dt);
    L.x += (tx * FEEL.lookahead - L.x) * k; L.y += (ty * FEEL.lookahead - L.y) * k;
    cam.setScroll(Math.round(L.x * 2) / 2, Math.round(L.y * 2) / 2);
  }

  // -------------------------------------------------------------------------------------------- flow helpers
  pauseGame() {
    if (this.paused || this.ended || !this.player || this.player.dead) return;
    this.paused = true;
    this.scene.launch('Pause');
    this.scene.pause('HUD');
    this.scene.pause();
  }
  resumeGame() {
    this.paused = false;
    this.scene.resume('HUD');
    this.scene.resume();
    this.gameInput.reset();
  }

  slowMo(scale, seconds) {
    this.timeScale = scale;
    const token = (this._slowToken = (this._slowToken || 0) + 1);
    // only the most recent slow-mo may restore normal speed (overlapping calls used to cancel each other early)
    this.time.delayedCall(seconds * 1000, () => { if (token === this._slowToken) this.timeScale = 1; });
  }

  /**
   * Boss / mini intro: the world is held for the card's own length (`introData().ms`: Scratch 4600 with the card slam; else 2900 boss / 1500 mini, the
   * lengths Cards draws). Cards emits `boss:intro:skip` when a key ends its card early; the fight then starts at once.
   */
  beginBossIntro(boss) {
    this.cutscene = true;
    this.player.vx = this.player.vy = 0;
    const data = boss.introData();
    const ms = Math.max(600, +data.ms || (data.mini ? BOSS_INTRO_MS.mini : data.slam ? BOSS_INTRO_MS.final : BOSS_INTRO_MS.boss));
    data.ms = ms;
    let done = false;
    const release = () => {
      if (done) return;
      done = true;
      if (this._introRelease === release) this._introRelease = null;
      this.cutscene = false;
      if (boss.alive && !boss.dying) boss.startFight();
    };
    this._introRelease = release;
    bus.emit('boss:intro', data);
    playMusicFor(track(boss.meta.music || 'boss'));
    this.time.delayedCall(ms, release);
  }

  /** A boss or mini boss died (after its own death sequence): flow.js decides what happens next. */
  onBossDefeated(boss) { flow.onBossDefeated(this, boss); }

  onPlayerDied() {
    Audio.heartbeat(false);
    playMusicFor('death', { fade: 300 });
    this.slowMo(0.5, 1.0);
    this.time.delayedCall(2400, () => this.endRun('death'));
  }

  endRun(variant) {
    if (this.ended) return;
    this.ended = true;
    const r = this.run;
    const prevBest = Save.get().bestTime; // before recordRun: EndScene shows 'NEW BEST TIME' on a faster clear
    Save.recordRun({ floor: r.floor, time: r.time, kills: r.kills, won: variant === 'complete' });
    bus.emit('run:ended', { variant, ending: r.ending || null, won: variant !== 'death', stats: r.toJSON() });
    const payload = { variant, ending: r.ending || null, run: r.toJSON(), items: [...this.player.items, ...(this.player.active ? [this.player.active.id] : [])], seed: this.seed, best: { time: Save.get().bestTime, isNew: variant === 'complete' && (!prevBest || r.time < prevBest) } };
    if (SETUP && typeof SETUP.finishRun === 'function') {
      try { SETUP.finishRun(this, payload); } catch (e) { console.warn('[GameScene] finishRun failed', e); }
    }
    this.cameras.main.fadeOut(600, 13, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('HUD');
      this.stopOverlays();
      this.scene.start('End', payload);
    });
  }

  /** Music by room: shop, the boss track named in BOSS_META (uncleared boss room), otherwise the floor track. */
  updateMusic(opts) {
    const room = this.room;
    if (!room) return;
    if (this.roomMgr.inPocket) return; // the crossroads track belongs to the pocket (audio director)
    if (room.type === 'shop') playMusicFor('shop', opts);
    else if (room.type === 'boss' && !room.state.cleared) {
      const m = bossMeta(room.tpl.boss);
      playMusicFor(track((m && m.music) || 'boss'), opts);
    } else playMusicFor(FLOORS[this.floorNum].music || `floor${this.floorNum}`, opts);
  }
}
