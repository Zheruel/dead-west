// HellGate: the fissure that opens after a floor 1-5 boss (EVENTS 2.1) and, inside the Crossroads pocket, the way back out (rec.exit).
// rec {x, y, exit?}. Two-frame flicker (props_deals hellgate_a / hellgate_b, 4 fps) over a red additive glow with rising embers; with the
// art missing a jagged fissure is drawn with Graphics. Like the Trapdoor it arms only after the player has stood > 90 px away, then a touch
// (d < 46) calls RoomManager.enterPocket() / leavePocket(). Persistent in the boss room's state (`state.gate`), usable until the floor changes.
import { DEPTH } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';

const ARM_DIST = 90;
const TOUCH_DIST = 46;
const FLICKER_FPS = 4;

export default class HellGate {
  constructor(scene, rec, room) {
    this.scene = scene; this.rec = rec; this.room = room;
    this.x = rec.x; this.y = rec.y;
    this.exit = !!rec.exit;
    this.age = 0;
    this.armed = false;
    this.used = false;
    this.emberT = 0;
    this.real = Assets.has('props_deals');
    const tint = this.exit ? 0xf0b050 : 0xff4a18; // the way back burns amber instead of red
    this.glow = scene.add.image(this.x, this.y, 'glow').setTint(tint).setBlendMode('ADD').setScale(1.7, 1.1).setAlpha(0.55).setDepth(DEPTH.floor + 2);
    if (this.real) {
      this.sprite = Assets.makeCell(scene, this.x, this.y, 'props_deals', 'hellgate_a', 0.5).setDepth(DEPTH.floor + 3);
      if (this.exit) this.sprite.setTint(0xffd890);
      this.frameA = Assets.frame('props_deals', 'hellgate_a');
      this.frameB = Assets.frame('props_deals', 'hellgate_b');
    } else {
      this.sprite = scene.add.graphics().setDepth(DEPTH.floor + 3);
      this.drawFissure(this.sprite, tint);
      this.sprite.setPosition(this.x, this.y);
    }
    this.sprite.setAlpha(0);
    this.fade = 0;
    this.embers = { color: this.exit ? [0xf0d080, 0xf0a640] : [0xff7a30, 0xffc060, 0xd63a2a], count: 1, speed: [20, 70], life: [600, 1000], scale: [1.4, 2.4], angle: [250, 290], blend: 'ADD' };
  }

  /** Jagged fissure (relative to 0,0), drawn once. */
  drawFissure(g, tint) {
    const pts = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const jag = i % 2 ? 0.62 : 1;
      pts.push({ x: Math.cos(a) * 62 * jag * (1 + 0.12 * Math.sin(i * 2.3)), y: Math.sin(a) * 30 * jag * (1 + 0.15 * Math.cos(i * 1.7)) });
    }
    g.fillStyle(0x140608, 1); g.fillPoints(pts, true);
    g.lineStyle(4, tint, 0.95); g.strokePoints(pts, true);
    const inner = pts.map((p) => ({ x: p.x * 0.55, y: p.y * 0.55 }));
    g.fillStyle(tint, 0.45); g.fillPoints(inner, true);
    g.lineStyle(2, 0xffd890, 0.7);
    g.beginPath(); g.moveTo(-40, -6); g.lineTo(-14, 4); g.lineTo(6, -8); g.lineTo(38, 3); g.strokePath();
  }

  get objs() { return [this.glow, this.sprite]; }

  update(dt) {
    this.age += dt;
    if (this.fade < 1) { this.fade = Math.min(1, this.fade + dt * 2); this.sprite.setAlpha(this.fade); }
    const fl = Math.floor(this.age * FLICKER_FPS) % 2;
    if (this.real) this.sprite.setFrame(fl ? this.frameB : this.frameA);
    this.glow.setAlpha((0.42 + 0.14 * Math.sin(this.age * 5.3) + 0.06 * Math.sin(this.age * 13.1)) * this.fade);
    this.emberT -= dt;
    if (this.emberT <= 0) {
      this.emberT = 0.28;
      this.scene.fx.burst(this.x + (Math.random() - 0.5) * 70, this.y + (Math.random() - 0.5) * 20, this.embers);
    }
    const p = this.scene.player;
    if (this.used || !p || p.dead || this.age < 0.8 || this.scene.transitioning) return;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (!this.armed) { if (d > ARM_DIST) this.armed = true; return; }
    if (d < TOUCH_DIST) this.touch();
  }

  /** Touched: `rec.onTouch(gate)` (Crossroads controller: the Dealer's parting word) may take over and call go() itself later. */
  touch() {
    const mgr = this.scene.roomMgr;
    if (!mgr || typeof (this.exit ? mgr.leavePocket : mgr.enterPocket) !== 'function') return; // no pocket support in RoomManager: stay armed
    this.used = true;
    if (this.rec.onTouch) this.rec.onTouch(this); else this.go();
  }

  go() {
    const mgr = this.scene.roomMgr;
    if (!mgr || this.gone) return;
    this.gone = true;
    Sfx.play('hellgate_enter');
    if (this.exit) mgr.leavePocket(); else mgr.enterPocket();
  }

  destroy() {
    if (this.glow) { this.glow.destroy(); this.glow = null; }
    if (this.sprite) { this.sprite.destroy(); this.sprite = null; }
  }
}
