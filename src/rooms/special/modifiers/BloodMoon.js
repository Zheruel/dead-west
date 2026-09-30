// BLOOD MOON (F3-F6): player bullets x1.5, enemy contact and bullet damage +1 unit, enemy hp x0.75, a guaranteed room-clear drop. Red haze + vignette and
// a moon on the top wall. Numbers ride on bus events (enemy:spawned, bullet:fired), so nothing persists on the player or the enemies after the room.
import Phaser from 'phaser';
import { W, H, ROOM } from '../../../config.js';
import { Mod } from './Base.js';
import { MASK_DEPTH } from './LightMask.js';

export class BloodMoon extends Mod {
  constructor(room, cfg) {
    super(room, cfg, 0xb100d);
    const s = this.scene, d = MASK_DEPTH - 1;
    this.haze = s.add.rectangle(0, 0, W, H, cfg.overlay, cfg.overlayAlpha).setOrigin(0, 0).setDepth(d);
    this.vig = s.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.5).setDepth(d);
    this.glow = s.add.image(ROOM.cx, 128, 'glow').setTint(0xff3a20).setBlendMode(Phaser.BlendModes.ADD).setScale(6, 3).setAlpha(0.5).setDepth(d);
    this.moon = s.add.image(ROOM.cx, 132, 'disc').setTint(0xe8503a).setDisplaySize(84, 84).setAlpha(0.85).setDepth(d);
    for (const o of [this.haze, this.vig, this.glow, this.moon]) o.__noSnap = true;
    this.fade = 0;
    this.lifting = false;
    this.on('enemy:spawned', (e) => this._enemy(e && e.enemy));
    this.on('bullet:fired', (e) => this._bullet(e && e.bullet, e && e.owner));
  }

  _enemy(e) {
    if (!this.running || !e || e.isBoss || e._bloodMoon) return;
    e._bloodMoon = true;
    e.maxHp *= this.cfg.enemyHpMult; e.hp *= this.cfg.enemyHpMult;
    if (e.contactDamage > 0) e.contactDamage += this.cfg.enemyContactBonus;
  }

  _bullet(b, owner) {
    if (!this.running || !b) return;
    if (owner === 'enemy') b.dmg += this.cfg.enemyContactBonus;
    else if (owner === 'player') b.dmg *= this.cfg.playerDamageMult;
  }

  overlay(dt) {
    this.fade = this.lifting ? Math.max(0, this.fade - dt) : Math.min(1, this.fade + dt / 0.8);
    const f = this.fade, pulse = 1 + 0.06 * Math.sin(this.room.age * 1.6);
    this.haze.setAlpha(this.cfg.overlayAlpha * f);
    this.vig.setAlpha(0.5 * f);
    this.glow.setAlpha(0.5 * f * pulse);
    this.moon.setAlpha(0.85 * f);
  }

  onClear() { this.lifting = true; }
  onDestroy() { for (const o of [this.haze, this.vig, this.glow, this.moon]) o.destroy(); }
}
export default BloodMoon;
