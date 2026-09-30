// MINI-BOSS 2 - THE HANGMAN (masked executioner with a chain flail, floor 2, HP 190, EVENTS s4.3). Strip enemy_hangman (0-3 walk, 4 arms wide, 5 swing).
// Walks (90 px/s) at ~320 px and strafes between attacks.
//  * flail        - 0.7 s wind-up (chain whirls), then 2.0 s of a two-arm spiral of ghostfire (12 ticks/s, 250 px/s) while he walks at you at 60 px/s.
//  * gallows_drop - three red discs (r90) on the player and two predicted positions, 1.1 s later a noose drops: 1 dmg + snag (move x0.4 for 1.2 s).
//  * phase 2 (< 50 %): roar, 2 ghost deputies join, `flail` has three arms.
import MiniBase from '../parts/MiniBase.js';
import { registerBoss } from '../registry.js';
import { Sfx } from '../../core/Audio.js';

const TICK = 1 / 12;
const SNAG = 1.2;

class Hangman extends MiniBase {
  build() {
    this.addAttack('flail', this.atkFlail, { weight: 3 });
    this.addAttack('gallows_drop', this.atkGallows, { weight: 2 });
    this.strafe = this.rng.sign();
    this.strafeT = 1.5;
    this.deputies = 0;
  }

  moveBehaviour(dt) {
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = this.rng.float(1.4, 2.6); }
    this.keepDistance(320, 0.4 * this.strafe, this.speed, 60);
  }

  // ------------------------------------------------------------------------------------------ flail
  *atkFlail() {
    const s = this.scene, p = this.player, arms = this.p2 ? 3 : 2;
    this.setPose('windup');
    this.pulse(0.7);
    Sfx.play('lasso_swish', { rate: 0.7 });
    yield 0.7;
    this.setPose('attack');
    const dir = this.rng.sign(), start = this.rng.float(0, 360);
    const spin = s.bullets.enemy.spiral(
      { getX: () => this.x, getY: () => this.y - 20, speed: 250, damage: 1, kind: 'ghostfire', lift: 26, life: 3.4 },
      { count: 24, stepDeg: 17 * dir, interval: TICK, startAngle: start, arms },
    );
    this.track(spin, 2.5);
    Sfx.play('lasso_swish', { rate: 0.55, vol: 0.9 });
    let whirl = 0;
    yield* this.hold(2.0, (e) => {
      this.moveToward(p.x, p.y, 60);
      if (e >= whirl) { whirl += 0.5; Sfx.play('lasso_swish', { rate: 0.6, vol: 0.5 }); }
    });
    this.stop();
    this.setPose('move');
    yield 0.35;
  }

  // ------------------------------------------------------------------------------------------ gallows drop
  *atkGallows() {
    const s = this.scene;
    this.setPose('windup');
    this.pulse(0.6);
    Sfx.play('lasso_swish', { rate: 0.9 });
    yield 0.5;
    this.setPose('attack');
    const p = this.player;
    const pts = [{ x: p.x, y: p.y }, this.predict(0.55), this.predict(1.1)];
    for (let i = 1; i < 3; i++) { // never stack the discs: nudge a predicted one that landed on top of another
      for (let k = 0; k < i; k++) {
        if (Math.hypot(pts[i].x - pts[k].x, pts[i].y - pts[k].y) < 130) {
          const a = this.rng.float(0, Math.PI * 2);
          const q = this.clampIn(pts[k].x + Math.cos(a) * 190, pts[k].y + Math.sin(a) * 190);
          pts[i].x = q.x; pts[i].y = q.y;
        }
      }
    }
    for (const q of pts) {
      this.zone(q.x, q.y, 90, {
        tell: 1.1, dmg: 1, kind: 'noose', sfx: 'whip_crack', fallHeight: 520, fallDur: 0.35, fallLift: 0,
        fall: (sc) => sc.add.image(0, 0, 'mini_noose').setOrigin(0.5, 1),
        onLand: (hz, landed) => { if (landed) p.addBuff('snag', (st) => { st.moveSpeed *= 0.4; }, SNAG); },
      });
    }
    yield 1.1;
    this.setPose('move');
    yield 0.5;
  }

  // ------------------------------------------------------------------------------------------ phase 2
  enterPhase2() {
    let alive = 0;
    for (const e of this.scene.enemies) if (e.alive && e.id === 'ghost') alive++;
    const n = Math.max(0, Math.min(2, 2 - alive));
    if (n > 0) this.spawnAdds('ghost', n, { radius: 220, opts: { deputy: true, noLoot: true } });
    Sfx.play('ghost_wail', { vol: 0.8 });
    this.scene.fx.flash(0x6fe0d0, 0.2);
  }
}

registerBoss('hangman', Hangman, { foot: 26 });
