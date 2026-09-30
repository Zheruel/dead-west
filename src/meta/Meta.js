// Meta-progression engine (CHARACTERS_META B, ARCH_V2 s4). A singleton that turns bus events into lifetime stats, achievements, unlocks,
// contracts, Daily records, Codex discoveries and Notoriety. Pure JS (node-safe): no Phaser import. The bus is passed to Meta.attach(bus);
// tests drive Meta.handle(name, payload) directly and read Meta.outputs.
//
// Rules: never throws into a gameplay frame (handlers are wrapped, one console warning), never touches rng.game / floorRng, costs
// O(rules-for-this-event) per event (byEvent / byStat indexes). Debug / god / ?unlockall runs set Meta.enabled = false: nothing is recorded.
//
// Run life cycle (meta/runSetup.js calls these): beginRun(info) -> events -> endRun(payload) (bus 'run:ended') | abandonRun(run).
// Output events (emitted through the bus): meta:unlocked, meta:achievement, meta:rank, codex:discovered, bounty:completed, daily:finished.
import { Save } from '../core/Save.js';
import RunState from '../core/RunState.js';
import { allItems } from '../items/registry.js';
import { compileCond, canonEvent, progressOf } from './cond.js';
import { ACHIEVEMENTS, ACH_BY_ID } from './achievements.js';
import { BOUNTIES, BOUNTY_BY_ID, TIERS, TIER_NP, TIER_UNLOCK_AFTER, parseGoal } from './bounties.js';
import { UNLOCKS, UNLOCK_BY_ID } from './unlocks.js';
import { LORE } from './lore.js';
import { rankFor } from './ranks.js';
import { computeReward, runNp } from './score.js';
import { CHAR_ORDER, isChar } from '../data/characters.js';
import { addDays } from '../data/difficulty.js';

const now = () => Date.now();
const enemyIdOf = (p) => p.id || (p.enemy && p.enemy.id) || null;
const bossIdOf = (p) => p.id || (p.boss && (typeof p.boss === 'string' ? p.boss : p.boss.id)) || null;
const kindOfId = (id) => id.slice(0, id.indexOf(':'));

// ---------------------------------------------------------------------------------------------- rule tables (compiled once)
const RULES = []; // {kind:'ach'|'lore'|'unlock', id, cond, ref}
const byEvent = new Map();
const byStat = new Map();
const push = (m, k, r) => { const l = m.get(k); if (l) l.push(r); else m.set(k, [r]); };
function addRule(kind, id, src, ref) {
  let cond;
  try { cond = compileCond(src); } catch (e) { console.warn('[Meta] bad condition', id, e.message); return; }
  const r = { kind, id, cond, ref };
  RULES.push(r);
  for (const e of cond.events) push(byEvent, e, r);
  for (const s of cond.stats) push(byStat, s, r);
}
for (const a of ACHIEVEMENTS) addRule('ach', a.id, a.cond, a);
for (const l of LORE) addRule('lore', l.id, l.unlock, l);
for (const u of UNLOCKS) if (u.cond) addRule('unlock', u.id, u.cond, u);

// ---------------------------------------------------------------------------------------------- helpers
function newSummary(oldNp = 0, rank = 1) {
  return {
    oldNp, newNp: oldNp, np: { run: 0, ach: 0, contract: 0 }, rankBefore: rank, rankAfter: rank, rankUp: false,
    unlocked: [], achievements: [], codexNew: [], contract: null, daily: null, reward: 0, won: false, newBest: { time: false, floor: false }, recap: null,
  };
}
function sourceName(s) {
  if (!s) return 'unknown';
  if (typeof s === 'string') return s;
  return s.enemyName || s.kind || s.id || (s.explosion ? 'explosion' : 'unknown');
}

export const Meta = {
  enabled: true,
  unlockAll: false,
  /** Item gates all open (Daily, contracts, ?unlockall): seed-mates get identical pools (ARCH D5/D15). */
  get itemsOpen() { return Save.itemsOpen; },
  set itemsOpen(v) { Save.itemsOpen = !!v; },
  run: null,
  player: null,
  summary: newSummary(),
  lastSummary: null,
  outputs: [], // test aid: every output event (only recorded when record = true)
  record: false,
  emitter: null, // (name, payload) => void; the bus emit in the browser
  _begun: null,
  _startEmitted: false,
  _floor: 0,
  _warned: false,
  _lastEnd: null,

  // ------------------------------------------------------------------------------------------ wiring
  /** Subscribe once to `bus` (never scene-scoped). Idempotent. */
  attach(bus) {
    if (this._bus === bus) return;
    this._bus = bus;
    this.emitter = (n, p) => bus.emit(n, p);
    const names = ['run:started', 'run:ended', 'floor:changed', 'room:entered', 'room:cleared', 'enemy:spawned', 'enemy:died', 'boss:intro', 'boss:spawned', 'boss:defeated',
      'deal:signed', 'event:done', 'mini:defeated', 'player:fired', 'player:hurt', 'player:rolled', 'player:died', 'synergy:activated', 'coins:changed', 'item:picked',
      'item:seen', 'pickup:collected', 'shop:bought', 'chest:opened', 'key:used', 'secret:revealed', 'dynamite:placed', 'mark:collected', 'story:cutscene',
      'meta:unlocked', 'bounty:completed', 'daily:finished', 'meta:achievement', 'codex:discovered', 'meta:rank'];
    for (const n of names) bus.on(n, (p) => this.handle(n, p));
    try {
      if (typeof location !== 'undefined') { const q = new URLSearchParams(location.search); this.unlockAll = q.get('unlockall') != null && q.get('unlockall') !== '0'; }
    } catch (e) { /* not a browser */ }
    if (this.unlockAll) this.itemsOpen = true;
    this.reconcile();
  },
  attachPlayer(player) { this.player = player || null; },
  totals() { return { items: allItems().filter((d) => !d.charOnly).length }; },

  out(name, payload) {
    if (this.record) this.outputs.push({ name, payload });
    if (this.emitter) this.emitter(name, payload);
    else this.handle(name, payload);
  },

  // ------------------------------------------------------------------------------------------ run life cycle
  /**
   * info: {run: RunState, char, mode, seed, contract?: id, mutators?, daily?, player?, enabled?}. Called by runSetup.applyRunSetup.
   * Counts the run (runs++, rider runs, contract tries), opens item gates for Daily/contract runs, then fires `run:started` once.
   */
  beginRun(info = {}) {
    const run = info.run || new RunState(info.seed);
    run.char = isChar(info.char) ? info.char : 'gunslinger';
    run.mode = info.mode || 'normal';
    if (info.contract) run.contractId = info.contract;
    if (info.mutators) run.mutators = [...info.mutators];
    if (info.daily) run.daily = info.daily;
    this.run = run;
    this._begun = run;
    this._startEmitted = false;
    this._floor = 0;
    this._lastEnd = null;
    this.player = info.player || this.player || null;
    this.enabled = info.enabled !== false && !this.unlockAll;
    Save.setProgressLocked(!this.enabled);
    this.itemsOpen = this.unlockAll || run.mode === 'daily' || run.mode === 'contract';
    const save = Save.get();
    this.summary = newSummary(save.notoriety.np, save.notoriety.rank);
    if (!this.enabled) return run;
    if (info.resume) { this.out('run:started', { char: run.char, mode: run.mode, seed: run.seed, mutators: [...run.mutators], resume: true }); return run; } // CONTINUE: not a new run
    Save.stat('runs');
    const c = save.chars[run.char];
    if (c) c.runs++;
    if (run.mode === 'contract' && run.contractId) {
      const b = save.bounty[run.contractId] || (save.bounty[run.contractId] = { done: 0, tries: 0, best: { time: 0, reward: 0 } });
      b.tries++;
    }
    Save.persistSoon();
    this.out('run:started', { char: run.char, mode: run.mode, seed: run.seed, contract: run.contractId || undefined, mutators: [...run.mutators], daily: run.daily ? run.daily.date : undefined });
    this.checkStats(['L.runs']);
    return run;
  },

  /** Quit from Pause: counts as an abandon (not a death); Daily/contract attempts record nothing. */
  abandonRun(run = this.run) {
    if (!this._begun || !run) return;
    this._begun = null; this._startEmitted = false;
    if (this.enabled) {
      const save = Save.get();
      Save.stat('abandons');
      Save.stat('playTime', run.time || 0);
      this.finalizeFloorTime(run);
      save.best.floor = Math.max(save.best.floor, run.floor || 0);
      save.best.killsInRun = Math.max(save.best.killsInRun, run.kills || 0);
      this.pushHistory(run, { won: false, abandoned: true, reward: computeReward(run, { won: false, mode: run.mode, hell: !!(run.daily && run.daily.hell) }) });
      Save.clearCheckpoint();
      Save.persist();
    }
    this.itemsOpen = this.unlockAll;
    Save.setProgressLocked(false);
  },

  finalizeFloorTime(run) {
    if (this._floor > 0) run.floorTimes[this._floor - 1] = (run.floorTimes[this._floor - 1] || 0) + Math.max(0, (run.time || 0) - (run.floorT0 || 0));
    run.floorT0 = run.time || 0;
  },

  pushHistory(run, { won, abandoned = false, reward = 0 }) {
    const h = Save.get().history;
    h.push({ t: now(), char: run.char, mode: run.mode, floor: run.floor, won: !!won, time: Math.round(run.time || 0), kills: run.kills || 0, reward, killedBy: abandoned ? 'abandoned' : run.killedBy || null, seed: run.seed, ...(abandoned ? { abandoned: true } : {}) });
    while (h.length > 25) h.shift();
  },

  // ------------------------------------------------------------------------------------------ event entry point
  handle(name, p) {
    if (this.player && this.player.godMode && this.enabled && this._begun) { this.enabled = false; Save.setProgressLocked(true); } // god mode mid-run: stop recording
    if (!this.enabled && !(name === 'run:started' && !this._begun)) return;
    try { this._handle(name, p || {}); } catch (e) {
      if (!this._warned) { this._warned = true; console.warn('[Meta] handler failed', name, e); }
    }
  },

  _handle(name, p) {
    const save = Save.get();
    if (name === 'run:ended') { this.endRun(p); return; }
    if (name === 'run:started') {
      if (this._startEmitted) return; // beginRun already announced this run
      if (!this._begun) { this.beginRun({ char: p.char, mode: p.mode, seed: p.seed, contract: p.contract, mutators: p.mutators }); return; }
      this._startEmitted = true;
      this.dispatch(name, p, null);
      return;
    }
    const run = this.run || (this.run = new RunState(0));
    const touched = [];
    let evtP = p;
    const S = (path, n = 1) => { Save.stat(path, n); touched.push(`L.${path}`); };
    switch (name) {
      case 'enemy:spawned': {
        const id = enemyIdOf(p);
        if (id) this.discover('enemy', id, 1);
        break;
      }
      case 'enemy:died': {
        if (p.boss || (p.enemy && p.enemy.isBoss)) break; // bosses count through boss:defeated
        const id = enemyIdOf(p);
        S('kills'); // RunState.kills is owned by Enemy.die; Meta only reads it
        if (id) { S(`k.${id}`); const e = this.discover('enemy', id, 1); if (e) e.kills = (e.kills || 0) + 1; }
        const by = p.by;
        if (by === 'sixth') S('sixthKills'); else if (by === 'deadeye') S('deadEyeKills'); else if (by === 'explosion') S('dynamiteKills');
        const elite = p.elite !== undefined ? p.elite : p.cursed;
        if (elite && elite !== 'champion') { S('elites'); run.elites++; touched.push('R.elites'); } else if (p.affixes && p.affixes.length) { S('elites'); run.elites++; }
        touched.push('R.kills');
        break;
      }
      case 'mini:defeated': {
        S('minibosses'); run.minibosses++; if (p.id) run.minisKilled.push(p.id);
        touched.push('R.minibosses');
        break;
      }
      case 'boss:intro': { const id = bossIdOf(p); if (id) this.discover('boss', id, 1); break; }
      case 'boss:spawned': { run.bossT0 = run.time || 0; run.bossHits = 0; this._bossAlive = true; break; }
      case 'boss:defeated': {
        if (p.mini || (p.boss && p.boss.isMini)) break;
        const id = bossIdOf(p);
        const floor = p.floor != null ? p.floor : run.floor;
        const fightTime = p.fightTime != null ? p.fightTime : run.bossT0 >= 0 ? Math.max(0, (run.time || 0) - run.bossT0) : 0;
        const noHit = p.noHit != null ? (p.noHit ? 1 : 0) : run.bossHits === 0 ? 1 : 0;
        evtP = { ...p, boss: id, id, floor, fightTime, noHit };
        this._bossAlive = false; run.bossT0 = -1;
        if (id) {
          S(`bk.${id}`);
          const b = this.discover('boss', id, 2);
          if (b) { b.killed = (b.killed || 0) + 1; b.bestFight = !b.bestFight || fightTime < b.bestFight ? Math.round(fightTime * 10) / 10 : b.bestFight; if (noHit) b.noHit = 1; }
        }
        const c = save.chars[run.char];
        if (id === 'undertaker' && c && (run.mode === 'normal' || run.mode === 'hell') && !c.marks.undertaker) { c.marks.undertaker = 1; touched.push('M'); }
        if (run.mode === 'contract' && run.contractId) { const g = parseGoal((BOUNTY_BY_ID[run.contractId] || {}).goal || 'clear:99'); if (floor >= g.floor) run.goalReached = true; }
        break;
      }
      case 'player:fired': S('shots'); if (p.sixth) S('sixthShots'); break;
      case 'player:rolled': S('rolls'); break;
      case 'dynamite:placed': S('dynamitePlaced'); break;
      case 'player:hurt': {
        const u = p.units || 1;
        S('hits'); S('damageTaken', u);
        run.hits++; run.hitlessStreak = 0; run.hurtInRoom = true;
        if (this._bossAlive) run.bossHits++;
        const k = sourceName(p.source);
        run.damageBySource[k] = (run.damageBySource[k] || 0) + u;
        touched.push('R.hitlessStreak');
        break;
      }
      case 'player:died': if (p.source && p.source.own && !p.source.kind) evtP = { ...p, source: { kind: 'own_dynamite' } }; break;
      case 'room:entered': { run.hurtInRoom = false; this.syncFamiliars(run, touched); break; }
      case 'room:cleared': {
        S('roomsCleared');
        const hitless = p.hitless != null ? !!p.hitless : !run.hurtInRoom;
        if (hitless) { run.hitlessStreak++; run.bestStreak = Math.max(run.bestStreak, run.hitlessStreak); S('hitlessRooms'); } else run.hitlessStreak = 0;
        touched.push('R.hitlessStreak');
        Save.persistSoon();
        break;
      }
      case 'floor:changed': {
        const f = p.floor || 1;
        if (this._floor > 0 && f > this._floor) S('floorsDescended');
        if (this._floor > 0 && f !== this._floor) this.finalizeFloorTime(run);
        this._floor = f;
        if (f > save.best.floor) { save.best.floor = f; touched.push('L.bestFloor'); }
        const c = save.chars[run.char];
        if (c && f > c.bestFloor) c.bestFloor = f;
        if (f > 3) save.chapterReached = 2;
        break;
      }
      case 'pickup:collected': {
        if (p.type === 'coin' || p.type === 'coin_nickel') {
          const mult = this.player && this.player.stats ? this.player.stats.coinMult || 1 : 1;
          const amt = p.amount != null ? p.amount : p.type === 'coin' ? mult : 5 * mult;
          S('coinsCollected', amt); run.coinsCollected += amt; touched.push('R.coinsCollected');
          this.noteCoins(run, this.player ? this.player.coins : 0, touched);
        }
        break;
      }
      case 'coins:changed': this.noteCoins(run, p.coins || 0, touched); break;
      case 'shop:bought': { const price = p.price || 0; S('shopBuys'); S('coinsSpent', price); run.purchases++; run.coinsSpent += price; touched.push('R.purchases', 'R.coinsSpent'); break; }
      case 'item:picked': {
        S('itemsPicked');
        if (p.id) this.discover('item', p.id, 2);
        touched.push('L.itemsFound');
        this.syncFamiliars(run, touched);
        break;
      }
      case 'item:seen': if (p.id) this.discover('item', p.id, 1); break;
      case 'synergy:activated': if (p.id) { if (Save.codexSeen('synergies', p.id)) touched.push('L.synergies'); } break;
      case 'secret:revealed': S('secrets'); break;
      case 'chest:opened': S('chests'); break;
      case 'key:used': S('keysUsed'); break;
      case 'deal:signed': S('deals'); run.dealsMade++; touched.push('R.deals'); break;
      case 'event:done': S('eventsDone'); break;
      case 'mark:collected': S('marksCollected'); break;
      case 'bounty:completed': touched.push('L.bountiesDone'); break;
      case 'daily:finished': touched.push('L.dailyRuns'); break;
      default: break;
    }
    this.dispatch(name, evtP, touched);
  },

  noteCoins(run, coins, touched) {
    if (coins > run.coins) { run.coins = coins; touched.push('R.coins'); }
  },
  syncFamiliars(run, touched) {
    const n = this.player && this.player.familiars ? this.player.familiars.length : 0;
    if (n > run.familiars) { run.familiars = n; touched.push('R.familiars'); }
  },

  // ------------------------------------------------------------------------------------------ rule evaluation
  /** Per-dispatch context (a new object: grants inside a check can re-enter dispatch through the bus). */
  ctx(evt) {
    return { save: Save.get(), run: this.run || {}, player: this.player, evt, prog: 0, derive: this.derive };
  },
  derive(kind, path) {
    const m = Meta;
    if (kind === 'L') {
      if (path === 'itemsFound') return m.foundCount();
      if (path === 'itemsTotal') return m.totals().items;
      if (path === 'bestFloor') return Save.get().best.floor;
      if (path === 'synergies') return Object.keys(Save.get().codex.synergies).length;
      return undefined;
    }
    const r = m.run || {};
    const pl = m.player;
    if (path === 'tin') return pl ? pl.tin : 0;
    if (path === 'maxHearts') return pl && pl.stats ? pl.stats.maxHearts : 0;
    if (path === 'deals') return r.dealCount != null ? r.dealCount : (r.deals || []).length;
    return undefined;
  },
  foundCount() {
    const c = Save.get().codex.items;
    let n = 0;
    for (const id in c) if (c[id] === 2) n++;
    return n;
  },

  /** Evaluate the rules indexed under this event and under every touched stat key. */
  dispatch(name, p, touched) {
    const evtRules = byEvent.get(name);
    const has = evtRules || (touched && touched.length);
    if (!has) return;
    const save = Save.get();
    const evt = { name, p };
    if (evtRules) {
      for (let i = 0; i < evtRules.length; i++) {
        const r = evtRules[i];
        if (this.done(r)) continue;
        const ctx = this.ctx(evt);
        if (r.cond.ec) {
          const ec = r.cond.ec;
          if (name !== ec.name || !this.matches(ec.filters, p)) continue;
          if (ec.name === 'synergy:activated') { if (p.id) Save.codexSeen('synergies', p.id); ctx.prog = Object.keys(save.codex.synergies).length; } else ctx.prog = save.achProg[r.id] = (save.achProg[r.id] || 0) + 1;
        }
        if (r.cond.test(ctx)) this.satisfy(r);
      }
    }
    if (touched) {
      for (let i = 0; i < touched.length; i++) {
        const list = byStat.get(touched[i]);
        if (!list) continue;
        for (let j = 0; j < list.length; j++) {
          const r = list[j];
          if (this.done(r) || r.cond.events.size) continue; // event rules are evaluated on their event only
          if (r.cond.test(this.ctx(evt))) this.satisfy(r);
        }
      }
    }
  },
  matches(filters, p) {
    for (const f of filters) {
      let v = p[f.k];
      if (v && typeof v === 'object') v = v.id != null ? v.id : v.kind;
      if (typeof v === 'boolean') v = v ? 1 : 0;
      if (v === undefined) return false;
      if (typeof f.v === 'number') { const ok = f.op === '>=' ? v >= f.v : f.op === '<=' ? v <= f.v : f.op === '>' ? v > f.v : f.op === '<' ? v < f.v : v === f.v; if (!ok) return false; } else if (String(v) !== String(f.v)) return false;
    }
    return true;
  },
  /** Re-check the rules of `keys` (stat keys such as 'L.runs') without an event. */
  checkStats(keys) { this.dispatch('', {}, keys); },
  done(r) {
    const save = Save.get();
    return r.kind === 'ach' ? !!save.ach[r.id] : r.kind === 'lore' ? !!save.codex.lore[r.id] : !!save.unlocks[r.id];
  },
  satisfy(r) {
    if (r.kind === 'ach') this.earn(r.ref);
    else if (r.kind === 'lore') this.discoverLore(r.id);
    else this.grant(r.id, 'rule');
  },

  // ------------------------------------------------------------------------------------------ grants
  earn(a) {
    const save = Save.get();
    if (save.ach[a.id]) return false;
    save.ach[a.id] = now();
    this.addNp(a.np, 'ach');
    for (const r of a.reward) this.grant(r, a.id);
    this.summary.achievements.push({ id: a.id, name: a.name, np: a.np });
    this.out('meta:achievement', { id: a.id, name: a.name, desc: a.desc, np: a.np, reward: a.reward });
    Save.persist();
    return true;
  },
  /** Grant an unlock id ('char:x', 'mode:x', 'gate:x', 'title:x'). Idempotent; returns true when new. */
  grant(id, source) {
    if (!Save.grant(id)) return false;
    const u = UNLOCK_BY_ID[id];
    const kind = kindOfId(id);
    if (kind === 'char') { const c = Save.get().chars[id.slice(5)]; if (c) c.unlocked = true; }
    const label = u ? u.label : id;
    this.summary.unlocked.push({ kind, id, label });
    this.out('meta:unlocked', { kind, id, label, source });
    return true;
  },
  /** Silent re-application of everything already earned (migration, new rules): no toasts, no outputs. */
  reconcile() {
    const save = Save.get();
    for (const id of Object.keys(save.ach)) {
      const a = ACH_BY_ID[id];
      if (a) for (const r of a.reward) if (!save.unlocks[r]) { Save.grant(r); if (r.startsWith('char:') && save.chars[r.slice(5)]) save.chars[r.slice(5)].unlocked = true; }
    }
    for (const id of Object.keys(save.bounty)) {
      const b = BOUNTY_BY_ID[id];
      if (b && save.bounty[id].done) for (const r of b.reward) if (!r.startsWith('lore:') && !save.unlocks[r]) Save.grant(r);
    }
    const ctx = { save, run: {}, player: null, evt: null, prog: 0, derive: this.derive };
    for (const r of RULES) if (r.kind === 'unlock' && !save.unlocks[r.id] && !r.cond.events.size && r.cond.test(ctx)) Save.grant(r.id);
    for (const id of CHAR_ORDER) if (save.chars[id] && Save.unlocked(`char:${id}`)) save.chars[id].unlocked = true;
    Save.persistSoon();
  },

  addNp(n, src) {
    if (!n) return;
    const s = Save.get().notoriety;
    s.np += n;
    this.summary.np[src] = (this.summary.np[src] || 0) + n;
    this.summary.newNp = s.np;
    const r = rankFor(s.np);
    if (r.rank > s.rank) {
      s.rank = r.rank;
      this.summary.rankUp = true;
      this.summary.rankAfter = r.rank;
      this.out('meta:rank', { rank: r.rank, title: r.title });
    }
  },

  // ------------------------------------------------------------------------------------------ codex
  /** kind: 'enemy' | 'item' | 'boss'. Raises the discovery stage; returns the entry object for enemy/boss. */
  discover(kind, id, stage = 1) {
    const c = Save.get().codex;
    let entry = null, isNew = false;
    if (kind === 'enemy') {
      entry = c.enemies[id] || (c.enemies[id] = { seen: 0, kills: 0 });
      if (!entry.seen) { entry.seen = 1; isNew = true; }
    } else if (kind === 'boss') {
      entry = c.bosses[id] || (c.bosses[id] = { seen: 0, killed: 0, bestFight: 0, noHit: 0 });
      if (!entry.seen) { entry.seen = 1; isNew = true; }
    } else if (kind === 'item') {
      const v = c.items[id] || 0;
      if (stage > v) { c.items[id] = stage; if (v === 0) isNew = true; }
    }
    if (isNew) { this.summary.codexNew.push({ kind, id }); this.out('codex:discovered', { kind, id }); Save.persistSoon(); }
    return entry;
  },
  discoverLore(id) {
    const c = Save.get().codex.lore;
    if (c[id]) return false;
    c[id] = now();
    this.summary.codexNew.push({ kind: 'lore', id });
    this.out('codex:discovered', { kind: 'lore', id });
    Save.persistSoon();
    return true;
  },
  enemyStage(id) {
    const e = Save.get().codex.enemies[id];
    if (!e || !e.seen) return 0;
    return e.kills >= 15 ? 3 : e.kills >= 3 ? 2 : 1;
  },
  itemStage(id) { return Save.get().codex.items[id] || 0; },
  bossStage(id) {
    const b = Save.get().codex.bosses[id];
    if (!b || !b.seen) return 0;
    return b.killed ? (b.noHit ? 3 : 2) : 1;
  },
  loreUnlocked(id) { return !!Save.get().codex.lore[id]; },

  // ------------------------------------------------------------------------------------------ unlock queries (scenes)
  isUnlocked(id) { return this.unlockAll || id === 'char:gunslinger' || Save.unlocked(id); },
  isCharUnlocked(id) { return id === 'gunslinger' || this.isUnlocked(`char:${id}`); },
  isModeUnlocked(mode) { return mode === 'normal' || this.isUnlocked(`mode:${mode}`); },
  earned(id) { return !!Save.get().ach[id]; },
  np() { return Save.get().notoriety.np; },
  rank() { return rankFor(this.np()); },
  /** Poster subtitle: the equipped title or the rank title. */
  titleLabel() {
    const t = Save.get().settings.title;
    if (t && t !== 'rank' && Save.unlocked(`title:${t}`)) { const u = UNLOCK_BY_ID[`title:${t}`]; if (u) return u.label; }
    return this.rank().title;
  },
  achProgress(a) {
    const save = Save.get();
    const cond = compileCond(a.cond);
    return progressOf(cond, { save, run: this.run || {}, prog: save.achProg[a.id] || (a.id === 'combo_rider' ? Object.keys(save.codex.synergies).length : 0), derive: this.derive });
  },

  // ------------------------------------------------------------------------------------------ contracts
  tierDone(tier) { const b = Save.get().bounty; return BOUNTIES.filter((x) => x.tier === tier && b[x.id] && b[x.id].done).length; },
  tierOpen(tier) {
    if (this.unlockAll) return true;
    const i = TIERS.indexOf(tier);
    return i <= 0 || this.tierDone(TIERS[i - 1]) >= TIER_UNLOCK_AFTER;
  },
  contractState(id) { const b = Save.get().bounty[id]; return { done: !!(b && b.done), tries: b ? b.tries : 0, best: b ? b.best : { time: 0, reward: 0 } }; },

  /** Evaluate the goal of the active contract at run end. Returns {id, completed, first, hitsOk}. */
  finishContract(run, won, reward) {
    const b = BOUNTY_BY_ID[run.contractId];
    if (!b) return null;
    const goal = parseGoal(b.goal);
    const reached = run.goalReached || won;
    const hitsOk = goal.hits == null || run.hits <= goal.hits;
    const result = { id: b.id, name: b.name, tier: b.tier, completed: false, first: false, hitsOk };
    if (!(reached && hitsOk && won)) return result;
    const save = Save.get();
    const st = save.bounty[b.id] || (save.bounty[b.id] = { done: 0, tries: 1, best: { time: 0, reward: 0 } });
    result.completed = true;
    result.first = !st.done;
    if (result.first) {
      st.done = now();
      Save.stat('bountiesDone');
      this.addNp(TIER_NP[b.tier], 'contract');
      for (const r of b.reward) { if (r.startsWith('lore:')) this.discoverLore(r.slice(5)); else this.grant(r, b.id); }
    }
    st.best.time = !st.best.time || run.time < st.best.time ? Math.round(run.time) : st.best.time;
    st.best.reward = Math.max(st.best.reward, reward);
    this.out('bounty:completed', { id: b.id, tier: b.tier });
    return result;
  },

  // ------------------------------------------------------------------------------------------ daily
  /** Local board rows for a scope: 'today' | 'week' | 'all' sorted by score (best first). */
  dailyBoard(scope, today) {
    const e = Save.get().daily.entries;
    let rows = e;
    if (scope === 'today') rows = e.filter((x) => x.date === today);
    else if (scope === 'week') { const from = addDays(today, -6); rows = e.filter((x) => x.date >= from && x.date <= today); }
    return [...rows].sort((a, b) => b.score - a.score || a.time - b.time);
  },
  recordDaily(run, won, reward) {
    const save = Save.get();
    const d = save.daily;
    const date = run.daily ? run.daily.date : null;
    if (!date) return null;
    if (d.lastDate !== date) {
      d.streak = d.lastDate && addDays(d.lastDate, 1) === date ? d.streak + 1 : 1;
      d.lastDate = date;
      d.bestStreak = Math.max(d.bestStreak, d.streak);
    }
    d.entries.push({ date, score: reward, char: run.char, floor: run.floor, won: !!won, time: Math.round(run.time), mutator: run.daily.mutator, hell: !!run.daily.hell });
    while (d.entries.length > 200) d.entries.shift();
    Save.stat('dailyRuns');
    const rank = 1 + d.entries.filter((x) => x.date === date && x.score > reward).length;
    return { date, score: reward, rank, streak: d.streak };
  },

  // ------------------------------------------------------------------------------------------ run end
  /** bus 'run:ended': payload is {variant, ending?, won?, stats?: RunState.toJSON()} or a flat RunState dump. */
  endRun(p) {
    if (p === this._lastEnd) return;
    this._lastEnd = p;
    const save = Save.get();
    let run = this.run;
    const raw = p.stats && typeof p.stats === 'object' ? p.stats : p;
    if (!this._begun) { // run:started was never announced (scene not wired to runSetup yet): count it now
      run = this.run = RunState.fromJSON(raw);
      Save.stat('runs');
      if (save.chars[run.char]) save.chars[run.char].runs++;
      this.summary = newSummary(save.notoriety.np, save.notoriety.rank);
    } else if (raw && raw !== run) {
      for (const k of ['time', 'kills', 'floor', 'roomsCleared', 'bossesKilled', 'damageTaken', 'killedBy', 'shots']) if (raw[k] != null && (typeof raw[k] !== 'number' || raw[k] >= (run[k] || 0))) run[k] = raw[k];
    }
    const variant = p.variant || (raw.won ? 'complete' : 'death');
    const won = variant === 'complete' || variant === 'contract' || !!p.won;
    const complete = variant === 'complete';
    const ending = p.ending || raw.ending || run.ending || null;
    run.won = won;
    if (ending) run.ending = ending;
    this._begun = null; this._startEmitted = false;
    this.finalizeFloorTime(run);
    const mode = run.mode;
    const hellRun = mode === 'hell' || !!(run.daily && run.daily.hell);
    const reward = computeReward(run, { won: complete || variant === 'contract', mode, hell: hellRun });
    const s = this.summary;
    s.reward = reward; s.won = won;

    // lifetime bookkeeping
    if (complete) Save.stat('wins'); else if (variant === 'death') Save.stat('deaths');
    Save.stat('playTime', run.time || 0);
    Save.stat('bountyEarned', reward);
    s.newBest.floor = (run.floor || 0) > save.best.floor;
    save.best.floor = Math.max(save.best.floor, run.floor || 0);
    save.best.reward = Math.max(save.best.reward, reward);
    save.best.killsInRun = Math.max(save.best.killsInRun, run.kills || 0);
    if (complete && (mode === 'normal' || mode === 'hell')) {
      const key = mode === 'hell' ? 'hell' : 'normal';
      const prev = save.best.time[key];
      if (!prev || run.time < prev) { save.best.time[key] = Math.round(run.time); s.newBest.time = true; }
    }
    const c = save.chars[run.char];
    let marksChanged = false;
    if (c) {
      c.bestFloor = Math.max(c.bestFloor, run.floor || 0);
      if (complete) {
        c.wins++;
        if (mode === 'normal' || mode === 'hell') {
          if (!c.marks.final) { c.marks.final = 1; marksChanged = true; }
          if (mode === 'hell' && !c.marks.hell) { c.marks.hell = 1; marksChanged = true; }
        }
      }
    }
    save.chapterReached = Math.max(save.chapterReached, (run.floor || 1) > 3 ? 2 : 1);

    // notoriety, contract, daily
    this.addNp(runNp(reward, mode, hellRun), 'run');
    if (mode === 'contract' && run.contractId) s.contract = this.finishContract(run, won, reward);
    if (mode === 'daily' && run.daily) {
      const d = this.recordDaily(run, complete, reward);
      s.daily = d;
      if (d) this.out('daily:finished', { date: d.date, score: d.score, rank: d.rank });
    }
    this.pushHistory(run, { won: complete, reward });
    Save.clearCheckpoint();

    // recap for the ledger page
    s.recap = { floorTimes: [...run.floorTimes], damageBySource: { ...run.damageBySource }, seed: run.seed, char: run.char, mode, ending, time: run.time, deals: run.dealCount };

    // rules: the run:ended event itself + stats/marks that changed
    const evt = {
      variant, ending, won, mode, char: run.char, hits: run.hits, time: run.time, deals: run.dealCount, floor: run.floor, kills: run.kills,
      contract: run.contractId || undefined,
    };
    const touched = ['L.runs', 'L.wins', 'L.deaths', 'L.playTime', 'L.bountyEarned', 'L.bestFloor', 'L.dailyRuns'];
    if (marksChanged) touched.push('M');
    this.dispatch('run:ended', evt, touched);
    Save.persist();
    this.lastSummary = s;
    this.itemsOpen = this.unlockAll;
    Save.setProgressLocked(false);
  },

  /** Test helper: forget the current run/summary (not the save). */
  _reset() {
    this.run = null; this.player = null; this._begun = null; this._startEmitted = false; this._floor = 0; this._lastEnd = null; this._bossAlive = false;
    this.enabled = true; this.unlockAll = false; this.outputs.length = 0; this.summary = newSummary(Save.get().notoriety.np, Save.get().notoriety.rank);
    Save.setProgressLocked(false);
    this.itemsOpen = false;
  },
};
export { RULES, byEvent, byStat, ACHIEVEMENTS };
export default Meta;
