// Chest: wooden (free) or golden (needs a key). Persisted via rec {x,y,type:'chest_wood'|'chest_gold',opened}.
import { DEPTH, actorDepth } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';
import { rng, subRng } from '../core/rng.js';
import { bus } from '../core/events.js';

export default class Chest {
  constructor(scene, rec, room) {
    this.scene = scene; this.rec = rec; this.room = room;
    this.x = rec.x; this.y = rec.y;
    this.age = 0;
    this.denyCd = 0;
    this.shadow = scene.add.image(this.x, this.y + 26, 'shadow').setScale(0.5).setDepth(DEPTH.shadows);
    this.sprite = Assets.makeCell(scene, this.x, this.y + 30, 'pickups', rec.opened ? 'chest_open' : rec.type, 1).setScale(1.5).setDepth(actorDepth(this.y + 30));
  }
  get objs() { return [this.shadow, this.sprite]; }

  update(dt) {
    this.age += dt;
    if (this.denyCd > 0) this.denyCd -= dt;
    const p = this.scene.player;
    if (this.rec.opened || !p || p.dead || this.age < 0.4) return;
    if (Math.hypot(p.x - this.x, p.y - this.y) < p.radius + 40) this.open(p);
  }

  open(p) {
    const rec = this.rec;
    if (rec.type === 'chest_gold' && !rec.free) { // rec.free: mini-boss reward chest opens on touch without a key
      if (p.keys <= 0) {
        if (this.denyCd <= 0) { this.denyCd = 1; Sfx.play('door_locked'); this.scene.fx.text(this.x, this.y - 50, 'NEEDS A KEY', { color: '#e8c84a', size: 22 }); }
        return;
      }
      p.keys--;
      Sfx.play('door_unlock');
      bus.emit('key:used', { room: this.room.def && this.room.def.id, chest: true });
    }
    rec.opened = true;
    Sfx.play('coffin_open', { vol: 0.9, rate: 1.25 }); // creak + thump (wooden lid)
    this.sprite.setFrame(Assets.frame('pickups', 'chest_open'));
    this.scene.fx.burst(this.x, this.y - 10, { color: [0xffe090, 0xffffff], count: 16, speed: [80, 260] });
    const gold = rec.type === 'chest_gold';
    bus.emit('chest:opened', { room: this.room.def && this.room.def.id, gold, free: !!rec.free, x: this.x, y: this.y }); // Meta chests counter / achievements
    const n = gold ? rng.game.int(3, 4) : rng.game.int(1, 3);
    for (let i = 0; i < n; i++) this.room.dropPickup(this.room.rollPickup(gold ? 1.5 : 0.5, true), this.x, this.y + 10);
    if (gold && rng.game.chance(0.2)) {
      const id = this.scene.items.roll('treasure', subRng('item', (this.room.def && this.room.def.seed) ?? 0, 60 + (rec.slot | 0))); // D15: per-room seeded item roll
      if (id) this.room.spawnPedestal({ x: this.x, y: this.y + 110, itemId: id, price: null, group: null, taken: false });
    }
  }
  destroy() { this.shadow.destroy(); this.sprite.destroy(); }
}
