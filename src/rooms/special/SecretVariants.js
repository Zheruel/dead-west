// Secret-room variants and breakable-wall tells (EVENTS 8.1 / 8.2). Room hosts `VARIANTS[def.variant]` for `secret` rooms (role 'variant', state = room.state.ctl)
// and `Tells` in any room that still has an unrevealed secret door carrying `door.data.tell` (role 'tells', state = ctl.tells).
//   dead_mans_hand  five face-down cards (C slots): take ONE (hold 0.8), it flips, the other four burn. A spades = item, A clubs = heart container, 8 spades = 3 keys,
//                   8 clubs = full heal + 2 tin hearts, J diamonds ("the devil's fifth card") = a curse AND a crossroads-pool item.
//   cache           8 crates (B) each guaranteeing a pickup, 3 powder barrels (Z) in the middle, one crate holds a wooden chest. Dynamite is not refunded.
//   shrine          bone altar + a secret-pool item pedestal (100 %) ringed by retracting spikes (the room's `s` tiles): the reward is guaranteed.
// Tells: crack (hairline cracks; brittle doors open after 12 bullet hits, counted by Room.onWallHit), knock (hollow tock within 130 px every 4 s), chalk (chalk X).
// Persistent state: variant `state.v`, tells `state.hinted`. Rewards are written to the room state (pickups / pedestals / chests), never rolled twice.
import { EventBase, cellOr, cardFace, cardBack, flipCard, ROOM, DEPTH, actorDepth } from './events/common.js';
import { shuffleHand, handCard, CACHE } from './events/tables.js';
import Controller from './Controller.js';
import { Sfx } from '../../core/Audio.js';
import { bus } from '../../core/events.js';
import { RNG, subRng, hashStr } from '../../core/rng.js';
import { Boons } from '../../systems/Boons.js';

/** Base of the three variants: EventBase helpers with the data slot `state.v` (state is the shared room ctl object). */
class Variant extends EventBase {
  get data() { return this.state.v || (this.state.v = {}); }
  pool(pool, slot) { return this.scene.items.roll(pool, subRng('item', this.def.seed, slot)); }
}

// ================================================================================================================ dead man's hand
class DeadMansHand extends Variant {
  build() {
    const d = this.data;
    const spots = this.spots('C', [[3, 4], [4, 3], [6, 2], [8, 3], [9, 4]]).slice(0, 5);
    if (!d.order) { d.order = shuffleHand(this.rng('hand')); d.picked = -1; }
    this.cards = spots.map((at, i) => {
      const img = this.track(this.scene.add.image(at.x, at.y + 6, cardBack(this.scene)).setDepth(actorDepth(at.y + 40)));
      img.setScale(1.05);
      const c = { i, at, img, ring: null };
      c.ring = this.ring({
        x: at.x, y: at.y + 6, r: 54, hold: 0.8, color: 0xd8c89a, label: i === 0 ? 'TAKE ONE' : '',
        canUse: () => this.interactive && d.picked < 0, onDone: () => this.pick(i),
      });
      if (d.picked >= 0) {
        c.ring.setVisible(false);
        if (d.picked === i) img.setTexture(this.faceOf(i));
        else img.setVisible(false);
      }
      return c;
    });
    if (d.picked < 0) this.tag = this.label(ROOM.cx, (spots.length ? Math.min(...spots.map((q) => q.y)) : 400) - 130, 'ONE CARD. THE REST BURN.', { size: 22, color: '#d8c89a' });
  }

  faceOf(i) { const c = handCard(this.data.order[i]); return cardFace(this.scene, c.rank, c.suit); }

  pick(i) {
    const { scene, data: d, room } = this;
    if (d.picked >= 0 || !this.cards[i]) return;
    d.picked = i;
    const card = handCard(d.order[i]);
    const c = this.cards[i];
    for (const o of this.cards) o.ring.setVisible(false);
    if (this.tag) { this.tag.destroy(); this.tag = null; }
    flipCard(scene, c.img, this.faceOf(i), 260);
    Sfx.play('card_flip');
    // the other four burn to ash
    for (const o of this.cards) {
      if (o === c) continue;
      scene.fx.burst(o.at.x, o.at.y, { color: [0xff9a30, 0xffd060, 0x333333], count: 14, speed: [30, 150], gravity: -120, life: [350, 800], blend: 'ADD' });
      scene.tweens.add({ targets: o.img, alpha: 0, tint: 0x222222, duration: 500, onComplete: () => o.img.setVisible(false) });
    }
    Sfx.play('card_burn');
    this.reward(card, c.at);
    this.state.done = true;
    bus.emit('secret:hand', { card: card.id });
  }

  reward(card, at) {
    const { scene, room } = this;
    const p = this.player;
    const x = at.x, y = at.y + 70;
    let text = '';
    switch (card.reward) {
      case 'item': {
        const id = this.pool('secret', 50);
        if (id) this.pedestal({ x, y, itemId: id }); else this.pickup('heart_container', x, y, { pop: true });
        text = "DEAD MAN'S HAND";
        break;
      }
      case 'container': this.pickup('heart_container', x, y, { pop: true }); text = "DEAD MAN'S HAND"; break;
      case 'keys': for (let k = 0; k < 3; k++) this.pickup('key', x + (k - 1) * 34, y, { pop: true }); text = "DEAD MAN'S HAND"; break;
      case 'heal': p.heal(p.maxHp); if (p.addTin) p.addTin(4); text = "DEAD MAN'S HAND"; break;
      default: { // devil: a curse and a crossroads-pool item
        Boons.gainCurse(p, this.rng('devil'));
        const id = this.pool('crossroads', 51);
        if (id) this.pedestal({ x, y, itemId: id }); else this.pickup('heart_full', x, y, { pop: true });
        text = "THE DEVIL'S FIFTH CARD";
        scene.fx.flash(0x8a1c1c, 0.3);
        break;
      }
    }
    room.banner(text, { color: card.reward === 'devil' ? '#d63a2a' : '#c8a8f0', hold: 1600 });
    // STORY 11.3 card_sharp.dead_mans_hand: aces and eights spoken over the reward (the devil's fifth card keeps its own banner)
    if (card.reward !== 'devil') this.speak('dead_mans_hand', { ev: 'card_sharp', at: { x: ROOM.cx, y: ROOM.y + 130 }, delay: 1900 });
    scene.fx.ringPulse(at.x, at.y, card.reward === 'devil' ? 0xd63a2a : 0xf0d060, 90, 600, 0.8);
    scene.fx.flash(0x6a3aa0, 0.15);
  }
}

// ================================================================================================================ cache
class Cache extends Variant {
  build() {
    const d = this.data;
    const tiles = [];
    for (const row of this.room.tiles) for (const t of row) if (t.ch === 'B') tiles.push(t);
    tiles.sort((a, b) => a.c - b.c || a.r - b.r);
    this.crates = tiles;
    if (!d.paid) { d.paid = {}; d.chest = tiles.length ? this.rng('crate').int(0, tiles.length - 1) : -1; }
    this.tag = null;
    if (!Object.keys(d.paid).length && tiles.length) this.tag = this.label(ROOM.cx, ROOM.y + 60, 'SOMETHING VOLATILE IN THE MIDDLE', { size: 20, color: '#e0b878' });
  }

  update(dt) {
    super.update(dt);
    const d = this.data, room = this.room;
    for (let i = 0; i < this.crates.length; i++) {
      const t = this.crates[i];
      const key = `${t.c},${t.r}`;
      if (!t.broken || d.paid[key]) continue;
      d.paid[key] = 1;
      if (this.tag) { this.tag.destroy(); this.tag = null; }
      const type = room.rollPickup(CACHE.pickupBonus, true);
      this.pickup(type, t.x, t.y, { pop: true });
      if (i === d.chest) { room.spawnChest('chest_wood', t.x, t.y + 20); this.scene.fx.ringPulse(t.x, t.y, 0xf0d060, 70, 500, 0.7); }
    }
  }
}

// ================================================================================================================ shrine
class Shrine extends Variant {
  build() {
    const d = this.data;
    const at = this.spots('I', [[6, 3]])[0];
    const altar = this.track(cellOr(this.scene, 'props_events', 'altar_shrine', at.x, at.y + 50, {
      scale: 0.5, size: [160, 160],
      draw: (c) => { c.fillStyle = '#d8ccb0'; c.strokeStyle = '#120c0a'; c.lineWidth = 5; c.beginPath(); c.roundRect(24, 84, 112, 56, 10); c.fill(); c.stroke(); c.fillStyle = '#e8dcc0'; c.beginPath(); c.arc(80, 60, 22, 0, 7); c.fill(); c.stroke(); },
    }));
    altar.setDepth(DEPTH.floor + 1);
    if (!d.given) {
      d.given = true;
      const id = this.pool('secret', 52);
      if (id) this.room.spawnPedestal({ x: at.x, y: at.y, itemId: id, price: null, group: null, taken: false });
      else this.room.dropPickup('heart_container', at.x, at.y, { pop: true });
    }
    this.label(at.x, at.y + 190, 'WAIT FOR THE GAP', { size: 20, color: '#c8b898' });
  }
}

export const VARIANTS = { dead_mans_hand: DeadMansHand, cache: Cache, shrine: Shrine };

// ================================================================================================================ tells
const HINT_R = 230;
const KNOCK_R = 130;
const KNOCK_EVERY = 4;

/** Point on the wall band of a door plus the two unit vectors: `t` along the wall, `n` into the room. */
function wallFrame(g) { return { x: g.x, y: g.y, tx: g.dy !== 0 ? 1 : 0, ty: g.dx !== 0 ? 1 : 0, nx: -g.dx, ny: -g.dy }; }

export class Tells extends Controller {
  build() {
    const { room, scene } = this;
    const st = this.state;
    st.hinted = st.hinted || {};
    this.list = [];
    for (const d of room.secretDoors()) {
      const tell = d.data.tell;
      const w = wallFrame(d.geom);
      const it = { d, tell, w, key: d.dir, objs: [], knockT: 1, gone: false };
      if (tell === 'crack') this.drawCracks(it);
      else if (tell === 'chalk') this.drawChalk(it);
      this.list.push(it);
    }
  }

  drawCracks(it) {
    const { scene } = this;
    const { x, y, tx, ty, nx, ny } = it.w;
    const r = new RNG(hashStr(`crack:${this.def.id}:${it.key}`) ^ (this.def.seed >>> 0));
    const g = scene.add.graphics().setDepth(DEPTH.floor + 1);
    const n = r.int(3, 5);
    g.lineStyle(3, 0x120c0a, 0.6);
    for (let k = 0; k < n; k++) {
      let px = x + tx * (k - (n - 1) / 2) * 26 + r.float(-6, 6) * tx;
      let py = y + ty * (k - (n - 1) / 2) * 26 + r.float(-6, 6) * ty;
      g.beginPath(); g.moveTo(px, py);
      const segs = r.int(3, 5);
      for (let s = 0; s < segs; s++) {
        const along = r.float(-14, 14), inward = r.float(10, 22);
        px += tx * along + nx * inward; py += ty * along + ny * inward;
        g.lineTo(px, py);
      }
      g.strokePath();
    }
    this.track(g);
    it.objs.push(g);
  }

  drawChalk(it) {
    const { scene } = this;
    const { x, y, nx, ny } = it.w;
    const im = cellOr(scene, 'props_small', 'chalk_x', x + nx * 22, y + ny * 22 + 40, {
      scale: 1.1, size: [96, 96],
      draw: (c, w, h) => { c.strokeStyle = '#efe8d8'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(24, 24); c.lineTo(72, 72); c.moveTo(72, 24); c.lineTo(24, 72); c.stroke(); },
    });
    im.setAlpha(0.8).setDepth(DEPTH.floor + 1);
    this.track(im);
    it.objs.push(im);
  }

  hint(it) {
    const st = this.state;
    if (st.hinted[it.key]) return;
    st.hinted[it.key] = true;
    bus.emit('secret:hint', { tell: it.tell });
  }

  update(dt) {
    super.update(dt);
    const p = this.player;
    if (!p || p.dead) return;
    for (const it of this.list) {
      if (it.gone) continue;
      if (it.d.data.revealed) { // a passage was blasted / shot open: the tell has done its job
        it.gone = true;
        for (const o of it.objs) if (o.scene) this.scene.tweens.add({ targets: o, alpha: 0, duration: 400, onComplete: () => o.destroy() });
        continue;
      }
      const dist = Math.hypot(p.x - it.d.geom.x, p.y - it.d.geom.y);
      if (it.tell !== 'knock') { if (dist < HINT_R) this.hint(it); continue; }
      if (dist > KNOCK_R) { it.knockT = Math.min(it.knockT, KNOCK_EVERY); continue; }
      it.knockT -= dt;
      if (it.knockT > 0) continue;
      it.knockT = KNOCK_EVERY;
      const g = it.d.geom;
      Sfx.play('wall_knock', { detune: -200 });
      this.scene.fx.dust(g.x - g.dx * 30, g.y - g.dy * 30, 0.5);
      this.hint(it);
    }
  }
}

// ================================================================================================================ peddler hint
const COMPASS = ['EAST', 'SOUTH-EAST', 'SOUTH', 'SOUTH-WEST', 'WEST', 'NORTH-WEST', 'NORTH', 'NORTH-EAST']; // screen angle order: 0 rad = east, y grows southward
const HINT_CHANCE = 0.35;

/** Compass name of the direction from room a to room b on the floor grid. */
export function compass(a, b) {
  const ang = Math.atan2(b.gy - a.gy, b.gx - a.gx);
  return COMPASS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
}

/** 35 % of shops: on first entry the Peddler mumbles which way the secret room lies (text only). Deterministic per shop (subRng). */
function shopHint({ room, first }) {
  try {
    if (!first || !room || room.type !== 'shop' || room.destroyed) return;
    const floor = room.scene.roomMgr && room.scene.roomMgr.floor;
    if (!floor || !floor.secretId) return;
    if (!subRng('shophint', room.def.seed).chance(HINT_CHANCE)) return;
    const sec = floor.rooms.find((r) => r.id === floor.secretId);
    if (!sec || room.state.shopHinted) return;
    room.state.shopHinted = true;
    const k = room.peddler;
    const x = k ? k.x : ROOM.cx, y = (k ? k.y : ROOM.y + 160) - 190;
    room.scene.time.delayedCall(900, () => {
      if (room.destroyed || room.scene.room !== room) return;
      room.scene.fx.text(x, y, `SOMETHING RATTLES TO THE ${compass(room.def, sec)}`, { color: '#c8b0e0', size: 24, time: 3600, rise: 16 });
    });
  } catch (e) { console.error('[SecretVariants] peddler hint failed', e); }
}
// Room hosts no controller in shops, so the hint listens to the room:entered broadcast (module is loaded once, eagerly, by Room.js).
if (typeof globalThis !== 'undefined' && !globalThis.__dwShopHint) { globalThis.__dwShopHint = true; bus.on('room:entered', shopHint); }

export default { VARIANTS, Tells };
