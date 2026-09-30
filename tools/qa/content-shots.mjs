// Sprite scale / anchor / hitbox audit with the REAL art (INT-4). For every enemy (and, with --minis / --bosses, minis / bosses) it spawns one copy
// in the start room of its floor with its AI frozen, draws a debug overlay (red = body circle, yellow = hit circle, cyan cross = foot line, green box =
// sprite bounds, magenta line = shadow width) and screenshots a 360x360 crop into art/qa/int4/<id>.png. Also prints the numbers:
//   frame size, displayed size, sprite bottom vs footY, foot offset, radius, shadow width, opaque-content bounds of frame 0 (from the texture pixels).
//   node tools/qa/content-shots.mjs [id...|all] [--minis] [--bosses] [--noassets] [--dropassets=40] [--pose=move|windup|attack]
// Then montage: montage art/qa/int4/*.png -tile 6x -geometry 240x240+2+2 art/qa/int4_sheet.png
import fs from 'node:fs';
import { launch } from './harness.mjs';
import { ENEMY_META } from '../../src/enemies/registry.js';
import { BOSS_META } from '../../src/bosses/registry.js';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
let ids = args.filter((a) => !a.startsWith('--')).flatMap((a) => a.split(',')).filter(Boolean);
const minis = Object.keys(BOSS_META).filter((k) => BOSS_META[k].mini);
const bosses = Object.keys(BOSS_META).filter((k) => !BOSS_META[k].mini);
if (!ids.length || ids.includes('all')) ids = Object.keys(ENEMY_META).filter((k) => (ENEMY_META[k].floors || []).length || ['duelist', 'crow', 'tumbleweed_mini'].includes(k));
if (flags.minis) ids = ids.concat(minis);
if (flags.bosses) ids = ids.concat(bosses);
const POSE = flags.pose || 'move';
const query = `?debug=1&seed=42${flags.noassets ? '&noassets=1' : ''}${flags.dropassets ? `&dropassets=${flags.dropassets === true ? 40 : flags.dropassets}` : ''}`;
fs.mkdirSync('art/qa/int4', { recursive: true });
const g = await launch({ query, name: 'content-shots', quiet: true });
await g.startRun();
const rows = [];
let curFloor = -1;
ids.sort((a, b) => { const fl = (i) => (BOSS_META[i] && !ENEMY_META[i] ? BOSS_META[i].floor : ((ENEMY_META[i].floors || [])[0] || 1)); return fl(a) - fl(b); });
for (const id of ids) {
  const isBoss = !!BOSS_META[id] && !ENEMY_META[id];
  const floor = isBoss ? BOSS_META[id].floor : ((ENEMY_META[id].floors && ENEMY_META[id].floors[0]) || 1);
  if (floor !== curFloor) {
    curFloor = floor;
    await g.eval((f) => { const a = window.__dw.api; a.setFloor(f); a.godMode(true); a.jump('start'); }, floor);
    await g.wait(900);
    await g.page.waitForFunction(() => { const s = window.__dw.scene; return !s.cutscene && !s.transitioning; }, { timeout: 30000 }).catch(() => {});
    await g.wait(3500);
  }
  const info = await g.eval(async (id, isBoss, POSE) => {
    const dw = window.__dw, a = dw.api, sc = dw.scene, p = sc.player;
    a.killAll(); a.heal();
    for (const o of sc._dbgObjs || []) o.destroy(); sc._dbgObjs = [];
    p.x = 400; p.y = 480;
    let e;
    if (isBoss) {
      const { spawnBoss } = await import('/src/bosses/index.js');
      e = spawnBoss(sc, id, 900, 470, { floor: sc.floorNum });
      if (sc.room && !sc.room.boss) sc.room.boss = e;
    } else e = a.spawn(id, 900, 480, {});
    if (!e) return null;
    e.spawnT = 0; e.contactDamage = 0;
    e.ai = () => {}; e.update = function (dt) { this.stop && this.stop(); if (this.sprite) { this.sprite.setAlpha(1); this.syncVisual(); } };
    if (e.setPose) { e.pose = ''; e.setPose(POSE); }
    if (e.sprite) e.sprite.setAlpha(1);
    e.syncVisual && e.syncVisual();
    return true;
  }, id, isBoss, POSE);
  if (!info) { console.log(id, 'NOT SPAWNED'); rows.push({ id, err: 'not spawned' }); continue; }
  await g.wait(500);
  const m = await g.eval((id) => {
    const sc = window.__dw.scene;
    const e = sc.enemies.find((q) => q.id === id) || sc.enemies[0];
    if (!e || !e.sprite) return null;
    const s = e.sprite, tex = s.texture, fr = s.frame;
    const gr = sc.add.graphics().setDepth(9999); sc._dbgObjs.push(gr);
    gr.lineStyle(2, 0xff2020, 1).strokeCircle(e.x, e.y, e.radius);
    gr.lineStyle(2, 0xffe020, 1).strokeCircle(e.x, e.y, e.hitRadius || e.radius);
    const fy = e.footY;
    gr.lineStyle(2, 0x20ffff, 1).lineBetween(e.x - 30, fy, e.x + 30, fy).lineBetween(e.x, fy - 30, e.x, fy);
    const b = s.getBounds();
    gr.lineStyle(1, 0x20ff20, 1).strokeRect(b.x, b.y, b.width, b.height);
    const sw = e.shadow ? e.shadow.displayWidth : 0;
    gr.lineStyle(2, 0xff20ff, 1).lineBetween(e.x - sw / 2, fy + 4, e.x + sw / 2, fy + 4);
    // opaque content bounds of the current frame
    let cb = null;
    try {
      const src = tex.getSourceImage(); const c = document.createElement('canvas'); c.width = fr.cutWidth; c.height = fr.cutHeight;
      const cx = c.getContext('2d'); cx.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
      const d = cx.getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      cb = [x0, y0, x1, y1];
    } catch (err) { cb = null; }
    return {
      id: e.id, key: tex.key, frame: [fr.cutWidth, fr.cutHeight], disp: [Math.round(s.displayWidth), Math.round(s.displayHeight)], scale: [+s.scaleX.toFixed(2), +s.scaleY.toFixed(2)], origin: [s.originX, s.originY],
      x: Math.round(e.x), y: Math.round(e.y), footY: Math.round(fy), spriteBottom: Math.round(b.bottom), foot: e.footOffset, r: e.radius, hitR: e.hitRadius, shadowW: Math.round(sw), air: e.airHeight, content: cb,
      placeholder: !!(tex.key && !window.__game.textures.exists(tex.key)),
    };
  }, id);
  await g.wait(200);
  const cx = m ? Math.max(0, Math.min(1440 - 360, m.x - 180)) : 720, cy = m ? Math.max(0, Math.min(960 - 360, m.y - 260)) : 300;
  const f = `art/qa/int4/${id}.png`;
  await g.page.screenshot({ path: f, clip: { x: cx, y: cy, width: 360, height: 360 } });
  if (m) {
    const c = m.content;
    const contentH = c ? c[3] - c[1] + 1 : 0, contentW = c ? c[2] - c[0] + 1 : 0;
    // content bottom relative to the frame bottom (px of empty space under the feet) and body-circle coverage
    const gapBelow = c ? m.frame[1] - 1 - c[3] : 0;
    const flags2 = [];
    if (c && Math.abs(m.spriteBottom - gapBelow - m.footY) > 12 && !m.air) flags2.push(`feet@${m.spriteBottom - gapBelow} vs footY ${m.footY}`);
    if (c && contentH > 0 && (m.r * 2) > contentH * 1.15) flags2.push('circle taller than art');
    if (c && contentW > 0 && (m.r * 2) > contentW * 1.5) flags2.push('circle wider than art');
    if (c && contentW > 0 && contentW > m.r * 2 * 2.4) flags2.push('art much wider than circle');
    console.log(`${id.padEnd(16)} ${m.key} frame ${m.frame.join('x')} disp ${m.disp.join('x')} r ${m.r} foot ${m.foot} content ${c ? `${contentW}x${contentH} gapBelow ${gapBelow}` : '?'} shadow ${m.shadowW}${flags2.length ? '  <<' + flags2.join('; ') : ''}`);
    rows.push({ ...m, flags: flags2 });
  } else { console.log(id, 'no sprite'); rows.push({ id, err: 'no sprite' }); }
}
fs.writeFileSync('art/qa/int4/report.json', JSON.stringify(rows, null, 1));
console.log('errors:', g.errors.length, g.errors.slice(0, 3));
await g.close();
