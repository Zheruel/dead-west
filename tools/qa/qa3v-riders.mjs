// QA-3 v: 4 riders in game (idle/run/fire/roll/hurt) crops. node tools/qa/qa3v-riders.mjs [floor]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { boot } from './qa3v-lib.mjs';
const floor = +(process.argv[2] || 1);
const chars = (process.argv[3] || 'gunslinger,preacher,hunter,queen').split(',');
for (const ch of chars) {
  const g = await boot('?debug=1&seed=17&unlockall=1');
  await g.play(ch);
  await g.api((f) => { const a = window.__dw.api; a.godMode(true); if (f > 1) a.setFloor(f); a.teleport('start'); }, floor);
  await g.wait(3500);
  await g.api(() => { window.__dw.player.teleport(720, 560); });
  const files = [];
  const cap = async (name, pre) => {
    if (pre) await pre();
    await g.wait(220);
    const p = await g.api(() => ({ x: window.__dw.player.x, y: window.__dw.player.y, fr: window.__dw.player.sprite && window.__dw.player.sprite.frame && window.__dw.player.sprite.frame.name, key: window.__dw.player.sprite && window.__dw.player.sprite.texture.key, w: window.__dw.player.sprite && Math.round(window.__dw.player.sprite.displayWidth) }));
    const x = Math.max(0, Math.round(p.x - 110)), y = Math.max(0, Math.round(p.y - 190));
    const f = `art/qa/v2/tmp_r_${ch}_${name}.png`;
    await g.page.screenshot({ path: f, clip: { x, y, width: 220, height: 260 } });
    files.push(f); return `${name}:${p.key}/${p.fr}/${p.w}`;
  };
  const inp = (o) => g.api((o) => window.__dw.api.input(o), o);
  const log = [];
  log.push(await cap('idle', () => inp({ move: { x: 0, y: 0 }, aim: null })));
  log.push(await cap('down', () => inp({ move: { x: 0, y: 1 }, aim: null })));
  log.push(await cap('up', () => inp({ move: { x: 0, y: -1 }, aim: null })));
  log.push(await cap('right', () => inp({ move: { x: 1, y: 0 }, aim: null })));
  await g.api(() => window.__dw.player.teleport(900, 560));
  log.push(await cap('left', () => inp({ move: { x: -1, y: 0 }, aim: null })));
  log.push(await cap('fireR', () => inp({ move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: true })));
  log.push(await cap('fireU', () => inp({ move: { x: 0, y: 0 }, aim: { x: 0, y: -1 }, fire: true })));
  log.push(await cap('fireD', () => inp({ move: { x: 0, y: 0 }, aim: { x: 0, y: 1 }, fire: true })));
  await inp(null);
  await g.api(() => window.__dw.player.teleport(720, 560));
  await g.api(() => window.__dw.api.input({ move: { x: 1, y: 0 }, aim: null }));
  log.push(await cap('roll', () => g.tap('Space', 60)));
  await g.wait(150);
  await g.page.screenshot({ path: `art/qa/v2/tmp_r_${ch}_roll2.png`, clip: { x: 600, y: 370, width: 220, height: 260 } }); files.push(`art/qa/v2/tmp_r_${ch}_roll2.png`);
  await inp(null); await g.wait(600);
  await g.api(() => { window.__dw.player.godMode = false; window.__dw.player.hurtT = 0; window.__dw.player.entryInv = 0; window.__dw.api.hurt(1); });
  log.push(await cap('hurt'));
  await g.api(() => { window.__dw.player.godMode = true; });
  log.push(await cap('idle2', () => g.wait(1500)));
  execFileSync('magick', [...files.slice(0, 7), '+append', `art/qa/v2/tmp_rr1.png`]);
  execFileSync('magick', [...files.slice(7), '+append', `art/qa/v2/tmp_rr2.png`]);
  execFileSync('magick', [`art/qa/v2/tmp_rr1.png`, `art/qa/v2/tmp_rr2.png`, '-append', `art/qa/v2/rider_${ch}_f${floor}.png`]);
  for (const f of [...files, 'art/qa/v2/tmp_rr1.png', 'art/qa/v2/tmp_rr2.png']) try { fs.unlinkSync(f); } catch {}
  console.log(ch, log.join(' | '));
  console.log('errors', g.errors.slice(0, 3));
  await g.close();
}
