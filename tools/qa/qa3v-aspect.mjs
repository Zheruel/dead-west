// QA-3 v: aspect ratios. node qa3v-aspect.mjs WxH
import { boot } from './qa3v-lib.mjs';
const [w, h] = (process.argv[2] || '1280x960').split('x').map(Number);
const g = await boot('?debug=1&seed=9&unlockall=1', { width: w, height: h });
const t = `${w}x${h}`;
await g.wait(3500); await g.S(`ar_${t}_menu`);
await g.go('CharSelect'); await g.wait(1000); await g.S(`ar_${t}_charsel`);
await g.go('Codex', { tab: 'record' }); await g.wait(900); await g.S(`ar_${t}_codex`);
await g.go('Menu'); await g.wait(800);
await g.play('gunslinger');
await g.eval(() => { const a = window.__dw.api; a.godMode(true); a.setFloor(4); a.setCoins(30); a.giveItems(['hex_bag', 'rattle_fang']); });
await g.wait(1500); await g.S(`ar_${t}_f4_card`);
await g.wait(3500); await g.S(`ar_${t}_f4`);
const sz = await g.eval(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.left), Math.round(r.top), innerWidth, innerHeight]; });
console.log(t, 'canvas', JSON.stringify(sz));
console.log('errors', JSON.stringify(g.errors.slice(0, 3)));
await g.close();
