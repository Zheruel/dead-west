// The Snake-Oil Salesman (EVENTS 3.6): three shelf potions at 5c (price() applies), each a 0.4 s hold ring. Six colours map to six effects by a
// per-run permutation (`subRng('potions')`, identical for every salesman of the run); `run.potionKnown[color]` remembers identified colours and
// the shelf then names the effect (unknown: ???). The three shelves show three distinct colours (`rng('shelf')`). 10 % of purchases are watered down.
// Persistent (state.data): { shelf: [color x3], bought: [bool x3], buys }.
import { EventBase, cellOr, addFloorBuff, actorDepth } from './common.js';
import { potionMap, shelfColors, POTION_HEX, POTION_NAME, POTION_PRICE, WATER_CHANCE } from './tables.js';
import { Sfx } from '../../../core/Audio.js';
import { bus } from '../../../core/events.js';
import { subRng } from '../../../core/rng.js';
import Dynamite from '../../../entities/Dynamite.js';
import { POTION_NAMES } from '../../../data/story/dialogue.js';


/** Apply the effect of potion `effect` to the player (also used by tests). */
export function drink(scene, p, effect) {
  switch (effect) {
    case 'p_heal': p.heal(4); break;
    case 'p_vigor': addFloorBuff(scene, p, 'potion_vigor', (s) => { s.damage += 0.8; }); break;
    case 'p_swift': addFloorBuff(scene, p, 'potion_swift', (s) => { s.moveSpeed += 80; s.fireDelay *= 0.85; }, 45); break;
    case 'p_venom':
      p.hp = Math.max(1, p.hp - 1); p.recomputeStats();
      addFloorBuff(scene, p, 'potion_venom', (s) => { s.poison += 4; });
      break;
    case 'p_laudanum':
      addFloorBuff(scene, p, 'potion_laudanum', (s) => { s.roomShield += 1; s.moveSpeed -= 70; });
      p.shieldLeft = Math.max(p.shieldLeft || 0, 1);
      break;
    case 'p_kerosene':
      p.dynamite = Math.min(99, p.dynamite + 3);
      new Dynamite(scene, p.x, p.y, { fuse: 1.4, playerDamage: p.stats.explosionImmune ? 0 : 2, owner: 'player' });
      break;
    default: break;
  }
}

export default class SnakeOil extends EventBase {
  build() {
    const d = this.data;
    if (!d.shelf) { d.shelf = shelfColors(this.rng('shelf')); d.bought = [false, false, false]; d.buys = 0; }
    this.map = potionMap(subRng('potions'));
    const spots = this.spots('I', [[4, 3], [6, 3], [8, 3]]);
    this.shelves = d.shelf.map((color, i) => {
      const at = spots[i];
      const im = this.track(cellOr(this.scene, 'props_small', 'potion_bottle', at.x, at.y + 34, {
        scale: 0.85, size: [96, 96],
        draw: (c) => { c.fillStyle = '#f0f0e8'; c.strokeStyle = '#120c0a'; c.lineWidth = 5; c.beginPath(); c.arc(48, 62, 26, 0, 7); c.fill(); c.stroke(); c.fillRect(40, 18, 16, 20); c.strokeRect(40, 18, 16, 20); },
      }));
      im.setTint(POTION_HEX[color]).setDepth(actorDepth(at.y + 30));
      const ring = this.ring({ x: at.x, y: at.y + 8, r: 52, hold: 0.4, color: POTION_HEX[color], label: '', canUse: () => this.canBuy(i), onDone: () => this.buy(i) });
      if (d.bought[i]) { im.setVisible(false); ring.setVisible(false); }
      return { color, im, ring, at, shown: '' };
    });
    this.refreshLabels();
  }

  known(color) { const r = this.scene.run; return !!(r && r.potionKnown && r.potionKnown[color]); }

  refreshLabels() {
    const p = this.player;
    this.shelves.forEach((s, i) => {
      if (this.data.bought[i]) return;
      const t = `${this.known(s.color) ? POTION_NAME[this.map[s.color]] : '???'}  ${p.price(POTION_PRICE)}c`;
      if (t !== s.shown) { s.shown = t; s.ring.setLabel(t); }
    });
  }

  canBuy(i) {
    if (!this.interactive || this.data.bought[i]) return false;
    const c = this.player.price(POTION_PRICE);
    return this.player.coins >= c ? true : `NEED ${c}c`;
  }

  buy(i) {
    if (this.canBuy(i) !== true) return;
    const { scene, data: d, state } = this;
    const p = this.player;
    const s = this.shelves[i];
    const cost = p.price(POTION_PRICE);
    p.coins -= cost;
    state.net = (state.net || 0) - cost;
    d.bought[i] = true;
    const n = d.buys++;
    state.uses = d.buys;
    s.im.setVisible(false);
    s.ring.setVisible(false);
    s.ring.setLabel('');
    Sfx.play('bottle_pop');
    scene.fx.burst(s.at.x, s.at.y - 30, { color: [POTION_HEX[s.color], 0xffffff], count: 12, speed: [50, 200], gravity: 200 });
    if (this.rng('water', n).chance(WATER_CHANCE)) {
      this.say(s.at.x, s.at.y - 90, 'TASTES LIKE WATER', '#a8c8e0');
      this.speak('watered_line', { delay: 700 });
    } else {
      const effect = this.map[s.color];
      const run = scene.run;
      if (run && run.potionKnown) run.potionKnown[s.color] = true;
      Sfx.play('potion_gulp');
      drink(scene, p, effect);
      this.say(s.at.x, s.at.y - 90, (POTION_NAMES[effect] || POTION_NAME[effect]).toUpperCase(), '#f0d060', 26); // STORY 11.3 potion name once identified
      bus.emit('potion:drunk', { color: s.color, effect });
      this.speak('buy', { delay: 700 });
    }
    this.refreshLabels();
    if (d.bought.every(Boolean)) { this.finish('bought_out'); this.speak('done', { delay: 3400 }); }
  }

  onEnter() {
    if (!this.state.greeted && !this.data.bought.every(Boolean)) { this.state.greeted = true; this.speak('greet', { delay: 1500 }); }
  }

  update(dt) { super.update(dt); this.refreshLabels(); }
}
