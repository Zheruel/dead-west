// The Dealer's Safe (EVENTS 8.3, room type `supersecret`): two free pedestals (one crossroads-pool item, one treasure-pool item) and 12 coins.
// Taking the crossroads item has a 50 % chance (subRng('vault', seed)) to add a random curse: THE DEALER NOTICES.
// Persistent data (state.ctl): { stocked, dealerItem, treasureItem, noticed, seen }. The pedestals themselves persist in room.state.pedestals
// (Room.spawnPedestal), the coins in room.state.pickups (Room.snapshot), so a revisit restores whatever is left and never restocks.
import Controller from './Controller.js';
import { ROOM, tileToWorld } from '../../config.js';
import { Sfx } from '../../core/Audio.js';
import { Boons } from '../../systems/Boons.js';

const COINS = 12;
const NOTICE_CHANCE = 0.5;
const FALLBACK = [[4, 3], [8, 3]];

export default class VaultRoom extends Controller {
  build() {
    const { room, state } = this;
    if (!state.stocked) {
      state.stocked = true;
      const slots = ((room.tpl && room.tpl.slots && room.tpl.slots.I) || []).slice().sort((a, b) => a.c - b.c);
      const at = (i) => (slots[i] ? tileToWorld(slots[i].c, slots[i].r) : tileToWorld(FALLBACK[i][0], FALLBACK[i][1]));
      const items = this.scene.items;
      const dealer = items.roll('crossroads', this.rng('vault-item', 0));
      const treasure = items.roll('treasure', this.rng('vault-item', 1));
      state.dealerItem = dealer || null;
      state.treasureItem = treasure || null;
      if (dealer) room.spawnPedestal({ ...at(0), itemId: dealer, price: null, group: null, taken: false });
      if (treasure) room.spawnPedestal({ ...at(1), itemId: treasure, price: null, group: null, taken: false });
      for (let i = 0; i < COINS; i++) { // two neat rows below the pedestals
        room.dropPickup('coin', ROOM.cx + ((i % 6) - 2.5) * 100, ROOM.cy + 150 + Math.floor(i / 6) * 60, { pop: false });
      }
    }
    this.on('item:picked', (p) => this.onPicked(p));
  }

  onEnter() {
    if (this.state.seen) return;
    this.state.seen = true;
    this.room.banner('PROPERTY OF THE DEALER', { color: '#c8a8f0', hold: 1800 });
    this.scene.fx.ringPulse(ROOM.cx, ROOM.cy, 0x9a80c0, 420, 800, 0.25);
  }

  onPicked(p) {
    const { state } = this;
    if (this.destroyed || !p || state.noticed !== undefined || !state.dealerItem || p.id !== state.dealerItem) return;
    const r = this.rng('vault', 0);
    state.noticed = r.chance(NOTICE_CHANCE);
    if (!state.noticed) return;
    const pl = this.player;
    const id = Boons.gainCurse(pl, this.rng('vault-curse', 0));
    if (!id) { state.noticed = false; return; }
    this.scene.fx.text(pl.x, pl.y - 90, 'THE DEALER NOTICES', { color: '#d63a2a', size: 28 });
    this.scene.fx.flash(0x6a1020, 0.18);
    Sfx.play('curse', { vol: 0.8 });
  }
}
export { VaultRoom };
