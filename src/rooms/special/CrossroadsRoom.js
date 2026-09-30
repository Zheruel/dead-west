// Crossroads pocket room controller (EVENTS 2.2-2.5, ARCH D6). Hosts the Dealer, three contract tables (L = item at its own price, C = item
// with an alternate payment, R = a pact) and the return portal. Every signing is a HoldRing (hold 0.9 s) on the table; standing on a table
// opens its contract card (DealPedestal). Offers are generated once per floor with subRng('offers', floor) and stored in `state.ctl.offers`
// (plain JSON), so leaving and re-entering shows the same tables with signed ones spent. Nothing here ever soft-locks: the portal is always
// usable and every unaffordable table just shows its reason.
import Controller from './Controller.js';
import HoldRing from '../../entities/HoldRing.js';
import HellGate from '../../entities/HellGate.js';
import Dealer from '../../entities/Dealer.js';
import DealPedestal from '../../entities/DealPedestal.js';
import { tileToWorld } from '../../config.js';
import { Sfx } from '../../core/Audio.js';
import { bus } from '../../core/events.js';
import { Boons } from '../../systems/Boons.js';
import { buildOffers, canAfford, pay, grantPact } from '../../systems/Crossroads.js';

const HOLD = 0.9;
const RING_R = 64;
const TABLE_TILES = [[2, 3], [6, 3], [10, 3]];
const DEALER_TILE = [6, 1];
const EXIT_TILE = [6, 5];
const HOVER_COOLDOWN = 6;
const LEAVE_DELAY = 0.85; // the Dealer's parting word before the portal fires

const slotXY = (list, i, fallback) => {
  if (list && list[i]) return tileToWorld(list[i].c, list[i].r);
  return tileToWorld(fallback[0], fallback[1]);
};

export default class CrossroadsRoom extends Controller {
  build() {
    const { scene, room, state } = this;
    const p = this.player;
    const floor = room.floor || scene.floorNum || 1;
    if (!state.offers) {
      state.offers = buildOffers({ floor, player: p, items: scene.items });
      state.visits = 0;
    }
    this.floor = floor;
    this.tables = [];
    this.rings = [];
    this.hoverCd = 0;
    this.lastNear = -1;
    this.signedVisit = 0;
    this.leaving = false;
    const track = (o) => this.track(o);

    // NPC and tables (template slots when present, the designed tiles otherwise)
    const slots = (room.tpl && room.tpl.slots) || {};
    const isl = (slots.I || []).slice().sort((a, b) => a.c - b.c);
    const k = slotXY(slots.K, 0, DEALER_TILE);
    this.dealer = new Dealer(scene, k.x, k.y, { seed: this.def.seed, track });
    state.offers.forEach((offer, i) => {
      const at = slotXY(isl.length === 3 ? isl : null, i, TABLE_TILES[i]);
      const table = new DealPedestal(scene, offer, room, { x: at.x, y: at.y, track });
      const ring = new HoldRing(room, {
        x: at.x, y: at.y + 8, r: RING_R, hold: HOLD, color: 0xd63a2a,
        canUse: () => this.canSign(i),
        onDone: () => this.sign(i),
      });
      if (offer.taken) ring.setVisible(false);
      this.tables.push(table);
      this.rings.push(ring);
    });

    // way back out
    const e = tileToWorld(EXIT_TILE[0], EXIT_TILE[1]);
    this.exit = new HellGate(scene, { x: e.x, y: e.y, exit: true, onTouch: (g) => this.onLeave(g) }, room);
    track(this.exit.glow); track(this.exit.sprite);
  }

  onEnter() {
    this.state.visits = (this.state.visits || 0) + 1;
    this.later(600, () => this.dealer.say('greet', this.ctx()));
  }

  /** Context for situational Dealer lines. */
  ctx() {
    const run = this.scene.run || {};
    return { char: run.char, floor: this.floor, mode: run.mode, deals: (run.deals || []).length, refused: run.dealsRefused || 0 };
  }

  // ---------------------------------------------------------------------------------------------------------- signing
  canSign(i) {
    if (this.leaving || !this.interactive) return false;
    const ok = canAfford(this.player, this.state.offers[i]);
    return ok === true ? true : ok; // string = grey ring + reason text
  }

  sign(i) {
    const { scene, state } = this;
    const offer = state.offers[i];
    const p = this.player;
    if (!offer || offer.taken || canAfford(p, offer) !== true) return;
    offer.taken = true;
    this.signedVisit++;
    const table = this.tables[i];
    const ring = this.rings[i];
    const run = scene.run;

    const paid = pay(p, offer.cost);
    if (paid.hearts) this.heartFx(table.x, table.y);
    let cursed = !!offer.cost.curse;

    // boon
    if (offer.kind === 'pact') {
      const before = p.curses ? p.curses.length : 0;
      grantPact(p, offer.pact, this.rng('pact', i));
      if (offer.pact === 'devils_dollar' && p.curses && p.curses.length > before) cursed = true;
    } else if (offer.kind === 'pity') {
      this.giveContainer(p);
    } else {
      if (offer.cost.curse) Boons.gainCurse(p, this.rng('curse', i));
      if (offer.itemId) scene.items.pickup(p, offer.itemId, 'deal');
    }
    if (run && Array.isArray(run.deals)) run.deals.push({ floor: this.floor, offer: offer.id, kind: offer.kind, itemId: offer.itemId || null, pact: offer.pact || null });

    bus.emit('deal:signed', { offerId: offer.id, kind: offer.kind, cost: paid, itemId: offer.itemId || null });
    bus.emit('deal:paid', { id: offer.itemId || offer.pact || offer.kind, pay: paid });

    // theatre
    Sfx.play('contract_sign');
    scene.fx.ringPulse(table.x, table.y + 8, 0xd63a2a, 220, 600, 0.7);
    scene.fx.burst(table.x, table.y - 40, { color: [0xff7a30, 0xd63a2a, 0xffd890], count: 16, speed: [60, 240], life: [300, 650], scale: [1.5, 3], blend: 'ADD' });
    this.dealer.laugh();
    this.dealer.say(cursed ? 'curse' : 'signed', this.ctx());
    ring.setVisible(false);
    table.refresh();
  }

  /** Free heart container (pity table): Player.collect('heart_container') when the engine has it, else a negative heart debt (= a bonus container). */
  giveContainer(p) {
    const ok = typeof p.collect === 'function' && p.collect('heart_container');
    if (!ok) {
      p.heartDebt = (p.heartDebt || 0) - 1;
      if (p.recomputeStats) p.recomputeStats();
    }
    p.hp = Math.min(p.maxHp, p.hp + 2);
  }

  /** Payment fx for heart containers: red flash, shattering heart burst, wet thud. */
  heartFx(x, y) {
    const { scene } = this;
    bus.emit('hud:flash', { color: 0xd63a2a, alpha: 0.35 });
    scene.fx.burst(x, y - 60, { color: [0xd63a2a, 0x8a1c1c, 0xffb0a0], count: 14, speed: [80, 260], life: [300, 600], scale: [2, 3.5], gravity: 420 });
    Sfx.play('heart_pay');
  }

  // ---------------------------------------------------------------------------------------------------------- leaving
  onLeave(gate) {
    const { scene } = this;
    if (this.leaving) return;
    this.leaving = true;
    const run = scene.run || {};
    const ctx = this.ctx();
    if (this.signedVisit === 0) {
      run.dealsRefused = (run.dealsRefused || 0) + 1;
      ctx.refused = run.dealsRefused;
      bus.emit('deal:refused', { offerId: 'all', reason: 'left' });
      this.dealer.say('refused', ctx);
    } else this.dealer.say('leaving', ctx);
    for (const r of this.rings) r.setVisible(false);
    this.later(LEAVE_DELAY * 1000, () => gate.go());
  }

  // ---------------------------------------------------------------------------------------------------------- frame
  update(dt) {
    super.update(dt);
    this.dealer.update(dt);
    for (let i = 0; i < this.tables.length; i++) this.tables[i].update(dt);
    this.exit.update(dt);
    // hover line + paper rustle when the player steps up to a table
    if (this.hoverCd > 0) this.hoverCd -= dt;
    let near = -1;
    for (let i = 0; i < this.tables.length; i++) if (!this.state.offers[i].taken && this.tables[i].near) { near = i; break; }
    if (near !== this.lastNear) {
      this.lastNear = near;
      if (near >= 0) {
        Sfx.play('contract_hover', { vol: 0.7 });
        if (this.hoverCd <= 0 && !this.dealer.talking && !this.leaving) { this.dealer.say('hover', this.ctx()); this.hoverCd = HOVER_COOLDOWN; }
      }
    }
  }

  destroy() {
    for (const r of this.rings || []) r.destroy();
    for (const t of this.tables || []) t.destroy();
    if (this.dealer) this.dealer.destroy();
    if (this.exit) this.exit.destroy();
    super.destroy();
  }
}
export { CrossroadsRoom };
