// Debug + automation hooks. window.__game (Phaser.Game) is set in main.js; window.__dw is installed per GameScene.
//   ?debug=1  -> F1 next floor, F2 heal, F3 random passive, F4 +99 coins/keys/dynamite, F5 kill all, F6 boss room, F7 god mode
//   URL flags read elsewhere: ?floor=1..6 ?seed=N ?char=<rider> ?mode=normal|hell ?noassets=1
//   Blocks below are delimited (`FN-1 core`, `FN-5 crossroads`); other jobs add theirs the same way through INTEGRATION_REQUESTS.
import { flag } from './util.js';
import { spawnEnemy, ENEMY_META } from '../enemies/index.js';
import { spawnBoss, BOSS_META } from '../bosses/index.js';
import { allItems } from '../items/index.js';
import { MAX_FLOOR } from '../config.js';
import { subRng } from './rng.js';
import { Music } from './Audio.js';
import { Boons } from '../systems/Boons.js';
import { openGate } from '../systems/Crossroads.js';
import * as flow from '../scenes/flow.js';

export function installDebug(scene) {
  const P = () => scene.player;
  const api = {
    killAll() { for (const e of [...scene.enemies]) { if (e.alive) { e.hp = 0; e.die({}); } } },
    // ---- FN-1 core: floors, rooms, spawning, music
    /** Jump to a room by id or by type ('boss', 'champion', 'event', 'secret', 'shop', 'treasure', 'supersecret', 'start'); 'xroads' enters the pocket. */
    jump(target) {
      const m = scene.roomMgr, f = m.floor;
      if (target === 'xroads') return api.enterCrossroads() ? 'xroads' : null;
      const room = f.byId[target] || f.rooms.find((r) => r.type === target);
      if (!room) return null;
      m.jump(room.id);
      return room.id;
    },
    teleport(roomId) { return api.jump(roomId); },
    /** Boss room of the current floor, or of floor `n` when given (loads it first). */
    bossRoom(n) { if (n != null && n !== scene.floorNum) api.setFloor(n); return api.jump('boss'); },
    musicKey() { return Music.current(); },
    giveItem(id) { return scene.items.pickup(P(), id, 'debug'); },
    randomPassive() {
      const owned = new Set(P().items);
      const c = allItems().filter((d) => d.type === 'passive' && !owned.has(d.id));
      const d = c[Math.floor(Math.random() * c.length)];
      if (d) api.giveItem(d.id);
      return d && d.id;
    },
    setFloor(n) {
      n = Math.max(1, Math.min(MAX_FLOOR, Math.round(+n) || 1));
      scene.roomMgr.loadFloor(n);
      scene.cameras.main.setScroll(0, 0);
      flow.afterFloorIntro(scene, { from: 0, floor: n });
      return n;
    },
    nextFloor() { return api.setFloor(scene.floorNum + 1); },
    /** Any registered enemy id (affixes/opts pass through); boss and mini ids spawn the boss with its intro card. */
    spawn(id, x, y, opts) {
      if (!ENEMY_META[id] && BOSS_META[id]) return api.spawnBoss(id, x, y);
      return spawnEnemy(scene, id, x ?? P().x + 200, y ?? P().y, { floor: scene.floorNum, instant: true, ...opts });
    },
    spawnBoss(id, x, y) {
      const room = scene.room;
      const b = spawnBoss(scene, id, x ?? P().x + 260, y ?? P().y, { floor: scene.floorNum });
      if (room && !room.boss) room.boss = b;
      scene.beginBossIntro(b);
      return b;
    },
    spawnMini(id) { return api.spawnBoss(id || Object.keys(BOSS_META).find((k) => BOSS_META[k].mini && BOSS_META[k].floor === scene.floorNum)); },
    godMode(b = true) { P().godMode = !!b; return P().godMode; },
    heal() { P().hp = P().maxHp; P().recomputeStats(); },
    hurt(n = 1) { return P().damage(n, { x: P().x + 1, y: P().y }); },
    give(n = 99) { const p = P(); p.coins = p.keys = p.dynamite = n; },
    input(o) { scene.gameInput.override = o; },
    openAll() { for (const r of scene.roomMgr.floor.rooms) for (const d of Object.values(r.doors)) { d.locked = false; d.revealed = true; } if (scene.room) { for (const d of Object.values(scene.room.doors)) d.refresh(false); scene.room.buildWallRects(); } scene.roomMgr.touchMap(); },
    clearRoom() { const r = scene.room; if (r) { api.killAll(); r.clearRoom(); } },
    revealMap() { for (const r of scene.roomMgr.floor.rooms) scene.roomMgr.stateFor(r.id).visited = true; scene.roomMgr.touchMap(); },
    die() { P().hp = 0; P().tin = 0; P().godMode = false; P().hurtT = 0; P().entryInv = 0; P().damage(1, { x: P().x, y: P().y }); },
    // ---- FN-5 crossroads (INTEGRATION_REQUESTS)
    /** Open the devil gate in the current room (the boss room on a real run). */
    openGate() { return scene.room ? !!openGate(scene, scene.room) : false; },
    enterCrossroads() { return scene.roomMgr.enterPocket(); },
    giveCurse(id) { return Boons.gainCurse(P(), subRng('debug'), id); },
    state() {
      const p = P(), r = scene.room, m = scene.roomMgr;
      return {
        floor: scene.floorNum, chapter: scene.chapter, seed: scene.seed, roomId: m.currentId, roomType: r && r.type, mod: r && r.def.mod, pocket: m.inPocket, music: Music.current(), locked: r && r.locked, cleared: r && r.state.cleared, mode: r && r.mode,
        hp: p.hp, tin: p.tin, maxHp: p.maxHp, coins: p.coins, keys: p.keys, dyn: p.dynamite, x: Math.round(p.x), y: Math.round(p.y), dead: p.dead,
        enemies: scene.enemies.map((e) => `${e.id}:${Math.round(e.hp)}`), bullets: scene.bullets.count, items: [...p.items], active: p.active,
        transitioning: scene.transitioning, cutscene: scene.cutscene, doors: r ? Object.fromEntries(Object.entries(r.doors).map(([k, d]) => [k, d.state])) : {},
        fps: Math.round(scene.game.loop.actualFps), stats: { ...p.stats },
      };
    },
  };
  window.__dw = {
    scene, api,
    get game() { return scene.game; },
    get player() { return scene.player; },
    get room() { return scene.room; },
    get floor() { return scene.roomMgr.floor; },
    get hud() { return scene.game.scene.getScene('HUD'); },
    get menu() { return scene.game.scene.getScene('Menu'); },
  };
  if (flag('debug')) {
    const kb = scene.input.keyboard;
    const on = (k, fn) => kb.on(`keydown-${k}`, (e) => { e.preventDefault(); fn(); });
    on('F1', () => api.nextFloor());
    on('F2', () => api.heal());
    on('F3', () => api.randomPassive());
    on('F4', () => api.give(99));
    on('F5', () => api.killAll());
    on('F6', () => api.bossRoom());
    on('F7', () => { api.godMode(!P().godMode); });
  }
}
