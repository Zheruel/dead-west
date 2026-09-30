// MINI-BOSS 6 - THE HEAD BOUNCER (waistcoated demon with a bar towel, floor 6, HP 480, EVENTS s4.3 + D1: renamed from `bouncer`). Strip enemy_head_bouncer
// (0-3 strut, 4 winds up with a bottle, 5 throws). Walks (100 px/s) to ~280 px between attacks. The arena has three breakable tables.
//  * stool_throw - 0.5 s wind-up, 3 spinning stools land after 0.9 s on red discs (r60; player + 2 more), 1 dmg each + 4 splinters in a cross (300 px/s).
//  * mug_slide   - 3 rows (yours + 2 random) glow red for 0.9 s, then a mug slides along each at 700 px/s: 1 dmg, breaks tables.
//  * bum_rush    - 0.7 s wind-up (tracking line, locked for the last 0.3 s), dash at 500 px/s: 2 dmg + heavy knockback; 0.8 s recovery (x1.2 damage).
//  * phase 2, Last Call (< 50 %): chugs a bottle (invulnerable 1.0 s), speed x1.3, two possessed patrons stagger in.
import MiniBase, { ROOM, TILE, ROWS, TAU } from '../parts/MiniBase.js';
import { registerBoss } from '../registry.js';
import { Sfx } from '../../core/Audio.js';

const WOOD = 0xc09060;

class HeadBouncer extends MiniBase {
  build() {
    this.addAttack('stool_throw', this.atkStools, { weight: 3 });
    this.addAttack('mug_slide', this.atkMugs, { weight: 2 });
    this.addAttack('bum_rush', this.atkRush, { weight: 2 });
    this.strafe = this.rng.sign();
    this.strafeT = 1.5;
    this.baseSpeed = this.speed;
  }

  moveBehaviour(dt) {
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = this.rng.float(1.4, 2.6); }
    this.keepDistance(280, 0.4 * this.strafe, this.speed, 60);
  }

  laneWidth() { return 2 * (this.radius * 0.85 + this.player.hurtRadius) - 4; }

  // ------------------------------------------------------------------------------------------ stool throw
  *atkStools() {
    const s = this.scene, p = this.player;
    this.setPose('windup');
    this.pulse(0.5);
    Sfx.play('lasso_swish', { rate: 0.8 });
    yield 0.5;
    this.setPose('attack');
    const pts = [{ x: p.x, y: p.y }, this.predict(0.5)];
    const a = this.rng.float(0, TAU);
    pts.push(this.clampIn(p.x + Math.cos(a) * 210, p.y + Math.sin(a) * 210, 80));
    if (Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) < 120) { // standing still: throw the second one to the side
      const b = a + Math.PI * 0.7;
      const q = this.clampIn(p.x + Math.cos(b) * 190, p.y + Math.sin(b) * 190, 80);
      pts[1].x = q.x; pts[1].y = q.y;
    }
    let off = this.rng.int(0, 1) * 45;
    for (const q of pts) {
      const o = off;
      off = 45 - off;
      this.zone(q.x, q.y, 60, {
        tell: 0.9, dmg: 1, kind: 'stool', color: 0xd63a2a, sfx: 'glass_break', fallHeight: 520, fallDur: 0.5, fallLift: 10, burstColors: [0x8a5a2a, 0x6b4423, 0xc09060],
        fall: (sc) => {
          const im = sc.add.image(0, 0, 'mini_stool').setScale(1.3);
          const tw = sc.tweens.add({ targets: im, angle: 720, duration: 700, repeat: -1 });
          im.once('destroy', () => tw.remove());
          return im;
        },
        onLand: () => s.bullets.enemy.ring({ x: q.x, y: q.y, speed: 300, damage: 1, kind: 'nail', tint: WOOD, scale: 0.9, lift: 18, life: 1.6 }, 4, o),
      });
    }
    yield 0.9;
    this.setPose('move');
    yield 0.7;
  }

  // ------------------------------------------------------------------------------------------ mug slide
  *atkMugs() {
    const p = this.player;
    this.setPose('windup');
    this.pulse(0.4);
    Sfx.play('bottle_pop', { rate: 0.9 });
    yield 0.4;
    this.setPose('attack');
    const mine = Math.max(0, Math.min(ROWS - 1, Math.floor((p.y - ROOM.y) / TILE)));
    const rows = [mine];
    while (rows.length < 3) { const r = this.rng.int(0, ROWS - 1); if (!rows.includes(r)) rows.push(r); }
    for (const row of rows) {
      const dir = this.rng.sign();
      this.sweep({
        row, dir, speed: 700, w: 84, len: 60, dmg: 1, kind: 'mug', tell: 0.9, breaks: true,
        sfx: { key: 'glass_break', opts: { vol: 0.5, rate: 0.7 } },
        make: (sc) => sc.add.image(0, 0, 'mini_mug').setOrigin(0.5, 1).setFlipX(dir < 0).setScale(1.5),
      });
    }
    yield 0.9 + 1.9;
    this.setPose('move');
    yield 0.3;
  }

  // ------------------------------------------------------------------------------------------ bum rush
  *atkRush() {
    const fx = this.scene.fx, p = this.player, w = this.laneWidth();
    this.setPose('windup');
    this.pulse(0.7);
    Sfx.play('bull_snort', { rate: 0.7, vol: 0.5 });
    let a = this.angleToPlayer();
    const maxD = () => Math.min(900, this.rayLen(this.x, this.y, a), this.distToPlayer() + 260);
    yield* this.hold(0.4, () => {
      a = this.angleToPlayer();
      this.lockLine(this.x, this.y, a, maxD(), w, 0.1);
    });
    a = this.angleToPlayer();
    this.clearLine();
    const len = maxD();
    this.track(fx.warnLine(this.x, this.y, this.x + Math.cos(a) * len, this.y + Math.sin(a) * len, w, 0.3, 0xd63a2a), 0.6);
    Sfx.play('whip_crack', { rate: 0.8 });
    yield 0.3;
    this.setPose('attack');
    const end = yield* this.dash(a, 500, len, { dmg: 2, stopOnHit: true, each: () => { if (this.rng.next() < 0.3) fx.dust(this.x, this.y + 30, 0.6); } });
    if (end === 'hit') { // heavy knockback (Player.damage already shoved 340 px/s)
      p.knock.x = Math.cos(a) * 700; p.knock.y = Math.sin(a) * 700;
      fx.shake(0.012, 250);
    } else fx.shake(0.006, 150);
    this.dustRing(130);
    this.stun(0.8);
    this.setPose('windup');
    yield 0.8;
    this.stunT = 0;
    this.setPose('move');
  }

  // ------------------------------------------------------------------------------------------ phase 2: Last Call
  *phaseGen() {
    const s = this.scene;
    this.atkFrame(0); // bottle up
    this.pulse(1.0);
    this.invulnerable = true;
    Sfx.play('potion_gulp', { rate: 0.8 });
    s.fx.ringPulse(this.x, this.y, 0xe0a040, 200, 800, 0.5);
    yield 0.5;
    Sfx.play('potion_gulp', { rate: 0.7 });
    yield 0.4;
    Sfx.play('glass_break', { vol: 0.9 });
    s.fx.burst(this.x, this.y - 80, { color: [0x4fa05a, 0xffffff, 0xd8e8c8], count: 14, speed: [80, 300], life: [300, 700], scale: [1.5, 3], gravity: 500 });
    yield 0.1;
    this.invulnerable = false;
    this.enterPhase2();
    yield 0.1;
  }
  enterPhase2() {
    this.speed = this.baseSpeed * 1.3;
    let alive = 0;
    for (const e of this.scene.enemies) if (e.alive && e.id === 'possessed') alive++;
    const n = Math.max(0, Math.min(2, 2 - alive));
    if (n > 0) this.spawnAdds('possessed', n, { radius: 230, opts: { noLoot: true } });
    this.scene.fx.flash(0xd63a2a, 0.2);
  }
  onCancel() { if (this.p2) this.speed = this.baseSpeed * 1.3; }
}

registerBoss('head_bouncer', HeadBouncer, { foot: 30 });
