// In-game crosshair. The OS cursor is hidden over the canvas while playing; the ui_cursor sprite follows the pointer and is shown only when
// MOUSE aiming is active (pointer moved/clicked since the last arrow-key press) and the pointer is inside the game. It kicks when you shoot and
// turns gold when the sixth bullet is chambered. The OS cursor is restored when the HUD shuts down (menus) or a pause menu opens (PauseScene).
import Assets from '../core/Assets.js';
import { bus } from '../core/events.js';
import { setOsCursor } from './UiKit.js';

const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const BASE = 0.72;

export default class Cursor {
  constructor(hud) {
    this.hud = hud;
    this.spr = Assets.makeImage(hud, -100, -100, 'ui_cursor').setDepth(1000).setScale(BASE).setVisible(false);
    this.mouse = false; // mouse aiming active
    this.inside = true;
    this.sixth = false;
    setOsCursor(hud.game, 'none');
    const inp = hud.input;
    this._move = () => { this.mouse = true; this.inside = true; };
    this._out = () => { this.inside = false; };
    this._over = () => { this.inside = true; };
    this._key = (e) => { if (ARROWS.has(e.code)) this.mouse = false; };
    inp.on('pointermove', this._move);
    inp.on('pointerdown', this._move);
    inp.on('gameout', this._out);
    inp.on('gameover', this._over);
    inp.keyboard.on('keydown', this._key);
    this._fired = () => { hud.tweens.killTweensOf(this.spr); hud.tweens.add({ targets: this.spr, scale: { from: BASE * 1.3, to: BASE }, duration: 140, ease: 'Cubic.easeOut' }); };
    bus.on('player:fired', this._fired);
    hud.events.once('shutdown', () => this.destroy());
  }

  update(g) {
    const p = this.hud.input.activePointer;
    const show = this.mouse && this.inside && !g.player.dead;
    this.spr.setVisible(show);
    if (!show) return;
    this.spr.setPosition(p.x, p.y);
    const sixth = g.player.cylinder && g.player.cylinder.loaded === 1;
    if (sixth !== this.sixth) { this.sixth = sixth; if (sixth) this.spr.setTint(0xffd060); else this.spr.clearTint(); }
    if (!this.hud.tweens.isTweening(this.spr)) this.spr.setAngle(sixth ? Math.sin(this.hud.time.now / 120) * 6 : 0);
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    bus.off('player:fired', this._fired);
    try {
      const inp = this.hud.input;
      inp.off('pointermove', this._move); inp.off('pointerdown', this._move); inp.off('gameout', this._out); inp.off('gameover', this._over);
      inp.keyboard.off('keydown', this._key);
      setOsCursor(this.hud.game, '');
    } catch (e) { /* scene already gone */ }
    this.spr.destroy();
  }
}
