// The Wishing Well (EVENTS 3.3): stand on the rim and a coin is thrown every 0.5 s (hold ring, repeating). Twelve throws at most; each resolves
// `rng('wish', n)`. The 12th throw always yields a treasure-pool pedestal and ends the well. Luck boon = +1 luck until the floor ends (max 3).
// Persistent (state.data): { throws, luck, pending: n, jackpot, silent }. A coin in the air is resolved when the room is left.
import { EventBase, addFloorBuff, ROOM, DEPTH } from './common.js';
import { WELL, rollWish } from './tables.js';
import { Assets } from '../../../core/Assets.js';
import { Sfx } from '../../../core/Audio.js';
import { Boons } from '../../../systems/Boons.js';
import { subRng } from '../../../core/rng.js';

const FLIGHT_MS = 300;

export default class WishingWell extends EventBase {
  build() {
    const d = this.data;
    d.throws = d.throws || 0;
    d.luck = d.luck || 0;
    this.silentShown = false;
    const rim = this.spots('I', [[6, 3]])[0];
    const k = this.spots('K', [[6, 2]])[0];
    this.wx = k.x; this.wy = k.y;
    this.ringObj = this.ring({
      x: rim.x, y: rim.y, r: 64, hold: 0.5, repeat: true, label: 'THROW A COIN', color: 0x80c8ff,
      canUse: () => this.canThrow(), onDone: () => this.throwCoin(),
    });
    this.coinTag = this.label(rim.x, rim.y + 84, '', { size: 20, color: '#f0d060' });
    if (d.pending != null) this.resolve(d.pending, true);
    if (d.throws >= WELL.maxThrows) this.ringObj.setVisible(false);
  }

  canThrow() {
    if (!this.interactive || this.data.throws >= WELL.maxThrows || this.data.pending != null) return false;
    if (this.player.coins < 1) return 'NO COINS';
    return true;
  }

  throwCoin() {
    if (this.canThrow() !== true) return;
    const { scene, data: d, state } = this;
    const p = this.player;
    p.coins -= 1;
    state.net = (state.net || 0) - 1;
    const n = d.throws++;
    state.uses = d.throws;
    d.pending = n;
    Sfx.play('well_wish');
    const coin = Assets.has('pickups') ? Assets.makeCell(scene, p.x, p.y - 30, 'pickups', 'coin', 0.5).setScale(0.8) : scene.add.image(p.x, p.y - 30, 'glow').setTint(0xf0d060).setScale(0.3);
    coin.setDepth(DEPTH.fx - 20);
    const x0 = p.x, y0 = p.y - 30, x1 = this.wx, y1 = this.wy - 50;
    scene.tweens.addCounter({
      from: 0, to: 1, duration: FLIGHT_MS,
      onUpdate: (tw) => { const t = tw.getValue(); if (coin.scene) coin.setPosition(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 90).setAngle(t * 540); },
      onComplete: () => { coin.destroy(); },
    });
    this.later(FLIGHT_MS, () => this.resolve(n, false));
  }

  /** Apply the outcome of throw `n` (idempotent through data.pending). */
  resolve(n, quiet) {
    const { data: d, scene } = this;
    if (d.pending !== n) return;
    d.pending = null;
    const p = this.player;
    const { wx, wy } = this;
    const last = n === WELL.maxThrows - 1;
    let res = last ? 'jackpot' : rollWish(this.rng('wish', n));
    if (!quiet) {
      Sfx.play('well_plink');
      scene.fx.ringPulse(wx, wy - 40, 0x80c8ff, 60, 420, 0.6);
      scene.fx.burst(wx, wy - 50, { color: [0x80c8ff, 0xffffff], count: 8, speed: [40, 160], gravity: 300, life: [300, 600] });
    }
    switch (res) {
      case 'nothing':
        if (!quiet && !d.silent) { d.silent = true; this.say(wx, wy - 120, 'THE WELL IS SILENT', '#a8c8e0'); }
        break;
      case 'heart_half': case 'heart_full': case 'heart_tin': case 'key': case 'dynamite': case 'coin_nickel':
        this.pickup(res, wx, wy + 24, { pop: true });
        if (!quiet) this.speak(res.startsWith('heart') ? 'heart' : res);
        break;
      case 'luck':
        if (d.luck < WELL.luckMax) {
          d.luck++;
          const stacks = d.luck;
          addFloorBuff(scene, p, 'well_luck', (s) => { s.luck += stacks; }, Infinity);
          if (!quiet) { this.say(wx, wy - 120, `LUCKY  +1 LUCK`, '#8fc23f'); this.speak('luck'); }
        } else if (!quiet) this.say(wx, wy - 120, 'THE WELL HUMS', '#8fc23f');
        break;
      case 'curse': {
        const id = Boons.gainCurse(p, this.rng('wish-curse', n));
        if (!quiet) { if (id) this.speak('curse'); else this.say(wx, wy - 120, 'THE WELL SHUDDERS', '#d63a2a'); if (id) { Sfx.play('curse_gain'); scene.fx.flash(0x6a1020, 0.2); } }
        break;
      }
      default: { // jackpot: the 12th coin brings up an item
        const id = scene.items.roll('treasure', subRng('item', this.def.seed, 50));
        const at = this.spots('I', [[6, 3]])[0];
        if (id) this.pedestal({ x: at.x + 192, y: at.y, itemId: id });
        else this.pickup('heart_full', wx, wy + 24, { pop: true });
        d.jackpot = true;
        if (!quiet) { this.say(wx, wy - 120, 'THE WELL GIVES UP A TREASURE', '#f0d060', 30); this.speak('pity'); scene.fx.flash(0xffe090, 0.25); }
        break;
      }
    }
    if (!quiet && p.coins === 0 && d.throws < WELL.maxThrows) this.say(p.x, p.y - 70, 'OUT OF COINS', '#e8c84a', 22);
    if (d.throws >= WELL.maxThrows) { this.ringObj.setVisible(false); this.finish(d.jackpot ? 'jackpot' : 'dry'); }
  }

  onEnter() {
    if (!this.state.greeted && this.data.throws < WELL.maxThrows) { this.state.greeted = true; this.speak('greet', { delay: 1500 }); }
  }

  update(dt) {
    super.update(dt);
    const d = this.data;
    const t = d.throws >= WELL.maxThrows ? 'THE WELL IS DRY' : `${WELL.maxThrows - d.throws} THROWS LEFT`;
    if (this.coinTag.text !== t) this.coinTag.setText(t);
  }

  onLeave() { const n = this.data.pending; if (n != null) this.resolve(n, true); }
}
