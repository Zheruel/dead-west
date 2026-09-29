// Main gameplay scene: owns player, systems and the room manager; runs the fixed simulation order each frame.
import Phaser from 'phaser';
import { ROOM, FLOORS, MAX_FLOOR, FEEL, DEPTH, W, H } from '../config.js';
import { initSeed, getSeed } from '../core/rng.js';
import { bus } from '../core/events.js';
import { Sfx, Music, Audio, playMusicFor, MUSIC_FOR } from '../core/Audio.js';
import { Save } from '../core/Save.js';
import { flag } from '../core/util.js';
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
import { playFinale } from './finale.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  get room() { return this.roomMgr ? this.roomMgr.room : null; }

  create() {
    this.cameras.main.setBackgroundColor('#0d0806');
    this.cameras.main.setScroll(0, 0);
    this.seed = initSeed();
    this.run = new RunState(this.seed);
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

    // pause
    const pause = () => this.pauseGame();
    this.input.keyboard.on('keydown-ESC', pause);
    this.input.keyboard.on('keydown-P', pause);
    this.input.keyboard.on('keydown-TAB', (e) => e.preventDefault());

    // pause when the window loses focus (alt-tab must never get you killed)
    this._onBlur = () => { if (!this.ended && this.player && !this.player.dead) this.pauseGame(); };
    this.game.events.on('blur', this._onBlur);

    this.roomMgr.loadFloor(1);
    this.time.delayedCall(250, () => bus.emit('floor:intro', { floor: 1, name: FLOORS[1].name, subtitle: FLOORS[1].subtitle }));
    installDebug(this);

    this.events.once('shutdown', () => this.onShutdown());
    this.cameras.main.fadeIn(350, 13, 8, 6);
  }

  onShutdown() {
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

  beginBossIntro(boss) {
    this.cutscene = true;
    this.player.vx = this.player.vy = 0;
    const data = boss.introData();
    bus.emit('boss:intro', data);
    const key = boss.meta.music === 'boss_final' ? 'boss_final' : 'boss';
    playMusicFor(key);
    this.time.delayedCall(2100, () => {
      this.cutscene = false;
      if (boss.alive) boss.startFight();
    });
  }

  onBossDefeated(boss) {
    if (this.ended || (this.player && this.player.dead)) return; // the player died while the boss was dying: the death screen wins (no finale card / floor music over it)
    if (this.floorNum >= MAX_FLOOR) { playFinale(this); return; } // chapter finale: no reward/trapdoor, straight to the chapter-complete screen
    const room = this.room;
    if (room) room.onBossDefeated(boss);
    playMusicFor(`floor${this.floorNum}`, { fade: 1500 });
    if (this.floorNum >= MAX_FLOOR) {
      this.time.delayedCall(2600, () => { this.run.won = true; this.endRun('complete'); });
    }
  }

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
    bus.emit('run:ended', { variant, stats: r.toJSON() });
    const payload = { variant, run: r.toJSON(), items: [...this.player.items, ...(this.player.active ? [this.player.active.id] : [])], seed: this.seed, best: { time: Save.get().bestTime, isNew: variant === 'complete' && (!prevBest || r.time < prevBest) } };
    this.cameras.main.fadeOut(600, 13, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('HUD');
      this.scene.start('End', payload);
    });
  }

  /** Music by room type. */
  updateMusic() {
    const room = this.room;
    if (!room) return;
    if (room.type === 'shop') playMusicFor('shop');
    else if (room.type === 'boss' && !room.state.cleared) playMusicFor(room.tpl.boss === 'undertaker' ? 'boss_final' : 'boss');
    else playMusicFor(`floor${this.floorNum}`);
  }
}
