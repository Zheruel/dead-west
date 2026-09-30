// BOSS 6 - OL' SCRATCH, THE DEALER "The House Always Wins" (floor 6 final boss, HP 1500, 4 phases). CHAPTER2 s5 boss 6, STORY 6.6 / 5.3.
// Sprites: boss_scratch_idle / _atk (human: 0 card fan raised, 1 throwing, 2 arms wide, 3 chip lobbed) and boss_scratch_true_idle / _atk (true form:
// 0 hands clasped with fire, 1 casting hellfire, 2 roar arms wide, 3 contract raised). `formKey` picks the sheet (Boss.js has no formKey yet: local shim).
// Arena f6_boss: dealer's rail (720, 380); roulette region r/k on cols 3-9 x rows 2-4 (own RouletteZone: a stand-in arena gets a code-drawn one).
//   P0 "THE DEAL"  100-70 %  deal_fan 3, card_ring 2, chip_toss 2, roulette_call 2                                           delay 1.5
//   P1 "THE RAISE" < 70 %    roar, tux tears, 2 card_shark adds; + chandelier_rain 2, royal_flush 3, hold_em 2; vanish 30 %     delay 1.15
//   P2 "ALL IN"    < 40 %    2.2 s transformation (true form), 4 permanent corner fires; deal_fan 2 (3 volleys), card_ring 2,
//                            chandelier_rain 2 (4), royal_flush 3 (7 beams), hellfire_spiral 3, brimstone_grid 2                 delay 0.95
//   P3 "FINE PRINT" < 15 %   contract raised: reflective, 3 contract_seal orbs (60 HP; 45 on return); all 3 down = contract torn,
//                            stunned 7.0 s x1.5 damage; deal_fan 3, hellfire_spiral 2 (1 arm), chandelier_rain 1                delay 1.2
// Death: halt (bullets / hazards cleared, adds purged, invulnerable), slow-mo 0.35 x 2.5 s, cards scatter upward, the contract burns, then flow.endGame
// (game:ending). A true-eligible ride (Hell, no deals) does not explode: he kneels and the contract page hovers at (720, 470) for the Sixth Bullet.
// Every damage zone is telegraphed >= 0.5 s. Phase changes interrupt the running attack (`interrupt` -> `resetState`). Seeded RNG only (subRng).
import Boss from '../Boss.js';
import { registerBoss } from '../registry.js';
import { spawnEnemy } from '../../enemies/index.js';
import { Assets } from '../../core/Assets.js';
import { Sfx, Music } from '../../core/Audio.js';
import { bus } from '../../core/events.js';
import { subRng } from '../../core/rng.js';
import { ROOM } from '../../config.js';
import { clamp } from '../../core/util.js';
import { GroundHaz } from '../../systems/GroundHaz.js';
import { Hazards } from '../../rooms/hazards/index.js';
import { colOf, rowOf, tileX, tileY, hasCell, TAU } from '../../rooms/hazards/common.js';
import { BeamSet, RouletteZone, HoldEm, Paper, ensureScratchTextures, cardBurst, RED, GOLD, BONE } from '../parts/scratch/zones.js';
import { ContractSeal, SEAL } from '../parts/scratch/ContractSeal.js';
import { CARD_SLAM, SUITS } from '../parts/scratch/deadMansHand.js';

const DEG = Math.PI / 180;
const NAME = "Ol' Scratch";
const SRC = { enemyName: NAME };
const HOME = { x: ROOM.cx, y: 380 };
const SPOTS = [{ x: 720, y: 380 }, { x: 400, y: 420 }, { x: 1040, y: 420 }]; // vanish reappear spots
const FORMS = {
  human: { key: 'scratch', r: 62, hit: 70, foot: 50, scale: 0.85 },
  devil: { key: 'scratch_true', r: 76, hit: 84, foot: 56, scale: 0.9 },
};
const INTRO_MS = 4600; // STORY 5.3: Scratch's boss card runs 4.6 s (five cards slam onto the table)
const BARKS = ['DEAL ME IN', 'I RAISE', 'ALL IN', 'READ THE FINE PRINT'];
const CORNERS = [{ x: tileX(0), y: tileY(0) }, { x: tileX(12), y: tileY(0) }, { x: tileX(0), y: tileY(6) }, { x: tileX(12), y: tileY(6) }];
const CORNER_TAG = 'scratch_corner';
/** Attack weights per phase [P0, P1, P2, P3] (CHAPTER2 boss 6 table). */
const WEIGHTS = {
  deal_fan: [3, 3, 2, 3],
  card_ring: [2, 2, 2, 0],
  chip_toss: [2, 2, 0, 0],
  roulette_call: [2, 2, 0, 0],
  chandelier_rain: [0, 2, 2, 1],
  royal_flush: [0, 3, 3, 0],
  hold_em: [0, 2, 0, 0],
  hellfire_spiral: [0, 0, 3, 2],
  brimstone_grid: [0, 0, 2, 0],
};
const clampRoom = (o, m = 60) => { o.x = clamp(o.x, ROOM.x + m, ROOM.right - m); o.y = clamp(o.y, ROOM.y + m, ROOM.bottom - m); return o; };
const snd = (key, alt, o) => Sfx.play(Assets.hasAudio(key) ? key : alt, o);

class Scratch extends Boss {
  setup() {
    const s = this.scene;
    ensureScratchTextures(s);
    this.rng = subRng('boss', 'scratch', this.floor);
    this.tags = [];
    this.W = WEIGHTS;
    this.form = FORMS.human;
    this.formKey = FORMS.human.key;
    this.x = HOME.x; this.y = HOME.y;
    this.footOffset = this.form.foot;
    this.hitRadius = this.form.hit;
    this.shadowScale = (this.radius * 2.6) / 128;
    this.dtLast = 1 / 60;
    this.fightT = 0;
    this.stunned = 0; this.stunFx = 0;
    this.contractUp = false; // reflective + hits pass to the seals (P3)
    this.seals = [];
    this.sealHp = SEAL.hp;
    this.haz = []; // GroundHaz handles (chips, chandeliers, eruptions)
    this.lines = []; // warnLine handles
    this.spiral = { on: false, t: 0, n: 0, count: 0, arms: 1, step: 0, ang: 0, speed: 240 };
    this.fade = { k: 0, dir: 0 };
    this.vanishCd = 4;
    this.lastCol = null;
    this.sharkAt = -1; this.sharkExtra = false;
    this.cornersOn = false; this.cornerFire = [null, null, null, null]; this.cornerT = 0;
    this.reflT = 0;
    this.kneel = false; this.keepStage = false;
    this.beams = new BeamSet(this);
    this.roulette = new RouletteZone(this);
    this.holdem = new HoldEm(this);
    this.paper = new Paper(this);
    this.fitScale();
    this.syncVisual();

    const defs = [
      ['deal_fan', this.atkFan], ['card_ring', this.atkRing], ['chip_toss', this.atkChips], ['roulette_call', this.atkRoulette],
      ['chandelier_rain', this.atkChandelier], ['royal_flush', this.atkFlush], ['hold_em', this.atkHoldEm],
      ['hellfire_spiral', this.atkSpiral], ['brimstone_grid', this.atkGrid],
    ];
    for (const [name, fn] of defs) {
      const w = WEIGHTS[name];
      this.addAttack(name, fn, { weight: Math.max(...w), minPhase: w.findIndex((x) => x > 0), maxPhase: w.length - 1 - [...w].reverse().findIndex((x) => x > 0) });
    }
    this.phases = [
      { at: 0.7, name: 'The Raise', enter() { this.interrupt(this.raise()); } },
      { at: 0.4, name: 'All In', enter() { this.interrupt(this.transform()); } },
      { at: 0.15, name: 'The Fine Print', enter() { this.interrupt(this.raiseContract(true)); } },
    ];
  }

  attackDelay() { return this.cd([1.5, 1.15, 0.95, 1.2][Math.min(3, this.phase)]); }
  applyStatus(name, o) { if (name === 'fear' || name === 'stun' || name === 'frozen') return; super.applyStatus(name, o); }
  moveBehaviour() { this.stop(); }
  damageMultiplier() { return this.stunned > 0 ? 1.5 : 1; }
  idleBob(dt) { if (!this.kneel) super.idleBob(dt); }

  introData() {
    const run = this.scene.run;
    return { ...super.introData(), ms: INTRO_MS, slam: CARD_SLAM, trueEligible: !!(run && run.trueEligible), char: run ? run.char : undefined };
  }

  startFight() {
    super.startFight();
    this.fightT = 0;
    this.idleT = 1.4;
    this.bark(BARKS[0]);
    snd('piano_sting', 'card_shuffle', { vol: 0.8 });
  }

  // ------------------------------------------------------------------------------------------ forms / poses (formKey shim)
  /** Scale so a 320 px frame (or a 128 px placeholder under ?noassets) shows at the form's size. */
  fitScale() {
    const s = this.sprite;
    if (!s) return;
    const w = s.frame ? s.frame.realWidth : 320;
    this.baseScale = ((this.form || FORMS.human).scale * 320) / Math.max(1, w);
    s.setScale(this.baseScale);
  }

  setPose(p) {
    if (!this.sprite) return;
    if (this.contractUp && (p === 'move' || p === 'idle')) p = 'contract';
    if (p === 'contract') { if (this.pose !== 'atk3') this.atkFrame(3); return; }
    if (this.pose === p) return;
    this.pose = p;
    if (p === 'move' || p === 'idle') {
      const key = Assets.ensureAnim(this.scene, `boss_${this.formKey || 'scratch'}_idle`, { start: 0, end: 3, fps: 6, name: 'idle' });
      this.sprite.play(key, true);
      this.fitScale();
    } else this.atkFrame(p === 'windup' ? 0 : p === 'attack' ? 1 : 2);
  }

  atkFrame(i) {
    if (!this.sprite) return;
    this.pose = `atk${i}`;
    const key = `boss_${this.formKey || 'scratch'}_atk`;
    this.sprite.anims.stop();
    Assets.tex(this.scene, key);
    this.sprite.setTexture(key, this.scene.textures.get(key).has(i) ? i : 0);
    this.fitScale();
  }

  swapForm(devil) {
    this.form = devil ? FORMS.devil : FORMS.human;
    this.formKey = this.form.key;
    this.radius = this.form.r; this.hitRadius = this.form.hit; this.footOffset = this.form.foot;
    this.shadowScale = (this.radius * 2.6) / 128;
    this.pose = '';
    this.setPose(this.contractUp ? 'contract' : 'move');
    this.syncVisual();
  }

  bark(text) { this.scene.fx.text(this.x, Math.max(172, this.y - 205), text, { size: 34, color: '#f0d080', time: 1300, rise: 26 }); }

  // ------------------------------------------------------------------------------------------ per-frame systems
  ai(dt) {
    this.dtLast = dt;
    if (!this.dying) this.tick(dt);
    super.ai(dt);
  }

  tick(dt) {
    const s = this.scene;
    if (this.active) this.fightT += dt;
    this.beams.update(dt);
    this.roulette.update(dt);
    this.holdem.update(dt);
    if (this.spiral.on) this.stepSpiral(dt);
    if (this.vanishCd > 0) this.vanishCd -= dt;
    if (this.reflT > 0) this.reflT -= dt;
    if (this.fade.dir) this.stepFade(dt);
    if (this.stunned > 0) {
      this.stunned -= dt;
      this.stunFx -= dt;
      if (this.stunFx <= 0) { this.stunFx = 0.22; s.fx.burst(this.x + (this.rng.next() - 0.5) * 90, this.y - 170, { color: [0xffe070, 0xfff0a0], count: 2, speed: [10, 50], life: [400, 600], scale: [1.5, 2.5] }); }
    }
    if (this.cornersOn) { this.cornerT -= dt; if (this.cornerT <= 0) { this.cornerT = 0.5; this.cornerFires(); } }
    if (this.sharkAt >= 0 && !this.sharkExtra && this.active) { // +1 shark when none is alive 25 s after the first pair
      this.sharkAt += dt;
      if (this.sharkAt >= 25 && this.sharksAlive() === 0 && this.phase <= 2) { this.sharkExtra = true; this.addSharks(1); }
    }
  }

  stepFade(dt) {
    const f = this.fade;
    f.k = clamp(f.k + f.dir * dt / 0.25, 0, 1);
    this.alphaOverride = 1 - f.k;
    if (this.shadow) this.shadow.setAlpha(1 - f.k);
    if ((f.dir > 0 && f.k >= 1) || (f.dir < 0 && f.k <= 0)) { f.dir = 0; if (f.k <= 0) this.alphaOverride = undefined; }
  }

  /** One emitter step: `arms` bullets per tick every 0.09 s, rotating `step` rad per tick (allocation-free: bullets come from the pool). */
  stepSpiral(dt) {
    const sp = this.spiral, B = this.scene.bullets.enemy;
    sp.t -= dt;
    while (sp.t <= 0 && sp.n < sp.count) {
      sp.t += 0.09;
      for (let k = 0; k < sp.arms; k++) {
        const a = sp.ang + (k / sp.arms) * TAU;
        B.fire({ x: this.x + Math.cos(a) * 44, y: this.y + Math.sin(a) * 44, angle: a, speed: sp.speed, damage: 1, kind: 'ember', radius: 12, tint: 0xff7a2a, life: 2.2, owner: this });
      }
      sp.ang += sp.step; sp.n++;
      if ((sp.n & 3) === 0) Sfx.play('fire_whoosh', { vol: 0.25, rate: 1.4, gap: 0.12 });
    }
    if (sp.n >= sp.count) sp.on = false;
  }

  cornerFires() {
    const room = this.scene.room;
    if (!room || !room.addFire) return;
    for (let i = 0; i < 4; i++) {
      const c = CORNERS[i], p = this.cornerFire[i];
      if (p && p.active && p.tag === CORNER_TAG && p.x === c.x && p.y === c.y) continue; // still burning (a culled patch may have been recycled)
      this.cornerFire[i] = room.addFire(c.x, c.y, 110, 9999, { tag: CORNER_TAG, dmg: 1 });
    }
  }

  // ------------------------------------------------------------------------------------------ damage
  takeHit(dmg, info = {}) {
    if (this.contractUp && this.alive && !this.dying && this.spawnT <= 0) { this.reflect(info); return 'hit'; }
    return super.takeHit(dmg, info);
  }
  /** Damage that bypasses takeHit (poison / burn ticks, hazards): nothing lands while he is untouchable. */
  hurt(dmg, info = {}) {
    if (this.dying || this.invulnerable || this.contractUp) return;
    super.hurt(dmg, info);
  }

  /** The raised contract reflects every hit as one slow red ember at the player (max 12 alive). */
  reflect(info) {
    const s = this.scene, p = this.player;
    Sfx.play('ricochet_ping', { vol: 0.5, gap: 0.08, detune: (this.rng.next() - 0.5) * 300 });
    s.fx.impact(info.x ?? this.x, (info.y ?? this.y) - 40, (info.angle ?? 0) + Math.PI, 1);
    if (this.reflT > 0 || !p || p.dead) return;
    const list = s.bullets.enemy.list;
    let n = 0;
    for (let i = 0; i < list.length; i++) { const b = list[i]; if (b.active && b.data && b.data.refl) n++; }
    if (n >= 12) return;
    this.reflT = 0.1;
    const a = this.angleToPlayer();
    s.bullets.enemy.fire({ x: this.x + Math.cos(a) * 60, y: this.y + Math.sin(a) * 60, angle: a, speed: 220, damage: 1, kind: 'ember', radius: 13, tint: 0xff3a2a, life: 4.5, owner: this, data: { refl: 1 } });
  }

  // ------------------------------------------------------------------------------------------ scheduler
  /** Weighted pick from this phase's table (no repeats); 30 % chance of a vanish between attacks in P1-P2. */
  startAttack() {
    this.stop();
    const P = this.phase;
    if (P >= 1 && P <= 2 && this.vanishCd <= 0) {
      this.vanishCd = 3.5;
      if (this.rng.chance(0.3)) { this.lastAttack = 'vanish'; this.gen = this.vanish(); this.wait = 0; return; }
    }
    let pool = this.attacks.filter((a) => WEIGHTS[a.name][P] > 0 && this.usable(a.name));
    const fresh = pool.filter((a) => a.name !== this.lastAttack);
    if (fresh.length) pool = fresh;
    if (!pool.length) { this.idleT = 1; return; }
    this.beginAttack(this.rng.weighted(pool, (a) => WEIGHTS[a.name][P]));
  }
  usable(name) {
    if (name === 'hold_em') return this.holdem.done && this.roulette.done;
    if (name === 'roulette_call') return this.roulette.done && this.holdem.done;
    return true;
  }
  beginAttack(a) {
    this.lastAttack = a.name;
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
    this.clearAttacks();
    this.stunned = 0;
    this.invulnerable = false; this.targetable = true;
    this.contactDamage = this.meta.contactDamage ?? 1;
    this.fade.k = 0; this.fade.dir = 0; this.alphaOverride = undefined;
    if (this.shadow) this.shadow.setAlpha(1);
    this.stop();
    if (this.sprite) this.refreshTint();
  }
  /** Cancel every zone / hazard / telegraph the running attack left behind. */
  clearAttacks() {
    if (this.beams) this.beams.stop();
    if (this.roulette) this.roulette.stop();
    if (this.holdem) this.holdem.clear();
    for (const h of this.haz) if (h && h.cancel) h.cancel();
    this.haz.length = 0;
    for (const l of this.lines) if (l && l.destroy) l.destroy();
    this.lines.length = 0;
    this.spiral.on = false;
  }

  // ------------------------------------------------------------------------------------------ helpers
  track(h) { if (this.lines.length > 14) this.lines.shift(); this.lines.push(h); return h; }
  hazard(h) { if (this.haz.length > 24) this.haz = this.haz.filter((q) => !q.done); this.haz.push(h); return h; }
  /** Locked aim telegraph: the centre line plus the fan edges (0.25 s). */
  aimLines(a, time, spreadDeg = 30) {
    const fx = this.scene.fx, x = this.x, y = this.y;
    this.track(fx.warnLine(x, y, x + Math.cos(a) * 640, y + Math.sin(a) * 640, 34, time, RED));
    for (const sgn of [-1, 1]) {
      const e = a + sgn * spreadDeg * DEG;
      this.track(fx.warnLine(x, y, x + Math.cos(e) * 560, y + Math.sin(e) * 560, 10, time, RED));
    }
  }
  sharksAlive() { let n = 0; for (const e of this.scene.enemies) if (e.alive && e.id === 'card_shark') n++; return n; }
  addSharks(n) {
    const s = this.scene, spots = [{ x: this.x - 250, y: this.y + 150 }, { x: this.x + 250, y: this.y + 150 }, { x: this.x, y: this.y + 250 }];
    for (let i = 0; i < n && this.sharksAlive() < 3; i++) {
      const q = clampRoom(spots[i % 3], 90);
      s.fx.spawn(q.x, q.y);
      spawnEnemy(s, 'card_shark', q.x, q.y, { instant: true, floor: this.floor });
    }
  }
  /** Shark adds + contract seals are removed silently (no loot, no blood) when the fight ends. */
  purgeAdds() {
    for (const e of [...this.scene.enemies]) {
      if (e === this || !e.alive) continue;
      this.scene.fx.deathPuff(e.x, e.y - 10, 1);
      e.alive = false; e.destroy();
    }
    this.seals.length = 0;
  }

  // ------------------------------------------------------------------------------------------ attack: deal_fan
  /** Locked aim line 0.25 s, then a 5-card fan (60 deg, speed 340). */
  *fanVolley() {
    const a = this.angleToPlayer();
    this.aimLines(a, 0.25);
    this.setPose('windup');
    yield 0.25;
    this.setPose('attack');
    this.scene.bullets.enemy.fan({ x: this.x + Math.cos(a) * 46, y: this.y + Math.sin(a) * 46, speed: 340, damage: 1, kind: 'card', radius: 12, life: 3.2, owner: this }, 5, 60, a);
    Sfx.play('card_flip', { vol: 0.7, gap: 0.05 });
  }
  *atkFan() {
    const volleys = this.phase === 2 ? 3 : 2;
    this.setPose('windup'); this.pulse(0.35);
    yield 0.35; // windup 0.6 s in all (0.35 + the 0.25 s aim line)
    for (let v = 0; v < volleys; v++) {
      yield* this.fanVolley();
      if (v < volleys - 1) yield 0.35; // volleys 0.6 s apart
    }
    yield 0.4;
    this.setPose('move');
  }

  // ------------------------------------------------------------------------------------------ attack: card_ring
  *atkRing() {
    const fast = this.phase >= 2, rings = fast ? 4 : 3, speed = fast ? 290 : 250, B = this.scene.bullets.enemy;
    this.setPose('windup'); this.pulse(1.0);
    this.track(this.scene.fx.warnCircle(this.x, this.y, 280, 1.0, RED));
    Sfx.play('card_shuffle', { vol: 0.8 });
    yield 1.0;
    this.setPose('attack');
    for (let i = 0; i < rings; i++) {
      B.ring({ x: this.x, y: this.y, speed, damage: 1, kind: 'card', radius: 12, life: 3.4, owner: this }, 14, i * 12);
      Sfx.play('card_flip', { vol: 0.7, gap: 0.05 });
      this.scene.fx.ringPulse(this.x, this.y - 40, BONE, 90, 380, 0.6);
      if (i < rings - 1) yield 0.55;
    }
    yield 0.5;
    this.setPose('move');
  }

  // ------------------------------------------------------------------------------------------ attack: chip_toss
  *atkChips() {
    const p = this.player, rng = this.rng;
    this.atkFrame(3); this.pulse(0.5);
    yield 0.5;
    for (let i = 0; i < 5; i++) {
      let q;
      if (i === 0) q = { x: p.x, y: p.y };
      else { const a = rng.float(0, TAU), d = rng.float(70, 220); q = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }; }
      this.chip(clampRoom(q, 70));
      Sfx.play('chip_clatter', { vol: 0.5, gap: 0.08 });
      if (i < 4) yield 0.25;
    }
    this.setPose('move');
    yield 1.2;
  }
  /** One chip: 1.0 s marker r 70, falls in the last 0.3 s, lands for 1 dmg and throws 6 shards (speed 240). */
  chip(q) {
    this.hazard(GroundHaz.of(this.scene).circle({
      x: q.x, y: q.y, r: 70, tell: 1.0, active: 0.25, dmg: 1, kind: 'chip', source: SRC,
      fall: (sc) => this.chipSprite(sc), fallDur: 0.3, fallHeight: 380, fallLift: 20, sfx: 'chip_clatter', burstColors: [GOLD, BONE, RED], decal: false, shake: false,
      onLand: (h) => {
        const a0 = this.rng.float(0, TAU);
        this.scene.bullets.enemy.ring({ x: h.x, y: h.y, speed: 240, damage: 1, kind: 'shard', radius: 11, life: 2.4, owner: this }, 6, a0 / DEG);
      },
    }));
  }
  chipSprite(sc) {
    if (hasCell('projectiles_c2', 'bullet_chip')) return Assets.makeCell(sc, 0, 0, 'projectiles_c2', 'bullet_chip', 0.5).setScale(1.7);
    return sc.add.image(0, 0, 'scratch_seal').setScale(0.4).setTint(GOLD);
  }

  // ------------------------------------------------------------------------------------------ attack: roulette_call
  *atkRoulette() {
    const zone = this.roulette;
    let col = this.rng.chance(0.5) ? 'r' : 'k';
    if (col === this.lastCol) col = col === 'r' ? 'k' : 'r'; // never the same colour twice in a row
    if (!zone.hasCol(col)) col = col === 'r' ? 'k' : 'r';
    if (!zone.hasCol(col)) return;
    this.lastCol = col;
    this.atkFrame(2); this.pulse(0.8);
    Sfx.play('card_shuffle', { vol: 0.8 });
    yield 0.8;
    zone.call(col);
    yield 0.4;
    yield* this.fanVolley(); // one deal_fan volley while the tiles flicker
    this.setPose('move');
    let fs = 0;
    yield () => { fs += this.dtLast; return zone.done || fs > 4; };
    yield 0.3;
  }

  // ------------------------------------------------------------------------------------------ attack: chandelier_rain
  *atkChandelier() {
    const room = this.scene.room, p = this.player, n = this.phase === 2 ? 4 : 3, rng = this.rng;
    this.atkFrame(2); this.pulse(0.6);
    Sfx.play('chandelier_creak', { vol: 0.8 });
    yield 0.6;
    if (!room) return;
    for (let i = 0; i < n; i++) {
      const q = { x: p.x, y: p.y };
      if (i > 0) { // predicted: player position + move direction x 150 px (a stationary player gets the floor hazard's 0-90 px scatter)
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 30) { q.x += (p.vx / sp) * 150; q.y += (p.vy / sp) * 150; }
        else { const a = rng.float(0, TAU), d = rng.float(0, 90); q.x += Math.cos(a) * d; q.y += Math.sin(a) * d; }
      }
      clampRoom(q, 50);
      this.hazard(Hazards.chandelier(room, q.x, q.y));
      Sfx.play('chandelier_creak', { vol: 0.9, gap: 0.1 });
      if (i < n - 1) yield 0.7;
    }
    this.setPose('move');
    yield 1.5;
  }

  // ------------------------------------------------------------------------------------------ attack: royal_flush
  *atkFlush() {
    const devil = this.phase >= 2, n = devil ? 7 : 5, gap = (devil ? 20 : 25) * DEG, a = this.angleToPlayer(), dir = this.rng.sign();
    const angles = [], rates = [];
    for (let i = 0; i < n; i++) {
      angles.push(a + (i - (n - 1) / 2) * gap);
      rates.push((devil ? Math.sign(i - (n - 1) / 2) : dir) * 40 * DEG); // P2: the two halves rotate in opposite directions (the fan opens around the still centre beam; strictly alternating beams cross every 0.25 s and leave no readable gap)
    }
    this.setPose('windup'); this.pulse(0.9);
    Sfx.play('card_shuffle', { vol: 0.7, rate: 1.3 });
    this.beams.start({ ox: this.x, oy: this.y - 10, angles, rates, w: devil ? 48 : 56, tell: 0.9, active: 1.6, dmg: 1, tick: 0.5 });
    yield 0.9;
    this.setPose('attack');
    let fs = 0;
    yield () => { fs += this.dtLast; return this.beams.done || fs > 3; };
    this.setPose('move');
    yield 0.4;
  }

  // ------------------------------------------------------------------------------------------ attack: hold_em
  *atkHoldEm() {
    const p = this.player, rng = this.rng;
    this.atkFrame(0); this.pulse(0.6);
    Sfx.play('card_shuffle', { vol: 0.8 });
    yield 0.6;
    const quads = rng.shuffle([0, 1, 2, 3]).slice(0, 2), suits = rng.shuffle([...SUITS]).slice(0, 2), spots = [];
    for (const q of quads) {
      const x0 = (q & 1) ? ROOM.cx + 90 : ROOM.x + 110, x1 = (q & 1) ? ROOM.right - 110 : ROOM.cx - 90;
      const y0 = (q & 2) ? ROOM.cy + 40 : ROOM.y + 100, y1 = (q & 2) ? ROOM.bottom - 90 : ROOM.cy - 40;
      let pt = { x: 0, y: 0 };
      for (let tries = 0; tries < 10; tries++) {
        pt = { x: rng.float(x0, x1), y: rng.float(y0, y1) };
        if (Math.hypot(pt.x - p.x, pt.y - p.y) > 150 && Math.hypot(pt.x - this.x, pt.y - this.y) > 150) break;
      }
      spots.push(pt);
    }
    this.holdem.start(spots, suits);
    this.setPose('move');
    let fs = 0;
    yield () => { fs += this.dtLast; return this.holdem.done || fs > 8; }; // he stands quiet while the cards work (a damage window)
    yield 0.4;
  }

  // ------------------------------------------------------------------------------------------ attack: hellfire_spiral
  *atkSpiral() {
    const arms = this.phase >= 3 ? 1 : 3, sp = this.spiral;
    this.atkFrame(1); this.pulse(0.7);
    this.scene.fx.ringPulse(this.x, this.y - 60, 0xff7a2a, 120, 700, 0.8);
    Sfx.play('fire_whoosh', { vol: 0.6, rate: 0.8 });
    yield 0.7;
    const a0 = this.rng.float(0, TAU);
    for (let half = 0; half < 2; half++) { // 1.8 s, 0.4 s pause, 1.8 s the other way (4.0 s)
      sp.on = true; sp.t = 0; sp.n = 0; sp.count = 20; sp.arms = arms; sp.speed = 240;
      sp.step = (half ? -11 : 11) * DEG;
      sp.ang = half ? sp.ang : a0;
      yield () => !sp.on;
      if (!half) yield 0.4;
    }
    yield 0.5;
    this.setPose('move');
  }

  // ------------------------------------------------------------------------------------------ attack: brimstone_grid
  *atkGrid() {
    const p = this.player;
    const cx = clamp(tileX(colOf(p.x)), ROOM.x + 270, ROOM.right - 270), cy = clamp(tileY(rowOf(p.y)), ROOM.y + 270, ROOM.bottom - 270); // whole lattice stays in the room
    this.atkFrame(1); this.pulse(1.0);
    Sfx.play('fire_whoosh', { vol: 0.6, rate: 0.7 });
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (((i + j) & 1) === 0) this.eruption(cx + i * 200, cy + j * 200, 1.0); // A: corners + centre
    yield 1.0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i + j) & 1) this.eruption(cx + i * 200, cy + j * 200, 0.8); // B: the four edges
    yield 1.3;
    this.setPose('move');
  }
  eruption(x, y, tell) {
    const q = clampRoom({ x, y }, 78);
    this.hazard(GroundHaz.of(this.scene).circle({
      x: q.x, y: q.y, r: 70, tell, active: 0.25, dmg: 1, kind: 'fire', source: SRC, sfx: 'vent_erupt', burstColors: [0xff9a2a, 0xd63a2a, 0xffd060],
      fire: { r: 70, dur: 2.0, team: 'enemy', tag: 'scratch_grid', maxTag: 5 }, shake: false,
    }));
  }

  // ------------------------------------------------------------------------------------------ vanish
  *vanish() {
    const p = this.player, rng = this.rng, fx = this.scene.fx;
    this.invulnerable = true; this.contactDamage = 0;
    fx.burst(this.x, this.y - 90, { color: [0x2a2320, 0x6a5a58, 0xd63a2a], count: 16, speed: [40, 200], life: [400, 700], scale: [2, 4], gravity: -40 });
    Sfx.play('card_shuffle', { vol: 0.7, rate: 1.4 });
    this.fade.dir = 1;
    yield 0.25;
    let best = null;
    const far = SPOTS.filter((q) => Math.hypot(q.x - this.x, q.y - this.y) > 40 && Math.hypot(q.x - p.x, q.y - p.y) >= 300);
    if (far.length) best = rng.pick(far);
    else { let bd = -1; for (const q of SPOTS) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d > bd) { bd = d; best = q; } } }
    this.x = best.x; this.y = best.y;
    this.syncVisual();
    fx.burst(this.x, this.y - 90, { color: [0x2a2320, 0x6a5a58, 0xd63a2a], count: 16, speed: [40, 200], life: [400, 700], scale: [2, 4], gravity: -40 });
    this.fade.dir = -1;
    yield 0.25;
    this.invulnerable = false; this.contactDamage = this.meta.contactDamage ?? 1;
    this.setPose('move');
  }

  // ------------------------------------------------------------------------------------------ phase changes
  /** Common roar: cancel everything, clear bullets, untouchable for a moment, arms wide. */
  roar(n, shake = 0.012) {
    const s = this.scene;
    this.invulnerable = true;
    s.bullets.enemy.clear();
    this.atkFrame(2); this.pulse(1.0);
    s.fx.shake(shake, 500);
    s.fx.flash(RED, 0.35);
    s.fx.ringPulse(this.x, this.y - 60, RED, 200, 600, 0.8);
    this.bark(BARKS[n]);
  }

  /** P1: the tuxedo tears, two card sharks sit down at the table. */
  *raise() {
    const fx = this.scene.fx;
    this.roar(1);
    fx.burst(this.x, this.y - 100, { color: [0x1a1418, 0x2a2320, 0xd4a537], count: 30, speed: [120, 420], life: [500, 1000], scale: [2, 4], gravity: 300 });
    cardBurst(this.scene, this.x, this.y - 40, this.rng, 10);
    Sfx.play('card_shuffle', { vol: 0.9 });
    yield 1.2;
    this.invulnerable = false;
    if (this.sharkAt < 0) { this.sharkAt = 0; this.addSharks(2); }
    this.setPose('windup');
    yield 0.4;
    this.setPose('move');
  }

  /** P2: 2.2 s transformation into the true form; four permanent fire patches in the corners. */
  *transform() {
    const fx = this.scene.fx;
    this.roar(2, 0.018);
    Sfx.play('devil_laugh', { vol: 1, rate: 0.85, gap: 0 });
    yield 1.0;
    this.swapForm(true);
    fx.flash(0xffffff, 0.8);
    fx.shake(0.03, 600);
    fx.explosion(this.x, this.y - 60, 220);
    fx.burst(this.x, this.y - 100, { color: [0xff9a2a, 0xd63a2a, 0xffd060], count: 40, speed: [100, 460], life: [500, 1100], scale: [2, 4], gravity: -60, blend: 'ADD' });
    this.atkFrame(2); this.pulse(1.2);
    this.cornersOn = true; this.cornerT = 0;
    this.cornerFires();
    yield 1.2;
    this.invulnerable = false;
    this.setPose('move');
  }

  /** P3: the contract is raised (parchment on the floor centre), three seals orbit him. Also re-used when the seals return (45 HP). */
  *raiseContract(first) {
    const s = this.scene;
    if (this.formKey !== FORMS.devil.key) this.swapForm(true); // a phase skipped by one huge hit still ends in the true form
    if (!this.cornersOn) { this.cornersOn = true; this.cornerT = 0; this.cornerFires(); }
    this.contractUp = true;
    this.sealHp = first ? SEAL.hp : SEAL.hpBack;
    s.bullets.enemy.clear();
    this.atkFrame(3); this.pulse(0.8);
    this.paper.show();
    Sfx.play('page_flip', { vol: 0.9 });
    if (first) { this.bark(BARKS[3]); s.fx.text(this.x, Math.max(172, this.y - 205) + 34, 'Page nine. Do read along.', { size: 26, color: '#e8dcc0', time: 1800, rise: 12, delay: 500 }); }
    s.fx.shake(0.008, 400);
    this.spawnSeals();
    yield 0.9;
    this.setPose('move');
  }
  spawnSeals() {
    const s = this.scene;
    for (const sl of this.seals) if (sl.alive) { sl.alive = false; sl.destroy(); }
    this.seals.length = 0;
    for (let i = 0; i < 3; i++) this.seals.push(new ContractSeal(s, this.x, this.y, { boss: this, index: i, count: 3, hp: this.sealHp }));
    s.fx.ringPulse(this.x, this.y - 60, GOLD, SEAL.r + 30, 500, 0.8);
  }
  /** A seal died: with all three gone the contract tears. */
  sealDown(seal) {
    const i = this.seals.indexOf(seal);
    if (i >= 0) this.seals.splice(i, 1);
    if (!this.seals.length && this.contractUp && !this.dying && this.alive) this.interrupt(this.tear());
  }
  /** Contract torn: stunned 7.0 s (x1.5 damage), then the contract is raised again with 45 HP seals. */
  *tear() {
    const s = this.scene, fx = s.fx;
    this.contractUp = false;
    this.stunned = 7.0;
    this.paper.tear();
    Sfx.play('contract_tear', { vol: 1, gap: 0 });
    fx.flash(GOLD, 0.5); fx.shake(0.02, 400); fx.hitStop(60);
    s.bullets.enemy.clear();
    fx.burst(this.x, this.y - 100, { color: [BONE, GOLD, RED], count: 30, speed: [100, 400], life: [500, 1000], scale: [2, 4], gravity: 200 });
    fx.text(this.x, Math.max(172, this.y - 205), 'STUNNED', { size: 30, color: '#ffe070', time: 1400, rise: 26 });
    this.atkFrame(2);
    yield 0.6;
    this.setPose('move');
    yield () => this.stunned <= 0;
    if (this.alive && !this.dying) yield* this.raiseContract(false);
  }

  // ------------------------------------------------------------------------------------------ death (finale)
  die(info = {}) {
    if (!this.alive || this.dying) return;
    const s = this.scene, fx = s.fx, run = s.run;
    const clean = !!(run && run.trueEligible); // Hell with no deals: he does not die, he kneels (Sixth Bullet finale)
    this.trueEnding = clean;
    this.clearAttacks();
    this.cornersOn = false;
    this.contractUp = false;
    this.purgeAdds();
    this.dying = true; this.invulnerable = true; this.active = false; this.gen = null; this.contactDamage = 0; this.targetable = false; this.stunned = 0;
    this.stop();
    this.fade.k = 0; this.fade.dir = 0; this.alphaOverride = undefined;
    if (!clean) { const i = s.enemies.indexOf(this); if (i >= 0) s.enemies.splice(i, 1); } // the kneeling boss stays listed: ending.js trueFinale reuses his sprite
    s.bullets.enemy.clear();
    GroundHaz.of(s).clear();
    const hz = s.room && s.room._hz;
    if (hz) { if (hz.fires) hz.fires.clear(); if (hz.stop) hz.stop(); }
    bus.emit('boss:hp', { hp: 0, maxHp: this.maxHp, boss: this });
    if (s.player) s.player.setEntryInvuln(60); // nothing may hurt the rider during the finale
    Music.stop(1000);
    fx.hitStop(140); fx.flash(0xffffff, 0.4); fx.shake(0.015, 500);
    this.pulse(0.5);
    if (clean) { this.dieKneel(); return; }
    Sfx.play('devil_laugh', { vol: 1, rate: 0.8, gap: 0 });
    s.slowMo(0.35, 2.5);
    this.atkFrame(2);
    if (!this.paper.visible) this.paper.show();
    const burst = () => { if (this.sprite) cardBurst(s, this.x, this.y - 60, this.rng, 18); };
    burst();
    s.time.delayedCall(700, burst);
    s.time.delayedCall(1400, burst);
    s.time.delayedCall(500, () => this.paper.burn(2000)); // the contract burns where it lies
    let n = 0;
    s.time.addEvent({
      delay: 160, repeat: 13,
      callback: () => {
        if (!this.sprite) return;
        n++;
        this.sprite.setTint(n % 2 ? 0xffffff : 0xff6a4a);
        fx.burst(this.x + (this.rng.next() - 0.5) * this.radius * 1.6, this.y - 30 - this.rng.next() * 190, { color: [0xff9a2a, 0xffd060, 0xd63a2a], count: 6, speed: [40, 200], life: [400, 800], scale: [1.5, 3], gravity: -60, blend: 'ADD' });
        if (n % 4 === 0) fx.shake(0.01, 160);
      },
    });
    s.time.delayedCall(2600, () => this.finishDeath(info));
  }

  /** True-eligible finale: one knee down, the contract page lifts and fades (ending.js draws the hovering page itself); no explosion, no fade (STORY 6.6). */
  dieKneel() {
    const s = this.scene;
    this.kneel = true; this.keepStage = true;
    this.atkFrame(1);
    this.footOffset = this.form.foot + 10;
    this.sprite.setScale(this.baseScale * 1.02, this.baseScale * 0.9).clearTint();
    this.syncVisual();
    this.paper.show();
    s.time.delayedCall(700, () => { if (this.paper && this.paper.visible) this.paper.hover(); });
    s.time.delayedCall(1450, () => { if (this.paper) this.paper.hide(); });
    s.slowMo(0.5, 1.4);
    s.time.delayedCall(1700, () => this.finishDeath({}));
  }

  finishDeath() {
    const s = this.scene, home = this.homeRoom;
    if (!this.sprite || (home && (home.destroyed || s.room !== home))) { this.destroy(); return; } // room was left / torn down mid-death
    const x = this.x, y = this.y;
    if (this.trueEnding) this.disposeZones(true); // stays alive + listed with his sprite: the finale kneels on it
    else {
      this.alive = false;
      s.fx.flash(0xffffff, 0.5);
      cardBurst(s, x, y - 60, this.rng, 30);
      s.tweens.add({ targets: this.sprite, alpha: 0, duration: 700, ease: 'Quad.easeIn', onComplete: () => { if (this.sprite) this.destroy(); } });
      if (this.shadow) s.tweens.add({ targets: this.shadow, alpha: 0, duration: 700 });
    }
    bus.emit('enemy:died', { enemy: this, x, y, cursed: false, boss: true });
    bus.emit('boss:defeated', { boss: this, id: this.id, floor: this.floor, fightTime: this.fightT });
    if (s.run) s.run.bossesKilled++;
    s.onBossDefeated(this);
  }

  disposeZones(paper = true) {
    this.clearAttacks();
    for (const z of [this.beams, this.roulette, this.holdem]) if (z) z.destroy();
    this.beams = this.roulette = this.holdem = null;
    if (paper && this.paper) this.paper.destroy();
    if (paper) this.paper = null;
    for (const sl of this.seals) if (sl && sl.alive) { sl.alive = false; sl.destroy(); }
    this.seals.length = 0;
  }

  destroy() {
    this.disposeZones(!this.keepStage);
    super.destroy();
  }
}

registerBoss('scratch', Scratch, {
  hp: 1500, r: 62, foot: 50, scale: 0.85, hitR: 70, speed: 0, name: "OL' SCRATCH", title: 'The House Always Wins', music: 'boss6', final: true,
  barks: BARKS,
});
