// BOSS 5 - ENGINE NO. 666 "The Midnight Express" (floor 5, HP 980 fixed, 3 phases). CHAPTER2 s4.
// Sprites: boss_engine_idle / _atk (320 px front view; atk 0 = shovelling coal, 1 = whistle scream, 2 = lurching forward, 3 = wrecked) and
// boss_engine_run (512x320 side view, 4 frames, faces right). Arena f5_boss: depot rows 0-1, rails on rows 2/4/6, safe strips on rows 3 and 5.
//
// Rail state machine (`railState`):  parked (front sprite, hittable, contact 1 dmg)  <->  passing (side sprite, hittable, a run along a rail row
// = 2 dmg + 280 px/s shove, roll i-frames dodge it)  <->  gone (off-screen, untargetable, <= 1.2 s, only while changing sides).
//   Phase 0 (100-66 %) "Midnight Express"  coal_barrage 3, steam_rings 3, lane_charge 4 (1 lane)             delay 1.5
//   Phase 1 (< 66 %)   "Ghost Train"       + phantom_express 3; 4 lumps per volley; lane_charge 2 lanes; roar, bullets cleared, 2 bandits   delay 1.15
//   Phase 2 (< 33 %)   "Full Steam"        + derail_run 4 (wall crash = the damage window: stunned 2.2 s, x1.5); 4 rings; 3 lanes             delay 0.9
// Every damage zone is telegraphed >= 0.9 s (coal 0.9, lanes 0.9-1.4, rings 0.9 windup). Phase changes interrupt the running attack
// (`interrupt` -> `resetState`): runs, tells, ghost lanes and coal markers are cancelled and the engine returns to the parked spot.
// Tuning vs CHAPTER2 s4 (bot 8-seed win rate 60-80 %, median 70-115 s): coal shards live 1.5 s (2.4 s left ~30 slow bullets in the arena after a barrage), the
// two Ghost Train handcar bandits have 0.6x hp and drop no loot (floor-5 hp scaling made them tankier than the boss window allows). Everything else is as designed.
// The engine drives its own position (no wall/obstacle resolve): x/y are set directly, `moveBy` is a no-op.
import Boss from '../Boss.js';
import { registerBoss } from '../registry.js';
import { spawnEnemy } from '../../enemies/index.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { bus } from '../../core/events.js';
import { subRng } from '../../core/rng.js';
import { ROOM, TILE, COLS, W, DEPTH, actorDepth } from '../../config.js';
import { clamp, angleDiff } from '../../core/util.js';
import { GroundHaz } from '../../systems/GroundHaz.js';
import { Hazards } from '../../rooms/hazards/index.js';
import { hurtPlayer, groundFoe, makeRock, hasCell, TAU } from '../../rooms/hazards/common.js';
import { TEX } from '../../rooms/hazards/tiles.js';
import { runTexKey } from '../parts/engineArt.js';

const RAIL_ROWS = [2, 4, 6];
const laneY = (r) => ROOM.y + r * TILE + TILE / 2;
const PARK_X = ROOM.cx, PARK_Y = 380;
const FOOT = 80; // sprite bottom below the body centre (parked)
const SCALE = 0.72; // 320 px front frames -> 230 px
const RUN_SCALE = 0.75; // 512 px side frames -> 384 px
const RUN_W = 512 * RUN_SCALE;
const HEAD = RUN_W * 0.4; // sprite centre -> front of the locomotive
const LANE_HALF = 36; // run hit box half-width across the lane (the safe strips start 48 px from the rail centre)
const RED = 0xd63a2a, TEAL = 0x6fe0d0, STEAM = 0xdde4e8, COAL = 0x9a6a3a;
const NAME = 'Engine No. 666';
const LANE_ATTACKS = new Set(['lane_charge', 'phantom_express', 'derail_run']);
const FIRST_LANE_AT = 3.0; // no lane telegraph earlier than this many seconds after the fight starts

const snd = (key, alt, o) => Sfx.play(Sfx.canPlay(key) ? key : alt, o); // canPlay = manifest file OR alias chain
const clampRoom = (o, m = 64) => { o.x = clamp(o.x, ROOM.x + m, ROOM.right - m); o.y = clamp(o.y, ROOM.y + m, ROOM.bottom - m); return o; };

class Engine extends Boss {
  setup() {
    const s = this.scene;
    this.rng = subRng('boss', 'engine', this.floor);
    this.tags = [];
    this.railState = 'parked';
    this.wreck = false; // parked at a wall after a derail
    this.run = null; // {mode:'pass'|'derail'|'back', dir, speed, y, hit, t, dur, fr, puff, dmg}
    this.tell = null; // lane telegraph {y, dir, t, dur, bells, nBells, strong}
    this._tell = { y: 0, dir: 1, t: 0, dur: 1, bells: 0, nBells: 4, strong: false };
    this.crashed = false;
    this.stunned = 0; this.stunFx = 0;
    this.tealT = 0; this.fadeT = 0;
    this.fightT = 0;
    this.stand = -1; this.standT = 0; // rail row the player stands on, and for how long
    this.lastLane = false;
    this.banditsDone = false;
    this.dtLast = 1 / 60;
    this.ghostLanes = []; // LaneSweep handles of phantom_express
    this.hz = []; // GroundHaz handles (coal markers)
    this.hitAdds = [];
    this.ownRails = [];
    this.footOffset = FOOT;
    this.hitRadius = 92;
    this.x = PARK_X; this.y = PARK_Y;
    this.sprite.setScale(SCALE); this.baseScale = SCALE;
    this.shadowScale = (this.radius * 2.6) / 128;
    this.tg = s.add.graphics().setDepth(DEPTH.decals + 6);
    this.tg.__noSnap = true;
    s.fx._track(this.tg);
    this.tgDrawn = false;
    this.paintRails();

    this.addAttack('coal_barrage', this.atkCoal, { weight: 3 });
    this.addAttack('steam_rings', this.atkSteam, { weight: 3 });
    this.addAttack('lane_charge', this.atkLane, { weight: 4 });
    this.addAttack('phantom_express', this.atkPhantom, { weight: 3, minPhase: 1 });
    this.addAttack('derail_run', this.atkDerail, { weight: 4, minPhase: 2 });
    this.phases = [
      { at: 0.66, name: 'Ghost Train', enter() { this.interrupt(this.roar(1)); } },
      { at: 0.33, name: 'Full Steam', enter() { this.interrupt(this.roar(2)); } },
    ];
    this.syncVisual();
  }

  attackDelay() { return this.cd([1.5, 1.15, 0.9][Math.min(2, this.phase)]); }
  applyStatus(name, o) { if (name === 'fear' || name === 'stun' || name === 'frozen') return; super.applyStatus(name, o); }
  moveBy() { this.hit = false; } // position is scripted (runs go off-screen): never resolved against walls / obstacles
  moveBehaviour() { this.stop(); }
  damageMultiplier() { return this.stunned > 0 ? 1.5 : 1; }
  /** DoT never ticks while the engine cannot be hit (gone / roaring). */
  hurt(dmg, info = {}) {
    if (info.dot && (this.invulnerable || this.dying)) return;
    super.hurt(dmg, info);
  }
  idleBob(dt) { if (this.railState === 'parked' && !this.wreck) super.idleBob(dt); }
  setPose(p) { if (this.railState !== 'passing' && this.railState !== 'gone') super.setPose(p); }
  atkFrame(i) { if (this.railState !== 'passing' && this.railState !== 'gone') super.atkFrame(i); }

  startFight() {
    super.startFight();
    this.fightT = 0;
    this.idleT = 1.5;
    snd('train_horn', 'boss_intro', { vol: 0.8 });
  }

  // ------------------------------------------------------------------------------------------ arena
  /** Rails on rows 2/4/6: the f5_boss template paints them (`=` tiles); a stand-in arena gets code-drawn ones so the lanes always read. */
  paintRails() {
    const room = this.scene.room, s = this.scene;
    if (!room || !room.tiles) return;
    const hz = Hazards.of(room);
    for (const r of RAIL_ROWS) {
      if (room.tiles[r] && room.tiles[r][0] && room.tiles[r][0].ch === '=') continue;
      const y = laneY(r);
      for (let c = 0; c < COLS; c++) {
        const x = ROOM.x + c * TILE + TILE / 2;
        const im = hasCell('haz_f5', 'rail_h') ? Assets.makeCell(s, x, y, 'haz_f5', 'rail_h', 0.5) : s.add.image(x, y, TEX.rail(s, 'h'));
        im.setDepth(DEPTH.decals - 1); im.__noSnap = true;
        if (hz && hz.rails) hz.rails.push(im); else this.ownRails.push(im);
      }
    }
  }

  /** Nearest rail row to the player (random tie-break); never a row the player has stood on for < 0.2 s (locks when the tell starts). */
  pickRow(exclude = -1) {
    const p = this.player;
    let best = -1, bd = 1e9;
    for (let i = 0; i < RAIL_ROWS.length; i++) {
      const row = RAIL_ROWS[i];
      if (row === exclude) continue;
      if (row === this.stand && this.standT < 0.2) continue;
      const d = Math.abs(laneY(row) - p.y) + this.rng.next() * 8;
      if (d < bd) { bd = d; best = row; }
    }
    return best >= 0 ? best : RAIL_ROWS[this.rng.int(0, 2)];
  }
  trackStand(dt) {
    const p = this.player;
    let on = -1;
    if (p) for (let i = 0; i < RAIL_ROWS.length; i++) if (Math.abs(laneY(RAIL_ROWS[i]) - p.y) < 48) { on = RAIL_ROWS[i]; break; }
    if (on === this.stand) this.standT += dt; else { this.stand = on; this.standT = 0; }
  }

  // ------------------------------------------------------------------------------------------ rail states
  showRun(faceDir) {
    const sp = this.sprite;
    sp.anims.stop();
    sp.setTexture(runTexKey(this.scene), 0);
    sp.setScale(RUN_SCALE).setFlipX(faceDir < 0).setVisible(true);
    this.baseScale = RUN_SCALE;
    this.pose = 'run';
    this.footOffset = 70;
    this.shadowScale = 3.0;
    if (this.shadow) this.shadow.setVisible(true);
  }
  /** Back at the parked spot (front sprite). `fade`: 0.6 s fade-in. */
  enterParked(fade) {
    this.railState = 'parked'; this.wreck = false;
    this.x = PARK_X; this.y = PARK_Y;
    this.footOffset = FOOT; this.hitRadius = 92;
    this.shadowScale = (this.radius * 2.6) / 128;
    this.sprite.setFlipX(false).setScale(SCALE).setVisible(true);
    this.baseScale = SCALE;
    if (this.shadow) this.shadow.setVisible(true);
    this.pose = '';
    this.setPose('move');
    this.targetable = true; this.invulnerable = false;
    this.contactDamage = this.meta.contactDamage ?? 1;
    if (fade) { this.fadeT = 0.6; this.alphaOverride = 0; } else { this.fadeT = 0; this.alphaOverride = undefined; }
  }
  goGone(puff = false) {
    if (puff) { this.scene.fx.burst(this.x, this.y - 40, { color: [STEAM, 0xa8b0b4], count: 16, speed: [60, 240], life: [400, 800], scale: [2, 4], gravity: -40 }); }
    this.railState = 'gone';
    this.targetable = false; this.invulnerable = true; this.contactDamage = 0;
    this.sprite.setVisible(false); this.alphaOverride = 0;
    if (this.shadow) this.shadow.setVisible(false);
    this.x = -600; this.y = PARK_Y;
  }
  startRun(row, dir, speed, mode = 'pass') {
    const f = this.scene.fx;
    this.railState = 'passing';
    this.showRun(dir);
    this.targetable = true; this.invulnerable = false; this.contactDamage = 0; this.hitRadius = 80;
    this.alphaOverride = undefined;
    this.hitAdds.length = 0;
    const y = laneY(row);
    this.y = y - 40;
    const r = this.run = { mode, dir, speed, y, hit: false, t: 0, dur: 1.2, fr: 0, puff: 0, dmg: mode === 'back' ? 0 : 2 };
    if (mode === 'back') this.x = (dir > 0 ? ROOM.right + 20 : ROOM.x - 20) - dir * HEAD;
    else {
      this.x = dir > 0 ? -RUN_W / 2 - 30 : W + RUN_W / 2 + 30;
      snd('train_horn', 'boss_intro', { vol: 0.9, rate: 1.1 });
      snd('rail_clatter', 'door_locked', { vol: 0.9 });
      f.shake(0.008, 500);
    }
    return r;
  }

  // ------------------------------------------------------------------------------------------ per-frame
  ai(dt) {
    this.dtLast = dt;
    this.trackStand(dt);
    if (this.active && !this.dying) this.fightT += dt;
    this.updateRun(dt);
    this.updateStun(dt);
    if (this.fadeT > 0) { this.fadeT -= dt; this.alphaOverride = this.fadeT <= 0 ? undefined : 1 - clamp(this.fadeT / 0.6, 0, 1); }
    if (this.tealT > 0) {
      this.tealT -= dt;
      if (this.flashT <= 0 && this.sprite) { if ((((this.tealT * 8) | 0) & 1) === 1) this.sprite.setTint(TEAL); else this.refreshTint(); }
      if (this.tealT <= 0) this.refreshTint();
    }
    this.drawTell(dt);
    super.ai(dt);
  }

  updateStun(dt) {
    if (this.stunned <= 0 || this.dying) return;
    this.stunned -= dt;
    this.stunFx -= dt;
    if (this.stunFx <= 0) {
      this.stunFx = 0.16;
      const f = this.scene.fx;
      f.burst(this.x + (this.rng.next() - 0.5) * 120, this.y - 120, { color: [0xffe070, 0xfff0a0], count: 2, speed: [10, 50], life: [400, 600], scale: [1.5, 2.5] });
      f.burst(this.x + (this.rng.next() - 0.5) * 140, this.y - 40, { color: [STEAM, 0x8a8f94], count: 2, speed: [20, 90], life: [500, 800], scale: [2, 3.5], gravity: -60 });
    }
  }

  /** Scripted run along a rail row: 'pass' crosses the room, 'derail' stops at the far wall (crash), 'back' slides out of the wall and fades. */
  updateRun(dt) {
    const r = this.run;
    if (!r) return;
    r.t += dt;
    const f = this.scene.fx, p = this.player;
    if (r.mode === 'back') {
      this.x -= r.dir * r.speed * dt;
      const k = clamp((r.t - (r.dur - 0.45)) / 0.45, 0, 1);
      this.alphaOverride = 1 - k;
      if (r.t >= r.dur) { this.run = null; this.goGone(); return; }
    } else {
      this.x += r.dir * r.speed * dt;
      if (r.mode === 'derail') {
        const front = this.x + r.dir * HEAD;
        if ((r.dir > 0 && front >= ROOM.right + 20) || (r.dir < 0 && front <= ROOM.x - 20)) { this.hitPlayerRun(r, p); this.run = null; this.crashed = true; return; }
      } else if ((r.dir > 0 && this.x > W + RUN_W / 2 + 40) || (r.dir < 0 && this.x < -RUN_W / 2 - 40)) { this.run = null; this.goGone(); return; }
    }
    r.fr += dt * (r.speed > 500 ? 22 : 12);
    this.sprite.setFrame((r.fr | 0) & 3);
    r.puff -= dt;
    if (r.puff <= 0 && this.x > -RUN_W / 3 && this.x < W + RUN_W / 3) {
      r.puff = 0.07;
      f.dust(this.x - r.dir * RUN_W * 0.3, r.y + 26, 1.1);
      if (r.mode !== 'back') f.burst(this.x - r.dir * RUN_W * 0.15, r.y + 30, { color: [0xffd070, 0xff9a2a], count: 2, speed: [60, 200], life: [150, 300], scale: [1, 1.8], gravity: 300 });
    }
    if (r.dmg > 0) {
      this.hitPlayerRun(r, p);
      this.hurtAdds(r);
    }
  }

  hitPlayerRun(r, p) {
    if (!p || r.hit || !p.canBeHit()) return;
    const pad = p.hurtRadius * 0.5;
    if (Math.abs(p.x - this.x) >= RUN_W / 2 - 12 + pad || Math.abs(p.y - r.y) >= LANE_HALF + pad) return;
    const sg = p.y >= r.y ? 1 : -1;
    if (hurtPlayer(this.scene, r.dmg, p.x, p.y - sg * 60, 'cart')) { r.hit = true; p.knock.x = 0; p.knock.y = sg * 280; }
  }
  /** The locomotive flattens adds standing in its lane (lure them): 14 dmg + 0.6 s stun, once each per run. */
  hurtAdds(r) {
    const list = this.scene.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === this || !groundFoe(e) || this.hitAdds.includes(e)) continue;
      if (Math.abs(e.x - this.x) < RUN_W / 2 - 20 + e.radius * 0.5 && Math.abs(e.y - r.y) < LANE_HALF + e.radius * 0.5) {
        this.hitAdds.push(e);
        e.hurt(14, { x: this.x, y: e.y, hazard: 'cart' });
        if (e.alive) e.applyStatus('stun', { t: 0.6 });
      }
    }
  }

  // ------------------------------------------------------------------------------------------ telegraphs
  startTell(row, dir, dur, nBells, strong) {
    const t = this._tell;
    t.y = laneY(row); t.dir = dir; t.t = 0; t.dur = dur; t.bells = 0; t.nBells = nBells; t.strong = !!strong;
    this.tell = t;
    snd('signal_lamp_on', 'door_locked', { vol: 0.7 });
  }
  endTell() { this.tell = null; }

  /** Red band across the whole lane (pulsing 4 Hz), lamps at both ends, headlight cone from the entry edge, chevrons, bells. */
  drawTell(dt) {
    const g = this.tg;
    if (!g || !g.scene) return;
    const t = this.tell;
    if (!t) { if (this.tgDrawn) { g.clear(); this.tgDrawn = false; } return; }
    g.clear(); this.tgDrawn = true;
    t.t += dt;
    const k = clamp(t.t / t.dur, 0, 1), pulse = 0.5 + 0.5 * Math.sin(t.t * TAU * 4);
    const half = TILE / 2 - 2, a = (0.14 + 0.12 * pulse + 0.14 * k) * (t.strong ? 1.5 : 1);
    g.fillStyle(RED, a).fillRect(0, t.y - half, W, half * 2);
    g.lineStyle(3, RED, 0.55 + 0.3 * pulse).strokeRect(0, t.y - half, W, half * 2);
    for (const x of [30, W - 30]) { g.fillStyle(RED, 0.5 + 0.4 * pulse).fillCircle(x, t.y, 13); g.lineStyle(3, 0x120c0a, 0.9).strokeCircle(x, t.y, 13); }
    const ex = t.dir > 0 ? 0 : W; // headlight cone from the entry edge
    g.fillStyle(0xfff0b0, 0.08 + 0.2 * k).fillTriangle(ex, t.y, ex + t.dir * 560, t.y - 70, ex + t.dir * 560, t.y + 70);
    g.fillStyle(RED, 0.45 + 0.4 * pulse);
    for (let i = 0; i < 3; i++) { const x = ex + t.dir * (70 + i * 34); g.fillTriangle(x + t.dir * 14, t.y, x - t.dir * 10, t.y - 22, x - t.dir * 10, t.y + 22); }
    while (t.bells < t.nBells && t.t >= t.bells * (t.dur / t.nBells)) { t.bells++; Sfx.play('train_bell', { vol: 0.8, gap: 0.05 }); }
  }

  // ------------------------------------------------------------------------------------------ scheduler
  startAttack() {
    const P = this.phase;
    let cands = this.attacks.filter((a) => a.minPhase <= P && a.maxPhase >= P);
    if (this.fightT < FIRST_LANE_AT) cands = cands.filter((a) => !LANE_ATTACKS.has(a.name));
    if (this.lastLane) { const c2 = cands.filter((a) => !LANE_ATTACKS.has(a.name)); if (c2.length) cands = c2; } // never two lane attacks in a row
    let pool = cands.filter((a) => a.name !== this.lastAttack);
    if (!pool.length) pool = cands;
    if (!pool.length) { this.idleT = 1; return; }
    this.beginAttack(this.rng.weighted(pool, (a) => a.weight));
  }
  beginAttack(a) {
    this.lastAttack = a.name;
    this.lastLane = LANE_ATTACKS.has(a.name);
    this.gen = a.fn.call(this);
    this.wait = 0;
  }
  /** Debug / tests: start attack `name` now (cancels whatever runs). */
  forceAttack(name) {
    const a = this.attacks.find((x) => x.name === name);
    if (!a) return false;
    this.resetState();
    this.beginAttack(a);
    this.idleT = 0;
    return true;
  }
  /** Replace the running attack (phase changes): everything the old attack left behind is cancelled. */
  interrupt(gen) { this.resetState(); this.gen = gen; this.wait = 0; }
  resetState() {
    this.run = null; this.tell = null; this.crashed = false; this.stunned = 0; this.tealT = 0; this.fadeT = 0;
    for (const r of this.ghostLanes) if (r && !r.d && r.l) r.l.cancel();
    this.ghostLanes.length = 0;
    for (const h of this.hz) if (h && h.cancel) h.cancel();
    this.hz.length = 0;
    if (this.railState !== 'parked' || this.wreck) this.enterParked(false);
    this.targetable = true; this.invulnerable = false; this.alphaOverride = undefined;
    this.contactDamage = this.meta.contactDamage ?? 1;
    if (this.tg && this.tg.scene && this.tgDrawn) { this.tg.clear(); this.tgDrawn = false; }
    if (this.sprite) this.refreshTint();
  }

  // ------------------------------------------------------------------------------------------ attack 1: coal barrage
  *atkCoal() {
    const fx = this.scene.fx, lumps = this.phase >= 1 ? 4 : 3;
    this.atkFrame(0); this.pulse(0.7);
    snd('fire_whoosh', 'explosion', { vol: 0.6, rate: 0.8 });
    fx.burst(this.x - 30, this.y - 20, { color: [0xff9a2a, 0xffd060, 0x3a2a20], count: 14, speed: [60, 220], life: [300, 600], scale: [1.5, 3], gravity: -40, blend: 'ADD' });
    yield 0.7;
    for (let v = 0; v < 3; v++) {
      this.coalVolley(v, lumps);
      fx.burst(this.x, this.y - 130, { color: [0x2a2320, 0x4a4240], count: 8, speed: [80, 260], life: [300, 600], scale: [2, 3.5], gravity: -30, dir: -Math.PI / 2, spread: 40 });
      snd('coal_thud', 'bullet_hit_wall', { vol: 0.6, rate: 0.7, gap: 0.1 });
      yield 0.6;
    }
    this.setPose('move');
    yield 0.5;
  }
  /** One volley of `n` coal lumps: the first on the player (leading his movement by 120 px on volleys 2-3), the rest scattered within +-140 px. */
  coalVolley(v, n) {
    const p = this.player, rng = this.rng, pts = [];
    const c0 = { x: p.x, y: p.y };
    if (v > 0) { const sp = Math.hypot(p.vx, p.vy); if (sp > 30) { c0.x += (p.vx / sp) * 120; c0.y += (p.vy / sp) * 120; } }
    pts.push(clampRoom(c0));
    for (let tries = 0; pts.length < n && tries < 40; tries++) {
      const a = rng.float(0, TAU), d = rng.float(80, 140);
      const q = clampRoom({ x: c0.x + Math.cos(a) * d, y: c0.y + Math.sin(a) * d });
      if (pts.every((o) => Math.hypot(o.x - q.x, o.y - q.y) > 92)) pts.push(q);
    }
    for (let i = 0; i < pts.length; i++) this.coalLump(pts[i].x, pts[i].y, 0.9 + i * 0.07);
  }
  coalLump(x, y, tell) {
    if (this.hz.length > 24) this.hz = this.hz.filter((h) => !h.done);
    const h = GroundHaz.of(this.scene).circle({
      x, y, r: 64, tell, active: 0.25, dmg: 1, kind: 'fire', source: { enemyName: NAME },
      fall: (sc) => makeRock(sc).setTint(0x3a2a20), fallScale: 1, fallDur: 0.35,
      fire: { r: 48, dur: 2.0 },
      onLand: (lh) => this.coalShards(lh.x, lh.y),
    });
    this.hz.push(h);
  }
  /** Landing throws a ring of 3 coal shards (speed 200). */
  coalShards(x, y) {
    const B = this.scene.bullets.enemy, a0 = this.rng.float(0, TAU);
    for (let k = 0; k < 3; k++) B.fire({ x, y, angle: a0 + (k * TAU) / 3, speed: 200, damage: 1, kind: 'coal', radius: 14, tint: COAL, life: 1.5, owner: this });
    snd('coal_thud', 'bullet_hit_wall', { vol: 0.7, rate: 0.6, gap: 0.05 });
  }

  // ------------------------------------------------------------------------------------------ attack 2: steam rings
  *atkSteam() {
    const fx = this.scene.fx, B = this.scene.bullets.enemy, rng = this.rng;
    const rings = this.phase >= 2 ? 4 : 3, gapT = this.phase >= 2 ? 0.55 : 0.65;
    this.atkFrame(1); this.pulse(0.9);
    snd('train_horn', 'boss_intro', { vol: 0.9, rate: 1.2 });
    fx.warnCircle(this.x, this.y, 300, 0.9, STEAM);
    fx.burst(this.x, this.y - 140, { color: [STEAM, 0xffffff], count: 18, speed: [60, 200], life: [500, 900], scale: [2, 4], gravity: -60, dir: -Math.PI / 2, spread: 50 });
    yield 0.9;
    const STEP = TAU / 16;
    let prev = null;
    for (let k = 0; k < rings; k++) {
      let base = 0, gapIdx = 0, gapA = 0;
      for (let tries = 0; tries < 12; tries++) {
        base = rng.float(0, TAU); gapIdx = rng.int(0, 15); gapA = base + gapIdx * STEP;
        if (prev == null || Math.abs(angleDiff(gapA, prev)) >= (60 * Math.PI) / 180) break;
      }
      prev = gapA;
      for (let i = 0; i < 16; i++) {
        const d = (i - gapIdx + 16) % 16;
        if (d === 0 || d === 1 || d === 15) continue; // 3 missing bullets
        B.fire({ x: this.x, y: this.y - 20, angle: base + i * STEP, speed: 250, damage: 1, kind: 'steam', radius: 15, tint: STEAM, life: 2.6, owner: this });
      }
      fx.ringPulse(this.x, this.y, STEAM, 120, 400, 0.5);
      snd('steam_hiss', 'snake_hiss', { vol: 0.8, gap: 0.1 });
      fx.shake(0.004, 150);
      yield gapT;
    }
    this.setPose('move');
    yield 0.6;
  }

  // ------------------------------------------------------------------------------------------ attack 3: lane charge
  *atkLane() {
    const n = [1, 2, 3][Math.min(2, this.phase)];
    let dir = this.rng.sign();
    for (let i = 0; i < n; i++) {
      const row = this.pickRow();
      if (i === 0) {
        this.atkFrame(2); this.pulse(1.1);
        snd('train_horn', 'boss_intro', { vol: 0.8 });
        this.startTell(row, dir, 1.1, 4, false);
        yield 1.1;
        this.endTell();
        this.goGone(true);
      } else {
        dir = -dir; // comes back from the side it just left
        this.startTell(row, dir, 0.9, 4, false);
        yield 0.9;
        this.endTell();
      }
      this.startRun(row, dir, 900);
      yield () => !this.run;
    }
    yield 1.0; // gone
    this.enterParked(true);
    yield 0.6;
  }

  // ------------------------------------------------------------------------------------------ attack 4: phantom express (P1+)
  *atkPhantom() {
    const room = this.scene.room, rng = this.rng;
    const rowA = this.pickRow();
    let rowB = rowA;
    while (rowB === rowA) rowB = RAIL_ROWS[rng.int(0, 2)];
    const dirA = rng.sign();
    this.atkFrame(1); this.tealT = 1.3;
    snd('train_horn', 'boss_intro', { vol: 0.7, rate: 1.3 });
    let want = 0, done = 0;
    const specs = [[rowA, dirA], [rowB, -dirA]];
    for (const [row, dir] of specs) {
      let l = null;
      const rec = { l: null, d: false };
      for (let tries = 0; tries < 6 && !l; tries++) {
        l = room && room.spawnLane ? room.spawnLane({ axis: 'h', index: row, dir, kind: 'ghost', tell: 1.2, dmg: 1, speed: 560, onDone: () => { rec.d = true; done++; } }) : null;
        if (!l) yield 0.25;
      }
      if (l) { rec.l = l; want++; this.ghostLanes.push(rec); }
    }
    let guard = 9;
    yield () => { guard -= this.dtLast; return done >= want || guard <= 0; };
    this.ghostLanes.length = 0;
    this.setPose('move');
    yield 0.5;
  }

  // ------------------------------------------------------------------------------------------ attack 5: derail run (P2+)
  *atkDerail() {
    const fx = this.scene.fx;
    const row = this.pickRow(), dir = this.rng.sign();
    this.atkFrame(2); this.pulse(1.4);
    snd('train_horn', 'boss_intro', { vol: 1, rate: 0.9 });
    this.startTell(row, dir, 1.4, 6, true);
    yield 1.4;
    this.endTell();
    this.goGone(true);
    this.crashed = false;
    this.startRun(row, dir, 1100, 'derail');
    yield () => !this.run;
    if (!this.crashed) { yield 1.0; this.enterParked(true); yield 0.6; return; }
    // crash into the far wall: jammed half inside the room, dazed and open to x1.5 damage
    this.crashed = false;
    this.railState = 'parked'; this.wreck = true;
    this.x = dir > 0 ? ROOM.right - 30 : ROOM.x + 30; this.y = laneY(row) - 30;
    this.footOffset = FOOT; this.hitRadius = 92; this.shadowScale = (this.radius * 2.6) / 128;
    this.sprite.setFlipX(false).setScale(SCALE).setVisible(true); this.baseScale = SCALE;
    if (this.shadow) this.shadow.setVisible(true);
    this.pose = ''; this.atkFrame(3);
    this.alphaOverride = undefined; this.targetable = true; this.invulnerable = false; this.contactDamage = 0;
    this.stunned = 2.2; this.stunFx = 0;
    fx.shake(0.03, 500); fx.hitStop(90); fx.flash(0xffffff, 0.25);
    fx.explosion(this.x + dir * 40, this.y - 20, 150);
    fx.burst(this.x, this.y - 30, { color: [0x2a2320, 0x8a4b1f, 0xff9a2a], count: 30, speed: [120, 460], life: [400, 900], scale: [2, 4], gravity: 500 });
    fx.burst(this.x, this.y - 60, { color: [STEAM, 0xa8b0b4], count: 24, speed: [60, 260], life: [600, 1200], scale: [2.5, 5], gravity: -70 });
    snd('explosion', 'explosion', { vol: 0.9, rate: 0.7 });
    snd('steam_blast', 'steam_hiss', { vol: 1 });
    this.wreckCoal(dir);
    yield 2.2;
    this.stunned = 0;
    // back out of the wall (1.2 s, fading), then park
    this.contactDamage = 0;
    fx.dust(this.x, this.y + 40, 1.6);
    this.startRun(row, dir, 380, 'back');
    yield () => !this.run;
    yield 0.4;
    this.enterParked(true);
    yield 0.6;
  }
  /** 6 falling-coal markers (r 64, tell 0.9 s) on the room side of the wreck. */
  wreckCoal(dir) {
    const rng = this.rng, pts = [];
    for (let tries = 0; pts.length < 6 && tries < 60; tries++) {
      const a = (dir > 0 ? Math.PI : 0) + rng.float(-1.5, 1.5), d = rng.float(150, 300);
      const q = clampRoom({ x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d });
      if (pts.every((o) => Math.hypot(o.x - q.x, o.y - q.y) > 105)) pts.push(q);
    }
    for (let i = 0; i < pts.length; i++) this.coalLump(pts[i].x, pts[i].y, 0.9 + i * 0.09);
  }

  // ------------------------------------------------------------------------------------------ phase changes
  /** Roar (short invulnerable window): 1 = two handcar bandits join (once), 2 = full steam. Bullets cleared. */
  *roar(n) {
    const s = this.scene, fx = s.fx;
    this.invulnerable = true;
    s.bullets.enemy.clear();
    this.atkFrame(1); this.pulse(1.2);
    fx.shake(0.014, 1100); fx.flash(STEAM, 0.3);
    fx.burst(this.x, this.y - 140, { color: [STEAM, 0xffffff], count: 30, speed: [80, 320], life: [500, 1000], scale: [2, 4], gravity: -50, blend: 'ADD' });
    snd('train_horn', 'boss_intro', { vol: 1, rate: n === 1 ? 1 : 1.25 });
    Sfx.play('boss_intro', { vol: 0.6, rate: 0.9 });
    yield 0.6;
    if (n === 1 && !this.banditsDone) { this.banditsDone = true; this.addBandits(); }
    yield 0.7;
    this.invulnerable = false;
    this.setPose('move');
  }
  addBandits() {
    const s = this.scene;
    for (const x of [ROOM.x + 170, ROOM.right - 170]) {
      s.fx.spawn(x, ROOM.y + 100);
      const e = spawnEnemy(s, 'handcar_bandit', x, ROOM.y + 100, { instant: true, floor: this.floor, hpMult: 0.6, noLoot: true });
      if (e) e.fromBoss = true;
    }
  }

  // ------------------------------------------------------------------------------------------ death
  /** Whistle scream, the boiler bursts, the Conductor's hat lands on the trapdoor. Pedestal pair + heart + trapdoor come from Room.onBossDefeated. */
  die(info = {}) {
    if (!this.alive || this.dying) return;
    const s = this.scene, fx = s.fx;
    this.resetState();
    this.clearHazards();
    this.dying = true; this.invulnerable = true; this.active = false; this.gen = null; this.contactDamage = 0;
    this.stop();
    const i = s.enemies.indexOf(this);
    if (i >= 0) s.enemies.splice(i, 1);
    s.bullets.enemy.clear();
    for (const e of [...s.enemies]) if (e.alive) e.die({ silent: true });
    bus.emit('boss:hp', { hp: 0, maxHp: this.maxHp, boss: this });
    Sfx.play('boss_die', { vol: 1 });
    snd('train_horn', 'boss_intro', { vol: 1, rate: 0.75 });
    s.slowMo(0.3, 2.2);
    fx.hitStop(140); fx.flash(0xffffff, 0.4);
    this.atkFrame(1);
    let n = 0;
    s.time.addEvent({
      delay: 150, repeat: 11,
      callback: () => {
        if (!this.sprite) return;
        n++;
        if (n === 6) this.atkFrame(3);
        const ox = (Math.random() - 0.5) * 170, oy = -20 - Math.random() * 150;
        fx.explosion(this.x + ox, this.y + oy, 60 + Math.random() * 50);
        fx.burst(this.x + ox, this.y + oy, { color: [STEAM, 0xa8b0b4, 0x2a2320], count: 10, speed: [60, 260], life: [500, 1000], scale: [2, 4.5], gravity: -50 });
        fx.shake(0.012 + n * 0.001, 200);
        if (n % 2 === 0) Sfx.play('explosion', { vol: 0.5, rate: 0.7 + Math.random() * 0.4, gap: 0.08 });
        this.sprite.setTint(n % 2 ? 0xffffff : 0xff6a4a);
      },
    });
    s.time.delayedCall(1800, () => this.boilerBurst());
    s.time.delayedCall(2300, () => this.finishDeath(info));
  }
  boilerBurst() {
    if (!this.sprite) return;
    const fx = this.scene.fx;
    fx.flash(0xffffff, 0.85);
    fx.explosion(this.x, this.y - 40, 320);
    for (let k = 0; k < 4; k++) fx.explosion(this.x + (Math.random() - 0.5) * 240, this.y - Math.random() * 180, 140 + Math.random() * 70);
    fx.shake(0.035, 800);
    Sfx.play('explosion', { vol: 1, rate: 0.7, gap: 0 });
    snd('steam_blast', 'steam_hiss', { vol: 1, gap: 0 });
    fx.burst(this.x, this.y - 60, { color: [STEAM, 0xffffff, 0xa8b0b4], count: 50, speed: [80, 480], life: [700, 1500], scale: [3, 6], gravity: -60 });
    fx.burst(this.x, this.y - 40, { color: [0x2a2320, 0x8a4b1f, 0xff9a2a], count: 40, speed: [120, 520], life: [500, 1100], scale: [2, 4], gravity: 500 });
    fx.decal(this.x, this.y, 'blood', 2.4);
    this.sprite.setVisible(false);
    if (this.shadow) this.shadow.setVisible(false);
  }
  finishDeath(info) {
    const s = this.scene, home = this.homeRoom, x = this.x, y = this.y;
    this.clearHazards();
    super.finishDeath(info);
    if (home && !home.destroyed && s.room === home) this.dropHat(x, y);
  }
  /** The Conductor's hat arcs onto the trapdoor spot (decor, fades out after a few seconds). */
  dropHat(x, y) {
    const s = this.scene;
    if (!s.textures.exists('hat')) return;
    const tx = ROOM.cx, ty = ROOM.cy + 46;
    const hat = s.add.image(x, y - 120, 'hat').setScale(1.3).setTint(0x2f3f66).setDepth(actorDepth(ty) + 1);
    s.fx._track(hat);
    s.tweens.add({ targets: hat, x: tx, duration: 700, ease: 'Sine.easeOut' });
    s.tweens.add({ targets: hat, y: ty, rotation: 5.2, duration: 700, ease: 'Bounce.easeOut', onComplete: () => { s.tweens.add({ targets: hat, alpha: 0, delay: 5000, duration: 800, onComplete: () => hat.destroy() }); } });
  }

  clearHazards() {
    for (const r of this.ghostLanes) if (r && !r.d && r.l) r.l.cancel();
    this.ghostLanes.length = 0;
    for (const h of this.hz) if (h && h.cancel) h.cancel();
    this.hz.length = 0;
    this.run = null; this.tell = null;
    if (this.tg && this.tg.scene) this.tg.clear();
    this.tgDrawn = false;
  }

  destroy() {
    this.clearHazards();
    if (this.tg && this.tg.scene) this.tg.destroy();
    this.tg = null;
    for (const im of this.ownRails) if (im && im.scene) im.destroy();
    this.ownRails.length = 0;
    super.destroy();
  }
}

registerBoss('engine', Engine, { hp: 980, r: 100, foot: FOOT, scale: SCALE, speed: 0, bob: true, name: 'ENGINE NO. 666', title: 'The Midnight Express', music: 'boss5', barks: ['ALL ABOARD THE DEAD', 'FULL STEAM AHEAD'] });
