// Condition grammar shared by achievements, lore and unlock rules (CHARACTERS_META B3). Pure (node-safe).
//   term := L.<stat> op N|L.<stat> | R.<stat> op N | E <evt>{k op v,...} | EC <evt>{...} xN | M.<char|all>.<mark>      (terms joined by '&', suffix '@end')
//   op   := >= <= > < =
// compileCond(src, {strict}) rewrites event names through the D4 alias table and returns
//   { src, stats:Set<'L.x'|'R.x'|'M'>, events:Set<name>, ec:{name,filters,n}|null, endOnly, test(ctx) }
// ctx = { save, run, player, evt: {name, p}|null, prog, totals:{items}, derive(path) }. Unknown stat/event names throw only when strict (tests).

/** ARCH_V2 D4: alias -> canonical bus name. */
export const EVENT_ALIAS = {
  'crossroads:deal': 'deal:signed',
  'crossroads:refused': 'deal:refused',
  'event:resolved': 'event:done',
  'miniboss:defeated': 'mini:defeated',
};
export const canonEvent = (n) => EVENT_ALIAS[n] || n;

/** Every bus event the Meta engine understands (input and its own outputs). */
export const KNOWN_EVENTS = new Set([
  'run:started', 'run:ended', 'game:ending', 'story:cutscene', 'story:trueFinale', 'floor:changed', 'room:entered', 'room:cleared', 'room:wave',
  'enemy:spawned', 'enemy:died', 'boss:intro', 'boss:spawned', 'boss:defeated', 'boss:phase', 'deal:signed', 'deal:refused', 'deal:paid',
  'event:started', 'event:done', 'mini:spawned', 'mini:defeated', 'elite:spawned', 'elite:killed', 'curse:gained', 'curse:removed', 'blessing:gained',
  'player:fired', 'player:hurt', 'player:rolled', 'player:died', 'player:revived', 'synergy:activated', 'synergy:lost', 'coins:changed',
  'item:picked', 'item:seen', 'pickup:collected', 'shop:bought', 'chest:opened', 'key:used', 'secret:revealed', 'secret:found', 'dynamite:placed', 'explosion',
  'mark:collected', 'meta:unlocked', 'meta:achievement', 'meta:rank', 'codex:discovered', 'bounty:completed', 'daily:finished',
]);

/** Lifetime stat roots (B7) + derived ones. `k.<id>` / `bk.<id>` are open-ended. */
export const LIFETIME_STATS = new Set([
  'runs', 'deaths', 'wins', 'abandons', 'kills', 'playTime', 'bountyEarned', 'coinsCollected', 'coinsSpent', 'keysUsed', 'dynamitePlaced', 'dynamiteKills',
  'shots', 'sixthShots', 'sixthKills', 'deadEyeKills', 'rolls', 'hits', 'damageTaken', 'itemsPicked', 'roomsCleared', 'hitlessRooms', 'secrets', 'shopBuys',
  'chests', 'deals', 'eventsDone', 'minibosses', 'elites', 'floorsDescended', 'marksCollected', 'bountiesDone', 'dailyRuns',
  'itemsFound', 'itemsTotal', 'bestFloor', 'k', 'bk',
]);
/** Run stats readable as R.<name>. */
export const RUN_STATS = new Set([
  'floor', 'kills', 'time', 'tin', 'maxHearts', 'items', 'char', 'mode', 'hitlessStreak', 'coins', 'familiars', 'hits', 'bossHits', 'purchases', 'deals',
  'minibosses', 'elites', 'coinsSpent', 'coinsCollected', 'damageTaken', 'roomsCleared', 'bossesKilled', 'shots',
]);
export const MARKS = ['undertaker', 'final', 'hell'];
const CHAR_IDS = ['gunslinger', 'preacher', 'hunter', 'queen'];

const OPS = ['>=', '<=', '>', '<', '='];
const cmp = (a, op, b) => (op === '>=' ? a >= b : op === '<=' ? a <= b : op === '>' ? a > b : op === '<' ? a < b : a === b);

function splitTerms(src) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of src) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (ch === '&' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function parseFilters(body, src) {
  const out = [];
  if (!body.trim()) return out;
  for (const part of body.split(',')) {
    const m = /^\s*(\w+)\s*(>=|<=|=|<|>)\s*(.+?)\s*$/.exec(part);
    if (!m) throw new Error(`cond "${src}": bad filter "${part}"`);
    out.push({ k: m[1], op: m[2], v: /^-?\d+(\.\d+)?$/.test(m[3]) ? Number(m[3]) : m[3] });
  }
  return out;
}
/** Payload field lookup: objects resolve to their id/kind (boss instance -> 'cascabel', source -> 'own_dynamite'); booleans become 0/1. */
function field(p, k) {
  let v = p ? p[k] : undefined;
  if (v && typeof v === 'object') v = v.id != null ? v.id : v.kind != null ? v.kind : undefined;
  if (typeof v === 'boolean') v = v ? 1 : 0;
  return v;
}
export function matchFilters(filters, p) {
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i];
    const v = field(p, f.k);
    if (v === undefined) return false;
    if (typeof f.v === 'number') { if (typeof v !== 'number' || !cmp(v, f.op, f.v)) return false; } else if (String(v) !== String(f.v)) return false;
  }
  return true;
}

const parseRhs = (s) => (/^-?\d+(\.\d+)?$/.test(s) ? { num: Number(s) } : null);

export function compileCond(src, { strict = false } = {}) {
  let text = String(src).trim();
  let endOnly = false;
  if (/@end\s*$/.test(text)) { endOnly = true; text = text.replace(/\s*@end\s*$/, ''); }
  const terms = [];
  const stats = new Set();
  const events = new Set();
  let ec = null;
  for (let raw of splitTerms(text)) {
    if (/@end$/.test(raw)) { endOnly = true; raw = raw.replace(/\s*@end$/, ''); }
    let m;
    if ((m = /^(L|R)\.([\w.]+)\s*(>=|<=|>|<|=)\s*(\S+)$/.exec(raw))) {
      const [, kind, path, op, rhsRaw] = m;
      const root = path.split('.')[0];
      if (strict) {
        if (kind === 'L' && !LIFETIME_STATS.has(root)) throw new Error(`cond "${src}": unknown lifetime stat ${path}`);
        if (kind === 'R' && !RUN_STATS.has(path)) throw new Error(`cond "${src}": unknown run stat ${path}`);
      }
      let rhs = parseRhs(rhsRaw);
      if (!rhs) {
        const r = /^(L|R)\.([\w.]+)$/.exec(rhsRaw);
        if (!r) throw new Error(`cond "${src}": bad value "${rhsRaw}"`);
        rhs = { kind: r[1], path: r[2] };
        stats.add(`${r[1]}.${r[2]}`);
      }
      stats.add(`${kind}.${path}`);
      terms.push({ t: 'stat', kind, path, op, rhs });
    } else if ((m = /^EC\s+([\w:]+)\{(.*)\}\s*x(\d+)$/.exec(raw))) {
      const name = canonEvent(m[1]);
      if (strict && !KNOWN_EVENTS.has(name)) throw new Error(`cond "${src}": unknown event ${m[1]}`);
      events.add(name);
      ec = { name, filters: parseFilters(m[2], src), n: Number(m[3]) };
      terms.push({ t: 'ec', ec });
    } else if ((m = /^E\s+([\w:]+)\{(.*)\}$/.exec(raw))) {
      const name = canonEvent(m[1]);
      if (strict && !KNOWN_EVENTS.has(name)) throw new Error(`cond "${src}": unknown event ${m[1]}`);
      events.add(name);
      terms.push({ t: 'evt', name, filters: parseFilters(m[2], src) });
    } else if ((m = /^M\.(\w+)\.(\w+)$/.exec(raw))) {
      if (strict && ((m[1] !== 'all' && !CHAR_IDS.includes(m[1])) || !MARKS.includes(m[2]))) throw new Error(`cond "${src}": bad mark ${raw}`);
      stats.add('M');
      terms.push({ t: 'mark', who: m[1], mark: m[2] });
    } else throw new Error(`cond "${src}": cannot parse "${raw}"`);
  }
  if (!terms.length) throw new Error(`cond "${src}": empty`);

  const value = (ctx, kind, path) => {
    if (ctx.derive) { const d = ctx.derive(kind, path); if (d !== undefined) return d; }
    if (kind === 'L') {
      let o = ctx.save.stats;
      for (const p of path.split('.')) { if (o == null || typeof o !== 'object') return 0; o = o[p]; }
      return typeof o === 'number' ? o : 0;
    }
    const r = ctx.run || {};
    const v = r[path];
    return Array.isArray(v) ? v.length : typeof v === 'number' ? v : v == null ? 0 : v;
  };
  const test = (ctx) => {
    for (let i = 0; i < terms.length; i++) {
      const t = terms[i];
      if (t.t === 'stat') {
        const a = value(ctx, t.kind, t.path);
        const b = t.rhs.num !== undefined ? t.rhs.num : value(ctx, t.rhs.kind, t.rhs.path);
        if (typeof a === 'string' ? !(t.op === '=' && a === String(b)) : !cmp(a, t.op, b)) return false;
      } else if (t.t === 'evt') {
        if (!ctx.evt || ctx.evt.name !== t.name || !matchFilters(t.filters, ctx.evt.p)) return false;
      } else if (t.t === 'ec') {
        if (!ctx.evt || ctx.evt.name !== t.ec.name || !matchFilters(t.ec.filters, ctx.evt.p)) return false;
        if ((ctx.prog || 0) < t.ec.n) return false;
      } else if (t.t === 'mark') {
        const chars = ctx.save.chars;
        if (t.who === 'all') { for (const id of CHAR_IDS) if (!(chars[id] && chars[id].marks[t.mark])) return false; } else if (!(chars[t.who] && chars[t.who].marks[t.mark])) return false;
      }
    }
    if (endOnly && !(ctx.evt && ctx.evt.name === 'run:ended')) return false;
    return true;
  };
  return { src, terms, stats, events, ec, endOnly, test };
}

/** Progress [cur, max] for L / EC conditions with a single numeric term (Codex DEEDS bars); null otherwise. */
export function progressOf(cond, ctx) {
  if (cond.terms.length !== 1) return null;
  const t = cond.terms[0];
  if (t.t === 'stat' && t.kind === 'L' && t.rhs.num !== undefined && (t.op === '>=' || t.op === '>')) {
    const cur = ctx.derive && ctx.derive('L', t.path) !== undefined ? ctx.derive('L', t.path) : (() => { let o = ctx.save.stats; for (const p of t.path.split('.')) { if (o == null || typeof o !== 'object') return 0; o = o[p]; } return typeof o === 'number' ? o : 0; })();
    return [Math.min(cur, t.rhs.num), t.rhs.num];
  }
  if (t.t === 'ec') return [Math.min(ctx.prog || 0, t.ec.n), t.ec.n];
  return null;
}
