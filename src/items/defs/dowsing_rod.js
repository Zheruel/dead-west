import { registerItem } from '../registry.js';

// Reveals the minimap icons of every shop, treasure, boss and secret room of the floor (icon only: the rooms stay unvisited) and gives a key.
// RoomManager / Minimap are not owned by this job, so the reveal is a shim: `roomMgr.discoveredRooms` is wrapped ONCE per RoomManager instance to add the
// special rooms as unvisited entries (see INTEGRATION_REQUESTS: native revealRoom support). Installed on pickup, restore, room entry and floor change.
const KINDS = new Set(['shop', 'treasure', 'boss', 'secret']);

function install(scene) {
  const m = scene && scene.roomMgr;
  if (!m || m._dowsed) return;
  const orig = m.discoveredRooms;
  m._dowsed = true;
  m.discoveredRooms = function discoveredRoomsDowsed() {
    const out = orig.call(this);
    const fl = this.floor, pl = scene.player;
    if (fl && pl && pl.itemCount('dowsing_rod') > 0) for (let i = 0; i < fl.rooms.length; i++) { const r = fl.rooms[i]; if (KINDS.has(r.type) && !out.has(r.id)) out.set(r.id, { def: r, visited: false }); }
    return out;
  };
  m.touchMap();
}

registerItem({
  id: 'dowsing_rod', name: 'Dowsing Rod', desc: 'Reveals shops, treasure and secret rooms. +1 key', type: 'passive', pool: ['treasure', 'shop'], weight: 1,
  icon: { sheet: 'items2_c', name: 'dowsing_rod' },
  tags: ['luck'], tier: 1, gate: 'gulch',
  lore: 'It twitches toward trouble.',
  onPickup(player, { scene }) { player.collect('key'); install(scene); },
  onRestore(player, { scene }) { install(scene); },
  hooks: {
    floor(player, ctx, { scene }) { install(scene); },
    roomEnter(player, ctx, { scene }) { install(scene); },
  },
});
