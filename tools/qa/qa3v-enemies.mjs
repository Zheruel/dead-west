// QA-3 v: per-enemy in-game clip strips. node tools/qa/qa3v-enemies.mjs id1,id2,...   -> art/qa/v2/en_<id>.png (12 crops around the enemy over ~5 s) + state log
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { boot } from './qa3v-lib.mjs';
const ids = (process.argv[2] || 'hellhound').split(',');
const CH = { hellhound: 4, hellsteer: 4, cinder_skull: 4, magma_eel: 4, sulfur_preacher: 4, magma_golem: 4, handcar_bandit: 5, signalman: 5, steam_stoker: 5, crate_mimic: 5, rail_rat: 5, chain_gang: 5, card_shark: 6, loaded_die: 6, slot_fiend: 6, waiter_imp: 6, bouncer: 6, joker: 6, duelist: 6, possessed: 4, skeleton: 5, ghost: 5 };
const g = await boot('?debug=1&seed=5&unlockall=1');
await g.play();
let curF = 0;
for (const id of ids) {
  const f = CH[id] || 4;
  if (f !== curF) { await g.api((f) => { const a = window.__dw.api; a.setFloor(f); a.godMode(true); }, f); await g.wait(3500); curF = f; }
  await g.api(() => { const a = window.__dw.api; a.godMode(true); a.teleport('start'); });
  await g.wait(1800); await g.api(() => { window.__dw.api.killAll(); });
  await g.api(() => { window.__dw.player.teleport(420, 620); });
  const sz = await g.api((id) => { const e = window.__dw.api.spawn(id, 900, 480); return e ? { id: e.id } : null; }, id);
  const log = [];
  const crops = [];
  for (let i = 0; i < 12; i++) {
    await g.wait(280);
    const st = await g.api(() => { const e = window.__dw.scene.enemies[0]; if (!e) return null; const fr = e.sprite && e.sprite.frame ? e.sprite.frame.name : null; return { x: e.x, y: e.y, s: e.state, fr, sc: e.sprite && +e.sprite.scaleX.toFixed(2), w: e.sprite && Math.round(e.sprite.displayWidth), h: e.sprite && Math.round(e.sprite.displayHeight), tint: e.sprite && e.sprite.tintTopLeft }; });
    if (!st) { log.push('gone'); break; }
    log.push(`${st.s}/${st.fr}`);
    const x = Math.max(0, Math.min(1440 - 240, Math.round(st.x - 120))), y = Math.max(0, Math.min(960 - 240, Math.round(st.y - 150)));
    const f2 = `art/qa/v2/tmp_${id}_${i}.png`;
    await g.page.screenshot({ path: f2, clip: { x, y, width: 240, height: 240 } });
    crops.push(f2);
    if (i === 0) log.unshift(`size ${st.w}x${st.h} sc ${st.sc}`);
  }
  if (crops.length) {
    execFileSync('magick', [...crops.slice(0, 6), '+append', 'art/qa/v2/tmp_r1.png']);
    if (crops.length > 6) execFileSync('magick', [...crops.slice(6), '+append', 'art/qa/v2/tmp_r2.png']);
    execFileSync('magick', crops.length > 6 ? ['art/qa/v2/tmp_r1.png', 'art/qa/v2/tmp_r2.png', '-append', `art/qa/v2/en_${id}.png`] : ['art/qa/v2/tmp_r1.png', `art/qa/v2/en_${id}.png`]);
    for (const c of crops) fs.unlinkSync(c);
  }
  console.log(id, log.join(' '));
  await g.api(() => { window.__dw.api.killAll(); });
}
console.log('errors', g.errors.slice(0, 5));
await g.close();
