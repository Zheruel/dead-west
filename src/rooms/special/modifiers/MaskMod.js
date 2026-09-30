// Modifiers drawn through the LightMask (dust storm, darkness, fog): the mask fades in on entry and lifts when the room is cleared.
import { Mod } from './Base.js';
import { LightMask } from './LightMask.js';

export class MaskMod extends Mod {
  constructor(room, cfg, salt, maskCfg) {
    super(room, cfg, salt);
    this.mask = new LightMask(this.scene, maskCfg || cfg.mask);
    this.fade = 0; // 0 -> 1 in 0.6 s
    this.lifting = false;
    this.mask.alphaMul = 0;
  }

  /** Extra lights (familiars): subclasses refresh `this.mask.lights` here. */
  lights() {}

  overlay(dt) {
    const m = this.mask;
    if (!m.rt) return;
    this.fade = this.lifting ? Math.max(0, this.fade - dt / 1.0) : Math.min(1, this.fade + dt / 0.6);
    m.alphaMul = this.fade;
    const p = this.scene.player;
    this.lights();
    m.update(dt, p ? p.x : 720, p ? p.y - 20 : 528);
    this.visuals(dt);
    if (this.lifting && this.fade <= 0) { m.setVisible(false); this.lifted(); }
  }

  visuals(dt) {}
  lifted() {}
  onClear() { this.lifting = true; }
  onDestroy() { this.mask.destroy(); }
}
