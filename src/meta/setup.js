// Pure run-definition resolver (node-safe). meta/runSetup.js applies the result to a scene; tools/qa/meta-test.mjs tests it.
import { BOUNTY_BY_ID, contractSeed, parseGoal } from './bounties.js';
import { isChar } from '../data/characters.js';
import { MUTATORS, dailyFor, isDateStr, utcDate } from '../data/difficulty.js';

const MODES = ['normal', 'hell', 'daily', 'contract'];

/**
 * Pure: turn the raw start data into the run definition.
 * env = { today: 'YYYY-MM-DD', charOk(id), modeOk(mode), mutators?: string[] }  (charOk / modeOk default to "everything unlocked")
 * -> { char, mode, seed|null, contract, daily, mutators[], items[], maxFloor, custom }
 */
export function resolveSetup(d = {}, env = {}) {
  const today = env.today || utcDate();
  const charOk = env.charOk || (() => true);
  const modeOk = env.modeOk || (() => true);
  let mode = MODES.includes(d.mode) ? d.mode : 'normal';
  const out = { char: 'gunslinger', mode, seed: null, contract: null, daily: null, mutators: [], items: [], maxFloor: 0, custom: false };
  if (mode === 'contract') {
    const b = BOUNTY_BY_ID[d.contract];
    if (b) {
      out.contract = b.id; out.char = b.char; out.items = [...b.items]; out.mutators = [...b.mutators]; out.seed = contractSeed(b.id); out.maxFloor = parseGoal(b.goal).floor;
      return out;
    }
    mode = out.mode = 'normal';
  }
  if (mode === 'daily') {
    const date = isDateStr(d.date) ? d.date : today;
    const day = dailyFor(date);
    out.daily = day; out.char = day.char; out.mutators = [day.mutator]; out.seed = day.seed;
    return out;
  }
  if (mode === 'hell' && !modeOk('hell')) out.mode = 'normal';
  out.char = isChar(d.char) && charOk(d.char) ? d.char : 'gunslinger';
  const custom = Array.isArray(env.mutators) ? env.mutators.filter((m) => MUTATORS[m]) : [];
  if (custom.length) { out.mutators = custom; out.custom = true; }
  return out;
}
