// Lit dynamite: placed by the player (E) or thrown (dynamiter / bosses). Registered in scene.dynamites.
import Phaser from 'phaser';
import { DEPTH, actorDepth } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';
import { bus } from '../core/events.js';
import { explode } from '../systems/Explosions.js';

export default class Dynamite {
  /**
   * o: {fuse, radius, damage, playerDamage, hurtEnemies, hurtPlayer, from:{x,y}, flight (s, arc time), owner:'player'|'enemy' (default enemy),
   *     fire (forwarded to Room.onExplosion: true/false forces / forbids the ground-fire patches), silent (no 'dynamite:placed': vest / crate sticks)}
   * owner 'player' feeds the item engine (nitro fire, clusters, refunds, `explosion` hook) via explode().
   * If `from` and `flight` are given the stick arcs from `from` to (x,y) before starting its fuse.
   */
  constructor(scene, x, y, o = {}) {
    this.scene = scene;
    this.x = x; this.y = y;
    this.alive = true;
    this.fuse = o.fuse ?? 1.4;
    this.maxFuse = this.fuse;
    this.o = o;
    this.flight = o.from ? (o.flight ?? 0.8) : 0;
    this.flightT = 0;
    this.from = o.from || null;
    Assets.ensureAnim(scene, 'dynamite_placed', { fps: 8, name: 'lit' });
    this.sprite = Assets.makeSprite(scene, x, y + 20, 'dynamite_placed', 0);
    this.sprite.play('dynamite_placed:lit');
    this.shadow = scene.add.image(x, y + 18, 'shadow').setScale(0.4).setDepth(DEPTH.shadows);
    this.stick = null;
    this.glow = scene.add.image(x, y - 8, 'glow').setTint(0xff9a30).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0).setDepth(scene.fx.lit(DEPTH.bullets - 4)); // fuse light
    this.sparkT = 0;
    if (this.flight > 0) {
      this.sprite.setVisible(false);
      this.stick = Assets.makeCell(scene, this.from.x, this.from.y, 'projectiles', 'dynamite_stick').setDepth(DEPTH.bullets + 5);
    }
    this.fuseLoop = null;
    scene.dynamites.push(this);
    if (!this.flight) this._start();
  }

  _start() {
    this.fuseLoop = Sfx.loop('fuse', { vol: 0.6 });
    if (this.o.owner === 'player' && !this.o.silent) bus.emit('dynamite:placed', { x: this.x, y: this.y }); // Meta counts player-placed sticks only (enemy throws, vest and crate sticks are silent)
  }

  update(dt) {
    if (!this.alive) return;
    if (this.flightT < this.flight) {
      this.flightT += dt;
      const k = Math.min(1, this.flightT / this.flight);
      const px = this.from.x + (this.x - this.from.x) * k;
      const py = this.from.y + (this.y - this.from.y) * k;
      const arc = Math.sin(k * Math.PI) * 140;
      this.stick.setPosition(px, py - arc - 30).setRotation(k * 12);
      this.shadow.setPosition(px, py + 18);
      if (k >= 1) { this.stick.destroy(); this.stick = null; this.sprite.setVisible(true); this._start(); }
      return;
    }
    this.fuse -= dt;
    // fuse spark + flickering light (faster and brighter as it burns down)
    const hot = 1 - Math.max(0, this.fuse) / Math.max(0.01, this.maxFuse);
    this.sparkT -= dt;
    const tipX = this.x + 7, tipY = this.y - 20;
    if (this.sparkT <= 0) {
      this.sparkT = 0.055 - hot * 0.03;
      this.scene.fx.burst(tipX, tipY, { color: [0xffe090, 0xff9a30, 0xffffff], count: 2, speed: [30, 120], life: [140, 320], scale: [1, 2.2], gravity: 160, blend: 'ADD' });
    }
    if (this.glow) this.glow.setPosition(tipX, tipY).setScale(0.5 + hot * 0.9 + Math.random() * 0.25).setAlpha(0.35 + hot * 0.35 + Math.random() * 0.2);
    const blink = this.fuse < 0.6 && Math.floor(this.fuse * 14) % 2 === 0;
    this.sprite.setTint(blink ? 0xffffff : 0xffffff).setAlpha(blink ? 0.6 : 1);
    this.sprite.setDepth(this.scene.fx.lit(actorDepth(this.y + 20)));
    this.shadow.setPosition(this.x, this.y + 18);
    if (this.fuse <= 0) this.explode();
  }

  explode() {
    if (!this.alive) return;
    this.alive = false;
    const o = this.o;
    if (this.fuseLoop) this.fuseLoop.stop();
    this.destroyVisuals();
    const s = this.scene;
    const p = s.player;
    explode(s, this.x, this.y, {
      radius: o.radius ?? (p ? p.stats.dynamiteRadius : 150),
      damage: o.damage ?? (p ? p.stats.dynamiteDamage : 60),
      playerDamage: o.playerDamage ?? 2,
      hurtEnemies: o.hurtEnemies,
      hurtPlayer: o.hurtPlayer,
      source: this,
      owner: o.owner,
      fire: o.fire,
    });
    const i = s.dynamites.indexOf(this);
    if (i >= 0) s.dynamites.splice(i, 1);
  }

  destroyVisuals() {
    if (this.sprite) { this.sprite.destroy(); this.sprite = null; }
    if (this.shadow) { this.shadow.destroy(); this.shadow = null; }
    if (this.stick) { this.stick.destroy(); this.stick = null; }
    if (this.glow) { this.glow.destroy(); this.glow = null; }
  }

  /** Remove without exploding (room change). */
  destroy() {
    this.alive = false;
    if (this.fuseLoop) this.fuseLoop.stop();
    this.destroyVisuals();
  }
}
