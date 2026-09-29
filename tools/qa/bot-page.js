// In-page autoplay bot for DEAD WEST (QA). Injected by tools/qa/bot.mjs (plain script, no imports).
// Plays through the game's real input path (gameInput.override + press()), god mode OFF. Call window.__botInstall(cfg) once the GameScene is up,
// then drive with window.__botRun(nSteps) (fixed-step sim: game.step(t, 16.667), no rendering).
(() => {
  const TILE = 96, RX = 96, RY = 192, RW = 1248, RH = 672, RR = 1344, RB = 864, COLS = 13, ROWS = 7, CX = 720, CY = 528;
  const DOORS = {
    up: { dx: 0, dy: -1, tile: [6, 0], front: [6, 1], opp: 'down' },
    down: { dx: 0, dy: 1, tile: [6, 6], front: [6, 5], opp: 'up' },
    left: { dx: -1, dy: 0, tile: [0, 3], front: [1, 3], opp: 'right' },
    right: { dx: 1, dy: 0, tile: [12, 3], front: [11, 3], opp: 'left' },
  };
  const DIRS8 = [[0, 0]];
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; const c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a)); const l = Math.hypot(c, s); DIRS8.push([c / l, s / l]); }
  const ACTIVES = new Set(['whiskey_bottle', 'pocket_watch', 'powder_keg', 'lucky_deck']);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const tileOf = (x, y) => [Math.floor((x - RX) / TILE), Math.floor((y - RY) / TILE)];
  const tileC = (c, r) => [RX + c * TILE + TILE / 2, RY + r * TILE + TILE / 2];

  const DEFAULT_CFG = {
    react: 0.2, // s before a fresh bullet / telegraph is "seen"
    aim: 'free', // 'free' (mouse) | '4way' (arrow keys)
    aimJit: 0.035, // rad gaussian-ish aim error
    fireAcc: 0.97, // probability to actually squeeze when aligned
    rollProb: 0.9,
    lapseRate: 0, lapseLen: 0.3, // attention lapses: per second chance / seconds during which telegraphs and bullets are not noticed
    leadErr: 0, kiteJit: 0,
    kiteMin: 220, kiteMax: 340,
    maxSim: 3600, // s of sim per run
    stall: 90, // s without progress = soft-lock
    fullClear: true,
    useActive: true,
    useDynamite: false,
    verbose: false,
  };

  // skill presets: expert = omniscient-ish (upper bound); competent = a decent human (0.3 s reaction, attention lapses, sloppy aim, forgets to roll); casual = weak
  const PRESETS = {
    expert: {},
    competent: { react: 0.3, aimJit: 0.07, leadErr: 0.25, fireAcc: 0.9, rollProb: 0.6, lapseRate: 0.7, lapseLen: 0.35, kiteJit: 0.25 },
    human: { react: 0.35, aimJit: 0.095, leadErr: 0.32, fireAcc: 0.85, rollProb: 0.45, lapseRate: 0.9, lapseLen: 0.4, kiteJit: 0.32 },
    casual: { react: 0.4, aimJit: 0.12, leadErr: 0.4, fireAcc: 0.8, rollProb: 0.35, lapseRate: 1.1, lapseLen: 0.45, kiteJit: 0.4 },
  };
  window.__botInstall = (cfgIn = {}) => {
    cfgIn = { ...(PRESETS[cfgIn.skill || 'expert'] || {}), ...cfgIn };
    const sc0 = window.__dw.scene;
    const B = (window.__bot = {
      cfg: { ...DEFAULT_CFG, ...cfgIn },
      simT: 0, steps: 0,
      warns: [],
      rooms: [], // per visited room records
      dmg: [], // damage events
      ev: [], // notable events
      cur: null,
      result: null,
      dir: 1, dirT: 0, lastDir: [0, 0],
      path: null, pathKey: '', pathT: -9,
      stuck: { x: 0, y: 0, t: 0 },
      unstickUntil: 0, unstickDir: [0, 0],
      lastProg: 0, lastProgT: 0, progSig: '',
      rollEvents: 0, rollsUsed: 0,
      floorT: {},
      shotLog: { shots: 0 },
      lastRoomId: null, aimRnd: 0, lapseUntil: 0, ignore: new Set(), goalKey: '', goalSince: 0,
      goalDesc: '',
    });
    const sc = sc0;
    const p = sc.player;
    // Phaser's TweenManager reads Date.now(): run it on the simulated clock so tweens (room slides, pickups fade) advance with sim steps
    let fakeNow = Date.now();
    Date.now = () => fakeNow;
    // ------------------------------------------------------------------------------------------------ hooks
    const fx = sc.fx;
    const oc = fx.warnCircle.bind(fx), ol = fx.warnLine.bind(fx);
    fx.warnCircle = (x, y, r, time = 0.8, color) => { B.warns.push({ k: 'c', x, y, r, t0: B.simT, t1: B.simT + time }); return oc(x, y, r, time, color); };
    fx.warnLine = (x1, y1, x2, y2, w = 40, time = 0.6, color) => { B.warns.push({ k: 'l', x1, y1, x2, y2, w, t0: B.simT, t1: B.simT + time }); return ol(x1, y1, x2, y2, w, time, color); };
    const od = p.damage.bind(p);
    p.damage = (u, src) => {
      const before = p.hp + p.tin;
      const r = od(u, src);
      if (r) {
        const room = sc.room;
        B.dmg.push({ t: +B.simT.toFixed(1), floor: sc.floorNum, room: room ? room.type : '?', rid: room ? room.def.id : '?', tier: room && room.tpl ? room.tpl.tier || 0 : 0, tpl: room ? room.def.template : '', pos: [Math.round(p.x), Math.round(p.y)], lapse: B.simT < B.lapseUntil, goal: B.goalDesc, u: before - (p.hp + p.tin), src: (src && (src.enemyName || src.kind || (src.explosion ? 'explosion' : ''))) || '?', boss: room && room.boss && room.boss.alive ? room.boss.lastAttack || 'boss' : null });
        if (B.cur) B.cur.dmg += before - (p.hp + p.tin);
      }
      return r;
    };
    const oco = p.collect.bind(p);
    p.collect = (type) => { const r = oco(type); if (r) { const f = (B.pk[sc.floorNum] = B.pk[sc.floorNum] || {}); f[type] = (f[type] || 0) + 1; } return r; };
    B.pk = {};
    const opk = sc.items.pickup.bind(sc.items);
    sc.items.pickup = (pl, id, source) => { B.ev.push({ t: +B.simT.toFixed(1), e: 'item', id, source, floor: sc.floorNum, coins: p.coins }); return opk(pl, id, source); };
    B.wrapped = true;

    // ------------------------------------------------------------------------------------------------ helpers
    const room = () => sc.room;
    const tileAt = (c, r) => { const rm = room(); return rm && rm.tiles[r] && rm.tiles[r][c]; };
    const solidTile = (c, r) => { const t = tileAt(c, r); return !t || t.solid; };
    const isBad = (c, r) => { const t = tileAt(c, r); return !t || t.solid || t.type === 'spikes'; };

    // A* on the 13x7 tile grid (8-way with corner rule). `blocked` = Set of "c,r" extra blocked tiles. Returns list of tile [c,r] from start (exclusive) to goal.
    function astar(sc_, sr, gc, gr, blocked, allowSpikes) {
      const key = (c, r) => r * COLS + c;
      const open = [[0, sc_, sr]];
      const g = new Map([[key(sc_, sr), 0]]);
      const from = new Map();
      const closed = new Set();
      const h = (c, r) => Math.max(Math.abs(c - gc), Math.abs(r - gr)) + 0.4 * Math.min(Math.abs(c - gc), Math.abs(r - gr));
      const okT = (c, r) => {
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
        const t = tileAt(c, r);
        if (!t || t.solid) return false;
        if (!allowSpikes && t.type === 'spikes') return false;
        if (blocked && blocked.has(c + ',' + r)) return false;
        return true;
      };
      let guard = 0;
      while (open.length && guard++ < 400) {
        let bi = 0;
        for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
        const [, c, r] = open.splice(bi, 1)[0];
        const k = key(c, r);
        if (closed.has(k)) continue;
        closed.add(k);
        if (c === gc && r === gr) {
          const out = [];
          let cur = k;
          while (from.has(cur)) { out.push([cur % COLS, Math.floor(cur / COLS)]); cur = from.get(cur); }
          return out.reverse();
        }
        for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
          if (!dc && !dr) continue;
          const nc = c + dc, nr = r + dr;
          if (!okT(nc, nr) && !(nc === gc && nr === gr && !solidTile(nc, nr))) continue;
          if (dc && dr && (!okT(c + dc, r) || !okT(c, r + dr))) continue;
          const nk = key(nc, nr);
          if (closed.has(nk)) continue;
          const t = tileAt(nc, nr);
          const cost = g.get(k) + (dc && dr ? 1.42 : 1) + (t && t.type === 'spikes' ? 6 : 0);
          if (!g.has(nk) || cost < g.get(nk)) { g.set(nk, cost); from.set(nk, k); open.push([cost + h(nc, nr), nc, nr]); }
        }
      }
      return null;
    }

    function segClear(x1, y1, x2, y2, r = 24) {
      const rm = room();
      const d = Math.hypot(x2 - x1, y2 - y1);
      const n = Math.max(1, Math.ceil(d / 24));
      for (let i = 1; i <= n; i++) {
        const x = x1 + ((x2 - x1) * i) / n, y = y1 + ((y2 - y1) * i) / n;
        if (rm.probe(x, y, r, { flying: false })) return false;
        const [c, rr] = tileOf(x, y);
        const t = tileAt(c, rr);
        if (t && t.type === 'spikes') return false;
      }
      return true;
    }

    /** goal vector toward world point via A* waypoints (with lookahead). Returns {x,y,d} unit vector + remaining distance. */
    function pathTo(tx, ty, blocked) {
      const [sc_, sr] = tileOf(p.x, p.y);
      const [gc, gr] = tileOf(tx, ty);
      const dist = Math.hypot(tx - p.x, ty - p.y);
      // direct line if clear
      if (dist < 700 && segClear(p.x, p.y, tx, ty, 22) && !(blocked && blocked.size)) return { x: (tx - p.x) / (dist || 1), y: (ty - p.y) / (dist || 1), d: dist, direct: true };
      const key = `${sc_},${sr}>${gc},${gr}`;
      if (B.pathKey !== key || B.simT - B.pathT > 0.5 || !B.path) {
        B.path = astar(clamp(sc_, 0, COLS - 1), clamp(sr, 0, ROWS - 1), clamp(gc, 0, COLS - 1), clamp(gr, 0, ROWS - 1), blocked, false) || astar(clamp(sc_, 0, COLS - 1), clamp(sr, 0, ROWS - 1), clamp(gc, 0, COLS - 1), clamp(gr, 0, ROWS - 1), blocked, true);
        B.pathKey = key; B.pathT = B.simT;
      }
      const path = B.path;
      if (!path || !path.length) { return { x: (tx - p.x) / (dist || 1), y: (ty - p.y) / (dist || 1), d: dist, nopath: !path }; }
      // farthest waypoint (max 4 ahead) with clear line
      let wp = tileC(path[0][0], path[0][1]);
      for (let i = 0; i < Math.min(path.length, 5); i++) {
        const w = tileC(path[i][0], path[i][1]);
        if (i === 0 || segClear(p.x, p.y, w[0], w[1], 22)) wp = w; else break;
      }
      if (path.length <= 1) wp = [tx, ty];
      const d = Math.hypot(wp[0] - p.x, wp[1] - p.y) || 1;
      return { x: (wp[0] - p.x) / d, y: (wp[1] - p.y) / d, d: dist };
    }

    // ------------------------------------------------------------------------------------------------ threat model
    const relHit = (rx, ry, wx, wy, R, ta, tb) => {
      // earliest tau in [ta,tb] where |r + w tau| < R, else -1
      const a = wx * wx + wy * wy;
      const b = 2 * (rx * wx + ry * wy);
      const c = rx * rx + ry * ry - R * R;
      if (a < 1e-6) return c < 0 ? ta : -1;
      const disc = b * b - 4 * a * c;
      if (disc < 0) return -1;
      const sq = Math.sqrt(disc);
      const t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
      if (t2 < ta || t1 > tb) return -1;
      return Math.max(t1, ta);
    };

    function gatherThreats() {
      const cfg = B.cfg;
      const T = { bullets: [], bodies: [], zones: [] };
      const rm = room();
      if (!rm) return T;
      const H = 0.7;
      for (const b of sc.bullets.enemy.list) {
        if (!b.active || !b.hitsPlayer) continue;
        if (b.age < cfg.react) continue;
        const dx = b.x - p.x, dy = b.y - p.y;
        if (dx * dx + dy * dy > 640 * 640) continue;
        // cap life by obstacles / walls / lifetime
        let cap = Math.min(H, b.life - b.age);
        if (!b.spectral && !b.noObstacle) {
          for (let t = 0.05; t <= cap; t += 0.05) { if (rm.bulletBlock(b.x + b.vx * t, b.y + b.vy * t, b.r * 0.8)) { cap = t; break; } }
        }
        if (!b.noWall) { for (let t = 0.05; t <= cap; t += 0.05) { const x = b.x + b.vx * t, y = b.y + b.vy * t; if (x < RX || x > RR || y < RY || y > RB) { cap = t; break; } } }
        if (cap <= 0.02) continue;
        T.bullets.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, R: p.hurtRadius + b.r * 0.6 + 8, cap });
      }
      for (const e of sc.enemies) {
        if (!e.alive || e.spawnT > 0 || !(e.contactDamage > 0)) continue;
        if (e.isBoss && !e.active) continue;
        if (e.status && e.status.stun) continue;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy > 700 * 700) continue;
        T.bodies.push({ x: e.x, y: e.y, vx: e.vx + e.knock.x * 0.2, vy: e.vy + e.knock.y * 0.2, R: p.hurtRadius + e.radius * 0.85 + 10, e });
      }
      // telegraph zones (after reaction time)
      const now = B.simT;
      for (let i = B.warns.length - 1; i >= 0; i--) if (now > B.warns[i].t1 + 0.5) B.warns.splice(i, 1);
      for (const w of B.warns) {
        if (now < w.t0 + Math.min(cfg.react, Math.max(0.05, (w.t1 - w.t0) * 0.45))) continue;
        T.zones.push(w);
      }
      for (const d of sc.dynamites) {
        if (!d.alive) continue;
        const r = (d.o && d.o.radius) || p.stats.dynamiteRadius || 150;
        if (d.o && d.o.hurtPlayer === false) continue;
        const lit = d.flight > 0 && d.flightT < d.flight ? d.flight - d.flightT + d.fuse : d.fuse;
        T.zones.push({ k: 'c', x: d.x, y: d.y, r: r + 15, t0: now, t1: now + lit });
      }
      // Undertaker ground hazards
      const ub = sc.enemies.find((e) => e.isBoss && e.haz);
      if (ub) {
        for (const h of ub.haz) {
          if (h.fired && h.t - h.warn > h.active) continue;
          T.zones.push({ k: 'c', x: h.x, y: h.y, r: h.r + 10, t0: now - h.t, t1: now + Math.max(0, h.warn - h.t) });
        }
        for (const w of ub.waves) {
          const c = Math.cos(w.a), s = Math.sin(w.a);
          T.bullets.push({ x: w.x + c * w.dist, y: w.y + s * w.dist, vx: c * w.speed, vy: s * w.speed, R: w.w / 2 + 34, cap: 0.6 });
        }
      }
      return T;
    }

    // danger cost for the player on straight path pos(t) = (px,py) + (vx,vy) t over [ta,tb]; returns {cost, hitT}
    function danger(T, px, py, vx, vy, ta, tb, invLeft) {
      let cost = 0, hitT = 9;
      const note = (t, base, span) => { cost += base * (1 - Math.min(1, t / span) * 0.6); if (t < hitT) hitT = t; };
      for (const b of T.bullets) {
        const t = relHit(b.x - px, b.y - py, b.vx - vx, b.vy - vy, b.R, ta, Math.min(tb, b.cap));
        if (t >= 0 && t >= invLeft) note(t, 260, 0.7);
      }
      for (const b of T.bodies) {
        const t = relHit(b.x - px, b.y - py, b.vx - vx, b.vy - vy, b.R, ta, Math.min(tb, 0.6));
        if (t >= 0 && t >= invLeft) note(t, 190, 0.6);
      }
      const now = B.simT;
      for (const z of T.zones) {
        // zone becomes harmful at t1 (small lead) for ~0.45 s
        const zs = Math.max(0, z.t1 - now - 0.04), ze = z.t1 - now + 0.45;
        const a = Math.max(ta, zs), b2 = Math.min(tb, ze);
        if (b2 < a) continue;
        let inside = false, worst = 0;
        for (let k = 0; k <= 2; k++) {
          const t = a + ((b2 - a) * k) / 2;
          const qx = px + vx * t, qy = py + vy * t;
          if (z.k === 'c') { if (Math.hypot(qx - z.x, qy - z.y) < z.r + 22) { inside = true; worst = t; break; } }
          else {
            const ex = z.x2 - z.x1, ey = z.y2 - z.y1, l2 = ex * ex + ey * ey || 1;
            const u = clamp(((qx - z.x1) * ex + (qy - z.y1) * ey) / l2, 0, 1);
            const dd = Math.hypot(qx - (z.x1 + ex * u), qy - (z.y1 + ey * u));
            if (dd < z.w / 2 + 30) { inside = true; worst = t; break; }
          }
        }
        if (inside && worst >= invLeft) note(Math.max(0, worst), 170, 0.8);
      }
      return { cost, hitT };
    }

    // ------------------------------------------------------------------------------------------------ movement decision
    // goal: {x,y} unit vector (or zero) with weight; returns chosen move vector + whether a roll is advised
    function steer(goal, gw, T, opts = {}) {
      const rm = room();
      const invLeft = Math.max(p.hurtT, p.entryInv, p.rolling ? p.rollT : 0);
      const sp = p.stats.moveSpeed;
      const spikeHit = (x, y) => { const [c0, r0] = tileOf(x, y); for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const t = tileAt(c0 + dc, r0 + dr); if (t && t.type === 'spikes' && Math.abs(x - t.x) < 52 && Math.abs(y - t.y) < 52) return true; } return false; };
      let best = null, bestScore = -1e9;
      const cands = [];
      for (const d of DIRS8) {
        let cost = 0, block = false;
        const vx = d[0] * sp, vy = d[1] * sp;
        // terrain: sample positions
        for (let k = 1; k <= 4; k++) {
          const t = 0.06 * k;
          const qx = p.x + vx * t, qy = p.y + vy * t;
          if (d[0] || d[1]) {
            if (qx < RX + 26 && !(Math.abs(qy - CY) < 40 && rm.doors.left && rm.doors.left.passable)) { block = block || k <= 2; cost += 60; }
            if (qx > RR - 26 && !(Math.abs(qy - CY) < 40 && rm.doors.right && rm.doors.right.passable)) { block = block || k <= 2; cost += 60; }
            if (qy < RY + 26 && !(Math.abs(qx - CX) < 40 && rm.doors.up && rm.doors.up.passable)) { block = block || k <= 2; cost += 60; }
            if (qy > RB - 26 && !(Math.abs(qx - CX) < 40 && rm.doors.down && rm.doors.down.passable)) { block = block || k <= 2; cost += 60; }
            if (rm.probe(qx, qy, 22, { flying: false })) { if (k <= 3) block = true; cost += 80; }
          }
          if (!opts.allowSpikes && spikeHit(qx, qy)) cost += 120; // includes standing still: leave a spike box (game hit box is +-52 px around the tile centre)
        }
        // near-wall discomfort (combat only)
        if (opts.combat && !B.cStalled) {
          const fx_ = p.x + vx * 0.35, fy_ = p.y + vy * 0.35;
          const m = 110;
          const wx = Math.max(0, m - (fx_ - RX)) + Math.max(0, m - (RR - fx_)), wy = Math.max(0, m - (fy_ - RY)) + Math.max(0, m - (RB - fy_));
          cost += (wx + wy) * 0.35 + (wx > 0 && wy > 0 ? 60 : 0);
        }
        const dg = danger(T, p.x, p.y, vx, vy, 0, 0.55, invLeft);
        let g = (d[0] * goal.x + d[1] * goal.y) * gw;
        if (opts.los) { const qx = p.x + vx * 0.3, qy = p.y + vy * 0.3; if (!block && !rayBlocked(qx, qy - 6, opts.los.x, opts.los.y)) g += 30; }
        const same = d[0] === B.lastDir[0] && d[1] === B.lastDir[1] ? 8 : 0;
        const score = g - cost - dg.cost + same - (block ? 400 : 0);
        cands.push({ d, score, dg, block });
        if (score > bestScore) { bestScore = score; best = { d, dg, block, score }; }
      }
      B.dbgSteer = { goal: [+goal.x.toFixed(2), +goal.y.toFixed(2)], gw, cands: cands.map((c) => [c.d.map((v) => +v.toFixed(1)).join(','), Math.round(c.score), Math.round(c.dg.cost), c.block ? 'B' : '']) , nz: T.zones.length, nb: T.bullets.length, nbody: T.bodies.length };
      // stay-put candidate is DIRS8[0]; if best is still dangerous consider a roll
      let roll = null;
      const imminent = best.dg.hitT < 0.3 && best.dg.cost >= 90;
      if (imminent && p.rollCd <= 0 && !p.rolling && Math.random() < B.cfg.rollProb) {
        let rb = null, rs = -1e9;
        for (const d of DIRS8) {
          if (!d[0] && !d[1]) continue;
          const L = p.stats.rollDistance;
          let qx = p.x + d[0] * L, qy = p.y + d[1] * L;
          qx = clamp(qx, RX + 30, RR - 30); qy = clamp(qy, RY + 30, RB - 30);
          if (!segClear(p.x, p.y, qx, qy, 22)) continue;
          const dg = danger(T, qx, qy, 0, 0, p.stats.rollDuration + 0.02, 0.85, 0);
          const s = -dg.cost + (d[0] * goal.x + d[1] * goal.y) * 25;
          if (s > rs) { rs = s; rb = d; }
        }
        if (rb) roll = rb;
      }
      return { move: { x: best.d[0], y: best.d[1] }, roll, hitT: best.dg.hitT, cost: best.dg.cost };
    }

    // ------------------------------------------------------------------------------------------------ combat
    const isTargetable = (e) => e.alive && e.targetable !== false && !e.invulnerable && e.spawnT <= 0 && !(e.isBoss && !e.active) && !e.dying;
    function rayBlocked(x1, y1, x2, y2) {
      const rm = room();
      const d = Math.hypot(x2 - x1, y2 - y1);
      const n = Math.ceil(d / 20);
      for (let i = 1; i < n; i++) { const x = x1 + ((x2 - x1) * i) / n, y = y1 + ((y2 - y1) * i) / n; if (rm.bulletBlock(x, y, 8)) return true; }
      return false;
    }

    function pickTarget(list) {
      const range = p.stats.shotSpeed * p.stats.range * 0.95;
      let best = null, bs = 1e9;
      for (const e of list) {
        if (!isTargetable(e)) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        let s = d;
        if (e.id === 'scarecrow') s -= 120;
        if (e.id === 'crow' || e.id === 'tumbleweed_mini') s += 40;
        if (e.isBoss) s -= 60;
        if (d > range + e.hitRadius) s += 300;
        else if (rayBlocked(p.x, p.y - 6, e.x, e.y)) s += 250;
        if (s < bs) { bs = s; best = e; }
      }
      return best;
    }

    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

    function combat(T) {
      const cfg = B.cfg;
      const enemies = sc.enemies.filter((e) => e.alive && !e.noClear);
      const boss = enemies.find((e) => e.isBoss);
      let tgt = pickTarget(enemies);
      // shielded Undertaker: shoot only from the side/back
      let goal = { x: 0, y: 0 }, gw = 70;
      let nearest = null, nd = 1e9;
      for (const e of enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < nd) { nd = d; nearest = e; } }
      const focus = tgt || nearest;
      let want = cfg.kiteMax - 20;
      if (boss) want = boss.id === 'cascabel' ? 360 : 330;
      // repulsion from close bodies
      let rx = 0, ry = 0;
      for (const e of enemies) {
        if (!(e.contactDamage > 0) || e.spawnT > 0) continue;
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
        const rad = e.radius + 150 + (e.isBoss ? 60 : 0) + Math.hypot(e.vx, e.vy) * 0.25;
        if (d < rad) { const k = (1 - d / rad); rx += (dx / d) * k * 2.2; ry += (dy / d) * k * 2.2; }
      }
      goal.x += rx; goal.y += ry;
      if (focus) {
        const dx = focus.x - p.x, dy = focus.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d > want + 50) {
          const pt = segClear(p.x, p.y, focus.x, focus.y, 22) ? { x: dx / d, y: dy / d } : pathTo(focus.x, focus.y);
          goal.x += pt.x * 1.0; goal.y += pt.y * 1.0;
        } else if (d < cfg.kiteMin && !(focus.contactDamage === 0)) { goal.x -= (dx / d) * 0.8; goal.y -= (dy / d) * 0.8; }
        // orbit
        B.dirT -= 1 / 60;
        if (B.dirT <= 0) { B.dir = Math.random() < 0.5 ? -1 : 1; B.dirT = 1.5 + Math.random() * 2; }
        let orb = B.dir;
        if (boss && boss.shield && !boss.lockFace && boss.faceAngle != null) {
          const rel = Math.atan2(p.y - boss.y, p.x - boss.x) - boss.faceAngle;
          const relN = Math.atan2(Math.sin(rel), Math.cos(rel));
          orb = relN >= 0 ? 1 : -1;
        }
        const tang = 0.55;
        if (cfg.kiteJit) { B.jx = (B.jx || 0) * 0.94 + gauss() * cfg.kiteJit * 0.3; B.jy = (B.jy || 0) * 0.94 + gauss() * cfg.kiteJit * 0.3; goal.x += B.jx; goal.y += B.jy; }
        goal.x += (-dy / d) * tang * orb; goal.y += (dx / d) * tang * orb;
      }
      // anti-stall: nothing hurt for 25 s of combat (target hidden behind cover, orbit vs repulsion deadlock) -> walk the A* path straight at it
      { const sumHp = enemies.reduce((a, e) => a + e.hp, 0) + enemies.length; if (sumHp !== B.cStallHp) { B.cStallHp = sumHp; B.cStallT = B.simT; }
        B.cStalled = !!(focus && !boss && B.simT - B.cStallT > 25);
        if (B.cStalled) { const pt = pathTo(focus.x, focus.y); goal.x = pt.x * 1.6; goal.y = pt.y * 1.6; } }
      // keep off walls / prefer openness
      const mg = B.cStalled ? 1 : 150;
      if (p.x < RX + mg) goal.x += (RX + mg - p.x) / mg * 1.6; if (p.x > RR - mg) goal.x -= (p.x - (RR - mg)) / mg * 1.6;
      if (p.y < RY + mg) goal.y += (RY + mg - p.y) / mg * 1.6; if (p.y > RB - mg) goal.y -= (p.y - (RB - mg)) / mg * 1.6;
      // 4-way alignment
      let aim = null;
      if (tgt) {
        const spd = p.stats.shotSpeed;
        const dist0 = Math.hypot(tgt.x - p.x, tgt.y - p.y);
        const tl = dist0 / spd * 0.85 * (1 + gauss() * cfg.leadErr);
        const lx = tgt.x + (tgt.vx + tgt.knock.x * 0.3) * tl, ly = tgt.y + (tgt.vy + tgt.knock.y * 0.3) * tl;
        const range = spd * p.stats.range;
        const dx = lx - p.x, dy = ly - (p.y - 6), d = Math.hypot(dx, dy) || 1;
        const hr = (tgt.hitRadius || 30) * 0.8 + 6;
        const blockedRay = rayBlocked(p.x, p.y - 6, lx, ly);
        let shieldBlocked = false;
        if (boss && tgt === boss && boss.shield && boss.faceAngle != null) {
          const rel = Math.atan2(p.y - boss.y, p.x - boss.x) - boss.faceAngle;
          shieldBlocked = Math.abs(Math.atan2(Math.sin(rel), Math.cos(rel))) < 1.25;
        }
        B.aimWhy = `d=${Math.round(d)} range=${Math.round(range)} ray=${blockedRay} sh=${shieldBlocked}`;
        if (d < range + tgt.hitRadius * 0.5 && !blockedRay && !shieldBlocked) {
          if (cfg.aim === 'free') {
            const a = Math.atan2(dy, dx) + gauss() * cfg.aimJit;
            aim = { x: Math.cos(a), y: Math.sin(a) };
          } else {
            let bestA = null, bp = 1e9;
            for (const v of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const along = dx * v[0] + dy * v[1];
              const perp = Math.abs(-dx * v[1] + dy * v[0]);
              if (along > 0 && perp < hr && perp < bp) { bp = perp; bestA = v; }
            }
            if (bestA) aim = { x: bestA[0], y: bestA[1] };
            else {
              // strafe to line up along the axis with the smaller perpendicular error
              if (Math.abs(dx) > Math.abs(dy)) goal.y += Math.sign(dy) * 0.9; else goal.x += Math.sign(dx) * 0.9;
            }
          }
        }
      }
      if (aim && Math.random() > cfg.fireAcc) aim = null;
      // slip: momentary attention lapse
      const Teff = B.simT < B.lapseUntil ? { bullets: [], bodies: [], zones: [] } : T;
      const gl = Math.hypot(goal.x, goal.y);
      if (gl > 1) { goal.x /= gl; goal.y /= gl; }
      const st = steer(goal, gw * Math.min(1, gl) + 1, Teff, { combat: true, los: tgt || nearest });
      B.goalDesc = `combat tgt=${tgt ? tgt.id : '-'} n=${enemies.length}`;
      return { move: st.move, roll: st.roll, aim, tgt, boss, enemies, hitT: st.hitT };
    }

    // ------------------------------------------------------------------------------------------------ exploring
    function collectibleGoals() {
      const rm = room();
      const goals = [];
      const inShop = rm.type === 'shop';
      for (const pk of rm.pickups) {
        if (!pk.alive) continue;
        if (pk.basePrice != null) continue; // handled below
        if (!p.canCollect(pk.type)) continue;
        goals.push({ x: pk.x, y: pk.y, kind: 'pickup', v: 50, obj: pk });
      }
      for (const pd of rm.pedestals) {
        const rec = pd.rec;
        if (rec.taken || !rec.itemId || !pd.icon || pd.needsLeave) continue;
        if (rec.price != null) continue;
        if (ACTIVES.has(rec.itemId) && p.active) continue; // never swap actives (would ping-pong with the pedestal)
        goals.push({ x: pd.x, y: pd.y + 4, kind: 'item', v: 100, obj: pd });
      }
      for (const ch of rm.chests) {
        if (ch.rec.opened) continue;
        if (ch.rec.type === 'chest_gold' && p.keys < 2) continue;
        goals.push({ x: ch.x, y: ch.y + 6, kind: 'chest', v: 40, obj: ch });
      }
      // shop purchases
      if (inShop) {
        let coins = p.coins;
        const opts = [];
        for (const pd of rm.pedestals) { const rec = pd.rec; if (rec.taken || !rec.itemId || rec.price == null) continue; if (ACTIVES.has(rec.itemId) && p.active) continue; opts.push({ x: pd.x, y: pd.y + 4, price: p.price(rec.price), v: 100, obj: pd }); }
        for (const pk of rm.pickups) {
          if (!pk.alive || pk.basePrice == null) continue;
          let v = 0;
          const t = pk.type;
          const missing = p.maxHp - p.hp;
          if (t === 'heart_full') v = missing >= 2 ? 70 : missing >= 1 ? 40 : 0;
          else if (t === 'heart_half') v = missing >= 1 ? 30 : 0;
          else if (t === 'heart_tin') v = p.canCollect('heart_tin') ? 55 : 0;
          else if (t === 'key') v = p.keys < 1 ? 15 : 2;
          else if (t === 'dynamite') v = 3;
          if (v > 0 && p.canCollect(t) || (v > 0 && (t === 'key' || t === 'dynamite'))) opts.push({ x: pk.x, y: pk.y, price: pk.price, v, obj: pk });
        }
        opts.sort((a, b) => b.v - a.v);
        for (const o of opts) if (o.price <= coins) { goals.push({ x: o.x, y: o.y, kind: 'buy', v: o.v + 1000, obj: o.obj }); break; }
        rm._shopOpts = opts;
      }
      return goals;
    }

    function blockedTilesForPriced() {
      const rm = room();
      const s = new Set();
      for (const pk of rm.pickups) if (pk.alive && pk.basePrice != null) { const [c, r] = tileOf(pk.x, pk.y); s.add(c + ',' + r); }
      for (const pd of rm.pedestals) if (!pd.rec.taken && pd.rec.price != null) { const [c, r] = tileOf(pd.x, pd.y); s.add(c + ',' + r); }
      return s;
    }

    // BFS over the floor graph -> first door dir toward the target room; policy picks the target.
    function planRoute() {
      const mgr = sc.roomMgr;
      const floor = mgr.floor;
      const cur = mgr.currentId;
      const states = mgr.states;
      const byId = floor.byId;
      const canPass = (d) => !(d.kind === 'secret' && !d.revealed) && (!d.locked || p.keys > 0);
      // distances
      const dist = { [cur]: 0 }, prev = {}, q = [cur];
      while (q.length) {
        const id = q.shift();
        for (const [dir, d] of Object.entries(byId[id].doors)) {
          if (!canPass(d) || dist[d.to] != null) continue;
          dist[d.to] = dist[id] + 1; prev[d.to] = [id, dir]; q.push(d.to);
        }
      }
      const visited = (id) => !!(states[id] && states[id].visited);
      const cleared = (id) => !!(states[id] && states[id].cleared);
      const rooms = floor.rooms.filter((r) => r.type !== 'secret');
      const wanted = [];
      // heart / tin rooms when hurt
      for (const r of rooms) {
        if (r.id === cur || !visited(r.id) || dist[r.id] == null) continue;
        const st = states[r.id];
        const hearts = (st.pickups || []).filter((k) => k.price == null && p.canCollect(k.type) && (k.type.startsWith('heart') || (k.type === 'key' && p.keys === 0)));
        if (hearts.length && p.hp <= p.maxHp - 2) wanted.push({ id: r.id, pr: 0 });
      }
      for (const r of rooms) {
        if (r.id === cur || dist[r.id] == null) continue;
        if (r.type === 'normal' || r.type === 'start') { if (!visited(r.id) || !cleared(r.id)) wanted.push({ id: r.id, pr: 1 }); }
      }
      const normalsLeft = wanted.some((w) => w.pr === 1);
      for (const r of rooms) {
        if (r.id === cur || dist[r.id] == null) continue;
        if (r.type === 'treasure' && !visited(r.id)) wanted.push({ id: r.id, pr: 2 }); // reachable only when unlocked or we hold a key (dist)
        if (r.type === 'shop' && !normalsLeft && (!visited(r.id) || false) && p.coins >= 3) wanted.push({ id: r.id, pr: 3 });
      }
      const boss = byId[floor.bossId];
      const bossDone = cleared(floor.bossId);
      if (!bossDone && dist[floor.bossId] != null && cur !== floor.bossId) wanted.push({ id: floor.bossId, pr: normalsLeft ? 9 : 4 });
      if (!wanted.length) return null;
      wanted.sort((a, b) => (a.pr - b.pr) || (dist[a.id] - dist[b.id]));
      let target = wanted[0].id;
      // treasure/shop that are nearer than remaining normals are still handled by priority; walk the route
      let id = target;
      let first = null;
      while (prev[id]) { first = prev[id]; id = prev[id][0]; if (id === cur) break; }
      // re-walk to find the first step from cur
      let step = null, t = target;
      while (prev[t]) { step = prev[t]; if (step[0] === cur) break; t = step[0]; }
      return { target, dir: step ? step[1] : null, dist: dist[target], pr: wanted[0].pr };
    }

    function explore() {
      const rm = room();
      B.goalDesc = 'explore';
      const blocked = blockedTilesForPriced();
      // 1) local goals
      const goals = collectibleGoals();
      let goal = { x: 0, y: 0 }, target = null;
      const gk = (g) => g.kind + ':' + Math.round(g.x / 20) + ',' + Math.round(g.y / 20);
      for (let i = goals.length - 1; i >= 0; i--) if (B.ignore.has(gk(goals[i]))) goals.splice(i, 1);
      if (goals.length) {
        goals.sort((a, b) => (b.v - a.v) * 0.5 - (Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y)) * 0.01 + 0);
        // pick highest value/nearest mix
        let bg = null, bsc = -1e9;
        for (const g of goals) { const d = Math.hypot(g.x - p.x, g.y - p.y); const s = g.v - d * 0.08; if (s > bsc) { bsc = s; bg = g; } }
        target = bg;
        // give up on goals that cannot be reached (held > 25 s)
        const key = gk(bg);
        if (B.goalKey !== key) { B.goalKey = key; B.goalSince = B.simT; } else if (B.simT - B.goalSince > 25) { B.ignore.add(key); B.ev.push({ t: +B.simT.toFixed(1), e: 'ignore-goal', key, room: rm.def.template }); }
        blocked.delete(tileOf(bg.x, bg.y).join(','));
        B.goalDesc = 'go ' + bg.kind;
        const pt = pathTo(bg.x, bg.y, blocked);
        goal = pt;
        goal.tx = bg.x; goal.ty = bg.y;
        return { goal, target, gw: 90 };
      }
      // trapdoor?
      if (rm.trapdoor && rm.state.cleared) {
        B.goalDesc = 'trapdoor';
        const tdr = rm.trapdoor;
        if (!tdr.armed && Math.hypot(p.x - tdr.x, p.y - tdr.y) < 130) { // trapdoor arms only after you step clear of it
          const pt0 = pathTo(tdr.x - 170, tdr.y - 90, blocked);
          return { goal: pt0, target: null, gw: 90 };
        }
        const pt = pathTo(rm.trapdoor.x, rm.trapdoor.y, blocked);
        return { goal: pt, target: { kind: 'trapdoor', x: rm.trapdoor.x, y: rm.trapdoor.y }, gw: 90 };
      }
      // 2) route to next room
      const route = planRoute();
      B.route = route;
      if (!route || !route.dir) {
        // nothing to do: (final room / waiting). idle.
        B.goalDesc = 'idle:' + (route ? 'nodir' : 'noroute');
        return { goal: { x: 0, y: 0 }, target: null, gw: 0, idle: true };
      }
      const D = DOORS[route.dir];
      const door = rm.doors[route.dir];
      B.goalDesc = 'door ' + route.dir + '->' + route.target;
      const [tx, ty] = tileC(D.tile[0], D.tile[1]);
      // when at the door tile, push outward
      const beyond = route.dir === 'up' ? RY - p.y : route.dir === 'down' ? p.y - RB : route.dir === 'left' ? RX - p.x : p.x - RR;
      const lateral = route.dir === 'up' || route.dir === 'down' ? p.x - CX : p.y - CY;
      const [fx_, fy_] = tileC(D.front[0], D.front[1]);
      const vert = route.dir === 'up' || route.dir === 'down';
      const align = { x: vert ? -Math.sign(lateral) : 0, y: vert ? 0 : -Math.sign(lateral), d: 1 };
      if ((Math.abs(lateral) < 14 && (Math.hypot(p.x - tx, p.y - ty) < 130 || beyond > -60)) || (beyond >= 0 && Math.abs(lateral) < 50)) {
        return { goal: { x: D.dx, y: D.dy, d: 99 }, target: { kind: 'door', x: tx, y: ty }, gw: 90, pushDoor: true };
      }
      if (beyond < 0 && Math.abs(lateral) >= 14 && Math.hypot(p.x - fx_, p.y - fy_) < 60) return { goal: align, target: { kind: 'door', x: tx, y: ty }, gw: 90, pushDoor: true }; // line up with the doorway first (its gap is only 96 px wide)
      const pt = pathTo(fx_, fy_, blocked);
      return { goal: pt, target: { kind: 'door', x: tx, y: ty }, gw: 90 };
    }

    // ------------------------------------------------------------------------------------------------ active item usage
    function maybeActive(T, c) {
      const a = p.active;
      if (!a || a.charge < a.max || !B.cfg.useActive) return;
      const id = a.id;
      const enemies = c ? c.enemies : [];
      let use = false;
      if (id === 'whiskey_bottle') use = p.maxHp - p.hp >= 2 && (p.hp <= p.maxHp - 2);
      else if (id === 'pocket_watch') use = !!c && (enemies.length >= 3 || (c.boss && c.hitT < 0.6)) && !sc._bulletTime;
      else if (id === 'powder_keg') use = !!c && enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 260).length >= 2 && p.hp + p.tin >= 3;
      else if (id === 'lucky_deck') use = true;
      else use = !!c && enemies.length > 0;
      if (use) { sc.gameInput.press('active'); B.ev.push({ t: +B.simT.toFixed(1), e: 'active', id }); }
    }

    // ------------------------------------------------------------------------------------------------ per-step
    function trackRoom() {
      const rm = room();
      if (!rm) return;
      const id = rm.def.id + ':' + sc.floorNum;
      if (!B.cur || B.cur.key !== id || B.cur.rm !== rm) {
        B.cur = { key: id, rm, floor: sc.floorNum, id: rm.def.id, type: rm.type, tpl: rm.def.template, tier: rm.tpl ? rm.tpl.tier || 0 : 0, enter: B.simT, start: null, clear: null, dmg: 0, hpIn: p.hp + p.tin, revisit: false };
        B.cur.nWaveEnemies = 0; B.ignore.clear(); B.goalKey = '';
        B.rooms.push(B.cur);
      }
      const c = B.cur;
      if (c.start == null && rm.mode === 'combat') c.start = B.simT;
      if (c.clear == null && c.start != null && rm.state.cleared) c.clear = B.simT;
      if (rm.boss && rm.boss.alive && c.bossSeen == null) c.bossSeen = B.simT;
    }

    function progressSig() {
      let hp = 0;
      for (const e of sc.enemies) hp += Math.ceil(e.hp / 3);
      const st = sc.roomMgr.states;
      const vis = Object.values(st).filter((s) => s.visited).length;
      const clr = Object.values(st).filter((s) => s.cleared).length;
      return [sc.floorNum, vis, clr, hp, sc.run.kills, p.items.length, p.coins, p.keys, p.dynamite, Math.round(p.hp + p.tin)].join('|');
    }

    B.step = () => {
      const g = sc.gameInput;
      if (!sc.player || sc.ended) { if (!B.result) finish(sc.run && sc.run.won ? 'complete' : 'death'); return; }
      fx.hitStopUntil = 0;
      B.steps++;
      if (!sc.transitioning) B.simT += 1 / 60;
      if (sc.paused) { try { sc.scene.stop('Pause'); sc.resumeGame(); } catch (e) { /* */ } return; }
      if (p.dead) { g.override = { move: { x: 0, y: 0 }, aim: null }; if (!B.deadAt) { B.deadAt = B.simT; const r = room(); B.death = { floor: sc.floorNum, room: r ? r.type : '?', rid: r ? r.def.id : '?', by: sc.run.killedBy, boss: r && r.boss && r.boss.alive ? r.boss.id : null, bossHp: r && r.boss ? Math.round(r.boss.hp) : null, t: +B.simT.toFixed(1) }; } return; }
      if (sc.transitioning || sc.cutscene || !room()) { g.override = { move: { x: 0, y: 0 }, aim: null }; return; }
      const rm = room();
      trackRoom();
      if (!B.floorT[sc.floorNum]) { B.floorT[sc.floorNum] = B.simT; (B.floorIn = B.floorIn || {})[sc.floorNum] = { hp: p.hp, maxHp: p.maxHp, tin: p.tin, coins: p.coins, keys: p.keys, items: p.items.length }; }
      // soft-lock watchdog
      const sig = progressSig();
      if (sig !== B.progSig) { B.progSig = sig; B.lastProgT = B.simT; }
      (B.trace = B.trace || []); if (Math.floor(B.simT) % 5 === 0 && (!B.trace.length || B.trace[B.trace.length - 1][0] !== Math.floor(B.simT))) { B.trace.push([Math.floor(B.simT), Math.round(p.x), Math.round(p.y), B.goalDesc]); if (B.trace.length > 24) B.trace.shift(); }
      if (B.simT - B.lastProgT > B.cfg.stall) {
        B.softlock = { trace: B.trace, aimWhy: B.aimWhy, steer: B.dbgSteer && B.dbgSteer.cands, t: +B.simT.toFixed(1), floor: sc.floorNum, room: rm.type, rid: rm.def.id, tpl: rm.def.template, mode: rm.mode, locked: rm.locked, goal: B.goalDesc, pos: [Math.round(p.x), Math.round(p.y)], enemies: sc.enemies.map((e) => `${e.id}@${Math.round(e.x)},${Math.round(e.y)}:${Math.round(e.hp)}${e.targetable === false ? 'T' : ''}${e.invulnerable ? 'I' : ''}${e.noClear ? 'N' : ''}`), doors: Object.fromEntries(Object.entries(rm.doors).map(([k, d]) => [k, d.state])), pending: rm.pending, wave: rm.waveIdx, route: B.route, keys: p.keys, coins: p.coins, trans: sc.transitioning, tr: rm.trapdoor ? { used: rm.trapdoor.used, age: +rm.trapdoor.age.toFixed(1), x: rm.trapdoor.x, y: rm.trapdoor.y } : null, pk: rm.pickups.map((k) => `${k.type}@${Math.round(k.x)},${Math.round(k.y)}${k.settled ? '' : 'U'}${k.basePrice != null ? '$' : ''}${p.canCollect(k.type) ? '' : '!'}`), ped: rm.pedestals.map((d) => `${d.rec.itemId}@${Math.round(d.x)},${Math.round(d.y)}${d.rec.taken ? 'T' : ''}${d.needsLeave ? 'L' : ''}`), ch: rm.chests.map((c) => `${c.rec.type}${c.rec.opened ? 'O' : ''}`), cam: sc.cameras.main.fadeEffect && sc.cameras.main.fadeEffect.isRunning };
        finish('softlock');
        return;
      }
      if (B.simT > B.cfg.maxSim) { finish('timeout'); return; }
      if (B.cfg.lapseRate > 0 && B.simT >= B.lapseUntil && Math.random() < B.cfg.lapseRate / 60) B.lapseUntil = B.simT + B.cfg.lapseLen * (0.6 + Math.random() * 0.8);
      const T = gatherThreats();
      const inCombat = rm.mode === 'combat' || sc.enemies.some((e) => e.alive && !e.noClear && e.spawnT <= 0) || (rm.boss && rm.boss.alive);
      let out = { move: { x: 0, y: 0 }, aim: null };
      let doRoll = null;
      if (inCombat) {
        const c = combat(T);
        out = { move: c.move, aim: c.aim };
        doRoll = c.roll;
        maybeActive(T, c);
        // stuck watchdog in combat: pinned in a corner
      } else {
        maybeActive(T, null);
        const ex = explore();
        // fight nothing; steer to goal avoiding hazards
        const st = steer(ex.goal, ex.gw + 1, B.simT < B.lapseUntil ? { bullets: [], bodies: [], zones: [] } : T, { combat: false, allowSpikes: false });
        out = { move: st.move, aim: null };
        doRoll = st.roll;
        if (ex.pushDoor) { out.move = { x: ex.goal.x, y: ex.goal.y }; }
        else if (ex.idle) out.move = { x: 0, y: 0 };
        // stuck detection (only while trying to move)
        const want = Math.hypot(ex.goal.x, ex.goal.y) > 0.1 && !ex.idle;
        const s = B.stuck;
        if (want) {
          if (Math.hypot(p.x - s.x, p.y - s.y) > 12) { s.x = p.x; s.y = p.y; s.t = B.simT; }
          else if (B.simT - s.t > 1.2) { B.unstickUntil = B.simT + 0.6; const a = Math.random() * 6.28; B.unstickDir = [Math.cos(a), Math.sin(a)]; s.t = B.simT; B.ev.push({ t: +B.simT.toFixed(1), e: 'unstick', room: rm.type, goal: B.goalDesc, pos: [Math.round(p.x), Math.round(p.y)] }); }
        } else { s.x = p.x; s.y = p.y; s.t = B.simT; }
        if (B.simT < B.unstickUntil) out.move = { x: B.unstickDir[0], y: B.unstickDir[1] };
      }
      B.lastDir = [out.move.x, out.move.y];
      if (inCombat) { // combat stuck (pinned)
        const s = B.stuck;
        if (Math.hypot(p.x - s.x, p.y - s.y) > 12) { s.x = p.x; s.y = p.y; s.t = B.simT; }
      }
      g.override = { move: { x: out.move.x, y: out.move.y }, aim: out.aim };
      if (doRoll) { g.override.move = { x: doRoll[0], y: doRoll[1] }; g.press('roll'); B.rollsUsed++; }
    };

    function finish(why) {
      B.result = why;
      B.endT = B.simT;
    }
    B.summary = () => ({
      result: B.result, simT: +B.simT.toFixed(1), floor: sc.floorNum, seed: sc.seed, hp: p.hp, maxHp: p.maxHp, tin: p.tin, items: [...p.items], active: p.active && p.active.id,
      coins: p.coins, keys: p.keys, dyn: p.dynamite, death: B.death || null, softlock: B.softlock || null, kills: sc.run.kills, dmgTaken: sc.run.damageTaken, roomsCleared: sc.run.roomsCleared,
      floorT: B.floorT, floorIn: B.floorIn, rolls: B.rollsUsed, pk: B.pk, shots: sc.run.shots,
    });
    // fast-forward driver
    window.__botRun = (n) => {
      const game = window.__game;
      const scs = game.scene.getScenes(false);
      game.loop.sleep();
      const vis = scs.map((s) => s.sys.settings.visible);
      scs.forEach((s) => (s.sys.settings.visible = false));
      let i = 0;
      for (; i < n; i++) {
        if (window.__dw && window.__dw.scene && window.__dw.scene.fx) window.__dw.scene.fx.hitStopUntil = 0;
        if (B.result) break;
        try { B.step(); } catch (e) { B.err = (B.err || 0) + 1; if (B.err < 5) console.error('[bot]', e && e.stack || e); if (B.err > 200) { finish('botcrash'); break; } }
        window.__t += 16.667; fakeNow += 16.667; game.step(window.__t, 16.667);
        if (sc.ended && !B.result) finish(sc.run.won ? 'complete' : 'death');
        if (B.deadAt && B.simT - B.deadAt > 4 && !B.result) finish('death');
      }
      scs.forEach((s, k) => (s.sys.settings.visible = vis[k]));
      return i;
    };
    return B;
  };
})();
