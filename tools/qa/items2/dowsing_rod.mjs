// dowsing_rod: +1 key; the minimap shows shop / treasure / boss / secret rooms of the floor as icons without visiting them.
import { install } from './_i2.mjs';

export default {
  id: 'dowsing_rod',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const SP = ['shop', 'treasure', 'boss', 'secret'];
      const count = () => {
        const m = sc.roomMgr, disc = m.discoveredRooms();
        const want = m.floor.rooms.filter((x) => SP.includes(x.type));
        return { want: want.length, shown: want.filter((x) => disc.has(x.id)).length, unvisited: want.filter((x) => disc.has(x.id) && !disc.get(x.id).visited).length, mapVer: m.mapVer };
      };
      dw.api.setFloor(2); I.sim(0.5); o.before = count();
      const k0 = p.keys; I.give('dowsing_rod'); o.keys = p.keys - k0;
      I.sim(0.3); o.now = count();
      dw.api.setFloor(3); I.sim(0.5); o.next = count();
      // dropping the item (restore without it) hides the icons again on a fresh count
      // the reveal belongs to the floor (RoomManager.revealed is cleared on loadFloor): without the rod a fresh floor shows only what you found; with it restored the floor is dowsed again
      p.restore({ items: [], active: null, hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 }); dw.api.setFloor(4); I.sim(0.5); o.gone = count();
      dw.api.setFloor(3); p.restore({ items: ['dowsing_rod'], active: null, hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 }); I.sim(0.3); o.back = count();
      p.restore({ items: [], active: null, hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 });
      dw.api.setFloor(1); I.sim(0.5); // later plugins expect the chapter-1 start floor
      return o;
    });
    ok('+1 key', r.keys === 1, `${r.keys}`);
    ok('every special room of the floor is on the minimap', r.now.want > 0 && r.now.shown === r.now.want, JSON.stringify(r.now));
    ok('they are icons only (not visited)', r.now.unvisited >= r.now.want - 1, JSON.stringify(r.now));
    ok('the next floor is dowsed too', r.next.want > 0 && r.next.shown === r.next.want, JSON.stringify(r.next));
    ok('without the rod a fresh floor is untouched, restoring the rod dowses the floor again', r.gone.shown < r.gone.want && r.back.shown === r.back.want, JSON.stringify([r.gone, r.back]));
  },
};
