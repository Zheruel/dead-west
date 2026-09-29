// Per-GameScene input: movement (WASD), aim (arrows last-pressed-wins, or held mouse), action edges.
// `override` lets automated tests drive the game: input.override = {move:{x,y}, aim:{x,y}|null, fire:bool}
import Phaser from 'phaser';

const ACTIONS = { Space: 'roll', KeyE: 'dyn', KeyQ: 'active' };
const ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

export default class GameInput {
  constructor(scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({ w: K.W, a: K.A, s: K.S, d: K.D, roll: K.SPACE, dyn: K.E, active: K.Q });
    kb.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    this.stack = []; // arrow keys currently held, in press order
    this.mouseDown = false;
    this.override = null;
    this._pressQueue = { roll: 0, dyn: 0, active: 0 };
    this._onDown = (e) => {
      if (e.repeat) return;
      const act = ACTIONS[e.code];
      if (act) this._pressQueue[act] = Math.min(2, this._pressQueue[act] + 1); // queue on keydown so same-frame taps are not lost
      if (ARROWS[e.code] && !this.stack.includes(e.code)) this.stack.push(e.code);
    };
    this._onUp = (e) => { this.stack = this.stack.filter((c) => c !== e.code); };
    kb.on('keydown', this._onDown);
    kb.on('keyup', this._onUp);
    this._onBlur = () => { this.stack = []; this.mouseDown = false; };
    scene.game.events.on('blur', this._onBlur);
    scene.input.on('pointerdown', (p) => { if (p.leftButtonDown()) this.mouseDown = true; });
    scene.input.on('pointerup', () => { this.mouseDown = false; });
    scene.events.once('shutdown', () => {
      kb.off('keydown', this._onDown);
      kb.off('keyup', this._onUp);
      scene.game.events.off('blur', this._onBlur);
    });
  }

  /** Movement vector, normalised (length <= 1). */
  get move() {
    if (this.override && this.override.move) return this.override.move;
    const k = this.keys;
    let x = (k.d.isDown ? 1 : 0) - (k.a.isDown ? 1 : 0);
    let y = (k.s.isDown ? 1 : 0) - (k.w.isDown ? 1 : 0);
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  /** Aim direction (unit vector) or null when not shooting. `from` = player position for mouse aiming. */
  aim(from) {
    if (this.override && 'aim' in this.override) return this.override.aim;
    if (this.stack.length) { const v = ARROWS[this.stack[this.stack.length - 1]]; return { x: v[0], y: v[1] }; }
    if (this.mouseDown) {
      const p = this.scene.input.activePointer;
      const dx = p.worldX - from.x, dy = p.worldY - from.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    }
    return null;
  }

  press(name) { this._pressQueue[name]++; }
  /** True once per key press (edge). */
  pressed(name) {
    if (this._pressQueue[name] > 0) { this._pressQueue[name]--; return true; }
    return false;
  }
  reset() { this.stack = []; this.mouseDown = false; this._pressQueue = { roll: 0, dyn: 0, active: 0 }; }
}
