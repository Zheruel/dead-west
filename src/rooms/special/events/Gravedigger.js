// Grave Robbing (EVENTS 3.4): five fresh mounds, each a 1.0 s hold ring. The contents are a seed-fixed shuffle of loot x2 / chest / ambush / bones.
// The ambush locks the doors and raises undead from the other mounds (0.56 s spawn telegraphs); clearing it lifts a wooden chest at the room centre.
// Persistent (state.data): { graves[5], dug[5], ambush: 'none'|'active'|'done', ambushAt }. A revisit shows the same dug / untouched mounds and never
// pays a mound twice; an ambush torn down mid-fight restarts when the player walks back in.
import { EventBase, cellOr, ROOM, actorDepth } from './common.js';
import { shuffleGraves, BONES_KEY_CHANCE } from './tables.js';
import { Sfx } from '../../../core/Audio.js';
import { RNG } from '../../../core/rng.js';
import { spawnEnemy, enemyPool, enemyMeta } from '../../../enemies/index.js';
import { Affixes } from '../../../enemies/Affixes.js';

const SPAWN_MS = 560;
const NO_AMBUSH = new Set(['chain_gang', 'crate_mimic', 'handcar_bandit', 'magma_eel', 'rail_rat', 'ghost']);
const UNDEAD_FALLBACK = ['skeleton', 'possessed', 'coffin'];

/** Ambush roster by floor (EVENTS 3.4). */
export function ambushRoster(floor, r) {
  if (floor <= 2) return ['skeleton', 'skeleton', 'possessed'];
  if (floor === 3) return ['skeleton', 'skeleton', 'coffin'];
  const pool = enemyPool(floor).filter((id) => !NO_AMBUSH.has(id) && ((enemyMeta(id).tags || []).includes('undead') || UNDEAD_FALLBACK.includes(id)));
  const out = [];
  for (let i = 0; i < 4; i++) out.push(pool.length ? r.pick(pool) : UNDEAD_FALLBACK[i % 2]);
  return out;
}

export default class Gravedigger extends EventBase {
  build() {
    const { room } = this;
    const d = this.data;
    const spots = this.spots('C', [[2, 2], [6, 2], [10, 2], [4, 4], [8, 4]]);
    this.spotsW = spots;
    if (!d.graves) { d.graves = shuffleGraves(this.rng('graves')); d.dug = spots.map(() => false); d.ambush = 'none'; }
    if (d.ambush === 'active') d.ambush = 'none'; // torn down mid-fight: walking back in restarts it
    this.mounds = [];
    this.foes = [];
    this.pending = 0;
    this.fighting = false;
    this.digT = spots.map(() => 0);
    // the host prop is a mound at the K marker: swap it for the warning sign
    if (this.prop) this.prop.setVisible(false);
    const k = this.spots('K', [[9, 1]])[0];
    const sign = this.label(k.x, k.y + 6, 'DIG AT YOUR OWN RISK', { size: 22, color: '#e0b878' });
    sign.setBackgroundColor('#3a2418').setPadding(10, 6, 10, 6).setAngle(-3).setDepth(actorDepth(k.y));
    spots.forEach((at, i) => {
      const ring = this.ring({
        x: at.x, y: at.y + 8, r: 56, hold: 1.0, color: 0xc8a070, label: '',
        canUse: () => this.interactive && !this.fighting && !d.dug[i] && !this.pending,
        onDone: () => this.dig(i),
      });
      if (d.dug[i]) ring.setVisible(false);
      this.mounds.push({ im: this.makeMound(at, d.dug[i]), ring, at });
    });
    this.done = this.allSpent();
    if (this.done) this.finish('looted');
    room.gravedigger = this;
  }

  allSpent() { const d = this.data; return d.dug.every(Boolean) && d.ambush !== 'active' && (d.graves.indexOf('ambush') < 0 || d.ambush === 'done'); }

  dig(i) {
    const { scene, data: d, state } = this;
    const m = this.mounds[i];
    if (d.dug[i]) return;
    d.dug[i] = true;
    state.uses = (state.uses || 0) + 1;
    m.ring.setVisible(false);
    m.im.destroy();
    m.im = this.makeMound(m.at, true);
    Sfx.play('grave_open');
    scene.fx.burst(m.at.x, m.at.y, { color: [0x6b4a34, 0x8a6a48], count: 16, speed: [60, 240], gravity: 400, life: [300, 600] });
    scene.fx.shake(0.004, 120);
    const what = d.graves[i];
    const { x, y } = m.at;
    switch (what) {
      case 'loot':
        for (let k = 0; k < 2; k++) this.pickup(this.room.rollPickup(1.0, true), x + (k ? 28 : -28), y + 24, { pop: true });
        this.say(x, y - 60, 'BURIED LOOT', '#f0d060');
        this.speak('loot');
        break;
      case 'chest':
        this.room.spawnChest('chest_wood', x, y + 30);
        this.say(x, y - 60, 'A COFFIN LID CREAKS OPEN', '#e0b878');
        this.speak('chest');
        break;
      case 'bones':
        this.say(x, y - 60, 'JUST BONES', '#c8c0a8');
        this.speak('bones');
        if (this.rng('bones', i).chance(BONES_KEY_CHANCE)) this.pickup('key', x, y + 24, { pop: true });
        break;
      default:
        d.ambush = 'active';
        this.startAmbush(i);
        break;
    }
    if (what !== 'ambush' && this.allSpent()) { this.finish('looted'); this.speak('done', { delay: 2800 }); }
  }

  /** Speech tag of the digger: above the warning sign. */
  voicePos() { const k = this.spots('K', [[9, 1]])[0]; return { x: k.x, y: k.y - 40 }; }

  makeMound(at, dug) {
    const im = this.track(cellOr(this.scene, 'props_events', dug ? 'grave_open' : 'grave_mound', at.x, at.y + 40, {
      scale: 0.62, size: [192, 192],
      draw: (c, w, h) => {
        c.fillStyle = dug ? '#1a1008' : '#6b4a34'; c.strokeStyle = '#120c0a'; c.lineWidth = 6;
        c.beginPath(); c.ellipse(w / 2, h * 0.7, 80, 46, 0, 0, 7); c.fill(); c.stroke();
        c.fillStyle = '#c8b898'; c.fillRect(w / 2 - 6, 30, 12, 70); c.fillRect(w / 2 - 28, 50, 56, 12);
      },
    }));
    return im.setDepth(actorDepth(at.y + 20));
  }

  // ------------------------------------------------------------------------------------------------ ambush
  startAmbush(at) {
    const { scene, room, data: d } = this;
    d.ambushAt = at;
    this.fighting = true;
    room.lock();
    Sfx.play('grave_crack');
    room.banner('THE DEAD RISE', { color: '#d63a2a', hold: 1000 });
    this.speak('ambush');
    const floor = room.floor || scene.floorNum || 1;
    const roster = ambushRoster(floor, this.rng('ambush', 0));
    // raise them from the other mounds, farthest from the player first; the dug one is under the player's feet
    const p = this.player;
    const others = this.mounds.map((m, i) => ({ i, m })).filter((o) => o.i !== at).sort((a, b) => Math.hypot(b.m.at.x - p.x, b.m.at.y - p.y) - Math.hypot(a.m.at.x - p.x, a.m.at.y - p.y));
    let recs = roster.map((id, k) => { const o = others[k % others.length]; return { id, x: o.m.at.x + (k >= others.length ? 40 : 0), y: o.m.at.y + (k >= others.length ? 40 : 0) }; });
    recs = room.safeSpawns(recs);
    if (typeof Affixes.rollWave === 'function') {
      try { Affixes.rollWave(new RNG((this.def.seed ^ 0xE11E) >>> 0), recs, { floor, diff: scene.diff, player: p, allCursed: !!(scene.mut && scene.mut.allCursed) }); } catch (e) { console.error(e); }
    }
    for (const rc of recs) {
      scene.fx.spawn(rc.x, rc.y, Math.max(0.8, (enemyMeta(rc.id)?.r ?? 30) / 34));
      this.pending++;
      this.later(SPAWN_MS, () => {
        this.pending--;
        const e = spawnEnemy(scene, rc.id, rc.x, rc.y, { cursed: !!rc.cursed, affixes: rc.affixes, floor });
        if (e) this.foes.push(e);
      });
    }
  }

  update(dt) {
    super.update(dt);
    const { scene } = this;
    // dirt while a mound is being dug
    for (let i = 0; i < this.mounds.length; i++) {
      const m = this.mounds[i];
      if (m.ring.destroyed || !m.ring.enabled || m.ring.progress <= 0) continue;
      this.digT[i] -= dt;
      if (this.digT[i] <= 0) {
        this.digT[i] = 0.22;
        scene.fx.burst(m.at.x + (Math.random() - 0.5) * 50, m.at.y + 10, { color: [0x6b4a34, 0x8a6a48], count: 3, speed: [40, 140], gravity: 380, life: [250, 500], angle: [220, 320] });
        Sfx.play('shovel_dig', { vol: 0.5, gap: 0.3 });
      }
    }
    if (!this.fighting || this.pending > 0) return;
    let alive = 0;
    for (const e of this.foes) if (e.alive) alive++;
    if (alive > 0) return;
    this.fighting = false;
    this.data.ambush = 'done';
    this.foes.length = 0;
    this.room.unlock();
    this.room.banner('THE GRAVES ARE QUIET', { color: '#8fc23f', hold: 1000 });
    Sfx.play('room_clear');
    this.room.spawnChest('chest_wood', ROOM.cx, ROOM.cy);
    if (this.allSpent()) { this.finish('looted'); this.speak('done', { delay: 2200 }); }
  }

  onEnter() {
    const d = this.data;
    if (!this.state.greeted && !this.done) { this.state.greeted = true; this.speak('greet', { delay: 1500 }); }
    if (d.ambush === 'none' && d.dug && d.dug[d.ambushAt ?? -1] && d.graves[d.ambushAt] === 'ambush') this.startAmbush(d.ambushAt); // restart after a teardown
  }
}
