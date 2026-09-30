// Sulfur vents `V` (F4). 3.6 s cycle: idle 1.8 s -> warn 0.9 s (yellow gas, glowing grate, hiss) -> erupt 0.9 s (fire column). The eruption is a circle
// r 62 around the tile: the player takes 1 once per eruption, non-fireproof walkers 4 once each. Phase offset ((c*7+r*3)%4)*0.9 s; an eruption never
// starts less than 1.0 s after the room was entered (that cycle is skipped entirely, no warn either). Vents stay active in cleared rooms.
import Phaser from 'phaser';
import { DEPTH, actorDepth } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { hurtPlayer, groundFoe, fireproof, ensureHazTextures, warnDepth, hasCell } from './common.js';
import { TEX } from './tiles.js';

export const VENT = { cycle: 3.6, idle: 1.8, warn: 0.9, erupt: 0.9, radius: 62, enemyDmg: 4, minStart: 1.0 };
const TONGUES = 3;

class Vent {
  constructor(field, t) {
    const s = field.scene;
    this.c = t.c; this.r = t.r; this.x = t.x; this.y = t.y;
    this.off = ((t.c * 7 + t.r * 3) % 4) * 0.9;
    this.state = 0; // 0 idle 1 warn 2 erupt
    this.cycle = -1; this.skip = false;
    this.hit = false;
    this.hitSet = new Set();
    this.puffT = 0;
    this.real = hasCell('haz_f4', 'vent_idle');
    this.img = this.real ? Assets.makeCell(s, t.x, t.y, 'haz_f4', 'vent_idle', 0.5) : s.add.image(t.x, t.y, TEX.vent(s, 0));
    this.img.setDepth(DEPTH.floor - 2);
    this.glow = s.add.image(t.x, t.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe060).setVisible(false).setScale(1.5);
    this.glow.__noSnap = true;
    this.col = null; this.tongues = [];
    if (Assets.has('fx_hellfire')) { this.col = Assets.makeSprite(s, t.x, t.y + 30, 'fx_hellfire', 0).setVisible(false); this.col.__noSnap = true; }
    else {
      ensureHazTextures(s);
      for (let i = 0; i < TONGUES; i++) { const im = s.add.image(t.x, t.y + 30, 'hz_tongue').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa030).setVisible(false); im.__noSnap = true; this.tongues.push(im); }
    }
  }

  setState(st, field) {
    if (st === this.state) return;
    const s = field.scene;
    this.state = st;
    if (this.real) this.img.setFrame(Assets.frame('haz_f4', st === 0 ? 'vent_idle' : st === 1 ? 'vent_warn' : 'vent_erupt'));
    else this.img.setTexture(TEX.vent(s, st));
    const dep = warnDepth(field.room);
    if (st === 1) { this.glow.setVisible(true).setDepth(dep); Sfx.play('vent_hiss', { vol: 0.8 }); }
    else if (st === 2) {
      this.hit = false; this.hitSet.clear();
      this.glow.setVisible(true).setTint(0xff9a30);
      if (this.col) { this.col.setVisible(true).setScale(VENT.radius / 64).play(Assets.ensureAnim(s, 'fx_hellfire', { fps: 10, name: 'loop' }), true); }
      else for (const t of this.tongues) t.setVisible(true);
      Sfx.play('fire_whoosh', { vol: 0.7 });
      s.fx.shake(0.003, 100);
    } else {
      this.glow.setVisible(false).setTint(0xffe060);
      if (this.col) { this.col.setVisible(false); this.col.anims.stop(); }
      for (const t of this.tongues) t.setVisible(false);
    }
  }

  destroy() {
    this.img.destroy(); this.glow.destroy();
    if (this.col) this.col.destroy();
    for (const t of this.tongues) t.destroy();
  }
}

export class VentField {
  constructor(hz, tiles) {
    this.hz = hz;
    this.room = hz.room;
    this.scene = hz.scene;
    this.vents = tiles.map((t) => new Vent(this, t));
  }

  update(dt) {
    const clock = this.hz.clock, s = this.scene, p = s.player;
    const dark = this.room.darkMask;
    for (const v of this.vents) {
      const u = clock + v.off, cyc = Math.floor(u / VENT.cycle), ph = u - cyc * VENT.cycle;
      if (cyc !== v.cycle) { // new cycle: the eruption starts at real time (cyc*cycle + idle + warn - off)
        v.cycle = cyc;
        v.skip = cyc * VENT.cycle + VENT.idle + VENT.warn - v.off < VENT.minStart;
      }
      const st = v.skip || ph < VENT.idle ? 0 : ph < VENT.idle + VENT.warn ? 1 : 2;
      v.setState(st, this);
      if (st === 1) {
        const k = (ph - VENT.idle) / VENT.warn;
        v.glow.setAlpha(0.25 + 0.5 * k * (0.8 + 0.2 * Math.sin(clock * 30))).setScale(1.3 + 0.5 * k);
        v.puffT -= dt;
        if (v.puffT <= 0) { v.puffT = 0.16; s.fx.burst(v.x + (Math.random() - 0.5) * 40, v.y - 6, { color: [0xd8c43a, 0xc8c090], tex: 'glow', count: 1, speed: [20, 60], life: [500, 800], scale: [0.15, 0.55], alpha: [0.6, 0], angle: [240, 300], depth: dark ? warnDepth(this.room) + 1 : DEPTH.fx }); }
      } else if (st === 2) this._erupt(v, ph, clock, p);
      if (v.col && v.col.visible) v.col.setDepth(dark ? warnDepth(this.room) + 1 : actorDepth(v.y + 30));
    }
  }

  _erupt(v, ph, clock, p) {
    const k = (ph - VENT.idle - VENT.warn) / VENT.erupt;
    const fade = k > 0.8 ? (1 - k) / 0.2 : 1;
    v.glow.setAlpha(0.6 * fade).setScale(1.9);
    if (v.col) v.col.setAlpha(fade);
    else for (let i = 0; i < TONGUES; i++) {
      const a = (i - 1) * 0.7, h = (1.3 + 0.35 * Math.sin(clock * (11 + i * 3) + i)) * (VENT.radius / 48);
      v.tongues[i].setPosition(v.x + Math.sin(a) * 22, v.y + 30 - Math.abs(Math.sin(a)) * 6).setScale(0.9 * (VENT.radius / 48), h).setAlpha(fade).setDepth(this.room.darkMask ? warnDepth(this.room) + 1 : actorDepth(v.y + 30));
    }
    if (k > 0.92) return; // no damage in the dying moments
    const rr = VENT.radius;
    if (!v.hit && p && !p.dead && p.canBeHit()) {
      const q = rr + p.hurtRadius * 0.5;
      if ((p.x - v.x) ** 2 + (p.y - v.y) ** 2 < q * q) v.hit = hurtPlayer(this.scene, 1, v.x, v.y, 'vent');
    }
    const list = this.scene.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!groundFoe(e) || v.hitSet.has(e) || fireproof(e)) continue;
      const q = rr + e.hitRadius * 0.6;
      if ((e.x - v.x) ** 2 + (e.y - v.y) ** 2 > q * q) continue;
      v.hitSet.add(e);
      e.hurt(VENT.enemyDmg, { x: v.x, y: v.y, hazard: 'vent', fire: true });
    }
  }

  destroy() { for (const v of this.vents) v.destroy(); this.vents.length = 0; }
}

export default VentField;
