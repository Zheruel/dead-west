// MINI-BOSS 1 - OL' FURY (undead longhorn, floor 1, HP 120, EVENTS s4.3). Strip enemy_ol_fury (0-3 idle, 4 rears up, 5 horns lowered). Stationary between attacks.
//  * charge - paws scrape (0.45 s of a faint tracking line, then the lane LOCKS: red band 0.25 s before the run), 640 px/s until a wall or rock, contact = 2.
//             Wall impact: dust ring + 1.1 s stun (x1.2 damage). The band is drawn at the real danger width (body + player), a hair wider than the doc's 110 px.
//  * stomp  - rears up 0.6 s (red disc r150 on the floor), lands: 1 dmg inside the disc + a ring of 10 dust bullets (260 px/s).
//  * phase 2 (< 50 %): roar, eyes glow, `charge` chains twice (0.5 s gap, second lock re-aimed) and every wall impact spawns 2 tumbleweed_mini (max 4 alive).
import MiniBase, { TAU } from '../parts/MiniBase.js';
import { registerBoss } from '../registry.js';
import { Sfx } from '../../core/Audio.js';

const CHARGE_SPEED = 640;
const STUN = 1.1;
const DUST = 0xd8c8a0;

class OlFury extends MiniBase {
  build() {
    this.addAttack('charge', this.atkCharge, { weight: 3 });
    this.addAttack('stomp', this.atkStomp, { weight: 2 });
    this.glowT = 0;
  }

  moveBehaviour() { this.stop(); }

  /** Width of the lane that can actually hurt the player (body + player hurt radius). */
  laneWidth() { return 2 * (this.radius * 0.85 + this.player.hurtRadius) - 4; }

  // ------------------------------------------------------------------------------------------ charge
  /** One run: `track` s of tracking line, `lockT` s of locked red band, then the dash. Returns the dash end. */
  *run(track, lockT) {
    const fx = this.scene.fx, w = this.laneWidth();
    this.setPose('attack'); // horns lowered
    Sfx.play('bull_snort', { rate: 0.9 });
    let a = this.angleToPlayer();
    yield* this.hold(track, () => {
      a = this.angleToPlayer();
      this.lockLine(this.x, this.y, a, this.rayLen(this.x, this.y, a), w, 0.1);
      if (this.rng.next() < 0.12) fx.dust(this.x + this.rng.float(-50, 50), this.y + 40, 0.7); // paws scrape
    });
    a = this.angleToPlayer(); // lock
    this.clearLine();
    const len = this.rayLen(this.x, this.y, a);
    this.track(fx.warnLine(this.x, this.y, this.x + Math.cos(a) * len, this.y + Math.sin(a) * len, w, lockT, 0xd63a2a), lockT + 0.3);
    Sfx.play('bull_snort', { rate: 1.15, vol: 0.9 });
    yield lockT;
    const end = yield* this.dash(a, CHARGE_SPEED, 2400, { dmg: 2, each: () => { if (this.rng.next() < 0.3) fx.dust(this.x, this.y + 40, 0.6); } });
    this.impact(end === 'wall');
    return end;
  }

  impact(spawn) {
    const s = this.scene, fx = s.fx;
    fx.shake(0.012, 260);
    fx.hitStop(60);
    this.dustRing(170);
    Sfx.play('explosion', { vol: 0.5, rate: 0.8 });
    Sfx.play('bullet_hit_wall', { vol: 0.9, rate: 0.6 });
    this.setPose('attack');
    if (spawn && this.p2) {
      let alive = 0;
      for (const e of s.enemies) if (e.alive && e.id === 'tumbleweed_mini') alive++;
      const n = Math.min(2, 4 - alive);
      if (n > 0) this.spawnAdds('tumbleweed_mini', n, { radius: 150, opts: { noLoot: true } });
    }
  }

  *atkCharge() {
    yield* this.run(0.45, 0.25);
    if (this.p2) {
      this.stun(0.5);
      yield 0.5;
      this.stunT = 0;
      yield* this.run(0.15, 0.3); // re-aimed: 0.45 s of warning in total
    }
    this.stun(STUN);
    yield STUN;
    this.stunT = 0;
  }

  // ------------------------------------------------------------------------------------------ stomp
  *atkStomp() {
    const s = this.scene, fx = s.fx, p2 = this.p2;
    this.setPose('windup'); // rears up
    this.pulse(0.6);
    Sfx.play('bull_snort', { rate: 0.8 });
    const off = this.rng.float(0, TAU);
    this.zone(this.x, this.y, 150, {
      tell: 0.6, dmg: 1, kind: 'stomp', fx: 'none', shake: false, decal: false,
      onLand: () => {
        this.setPose('attack');
        this.dustRing(200);
        fx.shake(0.014, 300);
        Sfx.play('explosion', { vol: 0.6, rate: 0.7 });
        s.bullets.enemy.ring({ x: this.x, y: this.y, speed: 260, damage: 1, kind: 'rock', tint: DUST, scale: 0.75, radius: 11, lift: 22, life: 2.4 }, 10, (off * 180) / Math.PI);
      },
    });
    yield 0.6;
    yield p2 ? 0.55 : 0.75;
  }

  // ------------------------------------------------------------------------------------------ phase 2 / visuals
  enterPhase2() {
    this.fireballScale = 1.25;
    this.scene.fx.flash(0xd63a2a, 0.25);
  }
  update(dt) {
    super.update(dt);
    if (this.p2 && this.active && !this.dying && this.sprite) {
      this.glowT -= dt;
      if (this.glowT <= 0) { // eyes glow
        this.glowT = 0.3;
        this.scene.fx.burst(this.x - 8, this.y - 78, { color: [0xff2a1a, 0xff8060], count: 1, speed: [4, 20], life: [260, 420], scale: [1.4, 2.6], blend: 'ADD' });
      }
    }
  }
}

registerBoss('ol_fury', OlFury, { foot: 30 });
