// FirePool (ITEMS 2.5) = ten-line wrapper over the shared FirePatch (ARCH D2): Room.addFire(x, y, r, dur, {team:'player', dps}). `hurtsPlayer` maps to
// team 'enemy' (it burns enemies too). Falls back to the local ItemFx fire when the room cannot host one (stub hazards, pocket rooms).
import { itemFx } from './ItemFx.js';

export function firePool(scene, x, y, r, dur = 3, { dps = 6, hurtsPlayer = false } = {}) {
  const room = scene.room;
  const patch = room && typeof room.addFire === 'function' ? room.addFire(x, y, r, dur, { team: hurtsPlayer ? 'enemy' : 'player', dps, dmg: 1 }) : null;
  if (!patch) itemFx(scene).fire(x, y, r, dur, dps, hurtsPlayer);
  return patch;
}
export default firePool;
