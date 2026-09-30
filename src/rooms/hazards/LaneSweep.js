// LaneSweep: a body (rail cart, ghost cart, herd steer, spectral stampede) that crosses the whole room along one tile row / column.
//   room.spawnLane({ axis: 'h'|'v', index, dir: 1|-1, kind: 'cart'|'ghost'|'herd'|'stampede', speed, dmg, w, tell, onDone })
// Sequence: `tell` s of red band across the lane (pulsing 4 Hz + end lamps, `train_bell` x4 / `hoof_thunder`), then the body enters from the
// off-screen end and travels edge to edge. Hit = damage + 240 px/s perpendicular shove; roll i-frames dodge it. Non-boss ground enemies hit take
// `enemyDmg` (+ stun for carts/herd). Bodies are not targetable and never stop a bullet. Room cleared: tells cancel, moving bodies fade out harmless.
// Cap: 4 lanes alive per room (spawn returns null when full: callers retry). Template `lanes` are scheduled by RoomHaz via LaneScheduler.
import Phaser from 'phaser';
import { W, H, ROOM, TILE, DEPTH, actorDepth } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { hurtPlayer, groundFoe, ensureTex, hasCell, warnDepth, clamp, TAU } from './common.js';

export const LANE_CAP = 4;

/** Defaults per kind (CHAPTER2 s2, s4, s5; EVENTS s7 stampede). */
export const LANE_KINDS = {
  cart: { speed: 380, w: 76, len: 170, dmg: 2, tell: 1.0, enemyDmg: 14, stun: 0.6, parts: 1, gap: 0, color: 0xd63a2a, dmgKind: 'cart' },
  ghost: { speed: 560, w: 76, len: 150, dmg: 1, tell: 1.0, enemyDmg: 0, stun: 0, parts: 1, gap: 0, color: 0x6fe0d0, dmgKind: 'cart' },
  herd: { speed: 600, w: 96, len: 130, dmg: 2, tell: 1.2, enemyDmg: 14, stun: 0.6, parts: 1, gap: 0, color: 0xd63a2a, dmgKind: 'cart' },
  stampede: { speed: 820, w: 88, len: 110, dmg: 1, tell: 1.0, enemyDmg: 25, stun: 0, parts: 3, gap: 240, color: 0xd63a2a, dmgKind: 'stampede', shove: 200 },
};

class Lane {
  constructor() {
    this.state = 'off'; // off | tell | run | fade
    this.bodies = [];
    this.hitSet = new Set();
  }
}

export class LaneField {
  constructor(hz) {
    this.hz = hz;
    this.room = hz.room;
    this.scene = hz.scene;
    this.lanes = [];
    for (let i = 0; i < LANE_CAP; i++) this.lanes.push(new Lane());
    this.g = this.scene.add.graphics().setDepth(DEPTH.decals + 6);
    this.g.__noSnap = true;
    this.lastTell = -99; // hz clock of the latest tell start (schedulers keep launches >= 1.5 s apart)
    this._drawn = false;
  }

  get busy() { let n = 0; for (const l of this.lanes) if (l.state !== 'off') n++; return n; }
  /** Any lane on this axis within one index of `index` currently telegraphing or running? (adjacent lanes never fire together) */
  crowded(axis, index) {
    for (const l of this.lanes) if (l.state !== 'off' && l.axis === axis && Math.abs(l.index - index) <= 1) return true;
    return false;
  }

  spawn(o) {
    let lane = null;
    for (const l of this.lanes) if (l.state === 'off') { lane = l; break; }
    if (!lane) return null;
    const K = LANE_KINDS[o.kind || 'cart'] || LANE_KINDS.cart;
    lane.kind = o.kind || 'cart';
    lane.axis = o.axis === 'v' ? 'v' : 'h';
    lane.index = o.index | 0;
    lane.dir = o.dir < 0 ? -1 : 1;
    lane.speed = o.speed ?? K.speed;
    lane.dmg = o.dmg ?? K.dmg;
    lane.w = o.w ?? K.w;
    lane.len = o.len ?? K.len;
    lane.tell = o.tell ?? K.tell;
    lane.enemyDmg = o.enemyDmg ?? K.enemyDmg;
    lane.stun = K.stun;
    lane.parts = K.parts;
    lane.gap = K.gap;
    lane.color = K.color;
    lane.shove = o.shove ?? K.shove ?? 240;
    lane.dmgKind = K.dmgKind;
    lane.onDone = o.onDone || null;
    lane.t = 0;
    lane.bells = 0;
    lane.hit = false;
    lane.alpha = 1;
    lane.hitSet.clear();
    lane.span = lane.axis === 'h' ? W : H;
    lane.center = lane.axis === 'h' ? ROOM.y + lane.index * TILE + TILE / 2 : ROOM.x + lane.index * TILE + TILE / 2;
    lane.state = 'tell';
    lane.cancel = () => this.cancel(lane);
    this.lastTell = this.hz.clock;
    if (lane.kind === 'stampede' || lane.kind === 'herd') Sfx.play('hoof_thunder', { vol: 0.9 });
    else Sfx.play('signal_lamp_on', { vol: 0.7 });
    return lane;
  }

  cancel(lane) { this._end(lane, false); }

  /** Room cleared: tells vanish, moving bodies fade out and stop hurting. */
  stopAll() {
    for (const l of this.lanes) {
      if (l.state === 'tell') this._end(l, false);
      else if (l.state === 'run') { l.state = 'fade'; l.fadeT = 0; }
    }
  }

  clear() { for (const l of this.lanes) if (l.state !== 'off') this._end(l, false); this.g.clear(); this._drawn = false; }

  destroy() { this.clear(); this.g.destroy(); }

  // ------------------------------------------------------------------------------------------------ frame
  update(dt) {
    const g = this.g;
    let any = false;
    for (const l of this.lanes) {
      if (l.state === 'off') continue;
      if (!any) { g.clear(); g.setDepth(warnDepth(this.room)); any = true; }
      if (l.state === 'tell') this._tell(l, dt);
      else this._run(l, dt);
    }
    if (!any && this._drawn) { g.clear(); this._drawn = false; }
    else if (any) this._drawn = true;
  }

  _tell(l, dt) {
    l.t += dt;
    const k = clamp(l.t / l.tell, 0, 1);
    const g = this.g, col = l.color;
    const half = (l.w + 8) / 2;
    const pulse = 0.5 + 0.5 * Math.sin(l.t * TAU * 4);
    const a = 0.12 + 0.12 * pulse + 0.1 * k;
    const stamp = l.kind === 'stampede';
    if (l.axis === 'h') {
      g.fillStyle(col, stamp ? a * 0.6 : a).fillRect(0, l.center - half, W, half * 2);
      g.lineStyle(3, col, 0.5 + 0.3 * pulse).strokeRect(0, l.center - half, W, half * 2);
      if (!stamp) { this._lamp(g, 30, l.center, col, pulse); this._lamp(g, W - 30, l.center, col, pulse); }
    } else {
      g.fillStyle(col, stamp ? a * 0.6 : a).fillRect(l.center - half, 0, half * 2, H);
      g.lineStyle(3, col, 0.5 + 0.3 * pulse).strokeRect(l.center - half, 0, half * 2, H);
      if (!stamp) { this._lamp(g, l.center, 200, col, pulse); this._lamp(g, l.center, H - 30, col, pulse); }
    }
    if (stamp) { this._chevrons(g, l, col, pulse, false); this._chevrons(g, l, col, pulse, true); }
    else if (l.kind !== 'ghost') this._chevrons(g, l, col, pulse, false);
    // bell x4 across the tell (signal lamp lit on spawn)
    if (l.kind !== 'stampede' && l.kind !== 'herd' && l.bells < 4 && l.t >= l.bells * (l.tell / 4)) { l.bells++; Sfx.play('train_bell', { vol: 0.8, gap: 0.05 }); }
    if (l.t >= l.tell) this._launch(l);
  }

  _lamp(g, x, y, col, pulse) {
    g.fillStyle(col, 0.5 + 0.4 * pulse).fillCircle(x, y, 13);
    g.lineStyle(3, 0x120c0a, 0.9).strokeCircle(x, y, 13);
  }

  /** Red chevrons pointing along the travel direction at the entry edge (or the exit edge when `far`). */
  _chevrons(g, l, col, pulse, far) {
    g.fillStyle(col, 0.45 + 0.4 * pulse);
    const d = far ? -l.dir : l.dir; // which edge: entry side is where the body comes from
    for (let i = 0; i < 3; i++) {
      const o = 70 + i * 34;
      if (l.axis === 'h') { const x = d > 0 ? o : W - o, y = l.center; g.fillTriangle(x + l.dir * 14, y, x - l.dir * 10, y - 22, x - l.dir * 10, y + 22); }
      else { const y = d > 0 ? 200 + o : H - o, x = l.center; g.fillTriangle(x, y + l.dir * 14, x - 22, y - l.dir * 10, x + 22, y - l.dir * 10); }
    }
  }

  _launch(l) {
    l.state = 'run';
    const ext = l.len / 2 + (l.parts - 1) * l.gap;
    l.pos = l.dir > 0 ? -l.len / 2 : l.span + l.len / 2; // lead body centre (along the lane axis)
    l.endPos = l.dir > 0 ? l.span + ext + 20 : -ext - 20;
    l.frame = 0;
    for (let i = 0; i < l.parts; i++) l.bodies.push(this._makeBody(l));
    if (l.kind === 'cart') Sfx.play('cart_rumble', { vol: 0.9 });
    this._place(l);
  }

  _makeBody(l) {
    const s = this.scene, v = l.axis === 'v';
    let spr;
    if (l.kind === 'stampede') {
      spr = Assets.makeSprite(s, 0, 0, 'enemy_coyote', 0).setTint(0xd8e8e0).setAlpha(0.8).setScale(1.4);
      spr.play(Assets.ensureAnim(s, 'enemy_coyote', { start: 0, end: 3, fps: 12, name: 'move' }), true);
      spr.__body = 'sprite';
    } else if (l.kind === 'herd') {
      if (Assets.has('enemy_hellsteer')) {
        spr = Assets.makeSprite(s, 0, 0, 'enemy_hellsteer', 0).setTint(0xff7a3a).setScale(1.25);
        spr.play(Assets.ensureAnim(s, 'enemy_hellsteer', { start: 0, end: 3, fps: 12, name: 'move' }), true);
        spr.__body = 'sprite';
      } else spr = s.add.image(0, 0, bullTex(s)).setTint(0xff7a3a).setOrigin(0.5, 0.8);
    } else {
      const cell = v ? 'cart_v_0' : 'cart_h_0';
      spr = hasCell('haz_cart', cell) ? Assets.makeCell(s, 0, 0, 'haz_cart', cell, 0.5) : s.add.image(0, 0, cartTex(s, v)).setOrigin(0.5, 0.5);
      spr.setScale(hasCell('haz_cart', cell) ? 0.9 : 0.9);
      if (l.kind === 'ghost') spr.setTint(0x6fe0d0).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD);
    }
    spr.__noSnap = true;
    if (l.dir < 0 && l.axis === 'h') spr.setFlipX(true);
    return spr;
  }

  _place(l) {
    const v = l.axis === 'v';
    for (let i = 0; i < l.bodies.length; i++) {
      const b = l.bodies[i];
      const along = l.pos - l.dir * i * l.gap;
      let x, y;
      if (v) { x = l.center; y = along; } else { x = along; y = l.center; }
      const sprite = b.__body === 'sprite';
      b.setPosition(x, sprite ? y + 24 : y).setDepth(actorDepth(y + 20)).setAlpha(l.state === 'fade' ? l.alpha * (l.kind === 'ghost' || l.kind === 'stampede' ? 0.8 : 1) : (l.kind === 'ghost' || l.kind === 'stampede' ? 0.8 : 1));
    }
  }

  _run(l, dt) {
    l.pos += l.dir * l.speed * dt;
    if (l.state === 'fade') { l.fadeT += dt; l.alpha = clamp(1 - l.fadeT / 0.3, 0, 1); if (l.fadeT >= 0.3) { this._end(l, true); return; } }
    else if ((l.dir > 0 && l.pos >= l.endPos) || (l.dir < 0 && l.pos <= l.endPos)) { this._end(l, true); return; }
    // cart wheel / step frames
    const step = ((Math.abs(l.pos) / 46) | 0) & 1;
    if (step !== l.frame) {
      l.frame = step;
      if (l.kind === 'cart' || l.kind === 'ghost') {
        const nm = `cart_${l.axis}_${step}`;
        if (hasCell('haz_cart', nm)) for (const b of l.bodies) b.setFrame(Assets.frame('haz_cart', nm));
        else for (const b of l.bodies) b.setScale(0.9, step ? 0.88 : 0.9); // placeholder bob
      }
    }
    this._place(l);
    if (l.state === 'fade') return;
    this._hit(l);
  }

  _hit(l) {
    const p = this.scene.player;
    const hl = l.len / 2, hw = l.w / 2, v = l.axis === 'v';
    if (p && !l.hit && p.canBeHit()) {
      const pad = p.hurtRadius * 0.5;
      for (let i = 0; i < l.parts; i++) {
        const along = l.pos - l.dir * i * l.gap;
        const da = (v ? p.y : p.x) - along, dc = (v ? p.x : p.y) - l.center;
        if (Math.abs(da) < hl + pad && Math.abs(dc) < hw + pad) {
          // damage source sits on the far side of the player so the built-in knockback points roughly perpendicular to the lane
          const sx = v ? p.x - Math.sign(dc || 1) * 60 : p.x, sy = v ? p.y : p.y - Math.sign(dc || 1) * 60;
          if (hurtPlayer(this.scene, l.dmg, sx, sy, l.dmgKind)) {
            l.hit = true;
            const sg = Math.sign(dc || 1);
            p.knock.x = v ? sg * l.shove : 0; p.knock.y = v ? 0 : sg * l.shove; // shove perpendicular to travel
          }
          break;
        }
      }
    }
    if (l.enemyDmg > 0) {
      const list = this.scene.enemies;
      for (let j = 0; j < list.length; j++) {
        const e = list[j];
        if (!e.alive || l.hitSet.has(e) || !groundFoe(e)) continue;
        for (let i = 0; i < l.parts; i++) {
          const along = l.pos - l.dir * i * l.gap;
          const da = (v ? e.y : e.x) - along, dc = (v ? e.x : e.y) - l.center;
          if (Math.abs(da) < hl + e.radius * 0.5 && Math.abs(dc) < hw + e.radius * 0.5) {
            l.hitSet.add(e);
            e.hurt(l.enemyDmg, { x: v ? e.x : along, y: v ? along : e.y, hazard: l.dmgKind });
            if (e.alive && l.stun > 0) e.applyStatus('stun', { t: l.stun });
            break;
          }
        }
      }
    }
  }

  _end(l, finished) {
    if (l.state === 'off') return;
    l.state = 'off';
    for (const b of l.bodies) b.destroy();
    l.bodies.length = 0;
    const cb = l.onDone; l.onDone = null;
    if (cb && finished) { try { cb(l); } catch (e) { console.error(e); } }
  }
}

// ---------------------------------------------------------------------------------------------------- template scheduler
/**
 * Template `lanes: [{axis, index, period, offset, dir: 1|-1|0 (alternate), kind}]`. Times are on the room's combat clock (hz.t), the first tell starts
 * at `offset` (>= 2.0 s after the room locks by template rule); `period` is start-to-start. Launches keep >= 1.5 s between tell starts and never
 * overlap an adjacent lane: a lane that would violate this waits 0.25 s and retries.
 */
export class LaneScheduler {
  constructor(hz, defs) {
    this.hz = hz;
    this.items = (defs || []).map((d, i) => ({ axis: d.axis === 'v' ? 'v' : 'h', index: d.index | 0, period: d.period || 6.5, dir: d.dir === undefined ? 1 : d.dir, kind: d.kind || 'cart', next: d.offset ?? 2.5 + i * 1.6, flip: 1 }));
  }
  update() {
    const hz = this.hz;
    if (!hz.live) return;
    for (const it of this.items) {
      if (hz.t < it.next) continue;
      const lf = hz.lanes;
      if (lf.crowded(it.axis, it.index) || hz.clock - lf.lastTell < 1.5) { it.next = hz.t + 0.25; continue; }
      const dir = it.dir === 0 ? (it.flip = -it.flip) : it.dir;
      if (lf.spawn({ axis: it.axis, index: it.index, dir, kind: it.kind })) it.next += it.period; else it.next = hz.t + 0.25;
    }
  }
}

// ---------------------------------------------------------------------------------------------------- code-drawn bodies
function cartTex(scene, vertical) {
  return ensureTex(scene, vertical ? 'hz_cart_v' : 'hz_cart_h', 192, 128, (c, w, h) => {
    c.lineJoin = 'round'; c.strokeStyle = '#120c0a'; c.lineWidth = 5;
    if (!vertical) {
      c.fillStyle = '#7a4a26'; c.beginPath(); c.moveTo(22, 40); c.lineTo(170, 40); c.lineTo(156, 92); c.lineTo(36, 92); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#2a2320'; c.beginPath(); c.arc(60, 40, 22, Math.PI, 0); c.arc(96, 36, 26, Math.PI, 0); c.arc(132, 40, 22, Math.PI, 0); c.fill(); c.stroke();
      c.fillStyle = '#e8dcc0'; c.beginPath(); c.arc(76, 66, 9, 0, 7); c.arc(118, 66, 9, 0, 7); c.fill(); c.fillStyle = '#120c0a'; c.beginPath(); c.arc(78, 67, 4, 0, 7); c.arc(120, 67, 4, 0, 7); c.fill();
      c.fillStyle = '#3a3a3e'; for (const x of [56, 136]) { c.beginPath(); c.arc(x, 100, 16, 0, 7); c.fill(); c.stroke(); }
    } else {
      c.fillStyle = '#7a4a26'; c.beginPath(); c.roundRect(52, 20, 88, 84, 10); c.fill(); c.stroke();
      c.fillStyle = '#2a2320'; c.beginPath(); c.roundRect(60, 26, 72, 30, 8); c.fill(); c.stroke();
      c.fillStyle = '#e8dcc0'; c.beginPath(); c.arc(78, 78, 9, 0, 7); c.arc(114, 78, 9, 0, 7); c.fill(); c.fillStyle = '#120c0a'; c.beginPath(); c.arc(78, 79, 4, 0, 7); c.arc(114, 79, 4, 0, 7); c.fill();
      c.fillStyle = '#3a3a3e'; for (const x of [46, 146]) { c.beginPath(); c.roundRect(x - 9, 74, 18, 40, 5); c.fill(); c.stroke(); }
    }
  });
}

function bullTex(scene) {
  return ensureTex(scene, 'hz_bull', 160, 128, (c) => {
    c.lineJoin = 'round'; c.strokeStyle = '#120c0a'; c.lineWidth = 5;
    c.fillStyle = '#8a3a22'; c.beginPath(); c.ellipse(78, 76, 56, 32, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(128, 62, 24, 20, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#e8dcc0'; c.beginPath(); c.moveTo(118, 48); c.quadraticCurveTo(112, 22, 132, 14); c.lineTo(128, 32); c.quadraticCurveTo(124, 40, 130, 50); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffb040'; c.beginPath(); c.arc(136, 60, 4, 0, 7); c.fill();
    c.fillStyle = '#3a1810'; for (const x of [40, 60, 92, 112]) c.fillRect(x, 96, 12, 24);
  });
}

export default LaneField;
