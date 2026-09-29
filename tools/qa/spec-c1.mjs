import { boot } from './spec-lib.mjs';
const g = await boot('?debug=1&seed=5');
const wait = (ms) => g.wait(ms);
await g.eval(() => { const a = window.__dw.api; a.giveItem('spurs'); a.giveItem('hollow_point'); a.giveItem('whiskey_bottle'); });
await wait(600);
// pause
await g.tap('Escape'); await wait(800);
console.log('paused', await g.eval(() => [window.__game.scene.isActive('Pause'), window.__dw && window.__dw.scene.paused]));
await g.shot('spec_c1_pause');
await g.tap('Escape'); await wait(600);
console.log('resumed', await g.eval(() => window.__game.scene.isActive('Pause')));
// pause via P
await g.tap('KeyP'); await wait(600);
console.log('paused P', await g.eval(() => window.__game.scene.isActive('Pause')));
// quit to menu: down x2 + enter twice
await g.tap('KeyS'); await wait(150); await g.tap('KeyS'); await wait(150); await g.tap('Enter'); await wait(300); await g.tap('Enter'); await wait(1500);
console.log('after quit', await g.eval(() => ['Menu', 'Game', 'Pause', 'End', 'HUD'].filter((k) => window.__game.scene.isActive(k))), JSON.stringify(await g.eval(() => JSON.parse(localStorage.getItem('deadwest.save.v1')))));
await g.shot('spec_c1_menu');
// new run, die
await g.startRun();
await g.eval(() => { const a = window.__dw.api; a.godMode(false); a.giveItem('tin_star'); a.giveItem('lucky_deck'); });
await wait(300);
await g.eval(() => window.__dw.api.die());
await wait(6000);
await g.shot('spec_c1_death');
console.log('scene', await g.eval(() => ['Menu', 'Game', 'Pause', 'End', 'HUD'].filter((k) => window.__game.scene.isActive(k))));
await g.tap('KeyR'); await wait(2500);
console.log('after R', await g.eval(() => ['Menu', 'Game', 'Pause', 'End', 'HUD'].filter((k) => window.__game.scene.isActive(k))), JSON.stringify(await g.eval(() => JSON.parse(localStorage.getItem('deadwest.save.v1')))));
console.log('errors', g.errors);
await g.close();
