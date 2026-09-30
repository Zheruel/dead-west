// GroundHaz: timed ground hazards with a telegraph (circle / line / tile). Extracted from the semantics of undertaker.js `haz` (which is NOT refactored).
//
//   const gh = GroundHaz.of(scene);                       // one shared manager per scene, updated by Hazards.update (any room)
//   gh.circle({ x, y, r, tell: 0.9, active: 0.25, dmg: 1, kind: 'lava', onLand(h) {}, fire: {r, dur, team} , enemyDmg: 0, color, style: 'disc'|'shadow',
//               fall: 'rock'|'chandelier'|fn(scene) -> GameObject, dust: true, fx: 'burst'|'none', shove })
//   gh.line({ x, y, angle, len, w, ... })                 // band starting at (x,y) running `len` px along `angle`, `w` px wide
//   gh.tile({ c, r, ... })                                // one template tile
//
// Life cycle: `tell` seconds of telegraph (fill grows), then `onLand(h)` fires once and the hazard is ACTIVE for `active` seconds (damages the
// player once when overlapped and hittable, `enemyDmg` to walking non-boss enemies once each), then it lingers `hold` seconds (visual only).
// Returned handle: { cancel(), done, t, ...opts }. Damage never lands during the tell. `dmg` is in player units (1 = half heart).
import { DEPTH, ROOM, TILE } from '../config.js';
import { Sfx } from '../core/Audio.js';
import { hurtPlayer, groundFoe, circleHitsTile, makeRock, clamp } from '../rooms/hazards/common.js';

const RED = 0xd63a2a;

export class GroundHaz {
  /** Shared manager for a scene (recreated if the scene object was reused after a shutdown). */
  static of(scene) {
    let gh = scene._groundHaz;
    if (!gh || !gh.g || !gh.g.scene) gh = scene._groundHaz = new GroundHaz(scene);
    return gh;
  }

  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.g = scene.add.graphics().setDepth(DEPTH.decals + 6);
    this.g.__noSnap = true;
    this.depth = DEPTH.decals + 6;
    this._dirty = false;
    this._stamp = -1;
    // Hazards.update drives us with the gameplay dt (hit-stop aware); when nothing does (no room wiring, boss-only scenes) this catches up post-update
    this._post = (time, delta) => { if (this._stamp !== scene.time.now) this.update(Math.min(delta / 1000, 0.05)); };
    scene.events.on('postupdate', this._post);
    scene.events.once('shutdown', () => this.destroy());
  }

  get count() { return this.list.length; }
  setDepth(d) { this.depth = d; if (this.g && this.g.scene) this.g.setDepth(d); }

  // ------------------------------------------------------------------------------------------------ factories
  circle(o) { return this._add('circle', o); }
  line(o) {
    const h = this._add('line', o);
    const a = h.angle ?? 0, c = Math.cos(a), s = Math.sin(a), nx = -s * h.w / 2, ny = c * h.w / 2, ex = h.x + c * h.len, ey = h.y + s * h.len;
    h.c = c; h.s = s;
    h.pts = [{ x: h.x + nx, y: h.y + ny }, { x: ex + nx, y: ey + ny }, { x: ex - nx, y: ey - ny }, { x: h.x - nx, y: h.y - ny }];
    h.fillPts = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    return h;
  }
  tile(o) {
    const x = ROOM.x + o.c * TILE + TILE / 2, y = ROOM.y + o.r * TILE + TILE / 2;
    return this._add('tile', { ...o, x, y });
  }

  _add(shape, o) {
    const h = Object.assign({
      shape, t: 0, tell: 0.9, active: 0.25, dmg: 1, kind: 'hazard', color: RED, style: 'disc', enemyDmg: 0,
      fired: false, hitDone: false, done: false, spr: null, dustT: 0, hitSet: null,
    }, o);
    h.hold = h.hold ?? h.active;
    h.r = h.r ?? 60;
    h.cancel = () => { h.done = true; };
    if (h.enemyDmg > 0) h.hitSet = new Set();
    this.list.push(h);
    this._dirty = true;
    return h;
  }

  clear() {
    for (const h of this.list) this._free(h);
    this.list.length = 0;
    if (this.g && this.g.scene) this.g.clear();
    this._dirty = false;
  }
  destroy() {
    this.scene.events.off('postupdate', this._post);
    this.clear();
    if (this.g && this.g.scene) this.g.destroy();
    if (this.scene._groundHaz === this) this.scene._groundHaz = null;
  }
  _free(h) { h.done = true; if (h.spr) { h.spr.destroy(); h.spr = null; } }

  // ------------------------------------------------------------------------------------------------ frame update
  update(dt) {
    const g = this.g;
    if (!g || !g.scene) return;
    this._stamp = this.scene.time.now;
    const list = this.list;
    if (!list.length) { if (this._dirty) { g.clear(); this._dirty = false; } return; }
    g.clear();
    this._dirty = true;
    const s = this.scene, p = s.player;
    const room = s.room;
    g.setDepth(room && room.darkMask ? DEPTH.bullets + 2 : this.depth);
    for (let i = list.length - 1; i >= 0; i--) {
      const h = list[i];
      if (h.done) { this._free(h); list.splice(i, 1); continue; }
      h.t += dt;
      if (h.t < h.tell) { this._drawTell(g, h, dt); this._fall(h); continue; }
      if (!h.fired) { h.fired = true; this._land(h); }
      const age = h.t - h.tell;
      if (age < h.active) {
        this._drawActive(g, h, age);
        if (h.dmg > 0 && !h.hitDone && p && p.canBeHit() && this._hits(h, p.x, p.y, p.hurtRadius * 0.5)) {
          h.hitDone = hurtPlayer(s, h.dmg, h.x, h.y, h.kind, h.source);
        }
        if (h.hitSet) this._hurtEnemies(h);
      } else if (age < h.hold) this._drawActive(g, h, age);
      if (age >= h.hold) { this._free(h); list.splice(i, 1); }
    }
  }

  _hits(h, x, y, pad) {
    if (h.shape === 'circle') { const rr = h.r + pad; return (x - h.x) ** 2 + (y - h.y) ** 2 < rr * rr; }
    if (h.shape === 'tile') return circleHitsTile(x, y, pad, h.c, h.r);
    const px = x - h.x, py = y - h.y;
    const along = px * h.c + py * h.s, across = Math.abs(-px * h.s + py * h.c);
    return along > -pad && along < h.len + pad && across < h.w / 2 + pad;
  }

  _hurtEnemies(h) {
    const list = this.scene.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || h.hitSet.has(e) || !(h.enemyFilter ? h.enemyFilter(e) : groundFoe(e))) continue;
      if (!this._hits(h, e.x, e.y, e.hitRadius * 0.6)) continue;
      h.hitSet.add(e);
      e.hurt(h.enemyDmg, { x: h.x, y: h.y, hazard: h.kind });
    }
  }

  // ------------------------------------------------------------------------------------------------ drawing
  _drawTell(g, h, dt) {
    const k = clamp(h.t / h.tell, 0, 1);
    const col = h.color;
    if (h.shape === 'circle') {
      if (h.style === 'shadow') {
        g.fillStyle(0x000000, 0.12 + 0.34 * k).fillCircle(h.x, h.y, h.r * (0.55 + 0.45 * k));
        g.lineStyle(4, col, 0.5 + 0.45 * k).strokeCircle(h.x, h.y, h.r);
      } else {
        g.fillStyle(col, 0.14).fillCircle(h.x, h.y, h.r);
        g.fillStyle(col, 0.22 + 0.25 * k).fillCircle(h.x, h.y, h.r * k);
        g.lineStyle(3, col, 0.55 + 0.4 * k).strokeCircle(h.x, h.y, h.r);
      }
      if (h.dust) {
        h.dustT -= dt;
        if (h.dustT <= 0 && k > 0.15) {
          h.dustT = 0.16;
          this.scene.fx.burst(h.x + (Math.random() - 0.5) * h.r * 1.4, h.y - 90, { color: [0x8a7a68, 0x6b5a48], count: 2, speed: [20, 60], life: [300, 500], scale: [1, 2], gravity: 500, dir: Math.PI / 2, spread: 12 });
        }
      }
    } else if (h.shape === 'tile') {
      const x = h.x - TILE / 2, y = h.y - TILE / 2;
      g.fillStyle(col, 0.14).fillRect(x, y, TILE, TILE);
      g.fillStyle(col, 0.22 + 0.25 * k).fillRect(x + TILE / 2 * (1 - k), y + TILE / 2 * (1 - k), TILE * k, TILE * k);
      g.lineStyle(3, col, 0.55 + 0.4 * k).strokeRect(x, y, TILE, TILE);
    } else {
      g.fillStyle(col, 0.14).fillPoints(h.pts, true);
      // fill grows across the band width
      const c = h.c, s = h.s, w = h.w * k / 2, ex = h.x + c * h.len, ey = h.y + s * h.len, nx = -s * w, ny = c * w, f = h.fillPts;
      f[0].x = h.x + nx; f[0].y = h.y + ny; f[1].x = ex + nx; f[1].y = ey + ny; f[2].x = ex - nx; f[2].y = ey - ny; f[3].x = h.x - nx; f[3].y = h.y - ny;
      g.fillStyle(col, 0.22 + 0.25 * k).fillPoints(f, true);
      g.lineStyle(3, col, 0.55 + 0.4 * k).strokePoints(h.pts, true);
    }
  }

  _drawActive(g, h, age) {
    const a = clamp(1 - age / Math.max(0.01, h.hold), 0, 1);
    if (h.shape === 'circle') { g.fillStyle(h.color, 0.35 * a).fillCircle(h.x, h.y, h.r); g.lineStyle(4, 0xffffff, 0.5 * a).strokeCircle(h.x, h.y, h.r); }
    else if (h.shape === 'tile') g.fillStyle(h.color, 0.35 * a).fillRect(h.x - TILE / 2, h.y - TILE / 2, TILE, TILE);
    else g.fillStyle(h.color, 0.35 * a).fillPoints(h.pts, true);
  }

  /** Falling sprite (rock / chandelier / custom) descends during the last part of the tell. */
  _fall(h) {
    if (!h.fall) return;
    const dur = h.fallDur ?? 0.3;
    const fk = clamp((h.t - (h.tell - dur)) / dur, 0, 1);
    if (fk <= 0) return;
    if (!h.spr) {
      const s = this.scene;
      if (h.fall === 'rock') { h.spr = makeRock(s).setScale(h.fallScale ?? 1.2); }
      else if (typeof h.fall === 'function') h.spr = h.fall(s, h);
      if (!h.spr) { h.fall = null; return; }
      h.spr.setDepth(DEPTH.fx - 10);
    }
    const lift = h.fallLift ?? 24;
    h.spr.setPosition(h.x, h.y - lift - (1 - fk) * (h.fallHeight ?? 560));
    if (h.fall === 'rock') h.spr.setRotation(fk * 5);
  }

  _land(h) {
    const s = this.scene, fx = s.fx;
    if (h.spr) { h.spr.destroy(); h.spr = null; }
    if (h.fx !== 'none' && h.shape === 'circle') {
      fx.burst(h.x, h.y - 10, { color: h.burstColors || [0x8a7a68, 0x6b5a48, 0xe8dcc0], count: 14, speed: [100, 320], life: [250, 550], gravity: 400 });
      fx.dust(h.x, h.y + 10, Math.max(0.8, h.r / 60));
      if (h.decal !== false) fx.decal(h.x, h.y, 'scorch', h.r / 150);
      if (h.shake !== false) fx.shake(0.008, 120);
    }
    if (h.sfx) Sfx.play(h.sfx, { vol: 0.9, gap: 0.05 });
    if (h.fire) s.room && s.room.addFire && s.room.addFire(h.x, h.y, h.fire.r, h.fire.dur, { team: h.fire.team || 'enemy', tag: h.fire.tag, maxTag: h.fire.maxTag, dmg: h.fire.dmg });
    if (h.onLand) { try { h.onLand(h); } catch (e) { console.error(e); } }
  }
}

export default GroundHaz;
