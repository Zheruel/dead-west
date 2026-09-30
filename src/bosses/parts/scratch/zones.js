// Ol' Scratch helper objects (FE-B3): code-drawn textures, beam sets (royal flush, diamond pinwheel), the roulette zone (`roulette_call`), the
// hold 'em card markers, the contract page and the death card burst. Every object is created once per fight, pools its display objects and
// allocates nothing per frame. All damage goes through hazards/common.hurtPlayer (i-frames, roll, god mode respected).
import { DEPTH, FONT_BODY, ROOM, TILE } from '../../../config.js';
import { Sfx } from '../../../core/Audio.js';
import { hurtPlayer, groundFoe, circleHitsTile, warnDepth, ensureTex, clamp, TAU } from '../../../rooms/hazards/common.js';
import { drawSuit, SUIT_COLOR } from './deadMansHand.js';

export const RED = 0xd63a2a, GOLD = 0xd4a537, BONE = 0xe8dcc0, AMBER = 0xf0a640;
const SRC = { enemyName: "Ol' Scratch" }; // killedBy

/** Distance from (x,y) to the room edge along angle a. */
export function rayLen(x, y, a, m = 0) {
  const dx = Math.cos(a), dy = Math.sin(a);
  let t = 1e9;
  if (dx > 1e-4) t = Math.min(t, (ROOM.right - m - x) / dx); else if (dx < -1e-4) t = Math.min(t, (ROOM.x + m - x) / dx);
  if (dy > 1e-4) t = Math.min(t, (ROOM.bottom - m - y) / dy); else if (dy < -1e-4) t = Math.min(t, (ROOM.y + m - y) / dy);
  return Math.max(0, t);
}

// ------------------------------------------------------------------------------------------------------------ textures
/** `scratch_seal` (red wax seal, gold sigil) and `scratch_contract` (parchment page). Both code-drawn: no art needed. */
export function ensureScratchTextures(scene) {
  ensureTex(scene, 'scratch_seal', 96, 96, (c, w, h) => {
    const cx = w / 2, cy = h / 2;
    c.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * TAU, r = 41 + (i % 2 ? 3 : -1) + Math.sin(i * 1.9) * 2;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.closePath();
    const g = c.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, 46);
    g.addColorStop(0, '#d63a2a'); g.addColorStop(0.7, '#8a1c1c'); g.addColorStop(1, '#4a0c0c');
    c.fillStyle = g; c.fill();
    c.lineWidth = 3; c.strokeStyle = '#2a0808'; c.stroke();
    c.strokeStyle = '#d4a537'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 29, 0, TAU); c.stroke();
    c.lineWidth = 3; c.beginPath(); // pentagram sigil
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + ((i * 2) % 5) * (TAU / 5), x = cx + Math.cos(a) * 21, y = cy + Math.sin(a) * 21;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.16)'; c.beginPath(); c.ellipse(cx - 12, cy - 18, 14, 6, -0.6, 0, TAU); c.fill();
  });
  ensureTex(scene, 'scratch_contract', 480, 340, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#eadcae'); g.addColorStop(0.5, '#d9c48c'); g.addColorStop(1, '#c2a66c');
    c.fillStyle = g; c.strokeStyle = '#5a3c16'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(14, 10); c.lineTo(w - 10, 16); c.lineTo(w - 16, h - 12); c.lineTo(10, h - 8); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(80,50,20,0.7)'; c.fillRect(120, 34, 240, 8); // title bar
    c.fillStyle = 'rgba(60,35,15,0.5)';
    for (let r = 0; r < 9; r++) c.fillRect(38, 66 + r * 22, 380 - ((r * 53) % 130), 4);
    c.strokeStyle = 'rgba(40,20,10,0.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(60, h - 52);
    for (let i = 1; i < 9; i++) c.lineTo(60 + i * 12, h - 52 + (i % 2 ? -14 : 8)); c.stroke(); // signature scribble
    c.fillStyle = '#8a1c1c'; c.beginPath(); c.arc(w - 74, h - 62, 32, 0, TAU); c.fill();
    c.strokeStyle = '#d4a537'; c.lineWidth = 3; c.beginPath(); c.arc(w - 74, h - 62, 21, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(90,60,20,0.16)'; c.fillRect(0, 0, 26, h); c.fillRect(w - 26, 0, 26, h);
  });
}

// ------------------------------------------------------------------------------------------------------------ beams
const NB = 8;

/**
 * Warn beams that turn solid and (optionally) rotate: royal flush (from the boss) and the diamond pinwheel (from a card marker).
 * start({ ox, oy, angles[], rates[], w, tell, active, len = 0 (0 = to the wall), dmg = 1, tick = 0.5 })
 */
export class BeamSet {
  constructor(boss) {
    this.boss = boss;
    this.scene = boss.scene;
    this.g = this.scene.add.graphics().setDepth(DEPTH.decals + 7);
    this.g.__noSnap = true;
    this.scene.fx._track(this.g);
    this.n = 0;
    this.ang = new Float32Array(NB);
    this.rate = new Float32Array(NB);
    this.ox = 0; this.oy = 0; this.w = 56; this.len = 0;
    this.tell = 0.9; this.active = 1.6; this.t = 0; this.dmg = 1; this.tick = 0.5; this.hitCd = 0;
    this.state = 'off';
    this.pts = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    this.drawn = false;
  }

  get done() { return this.state === 'off'; }
  get solid() { return this.state === 'on'; }

  start(o) {
    this.n = Math.min(NB, o.angles.length);
    for (let i = 0; i < this.n; i++) { this.ang[i] = o.angles[i]; this.rate[i] = o.rates ? o.rates[i] : 0; }
    this.ox = o.ox; this.oy = o.oy; this.w = o.w ?? 56; this.len = o.len ?? 0;
    this.tell = o.tell ?? 0.9; this.active = o.active ?? 1.6; this.dmg = o.dmg ?? 1; this.tick = o.tick ?? 0.5;
    this.t = 0; this.hitCd = 0; this.state = 'tell';
  }

  stop() { this.state = 'off'; this.n = 0; if (this.drawn) { this.g.clear(); this.drawn = false; } }

  update(dt) {
    if (this.state === 'off') return;
    const g = this.g, s = this.scene;
    this.t += dt;
    if (this.state === 'tell' && this.t >= this.tell) { this.state = 'on'; this.t = 0; this.hitCd = 0; Sfx.play('fire_whoosh', { vol: 0.5, rate: 1.1, gap: 0.2 }); }
    else if (this.state === 'on' && this.t >= this.active) { this.stop(); return; }
    g.clear().setDepth(warnDepth(s.room) + 1);
    this.drawn = true;
    const on = this.state === 'on', k = on ? 1 : clamp(this.t / this.tell, 0, 1);
    const p = s.player, pts = this.pts, hw = this.w / 2;
    let hit = false;
    for (let i = 0; i < this.n; i++) {
      if (on) this.ang[i] += this.rate[i] * dt;
      const a = this.ang[i], c = Math.cos(a), sn = Math.sin(a);
      const L = this.len > 0 ? this.len : rayLen(this.ox, this.oy, a, 0);
      const nx = -sn * hw, ny = c * hw, ex = this.ox + c * L, ey = this.oy + sn * L;
      pts[0].x = this.ox + nx; pts[0].y = this.oy + ny; pts[1].x = ex + nx; pts[1].y = ey + ny;
      pts[2].x = ex - nx; pts[2].y = ey - ny; pts[3].x = this.ox - nx; pts[3].y = this.oy - ny;
      if (on) {
        g.fillStyle(0xff5a2a, 0.5).fillPoints(pts, true);
        g.lineStyle(4, 0xffe0a0, 0.9).lineBetween(this.ox, this.oy, ex, ey);
      } else {
        g.fillStyle(RED, 0.1 + 0.14 * k).fillPoints(pts, true);
        const flick = this.t > this.tell - 0.3 ? 0.5 + 0.5 * Math.sin(this.t * 60) : 1;
        g.lineStyle(3, RED, (0.4 + 0.5 * k) * flick).lineBetween(this.ox, this.oy, ex, ey);
      }
      if (on && p && !p.dead) {
        const px = p.x - this.ox, py = p.y - this.oy, along = px * c + py * sn, perp = -px * sn + py * c;
        if (along > -8 && along < L && Math.abs(perp) < hw + p.hurtRadius * 0.5) hit = true;
      }
    }
    if (on) g.fillStyle(0xffe0a0, 0.6).fillCircle(this.ox, this.oy, hw * 0.7);
    this.hitCd -= dt;
    if (hit && this.hitCd <= 0) this.hitCd = hurtPlayer(s, this.dmg, p.x, p.y, 'boss', SRC) ? this.tick : 0.05;
  }

  destroy() { this.n = 0; this.state = 'off'; if (this.g && this.g.scene) this.g.destroy(); this.g = null; }
}

// ------------------------------------------------------------------------------------------------------------ roulette
export const ROULETTE = { tell: 1.0, zap: 1.6, every: 0.7, dmg: 1, enemyDmg: 6 };

/**
 * `roulette_call` (CHAPTER2 boss 6): the boss's own zone over the roulette tiles. Uses the room's real `r`/`k` tiles when the arena template has
 * them, else a default checkerboard on cols 3-9 x rows 2-4 with a faint code-drawn base. call(col): 1.0 s flicker, then a 1.6 s zap; the player on
 * a zapped tile takes 1 at zap start and every 0.7 s, walkers take 6 once.
 */
export class RouletteZone {
  constructor(boss) {
    this.boss = boss;
    this.scene = boss.scene;
    const s = this.scene, room = s.room, hz = room && room._hz;
    this.tiles = [];
    const real = hz && hz.roulette && hz.roulette.tiles.length ? hz.roulette.tiles : null;
    if (real) for (const t of real) this.tiles.push({ c: t.c, r: t.r, x: t.x, y: t.y, col: t.col });
    else {
      for (let r = 2; r <= 4; r++) for (let c = 3; c <= 9; c++) {
        const t = room && room.tiles[r] && room.tiles[r][c];
        if (t && (t.solid || t.type === 'pit')) continue;
        this.tiles.push({ c, r, x: ROOM.x + c * TILE + TILE / 2, y: ROOM.y + r * TILE + TILE / 2, col: (c + r) & 1 ? 'k' : 'r' });
      }
    }
    this.base = null;
    if (!real) { // no template tiles: paint the region so the colours can be read before a call
      const b = this.base = s.add.graphics().setDepth(DEPTH.decals - 1);
      b.__noSnap = true; s.fx._track(b);
      for (const t of this.tiles) {
        b.fillStyle(t.col === 'r' ? 0x8a1c1c : 0x1a1418, 0.7).fillRect(t.x - TILE / 2 + 2, t.y - TILE / 2 + 2, TILE - 4, TILE - 4);
        b.lineStyle(2, GOLD, 0.6).strokeRect(t.x - TILE / 2 + 3, t.y - TILE / 2 + 3, TILE - 6, TILE - 6);
      }
    }
    this.g = s.add.graphics().setDepth(DEPTH.decals + 4); this.g.__noSnap = true; s.fx._track(this.g);
    this.txt = s.add.text(ROOM.cx, ROOM.y + 60, '', { fontFamily: FONT_BODY, fontSize: '84px', color: '#f0d080', stroke: '#120c0a', strokeThickness: 10 })
      .setOrigin(0.5).setDepth(DEPTH.fx + 10).setVisible(false);
    this.txt.__noSnap = true; s.fx._track(this.txt);
    this.state = 'idle';
    this.t = 0; this.col = null; this.tickT = 0; this.hitAt = 0; this.arcT = 0; this.drawn = false;
    this.enemyHit = new Set();
  }

  get done() { return this.state === 'idle'; }
  hasCol(col) { for (const t of this.tiles) if (t.col === col) return true; return false; }

  call(col) {
    if (this.state !== 'idle' || !this.hasCol(col)) return false;
    this.col = col; this.state = 'tell'; this.t = 0; this.tickT = 0;
    this.txt.setText(col === 'r' ? 'RED!' : 'BLACK!').setColor(col === 'r' ? '#ff5a4a' : '#e8dcc0').setVisible(true).setAlpha(1).setScale(1.25);
    return true;
  }

  onTile(x, y, pad) {
    for (const t of this.tiles) if (t.col === this.col && circleHitsTile(x, y, pad + 0.5, t.c, t.r)) return true;
    return false;
  }

  update(dt) {
    const g = this.g;
    if (this.state === 'idle') { if (this.drawn) { g.clear(); this.drawn = false; } return; }
    const s = this.scene, p = s.player;
    this.drawn = true;
    this.t += dt;
    g.clear().setDepth(warnDepth(s.room));
    if (this.state === 'tell') {
      const k = clamp(this.t / ROULETTE.tell, 0, 1), mix = Math.floor(this.t * (8 + 14 * k)) & 1 ? 0xffffff : AMBER;
      for (const t of this.tiles) {
        if (t.col !== this.col) continue;
        g.fillStyle(mix, 0.18 + 0.4 * k).fillRect(t.x - TILE / 2 + 4, t.y - TILE / 2 + 4, TILE - 8, TILE - 8);
        g.lineStyle(3, mix, 0.5 + 0.4 * k).strokeRect(t.x - TILE / 2 + 4, t.y - TILE / 2 + 4, TILE - 8, TILE - 8);
      }
      this.txt.setScale(Math.max(1, 1.25 - this.t));
      this.tickT -= dt;
      if (this.tickT <= 0) { this.tickT = 0.28 - 0.16 * k; Sfx.play('roulette_tick', { vol: 0.7 }); }
      if (this.t >= ROULETTE.tell) { this.state = 'zap'; this.t = 0; this.hitAt = 0; this.arcT = 0; this.enemyHit.clear(); Sfx.play('roulette_zap', { vol: 0.9 }); s.fx.shake(0.004, 120); }
      return;
    }
    const k = this.t / ROULETTE.zap, fade = k > 0.85 ? (1 - k) / 0.15 : 1, pulse = 0.5 + 0.5 * Math.sin(this.t * 40);
    this.txt.setAlpha(Math.max(0, 1 - this.t / 0.5));
    for (const t of this.tiles) {
      if (t.col !== this.col) continue;
      g.fillStyle(0xfff2a0, (0.28 + 0.22 * pulse) * fade).fillRect(t.x - TILE / 2 + 2, t.y - TILE / 2 + 2, TILE - 4, TILE - 4);
      g.lineStyle(4, 0xffffff, 0.8 * fade).strokeRect(t.x - TILE / 2 + 3, t.y - TILE / 2 + 3, TILE - 6, TILE - 6);
    }
    this.arcT -= dt;
    if (this.arcT <= 0) {
      this.arcT = 0.09;
      const n = this.tiles.length, rng = this.boss.rng;
      for (let tries = 0, made = 0; tries < 8 && made < 2; tries++) {
        const a = this.tiles[rng.int(0, n - 1)], b = this.tiles[rng.int(0, n - 1)];
        if (a.col !== this.col || b.col !== this.col || a === b) continue;
        s.fx.arc(a.x + rng.float(-25, 25), a.y + rng.float(-25, 25), b.x + rng.float(-25, 25), b.y + rng.float(-25, 25), { ms: 110, color: 0xffe070 });
        made++;
      }
    }
    if (p && !p.dead && this.t >= this.hitAt && this.hitAt < ROULETTE.zap - 0.05) {
      if (!this.onTile(p.x, p.y, p.hurtRadius * 0.5)) this.hitAt += ROULETTE.every;
      else if (hurtPlayer(s, ROULETTE.dmg, p.x, p.y + 30, 'roulette', SRC)) this.hitAt += ROULETTE.every;
    }
    const list = s.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!groundFoe(e) || this.enemyHit.has(e) || !this.onTile(e.x, e.y, 0)) continue;
      this.enemyHit.add(e);
      e.hurt(ROULETTE.enemyDmg, { x: e.x, y: e.y, hazard: 'roulette' });
    }
    if (this.t >= ROULETTE.zap) { this.state = 'idle'; this.txt.setVisible(false); g.clear(); this.drawn = false; }
  }

  stop() { this.state = 'idle'; this.txt.setVisible(false); this.g.clear(); this.drawn = false; }

  destroy() {
    for (const o of [this.g, this.txt, this.base]) if (o && o.scene) o.destroy();
    this.g = this.txt = this.base = null;
    this.tiles.length = 0;
  }
}

// ------------------------------------------------------------------------------------------------------------ hold 'em
export const HOLDEM = { tell: 1.0, active: 5.0, r: 60, spadeEvery: 1.2, clubEvery: 1.4, orbEvery: 2.5, orbMax: 4 };

/**
 * `hold_em`: two face-down card markers. Tell 1.0 s, flip, active 5.0 s. spade = 8-bullet ring every 1.2 s; heart = two slow homing orbs
 * (shootable); diamond = a 3-beam pinwheel (60 deg/s, width 44); club = aimed 3-fan every 1.4 s. Suits never repeat in one cast.
 */
export class HoldEm {
  constructor(boss) {
    this.boss = boss;
    this.scene = boss.scene;
    this.g = this.scene.add.graphics().setDepth(DEPTH.decals + 6);
    this.g.__noSnap = true; this.scene.fx._track(this.g);
    this.m = [{}, {}];
    this.n = 0;
    this.sets = [new BeamSet(boss), new BeamSet(boss)];
    this.orbT = 0;
    this.drawn = false;
    this.pinAng = [0, 0, 0];
    this.pinRate = [rad60, rad60, rad60];
  }

  get done() { return this.n === 0; }

  /** spots[{x,y}] x2, suits[] x2. */
  start(spots, suits) {
    for (let i = 0; i < 2; i++) {
      const m = this.m[i];
      m.x = spots[i].x; m.y = spots[i].y; m.suit = suits[i]; m.t = 0; m.state = 'tell'; m.next = 0.4; m.k = 0; m.on = true;
    }
    this.n = 2;
    Sfx.play('card_flip', { vol: 0.8, rate: 0.9 });
  }

  clear() {
    this.n = 0;
    for (const m of this.m) m.on = false;
    for (const b of this.sets) b.stop();
    if (this.drawn) { this.g.clear(); this.drawn = false; }
  }

  update(dt) {
    const s = this.scene, g = this.g, boss = this.boss;
    for (const b of this.sets) b.update(dt);
    if (this.orbT > 0) { this.orbT -= dt; this.scanOrbs(); }
    if (this.n === 0) { if (this.drawn) { g.clear(); this.drawn = false; } return; }
    g.clear().setDepth(warnDepth(s.room));
    this.drawn = true;
    const p = s.player;
    for (let i = 0; i < 2; i++) {
      const m = this.m[i];
      if (!m.on) continue;
      m.t += dt;
      if (m.state === 'tell') {
        const k = clamp(m.t / HOLDEM.tell, 0, 1);
        g.fillStyle(GOLD, 0.1).fillCircle(m.x, m.y, HOLDEM.r);
        g.fillStyle(GOLD, 0.16 + 0.2 * k).fillCircle(m.x, m.y, HOLDEM.r * k);
        g.lineStyle(3, GOLD, 0.5 + 0.4 * k).strokeCircle(m.x, m.y, HOLDEM.r);
        this.card(g, m, false, 1 - 0.3 * (1 - k));
        if (m.t >= HOLDEM.tell) {
          m.state = 'active'; m.t = 0; m.next = 0.4;
          Sfx.play('card_flip', { vol: 0.9 });
          s.fx.ringPulse(m.x, m.y - 20, SUIT_COLOR[m.suit] === 0xd63a2a ? RED : BONE, 60, 400, 0.8);
          if (m.suit === 'diamonds') {
            const set = this.sets[i], a0 = this.boss.rng.float(0, TAU);
            set.start({ ox: m.x, oy: m.y - 6, angles: [a0, a0 + TAU / 3, a0 + (2 * TAU) / 3], rates: this.pinRate, w: 44, len: 300, tell: 0.5, active: HOLDEM.active - 0.5 });
          }
        }
        continue;
      }
      // active
      g.fillStyle(SUIT_COLOR[m.suit] === 0xd63a2a ? RED : BONE, 0.08).fillCircle(m.x, m.y, HOLDEM.r);
      this.card(g, m, true, 1);
      if (m.t < HOLDEM.active - 0.3) this.act(m, boss, p);
      if (m.t >= HOLDEM.active) { m.on = false; this.n--; s.fx.burst(m.x, m.y - 20, { color: [GOLD, BONE], count: 8, speed: [40, 160], life: [300, 600], scale: [1.5, 2.5] }); }
    }
  }

  card(g, m, up, k) {
    const x = m.x, y = m.y - 26, w = 60 * k, h = 84 * k;
    g.fillStyle(0x120c0a, 0.45).fillRoundedRect(x - w / 2 + 4, y - h / 2 + 6, w, h, 6);
    if (up) {
      g.fillStyle(0xf2ead6, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
      g.lineStyle(2, 0x5a3c16, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 6);
      drawSuit(g, m.suit, x, y, 16, SUIT_COLOR[m.suit]);
    } else {
      g.fillStyle(0x24144a, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
      g.lineStyle(3, GOLD, 1).strokeRoundedRect(x - w / 2 + 4, y - h / 2 + 4, w - 8, h - 8, 4);
      g.lineStyle(2, GOLD, 0.8).strokeCircle(x, y, 12 * k);
    }
  }

  act(m, boss, p) {
    const B = this.scene.bullets.enemy;
    if (m.suit === 'diamonds') return; // beams live in their BeamSet
    if (m.t < m.next) return;
    const x = m.x, y = m.y - 6;
    if (m.suit === 'spades') {
      m.next += HOLDEM.spadeEvery;
      B.ring({ x, y, speed: 230, damage: 1, kind: 'spade', radius: 13, owner: boss, life: 3.4 }, 8, (m.k++ & 1) * 22.5);
      Sfx.play('card_throw', { vol: 0.5, gap: 0.1 });
    } else if (m.suit === 'clubs') {
      m.next += HOLDEM.clubEvery;
      B.fan({ x, y, speed: 300, damage: 1, kind: 'chip', radius: 13, owner: boss, life: 3.4 }, 3, 36, Math.atan2(p.y - y, p.x - x));
      Sfx.play('chip_clatter', { vol: 0.5, gap: 0.1 });
    } else { // hearts: two slow homing orbs, at most orbMax alive
      m.next += HOLDEM.orbEvery;
      let live = 0;
      for (const b of B.list) if (b.active && b.data && b.data.orb) live++;
      const base = Math.atan2(p.y - y, p.x - x);
      for (let j = 0; j < 2 && live < HOLDEM.orbMax; j++, live++) {
        B.fire({ x, y, angle: base + (j ? 0.55 : -0.55), speed: 150, damage: 1, kind: 'ember', radius: 16, scale: 1.5, tint: 0xff5a8a, homing: 0.4, life: 5, owner: boss, data: { orb: 1 } });
      }
      this.orbT = 6;
      Sfx.play('fire_whoosh', { vol: 0.4, rate: 1.4, gap: 0.2 });
    }
  }

  /** Player bullets destroy heart orbs (enemy bullets carrying data.orb). */
  scanOrbs() {
    const s = this.scene, eb = s.bullets.enemy.list, pb = s.bullets.player.list;
    for (let i = 0; i < eb.length; i++) {
      const b = eb[i];
      if (!b.active || !b.data || !b.data.orb) continue;
      for (let j = 0; j < pb.length; j++) {
        const q = pb[j];
        if (!q.active) continue;
        const dx = q.x - b.x, dy = q.y - b.y, rr = b.r + q.r;
        if (dx * dx + dy * dy < rr * rr) {
          s.fx.burst(b.x, b.y - 20, { color: [0xff5a8a, 0xffd0e0], count: 8, speed: [60, 200], life: [200, 400], scale: [1.5, 3], blend: 'ADD' });
          s.bullets.enemy.kill(b, 'hit', true);
          s.bullets.player.kill(q, 'hit');
          break;
        }
      }
    }
  }

  destroy() {
    for (const b of this.sets) b.destroy();
    this.sets.length = 0;
    if (this.g && this.g.scene) this.g.destroy();
    this.g = null;
  }
}
const rad60 = (60 * Math.PI) / 180;

// ------------------------------------------------------------------------------------------------------------ contract page
/** The parchment on the floor centre (P3). show() unfurls it, tear() rips it, burn() chars it, hover() lifts it for the Sixth Bullet finale. */
export class Paper {
  constructor(boss) {
    this.boss = boss;
    this.scene = boss.scene;
    this.img = null;
  }

  get visible() { return !!this.img; }

  show(x = ROOM.cx, y = ROOM.cy + 20) {
    const s = this.scene;
    ensureScratchTextures(s);
    if (this.img) this.img.destroy();
    this.img = s.add.image(x, y, 'scratch_contract').setDepth(DEPTH.decals + 3).setRotation(-0.06).setScale(0.9, 0.05).setAlpha(0);
    this.img.__noSnap = true; s.fx._track(this.img);
    s.tweens.add({ targets: this.img, scaleY: 0.9, alpha: 0.92, duration: 500, ease: 'Cubic.easeOut' });
  }

  tear() {
    const im = this.img;
    if (!im) return;
    const s = this.scene;
    this.img = null;
    s.fx.burst(im.x, im.y, { color: [0xe8dcc0, 0xd4a537, 0xd63a2a], count: 28, speed: [120, 420], life: [500, 1000], scale: [2, 4], gravity: 300 });
    s.tweens.add({ targets: im, scaleX: 1.15, angle: 14, alpha: 0, y: im.y - 30, duration: 520, ease: 'Cubic.easeIn', onComplete: () => im.destroy() });
  }

  /** Death: the page burns where it lies (fire bursts, chars, fades). */
  burn(ms = 1800) {
    const im = this.img;
    if (!im) return;
    const s = this.scene;
    this.img = null;
    im.setTint(0x6a4a30);
    Sfx.play('page_burn', { vol: 0.9 });
    const rng = this.boss.rng;
    const ev = s.time.addEvent({ delay: 110, repeat: Math.floor(ms / 110), callback: () => {
      if (!im.scene) return;
      s.fx.burst(im.x + rng.float(-150, 150), im.y + rng.float(-100, 100), { color: [0xff9a2a, 0xffd060, 0xd63a2a], count: 5, speed: [30, 120], life: [400, 800], scale: [2, 4], angle: [240, 300], gravity: -60, blend: 'ADD' });
    } });
    s.tweens.add({ targets: im, alpha: 0, duration: ms, ease: 'Quad.easeIn', onComplete: () => { ev.remove(); im.destroy(); } });
  }

  /** Sixth Bullet finale: the page hovers above the table (STORY 6.6: (720, 470), scale 1.3). */
  hover(x = 720, y = 470, scale = 1.3) {
    const im = this.img;
    if (!im) return null;
    this.scene.tweens.killTweensOf(im);
    im.setDepth(DEPTH.fx - 30).setAlpha(1);
    this.scene.tweens.add({ targets: im, x, y, scaleX: scale, scaleY: scale, rotation: 0, duration: 700, ease: 'Cubic.easeOut' });
    return im;
  }

  hide() { if (this.img) { this.img.destroy(); this.img = null; } }
  destroy() { this.hide(); }
}

// ------------------------------------------------------------------------------------------------------------ death cards
/** Playing cards scatter upward (one-off at the boss's death; wall-clock tweens, self-destroying). */
export function cardBurst(scene, x, y, rng, n = 22) {
  const cols = [0xf2ead6, 0xf2ead6, 0xd63a2a, 0x24144a];
  for (let i = 0; i < n; i++) {
    const c = scene.add.rectangle(x + rng.float(-60, 60), y - 40 - rng.float(0, 100), 28, 40, cols[i % cols.length]).setStrokeStyle(2, 0x120c0a).setDepth(DEPTH.fx + 5);
    c.setRotation(rng.float(0, TAU));
    scene.tweens.add({
      targets: c, x: c.x + rng.float(-260, 260), y: c.y - 260 - rng.float(0, 260), rotation: c.rotation + rng.float(-5, 5), alpha: { from: 1, to: 0 },
      duration: 1300 + rng.float(0, 900), ease: 'Cubic.easeOut', delay: rng.float(0, 260), onComplete: () => c.destroy(),
    });
  }
}
