// Hold-to-use ring (EVENTS 1.4): stand inside it to fill it, leave and it drains at 2x speed, `onDone` fires at 1.0.
// Used by every signing / digging / betting / throwing interaction. Drawn with the generated `ring` / `glow` textures (no art).
//
//   new HoldRing(room, { x, y, r = 64, hold = 0.9, label, canUse, onDone, repeat = false, color })
//   canUse(): true / undefined = usable; false = blocked (grey ring); a string = blocked with that red reason text.
//   The ring registers itself with `room.rings`: Room ticks and destroys it. `ring.enabled = false` hides it without destroying.
import Phaser from 'phaser';
import { DEPTH, FONT_BODY } from '../config.js';
import { Sfx } from '../core/Audio.js';

const DRAIN = 2; // leaving drains the ring at 2x the fill speed
const REASON_EVERY = 1.5; // seconds between denial sounds / texts while the player keeps standing on a blocked ring

export default class HoldRing {
  constructor(room, o = {}) {
    this.room = room;
    this.scene = room.scene;
    this.x = o.x;
    this.y = o.y;
    this.r = o.r ?? 64;
    this.hold = o.hold ?? 0.9;
    this.label = o.label || '';
    this.canUse = o.canUse || null;
    this.onDone = o.onDone || null;
    this.repeat = !!o.repeat;
    this.color = o.color ?? 0xf0d080;
    this.enabled = true;
    this.progress = 0;
    this.done = false;
    this.blocked = false;
    this.reason = '';
    this.denyCd = 0;
    this.destroyed = false;
    this._drawn = -1;
    this._drawnBlocked = null;
    const s = this.scene;
    const sc = this.r / 58; // the `ring` texture has a 58 px radius
    this.base = s.add.image(this.x, this.y, 'ring').setScale(sc).setAlpha(0.45).setTint(this.color).setDepth(DEPTH.floor + 4);
    this.glow = s.add.image(this.x, this.y, 'glow').setScale(this.r / 40).setAlpha(0).setTint(this.color).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.floor + 3);
    this.gfx = s.add.graphics().setDepth(DEPTH.floor + 5);
    this.text = this.label
      ? s.add.text(this.x, this.y - this.r - 14, this.label, { fontFamily: FONT_BODY, fontSize: '20px', color: '#e8dcc0', stroke: '#120c0a', strokeThickness: 4 }).setOrigin(0.5).setDepth(DEPTH.fx - 10)
      : null;
    for (const obj of [this.base, this.glow, this.gfx, this.text]) if (obj) room.track(obj);
    (room.rings || (room.rings = [])).push(this);
  }

  setLabel(label) {
    this.label = label;
    if (this.text) this.text.setText(label);
    else if (label) { this.text = this.scene.add.text(this.x, this.y - this.r - 14, label, { fontFamily: FONT_BODY, fontSize: '20px', color: '#e8dcc0', stroke: '#120c0a', strokeThickness: 4 }).setOrigin(0.5).setDepth(DEPTH.fx - 10); this.room.track(this.text); }
  }
  setColor(color) { this.color = color; this.base.setTint(color); this.glow.setTint(color); this._drawn = -1; }
  setPosition(x, y) {
    this.x = x; this.y = y;
    this.base.setPosition(x, y); this.glow.setPosition(x, y);
    if (this.text) this.text.setPosition(x, y - this.r - 14);
    this._drawn = -1;
  }
  /** Re-arm a finished ring (non-repeating rings stay done until reset). */
  reset() { this.progress = 0; this.done = false; this._drawn = -1; }
  setVisible(v) {
    this.enabled = v;
    this.base.setVisible(v); this.glow.setVisible(v); this.gfx.setVisible(v);
    if (this.text) this.text.setVisible(v);
    if (!v) this.progress = 0;
  }

  /** True when the player stands inside the ring and may interact this frame. */
  playerInside() {
    const s = this.scene, p = s.player;
    if (!p || p.dead || s.transitioning || s.cutscene || p.locked) return false;
    const rr = this.r;
    return (p.x - this.x) ** 2 + (p.y - this.y) ** 2 <= rr * rr;
  }

  update(dt) {
    if (this.destroyed || !this.enabled) return;
    if (this.denyCd > 0) this.denyCd -= dt;
    const inside = this.playerInside();
    // usability (queried each frame: prices change with coins)
    let ok = true, reason = '';
    if (this.canUse) {
      const v = this.canUse();
      if (typeof v === 'string') { ok = false; reason = v; } else if (v === false || v === null || v === 0) ok = false;
    }
    this.blocked = !ok;
    this.reason = reason;
    if (this.done && !this.repeat) { this.draw(); return; }
    if (inside && ok) {
      this.progress = Math.min(1, this.progress + dt / this.hold);
      if (this.progress >= 1) {
        this.progress = 0;
        if (!this.repeat) this.done = true;
        this.draw();
        if (this.onDone) this.onDone(this);
        return;
      }
    } else {
      if (inside && !ok && this.denyCd <= 0) {
        this.denyCd = REASON_EVERY;
        Sfx.play('door_locked', { vol: 0.7 });
        if (reason) this.scene.fx.text(this.x, this.y - this.r - 34, reason, { color: '#e05040', size: 22 });
      }
      if (this.progress > 0) this.progress = Math.max(0, this.progress - (dt / this.hold) * DRAIN);
    }
    this.draw();
  }

  draw() {
    const blocked = this.blocked;
    const p = this.progress;
    if (p === this._drawn && blocked === this._drawnBlocked) return;
    this._drawn = p; this._drawnBlocked = blocked;
    const col = blocked ? 0x8a8478 : this.color;
    this.base.setTint(col).setAlpha(blocked ? 0.3 : 0.45 + 0.4 * p);
    this.glow.setAlpha(blocked ? 0 : 0.5 * p);
    const g = this.gfx;
    g.clear();
    if (p > 0) {
      g.lineStyle(9, col, 0.95);
      g.beginPath();
      g.arc(this.x, this.y, this.r - 3, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2, false);
      g.strokePath();
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    const list = this.room.rings;
    if (list) { const i = list.indexOf(this); if (i >= 0) list.splice(i, 1); }
    for (const obj of [this.base, this.glow, this.gfx, this.text]) if (obj && obj.scene) obj.destroy();
  }
}

export { HoldRing };
