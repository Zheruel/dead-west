// Runtime (non-stat) effects of the named synergies (ITEMS_V2 s5): everything a synergy does beyond `apply(stats)`.
//   stats.roomClearDynChance     : a cleared room may drop a dynamite pickup
//   iron_hide (tinDropChance)    : a cleared room may drop a tin heart
//   house_always_wins (jackpot)  : a cleared room may pay 2 nickels + heart + key
//   avenging_angel               : +1 tin heart per floor (once per floor: guarded through itemState so a checkpoint reload does not repeat it)
//   spectral_posse               : a free Spirit Lantern while the synergy holds (removed when it is lost)
// The stat-only synergies live in synergies.js (pure data); the hook-shaped ones are consumed by Kill / Bullets / Player / ItemFx through the stats they set.
import { ROOM } from '../../config.js';
import SpiritLantern from '../familiars/SpiritLantern.js';

const JACKPOT_BASE = 0.12, JACKPOT_LUCK = 0.01;

/** room:cleared -> tin drop (iron_hide) and jackpot (house_always_wins). Uses the combat stream (player.crng) so runs stay reproducible. */
export function onRoomCleared(scene) {
  const p = scene.player, room = scene.room;
  if (!p || p.dead || !room || !room.dropPickup) return;
  const s = p.stats, cx = ROOM.cx, cy = ROOM.cy;
  if (s.roomClearDynChance > 0 && !(scene.mut && scene.mut.noDynamite) && p.crng.chance(s.roomClearDynChance)) room.dropPickup('dynamite', cx - 60, cy + 40, { pop: true });
  if (s.tinDropChance > 0 && !(scene.mut && scene.mut.noHearts) && p.crng.chance(s.tinDropChance)) room.dropPickup('heart_tin', cx, cy + 40, { pop: true });
  if (s.jackpot > 0 && p.crng.chance(JACKPOT_BASE + JACKPOT_LUCK * Math.max(0, s.luck || 0))) {
    room.dropPickup('coin_nickel', cx - 34, cy + 40, { pop: true });
    room.dropPickup('coin_nickel', cx + 34, cy + 40, { pop: true });
    if (!(scene.mut && scene.mut.noHearts)) room.dropPickup('heart_full', cx, cy + 80, { pop: true });
    room.dropPickup('key', cx, cy, { pop: true });
    scene.fx.text(cx, cy - 60, 'JACKPOT!', { color: '#f0d060', size: 34, time: 1400 });
    scene.fx.ringPulse(cx, cy, 0xf0d060, 160, 600, 0.8);
    scene.fx.flash(0xf0d060, 0.2);
  }
}

/** floor:changed -> avenging_angel grants one tin heart per floor. */
export function onFloorChanged(scene, floor) {
  const p = scene.player;
  if (!p || !p.stats || !p.stats.avengingAngel) return;
  const st = p.itemState['syn:avenging_angel'] || (p.itemState['syn:avenging_angel'] = {});
  if (st.tinFloor === floor) return;
  st.tinFloor = floor;
  if (p.addTin(2) > 0) { p.recomputeStats(); scene.fx.text(p.x, p.y - 90, '+1 TIN', { color: '#c8d0d8', size: 22 }); }
}

/** Keep the free Spirit Lantern in step with spectral_posse (call after every synergy re-evaluation and after a restore). Safe without a scene. */
export function posseSync(player) {
  if (!player.scene || !player.scene.add) return;
  const want = player.synergies.has('spectral_posse');
  const f = player._posseF;
  const live = f && f.alive && player.familiars.includes(f);
  if (want && !live) player._posseF = player.addFamiliar(new SpiritLantern(player));
  else if (!want && f) { if (f.destroy) f.destroy(); player._posseF = null; }
}
