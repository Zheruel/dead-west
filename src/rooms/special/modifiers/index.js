// Room modifiers facade (FN-2, ARCH_V2 s8 / EVENTS s7). Room owns the id (`room.mod`); this module instantiates the effect object (`room._mod`), wires the
// entry banner + modifier:entered / modifier:cleared events, and forwards Room's lifecycle calls. Numbers live in config.js MODIFIERS.
import { MODIFIERS, VARIETY } from '../../../config.js';
import { bus } from '../../../core/events.js';
import { DustStorm } from './DustStorm.js';
import { Darkness } from './Darkness.js';
import { Stampede } from './Stampede.js';
import { BloodMoon } from './BloodMoon.js';
import { Fog } from './Fog.js';
import { Rockfall } from './Rockfall.js';
import { Hellfire } from './Hellfire.js';
import { Lurch } from './Lurch.js';

export const REGISTRY = { dust_storm: DustStorm, darkness: Darkness, stampede: Stampede, blood_moon: BloodMoon, fog: Fog, rockfall: Rockfall, hellfire: Hellfire, lurch: Lurch };
const BANNER = { dust_storm: '#d9b071', darkness: '#9a80c0', stampede: '#d9d0b8', blood_moon: '#ff5a4a', fog: '#b8c4c8', rockfall: '#c0a080', hellfire: '#f0702a', lurch: '#80b0ff' };

export const Modifiers = {
  /** Build the effect object for `room.mod` (contents build). Safe to call for unknown ids and for rooms rigged with a grave ambush (no mods there). */
  build(room) {
    const id = room.mod, C = REGISTRY[id], cfg = MODIFIERS[id];
    if (!C || !cfg || room._mod) return;
    if (room.tpl && room.tpl.graveAmbush) return; // forbidden combo (EVENTS 7)
    if (room.state && room.state.cleared) return; // revisiting a cleared room: the effect is over, no haze / banner
    const m = room._mod = new C(room, cfg);
    m.on('room:entered', (e) => {
      if (!e || e.room !== room || m.announced) return;
      m.announced = true;
      if (typeof room.banner === 'function') room.banner(m.name || cfg.name, { color: BANNER[id] || '#e8dcc0', hold: 1500 });
      bus.emit('modifier:entered', { id });
    });
    if (room.mode === 'combat' && room.locked) m.lock(); // built mid-fight (debug jump): start the clock now
  },
  onLock(room) { if (room._mod) room._mod.lock(); },
  update(room, dt) { if (room._mod) room._mod.update(dt); },
  onClear(room) {
    const m = room._mod;
    if (!m) return;
    m.clear();
    bus.emit('modifier:cleared', { id: m.id });
  },
  destroy(room) { const m = room._mod; if (m) { room._mod = null; m.destroy(); } },
  /** Room-clear bonus for a modifier room: {drop: extra drop chance, guaranteed: bool}. Blood moon always pays. */
  clearBonus(room) {
    if (!room._mod) return null;
    return { drop: VARIETY.mod.clearBonus, guaranteed: !!MODIFIERS[room._mod.id].guaranteedDrop };
  },
};
export default Modifiers;
