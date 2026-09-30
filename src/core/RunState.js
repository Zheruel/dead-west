// Per-run bookkeeping (shown on the end screen, fed to Meta, saved in checkpoints). Pure JS: usable from node tests.
// v1 fields are kept; v2 adds the rider/mode, hit tracking, deals/curses (EVENTS 0), chapter flags and per-floor times (CHARACTERS_META F).
// deep copy of plain data (toJSON / fromJSON)
const clone = (v) => (Array.isArray(v) ? v.map(clone) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);

export default class RunState {
  constructor(seed) {
    this.seed = seed;
    this.time = 0; // seconds of unpaused play
    this.kills = 0;
    this.floor = 1;
    this.items = []; // item ids picked up in order
    this.roomsCleared = 0;
    this.damageTaken = 0; // units (1 = half heart)
    this.shots = 0;
    this.won = false;
    this.bossesKilled = 0;
    this.killedBy = null;
    // ---- v2 identity
    this.char = 'gunslinger';
    this.mode = 'normal'; // normal | hell | daily | contract
    this.contractId = null;
    this.mutators = [];
    this.daily = null; // dailyFor() result for daily runs
    this.maxFloor = 0; // contracts: clear boss of this floor (0 = the real final floor)
    this.chapter = 1;
    this.completedChapter2 = false;
    this.ending = null; // 'a' | 'true' | null
    // ---- v2 tracking (Meta writes these)
    this.hits = 0; // player:hurt count
    this.bossHits = 0; // hits taken while a boss is alive
    this.hurtInRoom = false;
    this.hitlessStreak = 0; // consecutive cleared rooms with no hit
    this.bestStreak = 0;
    this.purchases = 0;
    this.dealsMade = 0; // deal:signed count (deals[] is filled by the Crossroads controller)
    this.minibosses = 0;
    this.elites = 0;
    this.coins = 0; // most coins held at once
    this.coinsSpent = 0;
    this.coinsCollected = 0;
    this.familiars = 0; // most familiars owned at once
    this.floorTimes = []; // seconds spent on each floor
    this.floorT0 = 0;
    this.damageBySource = {};
    this.bossT0 = -1; // run.time when the current boss fight started
    this.goalReached = false; // contract: goal floor boss defeated
    // ---- EVENTS s0 additions
    this.deals = [];
    this.curses = [];
    this.blessings = [];
    this.gateMisses = 0;
    this.gateOpened = [];
    this.potionKnown = {};
    this.eventsSeen = [];
    this.elitesKilled = 0;
    this.minisKilled = [];
    this.bossHitsTaken = 0; // per boss room (reset on boss room entry)
    this.flawlessDuel = false;
  }

  /** True-ending gate (STORY 3): Hell on Earth and not a single deal signed. */
  get trueEligible() { return this.mode === 'hell' && this.deals.length === 0 && this.dealsMade === 0; }
  /** Deals signed this run (max of the controller's list and Meta's counter). */
  get dealCount() { return Math.max(this.deals.length, this.dealsMade); }
  /** Highest floor a run of this kind can reach before it ends (contracts stop at their goal). */
  goalFloor(maxFloor) { return this.maxFloor > 0 ? Math.min(this.maxFloor, maxFloor) : maxFloor; }

  toJSON() { return clone({ ...this }); }
  static fromJSON(o) {
    const r = new RunState(o && o.seed);
    if (o && typeof o === 'object') for (const k of Object.keys(o)) if (k in r) r[k] = clone(o[k]);
    return r;
  }
}
