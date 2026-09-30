// Floor pickup: pops out, settles, bobs, magnets to the player, collected on touch. Optional shop `price`.
import Actor from './Actor.js';
import { DEPTH, ROOM, FONT_BODY } from '../config.js';
import { Assets } from '../core/Assets.js';
import { tryBuy } from './Shop.js';

const TEXT = { heart_full: '+1 HEART', heart_half: '+1/2 HEART', heart_tin: '+TIN', heart_container: '+1 HEART CONTAINER', coin: '+1', coin_nickel: '+5', key: '+1 KEY', dynamite: '+1 DYNAMITE' };

export default class Pickup extends Actor {
  /** o: {price (base price in coins), from:{x,y}, pop:boolean, vx, vy} */
  constructor(scene, type, x, y, o = {}) {
    super(scene, x, y, { radius: 18, footOffset: 10, shadowScale: 0.28 });
    this.type = type;
    this.basePrice = o.price ?? null;
    this.alive = true;
    this.z = 0;
    this.vz = 0;
    this.settled = true;
    this.age = 0;
    this.denyCd = 0;
    // heart_container has no art of its own: a gold-tinted, larger full heart (real art can be added to the pickups sheet later)
    const container = type === 'heart_container';
    this.sprite = Assets.makeCell(scene, x, y, 'pickups', container && !Assets.names('pickups').includes(type) ? 'heart_full' : type, 0.5);
    this.sprite.setScale(container ? 1.15 : type.startsWith('heart') || type === 'dynamite' ? 0.95 : 0.9);
    if (container && !Assets.names('pickups').includes(type)) this.sprite.setTint(0xffd860);
    if (o.pop) {
      const a = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 130;
      this.vx = o.vx ?? Math.cos(a) * sp;
      this.vy = o.vy ?? Math.sin(a) * sp;
      this.vz = 380 + Math.random() * 120;
      this.settled = false;
      this.z = 4;
    }
    this.label = null;
    if (this.basePrice != null) {
      this.label = scene.add.text(x, y + 34, '', { fontFamily: FONT_BODY, fontSize: '26px', color: '#f0d060', stroke: '#120c0a', strokeThickness: 5 }).setOrigin(0.5).setDepth(DEPTH.pickups + 2);
      this.refreshPrice();
    }
    this.syncVisual();
  }

  get price() { return this.basePrice == null ? null : this.scene.player.price(this.basePrice); }
  refreshPrice() { if (this.label) { const p = this.price; if (p !== this._shown) { this._shown = p; this.label.setText(`${p}c`); } } }
  snapshot() { return { type: this.type, x: this.x, y: this.y, price: this.basePrice }; }

  update(dt) {
    if (!this.alive) return;
    this.age += dt;
    const p = this.scene.player;
    if (!this.settled) {
      this.vz -= 1100 * dt;
      this.z += this.vz * dt;
      this.moveBy(this.vx * dt, this.vy * dt);
      // a pop through an open door gap used to leave the pickup in the doorway / outside the room (uncollectable without leaving)
      this.x = Math.min(ROOM.right - 24, Math.max(ROOM.x + 24, this.x)); this.y = Math.min(ROOM.bottom - 24, Math.max(ROOM.y + 24, this.y));
      if (this.z <= 0) {
        this.z = 0;
        if (Math.abs(this.vz) > 160) { this.vz = -this.vz * 0.4; this.scene.fx.dust(this.x, this.y + 10, 0.32); } else { this.settled = true; this.vx = this.vy = 0; if (this.type.startsWith('coin')) this.scene.fx.burst(this.x, this.y - 14, { color: [0xffe090, 0xffffff], count: 3, speed: [20, 70], life: [200, 380], scale: [1, 2], blend: 'ADD' }); }
        this.vx *= 0.6; this.vy *= 0.6;
      }
    } else if (this.basePrice == null && p && !p.dead && this.age > 0.35 && p.canCollect(this.type)) {
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < 130) {
        const sp = 260 + (130 - d) * 4;
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        this.moveBy(Math.cos(a) * sp * dt, Math.sin(a) * sp * dt);
      }
    }
    this.sprite.setPosition(this.x, this.y - 14 - this.z - (this.settled ? Math.sin(this.age * 3 + this.x) * 2.5 : 0));
    const fx = this.scene.fx;
    this.sprite.setDepth(fx.lit(DEPTH.pickups)); // stays visible in darkness rooms
    this.shadow.setPosition(this.x, this.y + 12).setDepth(DEPTH.shadows);
    this.shadow.setScale(this.shadowScale * (1 - Math.min(0.5, this.z / 200)));
    if (this.label) { this.label.setPosition(this.x, this.y + 40).setDepth(fx.lit(DEPTH.pickups + 2)); this.refreshPrice(); }
    if (this.denyCd > 0) this.denyCd -= dt;
    // touch
    if (this.settled && this.age > 0.3 && p && !p.dead) {
      const rr = p.radius + this.radius + 4;
      if ((p.x - this.x) ** 2 + (p.y - this.y) ** 2 < rr * rr) this.touch(p);
    }
  }

  touch(p) {
    if (!p.canCollect(this.type)) return;
    if (this.basePrice != null) {
      if (this.denyCd > 0) return;
      if (!tryBuy(this.scene, p, this.price, this)) { this.denyCd = 1.2; return; }
    }
    if (p.collect(this.type)) this.pickedUp();
  }

  pickedUp() {
    this.alive = false;
    const s = this.scene;
    const txt = TEXT[this.type];
    if (txt) s.fx.text(this.x, this.y - 40, txt, { size: 22, color: this.type.startsWith('heart') ? '#ff8a7a' : '#f0e0a0' });
    const heart = this.type.startsWith('heart');
    if (this.type === 'heart_container') s.fx.ringPulse(this.x, this.y, 0xf0d060, 90, 500, 0.8);
    s.fx.burst(this.x, this.y - 16, { color: heart ? [0xff8a7a, 0xffd8c8, 0xffffff] : this.type === 'key' ? [0xf0e0a0, 0xffffff] : this.type === 'dynamite' ? [0xff7a30, 0xffd060] : [0xffe090, 0xf0c040, 0xffffff], count: heart ? 8 : 6, speed: [40, 160], life: [250, 500], scale: [1.2, 2.6], gravity: heart ? -80 : 60, blend: 'ADD' });
    s.tweens.add({ targets: this.sprite, y: this.sprite.y - 30, alpha: 0, scale: 1.3, duration: 220, onComplete: () => this.destroy() });
    if (this.label) this.label.destroy();
    if (this.shadow) { this.shadow.destroy(); this.shadow = null; }
    const room = s.room;
    if (room) room.removePickup(this);
  }

  destroy() {
    this.alive = false;
    if (this.label) { this.label.destroy(); this.label = null; }
    super.destroy(); // sprite + shadow
    this.sprite = null;
  }
}
