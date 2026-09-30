// Elite affixes (EVENTS 5, ARCH D3 / s9). Eight affixes make a plain enemy an "elite": ring + tint + glyph + nameplate (all code-drawn) and one
// exact rule each. This file has two halves:
//
//  * rules (pure, node-importable):  Affixes.roll / rollWave / chance / eligible, the AFFIXES table and AFFIX_NUM (every number in one place).
//  * behaviour (browser):            Affixes.apply / update / onDamage / onDeath / cleanup, called from Enemy.js at the call sites listed in
//                                    INTEGRATION_REQUESTS ("[FN-5] [FN-4]"): apply at the end of the ctor, update before ai(), onDamage first thing
//                                    in hurt(), onDeath after dropLoot(), cleanup in destroy().
//
// Elite chance per spawned wave enemy (D3):  min(cap, VARIETY.elite.chance[floor] * diff.eliteMult * (curse_rot ? 2 : 1) * (1 + 1.5 * curseHunted)).
// Limits: `maxPerRoom` (2 on floors 1-3, 3 on 4-6), at least one plain enemy per room, no elites on bosses / minis / crow / tumbleweed_mini /
// duelist / chain-gang links / contract seals / adds (those never pass through rollWave). `meta.affixBan` lists banned affixes per enemy.
// Second affix (floors 5-6, 25 %): distinct, never armored+shielded, never two hp-multiplying affixes, never splitting+volatile.
import { VARIETY, DEPTH, FONT_BODY, eliteChance, eliteMaxPerRoom } from '../config.js';
import { enemyMeta } from './registry.js';
import { rng as gameRng } from '../core/rng.js';
import { deps, emit, sfx } from '../systems/Boons.js';

// ---------------------------------------------------------------------------------------------------------- numbers (EVENTS 5.2)
export const AFFIX_NUM = {
  armored: { hp: 1.25, bullet: 0.6, other: 0.85, speed: 0.9 },
  swift: { speed: 1.4, ai: 1.2, trailEvery: 0.1 },
  volatile: { fuse: 0.6, radius: 130, playerDmg: 1, enemyDmg: 40, fires: 2, fireR: 55, fireLife: 2.5 },
  shielded: { shield: 0.35 },
  splitting: { hp: 0.4, scale: 0.7, count: 2, spread: 34 },
  burning: { every: 0.5, r: 40, life: 2.0, deathR: 70, deathLife: 3.0 },
  vampiric: { heal: 0.3, cd: 1.0 },
  cursed: { hp: 1.5 },
  secondAffixPairs: [['armored', 'shielded'], ['splitting', 'volatile']],
  guaranteedPickupBonus: 0.8, // room.rollPickup(bonus) on every elite kill
  nameplate: 1.2,
};

/** id, weight, floors [a,b], colours, hpMult (for the forbidden-pair rule), extra drop {type, p}. */
export const AFFIXES = {
  cursed: { id: 'cursed', name: 'CURSED', w: 3, floors: [1, 6], tint: 0xff9a8a, ring: 0xff2a1a, hpMult: 1.5, drop: { type: 'heart_full', p: 1 } },
  armored: { id: 'armored', name: 'ARMORED', w: 2, floors: [1, 6], tint: 0xaab4c4, ring: 0xc8d0dc, hpMult: 1.25, drop: { type: 'heart_tin', p: 0.5 } },
  swift: { id: 'swift', name: 'SWIFT', w: 2, floors: [1, 6], tint: 0xf4f090, ring: 0xffe860, drop: { type: 'coin_nickel', p: 0.5 } },
  volatile: { id: 'volatile', name: 'VOLATILE', w: 2, floors: [2, 6], tint: 0xff8a60, ring: 0xff5a30, drop: { type: 'dynamite', p: 0.35 } },
  shielded: { id: 'shielded', name: 'SHIELDED', w: 2, floors: [2, 6], tint: null, ring: 0x80c0ff, drop: { type: 'heart_tin', p: 0.3 } },
  splitting: { id: 'splitting', name: 'SPLITTING', w: 1.5, floors: [3, 6], tint: 0x80e0c8, ring: 0x50c8a8, drop: { type: 'key', p: 0.2 } },
  burning: { id: 'burning', name: 'BURNING', w: 1.5, floors: [3, 6], tint: 0xff9a40, ring: 0xff7020, drop: { type: 'key', p: 0.15 } },
  vampiric: { id: 'vampiric', name: 'VAMPIRIC', w: 1.5, floors: [4, 6], tint: 0xd06a90, ring: 0xa02050, drop: { type: 'heart_half', p: 0.6 } },
};
export const AFFIX_IDS = Object.keys(AFFIXES);

/** Enemies that never become elites (adds, projectiles-with-legs, scripted fights). */
export const NO_AFFIX = new Set(['crow', 'tumbleweed_mini', 'duelist', 'contract_seal']);

// ---------------------------------------------------------------------------------------------------------- rules (pure)
const metaOf = (id, def) => def || enemyMeta(id) || null;

/** Can this enemy become an elite at all? */
export function eligible(enemyId, def) {
  if (NO_AFFIX.has(enemyId)) return false;
  const m = metaOf(enemyId, def);
  if (m) {
    if (m.noAffix || m.noElite || m.boss || m.mini || m.isBoss || m.link || m.chainLink) return false;
    if (m.affixBan === true || m.affixBan === '*') return false;
  }
  return true;
}
const bannedList = (m) => (m && Array.isArray(m.affixBan) ? m.affixBan : null);

/** Elite chance for one spawn (D3 formula). ctx: {floor, diff, curses[], curseHunted}. */
export function chance(ctx = {}) {
  const floor = ctx.floor || 1;
  const mult = ctx.diff && ctx.diff.eliteMult != null ? ctx.diff.eliteMult : 1;
  const curses = ctx.curses || (ctx.player && ctx.player.curses) || null;
  const rot = curses && curses.includes('curse_rot') ? 2 : 1;
  const hunted = ctx.curseHunted ?? (ctx.player && ctx.player.stats && ctx.player.stats.curseHunted) ?? 0;
  return Math.min(VARIETY.elite.cap, eliteChance(floor) * mult * rot * (1 + 1.5 * hunted));
}

const pairForbidden = (a, b) => {
  if (a === b) return true;
  if (AFFIXES[a].hpMult && AFFIXES[b].hpMult) return true; // cursed + armored (two hp multipliers)
  for (const [x, y] of AFFIX_NUM.secondAffixPairs) if ((a === x && b === y) || (a === y && b === x)) return true;
  return false;
};

/** Weighted affix pick for a floor honouring bans and (optionally) compatibility with `first`. */
function pickAffix(rng, floor, ban, first) {
  let total = 0;
  const cands = [];
  for (const id of AFFIX_IDS) {
    const a = AFFIXES[id];
    if (floor < a.floors[0] || floor > a.floors[1]) continue;
    if (ban && ban.includes(id)) continue;
    if (first && pairForbidden(first, id)) continue;
    cands.push(a);
    total += a.w;
  }
  if (!cands.length) return null;
  let r = rng.next() * total;
  for (const a of cands) { r -= a.w; if (r <= 0) return a.id; }
  return cands[cands.length - 1].id;
}

/**
 * Roll the affixes of ONE spawn. Always consumes exactly one draw for the chance (plus the pick draws when it hits) so the stream stays aligned
 * whatever the caps say.
 * opts: {floor, def, enemyId, diff, curses[], curseHunted, player, counts:{elites, total}, allCursed}
 * Returns string[] (empty = plain).
 */
export function roll(rng, opts = {}) {
  const floor = opts.floor || 1;
  const hit = rng.next() < chance(opts);
  if (!eligible(opts.enemyId, opts.def)) return [];
  const m = metaOf(opts.enemyId, opts.def);
  const ban = bannedList(m);
  if (opts.allCursed) return !ban || !ban.includes('cursed') ? ['cursed'] : [];
  if (!hit) return [];
  const counts = opts.counts;
  if (counts) {
    if (counts.elites >= eliteMaxPerRoom(floor)) return [];
    if (counts.total != null && counts.elites + 1 > counts.total - 1) return []; // one plain enemy always stays
  }
  const first = pickAffix(rng, floor, ban, null);
  if (!first) return [];
  const out = [first];
  const p2 = VARIETY.elite.secondAffix[Math.max(1, Math.min(6, floor))] || 0;
  if (p2 > 0 && rng.next() < p2) {
    const second = pickAffix(rng, floor, ban, first);
    if (second) out.push(second);
  }
  return out;
}

/**
 * Roll a whole encounter. `records` = every spawn record of the room in wave order ({id, x, y, air?}); sets `rec.affixes[]` and `rec.cursed`.
 * ctx: {floor, diff, player|curses, curseHunted, allCursed}. Returns the number of elites.
 */
export function rollWave(rng, records, ctx = {}) {
  const counts = { elites: 0, total: records.length };
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const a = roll(rng, { ...ctx, enemyId: rec.id, counts });
    rec.affixes = a;
    rec.cursed = a.includes('cursed');
    if (a.length) counts.elites++;
  }
  return counts.elites;
}

// ---------------------------------------------------------------------------------------------------------- lazy browser deps
const lazy = { explode: null, spawnEnemy: null };
if (typeof window !== 'undefined') {
  import('../systems/Explosions.js').then((m) => { lazy.explode = m.explode; }).catch(() => {});
  import('./index.js').then((m) => { lazy.spawnEnemy = m.spawnEnemy; }).catch(() => {});
}

// ---------------------------------------------------------------------------------------------------------- glyphs (12 px, Graphics)
const INK = 0x120c0a;
const poly = (cx, cy, n, r, rot = -Math.PI / 2, inner = 0) => {
  const pts = [];
  const steps = inner ? n * 2 : n;
  for (let i = 0; i < steps; i++) {
    const a = rot + (i / steps) * Math.PI * 2;
    const rr = inner && i % 2 ? inner : r;
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return pts;
};
/** Draw the glyph of an affix centred on (0,0) of `g`. */
function drawGlyph(g, id) {
  const a = AFFIXES[id];
  g.clear();
  g.fillStyle(a.ring, 1);
  g.lineStyle(2, INK, 1);
  switch (id) {
    case 'armored': { const p = poly(0, 0, 6, 7, 0); g.fillPoints(p, true); g.strokePoints(p, true); break; }
    case 'swift':
      g.lineStyle(4, INK, 1); g.beginPath(); g.moveTo(-6, -6); g.lineTo(0, 0); g.lineTo(-6, 6); g.moveTo(1, -6); g.lineTo(7, 0); g.lineTo(1, 6); g.strokePath();
      g.lineStyle(2, a.ring, 1); g.beginPath(); g.moveTo(-6, -6); g.lineTo(0, 0); g.lineTo(-6, 6); g.moveTo(1, -6); g.lineTo(7, 0); g.lineTo(1, 6); g.strokePath();
      break;
    case 'volatile': { const p = poly(0, 0, 8, 8, -Math.PI / 2, 3.2); g.fillPoints(p, true); g.strokePoints(p, true); break; }
    case 'shielded': {
      const p = [{ x: -6, y: -6 }, { x: 6, y: -6 }, { x: 6, y: 1 }, { x: 0, y: 8 }, { x: -6, y: 1 }];
      g.fillPoints(p, true); g.strokePoints(p, true); break;
    }
    case 'splitting': g.fillCircle(-4.5, 0, 4); g.strokeCircle(-4.5, 0, 4); g.fillCircle(4.5, 0, 4); g.strokeCircle(4.5, 0, 4); break;
    case 'burning': {
      const p = [{ x: 0, y: -8 }, { x: 4, y: -2 }, { x: 6, y: 3 }, { x: 3, y: 7 }, { x: -3, y: 7 }, { x: -6, y: 3 }, { x: -3, y: -1 }, { x: -2, y: -4 }];
      g.fillPoints(p, true); g.strokePoints(p, true); break;
    }
    case 'vampiric': {
      const p = [{ x: 0, y: -8 }, { x: 5, y: 1 }, { x: 4, y: 5 }, { x: 0, y: 7 }, { x: -4, y: 5 }, { x: -5, y: 1 }];
      g.fillPoints(p, true); g.strokePoints(p, true); break;
    }
    default: // cursed: skull dot
      g.fillCircle(0, 0, 6); g.strokeCircle(0, 0, 6);
      g.fillStyle(INK, 1); g.fillCircle(-2.4, -1, 1.5); g.fillCircle(2.4, -1, 1.5); g.fillRect(-1.5, 2.4, 3, 2);
  }
}

// ---------------------------------------------------------------------------------------------------------- behaviour
const S = (enemy) => enemy._affix;
const anyKey = (o) => { for (const k in o) return true; return false; };
const has = (enemy, id) => !!(enemy.affixes && enemy.affixes.includes(id));
const enemyName = (enemy) => String(enemy.id || 'enemy').replace(/_/g, ' ').toUpperCase();

/** Ground point under an enemy (fire patches, rings). */
const groundY = (e) => e.y + (e.footOffset || 0) * 0.35;

function installVampire(scene) {
  if (scene._affixVamp || !deps.bus) return;
  scene._affixVamp = true;
  deps.bus.scoped(scene, 'player:hurt', (e) => {
    const src = e && e.source;
    if (!src) return;
    const en = src.enemy || (src.bullet && src.bullet.owner);
    if (!en || !en.alive || !en._affix || !en._affix.vamp || en._affix.vampCd > 0) return;
    const st = en._affix;
    st.vampCd = AFFIX_NUM.vampiric.cd;
    const heal = en.maxHp * AFFIX_NUM.vampiric.heal;
    en.hp = Math.min(en.maxHp, en.hp + heal);
    scene.fx.text(en.x, en.y - en.radius - 60, 'DRAINED', { size: 18, color: '#d06a90' });
    scene.fx.burst(en.x, en.y - 30, { color: [0xd06a90, 0xa02050], count: 8, speed: [40, 120], life: [300, 500], scale: [1.5, 2.5], angle: [230, 310] });
  });
  scene.events.once('shutdown', () => { scene._affixVamp = false; });
}

export const Affixes = {
  AFFIXES, AFFIX_NUM, roll, rollWave, chance, eligible,

  /** Tint colour an elite sprite should carry when nothing else (flash, status) overrides it; null = none. */
  tintOf(enemy) { const st = S(enemy); return st ? st.tint : null; },

  /** Build hp / speed / visuals from `enemy.affixes`. Called once at the end of the Enemy constructor. */
  apply(enemy) {
    const list = enemy.affixes;
    if (!list || !list.length || enemy._affix) return;
    const scene = enemy.scene;
    const st = enemy._affix = {
      list, tint: null, rings: [], glyphs: [], age: 0, plate: null, plateT: 0,
      shield: 0, shieldMax: 0, bubble: null, bubbleRing: null,
      pulses: list.includes('volatile'), curTint: -1, fireT: AFFIX_NUM.burning.every, vamp: false, vampCd: 0, dripT: 0.4,
      trail: null, trailIdx: 0, trailT: 0, phase: Math.random() * 6.28,
    };
    // numbers
    let hp = 1, spd = 1;
    for (const id of list) {
      if (id === 'cursed') hp *= AFFIX_NUM.cursed.hp;
      else if (id === 'armored') { hp *= AFFIX_NUM.armored.hp; spd *= AFFIX_NUM.armored.speed; }
      else if (id === 'swift') spd *= AFFIX_NUM.swift.speed;
    }
    enemy.maxHp *= hp; enemy.hp = enemy.maxHp;
    enemy.speed *= spd;
    if (has(enemy, 'shielded')) { st.shieldMax = st.shield = enemy.maxHp * AFFIX_NUM.shielded.shield; }
    if (has(enemy, 'vampiric')) st.vamp = true;
    if (has(enemy, 'burning')) {
      enemy.immuneBurn = true;
      const orig = enemy.applyStatus;
      enemy.applyStatus = function applyStatus(name, o) { if (name === 'burn') return; orig.call(this, name, o); };
    }
    // tint: the first affix with a tint wins
    for (const id of list) { if (AFFIXES[id].tint != null) { st.tint = AFFIXES[id].tint; break; } }
    // visuals
    const rr = (enemy.radius * 2.7) / 116; // the generated `ring` texture is 116 px across
    list.forEach((id, i) => {
      const a = AFFIXES[id];
      const k = i === 0 ? 1 : 0.78;
      const img = scene.add.image(enemy.x, groundY(enemy), 'ring').setTint(a.ring).setAlpha(0.7).setScale(rr * k, rr * k * 0.62).setDepth(DEPTH.shadows + 3);
      st.rings.push(img);
      const g = scene.add.graphics().setDepth(DEPTH.fx - 5);
      drawGlyph(g, id);
      st.glyphs.push(g);
    });
    if (has(enemy, 'cursed')) { // the old red aura, now part of the affix
      st.aura = scene.add.image(enemy.x, enemy.y, 'glow').setTint(0xff2a1a).setBlendMode('ADD').setDepth(DEPTH.shadows + 4).setAlpha(0.5);
      st.aura.setScale((enemy.radius * 4.2) / 128);
    }
    if (st.shield > 0) {
      const d = enemy.radius * 3;
      st.bubble = scene.add.image(enemy.x, enemy.y, 'disc').setTint(0x80c0ff).setAlpha(0.16).setBlendMode('ADD').setDepth(DEPTH.fx - 6).setDisplaySize(d, d);
      st.bubbleRing = scene.add.image(enemy.x, enemy.y, 'ring').setTint(0x80c0ff).setAlpha(0.6).setBlendMode('ADD').setDepth(DEPTH.fx - 6).setDisplaySize(d, d);
    }
    if (has(enemy, 'swift') && enemy.sprite) {
      st.trail = [];
      for (let i = 0; i < 3; i++) st.trail.push({ img: scene.add.image(0, 0, enemy.sprite.texture.key, 0).setVisible(false).setTintFill(AFFIXES.swift.ring), life: 0 });
    }
    // nameplate: `ARMORED COYOTE`, 1.2 s
    const title = `${list.map((id) => AFFIXES[id].name).join(' ')} ${enemyName(enemy)}`;
    st.plate = scene.add.text(enemy.x, enemy.y - enemy.radius * 2 - 46, title, { fontFamily: FONT_BODY, fontSize: '20px', color: '#e8dcc0', stroke: '#120c0a', strokeThickness: 5 })
      .setOrigin(0.5).setDepth(DEPTH.fx + 12);
    st.plateT = AFFIX_NUM.nameplate;
    // sting once per room + events
    const room = scene.room;
    if (room && !room._eliteSting) { room._eliteSting = true; sfx('elite_spawn'); }
    if (list.includes('vampiric')) installVampire(scene);
    if (enemy.refreshTint) enemy.refreshTint();
    emit('elite:spawned', { enemy, affixes: list });
    this.update(enemy, 0); // place everything immediately
  },

  /** Per frame, before ai(): visuals, swift timing, burning trail, vampiric cooldown. */
  update(enemy, dt) {
    const st = S(enemy);
    if (!st) return;
    st.age += dt;
    const sp = enemy.sprite;
    const gy = groundY(enemy);
    const pulse = 0.5 + 0.5 * Math.sin(st.age * 2.2 + st.phase);
    // rings + glyphs
    for (let i = 0; i < st.rings.length; i++) {
      const r = st.rings[i];
      r.setPosition(enemy.x, gy).setRotation(st.age * (i ? -0.6 : 0.5)).setAlpha(0.55 + pulse * 0.2);
    }
    const headY = (sp ? enemy.footY - (enemy.airHeight || 0) - sp.displayHeight : enemy.y - enemy.radius * 2) - 16;
    const n = st.glyphs.length;
    for (let i = 0; i < n; i++) st.glyphs[i].setPosition(enemy.x + (i - (n - 1) / 2) * 20, headY);
    if (st.aura) st.aura.setPosition(enemy.x, enemy.footY - 24).setAlpha(0.45 + pulse * 0.15);
    if (st.plate) {
      st.plateT -= dt;
      if (st.plateT <= 0) { st.plate.destroy(); st.plate = null; }
      else st.plate.setPosition(enemy.x, headY - 20).setAlpha(Math.min(1, st.plateT / 0.35));
    }
    if (st.bubble) {
      const k = st.shield / st.shieldMax;
      st.bubble.setPosition(enemy.x, enemy.y - 12).setAlpha(0.1 + k * 0.1);
      st.bubbleRing.setPosition(enemy.x, enemy.y - 12).setAlpha(0.3 + k * 0.3);
    }
    // keep the affix tint (Enemy.refreshTint clears it after a hit flash / status): only when nothing else is tinting the sprite
    if (sp && st.tint != null && !(enemy.flashT > 0) && !(enemy.pulseT > 0) && !anyKey(enemy.status)) {
      const want = st.pulses && pulse > 0.5 ? 0xffb090 : st.tint; // volatile pulses orange
      if (st.curTint !== want || !sp.isTinted) { sp.setTint(want); st.curTint = want; }
    }
    // swift: cooldowns 20 % shorter, but never inside a telegraph (windup pose / pulse) so every windup keeps its full length
    if (has(enemy, 'swift')) {
      enemy.aiScale = enemy.pose === 'windup' || enemy.pulseT > 0 ? 1 : AFFIX_NUM.swift.ai;
      if (st.trail && sp && enemy.spawnT <= 0 && (Math.abs(enemy.vx) + Math.abs(enemy.vy)) > 40) {
        st.trailT -= dt;
        if (st.trailT <= 0) {
          st.trailT = AFFIX_NUM.swift.trailEvery;
          const t = st.trail[st.trailIdx];
          st.trailIdx = (st.trailIdx + 1) % st.trail.length;
          t.img.setTexture(sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setScale(sp.scaleX, sp.scaleY).setFlipX(sp.flipX)
            .setPosition(sp.x, sp.y).setDepth(sp.depth - 0.5).setAlpha(0.4).setVisible(true);
          t.life = 0.26;
        }
      }
      if (st.trail) for (let i = 0; i < st.trail.length; i++) {
        const t = st.trail[i];
        if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.img.setVisible(false); else t.img.setAlpha((t.life / 0.26) * 0.4); }
      }
    }
    // burning: a fire patch under it every 0.5 s
    if (has(enemy, 'burning') && dt > 0 && enemy.spawnT <= 0) {
      st.fireT -= dt;
      if (st.fireT <= 0) {
        st.fireT = AFFIX_NUM.burning.every;
        const room = enemy.scene.room;
        if (room && room.addFire) room.addFire(enemy.x, gy, AFFIX_NUM.burning.r, AFFIX_NUM.burning.life, { dmg: 1, team: 'enemy' });
      }
    }
    if (st.vamp) {
      if (st.vampCd > 0) st.vampCd -= dt;
      st.dripT -= dt;
      if (st.dripT <= 0) {
        st.dripT = 0.45;
        enemy.scene.fx.burst(enemy.x + (Math.random() - 0.5) * 20, enemy.y - 34, { color: [0xd06a90, 0xa02050], count: 1, speed: [10, 30], life: [400, 600], scale: [1.5, 2.2], gravity: 220, angle: [80, 100] });
      }
    }
  },

  /**
   * Damage multiplier for an incoming hit (armored, then the shield absorbs). `info.dot` = poison/burn tick, `info.explosion` = blast; anything
   * else counts as a bullet. Returns a multiplier in [0, 1] applied to `dmg`.
   */
  onDamage(enemy, dmg, info = {}) {
    const st = S(enemy);
    if (!st || !(dmg > 0)) return 1;
    let m = 1;
    if (has(enemy, 'armored')) {
      const soft = info.dot || info.explosion;
      m *= soft ? AFFIX_NUM.armored.other : AFFIX_NUM.armored.bullet;
      if (!soft) {
        enemy.scene.fx.spark(info.x ?? enemy.x, (info.y ?? enemy.y) - 24, info.angle ?? Math.random() * 6.28);
        sfx('elite_ting', { vol: 0.7 });
      }
    }
    if (st.shield > 0) {
      const inc = dmg * m;
      const absorbed = Math.min(st.shield, inc);
      st.shield -= absorbed;
      m = (inc - absorbed) / dmg;
      if (st.shield <= 0) this.popShield(enemy);
      else if (st.bubbleRing) enemy.scene.fx.ringPulse(enemy.x, enemy.y - 12, 0x80c0ff, enemy.radius * 1.4, 220, 0.5);
    }
    return m;
  },

  popShield(enemy) {
    const st = S(enemy);
    if (!st || !st.bubble) return;
    const s = enemy.scene;
    s.fx.ringPulse(enemy.x, enemy.y - 12, 0x80c0ff, enemy.radius * 2.4, 360, 0.8);
    s.fx.burst(enemy.x, enemy.y - 20, { color: [0x80c0ff, 0xffffff], count: 12, speed: [80, 220], life: [250, 500], scale: [1.5, 2.5], blend: 'ADD' });
    sfx('glass_break', { vol: 0.6 });
    st.bubble.destroy(); st.bubbleRing.destroy();
    st.bubble = st.bubbleRing = null;
  },

  /** Death rules + elite loot. Called after dropLoot(); silent kills (boss-room cleanup, splits) do nothing. */
  onDeath(enemy, info = {}) {
    const st = S(enemy);
    if (!st) return;
    const scene = enemy.scene, room = scene.room;
    if (info.silent || enemy.noLoot) return;
    // bookkeeping (Room.clearRoom bonus, RunState, Meta)
    if (room && room.state) room.state.eliteKills = (room.state.eliteKills || 0) + 1;
    if (scene.run) scene.run.elitesKilled = (scene.run.elitesKilled || 0) + 1;
    emit('elite:killed', { id: enemy.id, affixes: st.list });
    // loot: one guaranteed pickup + each affix drop
    if (room && room.dropPickup) {
      const type = room.rollPickup ? room.rollPickup(AFFIX_NUM.guaranteedPickupBonus) : 'coin';
      room.dropPickup(type, enemy.x, enemy.y);
      const r = gameRng.game;
      for (const id of st.list) {
        const d = AFFIXES[id].drop;
        if (d && (d.p >= 1 || r.chance(d.p))) room.dropPickup(d.type, enemy.x + r.float(-15, 15), enemy.y + r.float(-15, 15));
      }
    }
    if (has(enemy, 'volatile')) this.detonate(enemy);
    if (has(enemy, 'splitting') && !enemy.noSplit) this.split(enemy);
    if (has(enemy, 'burning') && room && room.addFire) room.addFire(enemy.x, groundY(enemy), AFFIX_NUM.burning.deathR, AFFIX_NUM.burning.deathLife, { dmg: 1, team: 'enemy' });
  },

  /** volatile: 0.6 s warning (pulsing flash + ring), then explosion r130 (player 1 unit, enemies 40, breakables) and 2 fire patches. */
  detonate(enemy) {
    const scene = enemy.scene, room = scene.room;
    const N = AFFIX_NUM.volatile;
    const x = enemy.x, y = enemy.y;
    scene.fx.warnCircle(x, y, N.radius, N.fuse, 0xff5a30);
    const glow = scene.add.image(x, y - 16, 'glow').setTint(0xff7a30).setBlendMode('ADD').setDepth(DEPTH.fx).setAlpha(0.7).setScale(1.2);
    scene.tweens.add({ targets: glow, alpha: { from: 0.25, to: 0.95 }, scale: { from: 0.9, to: 1.8 }, duration: 100, yoyo: true, repeat: 2, onComplete: () => glow.destroy() });
    sfx('elite_pop', { vol: 0.8 });
    scene.time.delayedCall(N.fuse * 1000, () => {
      if (glow.scene) glow.destroy();
      if (scene.room !== room || !room || room.destroyed || !lazy.explode) return; // the player left: nothing to blow up
      lazy.explode(scene, x, y, { radius: N.radius, damage: N.enemyDmg, playerDamage: N.playerDmg, source: { affix: 'volatile' } });
      if (room.addFire) {
        for (let i = 0; i < N.fires; i++) {
          const a = (i / N.fires) * Math.PI * 2 + 0.6;
          room.addFire(x + Math.cos(a) * 46, y + Math.sin(a) * 46, N.fireR, N.fireLife, { dmg: 1, team: 'enemy' });
        }
      }
    });
  },

  /** splitting: two clones at 40 % max hp, scale x0.7, no affix, no drops, cannot split again, no telegraph. */
  split(enemy) {
    const scene = enemy.scene, room = scene.room;
    if (!lazy.spawnEnemy || !room) return;
    const N = AFFIX_NUM.splitting;
    for (let i = 0; i < N.count; i++) {
      const side = i === 0 ? -1 : 1;
      let x = enemy.x + side * N.spread, y = enemy.y;
      if (room.walkableNear && !enemy.flying) ({ x, y } = room.walkableNear(x, y));
      const c = lazy.spawnEnemy(scene, enemy.id, x, y, { floor: enemy.floor, instant: true, affixes: [], noLoot: true, noSplit: true });
      if (!c) continue;
      c.noLoot = true; c.noSplit = true; c.clone = true;
      c.maxHp = c.hp = enemy.maxHp * N.hp;
      c.baseScale = (c.baseScale || 1) * N.scale;
      c.radius *= N.scale; c.hitRadius = (c.hitRadius || c.radius) * N.scale; c.shadowScale *= N.scale;
      if (c.sprite) c.sprite.setScale(c.baseScale);
      c.knock.x = side * 240;
    }
    scene.fx.burst(enemy.x, enemy.y - 24, { color: [0x80e0c8, 0xffffff], count: 12, speed: [80, 220], life: [250, 450], scale: [1.5, 2.5], blend: 'ADD' });
  },

  /** Free every display object (Enemy.destroy). */
  cleanup(enemy) {
    const st = S(enemy);
    if (!st || st.dead) return;
    st.dead = true;
    for (const o of st.rings) o.destroy();
    for (const o of st.glyphs) o.destroy();
    st.rings.length = 0; st.glyphs.length = 0;
    if (st.aura) st.aura.destroy();
    if (st.plate) st.plate.destroy();
    if (st.bubble) st.bubble.destroy();
    if (st.bubbleRing) st.bubbleRing.destroy();
    if (st.trail) for (const t of st.trail) t.img.destroy();
    st.aura = st.plate = st.bubble = st.bubbleRing = st.trail = null;
  },
};
export default Affixes;
