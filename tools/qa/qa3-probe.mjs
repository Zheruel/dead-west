import { boot } from './qa3-lib.mjs';
const g = await boot('?debug=1&seed=7&char=gunslinger&floor=4');
await g.play();
await g.wait(3500);
console.log(await g.eval(() => JSON.stringify({s: window.__game.scene.getScenes(true).map(s=>s.scene.key), st: window.__dw.api.state()}).slice(0,1500)));
console.log(await g.eval(() => window.__dw.floor.rooms.map(r=>[r.id,r.type,r.tpl&&r.tpl.id, Object.keys(r).join(',')].join(':')).slice(0,3).join('\n')));
await g.shot('v2/probe_f4');
console.log(g.errors.slice(0,10));
await g.close();
