// Isaac-style minimap (top-right): visited rooms + unknown neighbours, type icons, current-room highlight.
// Redrawn only when the map version (RoomManager.mapVer) or current room changes; the per-frame path is allocation-free.
import { GRID, FONT_BODY } from '../config.js';

const CW = 26, CH = 18, GAP = 4;
const X0 = 1440 - 16 - (GRID.cols * (CW + GAP) - GAP);
const Y0 = 6;

export default class Minimap {
  constructor(hud) {
    this.hud = hud;
    this.gfx = hud.add.graphics().setDepth(30);
    this.cur = hud.add.graphics().setDepth(32);
    this.texts = [];
    this.sig = '';
    this.curPos = null;
  }

  update(g) {
    const m = g.roomMgr;
    if (!m.floor) return;
    const sig = `${m.floor.floor}|${m.currentId}|${m.mapVer}`;
    if (sig !== this.sig) { this.sig = sig; this.redraw(m); }
    this.blink();
  }

  redraw(m) {
    for (const t of this.texts) t.destroy();
    this.texts.length = 0;
    const disc = m.discoveredRooms();
    const gfx = this.gfx;
    gfx.clear();
    const px = (r) => X0 + r.gx * (CW + GAP);
    const py = (r) => Y0 + r.gy * (CH + GAP);
    // backing plate over the bounding box of everything shown, so the map reads against any wall art
    if (disc.size) {
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      for (const [, v] of disc) { bx0 = Math.min(bx0, px(v.def)); by0 = Math.min(by0, py(v.def)); bx1 = Math.max(bx1, px(v.def) + CW); by1 = Math.max(by1, py(v.def) + CH); }
      gfx.fillStyle(0x0d0806, 0.72).fillRoundedRect(bx0 - 9, by0 - 8, bx1 - bx0 + 18, by1 - by0 + 16, 8);
      gfx.lineStyle(2, 0x6b4423, 0.95).strokeRoundedRect(bx0 - 9, by0 - 8, bx1 - bx0 + 18, by1 - by0 + 16, 8);
    }
    // connectors
    for (const [, v] of disc) {
      for (const [dir, d] of Object.entries(v.def.doors)) {
        if (!disc.has(d.to) || (d.kind === 'secret' && !d.revealed)) continue;
        if (dir !== 'right' && dir !== 'down') continue;
        if (!v.visited && !disc.get(d.to).visited) continue;
        gfx.fillStyle(0x120c0a, 1);
        if (dir === 'right') gfx.fillRect(px(v.def) + CW - 1, py(v.def) + CH / 2 - 3, GAP + 2, 6);
        else gfx.fillRect(px(v.def) + CW / 2 - 3, py(v.def) + CH - 1, 6, GAP + 2);
        gfx.fillStyle(0xd9b071, 1);
        if (dir === 'right') gfx.fillRect(px(v.def) + CW, py(v.def) + CH / 2 - 2, GAP, 4);
        else gfx.fillRect(px(v.def) + CW / 2 - 2, py(v.def) + CH, 4, GAP);
      }
    }
    this.curPos = null;
    for (const [id, v] of disc) {
      const r = v.def;
      const x = px(r), y = py(r);
      const cur = id === m.currentId;
      let fill = v.visited ? 0xc9ac78 : 0x7a6244;
      if (v.visited && r.type === 'boss') fill = 0xa8483c;
      if (cur) { fill = 0xf5e6b8; this.curPos = { x, y }; }
      gfx.fillStyle(0x000000, 0.55).fillRect(x + 2, y + 2, CW, CH); // drop shadow: keeps the map readable over the wall band
      gfx.fillStyle(fill, 1).fillRect(x, y, CW, CH);
      gfx.lineStyle(2, 0x120c0a, 1).strokeRect(x, y, CW, CH);
      // type icons (boss / shop / treasure are always shown on the map once adjacent to a visited room)
      const cx = x + CW / 2, cy = y + CH / 2;
      if (r.type === 'boss') {
        gfx.fillStyle(cur ? 0x120c0a : 0xf0e0c8, 1).fillCircle(cx, cy - 1, 5);
        gfx.fillRect(cx - 3, cy + 2, 6, 3);
        gfx.fillStyle(cur ? 0xf5e6b8 : 0x120c0a, 1).fillRect(cx - 3, cy - 2, 2, 2).fillRect(cx + 1, cy - 2, 2, 2);
      } else if (r.type === 'treasure') {
        gfx.fillStyle(cur ? 0x120c0a : 0xffd040, 1).fillPoints([{ x: cx, y: cy - 6 }, { x: cx + 2, y: cy - 2 }, { x: cx + 6, y: cy }, { x: cx + 2, y: cy + 2 }, { x: cx, y: cy + 6 }, { x: cx - 2, y: cy + 2 }, { x: cx - 6, y: cy }, { x: cx - 2, y: cy - 2 }], true);
      } else if (r.type === 'shop' || r.type === 'secret') {
        const ch = r.type === 'shop' ? '$' : '?';
        const col = cur ? '#120c0a' : r.type === 'shop' ? '#3f8a20' : '#7a4ac0';
        const t = this.hud.add.text(cx, cy, ch, { fontFamily: 'monospace', fontStyle: 'bold', fontSize: '16px', color: col, stroke: cur ? '' : '#f5e6b8', strokeThickness: cur ? 0 : 3 }).setOrigin(0.5).setDepth(31);
        this.texts.push(t);
      }
    }
  }

  blink() {
    if (!this.curPos) return;
    const a = 0.55 + 0.45 * Math.abs(Math.sin(this.hud.time.now / 420));
    const g = this.cur;
    g.clear();
    g.lineStyle(3, 0xffffff, a).strokeRect(this.curPos.x - 1, this.curPos.y - 1, CW + 2, CH + 2);
  }
  destroy() { this.gfx.destroy(); this.cur.destroy(); for (const t of this.texts) t.destroy(); }
}
