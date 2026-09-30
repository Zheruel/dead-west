// Run setup seam between the menu scenes / GameScene and the meta layer (ARCH_V2 s5, CHARACTERS_META A/C/D).
//   applyRunSetup(scene, data)  GameScene.create, after Player + RoomManager exist and before loadFloor: resolves rider / mode / daily / contract /
//                               CONTINUE, seeds the run, sets scene.diff / scene.mutators / scene.mut / scene.setup and tells Meta the run began.
//   scene.setup.applyToPlayer(player)  idempotent: rider skin, start kit, contract items, mutator start values, checkpoint restore.
//   finishRun(scene, payload)   GameScene.endRun after `run:ended` fired: attaches the ledger (`payload.ledger`) for EndScene.
// resolveSetup() (meta/setup.js) is the pure part, node-tested by tools/qa/meta-test.mjs.
import { qs, flag } from '../core/util.js';
import { initSeed } from '../core/rng.js';
import { Save } from '../core/Save.js';
import RunState from '../core/RunState.js';
import { Assets } from '../core/Assets.js';
import { Meta } from './Meta.js';
import { resolveSetup } from './setup.js';
import { CHARACTERS } from '../data/characters.js';
import { getDiff, mutatorFlags } from '../data/difficulty.js';

const cheats = () => flag('debug') || flag('god') || flag('unlockall') || flag('nometa');

/** Apply mutators' start values and the rider's start kit to the player (idempotent; FN-4's Player may already have done the same). */
function applyToPlayer(scene, setup, player) {
  if (!player || player.setupDone === setup) return;
  const c = CHARACTERS[setup.char];
  const flags = scene.mut || mutatorFlags(setup.mutators);
  try {
    player.char = setup.char;
    if (typeof player.setChar === 'function') player.setChar(setup.char);
    else if (c.tint !== 0xffffff && player.sprite && !Assets.has(`${c.skin}_walk_down`)) { player.tint = c.tint; player.sprite.setTint(c.tint); }
    const cp = setup.checkpoint;
    if (cp && typeof player.restore === 'function') {
      player.restore(cp);
    } else {
      if (typeof player.applyStart === 'function') player.applyStart(); // rider kit (coins / keys / dynamite / tin / items), idempotent per rider
      else {
        player.coins = c.start.coins; player.keys = c.start.keys; player.dynamite = c.start.dynamite;
        for (const id of c.start.items) if (!player.items.includes(id)) player.addItem(id);
        player.tin = c.start.tin;
      }
      player.dynamite = Math.max(player.dynamite, flags.startDynamite || 0);
      for (const id of setup.items) if (!player.items.includes(id)) player.addItem(id, { quiet: true });
      player.recomputeStats(true);
      player.hp = player.maxHp;
      player.tin = Math.max(player.tin || 0, flags.startHearts ? flags.startHearts.tin : 0);
    }
    player.setupDone = setup;
  } catch (e) { console.warn('[runSetup] applyToPlayer failed', e); }
}

export function applyRunSetup(scene, data = {}) {
  const meta = Meta;
  const qmut = qs('mut');
  const cp = data.continue ? Save.loadCheckpoint() : null;
  const raw = cp ? { mode: cp.mode, char: cp.char } : { ...data, mode: qs('mode') || data.mode, char: qs('char') || data.char };
  const r = resolveSetup(raw, {
    charOk: (id) => meta.isCharUnlocked(id) || cheats(), modeOk: (m) => meta.isModeUnlocked(m) || cheats(),
    mutators: qmut ? qmut.split(',') : null,
  });
  const run = scene.run || new RunState(scene.seed);
  if (cp) {
    Object.assign(run, RunState.fromJSON(cp.run));
    r.seed = cp.seed; r.mutators = [...(cp.run.mutators || [])]; r.char = cp.char; r.mode = cp.mode;
  }
  if (r.seed != null) { scene.seed = initSeed(r.seed); }
  run.seed = scene.seed;
  run.char = r.char; run.mode = r.mode; run.contractId = r.contract; run.mutators = [...r.mutators]; run.daily = r.daily; run.maxFloor = r.maxFloor;
  scene.run = run;
  scene.diff = getDiff(r.mode, r.daily);
  scene.mutators = run.mutators;
  scene.mut = mutatorFlags(run.mutators);
  scene.setup = { ...r, checkpoint: cp, applyToPlayer: (player) => applyToPlayer(scene, scene.setup, player) };
  const enabled = !cheats() && !r.custom;
  meta.enabled = enabled;
  meta.beginRun({ run, char: r.char, mode: r.mode, seed: run.seed, contract: r.contract, mutators: r.mutators, daily: r.daily, player: scene.player, enabled, resume: !!cp });
  if (scene.player) scene.setup.applyToPlayer(scene.player);
  scene.events.once('shutdown', () => { if (Meta.run === run && Meta._begun === run && !scene.ended) Meta.abandonRun(run); });
  return scene.setup;
}

/** After `run:ended`: hand the ledger to EndScene (payload is mutated in place). */
export function finishRun(scene, payload) {
  const s = Meta.lastSummary || Meta.summary;
  const run = scene.run;
  payload.ledger = {
    summary: s, char: run.char, mode: run.mode, mutators: [...run.mutators], daily: run.daily || null, contract: run.contractId || null,
    hell: run.mode === 'hell' || !!(run.daily && run.daily.hell), enabled: Meta.enabled !== false,
  };
  payload.char = run.char; payload.mode = run.mode;
}

export { resolveSetup };
export default { applyRunSetup, finishRun, resolveSetup };
