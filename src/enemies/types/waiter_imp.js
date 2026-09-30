// WAITER IMP (floor 6, lobber): a little bat-winged imp with a tray. Orbits the player at 300-380 px (150 px/s, flies over anything) and every 3.0 s
// lobs a whiskey bottle at where you stand: winding up 0.4 s (pose 4), then a marker r 70 fills for 1.0 s while the bottle arcs in and smashes:
// 1 dmg inside the marker + a ring of 8 glass shards (speed 280, life 0.7). One bottle in flight per imp, 0.6 s of standing still after each throw
// (the shoot-it window). Killing the imp shatters its bottle in mid-air. Fair by design: the marker lands where you were, so keep moving.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { rng } from '../../core/rng.js';
import { Bottle } from '../parts/e6/props.js';

const PERIOD = 3.0;
const WINDUP = 0.4;
const THROW_POSE = 0.25;
const RECOVER = 0.6;
const FLIGHT = 1.0;
let uid = 0;

class WaiterImp extends Enemy {
  init(opts) {
    this.rnd = rng.game.fork(`waiter_imp:${++uid}`);
    const r = this.rnd;
    this.setState('orbit');
    this.orbitR = 300 + r.next() * 80;
    this.dir = r.sign();
    this.dirT = 2 + r.next() * 2.5;
    this.bob = r.next() * 6;
    this.shotCd = opts && opts.instant ? 0.9 + r.next() * 0.6 : 1.0 + r.next() * 1.2;
    this.rest = 0;
    this.bottle = null;
    this.airHeight = this.meta.air ?? 50;
  }

  ai(dt) {
    const p = this.player;
    this.faceToward(p.x);
    this.bob += dt;
    this.airHeight = (this.meta.air ?? 50) + Math.sin(this.bob * 4) * 6;
    switch (this.state) {
      case 'orbit': {
        this.setPose('move');
        this.dirT -= dt;
        if (this.dirT <= 0) { this.dir = -this.dir; this.dirT = 2 + this.rnd.next() * 2.5; }
        this.keepDistance(this.orbitR, this.dir, Math.min(this.speed, 200), 28);
        this.shotCd -= dt;
        if (this.shotCd <= 0 && !(this.bottle && this.bottle.alive)) this.windup();
        break;
      }
      case 'windup': case 'recover': this.stop(); break;
      default: break;
    }
  }

  windup() {
    this.setState('windup');
    this.stop();
    Sfx.play('spawn', { vol: 0.2, rate: 1.8, gap: 0.2 });
    this.telegraph(WINDUP, () => this.lob());
  }

  lob() {
    const p = this.player;
    const tx = p.x, ty = p.y;
    this.setPose('attack');
    this.setState('recover');
    Sfx.play('lasso_swish', { vol: 0.5, rate: 1.4, gap: 0.1 });
    const dx = this.sprite && this.sprite.flipX ? -22 : 22;
    let { x: bx, y: by } = this.scene.room ? this.scene.room.walkableNear(tx, ty) : { x: tx, y: ty };
    if (Math.hypot(bx - tx, by - ty) > 80) { bx = tx; by = ty; } // never drift the marker away from a player standing on a hazard tile
    this.bottle = new Bottle(this.scene, bx, by, {
      from: { x: this.x + dx, y: this.footY - this.airHeight - 20 }, owner: this, flight: FLIGHT, angle0: this.rnd.next() * 6.283,
    });
    this.after(THROW_POSE, () => this.setPose('move'));
    this.after(RECOVER, () => { this.setPose('move'); this.setState('orbit'); this.shotCd = this.cd(PERIOD - WINDUP - RECOVER); });
  }

  onWallHit() { this.dir = -this.dir; this.dirT = 2 + this.rnd.next() * 2; }

  onDeath() {
    if (this.bottle && this.bottle.alive) this.bottle.cancel();
    this.bottle = null;
  }
}

registerEnemy('waiter_imp', WaiterImp);
