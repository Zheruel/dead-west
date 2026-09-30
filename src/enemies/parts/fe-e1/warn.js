// Telegraph helpers for the FE-E1 enemies (hellhound wedge, hellsteer band). Not auto-registered (lives outside types/).
// Both are owned by one enemy, created lazily on its first attack and reused for every attack after (no per-attack allocation), and both draw
// above the darkness mask on dark rooms (warnDepth) so a telegraph is never hidden.
import { warnDepth } from '../../../rooms/hazards/common.js';

const WEDGE_FILL = 'e1_wedge_fill', WEDGE_RIM = 'e1_wedge_rim';
const WR = 254; // wedge texture radius in px (apex at the left edge, 60 degree sector along +x)

/** 60 degree sector textures (filled + rim only), generated once per game. */
function ensureWedgeTextures(scene) {
  const t = scene.textures;
  if (t.exists(WEDGE_FILL)) return;
  const half = Math.PI / 6;
  const make = (key, rim) => {
    const c = t.createCanvas(key, 256, 256), x = c.getContext();
    x.beginPath(); x.moveTo(0, 128); x.arc(0, 128, WR, -half, half); x.closePath();
    if (rim) { x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.lineJoin = 'round'; x.stroke(); } else { x.fillStyle = '#ffffff'; x.fill(); }
    c.refresh();
  };
  make(WEDGE_FILL, false);
  make(WEDGE_RIM, true);
}

/** Growing 60 degree warning wedge (hellhound flame fan). set(x, y, angle, len, k 0..1, color). */
export class WedgeWarn {
  constructor(scene) {
    this.scene = scene;
    ensureWedgeTextures(scene);
    const mk = (key) => { const im = scene.add.image(0, 0, key).setOrigin(0, 0.5).setVisible(false); im.__noSnap = true; return im; };
    this.base = mk(WEDGE_FILL);
    this.fill = mk(WEDGE_FILL);
    this.rim = mk(WEDGE_RIM);
    this.on = false;
  }

  set(x, y, angle, len, k, color) {
    const room = this.scene.room, d = warnDepth(room);
    const sc = len / WR;
    const kk = k < 0.04 ? 0.04 : k > 1 ? 1 : k;
    this.base.setVisible(true).setPosition(x, y).setRotation(angle).setScale(sc).setTint(color).setAlpha(0.16).setDepth(d);
    this.fill.setVisible(true).setPosition(x, y).setRotation(angle).setScale(sc * kk).setTint(color).setAlpha(0.32 + 0.2 * kk).setDepth(d + 0.01);
    this.rim.setVisible(true).setPosition(x, y).setRotation(angle).setScale(sc).setTint(color).setAlpha(0.45 + 0.4 * kk).setDepth(d + 0.02);
    this.on = true;
  }

  hide() {
    if (!this.on) return;
    this.on = false;
    this.base.setVisible(false); this.fill.setVisible(false); this.rim.setVisible(false);
  }

  destroy() {
    for (const im of [this.base, this.fill, this.rim]) if (im && im.scene) im.destroy();
    this.on = false;
  }
}

/** Charge lane: a band `w` px wide from (x,y) along `angle` for `len` px, the inner fill widening with k (hellsteer). */
export class BandWarn {
  constructor(scene) {
    this.scene = scene;
    const mk = () => { const im = scene.add.image(0, 0, 'px').setOrigin(0, 0.5).setVisible(false); im.__noSnap = true; return im; };
    this.base = mk();
    this.fill = mk();
    this.rimT = mk();
    this.rimB = mk();
    this.on = false;
  }

  set(x, y, angle, len, w, k, color) {
    const d = warnDepth(this.scene.room);
    const kk = k < 0 ? 0 : k > 1 ? 1 : k;
    this.base.setVisible(true).setPosition(x, y).setRotation(angle).setDisplaySize(len, w).setTint(color).setAlpha(0.2).setDepth(d);
    this.fill.setVisible(true).setPosition(x, y).setRotation(angle).setDisplaySize(len, 2 + (w - 2) * kk).setTint(color).setAlpha(0.32 + 0.2 * kk).setDepth(d + 0.01);
    const nx = -Math.sin(angle) * w / 2, ny = Math.cos(angle) * w / 2;
    this.rimT.setVisible(true).setPosition(x + nx, y + ny).setRotation(angle).setDisplaySize(len, 3).setTint(color).setAlpha(0.5 + 0.4 * kk).setDepth(d + 0.02);
    this.rimB.setVisible(true).setPosition(x - nx, y - ny).setRotation(angle).setDisplaySize(len, 3).setTint(color).setAlpha(0.5 + 0.4 * kk).setDepth(d + 0.02);
    this.on = true;
  }

  hide() {
    if (!this.on) return;
    this.on = false;
    this.base.setVisible(false); this.fill.setVisible(false); this.rimT.setVisible(false); this.rimB.setVisible(false);
  }

  destroy() {
    for (const im of [this.base, this.fill, this.rimT, this.rimB]) if (im && im.scene) im.destroy();
    this.on = false;
  }
}

/** Free distance from (x,y) along `angle` until a solid tile / the wall (room.probe with a circle of radius r), capped at `max`. Allocation-free. */
export function rayLength(room, x, y, angle, r, max = 1500, step = 24) {
  const c = Math.cos(angle), s = Math.sin(angle);
  for (let d = step; d <= max; d += step) if (room.probe(x + c * d, y + s * d, r)) return d - step;
  return max;
}
