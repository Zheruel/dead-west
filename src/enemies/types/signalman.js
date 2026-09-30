// SIGNALMAN (CHAPTER2 s4 #2, F5 ghost lamplighter / line zoner). Flies, keeps ~420 px away and strafes. Every 5.0 s it swings its red lantern 0.6 s (pose 4), then
// locks the tile row AND column through the player: both lines telegraph 1.0 s (red band, lamps, 4 bells: LaneSweep) and a ghost cart (dmg 1, 560 px/s,
// passes over anything) sweeps each. Only one signal is active per room (room token `signal`, held until the carts have crossed); the 4 diagonal
// quadrants between the two lines are safe. The "max 2 signalmen per room" cap is a template / wave-building rule (see INTEGRATION_REQUESTS).
import Phaser from 'phaser';
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { rng } from '../../core/rng.js';
import { ROOM, TILE, COLS, ROWS, DEPTH } from '../../config.js';

const EVERY = 5.0;
const SWING = 0.6;
const TELL = 1.0;
const HOLD = SWING + TELL + 2.9; // token held until the slowest cart (1440 px at 560 px/s) has left the room
const RANGE = 420;

class Signalman extends Enemy {
  init() {
    this.setState('float');
    this.sigCd = rng.game.float(1.6, 3.0);
    this.hold = 0;
    this.strafe = rng.game.sign();
    this.strafeT = rng.game.float(1, 2);
    this.wobble = rng.game.float(0, 6);
    this.glow = this.scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff3020).setVisible(false);
    this.glow.__noSnap = true;
    this.glowT = 0;
  }

  ai(dt) {
    const p = this.player;
    this.faceToward(p.x);
    this.wobble += dt;
    this.airHeight = (this.meta.air ?? 30) + Math.sin(this.wobble * 3) * 6;
    if (this.hold > 0) { this.hold -= dt; if (this.hold <= 0) this.releaseToken('signal'); }
    this.lantern(dt);
    if (this.state === 'swing') { this.stop(); return; }
    this.sigCd -= dt;
    if (this.state === 'float') this.setPose('move');
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = rng.game.float(1.4, 2.6); }
    this.keepDistance(RANGE, this.strafe, this.speed, 60);
    if (this.sigCd <= 0 && this.state === 'float') {
      if (this.takeToken('signal', 1)) this.swing();
      else this.sigCd = 0.4;
    }
  }

  swing() {
    this.setState('swing');
    this.stop();
    this.hold = HOLD;
    this.sigCd = this.cd(EVERY);
    Sfx.play('lasso_swish', { vol: 0.5, detune: -500 });
    this.telegraph(SWING, () => this.lock());
  }

  /** Lantern down: lock the row and column through the player and send a ghost cart along each. */
  lock() {
    const p = this.player, room = this.scene.room;
    this.setPose('attack'); // lantern raised while the lines burn
    this.setState('signal');
    this.glowT = TELL + 0.5;
    const row = Math.max(0, Math.min(ROWS - 1, Math.floor((p.y - ROOM.y) / TILE)));
    const col = Math.max(0, Math.min(COLS - 1, Math.floor((p.x - ROOM.x) / TILE)));
    const a = room && room.spawnLane({ axis: 'h', index: row, dir: rng.game.sign(), kind: 'ghost', tell: TELL });
    const b = room && room.spawnLane({ axis: 'v', index: col, dir: rng.game.sign(), kind: 'ghost', tell: TELL });
    if (!a && !b) { this.hold = 0; this.releaseToken('signal'); this.sigCd = 0.6; } // lane cap reached: try again shortly
    this.after(TELL + 0.2, () => { this.setPose('move'); this.setState('float'); });
  }

  /** Red lantern glow at the pole tip while swinging / signalling (pooled image, no per-frame allocation). */
  lantern(dt) {
    const g = this.glow;
    if (this.state === 'swing' || this.glowT > 0) {
      this.glowT -= dt;
      const flip = this.sprite.flipX ? 1 : -1;
      g.setVisible(true).setPosition(this.x + flip * (this.state === 'swing' ? 22 : -2), this.footY - this.airHeight - (this.state === 'swing' ? 30 : 84))
        .setScale(0.55 + 0.15 * Math.sin(this.wobble * 22)).setAlpha(0.55).setDepth(DEPTH.fx - 5);
    } else if (g.visible) g.setVisible(false);
  }

  destroy() {
    if (this.glow) { this.glow.destroy(); this.glow = null; }
    super.destroy();
  }
}

registerEnemy('signalman', Signalman, { fps: 6 });
