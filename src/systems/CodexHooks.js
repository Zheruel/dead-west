// Bus -> Save.codexSeen(kind, id): the single place where the Codex world entries (events, minis, affixes, mods, curses, blessings,
// secrets, potions) are fed. Installed once at boot (never scene-scoped); every handler is wrapped so a save problem can never throw
// into gameplay.
import { bus } from '../core/events.js';
import { Save } from '../core/Save.js';

/** event -> [kind, payload => id | id[] | null] */
export const CODEX_FEEDS = {
  'event:started': ['events', (e) => e && e.id],
  'mini:spawned': ['minis', (e) => e && e.id],
  'mini:defeated': ['minis', (e) => e && e.id],
  'elite:spawned': ['affixes', (e) => e && e.affixes],
  'elite:killed': ['affixes', (e) => e && e.affixes],
  'modifier:entered': ['mods', (e) => e && e.id],
  'curse:gained': ['curses', (e) => e && e.id],
  'blessing:gained': ['blessings', (e) => e && e.id],
  'secret:found': ['secrets', (e) => e && e.variant],
  'supersecret:entered': ['secrets', () => 'supersecret'],
  'potion:drunk': ['potions', (e) => e && (e.effect || e.color)],
};

let installed = false;
let warned = false;

function seen(kind, id) {
  if (id == null || id === '') return;
  const fn = Save.codexSeen;
  if (typeof fn !== 'function') return; // Save v2 (FN-3) not landed: nothing to feed
  fn.call(Save, kind, id);
}

/** Feed one payload. Exported for tests. */
export function feed(kind, ids) {
  try {
    if (Array.isArray(ids)) for (const id of ids) seen(kind, id);
    else seen(kind, ids);
  } catch (e) {
    if (!warned) { warned = true; console.warn('[CodexHooks] feed failed', e); }
  }
}

export const CodexHooks = {
  /** Subscribe once. Safe to call repeatedly. */
  install() {
    if (installed) return;
    installed = true;
    for (const [evt, [kind, pick]] of Object.entries(CODEX_FEEDS)) {
      bus.on(evt, (payload) => {
        let ids = null;
        try { ids = pick(payload); } catch (e) { /* malformed payload */ }
        feed(kind, ids);
      });
    }
  },
  /** Test helper: forget the installation flag (listeners stay). */
  _reset() { installed = false; },
};
export default CodexHooks;
