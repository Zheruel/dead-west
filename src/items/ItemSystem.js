// Item pools, no-duplicates-in-run, pickup flow, hook wiring. scene.items.
//  * roll(pool, rng, {type, floor, fallback}) : weighted unused item from a pool ('treasure'|'shop'|'boss'|'secret'|'crossroads'). Candidates pass the gate
//                   (Save.itemUnlocked), the c2 marker (floor >= 4), minFloor and charOnly; weight = def.weight x tier multiplier x build-coherence bias
//                   (x1.15 shares a tag with an owned item, x1.30 would activate a synergy). A non-crossroads pool that is exhausted falls back to the
//                   other pools (a slot is never empty while any item is left); crossroads never falls back. null = sold out.
//  * pickup()     : gives the item, records it, emits 'item:picked' (HUD banner + jingle via AudioHooks) and plays the "hold it up" flourish.
//  * canPay/pay   : crossroads `deal.pay` costs (static and instance).
//  * bus -> hooks : room:entered / room:wave / room:cleared / floor:changed run the item hooks (a same-frame duplicate from Room is dropped by hooks.js).
import Phaser from 'phaser';
import { allItems, getItem } from './registry.js';
import { CTX, runHooks, hasHook } from './hooks.js';
import { wouldComplete } from './synergies.js';
import { ownedIds } from './tags.js';
import { tierMult } from './baseStats.js';
import { onRoomCleared, onFloorChanged } from './fx/synergyFx.js';
import { bus } from '../core/events.js';
import { Save } from '../core/Save.js';
import { rng } from '../core/rng.js';
import { Assets } from '../core/Assets.js';
import { DEPTH } from '../config.js';

const FALLBACK_ORDER = ['treasure', 'shop', 'boss', 'secret']; // never crossroads
const BIAS_TAG = 1.15, BIAS_SYN = 1.3;
const DOWSE_KINDS = ['shop', 'treasure', 'boss', 'secret']; // stats.dowse > 0 reveals these room icons on the minimap (unvisited)

const unlocked = (id) => { try { return typeof Save.itemUnlocked === 'function' ? Save.itemUnlocked(id) !== false : true; } catch (e) { return true; } };

/** Can `player` pay `def.deal.pay` ({container, coins, keys, tin, dynamite})? Returns true, or the reason string. */
export function canPay(player, def) {
  const pay = def && def.deal && def.deal.pay;
  if (!pay) return true;
  if (pay.container && player.stats.maxHearts - pay.container < 1) return 'NEED MORE HEARTS';
  if (pay.coins && player.coins < pay.coins) return 'NEED COINS';
  if (pay.keys && player.keys < pay.keys) return 'NEED KEYS';
  if (pay.dynamite && player.dynamite < pay.dynamite) return 'NEED DYNAMITE';
  if (pay.tin && player.tin < pay.tin) return 'NEED TIN';
  return true;
}

/** Deduct `def.deal.pay`. Returns the paid amounts object, or null when it cannot be paid. Emits `deal:paid` only with {emit:true} (the crossroads room emits its own). */
export function payDeal(player, def, { emit = false } = {}) {
  if (canPay(player, def) !== true) return null;
  const pay = (def.deal && def.deal.pay) || {};
  if (pay.container) player.loseMaxHeart(pay.container);
  if (pay.coins) player.coins -= pay.coins;
  if (pay.keys) player.keys -= pay.keys;
  if (pay.dynamite) player.dynamite -= pay.dynamite;
  if (pay.tin) player.tin -= pay.tin;
  player.recomputeStats();
  if (emit) bus.emit('deal:paid', { id: def.id, pay: { ...pay } });
  return { ...pay };
}

export default class ItemSystem {
  constructor(scene) {
    this.scene = scene;
    this.taken = new Set(); // ids rolled or picked this run
    this._hurt = false; // damage taken in the current room (roomClear `perfect`)
    bus.scoped(scene, 'player:hurt', () => { this._hurt = true; });
    bus.scoped(scene, 'player:stats', () => { if (scene.player && scene.player.stats.dowse > 0) this.syncMap(); }); // pickup / restore of a dowsing item on the current floor
    bus.scoped(scene, 'room:entered', (p) => { this._hurt = false; this.syncMap(); this._fire('roomEnter', p && p.room); });
    bus.scoped(scene, 'room:wave', (p) => this._fire('wave', p && p.room, p && p.enemies));
    bus.scoped(scene, 'room:cleared', (p) => { try { onRoomCleared(scene); } catch (e) { console.error('[items] roomCleared fx', e); } this._fire('roomClear', p && p.room); });
    bus.scoped(scene, 'floor:changed', (p) => {
      const pl = scene.player;
      this.syncMap();
      try { onFloorChanged(scene, (p && p.floor) || scene.floorNum || 1); } catch (e) { console.error('[items] floor fx', e); }
      if (pl && hasHook(pl, 'floor')) { CTX.floor.floor = (p && p.floor) || scene.floorNum || 1; runHooks(pl, 'floor', CTX.floor); }
    });
  }

  /** stats.dowse (Dowsing Rod): shows every shop / treasure / boss / secret room on the minimap without visiting it (RoomManager.revealKinds; the reveal set is
   *  cleared on every loadFloor, so this runs again on floor:changed / room:entered / pickup). Safe to call any time. */
  syncMap() {
    const sc = this.scene, m = sc.roomMgr, pl = sc.player;
    if (!m || !pl || !(pl.stats.dowse > 0) || !m.revealKinds || !m.floor || this._dowseFloor === m.floor) return;
    this._dowseFloor = m.floor; // once per built floor object (loadFloor clears the reveal set and makes a new one)
    m.revealKinds(DOWSE_KINDS);
  }

  /** Fire a room hook through the shared ctx. */
  _fire(name, room, enemies) {
    const pl = this.scene.player;
    if (!pl || !hasHook(pl, name)) return;
    const c = CTX.room;
    c.room = room || this.scene.room || null; c.perfect = !this._hurt; c.enemies = enemies && enemies.length != null ? enemies.length : enemies || 0;
    runHooks(pl, name, c);
  }

  canPay(player, def) { return canPay(player, def); }
  pay(player, def, o) { return payDeal(player, def, o); }
  static canPay(player, def) { return canPay(player, def); }
  static pay(player, def, o) { return payDeal(player, def, o); }

  /** Would owning `id` complete a synergy for the current player? (pool bias, pedestal spark) */
  wouldComplete(id, player = this.scene.player) {
    if (!player || !getItem(id)) return false;
    return wouldComplete(ownedIds(player), id);
  }

  /** Roll an unused item from a pool. Marks it as claimed. Returns id or null. opts: {type:'passive'|'active', floor, fallback:true} */
  roll(pool, r = rng.game, { type, floor, fallback = true } = {}) {
    const fl = floor ?? this.scene.floorNum ?? 1;
    const deals = pool === 'crossroads';
    const order = deals || !fallback ? [pool] : [pool, ...FALLBACK_ORDER.filter((p) => p !== pool)];
    const player = this.scene.player;
    const owned = player ? ownedIds(player) : [];
    const tags = player ? player.tagCounts || {} : {};
    const all = allItems();
    for (const p of order) {
      const cands = all.filter((d) => d.pool.includes(p) && !this.taken.has(d.id) && (!type || d.type === type)
        && !(d.pool.includes('c2') && fl < 4) && fl >= (d.minFloor || 1) && (!d.charOnly || !player || d.charOnly === player.char) && unlocked(d.id));
      if (!cands.length) continue;
      const def = r.weighted(cands, (d) => {
        let w = d.weight ?? 1;
        if (deals) return w;
        w *= tierMult(d.tier, fl);
        if (player) {
          if (owned.length && this.wouldComplete(d.id, player)) w *= BIAS_SYN;
          else if (d.tags && d.tags.some((t) => tags[t] > 0 && !owned.includes(d.id))) w *= BIAS_TAG;
        }
        return w;
      });
      this.taken.add(def.id);
      return def.id;
    }
    return null;
  }
  /** Items still available anywhere. */
  remaining() { return allItems().filter((d) => !this.taken.has(d.id)).length; }
  /** Release a claimed-but-unused id back into the pool (e.g. the vanished pick-one pedestal). */
  release(id) { this.taken.delete(id); }
  markTaken(id) { this.taken.add(id); }

  /** Give an item to the player, fire the banner + events. Returns the previous active id if it was swapped out. */
  pickup(player, id, source = 'pedestal') {
    const def = getItem(id);
    if (!def) return null;
    this.taken.add(id);
    const prevActive = def.type === 'active' && player.active ? player.active.id : null;
    player.addItem(id);
    Save.seeItem(id);
    if (this.scene.run) this.scene.run.items.push(id);
    bus.emit('item:picked', { id, def, source });
    this.flourish(player, def);
    return prevActive;
  }

  /** The gunslinger holds the new item above his head for a moment (icon pops up, glows, floats away). */
  flourish(player, def) {
    const s = this.scene;
    if (!s || !s.add || !player.sprite) return;
    const ic = def.icon || { sheet: 'items_passive_a', name: def.id };
    const x = player.x, y = player.y - 110;
    const glow = s.add.image(x, y, 'glow').setTint(0xffe090).setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0).setDepth(DEPTH.overlay - 8);
    const icon = Assets.makeCell(s, x, y, ic.sheet, ic.name, 0.5).setScale(0.2).setAlpha(0).setDepth(DEPTH.overlay - 7);
    const ring = s.add.image(x, y, 'ring').setTint(0xffe090).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.8).setDepth(DEPTH.overlay - 8);
    for (const o of [glow, icon, ring]) o.__noSnap = true;
    const kill = () => { for (const o of [glow, icon, ring]) if (o.scene) o.destroy(); };
    s.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 500, ease: 'Cubic.easeOut' });
    s.tweens.add({ targets: glow, alpha: 0.7, scale: 2.4, duration: 260, yoyo: true, hold: 500 });
    s.tweens.add({ targets: icon, alpha: 1, scale: 1.25, y: y - 10, duration: 260, ease: 'Back.easeOut' });
    s.tweens.add({ targets: [icon, glow], alpha: 0, y: y - 60, delay: 900, duration: 380, onComplete: kill });
    s.fx.burst(x, y, { color: [0xffe090, 0xffffff, 0xf0a640], count: 18, speed: [80, 300], life: [300, 650], scale: [1.5, 3], gravity: 150 });
    s.fx.flash(0xffe090, 0.22);
    s.slowMo(0.3, 0.34); // brief slow-mo beat while the item is held up
    s.events.once('shutdown', kill);
  }
}
