// The Card Sharp (EVENTS 3.2): a skeleton gambler at a felt table. Three chip stacks (3c / 6c / 10c), each a hold ring; the stake is paid at once,
// two code-drawn cards flip over 1.2 s and the roll (`rng('bet', n)`, luck shifts 0.01 per point from bust to win) resolves. Five hands per visit,
// the house folds after the fifth or once the player is 25c up. A `dead_mans_hand` puts a treasure-pool item on the table (the stake is lost).
// Persistent (state.data): { hands, folded, pending: {bet, outcome, n}, jackpotItem }. A hand in flight is settled when the room is left.
import { EventBase, cellOr, cardFace, cardBack, flipCard, CARD_W, ROOM, DEPTH } from './common.js';
import { BET, BET_RETURN, rollBet } from './tables.js';
import { Sfx } from '../../../core/Audio.js';
import { bus } from '../../../core/events.js';
import { subRng } from '../../../core/rng.js';

const FLIP_MS = 1200;
const OUTCOME_TEXT = { bust: 'BUST', push: 'PUSH', win: 'WIN', ace_high: 'ACE HIGH!', dead_mans_hand: "DEAD MAN'S HAND" };
const OUTCOME_COLOR = { bust: '#d63a2a', push: '#e8dcc0', win: '#8fc23f', ace_high: '#f0d060', dead_mans_hand: '#c8a8f0' };

export default class CardSharp extends EventBase {
  build() {
    const { room } = this;
    const d = this.data;
    d.hands = d.hands || 0;
    d.folded = !!d.folded;
    this.busy = false;
    this.armed = [true, true, true];
    this.chips = [];
    const spots = this.spots('I', [[4, 4], [6, 4], [8, 4]]);
    BET.chips.forEach((bet, i) => {
      const at = spots[i] || spots[spots.length - 1];
      const chip = this.track(cellOr(this.scene, 'props_small', 'chip_stack', at.x, at.y + 30, {
        scale: 0.8, size: [96, 96], draw: (c) => { c.fillStyle = '#c8a040'; c.strokeStyle = '#120c0a'; c.lineWidth = 5; for (let k = 0; k < 4; k++) { c.beginPath(); c.roundRect(16, 62 - k * 14, 64, 16, 7); c.fill(); c.stroke(); } },
      }));
      chip.setDepth(DEPTH.floor + 6);
      const ring = this.ring({
        x: at.x, y: at.y + 8, r: 56, hold: 0.35, repeat: true, label: `${bet}c`, color: 0xf0d080,
        canUse: () => this.canBet(i), onDone: () => this.bet(i),
      });
      this.chips.push({ chip, ring, bet, grey: false });
    });
    // the two cards of a hand, between table and chips
    const cx = ROOM.cx, cy = spots[0] ? spots[0].y - 96 : 528;
    this.cardImgs = [-1, 1].map((s) => this.track(this.scene.add.image(cx + s * 64, cy, cardBack(this.scene)).setDepth(DEPTH.fx - 30).setVisible(false)));
    this.cardTag = [-1, 1].map((s, k) => this.track(this.scene.add.text(cx + s * 64, cy - 84, k ? 'HOUSE' : 'YOU', { fontFamily: 'monospace', fontSize: '16px', color: '#e8dcc0', stroke: '#120c0a', strokeThickness: 4 }).setOrigin(0.5).setDepth(DEPTH.fx - 30).setVisible(false)));
    this.cx = cx; this.cy = cy;
    if (d.pending) this.settle(true); // a hand that never resolved (should not happen): pay it out now
    if (d.folded) this.closeHouse(false);
  }

  canBet(i) {
    const c = this.chips[i];
    if (!this.interactive) return false;
    if (this.data.folded) return 'HOUSE CLOSED';
    if (this.busy || !this.armed[i]) return false;
    if (this.player.coins < c.bet) return `NEED ${c.bet}c`;
    return true;
  }

  bet(i) {
    if (this.canBet(i) !== true) return;
    const { data: d, state } = this;
    const p = this.player;
    const bet = BET.chips[i];
    const n = d.hands;
    p.coins -= bet;
    d.hands++;
    state.uses = d.hands;
    d.pending = { bet, n, outcome: rollBet(this.rng('bet', n), p.stats.luck || 0) };
    this.armed[i] = false;
    this.busy = true;
    Sfx.play('chip_place');
    this.showFlip(d.pending);
    this.later(FLIP_MS, () => this.settle(false));
  }

  /** Face-down cards pop in, flip one after the other and show a hand that matches the rolled outcome. */
  showFlip({ outcome, n }) {
    const { scene } = this;
    const r = this.rng('cards', n);
    const suits = ['S', 'H', 'D', 'C'];
    let pr, hr, ps = r.pick(suits), hs = r.pick(suits);
    if (outcome === 'bust') { hr = r.int(3, 14); pr = r.int(2, hr - 1); }
    else if (outcome === 'push') { pr = hr = r.int(2, 14); if (ps === hs) hs = suits[(suits.indexOf(hs) + 1) % 4]; }
    else if (outcome === 'win') { pr = r.int(3, 14); hr = r.int(2, pr - 1); }
    else if (outcome === 'ace_high') { pr = 14; hr = r.int(2, 13); }
    else { pr = 14; ps = 'S'; hr = 8; hs = 'S'; }
    const back = cardBack(scene);
    const faces = [cardFace(scene, pr, ps), cardFace(scene, hr, hs)];
    this.cardImgs.forEach((im, k) => {
      scene.tweens.killTweensOf(im);
      im.setTexture(back).setVisible(true).setAlpha(1).setScale(0.2).setAngle(k ? 5 : -5);
      scene.tweens.add({ targets: im, scale: 1, duration: 160, ease: 'Back.easeOut' });
      this.cardTag[k].setVisible(true).setAlpha(1);
      this.later(300 + k * 320, () => { Sfx.play('card_flip'); flipCard(scene, im, faces[k]); });
    });
    this.later(FLIP_MS + 500, () => this.hideCards());
  }
  hideCards() {
    if (this.busy) return;
    this.cardImgs.forEach((im, k) => { if (im.scene) this.scene.tweens.add({ targets: [im, this.cardTag[k]], alpha: 0, duration: 260, onComplete: () => { if (!this.busy) { im.setVisible(false); this.cardTag[k].setVisible(false); } } }); });
  }

  /** Resolve the hand in flight (idempotent). `quiet` = room is going away: no effects, records instead of objects. */
  settle(quiet) {
    const { data: d, state } = this;
    const pd = d.pending;
    if (!pd) return;
    d.pending = null;
    this.busy = false;
    const p = this.player;
    const payout = BET_RETURN[pd.outcome] * pd.bet;
    p.coins = Math.min(99, p.coins + payout);
    state.net = (state.net || 0) + payout - pd.bet;
    if (pd.outcome === 'dead_mans_hand') {
      const items = this.scene.items;
      const id = items.roll('treasure', subRng('item', this.def.seed, 40 + pd.n));
      const at = { x: this.cx, y: this.cy + 20 };
      if (id) this.pedestal({ ...at, itemId: id });
      else this.pickup('heart_tin', at.x, at.y, { pop: true });
    }
    bus.emit('bet:result', { bet: pd.bet, outcome: pd.outcome, payout });
    if (!quiet) {
      const gain = payout - pd.bet;
      const txt = pd.outcome === 'win' || pd.outcome === 'ace_high' ? `${OUTCOME_TEXT[pd.outcome]}  +${gain}c` : pd.outcome === 'push' ? 'PUSH' : pd.outcome === 'bust' ? `BUST  -${pd.bet}c` : `${OUTCOME_TEXT[pd.outcome]}`;
      this.say(this.cx, this.cy - 110, txt, OUTCOME_COLOR[pd.outcome], 34);
      Sfx.play(pd.outcome === 'bust' ? 'card_lose' : pd.outcome === 'push' ? 'chip_place' : 'card_win');
      if (gain > 0) this.scene.fx.burst(this.cx, this.cy, { color: [0xffe090, 0xffffff], count: 14, speed: [80, 260], blend: 'ADD' });
      if (pd.outcome === 'dead_mans_hand') { this.room.banner("DEAD MAN'S HAND", { color: '#c8a8f0', hold: 1400 }); this.scene.fx.flash(0x6a3aa0, 0.2); }
      this.speak(pd.outcome);
    }
    const closing = d.hands >= BET.maxHands || state.net >= BET.foldNet;
    if (closing) this.closeHouse(!quiet);
    else if (!quiet && p.coins < BET.chips[0]) this.speak('broke', { delay: 2800 });
  }

  closeHouse(fx) {
    const d = this.data;
    d.folded = true;
    for (const c of this.chips) { c.ring.setVisible(false); c.chip.setTint(0x666666); }
    if (fx) {
      this.later(900, () => this.say(this.cx, this.cy - 60, this.state.net >= BET.foldNet ? 'THE HOUSE FOLDS' : 'HOUSE CLOSED', '#f0d060', 32));
      this.speak('fold', { delay: 2800 });
    }
    this.finish(this.state.net >= BET.foldNet ? 'cleaned_out' : 'closed');
  }

  update(dt) {
    super.update(dt);
    const p = this.player;
    for (let i = 0; i < this.chips.length; i++) {
      const c = this.chips[i];
      if (!this.armed[i] && !c.ring.playerInside()) this.armed[i] = true;
      const grey = !this.data.folded && p.coins < c.bet;
      if (grey !== c.grey) { c.grey = grey; c.chip.setTint(grey ? 0x666666 : 0xffffff); if (!grey) c.chip.clearTint(); }
    }
  }

  onEnter() {
    const d = this.data;
    if (this.state.greeted || d.folded) return;
    this.state.greeted = true;
    this.speak(this.player.coins < BET.chips[0] ? 'broke' : 'greet', { delay: 1500 });
  }

  onLeave() { this.settle(true); }
}
