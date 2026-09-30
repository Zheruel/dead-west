// Run reward ("bounty") and Notoriety maths (CHARACTERS_META B9). Pure. The reward is also the Daily score and the poster REWARD.
/**
 * run: RunState-like {kills, bossesKilled, floor, minibosses, elites, time, damageTaken(units)}. opts: {won, mode}.
 * reward = kills*25 + bosses*500 + (floor-1)*250 + minis*200 + elites*40 + (won ? 3000 + max(0, 2400 - time)*2 : 0) - damage*10, floored at 0, x1.5 Hell.
 */
export function computeReward(run, { won = false, mode = 'normal', hell = false } = {}) {
  const r = run || {};
  let v = (r.kills || 0) * 25 + (r.bossesKilled || 0) * 500 + Math.max(0, (r.floor || 1) - 1) * 250 + (r.minibosses || 0) * 200 + (r.elites || 0) * 40
    - (r.damageTaken || 0) * 10;
  if (won) v += 3000 + Math.max(0, 2400 - (r.time || 0)) * 2;
  v = Math.max(0, v);
  if (mode === 'hell' || hell) v *= 1.5;
  return Math.round(v);
}
/**
 * Notoriety earned by a run: ceil(base reward / 100) * modeMult (Normal 1, Hell 1.5, Daily 1, contract 0). `reward` is the scored value
 * (already x1.5 on Hell); the Hell multiplier is removed first so it is not applied twice.
 */
export function runNp(reward, mode = 'normal', hell = false) {
  if (mode === 'contract') return 0;
  const scored = mode === 'hell' || hell;
  const base = scored ? reward / 1.5 : reward;
  return Math.round(Math.ceil(base / 100) * (mode === 'hell' ? 1.5 : 1));
}
export const CONTRACT_NP = { tin: 100, silver: 200, gold: 400 };
export default computeReward;
