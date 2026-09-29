// Per-run bookkeeping (stats shown on the end screen / saved).
export default class RunState {
  constructor(seed) {
    this.seed = seed;
    this.time = 0; // seconds of unpaused play
    this.kills = 0;
    this.floor = 1;
    this.items = []; // item ids picked up in order
    this.roomsCleared = 0;
    this.damageTaken = 0;
    this.shots = 0;
    this.won = false;
    this.bossesKilled = 0;
    this.killedBy = null;
  }
  toJSON() { return { ...this }; }
}
