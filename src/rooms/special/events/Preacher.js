// The Confessional (EVENTS 3.5): a ghost preacher and three altars, a pick-one group (taking one snuffs the others), each a 1.2 s hold ring.
//   Communion   2 hp units (needs >= 3 hp, never kills): 78 % a blessing, 14 % false prophet (cost kept AND a curse), 8 % miracle (blessing + full heal)
//   Absolution  free: strips every curse and pays 1 tin heart per curse (max 3); with no curses it is a Benediction (+2 tin units)
//   Plate       12 coins (price() applies): full heal, 25 % also a blessing
// Persistent (state.data): { chosen: 'communion' | 'absolution' | 'plate' | null }.
import { EventBase, cellOr, actorDepth } from './common.js';
import { rollCommunion, PLATE_BLESSING_CHANCE, PLATE_COST, COMMUNION_COST, ABSOLUTION_TIN_MAX } from './tables.js';
import { Sfx } from '../../../core/Audio.js';
import { bus } from '../../../core/events.js';
import { Boons } from '../../../systems/Boons.js';

const ALTARS = [
  { id: 'communion', color: 0xd63a2a, tint: 0xff9a8a },
  { id: 'absolution', color: 0xf0f0e8, tint: 0xffffff },
  { id: 'plate', color: 0xf0c860, tint: 0xffe090 },
];
const LINES = {
  enter: 'CONFESS, CHILD.',
  communion: ['THE BLOOD IS THE COVENANT.', 'A FALSE PROPHET. HIS DEBT IS YOURS.', 'A MIRACLE. DO NOT ASK TWICE.'],
  absolution: ['YOUR SINS ARE LIFTED.', 'YOU CARRY NO SIN. TAKE THIS ANYWAY.'],
  plate: ['THE LORD LOVES A CHEERFUL GIVER.'],
};

export default class Preacher extends EventBase {
  build() {
    const d = this.data;
    d.chosen = d.chosen || null;
    const spots = this.spots('I', [[3, 4], [6, 4], [9, 4]]);
    this.altars = ALTARS.map((a, i) => {
      const at = spots[i];
      const im = this.track(cellOr(this.scene, 'props_deals', 'candelabra', at.x, at.y + 44, {
        scale: 0.7, size: [128, 128],
        draw: (c, w, h) => { c.fillStyle = '#4a3428'; c.strokeStyle = '#120c0a'; c.lineWidth = 5; c.beginPath(); c.roundRect(34, 70, 60, 46, 8); c.fill(); c.stroke(); c.fillStyle = '#f0c860'; c.beginPath(); c.ellipse(64, 50, 8, 18, 0, 0, 7); c.fill(); c.stroke(); },
      }));
      im.setDepth(actorDepth(at.y + 40));
      const ring = this.ring({ x: at.x, y: at.y + 8, r: 60, hold: 1.2, color: a.color, label: '', canUse: () => this.canUse(a.id), onDone: () => this.take(a.id) });
      const alt = { ...a, at, im, ring };
      if (d.chosen && d.chosen !== a.id) this.snuff(alt, false);
      else if (d.chosen === a.id) ring.setVisible(false);
      return alt;
    });
    this.refreshLabels();
    this.tagY = spots[0].y - 200;
    this.voice = null;
  }

  refreshLabels() {
    const p = this.player;
    for (const a of this.altars) {
      if (this.data.chosen) { a.ring.setLabel(''); continue; }
      const t = a.id === 'communion' ? `COMMUNION  -${COMMUNION_COST} HP`
        : a.id === 'absolution' ? (p.curses && p.curses.length ? 'ABSOLUTION  FREE' : 'BENEDICTION  FREE')
          : `THE PLATE  ${p.price(PLATE_COST)}c`;
      if (a.ring.label !== t) a.ring.setLabel(t);
    }
  }

  canUse(id) {
    if (!this.interactive || this.data.chosen) return false;
    const p = this.player;
    if (id === 'communion' && p.hp < COMMUNION_COST + 1) return 'TOO WEAK';
    if (id === 'plate' && p.coins < p.price(PLATE_COST)) return `NEED ${p.price(PLATE_COST)}c`;
    return true;
  }

  snuff(alt, fx = true) {
    alt.ring.setVisible(false);
    alt.im.setTint(0x555555);
    if (fx) { this.scene.fx.burst(alt.at.x, alt.at.y - 40, { color: [0x888888, 0x444444], count: 8, speed: [20, 80], gravity: -80, life: [400, 800] }); }
  }

  preach(text, color = '#c8d8e8') {
    const k = this.spots('K', [[6, 2]])[0];
    this.say(k.x, k.y - 150, text, color, 24);
  }

  take(id) {
    if (this.canUse(id) !== true) return;
    const { scene, data: d, state } = this;
    const p = this.player;
    d.chosen = id;
    state.uses = 1;
    for (const a of this.altars) { if (a.id !== id) this.snuff(a); else a.ring.setVisible(false); }
    this.refreshLabels();
    let outcome = id;
    if (id === 'communion') {
      p.hp = Math.max(1, p.hp - COMMUNION_COST);
      p.recomputeStats();
      bus.emit('hud:flash', { color: 0xd63a2a, alpha: 0.3 });
      const r = rollCommunion(this.rng('communion', 0));
      outcome = `communion_${r}`;
      if (r === 'false_prophet') { Boons.gainCurse(p, this.rng('communion-curse', 0)); this.preach(LINES.communion[1], '#d63a2a'); Sfx.play('curse_gain'); }
      else {
        Boons.gainBlessing(p, undefined, this.rng('communion-bless', 0));
        Sfx.play('blessing_gain');
        if (r === 'miracle') { p.heal(p.maxHp); this.preach(LINES.communion[2], '#f0d060'); scene.fx.flash(0xffe090, 0.3); } else this.preach(LINES.communion[0]);
      }
    } else if (id === 'absolution') {
      const n = p.curses ? p.curses.length : 0;
      if (n > 0) {
        let removed = 0;
        while (p.curses && p.curses.length) { if (!Boons.removeCurse(p)) break; removed++; }
        p.addTin(2 * Math.min(ABSOLUTION_TIN_MAX, removed));
        this.preach(LINES.absolution[0]);
        outcome = 'absolved';
      } else { p.addTin(2); this.preach(LINES.absolution[1]); outcome = 'benediction'; }
      Sfx.play('holy_chime');
      scene.fx.ringPulse(p.x, p.y, 0xf0f0e8, 120, 600, 0.6);
    } else {
      const cost = p.price(PLATE_COST);
      p.coins -= cost;
      state.net = -cost;
      p.heal(p.maxHp);
      if (this.rng('plate', 0).chance(PLATE_BLESSING_CHANCE)) { Boons.gainBlessing(p, undefined, this.rng('plate-bless', 0)); Sfx.play('blessing_gain'); }
      this.preach(LINES.plate[0]);
      Sfx.play('shop_buy');
    }
    this.finish(outcome);
  }

  onEnter() {
    if (!this.data.chosen && !this.state.greeted) { this.state.greeted = true; this.later(500, () => this.preach(LINES.enter)); }
  }

  update(dt) {
    super.update(dt);
    if (!this.data.chosen) this.refreshLabels();
  }
}
