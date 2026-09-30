// The cursed gunslinger (and the three other riders). Single source of truth for stats: player.stats (rebuilt by recomputeStats()).
//
// recomputeStats order (ARCH_V2 s10.2): base + rider -> item apply (per copy) -> applyLate -> rider flatDmgScale -> synergies ->
//   boons (curses / blessings) -> mutators -> buffs -> clamps.
// Run fields: char, skin, crng (seeded combat stream), cyl {pos} (+ `cylinder` {loaded,max} for the HUD), forceSixth, itemState, synergies (Set),
//   orbiters [], spiritT, curses[], blessings[], heartDebt (+ `penalty.containers` alias), extraHearts, env {speedMult,rollMult,push}.
// Save seams: snapshot() / restore(snap). Revive seam: tryRevive(source) (order black_cat_bone, ace_in_hole, lazarus_pact, then `deathSave` hooks).
import { PLAYER, PLAYER_BASE, DEPTH, ROOM } from '../config.js';
import Actor from './Actor.js';
import Dynamite from './Dynamite.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';
import { bus } from '../core/events.js';
import { subRng } from '../core/rng.js';
import { rad } from '../core/util.js';
import { getItem } from '../items/registry.js';
import { ITEM_BASE_V2, CHAR_KEYS_FALLBACK, applyCaps } from '../items/baseStats.js';
import { CHAR_BASE_V2 } from '../data/charBaseStats.js';
import { charDef, isChar } from '../data/characters.js';
import { applyMutators } from '../data/difficulty.js';
import { applyBoons, Boons } from '../systems/Boons.js';
import { CTX, runHooks, hasHook, rebuildHooks } from '../items/hooks.js';
import { evaluateSynergies, SYN_BY_ID } from '../items/synergies.js';
import { posseSync } from '../items/fx/synergyFx.js';
import { ownedIds } from '../items/tags.js';
import { itemFx } from '../items/fx/ItemFx.js';
import { nova } from '../items/fx/Nova.js';
import { explode } from '../systems/Explosions.js';

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const finite = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d); // checkpoint fields may come from a hand-edited / imported save (QA4-022)
const DIRS = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
const REVIVE_ORDER = ['black_cat_bone', 'ace_in_hole', 'lazarus_pact'];
const SHOT_SFX = { preacher: 'shoot_scatter', hunter: 'shoot_rifle', queen: 'shoot_twin' }; // gunslinger keeps plain `shoot`
const FORCE_SIXTH_LIFE = 10; // seconds a queued forced Sixth Bullet stays loaded
const baseCache = new Map(); // char id -> merged base stats (never mutated)

/** PLAYER_BASE + rider overrides, merged over the item / rider key fallbacks so no stat is ever undefined. */
function baseFor(char) {
  let b = baseCache.get(char);
  if (!b) {
    b = { ...ITEM_BASE_V2, ...CHAR_KEYS_FALLBACK, ...CHAR_BASE_V2, ...PLAYER_BASE, ...charDef(char).stats };
    baseCache.set(char, b);
  }
  return b;
}

export default class Player extends Actor {
  /** opts: {char} -> rider (stats, skin and start kit). Without it the Gunslinger is used and meta/runSetup.applyToPlayer sets the rider later. */
  constructor(scene, x, y, opts = {}) {
    super(scene, x, y, { radius: PLAYER.radius, footOffset: 14, shadowScale: 0.62 });
    this.hurtRadius = PLAYER.hurtRadius;
    this.char = 'gunslinger';
    this.skin = 'player';
    this.tint = 0xffffff;
    this.stats = {};
    this.items = []; // item ids, in pickup order (duplicates allowed)
    this.buffs = []; // temporary stat modifiers {id, apply(stats,player), t}
    this.familiars = []; // objects with update(dt, player), destroy(), optional blocksBullets/x/y/radius
    this.active = null; // {id, charge, max}
    this.itemState = {}; // per-run scratch of the owned items (def.state) and of active synergies ('syn:<id>')
    this.synergies = new Set();
    this.tagCounts = {};
    this.orbiters = []; // live orbiting bullets (carousel_slug), max 3, owned by Bullets
    this.curses = [];
    this.blessings = [];
    this.heartDebt = 0; // containers lost to deals (`penalty.containers` is an alias)
    this.extraHearts = 0; // heart_container pickups
    this.bulletTint = null; // number|null: FaithMeter (Sanctified) tints normal player slugs pale gold
    this.coins = PLAYER.startCoins;
    this.keys = PLAYER.startKeys;
    this.dynamite = PLAYER.startDynamite;
    this.hp = 6; // red HP units (2 per heart container)
    this.tin = 0; // tin (armour) units, 2 per tin heart
    this.dead = false;
    this.godMode = false;
    this.cyl = { pos: 0 };
    this.cylinder = { loaded: 6, max: 6 }; // HUD view of `cyl`
    this.forceSixth = 0; this.forceSixthT = 0;
    this.reviveCharges = 0; // ace_in_hole pact (grantRevive)
    this.spiritT = 0;
    this.haloLeft = 0; this._haloMax = 0;
    this.env = { speedMult: 1, rollMult: 1, push: { x: 0, y: 0 } };
    this.startGiven = null;
    this._api = { stats: this.stats, count: 1, scene, player: this };
    this._cnt = new Map();
    this._synNext = new Set();
    this._synCtx = { tags: this.tagCounts };
    this._synDirty = true;
    this._pen = null;
    this._mods = { split: 0, boomerang: false, orbit: 0, chain: false, explode: false, ghost: false, pull: false, chill: false };
    this._coinFrac = 0;
    this._coinsSeen = this.coins;
    this._dynT = 0;
    this._smiteAt = 0;
    this._gunSide = 1;
    this._boomN = 0;

    this._setCharBase(isChar(opts.char) ? opts.char : 'gunslinger');
    this._synDirty = true;
    this.recomputeStats(true);
    this.hp = this.maxHp;

    // state
    this.facing = 'down';
    this.fireCd = 0;
    this.shotCount = 0; // total shots this run
    this.lastShotAt = -99;
    this.time = 0;
    this.firePoseT = 0;
    this.hurtT = 0; // post-hit i-frames
    this.entryInv = 0; // room-entry invulnerability
    this.rolling = false;
    this.rollT = 0;
    this.rollCd = 0;
    this.rollDir = { x: 0, y: 1 };
    this.rollDustT = 0;
    this.knock = { x: 0, y: 0 };
    this.forced = null; // {x,y,t}: scripted walk (room entry)
    this.shieldLeft = 0; this.shieldRest = 0;
    this.deathT = 0;
    this.locked = false; // input locked (transitions, cutscenes)
    this._anim = '';

    this.sprite = Assets.makeSprite(scene, x, y, `${this.skinBase}_walk_down`, 0);
    if (this.tint !== 0xffffff && this.skinBase === 'player') this.sprite.setTint(this.tint);
    this.cdGfx = scene.add.graphics().setDepth(DEPTH.shadows + 3);
    this.cdGfx.__noSnap = true;
    this.sprite.__noSnap = true;
    this.shadow.__noSnap = true;
    this.syncVisual();
    this.offFloor = bus.scoped(scene, 'floor:changed', () => { this.haloLeft = this.stats.haloCharges || 0; });
    if (opts.char) this.applyStart();
  }

  get maxHp() { return this.stats.maxHearts * 2; }
  get totalHearts() { return this.stats.maxHearts + Math.ceil(this.tin / 2); }
  get invulnerable() { return this.hurtT > 0 || this.entryInv > 0 || this.spiritT > 0 || (this.rolling && this.rollT > 0); }
  /** `penalty.containers` is the same counter as `heartDebt` (ARCH D6). */
  get penalty() {
    if (!this._pen) { const p = this; this._pen = { get containers() { return p.heartDebt; }, set containers(v) { p.heartDebt = Math.max(0, v | 0); } }; }
    return this._pen;
  }

  /** Objects excluded from room-transition snapshots. */
  get noSnapObjects() { return [this.sprite, this.shadow, this.cdGfx]; }

  // ------------------------------------------------------------------------------------------------ rider
  _setCharBase(id) {
    const c = charDef(id);
    this.char = c.id;
    this.tint = c.tint;
    const key = c.skin || 'player';
    this.skin = key;
    this.skinBase = key !== 'player' && Assets.has(`${key}_walk_down`) ? key : 'player'; // missing rider art: gunslinger sprites + tint
    this.crng = subRng('combat', this.char);
  }

  /** Switch rider (stats, skin, combat stream). Safe to call repeatedly; does not touch items or pickups (see applyStart). */
  setChar(id) {
    if (!isChar(id)) return;
    this._setCharBase(id);
    this._synDirty = true;
    if (this.sprite) {
      this._anim = '';
      if (this.skinBase === 'player' && this.tint !== 0xffffff) this.sprite.setTint(this.tint); else this.sprite.clearTint();
      Assets.tex(this.scene, `${this.skinBase}_walk_down`);
    }
    this.recomputeStats(true);
    this.hp = Math.min(this.hp, this.maxHp);
  }

  /** Give the rider's start kit (idempotent per rider). */
  applyStart() {
    const c = charDef(this.char);
    if (this.startGiven === this.char) return;
    this.startGiven = this.char;
    this.coins = c.start.coins; this.keys = c.start.keys; this.dynamite = c.start.dynamite;
    for (const id of c.start.items) if (!this.items.includes(id)) this.addItem(id, { quiet: true });
    this.recomputeStats(true);
    this.hp = this.maxHp;
    this.tin = Math.min(c.start.tin, this._tinCap());
  }

  // ------------------------------------------------------------------------------------------------ stats / items
  /** Rebuild player.stats (see the header for the order). Cheap; call whenever inputs change. `quiet` = no synergy toasts (loads). */
  recomputeStats(quiet = false) {
    const s = this.stats, scene = this.scene, api = this._api;
    const base = baseFor(this.char);
    const c = charDef(this.char);
    for (const k in s) if (!(k in base)) delete s[k];
    Object.assign(s, base);
    const diff = scene && scene.diff;
    s.hurtInvuln = diff ? diff.hurtInvuln : PLAYER.invulnAfterHit;
    s.roomEntryInvuln = diff ? diff.roomEntryInvuln : PLAYER.roomEntryInvuln;
    s.maxHearts += this.extraHearts;
    api.stats = s; api.scene = scene; api.player = this;
    // items: apply per copy, then applyLate (final-stat dependent)
    const cnt = this._cnt;
    cnt.clear();
    for (let i = 0; i < this.items.length; i++) {
      const id = this.items[i];
      const def = getItem(id);
      const n = (cnt.get(id) || 0) + 1;
      cnt.set(id, n);
      if (def && def.apply) { api.count = n; def.apply(this, api); }
    }
    if (this.active) { const d = getItem(this.active.id); if (d && d.apply) { api.count = 1; d.apply(this, api); } }
    s.maxHearts -= this.heartDebt;
    cnt.clear();
    for (let i = 0; i < this.items.length; i++) {
      const id = this.items[i];
      const def = getItem(id);
      const n = (cnt.get(id) || 0) + 1;
      cnt.set(id, n);
      if (def && def.applyLate) { api.count = n; def.applyLate(this, api); }
    }
    if (this.active) { const d = getItem(this.active.id); if (d && d.applyLate) { api.count = 1; d.applyLate(this, api); } }
    const cbase = base.damage;
    const scale = c.flatDmgScale ?? 1;
    if (scale !== 1) s.damage = cbase + (s.damage - cbase) * scale;
    // synergies (re-evaluated only when the owned set changed)
    if (this._synDirty) this._syncSynergies(quiet);
    if (this.synergies.size) for (const id of this.synergies) { const syn = SYN_BY_ID[id]; if (syn && syn.apply) syn.apply(s, this, this._synCtx); }
    applyBoons(this, s);
    if (scene && scene.mutators && scene.mutators.length) applyMutators(s, scene.mutators);
    for (let i = 0; i < this.buffs.length; i++) this.buffs[i].apply(s, this);
    // clamps
    if (s.explosionVuln) s.explosionImmune = 0;
    applyCaps(s);
    s.maxHearts = clampN(Math.round(s.maxHearts), 1, PLAYER.maxHearts);
    s.fireDelay = Math.max(0.07, s.fireDelay);
    s.damage = Math.max(0.5, s.damage);
    s.moveSpeed = clampN(s.moveSpeed, 120, 620);
    s.range = Math.max(0.15, s.range);
    s.bulletCount = Math.max(1, Math.round(s.bulletCount));
    if (this.hp > this.maxHp) this.hp = this.maxHp;
    const tinCap = this._tinCap();
    if (this.tin > tinCap) this.tin = tinCap;
    if (this.cyl.pos > s.sixthEvery - 1) this.cyl.pos = s.sixthEvery - 1;
    this.syncCylinder();
    if (s.haloCharges !== this._haloMax) { this.haloLeft = clampN(this.haloLeft + Math.max(0, s.haloCharges - this._haloMax), 0, s.haloCharges); this._haloMax = s.haloCharges; }
    bus.emit('player:stats', { stats: s });
    return s;
  }

  _tinCap() { return Math.max(0, PLAYER.maxHearts - this.stats.maxHearts) * 2; }

  /** Re-evaluate the active synergy set, emit activated / lost, rebuild the hook lists. */
  _syncSynergies(quiet) {
    this._synDirty = false;
    const next = evaluateSynergies(ownedIds(this), this._synNext, this.tagCounts);
    for (const id of this.synergies) if (!next.has(id)) { this.synergies.delete(id); bus.emit('synergy:lost', { id }); }
    for (const id of next) {
      if (this.synergies.has(id)) continue;
      this.synergies.add(id);
      if (!quiet) bus.emit('synergy:activated', { id, def: SYN_BY_ID[id] });
    }
    rebuildHooks(this);
    posseSync(this); // spectral_posse: free Spirit Lantern while the synergy holds
  }

  /** Cylinder HUD view: `loaded` = shots left before the Sixth Bullet (1 = the Sixth is up). */
  syncCylinder() {
    const every = this.stats.sixthEvery, cy = this.cylinder;
    cy.max = every;
    cy.loaded = this.forceSixth > 0 ? 1 : every - this.cyl.pos;
    if (cy.loaded < 1) cy.loaded = 1;
  }

  /** Queue `n` Sixth Bullets (they fire before the cylinder cycle; unused ones expire). */
  grantSixth(n = 1) { this.forceSixth += n; this.forceSixthT = FORCE_SIXTH_LIFE; this.syncCylinder(); }

  /** Give an item: registers it, runs onPickup once, recomputes stats. Actives replace the current active (old one is returned). opts: {quiet}. */
  addItem(id, opts) {
    const def = getItem(id);
    if (!def) { console.warn('[Player] unknown item', id); return null; }
    let prev = null;
    if (def.type === 'active') {
      prev = this.active ? this.active.id : null;
      this.active = { id, charge: 0, max: def.charges ?? 3 };
      if (prev && prev !== id) this._dropState(prev);
      bus.emit('active:changed', { ...this.active });
    } else this.items.push(id);
    if (def.state && !this.itemState[id]) this.itemState[id] = def.state();
    this._synDirty = true;
    const count = this.items.filter((i) => i === id).length;
    this.recomputeStats(opts && opts.quiet);
    if (def.onPickup) def.onPickup(this, { stats: this.stats, count, scene: this.scene, player: this });
    this.recomputeStats(opts && opts.quiet);
    return prev;
  }
  removeItem(id) {
    const i = this.items.indexOf(id);
    if (i < 0) return;
    this.items.splice(i, 1);
    if (!this.items.includes(id)) this._dropState(id);
    this._synDirty = true;
    this.recomputeStats(true);
  }
  _dropState(id) { if (!this.hasItem(id)) delete this.itemState[id]; }
  hasItem(id) { return this.items.includes(id) || (!!this.active && this.active.id === id); }
  itemCount(id) { let n = 0; for (const i of this.items) if (i === id) n++; return n; }

  /** Temporary stat modifier. apply(stats, player) mutates the stats copy. `t` seconds (or Infinity until removeBuff). */
  addBuff(id, apply, t = 10) {
    this.buffs = this.buffs.filter((b) => b.id !== id);
    this.buffs.push({ id, apply, t });
    this.recomputeStats();
  }
  removeBuff(id) { this.buffs = this.buffs.filter((b) => b.id !== id); this.recomputeStats(); }
  addFamiliar(f) { this.familiars.push(f); return f; }

  addCharge(n = 1) {
    if (!this.active) return;
    const before = this.active.charge;
    this.active.charge = Math.min(this.active.max, this.active.charge + n);
    if (this.active.charge !== before) bus.emit('active:changed', { ...this.active });
  }
  useActive() {
    if (!this.active || this.dead) return false;
    if (this.active.charge < this.active.max) { Sfx.play('door_locked', { vol: 0.5, gap: 0.3 }); return false; }
    const def = getItem(this.active.id);
    if (!def || !def.use) return false;
    const api = this._api;
    api.count = 1;
    const ok = def.use(this, api);
    if (ok === false) return false;
    if (this.active) { this.active.charge = 0; bus.emit('active:changed', { ...this.active }); }
    return true;
  }

  // ------------------------------------------------------------------------------------------------ save seams
  /** Plain-data snapshot for checkpoints (Save.saveCheckpoint JSON-clones it). */
  snapshot() {
    let state = {};
    try { state = JSON.parse(JSON.stringify(this.itemState)); } catch (e) { state = {}; }
    return {
      char: this.char, items: [...this.items], active: this.active ? { id: this.active.id, charge: this.active.charge } : null,
      hp: this.hp, maxHp: this.maxHp, tin: this.tin, coins: this.coins, keys: this.keys, dyn: this.dynamite,
      curses: [...this.curses], blessings: [...this.blessings], heartDebt: this.heartDebt, extraHearts: this.extraHearts, revive: this.reviveCharges, itemState: state,
    };
  }

  /** Restore a snapshot: items are re-registered WITHOUT their one-shot onPickup; runtime objects (familiars) come back through def.onRestore. */
  restore(snap) {
    if (!snap) return;
    for (const f of [...this.familiars]) if (f.destroy) f.destroy();
    this.familiars.length = 0;
    this._posseF = null; // the free posse lantern is re-created by the synergy sync below
    if (snap.char && isChar(snap.char)) this._setCharBase(snap.char);
    this.items = Array.isArray(snap.items) ? snap.items.filter((id) => getItem(id)) : [];
    this.active = null;
    this.itemState = {};
    const saved = snap.itemState || {};
    if (snap.active && getItem(snap.active.id)) {
      const d = getItem(snap.active.id);
      this.active = { id: d.id, charge: Math.max(0, Math.min(finite(snap.active.charge, 0) | 0, d.charges ?? 3)), max: d.charges ?? 3 };
    }
    for (const id of new Set([...this.items, ...(this.active ? [this.active.id] : [])])) {
      const d = getItem(id);
      this.itemState[id] = saved[id] !== undefined ? saved[id] : d.state ? d.state() : undefined;
      if (this.itemState[id] === undefined) delete this.itemState[id];
    }
    for (const k of Object.keys(saved)) if (k.startsWith('syn:')) this.itemState[k] = saved[k];
    this.curses = Array.isArray(snap.curses) ? snap.curses.filter((c) => typeof c === 'string') : [];
    this.blessings = Array.isArray(snap.blessings) ? snap.blessings.filter((c) => typeof c === 'string') : [];
    this.heartDebt = Math.max(0, snap.heartDebt | 0);
    this.extraHearts = Math.max(0, snap.extraHearts | 0);
    this.reviveCharges = snap.revive ? 1 : 0;
    this.coins = Math.max(0, finite(snap.coins, this.coins) | 0); this.keys = Math.max(0, finite(snap.keys, this.keys) | 0); this.dynamite = Math.max(0, finite(snap.dyn, this.dynamite) | 0);
    this.buffs.length = 0;
    this.cyl.pos = 0; this.forceSixth = 0;
    this._synDirty = true;
    this.recomputeStats(true);
    this.hp = clampN(finite(snap.hp, this.maxHp), 1, this.maxHp);
    this.tin = clampN(finite(snap.tin, 0), 0, this._tinCap());
    this._coinsSeen = this.coins;
    this.haloLeft = this.stats.haloCharges || 0;
    this.shieldLeft = this.stats.roomShield || 0; this.shieldRest = 0; // a restored build starts with its own room shield (never a stale one from the previous build)
    if (this.sprite) { this._anim = ''; if (this.skinBase === 'player' && this.tint !== 0xffffff) this.sprite.setTint(this.tint); }
    const api = this._api;
    for (const id of new Set([...this.items, ...(this.active ? [this.active.id] : [])])) {
      const d = getItem(id);
      if (d && d.onRestore) { api.count = this.itemCount(id) || 1; try { d.onRestore(this, api); } catch (e) { console.error('[Player] onRestore', id, e); } }
    }
    this.recomputeStats(true);
    posseSync(this); // restore destroyed every familiar: bring the synergy lantern back (the synergy set itself may be unchanged)
    bus.emit('active:changed', this.active ? { ...this.active } : { id: null, charge: 0, max: 0 });
  }

  // ------------------------------------------------------------------------------------------------ hearts
  heal(units) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + units);
    const d = this.hp - before;
    if (d > 0) {
      this.recomputeStats(); bus.emit('player:healed', { units: d });
      const fx = this.scene.fx;
      if (fx && !this.dead) {
        fx.burst(this.x, this.y - 20, { color: [0xff8a7a, 0xffd8c8, 0xffffff], count: 5 + d * 3, speed: [30, 120], life: [420, 850], scale: [1, 2.2], gravity: -140, blend: 'ADD' }); // rising sparkles
        fx.ringPulse(this.x, this.footY, 0xff8a7a, 44, 420, 0.6);
      }
    }
    return d;
  }
  addTin(units) {
    const before = this.tin;
    this.tin = Math.min(this._tinCap(), this.tin + units);
    return this.tin - before;
  }
  /** Permanently lose `n` heart containers (deals, lazarus). Refuses below one container. Returns true when paid. */
  loseMaxHeart(n = 1) {
    if (this.stats.maxHearts - n < 1) return false;
    this.heartDebt += n;
    this.recomputeStats();
    return true;
  }
  /** Ace in the Hole: one revive charge (max 1), consumed by tryRevive with 6 hp units and 2 s of invulnerability. */
  grantRevive(source = 'ace_in_hole') { this.reviveCharges = 1; this._reviveSrc = source; }
  canBeHit() { return !this.dead && !this.godMode && !this.invulnerable; }

  /**
   * Take `units` of damage (1 = half heart). Order: room shield -> halo -> `hurt` hook -> tin caps -> tin, hp. Returns true if damage was applied.
   * source: {x,y,explosion,kind,enemyName,bullet,...}. Kinds: lava fire vent cart steam chandelier roulette card quicksand own_dynamite (plain strings).
   */
  damage(units, source = {}) {
    if (!this.canBeHit()) return false;
    const s = this.stats;
    if (source.explosion && s.explosionImmune) return false;
    if (this.shieldLeft > 0) {
      this.shieldLeft--; this.shieldRest = 1; // a block costs the next room's shield (Duster Coat balance)
      this.hurtT = 0.4;
      this.scene.fx.text(this.x, this.y - 70, 'BLOCKED', { color: '#8fc23f', size: 22 });
      Sfx.play('shop_deny', { vol: 0.5 });
      return false;
    }
    if (this.haloLeft > 0) { // saints_halo: absorbs any source, then blasts
      this.haloLeft--;
      this.hurtT = 0.5;
      this.scene.fx.text(this.x, this.y - 70, 'ABSORBED', { color: '#fff0b0', size: 22 });
      nova(this.scene, this.x, this.y, { radius: 200, damage: 3 * s.damage, source: 'halo' });
      return false;
    }
    if (hasHook(this, 'hurt')) {
      const c = CTX.hurt; c.units = units; c.source = source;
      const r = runHooks(this, 'hurt', c);
      if (r && r.cancel) return false;
      if (r && typeof r.units === 'number') units = r.units;
    }
    if (source.explosion && s.explosionVuln) units += 1;
    if (this.tin > 0) { // Preacher relic (tinPlating) / iron_hide: a hit costs at most N units while tin remains
      if (s.tinPlating) units = Math.min(units, 1);
      if (s.hitCap > 0) units = Math.min(units, s.hitCap);
    }
    if (s.damageTakenMin > 0) units = Math.max(units, s.damageTakenMin);
    let rem = units;
    const t = Math.min(this.tin, rem);
    this.tin -= t; rem -= t;
    this.hp -= rem;
    this.hurtT = s.hurtInvuln;
    this.firePoseT = 0;
    if (this.scene.run) this.scene.run.damageTaken += units;
    // knockback away from the source
    if (source.x != null) {
      const a = Math.atan2(this.y - source.y, this.x - source.x);
      this.knock.x = Math.cos(a) * 340; this.knock.y = Math.sin(a) * 340;
    }
    const fx = this.scene.fx;
    this.hurtFlashT = 0.12; // white silhouette flash
    fx.hitStop(70);
    fx.shake(0.01, 200);
    fx.flash(0xd63a2a, 0.55);
    fx.burst(this.x, this.y - 30, { color: [0x8a1c1c, 0xd63a2a], count: 12, speed: [80, 280], gravity: 200 });
    if (source.x != null) fx.burst(this.x, this.y - 30, { color: [0xd63a2a, 0xffb0a0], count: 6, speed: [160, 340], life: [150, 320], scale: [1, 2.4], blend: 'ADD', dir: Math.atan2(this.y - source.y, this.x - source.x), spread: 45 });
    fx.decal(this.x, this.y + 12, 'blood', 0.55);
    this.recomputeStats();
    bus.emit('player:hurt', { units, source, hp: this.hp, tin: this.tin });
    if (s.dynamiteVestChance > 0 && this.crng.chance(s.dynamiteVestChance)) {
      new Dynamite(this.scene, this.x, this.y, { fuse: 1.2, playerDamage: s.explosionImmune ? 0 : 2, owner: 'player', silent: true });
    }
    if (s.avengingAngel) nova(this.scene, this.x, this.y, { radius: 260, damage: s.damage * 4, source: 'angel' });
    if (hasHook(this, 'hurtPost')) {
      const c = CTX.hurtPost; c.units = units; c.source = source; c.hp = this.hp;
      runHooks(this, 'hurtPost', c);
    }
    if (this.hp <= 0 && this.tin <= 0 && !this.dead) { this.hp = 0; if (!this.tryRevive(source)) this.die(source); }
    return true;
  }

  /**
   * One revive per lethal hit, first available wins: black_cat_bone (item removed, 2 hp), ace_in_hole pact (6 hp), lazarus_pact (2 hp, a
   * container lost per rise, item removed after the second), then `deathSave` hooks. Returns true when revived (the player did NOT die).
   */
  tryRevive(source = {}) {
    let how = null, hp = 2;
    for (const id of REVIVE_ORDER) {
      if (id === 'black_cat_bone' && this.hasItem(id)) { this.removeItem(id); how = id; break; }
      if (id === 'ace_in_hole' && this.reviveCharges > 0) { this.reviveCharges = 0; how = id; hp = 6; break; }
      if (id === 'lazarus_pact' && this.hasItem(id)) {
        const st = this.itemState[id] || (this.itemState[id] = { charges: 2 });
        if (st.charges > 0) {
          st.charges--;
          if (st.charges <= 0) this.removeItem(id);
          if (this.stats.maxHearts > 1) this.loseMaxHeart(1);
          how = id; break;
        }
      }
    }
    if (!how && hasHook(this, 'deathSave')) {
      CTX.deathSave.source = source;
      if (runHooks(this, 'deathSave', CTX.deathSave) === true) how = 'hook';
    }
    if (!how) return false;
    this.recomputeStats();
    this.hp = Math.min(this.maxHp, hp);
    this.tin = 0;
    this.hurtT = 2;
    this.rolling = false;
    const sc = this.scene;
    explode(sc, this.x, this.y, { radius: 260, damage: 40, hurtPlayer: false, breakObstacles: false, revealSecrets: false, source: 'revive' });
    if (sc.bullets && sc.bullets.enemy) sc.bullets.enemy.clear();
    sc.fx.text(this.x, this.y - 90, 'RISEN', { color: '#ffe090', size: 30 });
    sc.fx.ringPulse(this.x, this.footY, 0xffe090, 200, 700, 0.9);
    this.scene.fx.flash(0xffe090, 0.45);
    bus.emit('player:revived', { source: how });
    return true;
  }

  die(source = {}) {
    if (this.dead) return;
    this.dead = true;
    this.rolling = false;
    this.deathT = 0;
    this.vx = this.vy = 0;
    this.orbiters.length = 0;
    if (this.scene.run) this.scene.run.killedBy = source.enemyName || source.kind || (source.explosion ? 'explosion' : 'the desert');
    bus.emit('player:died', { source });
    this.scene.onPlayerDied(source);
  }

  // ------------------------------------------------------------------------------------------------ pickups
  /** Coins gained honouring the fractional `coinMult` (gold_rush 1.25x): whole coins are banked, the remainder carries over. */
  gainCoins(n) {
    const max = PLAYER.maxPickups;
    const v = n * this.stats.coinMult + this._coinFrac;
    const whole = Math.floor(v + 1e-9);
    this._coinFrac = Math.max(0, v - whole);
    this.coins = Math.min(max, this.coins + whole);
    return whole;
  }

  /** Try to collect a pickup type. Returns true when consumed. Room/pickup code calls this. */
  collect(type) {
    const max = PLAYER.maxPickups, s = this.stats;
    if (hasHook(this, 'collect')) {
      const c = CTX.collect; c.type = type;
      const r = runHooks(this, 'collect', c);
      if (r === false) { bus.emit('pickup:collected', { type }); return true; } // swallowed by an item
      if (r && r.type) type = r.type;
    }
    if (s.heartToCoin && (type === 'heart_full' || type === 'heart_half')) { // leech_contract: red hearts pay out as coins
      if (this.coins >= max) return false;
      this.gainCoins(type === 'heart_full' ? 2 : 1);
      bus.emit('pickup:collected', { type });
      return true;
    }
    switch (type) {
      case 'heart_full': if (this.hp >= this.maxHp) return false; this.heal(2); break;
      case 'heart_half': if (this.hp >= this.maxHp) return false; this.heal(1); break;
      case 'heart_tin': if (!this.addTin(2)) return false; break;
      case 'heart_container': {
        if (s.maxHearts >= PLAYER.maxHearts) return false;
        this.extraHearts++;
        this.recomputeStats();
        this.heal(2);
        this.scene.fx.flash(0xf0d060, 0.35);
        break;
      }
      case 'coin': if (this.coins >= max) return false; this.gainCoins(1); break;
      case 'coin_nickel': if (this.coins >= max) return false; this.gainCoins(5); break;
      case 'key': if (this.keys >= max) return false; this.keys++; break;
      case 'dynamite': if (this.dynamite >= max) return false; this.dynamite++; break;
      default: return false;
    }
    bus.emit('pickup:collected', { type });
    return true;
  }
  canCollect(type) {
    const max = PLAYER.maxPickups;
    switch (type) {
      case 'heart_full': case 'heart_half': return this.hp < this.maxHp || (!!this.stats.heartToCoin && this.coins < max);
      case 'heart_tin': return this.tin < this._tinCap();
      case 'heart_container': return this.stats.maxHearts < PLAYER.maxHearts;
      case 'coin': case 'coin_nickel': return this.coins < max;
      case 'key': return this.keys < max;
      case 'dynamite': return this.dynamite < max;
      default: return false;
    }
  }
  /** Shop price: mutator multiplier (dry_town), then discounts, then the curse_debt surcharge. */
  price(base) {
    const sc = this.scene, m = sc && sc.mut && sc.mut.shopMult ? sc.mut.shopMult : 1;
    return Boons.price(this, Math.max(1, Math.round(base * m) - (this.stats.shopDiscount || 0)));
  }

  // ------------------------------------------------------------------------------------------------ scripted control
  setEntryInvuln(t = this.stats.roomEntryInvuln) { this.entryInv = Math.max(this.entryInv, t); }
  /** Walk toward a direction for `t` seconds ignoring input (room entry). */
  forceWalk(dx, dy, t) { this.forced = { x: dx, y: dy, t }; this.rolling = false; }
  onRoomEntered() { if (this.shieldRest > 0) { this.shieldRest--; this.shieldLeft = 0; } else this.shieldLeft = this.stats.roomShield || 0; }
  teleport(x, y) { this.x = x; this.y = y; this.vx = this.vy = 0; this.knock.x = this.knock.y = 0; this.syncVisual(); }

  // ------------------------------------------------------------------------------------------------ update
  update(dt, input) {
    this.time += dt;
    if (this.dead) { this.updateDead(dt); return; }
    const s = this.stats;
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.entryInv > 0) this.entryInv -= dt;
    if (this.spiritT > 0) this.spiritT -= dt;
    if (this.rollCd > 0) this.rollCd -= dt;
    if (this.firePoseT > 0) this.firePoseT -= dt;
    if (this.hurtFlashT > 0) this.hurtFlashT -= dt;
    if (this.forceSixth > 0 && (this.forceSixthT -= dt) <= 0) { this.forceSixth = 0; this.syncCylinder(); }
    const rollWasCd = this.rollCd > 0;
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      const b = this.buffs[i];
      b.t -= dt;
      if (b.t <= 0) { this.buffs.splice(i, 1); this.recomputeStats(); }
    }
    if (this.coins !== this._coinsSeen) this._coinsChanged();
    if (s.dynamiteRegen > 0 && this.dynamite < s.dynamiteRegenCap) {
      this._dynT += dt;
      if (this._dynT >= s.dynamiteRegen) { this._dynT = 0; this.dynamite++; }
    } else this._dynT = 0;

    // environment (written by hazards after this update ran last frame): read, then reset
    const env = this.env, envSpeed = env.speedMult, envRoll = env.rollMult, pushX = env.push.x, pushY = env.push.y;
    env.speedMult = 1; env.rollMult = 1; env.push.x = 0; env.push.y = 0;

    if (rollWasCd && this.rollCd <= 0 && !this.rolling) this.scene.fx.ringPulse(this.x, this.footY - 2, 0xf0a640, 34, 300, 0.75); // dodge ready
    const locked = this.locked;
    let move = { x: 0, y: 0 };
    let aim = null;
    if (this.forced) {
      move = { x: this.forced.x, y: this.forced.y };
      this.forced.t -= dt;
      if (this.forced.t <= 0) this.forced = null;
    } else if (!locked) {
      move = input.move;
      aim = input.aim(this);
    }
    const acting = !this.forced && !locked;
    if (!acting) { input.pressed('roll'); input.pressed('dyn'); input.pressed('active'); }
    const mut = this.scene.mut;

    // roll
    if (acting && !this.rolling && this.rollCd <= 0 && input.pressed('roll')) { if (!(mut && mut.noRoll)) this.startRoll(move, aim); }
    else if (acting) { input.pressed('roll'); }

    if (this.rolling) {
      this.rollT -= dt;
      const sp = (s.rollDistance / s.rollDuration) * envRoll;
      // ease-out slightly: fast at start
      const k = clampN(this.rollT / s.rollDuration, 0, 1);
      const mult = 0.7 + 0.6 * k;
      this.vx = this.rollDir.x * sp * mult;
      this.vy = this.rollDir.y * sp * mult;
      this.rollDustT -= dt;
      if (this.rollDustT <= 0) {
        this.rollDustT = 0.07; this.scene.fx.dust(this.x, this.footY, 0.7);
        this.scene.fx.afterimage(this.sprite, 0xf0d090, 0.38, 220);
      }
      if (this.rollT <= 0) this._endRoll();
    } else {
      const sp = s.moveSpeed * envSpeed;
      const tx = move.x * sp, ty = move.y * sp;
      const has = move.x !== 0 || move.y !== 0;
      const slip = mut && mut.slippery;
      const step = (has ? PLAYER.accel * (slip ? slip.accel : 1) : PLAYER.friction * (slip ? slip.friction : 1)) * dt;
      const dx = tx - this.vx, dy = ty - this.vy;
      const len = Math.hypot(dx, dy);
      if (len <= step) { this.vx = tx; this.vy = ty; } else { this.vx += (dx / len) * step; this.vy += (dy / len) * step; }
      // footstep dust
      if (has && Math.hypot(this.vx, this.vy) > sp * 0.6) {
        this._stepT = (this._stepT || 0) - dt;
        if (this._stepT <= 0) { this._stepT = 0.22; this.scene.fx.dust(this.x, this.footY, 0.45); }
      }
    }
    this.knock.x *= Math.exp(-dt * 9); this.knock.y *= Math.exp(-dt * 9);
    this.moveBy((this.vx + this.knock.x + pushX) * dt, (this.vy + this.knock.y + pushY) * dt);
    if (this.hit) {
      if (this.hnx * this.vx < 0) this.vx *= 0.2;
      if (this.hny * this.vy < 0) this.vy *= 0.2;
    }

    // actions
    if (acting && !this.rolling) {
      if (aim && this.fireCd <= 0) this.fire(aim);
      if (input.pressed('dyn')) this.placeDynamite();
      if (input.pressed('active')) this.useActive();
    } else if (acting) { input.pressed('dyn'); input.pressed('active'); }

    for (let i = 0; i < this.familiars.length; i++) this.familiars[i].update(dt, this, this.scene);
    if (hasHook(this, 'update')) { CTX.update.dt = dt; runHooks(this, 'update', CTX.update); }
    itemFx(this.scene).update(dt);

    // facing
    if (aim && !this.rolling) this.setFacingVec(aim.x, aim.y);
    else if (Math.abs(move.x) + Math.abs(move.y) > 0.1) this.setFacingVec(move.x, move.y);

    this.updateAnim(dt, move, aim);
    this.updateCooldownGfx();
    this.syncVisual();
  }

  /** Any coin change (pickup, shop, hooks): bus event, `coins` hook, stats that read the purse. */
  _coinsChanged() {
    this._coinsSeen = this.coins;
    if (hasHook(this, 'coins')) { CTX.coins.coins = this.coins; runHooks(this, 'coins', CTX.coins); }
    this.recomputeStats(true);
    bus.emit('coins:changed', { coins: this.coins });
  }

  syncVisual() {
    super.syncVisual();
    if (this.rolling && this.sprite) this.sprite.y = this.y - 8; // rolled ball is centre-anchored
  }

  setFacingVec(x, y) {
    if (Math.abs(x) > Math.abs(y)) this.facing = x < 0 ? 'left' : 'right';
    else this.facing = y < 0 ? 'up' : 'down';
  }

  startRoll(move, aim) {
    let d = null;
    if (move.x || move.y) d = move;
    else if (aim) d = aim;
    else d = DIRS[this.facing];
    const l = Math.hypot(d.x, d.y) || 1;
    this.rollDir.x = d.x / l; this.rollDir.y = d.y / l;
    this.rolling = true;
    this.rollT = this.stats.rollDuration;
    this.rollDustT = 0;
    this.knock.x = this.knock.y = 0;
    this.setFacingVec(this.rollDir.x, this.rollDir.y);
    this.scene.fx.dust(this.x, this.footY, 1);
    this.scene.fx.burst(this.x, this.footY, { color: [0xc8a878, 0x8a7458], count: 7, speed: [60, 200], life: [250, 500], scale: [0.09, 0.3], tex: 'glow', alpha: [0.45, 0], dir: Math.atan2(-this.rollDir.y, -this.rollDir.x), spread: 40 }); // kick-off burst behind us
    if (hasHook(this, 'roll')) { CTX.roll.dir = this.rollDir; runHooks(this, 'roll', CTX.roll); }
    bus.emit('player:rolled', {});
  }

  /** Roll timeout: cooldown, grace i-frames, stomp (rollShock), `rollEnd` hook. */
  _endRoll() {
    const s = this.stats;
    this.rolling = false;
    this.scene.fx.dust(this.x, this.footY, 0.6);
    this.rollCd = s.rollCooldown;
    this.vx *= 0.3; this.vy *= 0.3;
    if (s.rollGrace > 0) this.hurtT = Math.max(this.hurtT, s.rollGrace);
    if (s.rollShock > 0) this._stomp();
    if (hasHook(this, 'rollEnd')) { CTX.roll.dir = this.rollDir; runHooks(this, 'rollEnd', CTX.roll); }
  }

  /** bronco_boots: the roll ends in a stomp (damage x rollShockMult, stun rollStun, clears enemy bullets in 120 px). */
  _stomp() {
    const s = this.stats, sc = this.scene, r = s.rollShock;
    const list = sc.enemies;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (!e || !e.alive || !e.targetable) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) > r + e.hitRadius) continue;
      e.takeHit(s.damage * s.rollShockMult, { x: this.x, y: this.y, angle: Math.atan2(e.y - this.y, e.x - this.x), knock: 2, stomp: true, source: this });
      if (e.alive) e.applyStatus('stun', { t: s.rollStun });
    }
    sc.bullets.enemy.clearRadius(this.x, this.y, 120);
    sc.fx.ringPulse(this.x, this.footY, 0xd9b071, r, 420, 0.9);
    sc.fx.burst(this.x, this.footY, { color: [0xc8a878, 0x8a7458, 0xffffff], count: 14, speed: [120, 320], life: [250, 550], scale: [0.2, 0.5], tex: 'glow', alpha: [0.5, 0] });
    sc.fx.shake(0.008, 140);
    Sfx.play('explosion', { vol: 0.35, rate: 1.6, gap: 0.1 });
  }

  // ------------------------------------------------------------------------------------------------ shooting
  /** One trigger pull (ITEMS_V2 2.3): Sixth / dead-eye / crit selection, per-pellet mod rolls (seeded `crng`), then the `fire` hooks. */
  fire(aim) {
    const s = this.stats, scene = this.scene, cr = this.crng, cyl = this.cyl;
    const every = s.sixthEvery;
    const forced = this.forceSixth > 0;
    const natural = forced || cyl.pos >= every - 1;
    const dead = !!s.deadEye && this.time - this.lastShotAt > s.deadEyeDelay;
    const sixth = natural || (dead && !!s.patientHand);
    this.shotCount++;
    if (scene.run) scene.run.shots++;
    if (forced) this.forceSixth--; // a queued Sixth leaves the cylinder cycle untouched
    else cyl.pos = natural ? 0 : cyl.pos + 1;
    this.syncCylinder();
    if (this.cylinder.loaded === 1) Sfx.play('sixth_bullet_ready', { vol: 0.6 });
    let mult = s.bulletDamageMult;
    let pierce = s.pierce;
    let ricochet = s.ricochet, homing = s.homing;
    if (sixth) {
      mult *= s.sixthMult + s.jackpotPerCoin * this.coins;
      pierce += s.sixthPierce; ricochet += s.sixthRicochet; homing += s.sixthHoming;
    } else mult *= s.normalDamageMult;
    if (dead) { mult *= s.deadEye; pierce += 1; }
    // luck crit: small chance for x critMult damage on normal shots
    const luckCrit = !sixth && !dead && s.luck > 0 && cr.chance(Math.min(s.critCap, s.luck * 0.03));
    if (luckCrit) { mult *= s.critMult; pierce += s.critPierce; }
    this.lastShotAt = this.time;
    // boomerang: every Nth non-Sixth shot
    let boom = false;
    if (!sixth && s.boomerangEvery > 0) { this._boomN++; if (this._boomN >= s.boomerangEvery) { this._boomN = 0; boom = true; } }
    if (sixth && s.sixthCost > 0 && this.hp > s.sixthCost) { this.hp -= s.sixthCost; this.recomputeStats(); this.scene.fx.burst(this.x, this.y - 30, { color: [0x8a1c1c, 0xd63a2a], count: 6, speed: [60, 180], gravity: 200 }); }
    const base = Math.atan2(aim.y, aim.x);
    let n = s.bulletCount;
    const perp = { x: -aim.y, y: aim.x };
    const inherit = (this.vx * perp.x + this.vy * perp.y) * 0.25;
    const size = s.bulletSize * (sixth ? 1.5 : 1);
    const side = s.dualGuns ? (this._gunSide = -this._gunSide) : 0;
    const ox = perp.x * side * 12, oy = perp.y * side * 12;
    const damage = s.damage + s.coinDamage * this.coins;
    const orbitT = sixth ? s.sixthOrbit : 0;
    const extra = sixth && orbitT <= 0 ? s.sixthSplit : 0; // sixthSplit (Ten-Gauge Hammer): extra slugs fanned +-10 degrees; EVERY slug of the burst is x0.6. Orbit beats split (extras would only evict orbiters)
    const splitK = extra > 0 ? 0.6 : 1;
    if (orbitT > 0) n = 1;
    const list = CTX.fire.bullets;
    list.length = 0;
    const mods = this._mods;
    const total = n + extra;
    for (let i = 0; i < total; i++) {
      const isExtra = i >= n;
      const off = isExtra
        ? rad(10) * (Math.floor((i - n) / 2) + 1) * ((i - n) % 2 ? 1 : -1)
        : (n === 1 ? 0 : (i - (n - 1) / 2) * rad(s.spreadDeg)) + (s.inaccuracy && !sixth ? rad((cr.next() * 2 - 1) * s.inaccuracy) : 0); // the Sixth Bullet is always accurate (fan_the_hammer)
      const a = base + off;
      const mx = this.x + ox + Math.cos(a) * 30;
      const my = this.y + oy + Math.sin(a) * 30 - 6;
      mods.split = s.splitCount; mods.boomerang = boom; mods.orbit = orbitT;
      mods.chain = s.chainChance > 0 && cr.chance(s.chainChance);
      mods.explode = s.explodeChance > 0 && cr.chance(s.explodeChance);
      mods.ghost = s.ghostChance > 0 && cr.chance(s.ghostChance);
      mods.pull = s.pullRadius > 0;
      mods.chill = s.chillChance > 0 && cr.chance(s.chillChance);
      const b = scene.bullets.player.fire({
        x: mx, y: my, angle: a, speed: s.shotSpeed, damage, mult: mult * splitK, life: s.range,
        pierce, ricochet, homing, poison: s.poison,
        burn: s.burn && cr.chance(s.burn) ? 1 : 0,
        fear: s.fearChance && cr.chance(s.fearChance) ? 1 : 0,
        size, sixth, source: this, mods, crit: luckCrit, dead, sxr: sixth ? s.sixthExplode : 0, frame: s.bulletFrame || undefined,
      });
      if (!b) continue;
      list.push(b);
      b.vx += perp.x * inherit; b.vy += perp.y * inherit;
      if (dead) { b.sprite.setTint(0xff9060); b.glow.setTint(0xff6030); b.streak.setTint(0xff6030); }
      else if (luckCrit) { b.sprite.setTint(0xffe070); b.glow.setTint(0xffd040); b.streak.setTint(0xffd040); }
      else if (this.bulletTint != null && !sixth && !mods.ghost && !mods.chill && !mods.explode && !boom) { b.sprite.setTint(this.bulletTint); b.glow.setTint(this.bulletTint); b.streak.setTint(this.bulletTint); } // Sanctified (FaithMeter)
      else if (!sixth && !mods.ghost && !mods.chill && !mods.explode && !boom) { // status bullets are colour-coded: burn orange, fear violet, poison green
        if (b.burn) { b.sprite.setTint(0xffe2b8); b.glow.setTint(0xff8030); b.streak.setTint(0xff8030); } else if (b.fear) { b.sprite.setTint(0xe0ccff); b.glow.setTint(0xa060ff); b.streak.setTint(0xa060ff); } else if (b.poison) { b.sprite.setTint(0xe4ffd0); b.glow.setTint(0x80d040); b.streak.setTint(0x80d040); } // pale slugs + coloured glow: never confusable with enemy embers/venom
      }
    }
    this.fireCd = s.fireDelay;
    this.firePoseT = 0.16;
    const mzx = this.x + ox + aim.x * 44 + (aim.x === 0 ? 16 : 0), mzy = this.y + oy - 30 + aim.y * 26; // vertical shots: gun hand is off to the side of the hat
    scene.fx.muzzle(mzx, mzy, base, sixth ? 1.5 : 1);
    scene.fx.smoke(mzx + aim.x * 10, mzy + aim.y * 6, sixth ? 3 : 1, sixth);
    scene.fx.casing(this.x + aim.x * 22, this.y + 12 + aim.y * 10, aim.x, aim.y);
    Sfx.play(sixth ? 'shoot_crit' : (SHOT_SFX[this.char] || 'shoot'), { vol: sixth ? 1 : 0.8, detune: (cr.next() - 0.5) * 200 }); // per-rider report (AUDIO s2); the Sixth Bullet always cracks
    if (dead) { scene.fx.shake(0.006, 120); Sfx.play('shoot_crit', { vol: 0.7, rate: 0.85 }); }
    if (sixth) { scene.fx.shake(0.007, 120); this.knock.x -= aim.x * 120; this.knock.y -= aim.y * 120; }
    else { this.knock.x -= aim.x * 16; this.knock.y -= aim.y * 16; }
    bus.emit('player:fired', { sixth, count: this.cylinder.loaded });
    if (hasHook(this, 'fire') || (sixth && hasHook(this, 'sixthFired'))) {
      const c = CTX.fire; c.aim = aim; c.sixth = sixth; c.dead = dead; c.luckCrit = luckCrit;
      runHooks(this, 'fire', c);
      if (sixth) runHooks(this, 'sixthFired', c);
    }
    list.length = 0;
  }

  placeDynamite() {
    if (this.dynamite <= 0) { Sfx.play('door_locked', { vol: 0.4, gap: 0.3 }); return false; }
    const s = this.stats;
    this.dynamite--;
    const o = { fuse: s.dynamiteFuse, playerDamage: s.explosionImmune ? 0 : 2, owner: 'player' };
    let tx = this.x, ty = this.y;
    if (s.dynamiteThrow > 0) { // thrown ahead of you along the facing direction
      const d = DIRS[this.facing] || DIRS.down;
      tx = clampN(this.x + d.x * s.dynamiteThrow, ROOM.x + 60, ROOM.right - 60); ty = clampN(this.y + d.y * s.dynamiteThrow, ROOM.y + 60, ROOM.bottom - 60);
      o.from = { x: this.x, y: this.y }; o.flight = 0.25; // ITEMS_V2 4.5: the thrown stick arcs 0.25 s
    }
    new Dynamite(this.scene, tx, ty, o);
    Sfx.play('gun_cock', { vol: 0.5 });
    return true;
  }

  // ------------------------------------------------------------------------------------------------ visuals
  updateAnim(dt, move, aim) {
    const sp = this.sprite;
    const s = this.scene;
    const sk = this.skinBase;
    let alpha = 1;
    if (this.hurtT > 0 && !this.rolling) alpha = Math.floor(this.hurtT * 16) % 2 ? 0.35 : 1;
    if (this.spiritT > 0) alpha = Math.min(alpha, 0.55);
    sp.setAlpha(alpha);
    if (this.hurtFlashT > 0) { sp.setTintFill(0xffffff); this._flashed = true; alpha = 1; sp.setAlpha(1); } else if (this._flashed) { sp.clearTint(); if (sk === 'player' && this.tint !== 0xffffff) sp.setTint(this.tint); this._flashed = false; }
    sp.setFlipX(this.facing === 'left');
    if (this.rolling) {
      const key = Assets.ensureAnim(s, `${sk}_roll`, { fps: 16, name: 'roll' });
      this._play(key, `${sk}_roll`);
      sp.setOrigin(0.5, 0.5);
      sp.setRotation(0);
      sp.setScale(1);
      return;
    }
    sp.setOrigin(0.5, Assets.anchor(`${sk}_walk_down`) === 'bottom' ? 1 : 0.5);
    const dir = this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing;
    const moving = Math.hypot(this.vx, this.vy) > 30;
    if (this.firePoseT > 0 && aim) {
      const idx = dir === 'down' ? 0 : dir === 'up' ? 1 : 2;
      this._pose(`${sk}_fire`, idx);
    } else if (moving) {
      const key = Assets.ensureAnim(s, `${sk}_walk_${dir}`, { fps: 12, name: 'walk' });
      this._play(key, `${sk}_walk_${dir}`);
      sp.anims.timeScale = clampN(Math.hypot(this.vx, this.vy) / 330, 0.6, 1.5);
    } else {
      this._pose(`${sk}_walk_${dir}`, 0);
    }
    const idle = !moving && !(this.firePoseT > 0);
    sp.setScale(1, idle ? 1 + Math.sin(this.time * 3) * 0.012 : 1);
  }
  _play(animKey, tex) {
    if (this._anim !== animKey) { this._anim = animKey; this.sprite.play(animKey, true); }
  }
  _pose(tex, frame) {
    const k = `pose:${tex}:${frame}`;
    if (this._anim !== k) {
      this._anim = k;
      this.sprite.anims.stop();
      Assets.tex(this.scene, tex);
      this.sprite.setTexture(tex, frame);
    }
  }

  updateCooldownGfx() {
    const g = this.cdGfx;
    g.clear();
    if (this.rollCd > 0 && !this.dead) {
      const p = 1 - this.rollCd / this.stats.rollCooldown;
      g.lineStyle(4, 0xf0a640, 0.75);
      g.beginPath();
      g.arc(this.x, this.footY - 2, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p, false);
      g.strokePath();
    }
    if (this.orbiters.length) { // carousel_slug: faint orbit ring
      g.lineStyle(2, 0xffe090, 0.16);
      g.strokeCircle(this.x, this.y - 36, 130);
    }
  }

  updateDead(dt) {
    this.deathT += dt;
    const s = this.scene;
    const key = Assets.ensureAnim(s, `${this.skinBase}_death`, { fps: 6, repeat: 0, name: 'die' });
    this._play(key, `${this.skinBase}_death`);
    this.sprite.setOrigin(0.5, 1).setAlpha(1).setScale(1);
    this.cdGfx.clear();
    this.knock.x *= Math.exp(-dt * 9); this.knock.y *= Math.exp(-dt * 9);
    this.moveBy(this.knock.x * dt, this.knock.y * dt);
    this.syncVisual();
  }

  destroy() {
    if (this.offFloor) { this.offFloor(); this.offFloor = null; }
    for (const f of [...this.familiars]) if (f.destroy) f.destroy(); // copy: Familiar.destroy() removes itself from the list
    this.familiars.length = 0;
    this.orbiters.length = 0;
    this.cdGfx.destroy();
    super.destroy();
  }
}
