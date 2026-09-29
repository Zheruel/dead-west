// Item pools, no-duplicates-in-run, pickup flow. scene.items.
//  * roll(pool)   : weighted unused item from a pool ('treasure'|'shop'|'boss'|'secret'); if that pool is exhausted it falls back to the
//                   other pools (so a shop / treasure / boss slot is never empty while any item is left); null = everything is taken
//                   (callers then drop consumables).
//  * pickup()     : gives the item, records it, emits 'item:picked' (HUD banner + jingle via AudioHooks) and plays the "hold it up" flourish.
import Phaser from 'phaser';
import { allItems, getItem } from './registry.js';
import { bus } from '../core/events.js';
import { Save } from '../core/Save.js';
import { rng } from '../core/rng.js';
import { Assets } from '../core/Assets.js';
import { DEPTH } from '../config.js';

const FALLBACK_ORDER = ['treasure', 'shop', 'boss', 'secret'];

export default class ItemSystem {
  constructor(scene) {
    this.scene = scene;
    this.taken = new Set(); // ids rolled or picked this run
  }

  /** Roll an unused item from a pool. Marks it as claimed. Returns id or null. opts: {type:'passive'|'active', fallback:true} */
  roll(pool, r = rng.game, { type, fallback = true } = {}) {
    const order = fallback ? [pool, ...FALLBACK_ORDER.filter((p) => p !== pool)] : [pool];
    const all = allItems();
    for (const p of order) {
      const cands = all.filter((d) => d.pool.includes(p) && !this.taken.has(d.id) && (!type || d.type === type));
      if (!cands.length) continue;
      const def = r.weighted(cands, (d) => d.weight ?? 1);
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
