// Meta-screen drawing helpers: undiscovered silhouettes, the `meta_icons` cells (relics, lawman stars, padlock, rank badge) with code-drawn
// fallbacks when the atlas is missing, circular rider tokens, and small chips. Every function degrades to code-drawn art (?noassets=1).
import { Assets } from '../core/Assets.js';
import { FONT_BODY, CSS } from '../config.js';

export const SIL_TINT = 0x1a100c;
export const SIL_ALPHA = 0.55;

/** Paint any image / sprite as an unseen black silhouette. */
export function silhouette(im, alpha = SIL_ALPHA) { return im.setTintFill(SIL_TINT).setAlpha(alpha); }
/** Undo silhouette(). */
export function reveal(im) { return im.clearTint().setAlpha(1); }

// ------------------------------------------------------------------------------------------------ meta_icons
const ICON_NAMES = ['sermon_bible', 'hunters_ledger', 'gilded_pair', 'star_tin', 'star_silver', 'star_gold', 'padlock', 'rank_badge'];
const STAR_COL = { star_tin: ['#7d8a94', '#4c5860'], star_silver: ['#dfe6ec', '#8fa4b8'], star_gold: ['#e0a830', '#a06a10'] };

function starPath(ctx, cx, cy, r, n = 6) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i * Math.PI) / n - Math.PI / 2, rr = i % 2 ? r * 0.55 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function drawIcon(ctx, name) {
  const o = '#120c0a';
  ctx.lineWidth = 4; ctx.strokeStyle = o; ctx.lineJoin = 'round';
  if (name === 'sermon_bible') {
    ctx.fillStyle = '#2a2220'; ctx.fillRect(22, 10, 52, 72); ctx.strokeRect(22, 10, 52, 72);
    ctx.fillStyle = '#c9a24a'; ctx.fillRect(45, 22, 6, 36); ctx.fillRect(36, 32, 24, 6);
    ctx.fillStyle = '#8a1c14'; ctx.fillRect(56, 74, 8, 16);
  } else if (name === 'hunters_ledger') {
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(10, 20, 34, 52); ctx.fillRect(48, 20, 34, 52); ctx.strokeRect(10, 20, 34, 52); ctx.strokeRect(48, 20, 34, 52);
    ctx.fillStyle = '#6b4423'; ctx.fillRect(44, 18, 4, 56);
    ctx.fillStyle = '#c9a24a'; ctx.fillRect(26, 44, 44, 9); ctx.beginPath(); ctx.arc(72, 48, 6, 0, 7); ctx.fill();
  } else if (name === 'gilded_pair') {
    ctx.fillStyle = '#e0a830'; ctx.beginPath(); ctx.arc(48, 52, 22, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#f0c850'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(14, 16); ctx.lineTo(82, 80); ctx.moveTo(82, 16); ctx.lineTo(14, 80); ctx.stroke();
    ctx.strokeStyle = o; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(14, 8); ctx.lineTo(82, 72); ctx.stroke();
  } else if (name === 'padlock') {
    ctx.strokeStyle = '#8a8f96'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(48, 36, 16, Math.PI, 0); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = o; ctx.fillStyle = '#5a5e64'; ctx.fillRect(22, 38, 52, 44); ctx.strokeRect(22, 38, 52, 44);
    ctx.fillStyle = o; ctx.beginPath(); ctx.arc(48, 56, 6, 0, 7); ctx.fill(); ctx.fillRect(46, 58, 4, 12);
  } else if (name === 'rank_badge') {
    ctx.fillStyle = '#c8c4b8'; ctx.beginPath(); ctx.arc(48, 48, 38, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a8a498'; starPath(ctx, 48, 50, 24); ctx.fill(); ctx.stroke();
  } else {
    const c = STAR_COL[name] || STAR_COL.star_tin;
    ctx.fillStyle = c[0]; starPath(ctx, 48, 50, 40); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c[1]; ctx.beginPath(); ctx.arc(48, 50, 10, 0, 7); ctx.fill(); ctx.stroke();
  }
}

function iconTexture(scene, name) {
  const key = `mi_${name}`;
  if (!scene.textures.exists(key)) {
    const t = scene.textures.createCanvas(key, 96, 96);
    drawIcon(t.getContext(), name);
    t.refresh();
  }
  return key;
}

/** Image of a `meta_icons` cell (real atlas when it loaded, code-drawn otherwise). Origin centre. */
export function metaIcon(scene, x, y, name, scale = 1) {
  let im;
  const spec = Assets.has('meta_icons') ? Assets.spec('meta_icons') : null;
  if (spec && spec.names && spec.names.includes(name)) im = Assets.makeCell(scene, x, y, 'meta_icons', name, 0.5);
  else im = scene.add.image(x, y, iconTexture(scene, name)).setOrigin(0.5);
  return im.setScale(scale * (im.width ? 96 / im.width : 1));
}
export const padlock = (scene, x, y, scale = 1) => metaIcon(scene, x, y, 'padlock', scale);
export const starIcon = (scene, x, y, tier, scale = 1) => metaIcon(scene, x, y, `star_${tier}`, scale);
export { ICON_NAMES };

// ------------------------------------------------------------------------------------------------ cells of any sheet
/** An item icon (registry def) as an image; a `meta_icons` sheet goes through metaIcon so relics work without art. */
export function itemIcon(scene, x, y, def, scale = 0.7) {
  const ic = (def && def.icon) || { sheet: 'items_passive_a', name: def ? def.id : '?' };
  if (ic.sheet === 'meta_icons') return metaIcon(scene, x, y, ic.name, scale);
  return Assets.makeCell(scene, x, y, ic.sheet, ic.name, 0.5).setScale(scale);
}

// ------------------------------------------------------------------------------------------------ rider tokens
/** Circular portrait crop of a rider (locked = black silhouette). Returns a container with .ring for highlight. `size` = diameter. */
export function riderToken(scene, x, y, id, size, { locked = false, depth, mask = true } = {}) {
  const c = scene.add.container(x, y);
  const r = size / 2;
  const back = scene.add.circle(0, 0, r, 0x1c130e, 1);
  c.add(back);
  const pic = Assets.makeImage(scene, 0, r * 0.12, `portrait_${id === 'gunslinger' ? 'player' : id}`);
  const ph = Assets.has(`portrait_${id === 'gunslinger' ? 'player' : id}`);
  pic.setDisplaySize(size * 1.05, size * 1.05);
  if (!ph) pic.setAlpha(0.9);
  if (locked) silhouette(pic, 1);
  c.add(pic);
  // the geometry mask is fixed in world space: moving / nested containers pass mask:false (square crop inside the ring)
  let mg = null;
  if (mask) {
    mg = scene.make.graphics({ x, y, add: false });
    mg.fillStyle(0xffffff).fillCircle(0, 0, r - 2);
    pic.setMask(mg.createGeometryMask());
  }
  c.ring = scene.add.circle(0, 0, r, 0, 0).setStrokeStyle(5, 0x6b4423, 1);
  c.add(c.ring);
  if (locked) c.add(padlock(scene, 0, 0, size / 150));
  c.highlight = (b) => { c.ring.setStrokeStyle(b ? 7 : 5, b ? 0xf0a640 : 0x6b4423, 1); return c; };
  if (mg) c.once('destroy', () => { try { mg.destroy(); } catch (e) { /* scene gone */ } });
  if (depth != null) c.setDepth(depth);
  return c;
}

// ------------------------------------------------------------------------------------------------ chips
/** Rounded text chip (mutators, HELL, mode ribbons). Returns a container with .w. */
export function chip(scene, x, y, text, { size = 18, fill = 0x2a1a12, stroke = 0xf0a640, color = CSS.bone, pad = 12, font = FONT_BODY, origin = 0.5 } = {}) {
  const t = scene.add.text(0, 0, text, { fontFamily: font, fontSize: `${size}px`, color, stroke: '#120c0a', strokeThickness: 3 }).setOrigin(0.5);
  const w = t.width + pad * 2, h = size + 14;
  const bg = scene.add.graphics();
  bg.fillStyle(fill, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 8).lineStyle(2, stroke, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
  const c = scene.add.container(origin === 0 ? x + w / 2 : x, y, [bg, t]);
  c.w = w; c.h = h; c.label = t;
  return c;
}



// ------------------------------------------------------------------------------------------------ backdrops / panels
/** Full-screen backdrop: the real art `key` when loaded, else the (placeholder or real) title art darkened, else a code-drawn dusk gradient. */
export function backdrop(scene, key, { dim = 0.35, tint = null } = {}) {
  const out = [];
  if (Assets.has(key)) out.push(scene.add.image(720, 480, key).setDisplaySize(1440, 960));
  else if (Assets.has('title_bg')) out.push(scene.add.image(720, 480, 'title_bg').setDisplaySize(1440, 960).setTint(tint ?? 0x6a5a5a));
  else {
    const g = scene.add.graphics();
    g.fillGradientStyle(0x1a0c0a, 0x1a0c0a, 0x3a1a12, 0x3a1a12, 1).fillRect(0, 0, 1440, 960);
    out.push(g);
  }
  if (scene.textures.exists('vignette')) out.push(scene.add.image(720, 480, 'vignette').setDisplaySize(1440, 960).setTint(0x000000).setAlpha(dim + 0.2));
  out.push(scene.add.rectangle(720, 480, 1440, 960, 0x000000, dim));
  for (const o of out) o.setDepth(-10);
  return out;
}

/** Parchment panel of an exact size (real art stretched; placeholder when missing). dark = burnt sepia for light text. */
export function panel(scene, x, y, w, h, { dark = false, depth = 0, alpha = 1, angle = 0 } = {}) {
  const im = Assets.makeImage(scene, x, y, 'ui_parchment').setDisplaySize(w, h).setDepth(depth).setAlpha(alpha).setAngle(angle);
  if (dark) im.setTint(0x5e4a3a);
  return im;
}
